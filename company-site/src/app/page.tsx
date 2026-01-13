import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-65px)] flex flex-col items-center justify-center px-4">
      <div className="glass-panel p-12 text-center max-w-xl">
        <h1 className="text-4xl font-bold mb-4 text-gray-800">Welcome to Our Company</h1>
        <p className="text-xl text-gray-600 mb-8">
          We provide high-quality products and services for your business needs.
        </p>
        <Link
          href="/products"
          className="inline-block glass-button text-white px-8 py-3 rounded-lg text-lg"
        >
          View Products
        </Link>
      </div>
    </main>
  );
}
