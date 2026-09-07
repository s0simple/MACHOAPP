/**
 * Shared types for the New Transportation Request flow. Keeping these in one
 * file lets the LocationSearch/RequestMap components and the main page stay
 * in sync and avoids prop-drilling mistakes.
 */

/** A place the user picked from the address search results. */
export interface SelectedPlace {
  label: string;
  lat: number;
  lng: number;
}

/** Non-empty numeric form fields, kept as strings while the user types. */
export interface GoodsFormState {
  goodsType: string;
  quantity: string;
  weight: string;
  description: string;
  lengthM: string;
  widthM: string;
  heightM: string;
  isFragile: boolean;
  needsRefrigeration: boolean;
  specialInstructions: string;
}

/** Estimated-distance / price result returned by the estimate API. */
export interface EstimateResult {
  distanceKm: number;
  durationMin: number;
  distanceFallback: boolean;
  vehicleTypeName: string;
  requirements: {
    minCapacityKg: number;
    needsRefrigeration: boolean;
    isFragile: boolean;
    dimensions: { length: number; width: number; height: number } | null;
  };
  price: {
    total: number;
    baseRate: number;
    distanceCharge: number;
    weightCharge: number;
    volumeCharge: number;
    fragileSurcharge: number;
    refrigerationSurcharge: number;
    subtotal: number;
    surgeMultiplier: number;
    minPrice: number;
    currency: string;
  };
}