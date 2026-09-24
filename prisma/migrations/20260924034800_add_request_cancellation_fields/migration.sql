-- AlterTable
ALTER TABLE "transportation_requests" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3);