import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { VectorFileType } from "@/generated/prisma/client";
import { DeleteButton, DeleteLinkButton } from "@/app/components/admin/delete-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(type: VectorFileType) {
  switch (type) {
    case "SNAPGENE":
      return "SnapGene";
    case "GENBANK":
      return "GenBank";
    case "FASTA":
      return "FASTA";
    case "PRODUCT_SHEET":
      return "Product Sheet";
    case "IMAGE":
      return "Image";
    case "OTHER":
      return "Other";
    default:
      return type;
  }
}

export default async function EditVectorPage({ params }: PageProps) {
  const { id } = await params;

  const [vector, promoters, selectionMarkers, vectorTypes, hostOrganisms, productStatuses] =
    await Promise.all([
      prisma.vector.findUnique({
        where: { id },
        include: {
          promoter: true,
          selectionMarker: true,
          vectorType: true,
          hostOrganism: true,
          productStatus: true,
          files: {
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: {
              vectorOrderItems: true,
              subscriptionVectors: true,
              customProjects: true,
            },
          },
        },
      }),
      prisma.promoter.findMany({ orderBy: { name: "asc" } }),
      prisma.selectionMarker.findMany({ orderBy: { name: "asc" } }),
      prisma.vectorType.findMany({ orderBy: { name: "asc" } }),
      prisma.hostOrganism.findMany({ orderBy: { commonName: "asc" } }),
      prisma.productStatus.findMany({ orderBy: { name: "asc" } }),
    ]);

  if (!vector) {
    notFound();
  }

  const hasOrders = vector._count.vectorOrderItems > 0;
  const hasSubscriptions = vector._count.subscriptionVectors > 0;
  const hasProjects = vector._count.customProjects > 0;
  const canDelete = !hasOrders && !hasSubscriptions && !hasProjects;

  async function updateVector(formData: FormData) {
    "use server";

    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string || null,
      category: formData.get("category") as "HETEROLOGOUS_PROTEIN_EXPRESSION" | "GENOME_ENGINEERING" | null,
      salePrice: formData.get("salePrice") ? Math.round(parseFloat(formData.get("salePrice") as string) * 100) : null,
      subscriptionPrice: formData.get("subscriptionPrice") ? Math.round(parseFloat(formData.get("subscriptionPrice") as string) * 100) : null,
      vectorSize: formData.get("vectorSize") ? parseInt(formData.get("vectorSize") as string) : null,
      features: formData.get("features") as string || null,
      hasLoxSites: formData.get("hasLoxSites") === "on",
      availableForSale: formData.get("availableForSale") === "on",
      availableForSubscription: formData.get("availableForSubscription") === "on",
      promoterId: formData.get("promoterId") as string || null,
      selectionMarkerId: formData.get("selectionMarkerId") as string || null,
      vectorTypeId: formData.get("vectorTypeId") as string || null,
      hostOrganismId: formData.get("hostOrganismId") as string || null,
      productStatusId: formData.get("productStatusId") as string,
    };

    await prisma.vector.update({
      where: { id },
      data,
    });

    redirect("/admin/vectors");
  }

  async function deleteVector() {
    "use server";

    // Double-check that vector can be deleted
    const vectorWithCounts = await prisma.vector.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            vectorOrderItems: true,
            subscriptionVectors: true,
            customProjects: true,
          },
        },
      },
    });

    if (!vectorWithCounts) {
      redirect("/admin/vectors");
    }

    const hasOrders = vectorWithCounts._count.vectorOrderItems > 0;
    const hasSubscriptions = vectorWithCounts._count.subscriptionVectors > 0;
    const hasProjects = vectorWithCounts._count.customProjects > 0;

    if (hasOrders || hasSubscriptions || hasProjects) {
      // Cannot delete - has related records
      throw new Error("Cannot delete vector with existing orders, subscriptions, or projects");
    }

    // Delete the vector (files and lots will cascade delete)
    await prisma.vector.delete({
      where: { id },
    });

    redirect("/admin/vectors");
  }

  async function deleteFile(formData: FormData) {
    "use server";

    const fileId = formData.get("fileId") as string;
    await prisma.vectorFile.delete({
      where: { id: fileId },
    });

    redirect(`/admin/vectors/${id}/edit`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Edit Vector</h1>
        <div className="flex items-center gap-4">
          <Link
            href={`/admin/vectors/${id}/lots`}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
          >
            Manage Lots
          </Link>
          <Link href="/admin/vectors" className="text-gray-600 hover:text-gray-800">
            Cancel
          </Link>
        </div>
      </div>

      <form action={updateVector} className="bg-white border rounded-lg p-6 max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              name="name"
              defaultValue={vector.name}
              required
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              defaultValue={vector.description || ""}
              rows={3}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                name="category"
                defaultValue={vector.category || ""}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Select category</option>
                <option value="HETEROLOGOUS_PROTEIN_EXPRESSION">Protein Expression</option>
                <option value="GENOME_ENGINEERING">Genome Engineering</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                name="productStatusId"
                defaultValue={vector.productStatusId}
                required
                className="w-full border rounded-lg px-3 py-2"
              >
                {productStatuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sale Price ($)
              </label>
              <input
                type="number"
                name="salePrice"
                defaultValue={vector.salePrice ? (vector.salePrice / 100).toFixed(2) : ""}
                step="0.01"
                min="0"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subscription Price ($)
              </label>
              <input
                type="number"
                name="subscriptionPrice"
                defaultValue={vector.subscriptionPrice ? (vector.subscriptionPrice / 100).toFixed(2) : ""}
                step="0.01"
                min="0"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Promoter
              </label>
              <select
                name="promoterId"
                defaultValue={vector.promoterId || ""}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Select promoter</option>
                {promoters.map((promoter) => (
                  <option key={promoter.id} value={promoter.id}>
                    {promoter.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Selection Marker
              </label>
              <select
                name="selectionMarkerId"
                defaultValue={vector.selectionMarkerId || ""}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Select marker</option>
                {selectionMarkers.map((marker) => (
                  <option key={marker.id} value={marker.id}>
                    {marker.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vector Type
              </label>
              <select
                name="vectorTypeId"
                defaultValue={vector.vectorTypeId || ""}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Select type</option>
                {vectorTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Host Organism
              </label>
              <select
                name="hostOrganismId"
                defaultValue={vector.hostOrganismId || ""}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Select organism</option>
                {hostOrganisms.map((organism) => (
                  <option key={organism.id} value={organism.id}>
                    {organism.commonName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vector Size (bp)
              </label>
              <input
                type="number"
                name="vectorSize"
                defaultValue={vector.vectorSize || ""}
                min="0"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Features (comma-separated)
            </label>
            <textarea
              name="features"
              defaultValue={vector.features || ""}
              rows={2}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Feature 1, Feature 2, Feature 3"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="hasLoxSites"
                defaultChecked={vector.hasLoxSites}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Has LoxP Sites</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="availableForSale"
                defaultChecked={vector.availableForSale}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Available for Sale</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="availableForSubscription"
                defaultChecked={vector.availableForSubscription}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Available for Subscription</span>
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
              href="/admin/vectors"
              className="px-6 py-2 rounded-lg border hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>

      {/* Files Section */}
      <div className="bg-white border rounded-lg p-6 max-w-2xl mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Vector Files</h2>
          <Link
            href={`/admin/vectors/${id}/files/new`}
            className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-blue-700"
          >
            Upload File
          </Link>
        </div>

        {vector.files.length === 0 ? (
          <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
            <p>No files uploaded yet.</p>
            <p className="text-sm mt-1">
              Upload SnapGene maps, GenBank files, or product documentation.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {vector.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {file.fileName}
                    {file.isPrimary && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                        Primary
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {getFileTypeLabel(file.fileType)} •{" "}
                    {formatFileSize(file.fileSize)}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
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

      {/* Delete Section */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mt-6">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Danger Zone</h2>
        {canDelete ? (
          <>
            <p className="text-sm text-red-700 mb-4">
              Deleting this vector will also delete all associated files and lots.
              This action cannot be undone.
            </p>
            <DeleteButton
              action={deleteVector}
              confirmMessage={`Are you sure you want to delete "${vector.name}"? This will also delete all associated files and lots.`}
              buttonText="Delete Vector"
            />
          </>
        ) : (
          <>
            <p className="text-sm text-red-700 mb-2">
              This vector cannot be deleted because it has associated records:
            </p>
            <ul className="text-sm text-red-700 list-disc list-inside mb-4">
              {hasOrders && (
                <li>{vector._count.vectorOrderItems} order(s)</li>
              )}
              {hasSubscriptions && (
                <li>{vector._count.subscriptionVectors} subscription(s)</li>
              )}
              {hasProjects && (
                <li>{vector._count.customProjects} project(s)</li>
              )}
            </ul>
            <p className="text-sm text-gray-600">
              To delete this vector, first remove or reassign these related records.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
