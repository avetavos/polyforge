/**
 * Dev seed for the inventory database.
 *
 * Idempotently upserts InventoryItem rows from the shared mock catalog
 * (scripts/seed/products.json at the repo root) so SKUs match the catalog
 * service seed. Run AFTER migrations with:
 *
 *   npx prisma db seed            # from services/inventory-service
 *
 * This is a development-only helper; it is not bundled into the container image.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedProduct {
  sku: string;
  available: number;
  reserved: number;
}

const PRODUCTS_FILE = resolve(__dirname, '../../../scripts/seed/products.json');

async function main(): Promise<void> {
  const products: SeedProduct[] = JSON.parse(
    readFileSync(PRODUCTS_FILE, 'utf-8'),
  );

  for (const product of products) {
    await prisma.inventoryItem.upsert({
      where: { sku: product.sku },
      update: {
        available: product.available,
        reserved: product.reserved,
        deletedAt: null,
      },
      create: {
        sku: product.sku,
        available: product.available,
        reserved: product.reserved,
      },
    });
  }

  console.log(`✅ Seeded ${products.length} inventory items.`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    // Runs after $disconnect so the client always closes cleanly, even on failure.
    console.error('❌ Inventory seed failed:', error);
    process.exit(1);
  });
