-- AlterTable
ALTER TABLE "transportation_requests" ADD COLUMN     "preferredVehicleId" TEXT;

-- AddForeignKey
ALTER TABLE "transportation_requests" ADD CONSTRAINT "transportation_requests_preferredVehicleId_fkey" FOREIGN KEY ("preferredVehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
