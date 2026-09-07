/**
 * Shared business constants and lightweight derivation logic used by both
 * the New Request flow and the server-side APIs. Keeping these in one place
 * means the client preview and the server never disagree.
 */

/** Goods types offered in the New Request flow. */
export const GOODS_TYPES = [
  "General Goods",
  "Food Items",
  "Building Materials",
  "Electronics",
  "Furniture",
  "Agricultural Products",
  "Industrial Equipment",
  "Other",
] as const;

export const SERVICE_TYPES = {
  transport_only: "Transport only",
  loading_transport: "Loading + transport",
  loading_transport_unloading: "Loading + transport + unloading",
} as const;

export type ServiceType = keyof typeof SERVICE_TYPES;

export const SERVICE_TYPE_VALUES = Object.keys(SERVICE_TYPES) as ServiceType[];

/** Numeric input limits enforced on both client and server. */
export const LIMITS = {
  maxWeightKg: 5_000, // matches the largest mini-truck type (Mini Truck Large)
  maxQuantity: 1000,
  maxDimensionM: 15,
  maxAddressLength: 300,
  maxDescriptionLength: 1000,
  maxInstructionsLength: 1000,
  /** Ghana is UTC+0 year-round; "now" == local time, so no TZ math needed. */
  minLeadTimeHours: 1, // pickup must be at least 1 hour in the future
  maxAdvanceDays: 90, // cannot book further than 90 days ahead
} as const;

/**
 * Derive the smallest suitable mini-truck type from the goods weight.
 * Names match the seeded VehicleTypes ("Mini Truck Small", "Mini Truck
 * Medium", "Mini Truck Large" — all Abossey Okai Macho mini-trucks).
 * The result drives which PricingRule is used for the estimate; matching
 * still picks any vehicle whose actual capacity satisfies the load.
 */
export function deriveVehicleTypeName(weightKg: number): string {
  if (weightKg <= 1000) return "Mini Truck Small";
  if (weightKg <= 2000) return "Mini Truck Medium";
  return "Mini Truck Large";
}

/**
 * Size tier for the SMALL → MEDIUM → LARGE model, derived from the same
 * weight thresholds as `deriveVehicleTypeName`. Used for display labels.
 */
export function deriveVehicleSizeTier(weightKg: number): "SMALL" | "MEDIUM" | "LARGE" {
  if (weightKg <= 1000) return "SMALL";
  if (weightKg <= 2000) return "MEDIUM";
  return "LARGE";
}
