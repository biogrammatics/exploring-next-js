import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NewLotPage({ params }: PageProps) {
  const { id } = await params;

  const vector = await prisma.vector.findUnique({
    where: { id },
  });

  if (!vector) {
    notFound();
  }

  async function createLot(formData: FormData) {
    "use server";

    const lotNumber = formData.get("lotNumber") as string;
    const manufacturedAt = formData.get("manufacturedAt") as string;
    const expiresAt = formData.get("expiresAt") as string;
    const notes = formData.get("notes") as string;
    const setAsCurrent = formData.get("setAsCurrent") === "on";

    const lot = await prisma.vectorLot.create({
      data: {
        vectorId: id,
        lotNumber,
        manufacturedAt: manufacturedAt ? new Date(manufacturedAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes: notes || null,
      },
    });

    // If set as current shipping lot, update the vector
    if (setAsCurrent) {
      await prisma.vector.update({
        where: { id },
        data: { currentShippingLotId: lot.id },
      });
    }

    redirect(`/admin/vectors/${id}/lots`);
  }

  // Generate suggested lot number
  const currentYear = new Date().getFullYear();
  const existingLots = await prisma.vectorLot.count({
    where: { vectorId: id },
  });
  const suggestedLotNumber = `LOT-${currentYear}-${String(existingLots + 1).padStart(3, "0")}`;

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
          <h1 className="text-3xl font-bold">New Lot for {vector.name}</h1>
        </div>
      </div>

      <form action={createLot} className="bg-white border rounded-lg p-6 max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lot Number *
            </label>
            <input
              type="text"
              name="lotNumber"
              defaultValue={suggestedLotNumber}
              required
              className="w-full border rounded-lg px-3 py-2"
              placeholder="LOT-2024-001"
            />
            <p className="text-sm text-gray-500 mt-1">
              Unique identifier for this lot
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manufactured Date
              </label>
              <input
                type="date"
                name="manufacturedAt"
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
              rows={3}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Optional notes about this lot..."
            />
          </div>

          <div className="border-t pt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="setAsCurrent"
                defaultChecked
                className="rounded"
              />
              <span className="text-sm text-gray-700">
                Set as current shipping lot
              </span>
            </label>
            <p className="text-sm text-gray-500 mt-1 ml-6">
              This lot will be automatically assigned to new orders
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Create Lot
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
    </div>
  );
}
