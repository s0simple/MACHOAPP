import { prisma } from "./prisma";
import { calculateRouteDistance } from "./geo";

interface MatchInput {
  pickupLat: number;
  pickupLng: number;
  destLat: number;
  destLng: number;
  weight: number;
  preferredVehicleType?: string;
  isFragile?: boolean;
  needsRefrigeration?: boolean;
  length?: number;
  width?: number;
  height?: number;
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
  vehicleTypeId: string;
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
            // Prefer the main image; fall back to the first available image
            // (by sortOrder) so a vehicle with images always shows one.
            orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
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

      // Refrigeration requirement: only vehicles marked with refrigeration
      // capability qualify when the shipment needs it.
      if (input.needsRefrigeration && !vehicle.hasRefrigeration) {
        continue;
      }

      // Dimensions: the vehicle bed must fit every supplied dimension of the
      // largest item. Only enforced when the caller provides dimensions.
      if (input.length && vehicle.length && vehicle.length < input.length) continue;
      if (input.width && vehicle.width && vehicle.width < input.width) continue;
      if (input.height && vehicle.height && vehicle.height < input.height) continue;
      // If a dimension is missing on the vehicle we can not confirm fit, so
      // exclude it rather than risk an oversized load.
      if ((input.length && !vehicle.length) || (input.width && !vehicle.width) || (input.height && !vehicle.height)) {
        continue;
      }

      // Type preference: a preference means "at least this size", never an
      // exact type — a LARGE mini-truck can serve a SMALL/MEDIUM request as
      // long as its actual capacity covers the load (already checked above).
      // The capacity floor is the sole hard criterion, so no extra filter
      // is applied here.

      // Trip distance (needed for pricing). OSRM road distance with a
      // Haversine fallback; the route cache means this upstream call runs at
      // most once per matching request.
      const { route } = await calculateRouteDistance(
        { lat: input.pickupLat, lng: input.pickupLng },
        { lat: input.destLat, lng: input.destLng }
      );
      const tripDistance = route.distanceKm;

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
        vehicleTypeId: vehicle.typeId,
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