import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { LotFileType } from "@/generated/prisma/client";
import { DeleteButton, DeleteLinkButton } from "@/app/components/admin/delete-button";

interface PageProps {
  params: Promise<{ id: string; lotId: string }>;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(type: LotFileType) {
  switch (type) {
    case "SEQUENCING_DATA":
      return "Sequencing Data";
    case "QC_REPORT":
      return "QC Report";
    case "COA":
      return "Certificate of Analysis";
    case "OTHER":
      return "Other";
    default:
      return type;
  }
}

export default async function EditLotPage({ params }: PageProps) {
  const { id, lotId } = await params;

  const [vector, lot] = await Promise.all([
    prisma.vector.findUnique({
      where: { id },
    }),
    prisma.vectorLot.findUnique({
      where: { id: lotId },
      include: {
        files: {
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ]);

  if (!vector || !lot) {
    notFound();
  }

  async function updateLot(formData: FormData) {
    "use server";

    const lotNumber = formData.get("lotNumber") as string;
    const manufacturedAt = formData.get("manufacturedAt") as string;
    const expiresAt = formData.get("expiresAt") as string;
    const notes = formData.get("notes") as string;
    const setAsCurrent = formData.get("setAsCurrent") === "on";

    await prisma.vectorLot.update({
      where: { id: lotId },
      data: {
        lotNumber,
        manufacturedAt: manufacturedAt ? new Date(manufacturedAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes: notes || null,
      },
    });

    // Update current shipping lot if checkbox changed
    if (setAsCurrent) {
      await prisma.vector.update({
        where: { id },
        data: { currentShippingLotId: lotId },
      });
    } else {
      // If unchecked and this was the current lot, clear it
      const currentVector = await prisma.vector.findUnique({
        where: { id },
        select: { currentShippingLotId: true },
      });
      if (currentVector?.currentShippingLotId === lotId) {
        await prisma.vector.update({
          where: { id },
          data: { currentShippingLotId: null },
        });
      }
    }

    redirect(`/admin/vectors/${id}/lots`);
  }

  async function deleteLot() {
    "use server";

    // Clear current shipping lot reference if this is the current lot
    const currentVector = await prisma.vector.findUnique({
      where: { id },
      select: { currentShippingLotId: true },
    });
    if (currentVector?.currentShippingLotId === lotId) {
      await prisma.vector.update({
        where: { id },
        data: { currentShippingLotId: null },
      });
    }

    await prisma.vectorLot.delete({
      where: { id: lotId },
    });

    redirect(`/admin/vectors/${id}/lots`);
  }

  async function deleteFile(formData: FormData) {
    "use server";

    const fileId = formData.get("fileId") as string;
    await prisma.vectorLotFile.delete({
      where: { id: fileId },
    });

    redirect(`/admin/vectors/${id}/lots/${lotId}/edit`);
  }

  const isCurrentLot = vector.currentShippingLotId === lotId;

  // Format dates for input fields
  const manufacturedDate = lot.manufacturedAt
    ? lot.manufacturedAt.toISOString().split("T")[0]
    : "";
  const expiresDate = lot.expiresAt
    ? lot.expiresAt.toISOString().split("T")[0]
    : "";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href={`/admin/vectors/${id}/lots`}
            className="text-sm text-blue-600 hover:underline mb-2 inline-block"
          >
            ← Back to Lots
          </Link>
          <h1 className="text-3xl font-bold">Edit Lot {lot.lotNumber}</h1>
          <p className="text-gray-600">Vector: {vector.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lot Details Form */}
        <form action={updateLot} className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Lot Details</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lot Number *
              </label>
              <input
                type="text"
                name="lotNumber"
                defaultValue={lot.lotNumber}
                required
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manufactured Date
                </label>
                <input
                  type="date"
                  name="manufacturedAt"
                  defaultValue={manufacturedDate}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration Date
                </label>
                <input
                  type="date"
                  name="expiresAt"
                  defaultValue={expiresDate}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                defaultValue={lot.notes || ""}
                rows={3}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="border-t pt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="setAsCurrent"
                  defaultChecked={isCurrentLot}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">
                  Current shipping lot
                </span>
              </label>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
              <Link
                href={`/admin/vectors/${id}/lots`}
                className="px-6 py-2 rounded-lg border hover:bg-gray-50"
              >
                Cancel
              </Link>
            </div>
          </div>
        </form>

        {/* Files Section */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">QC Files</h2>
            <Link
              href={`/admin/vectors/${id}/lots/${lotId}/files/new`}
              className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-blue-700"
            >
              Upload File
            </Link>
          </div>

          {lot.files.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
              <p>No files uploaded yet.</p>
              <p className="text-sm mt-1">
                Upload sequencing data, QC reports, or certificates.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {lot.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{file.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {getFileTypeLabel(file.fileType)} •{" "}
                      {formatFileSize(file.fileSize)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <a
                      href={`/api/admin/files/${file.id}/download`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Download
                    </a>
                    <DeleteLinkButton
                      action={deleteFile}
                      confirmMessage="Delete this file?"
                      hiddenInputs={{ fileId: file.id }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Lot Section */}
      <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Danger Zone</h2>
        <p className="text-sm text-red-700 mb-4">
          Deleting this lot will also delete all associated files. This action
          cannot be undone.
        </p>
        <DeleteButton
          action={deleteLot}
          confirmMessage={`Are you sure you want to delete lot ${lot.lotNumber}? This will also delete all associated files.`}
          buttonText="Delete Lot"
        />
      </div>
    </div>
  );
}
