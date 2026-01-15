import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NewVectorPage() {
  const [promoters, selectionMarkers, vectorTypes, hostOrganisms, productStatuses] =
    await Promise.all([
      prisma.promoter.findMany({ orderBy: { name: "asc" } }),
      prisma.selectionMarker.findMany({ orderBy: { name: "asc" } }),
      prisma.vectorType.findMany({ orderBy: { name: "asc" } }),
      prisma.hostOrganism.findMany({ orderBy: { commonName: "asc" } }),
      prisma.productStatus.findMany({ orderBy: { name: "asc" } }),
    ]);

  async function createVector(formData: FormData) {
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

    await prisma.vector.create({ data });

    redirect("/admin/vectors");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Add New Vector</h1>
        <Link href="/admin/vectors" className="text-gray-600 hover:text-gray-800">
          Cancel
        </Link>
      </div>

      <form action={createVector} className="bg-white border rounded-lg p-6 max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              name="name"
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
                required
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Select status</option>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vector Size (bp)
            </label>
            <input
              type="number"
              name="vectorSize"
              min="0"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Features (comma-separated)
            </label>
            <textarea
              name="features"
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
                className="rounded"
              />
              <span className="text-sm text-gray-700">Has LoxP Sites</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="availableForSale"
                defaultChecked
                className="rounded"
              />
              <span className="text-sm text-gray-700">Available for Sale</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="availableForSubscription"
                defaultChecked
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
              Create Vector
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
    </div>
  );
}
