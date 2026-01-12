import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold mb-4">Welcome to Our Company</h1>
      <p className="text-xl text-gray-600 mb-8 text-center max-w-md">
        We provide high-quality products and services for your business needs.
      </p>
      <Link
        href="/products"
        className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg hover:bg-blue-700 transition-colors"
      >
        View Products
      </Link>
    </main>
  );
}
