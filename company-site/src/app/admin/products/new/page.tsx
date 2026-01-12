import Link from "next/link";
import { ProductForm } from "@/app/components/admin/product-form";

export default function NewProductPage() {
  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/products" className="text-blue-600 hover:underline">
          &larr; Back to Products
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">New Product</h1>

      <ProductForm />
    </div>
  );
}
