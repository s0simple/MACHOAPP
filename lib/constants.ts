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

/**
 * Reasons a passenger can choose when cancelling a still-pending request.
 * Shared between the cancel API (validation) and the cancel modal (options)
 * so the two can never drift. The final "Other" option reveals an optional
 * free-text note.
 */
export const CANCELLATION_REASONS = [
  "Changed my plans",
  "Driver is taking too long",
  "Found another option",
  "Price is too high",
  "Ordered by mistake",
  "Duplicate request",
  "Other",
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

/**
 * Request statuses in which a passenger is still allowed to cancel. A driver
 * having accepted a request creates a Trip, so cancellation is locked out
 * from that point on (the customer can no longer withdraw the order).
 */
export const CANCELLABLE_REQUEST_STATUSES = ["pending"] as const;

/** Max length for the optional free-text cancellation note. */
export const MAX_CANCELLATION_NOTE_LENGTH = 500;

/**
 * Trip statuses during which the passenger and driver are allowed to see each
 * other's phone number so they can call each other off-app. Numbers are hidden
 * again once the trip is completed or cancelled.
 */
export const ACTIVE_TRIP_STATUSES = ["assigned", "in_transit"] as const;

/** Numeric input limits enforced on both client and server. */
export const LIMITS = {
  maxWeightKg: 5_000, // matches the largest mini-truck type (Mini Truck Large)
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
 * Service area: Greater Accra Region (approximate bounding box). The app
 * currently operates only within Greater Accra, so geocoding results, the
 * map view, and server-side coordinate validation are all constrained to
 * this box. A rectangle is intentionally used instead of the exact region
 * polygon — simple to share between client and server, and edge slivers of
 * neighbouring regions are acceptable for a service area.
 */
export const GREATER_ACCRA_BOUNDS = {
  minLat: 5.44,
  maxLat: 5.98, // excludes Eastern Region towns (Nsawam/Suhum) just north
  minLng: -0.55,
  maxLng: 0.7,
} as const;

/** True when a coordinate falls inside the Greater Accra service area. */
export function isWithinGreaterAccra(lat: number, lng: number): boolean {
  return (
    lat >= GREATER_ACCRA_BOUNDS.minLat &&
    lat <= GREATER_ACCRA_BOUNDS.maxLat &&
    lng >= GREATER_ACCRA_BOUNDS.minLng &&
    lng <= GREATER_ACCRA_BOUNDS.maxLng
  );
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
