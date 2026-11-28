"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Wraps the legal pages (privacy, terms, cookies) so that clicking the
 * background returns the reader to wherever they came from.
 *
 * These stay ordinary routable pages — they are linked from the footer, indexed,
 * and referenced from outside the site — so this is a layer on top rather than a
 * Next.js intercepting route. Landing on /privacy directly still works exactly
 * as before.
 *
 * Three ways out, because a click-on-the-background is invisible on its own:
 *
 * - The visible Back control. This is the real affordance, and the only one that
 *   works for keyboard and screen-reader users or on a phone, where the panel
 *   fills the width and the background is a sliver.
 * - Escape.
 * - Clicking the background, which is what was actually asked for.
 *
 * Two things the background click has to get right. It fires only when the click
 * lands on the backdrop itself and not on anything inside the panel, and it does
 * nothing while text is selected — otherwise finishing a drag-select of a clause
 * out in the margin would throw the reader off the page mid-read, which on a
 * legal document is the worst possible moment.
 */
export function DismissToReturn({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const dismiss = useCallback(() => {
    // Going back is only safe when the entry behind this one is ours, and
    // working out whether it is takes more care than it looks.
    //
    // Two tempting signals are both wrong. `document.referrer` does not move
    // during App Router soft navigations, so arriving via the footer link
    // reports whatever referred the original document — identical to a cold
    // landing. And `history.length` counts a fresh tab's blank entry, so a tab
    // opened straight onto this page reports 2, not 1; back() then has nothing
    // real to return to and silently does nothing, stranding the reader on the
    // page they just asked to leave. That was measured, not guessed.
    //
    // The navigation entry does not have either problem. Its name is the URL
    // the *document* loaded at, and a client-side navigation changes the path
    // without creating a new entry. So a path that no longer matches where the
    // document loaded means we soft-navigated here and the previous entry is
    // ours; a path that still matches means this page is where the tab opened,
    // and home is the only honest destination.
    const [navigation] = performance.getEntriesByType("navigation");
    let loadedAt: string | null = null;
    try {
      loadedAt = navigation ? new URL(navigation.name).pathname : null;
    } catch {
      loadedAt = null;
    }

    if (loadedAt !== null && loadedAt !== window.location.pathname) router.back();
    else router.push("/");
  }, [router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dismiss]);

  const onBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Anything inside the panel bubbles up to here; only a direct hit counts.
    if (event.target !== event.currentTarget) return;
    // A drag-select that ends out in the margin is a read, not a dismissal.
    if (window.getSelection()?.toString()) return;
    dismiss();
  };

  return (
    // The backdrop is presentational and carries no interactive role of its
    // own: every action it offers is also on the button below and on Escape,
    // so nothing here is reachable only by mouse.
    <div className="min-h-screen px-4 py-8" onClick={onBackdropClick}>
      <div className="max-w-4xl mx-auto mb-4">
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 backdrop-blur border border-white/30 text-white hover:bg-white/30 transition-all"
        >
          <span aria-hidden="true">&larr;</span> Back
        </button>
      </div>
      {/* Carries the max-w-4xl mx-auto the pages' own outer div used to set, so
          swapping this component in needed no change to their markup. */}
      <div className="max-w-4xl mx-auto">{children}</div>
    </div>
  );
}
