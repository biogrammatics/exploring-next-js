#!/usr/bin/env node
/**
 * Route inventory for the Next.js App Router tree.
 *
 * Walks src/app, lists every page.tsx and route.ts, and reports the access
 * level each file actually enforces by looking at which guard helper it
 * imports (see src/lib/auth-guards.ts). Also notes Server Action counts and
 * which /api paths a client page fetches.
 *
 *   npm run routes            # markdown tables to stdout
 *   npm run routes -- --json  # machine-readable
 *
 * No dependencies; plain Node. Regenerate the site atlas from this output
 * after adding or moving routes.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "src", "app");
const asJson = process.argv.includes("--json");

/** Guard level, from the strongest helper present down to none. */
function accessLevel(src) {
  if (/requireSuperAdmin|assertSuperAdminAction/.test(src)) return "super-admin";
  if (/requireAdmin\b|requireAdminPage|assertAdminAction/.test(src)) return "admin";
  if (/requireUser\b|requireUserPage|redirect\("\/auth\/signin"\)/.test(src)) return "signed-in";
  if (/stripe\.webhooks\.constructEvent/.test(src)) return "stripe-signature";
  if (/await auth\(\)/.test(src)) return "varies";
  return "public";
}

function urlFor(dir) {
  const rel = relative(appRoot, dir).split("\\").join("/");
  return rel === "" ? "/" : "/" + rel;
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p, out);
      continue;
    }
    if (name !== "page.tsx" && name !== "route.ts") continue;
    const src = readFileSync(p, "utf8");
    const entry = {
      url: urlFor(dir),
      access: accessLevel(src),
      lines: src.split("\n").length,
    };
    if (name === "page.tsx") {
      entry.kind = "page";
      entry.client = /^\s*["']use client["']/m.test(src.slice(0, 300));
      entry.serverActions = (src.match(/"use server"/g) || []).length;
      entry.fetches = [...new Set([...src.matchAll(/fetch\(\s*[`"'](\/api\/[^`"'?$]+)/g)].map((m) => m[1]))].sort();
    } else {
      entry.kind = "api";
      const methods = [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
      entry.methods = methods.length ? methods : /handlers/.test(src) ? ["GET", "POST"] : [];
    }
    out.push(entry);
  }
}

const entries = [];
walk(appRoot, entries);
entries.sort((a, b) => a.url.localeCompare(b.url));
const pages = entries.filter((e) => e.kind === "page");
const apis = entries.filter((e) => e.kind === "api");

if (asJson) {
  process.stdout.write(JSON.stringify({ pages, apis }, null, 2) + "\n");
} else {
  const count = (list, key) =>
    Object.entries(
      list.reduce((acc, e) => ((acc[e[key]] = (acc[e[key]] || 0) + 1), acc), {})
    )
      .map(([k, v]) => `${k} ${v}`)
      .join(" · ");

  console.log(`## Pages (${pages.length})\n`);
  console.log(`Access: ${count(pages, "access")}\n`);
  console.log("| Route | Access | Notes |");
  console.log("|---|---|---|");
  for (const p of pages) {
    const notes = [];
    if (p.client) notes.push("client");
    if (p.serverActions) notes.push(`${p.serverActions} server action${p.serverActions > 1 ? "s" : ""}`);
    if (p.fetches.length) notes.push(`fetches ${p.fetches.join(", ")}`);
    console.log(`| \`${p.url}\` | ${p.access} | ${notes.join("; ")} |`);
  }

  console.log(`\n## API routes (${apis.length})\n`);
  console.log(`Access: ${count(apis, "access")}\n`);
  console.log("| Route | Methods | Access |");
  console.log("|---|---|---|");
  for (const a of apis) {
    console.log(`| \`${a.url}\` | ${a.methods.join(" ")} | ${a.access} |`);
  }
}
