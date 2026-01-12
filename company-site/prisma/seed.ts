import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const products = [
  {
    name: "Basic Plan",
    description: "Perfect for individuals and small projects",
    price: 999, // $9.99
    imageUrl: "https://placehold.co/400x300/e2e8f0/475569?text=Basic",
  },
  {
    name: "Pro Plan",
    description: "For growing teams with advanced needs",
    price: 2999, // $29.99
    imageUrl: "https://placehold.co/400x300/dbeafe/1e40af?text=Pro",
  },
  {
    name: "Enterprise Plan",
    description: "Full-featured solution for large organizations",
    price: 9999, // $99.99
    imageUrl: "https://placehold.co/400x300/fae8ff/86198f?text=Enterprise",
  },
];

async function main() {
  console.log("Seeding database...");

  // Seed products
  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.name.toLowerCase().replace(/\s+/g, "-") },
      update: product,
      create: {
        id: product.name.toLowerCase().replace(/\s+/g, "-"),
        ...product,
      },
    });
    console.log(`Created product: ${product.name}`);
  }

  // Create admin user
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      email: adminEmail,
      name: "Admin User",
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });
  console.log(`Created admin user: ${adminEmail}`);

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
