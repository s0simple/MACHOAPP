import { prisma } from "./prisma";

interface PricingInput {
  distance: number; // km
  weight: number; // kg
  vehicleTypeId: string;
  length?: number;
  width?: number;
  height?: number;
  isFragile?: boolean;
  needsRefrigeration?: boolean;
}

interface PricingBreakdown {
  baseRate: number;
  distanceCharge: number;
  weightCharge: number;
  volumeCharge: number;
  fragileSurcharge: number;
  refrigerationSurcharge: number;
  subtotal: number;
  surgeMultiplier: number;
  total: number;
  currency: string;
}

export async function calculatePrice(input: PricingInput): Promise<PricingBreakdown> {
  const rule = await prisma.pricingRule.findFirst({
    where: {
      vehicleTypeId: input.vehicleTypeId,
      isActive: true,
    },
  });

  if (!rule) {
    throw new Error("No active pricing rule found for this vehicle type");
  }

  const baseRate = rule.baseRate;
  const distanceCharge = input.distance * rule.perKmRate;
  const weightCharge = input.weight * rule.perKgRate;

  // Volume charge (if dimensions provided)
  let volumeCharge = 0;
  if (input.length && input.width && input.height) {
    const volume = input.length * input.width * input.height;
    volumeCharge = volume * 50; // GHS per cubic meter
  }

  // Surcharges
  const fragileSurcharge = input.isFragile ? baseRate * 0.15 : 0;
  const refrigerationSurcharge = input.needsRefrigeration ? baseRate * 0.25 : 0;

  const subtotal = baseRate + distanceCharge + weightCharge + volumeCharge + fragileSurcharge + refrigerationSurcharge;
  const total = Math.max(subtotal * rule.surgeMultiplier, rule.minPrice);

  return {
    baseRate,
    distanceCharge: Math.round(distanceCharge * 100) / 100,
    weightCharge: Math.round(weightCharge * 100) / 100,
    volumeCharge: Math.round(volumeCharge * 100) / 100,
    fragileSurcharge: Math.round(fragileSurcharge * 100) / 100,
    refrigerationSurcharge: Math.round(refrigerationSurcharge * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    surgeMultiplier: rule.surgeMultiplier,
    total: Math.round(total * 100) / 100,
    currency: "GHS",
  };
}

// Haversine formula for distance between two coordinates
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}