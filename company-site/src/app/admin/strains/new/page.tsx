import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NewStrainPage() {
  const [strainTypes, productStatuses] = await Promise.all([
    prisma.strainType.findMany({ orderBy: { name: "asc" } }),
    prisma.productStatus.findMany({ orderBy: { name: "asc" } }),
  ]);

  async function createStrain(formData: FormData) {
    "use server";

    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string || null,
      genotype: formData.get("genotype") as string || null,
      phenotype: formData.get("phenotype") as string || null,
      advantages: formData.get("advantages") as string || null,
      applications: formData.get("applications") as string || null,
      salePrice: formData.get("salePrice") ? Math.round(parseFloat(formData.get("salePrice") as string) * 100) : null,
      availability: formData.get("availability") as string || null,
      shippingRequirements: formData.get("shippingRequirements") as string || null,
      storageConditions: formData.get("storageConditions") as string || null,
      viabilityPeriod: formData.get("viabilityPeriod") as string || null,
      cultureMedia: formData.get("cultureMedia") as string || null,
      growthConditions: formData.get("growthConditions") as string || null,
      citations: formData.get("citations") as string || null,
      strainTypeId: formData.get("strainTypeId") as string || null,
      productStatusId: formData.get("productStatusId") as string,
    };

    await prisma.pichiaStrain.create({ data });

    redirect("/admin/strains");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Add New Strain</h1>
        <Link href="/admin/strains" className="text-gray-600 hover:text-gray-800">
          Cancel
        </Link>
      </div>

      <form action={createStrain} className="bg-white border rounded-lg p-6 max-w-2xl">
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
                Strain Type
              </label>
              <select
                name="strainTypeId"
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Select type</option>
                {strainTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
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
                Genotype
              </label>
              <input
                type="text"
                name="genotype"
                className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                placeholder="e.g., his4, arg4"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phenotype
              </label>
              <input
                type="text"
                name="phenotype"
                className="w-full border rounded-lg px-3 py-2"
                placeholder="e.g., Mut+, His-"
              />
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
                Availability
              </label>
              <select
                name="availability"
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Select availability</option>
                <option value="In Stock">In Stock</option>
                <option value="Made to Order">Made to Order</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Advantages
            </label>
            <textarea
              name="advantages"
              rows={2}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Applications
            </label>
            <textarea
              name="applications"
              rows={2}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <h3 className="text-lg font-medium text-gray-800 pt-4 border-t">
            Culture & Storage Information
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Culture Media
              </label>
              <input
                type="text"
                name="cultureMedia"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Growth Conditions
              </label>
              <input
                type="text"
                name="growthConditions"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Storage Conditions
              </label>
              <input
                type="text"
                name="storageConditions"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Viability Period
              </label>
              <input
                type="text"
                name="viabilityPeriod"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shipping Requirements
            </label>
            <textarea
              name="shippingRequirements"
              rows={2}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Citations
            </label>
            <textarea
              name="citations"
              rows={2}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Create Strain
            </button>
            <Link
              href="/admin/strains"
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
