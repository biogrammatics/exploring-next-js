import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { DeleteButton } from "@/app/components/admin/delete-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditStrainPage({ params }: PageProps) {
  const { id } = await params;

  const [strain, strainTypes, productStatuses] = await Promise.all([
    prisma.pichiaStrain.findUnique({
      where: { id },
      include: {
        strainType: true,
        productStatus: true,
        _count: {
          select: {
            strainOrderItems: true,
          },
        },
      },
    }),
    prisma.strainType.findMany({ orderBy: { name: "asc" } }),
    prisma.productStatus.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!strain) {
    notFound();
  }

  const hasOrders = strain._count.strainOrderItems > 0;
  const canDelete = !hasOrders;

  async function updateStrain(formData: FormData) {
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
      isPublic: formData.get("isPublic") === "on",
    };

    await prisma.pichiaStrain.update({
      where: { id },
      data,
    });

    redirect("/admin/strains");
  }

  async function deleteStrain() {
    "use server";

    // Double-check that strain can be deleted
    const strainWithCounts = await prisma.pichiaStrain.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            strainOrderItems: true,
          },
        },
      },
    });

    if (!strainWithCounts) {
      redirect("/admin/strains");
    }

    if (strainWithCounts._count.strainOrderItems > 0) {
      // Cannot delete - has related orders
      throw new Error("Cannot delete strain with existing orders");
    }

    // Delete the strain
    await prisma.pichiaStrain.delete({
      where: { id },
    });

    redirect("/admin/strains");
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Strain</h1>
      </div>

      <form action={updateStrain} className="bg-white border rounded-lg p-6 max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              name="name"
              defaultValue={strain.name}
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
              defaultValue={strain.description || ""}
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
                defaultValue={strain.strainTypeId || ""}
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
                defaultValue={strain.productStatusId}
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
                Genotype
              </label>
              <input
                type="text"
                name="genotype"
                defaultValue={strain.genotype || ""}
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
                defaultValue={strain.phenotype || ""}
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
                defaultValue={strain.salePrice ? (strain.salePrice / 100).toFixed(2) : ""}
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
                defaultValue={strain.availability || ""}
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
              defaultValue={strain.advantages || ""}
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
              defaultValue={strain.applications || ""}
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
                defaultValue={strain.cultureMedia || ""}
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
                defaultValue={strain.growthConditions || ""}
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
                defaultValue={strain.storageConditions || ""}
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
                defaultValue={strain.viabilityPeriod || ""}
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
              defaultValue={strain.shippingRequirements || ""}
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
              defaultValue={strain.citations || ""}
              rows={2}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <h3 className="text-lg font-medium text-gray-800 pt-4 border-t">
            Visibility
          </h3>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isPublic"
              name="isPublic"
              defaultChecked={strain.isPublic}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isPublic" className="text-sm text-gray-700">
              Show in public catalog
            </label>
          </div>
          <p className="text-xs text-gray-500 -mt-4">
            Uncheck to hide this strain from the public catalog. Users who have purchased this strain will still be able to access it.
          </p>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Save Changes
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

      {/* Delete Section */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mt-6">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Danger Zone</h2>
        {canDelete ? (
          <>
            <p className="text-sm text-red-700 mb-4">
              Deleting this strain is permanent and cannot be undone.
            </p>
            <DeleteButton
              action={deleteStrain}
              confirmMessage={`Are you sure you want to delete "${strain.name}"? This action cannot be undone.`}
              buttonText="Delete Strain"
            />
          </>
        ) : (
          <>
            <p className="text-sm text-red-700 mb-2">
              This strain cannot be deleted because it has associated records:
            </p>
            <ul className="text-sm text-red-700 list-disc list-inside mb-4">
              {hasOrders && (
                <li>{strain._count.strainOrderItems} order(s)</li>
              )}
            </ul>
            <p className="text-sm text-gray-600">
              Consider hiding this strain from the public catalog instead by unchecking &quot;Show in public catalog&quot; above.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
