import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { envConfig } from "@/lib/twist";

/**
 * Admin route: report which Twist accounts and hosts are actually configured.
 *
 * There are three Twist accounts in play -- twist@ (the real ordering account,
 * web UI only), twist.sandbox@ and twist.production@ (both created for API
 * access in early 2026) -- and the env var names do not have to agree with the
 * account they hold. This says what the server will actually use, so the
 * question is answered by reading rather than guessing.
 *
 * Token presence and shape only. No secret values are returned.
 */
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const describe = (env: "staging" | "production") => {
    const { baseUrl, email, authToken, endUserToken } = envConfig(env);
    const host = (() => {
      try {
        return new URL(baseUrl).host;
      } catch {
        return baseUrl;
      }
    })();
    return {
      configured: !!authToken && !!endUserToken,
      email,
      baseUrl,
      // Tokens are issued per host: a staging token will not authenticate
      // against the production host, so a mismatch here is a real problem.
      hostLooksLikeStaging: /staging/i.test(host),
      authTokenSet: !!authToken,
      authTokenHasJwtPrefix: authToken?.startsWith("JWT ") ?? false,
      endUserTokenSet: !!endUserToken,
    };
  };

  const staging = describe("staging");
  const production = describe("production");

  return NextResponse.json({
    staging,
    production,
    warnings: [
      staging.configured && !staging.hostLooksLikeStaging
        ? "The 'staging' credential set points at a non-staging host — the var names may not match their contents."
        : null,
      production.configured && production.hostLooksLikeStaging
        ? "The 'production' credential set points at a staging host. Tokens are host-scoped and will not authenticate."
        : null,
      staging.configured && !staging.authTokenHasJwtPrefix
        ? "TWIST_AUTH_TOKEN is missing the required 'JWT ' prefix."
        : null,
      production.configured && !production.authTokenHasJwtPrefix
        ? "TWIST_PROD_AUTH_TOKEN is missing the required 'JWT ' prefix."
        : null,
    ].filter(Boolean),
  });
}
