"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { QuoteStatus } from "@/generated/prisma/client";
import {
  QUOTE_STATUSES,
  QUOTE_STATUS_LABELS,
  MAX_ADMIN_NOTES_LENGTH,
} from "@/lib/quote-status";

interface Props {
  quoteId: string;
  quoteNumber: string;
  currentStatus: QuoteStatus;
  currentNotes: string | null;
}

/** Pull a usable message out of an error response body. */
async function errorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error) return body.error;
  } catch {
    // non-JSON body; fall through
  }
  return `${fallback} (${response.status})`;
}

export function QuoteAdminForm({
  quoteId,
  quoteNumber,
  currentStatus,
  currentNotes,
}: Props) {
  const router = useRouter();

  const [status, setStatus] = useState<QuoteStatus>(currentStatus);
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Re-sync after router.refresh(), or if a colleague moved the quote.
  useEffect(() => {
    setStatus(currentStatus);
    setNotes(currentNotes ?? "");
    setError(null);
  }, [currentStatus, currentNotes]);

  const dirty = status !== currentStatus || notes !== (currentNotes ?? "");

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const payload: Record<string, unknown> = {};
      if (status !== currentStatus) {
        payload.status = status;
        // What this screen was showing. The server refuses the write if the
        // row has moved on, rather than overwriting a colleague's change.
        payload.expectedStatus = currentStatus;
      }
      if (notes !== (currentNotes ?? "")) payload.adminNotes = notes;

      const response = await fetch(`/api/admin/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setError(await errorMessage(response, "Could not save"));
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError(await errorMessage(response, "Could not delete"));
        return;
      }
      router.push("/admin/quotes");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <section className="mb-6 rounded-lg border bg-white p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Working the request</h2>

        <div className="mb-4">
          <label
            htmlFor="quote-status"
            className="mb-1 block text-sm font-medium text-gray-800"
          >
            Status
          </label>
          <select
            id="quote-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as QuoteStatus)}
            disabled={saving}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            {QUOTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            &ldquo;Contacted&rdquo; and &ldquo;Quoted&rdquo; record the date the
            first time you set them, and keep it if you change your mind later.
          </p>
        </div>

        <div className="mb-4">
          <label
            htmlFor="quote-notes"
            className="mb-1 block text-sm font-medium text-gray-800"
          >
            Internal notes
          </label>
          <textarea
            id="quote-notes"
            value={notes}
            maxLength={MAX_ADMIN_NOTES_LENGTH}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
            rows={6}
            placeholder="What you quoted, what you asked them, anything the next person needs to know."
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-gray-500">
            Not shown to the customer.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && !dirty && (
            <span className="text-sm text-green-700">Saved.</span>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
      </section>

      {/* ---- destructive ---- */}
      <section className="rounded-lg border border-red-200 bg-red-50/50 p-6">
        <h2 className="font-semibold text-gray-900">Delete this request</h2>
        <p className="mt-1 text-sm text-gray-700">
          Permanent, and takes the customer&rsquo;s submitted design with it.
          For test and spam rows — a real enquiry that came to nothing belongs
          in <strong>Declined</strong>, where it stays on the record.
        </p>

        {!showDelete ? (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="mt-3 rounded-md border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            Delete…
          </button>
        ) : (
          <div className="mt-3">
            <label
              htmlFor="confirm-delete"
              className="mb-1 block text-sm text-gray-800"
            >
              Type <span className="font-mono font-medium">{quoteNumber}</span>{" "}
              to confirm:
            </label>
            <input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full max-w-md rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm"
              autoComplete="off"
            />
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={remove}
                disabled={deleting || confirmText.trim() !== quoteNumber}
                className="rounded-md bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDelete(false);
                  setConfirmText("");
                }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
