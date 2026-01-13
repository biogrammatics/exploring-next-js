import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { AddToCartButton } from "./add-to-cart-button";
import Image from "next/image";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id, active: true },
  });

  if (!product) {
    notFound();
  }

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="glass-panel p-6 md:p-8">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Product Image */}
          <div>
            {product.imageUrl ? (
              <div className="relative aspect-square rounded-xl overflow-hidden bg-white/20">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            ) : (
              <div className="aspect-square rounded-xl bg-white/20 flex items-center justify-center">
                <span className="text-gray-400">No image</span>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            <h1 className="text-3xl font-bold mb-4 text-gray-800">{product.name}</h1>

            <p className="text-3xl font-bold text-blue-600 mb-6">
              {formatPrice(product.price)}
            </p>

            {product.description && (
              <div className="prose prose-gray mb-8">
                <p className="text-gray-600 whitespace-pre-wrap">{product.description}</p>
              </div>
            )}

            <AddToCartButton
              product={{
                id: product.id,
                name: product.name,
                price: product.price,
                imageUrl: product.imageUrl,
              }}
            />

            <div className="mt-8 pt-8 border-t border-white/30">
              <h2 className="font-semibold mb-2 text-gray-800">Product Details</h2>
              <dl className="text-sm text-gray-600 space-y-1">
                <div>
                  <dt className="inline font-medium">SKU: </dt>
                  <dd className="inline">{product.id}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
