"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string; lotId: string }>;
}

export default function UploadLotFilePage({ params }: PageProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vectorId, setVectorId] = useState<string | null>(null);
  const [lotId, setLotId] = useState<string | null>(null);

  // Resolve params
  useState(() => {
    params.then(({ id, lotId }) => {
      setVectorId(id);
      setLotId(lotId);
    });
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const response = await fetch(
        `/api/admin/vectors/${vectorId}/lots/${lotId}/files`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload file");
      }

      router.push(`/admin/vectors/${vectorId}/lots/${lotId}/edit`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  if (!vectorId || !lotId) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href={`/admin/vectors/${vectorId}/lots/${lotId}/edit`}
            className="text-sm text-blue-600 hover:underline mb-2 inline-block"
          >
            ← Back to Lot
          </Link>
          <h1 className="text-3xl font-bold">Upload File</h1>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border rounded-lg p-6 max-w-xl"
      >
        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File Type *
            </label>
            <select
              name="fileType"
              required
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Select file type</option>
              <option value="SEQUENCING_DATA">Sequencing Data</option>
              <option value="QC_REPORT">QC Report</option>
              <option value="COA">Certificate of Analysis</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File *
            </label>
            <input
              type="file"
              name="file"
              required
              className="w-full border rounded-lg px-3 py-2"
            />
            <p className="text-sm text-gray-500 mt-1">
              Supported formats: .ab1, .pdf, .txt, .seq, .fasta, .zip
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={uploading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading..." : "Upload File"}
            </button>
            <Link
              href={`/admin/vectors/${vectorId}/lots/${lotId}/edit`}
              className="px-6 py-2 rounded-lg border hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
