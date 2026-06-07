/**
 * Dev seed for the catalog (MongoDB) database.
 *
 * Idempotently upserts product documents from the shared mock catalog
 * (./products.json) into the `products` collection, keyed by `sku` so they
 * line up with the inventory service seed. Development-only helper.
 *
 * Usage (from this directory):
 *
 *   npm install
 *   npm run seed:catalog
 *
 * Connection/database are read from env with sensible local-dev defaults that
 * match infra/docker-compose.yml + the root .env:
 *
 *   CATALOG_DB_URI   (default: mongodb://catalog_user:catalog_password@localhost:27017/?authSource=admin)
 *   CATALOG_DB_NAME  (default: catalog_db)
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const __dirname = dirname(fileURLToPath(import.meta.url));

const URI =
  process.env.CATALOG_DB_URI ??
  'mongodb://catalog_user:catalog_password@localhost:27017/?authSource=admin';
const DB_NAME = process.env.CATALOG_DB_NAME ?? 'catalog_db';
const COLLECTION = 'products';

const products = JSON.parse(
  readFileSync(resolve(__dirname, 'products.json'), 'utf-8'),
);

const client = new MongoClient(URI);

try {
  await client.connect();
  const collection = client.db(DB_NAME).collection(COLLECTION);
  await collection.createIndex({ sku: 1 }, { unique: true });

  const now = new Date();
  const operations = products.map((product) => ({
    updateOne: {
      filter: { sku: product.sku },
      update: {
        $set: {
          sku: product.sku,
          name: product.name,
          slug: product.slug,
          description: product.description,
          category: product.category,
          brand: product.brand,
          price: product.price,
          currency: product.currency,
          tags: product.tags,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      upsert: true,
    },
  }));

  const result = await collection.bulkWrite(operations, { ordered: false });
  const upserted = result.upsertedCount;
  const modified = result.modifiedCount;
  console.log(
    `✅ Seeded ${products.length} catalog products into ${DB_NAME}.${COLLECTION} ` +
      `(inserted ${upserted}, updated ${modified}).`,
  );
} catch (error) {
  console.error('❌ Catalog seed failed:', error);
  process.exitCode = 1;
} finally {
  await client.close();
}
