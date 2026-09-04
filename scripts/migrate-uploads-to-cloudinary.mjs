/**
 * One-off migration: push legacy locally-stored vehicle images
 * (uploads/vehicle-images/*) to Cloudinary and update the corresponding
 * vehicle_images rows to point at the Cloudinary URLs.
 *
 * Usage:  node scripts/migrate-uploads-to-cloudinary.mjs
 *
 * Requires CLOUDINARY_URL and DATABASE_URL in .env.
 * Idempotent — rows already pointing at Cloudinary are skipped.
 * Local files are kept as a backup (nothing is deleted).
 */
import "dotenv/config";
import { readFile } from "fs/promises";
import path from "path";
import { Pool } from "pg";
import { v2 as cloudinary } from "cloudinary";

const LEGACY_URL_PREFIX = "/api/uploads/vehicle-images/";
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "uploads", "vehicle-images");
const CLOUDINARY_FOLDER = "kalumalu/vehicle-images";

function uploadBuffer(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: "image" },
      (error, result) =>
        error || !result
          ? reject(error ?? new Error("Cloudinary upload failed"))
          : resolve(result)
    );
    stream.end(buffer);
  });
}

async function main() {
  if (!process.env.CLOUDINARY_URL) {
    console.error("CLOUDINARY_URL is not set — add it to .env first.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  // Configure Cloudinary from the URL env var
  // (format: cloudinary://<api_key>:<api_secret>@<cloud_name>).
  const parsed = new URL(process.env.CLOUDINARY_URL);
  cloudinary.config({
    cloud_name: parsed.hostname,
    api_key: parsed.username,
    api_secret: parsed.password,
  });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows } = await pool.query(
      "SELECT id, url FROM vehicle_images WHERE url LIKE $1",
      [`${LEGACY_URL_PREFIX}%`]
    );

    if (rows.length === 0) {
      console.log("No legacy filesystem image rows found. Nothing to migrate.");
      return;
    }

    console.log(`Found ${rows.length} legacy image row(s) to migrate.\n`);

    let migrated = 0;
    let skipped = 0;

    for (const row of rows) {
      const filename = decodeURIComponent(row.url.slice(LEGACY_URL_PREFIX.length));
      const filePath = path.join(LOCAL_UPLOAD_DIR, filename);

      let buffer;
      try {
        buffer = await readFile(filePath);
      } catch {
        console.warn(`⚠ Skipped ${filename} — local file not found in uploads/vehicle-images/.`);
        skipped++;
        continue;
      }

      try {
        const publicId = `${CLOUDINARY_FOLDER}/${filename.replace(/\.[^.]+$/, "")}`;
        const result = await uploadBuffer(buffer, publicId);

        await pool.query(
          'UPDATE vehicle_images SET url = $1, "publicId" = $2 WHERE id = $3',
          [result.secure_url, result.public_id, row.id]
        );

        console.log(`✓ Migrated ${filename} → ${result.secure_url}`);
        migrated++;
      } catch (error) {
        console.error(`✗ Failed to migrate ${filename}:`, error?.message ?? error);
        skipped++;
      }
    }

    console.log(`\nDone. Migrated: ${migrated}, skipped/failed: ${skipped}.`);
    console.log("Local files were kept as backup in uploads/vehicle-images/.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});