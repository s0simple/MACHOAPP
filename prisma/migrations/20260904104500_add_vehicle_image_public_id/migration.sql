-- AlterTable
-- Stores the Cloudinary public id for each vehicle image so assets can be
-- managed (deleted) via the Cloudinary API. Nullable because legacy rows
-- that were stored on the local filesystem have no Cloudinary asset.
ALTER TABLE "vehicle_images" ADD COLUMN     "publicId" TEXT;