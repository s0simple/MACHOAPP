-- AlterTable
ALTER TABLE "transportation_requests" ADD COLUMN     "deliveryDeadline" TIMESTAMP(3),
ADD COLUMN     "pickupAt" TIMESTAMP(3),
ADD COLUMN     "serviceType" TEXT NOT NULL DEFAULT 'transport_only',
ADD COLUMN     "specialInstructions" TEXT;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "hasRefrigeration" BOOLEAN NOT NULL DEFAULT false;
