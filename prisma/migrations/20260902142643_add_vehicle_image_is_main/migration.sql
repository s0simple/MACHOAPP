-- AlterTable
ALTER TABLE "vehicle_images" ADD COLUMN     "isMain" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: designate the first image (by sortOrder) as the main image for
-- vehicles that have images, so existing cards get a main image for free.
WITH first_images AS (
  SELECT DISTINCT ON ("vehicleId") id
  FROM "vehicle_images"
  ORDER BY "vehicleId", "sortOrder" ASC, "createdAt" ASC
)
UPDATE "vehicle_images"
SET "isMain" = true
WHERE id IN (SELECT id FROM first_images);