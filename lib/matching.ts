import { prisma } from "./prisma";
import { calculateDistance } from "./pricing";

interface MatchInput {
  pickupLat: number;
  pickupLng: number;
  destLat: number;
  destLng: number;
  weight: number;
  preferredVehicleType?: string;
  isFragile?: boolean;
  needsRefrigeration?: boolean;
}

interface MatchedDriver {
  driverId: string;
  driverName: string;
  driverRating: number;
  driverPhone: string;
  vehicleId: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleRegistration: string;
  vehicleTypeName: string;
  vehicleCapacity: number;
  estimatedPrice: number;
  vehicleImageUrl: string | null;
}

// Simple type-based matching: a vehicle matches when the driver is available
// and approved, the vehicle is available and verified, it can carry the load,
// and (when the passenger expressed a preference) its type matches. Results
// are ordered by driver rating.
export async function findMatchingTrucks(input: MatchInput): Promise<MatchedDriver[]> {
  // Get all available drivers with their vehicles
  const drivers = await prisma.driver.findMany({
    where: {
      isAvailable: true,
      isApproved: true,
    },
    include: {
      user: {
        select: { name: true },
      },
      vehicles: {
        where: {
          status: "available",
          isVerified: true,
        },
        include: {
          vehicleType: true,
          images: {
            where: { isMain: true },
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  });

  const matches: MatchedDriver[] = [];

  for (const driver of drivers) {
    for (const vehicle of driver.vehicles) {
      // Safety floor: the vehicle must be able to carry the load.
      if (vehicle.capacity < input.weight) continue;

      // Match on vehicle type (only enforced when a preference was given).
      if (input.preferredVehicleType && vehicle.vehicleType.name !== input.preferredVehicleType) {
        continue;
      }

      // Trip distance (needed for pricing).
      const tripDistance = calculateDistance(
        input.pickupLat,
        input.pickupLng,
        input.destLat,
        input.destLng
      );

      // Get pricing
      const pricingRule = await prisma.pricingRule.findFirst({
        where: {
          vehicleTypeId: vehicle.typeId,
          isActive: true,
        },
      });

      let estimatedPrice = 0;
      if (pricingRule) {
        const baseRate = pricingRule.baseRate;
        const distanceCharge = tripDistance * pricingRule.perKmRate;
        const weightCharge = input.weight * pricingRule.perKgRate;
        const fragileSurcharge = input.isFragile ? baseRate * 0.15 : 0;
        const refrigerationSurcharge = input.needsRefrigeration ? baseRate * 0.25 : 0;
        estimatedPrice = Math.max(
          (baseRate + distanceCharge + weightCharge + fragileSurcharge + refrigerationSurcharge) * pricingRule.surgeMultiplier,
          pricingRule.minPrice
        );
      }

      const mainImage = vehicle.images[0] ?? null;

      matches.push({
        driverId: driver.id,
        driverName: driver.user.name,
        driverRating: driver.rating,
        driverPhone: driver.phone || "",
        vehicleId: vehicle.id,
        vehicleMake: vehicle.make,
        vehicleModel: vehicle.model,
        vehicleRegistration: vehicle.registrationNumber,
        vehicleTypeName: vehicle.vehicleType.name,
        vehicleCapacity: vehicle.capacity,
        estimatedPrice: Math.round(estimatedPrice * 100) / 100,
        vehicleImageUrl: mainImage?.url ?? null,
      });
    }
  }

  // Highest-rated drivers first.
  return matches.sort((a, b) => b.driverRating - a.driverRating);
}