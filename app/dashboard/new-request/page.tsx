"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LocationSearch from "@/components/request/LocationSearch";
import RequestMap from "@/components/request/RequestMap";
import type { SelectedPlace, EstimateResult } from "@/lib/request-form-types";
import { GOODS_TYPES, LIMITS, SERVICE_TYPES, SERVICE_TYPE_VALUES, deriveVehicleTypeName, type ServiceType } from "@/lib/constants";

const STEPS = [
  { num: 1, label: "Locations" },
  { num: 2, label: "Goods Information" },
  { num: 3, label: "Transport Requirements" },
  { num: 4, label: "Choose Truck & Price" },
  { num: 5, label: "Review & Submit" },
] as const;

interface MatchedTruck {
  driverId: string;
  driverName: string;
  driverRating: number;
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

function formatMoney(value: number | null | undefined): string {
  return `GHS ${Number(value ?? 0).toFixed(2)}`;
}

function formatKm(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${Math.round(Number(value)).toLocaleString()} km`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not set";
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inOneHour(): Date {
  return new Date(Date.now() + LIMITS.minLeadTimeHours * 60 * 60 * 1000);
}

function tomorrowAtNine(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toDateTimeLocal(d);
}

interface GoodsFields {
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

type Errors = Record<string, string>;

export default function NewRequestPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [submitted, setSubmitted] = useState(false);

  const [pickup, setPickup] = useState<SelectedPlace | null>(null);
  const [dest, setDest] = useState<SelectedPlace | null>(null);

  const [goods, setGoods] = useState<GoodsFields>({
    goodsType: "",
    quantity: "1",
    weight: "",
    description: "",
    lengthM: "",
    widthM: "",
    heightM: "",
    isFragile: false,
    needsRefrigeration: false,
    specialInstructions: "",
  });

  const [serviceType, setServiceType] = useState<ServiceType>("transport_only");
  const [pickupAt, setPickupAt] = useState<string>(tomorrowAtNine());
  const [deliveryDeadline, setDeliveryDeadline] = useState<string>("");

  const [matches, setMatches] = useState<MatchedTruck[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [selectedTruck, setSelectedTruck] = useState<MatchedTruck | null>(null);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [errors, setErrors] = useState<Errors>({});
  const topRef = useRef<HTMLDivElement>(null);

  const weightNum = parseFloat(goods.weight);
  const qtyNum = parseInt(goods.quantity, 10);
  const dims = useMemo(() => {
    const toVal = (s: string) => {
      if (!s.trim()) return undefined;
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : undefined;
    };
    const d = toVal(goods.lengthM);
    const w = toVal(goods.widthM);
    const h = toVal(goods.heightM);
    if (d === undefined && w === undefined && h === undefined) return null;
    return {
      lengthM: d ?? 0,
      widthM: w ?? 0,
      heightM: h ?? 0,
      hasAll: d !== undefined && w !== undefined && h !== undefined,
    };
  }, [goods.lengthM, goods.widthM, goods.heightM]);

  const canEstimate =
    Boolean(pickup) &&
    Boolean(dest) &&
    goods.goodsType.trim() !== "" &&
    Number.isFinite(weightNum) &&
    weightNum > 0 &&
    weightNum <= LIMITS.maxWeightKg &&
    Number.isInteger(qtyNum) &&
    qtyNum >= 1 &&
    qtyNum <= LIMITS.maxQuantity;

  const derivedTypeName = useMemo(() => {
    if (!Number.isFinite(weightNum) || weightNum <= 0) return "Mini Truck";
    return deriveVehicleTypeName(weightNum);
  }, [weightNum]);

  const handleGoodsChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setGoods((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setGoods((prev) => ({ ...prev, [name]: value }));
    }
  };

  const scrollTop = () => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const validateLocations = (): boolean => {
    const next: Errors = {};
    if (!pickup) next.pickup = "Please search for and select a pickup location.";
    if (!dest) next.dest = "Please search for and select a destination.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      scrollTop();
      return false;
    }
    return true;
  };

  const validateGoods = (): boolean => {
    const next: Errors = {};
    if (!goods.goodsType) next.goodsType = "Select a goods type.";
    if (!Number.isInteger(qtyNum) || qtyNum < 1 || qtyNum > LIMITS.maxQuantity) {
      next.quantity = `Quantity must be a whole number from 1 to ${LIMITS.maxQuantity}.`;
    }
    if (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum > LIMITS.maxWeightKg) {
      next.weight = `Weight must be greater than 0 and at most ${LIMITS.maxWeightKg} kg.`;
    }
    for (const [key, value] of [
      ["lengthM", goods.lengthM],
      ["widthM", goods.widthM],
      ["heightM", goods.heightM],
    ] as const) {
      if (value.trim() === "") continue;
      const n = parseFloat(value);
      if (!Number.isFinite(n) || n <= 0 || n > LIMITS.maxDimensionM) {
        next[key] = `Dimensions must be between 0 and ${LIMITS.maxDimensionM} m.`;
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      scrollTop();
      return false;
    }
    return true;
  };

  const validateSchedule = (): boolean => {
    const next: Errors = {};
    const when = pickupAt ? new Date(pickupAt) : null;
    if (!when || Number.isNaN(when.getTime())) {
      next.pickupAt = "Choose a preferred pickup date and time.";
    } else if (when.getTime() <= Date.now() + LIMITS.minLeadTimeHours * 60 * 60 * 1000) {
      next.pickupAt = `Pickup must be at least ${LIMITS.minLeadTimeHours} hour from now.`;
    }
    if (deliveryDeadline) {
      const dl = new Date(deliveryDeadline);
      if (Number.isNaN(dl.getTime())) {
        next.deliveryDeadline = "Invalid delivery deadline.";
      } else if (when && dl.getTime() <= when.getTime()) {
        next.deliveryDeadline = "Delivery deadline must be after the pickup time.";
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      scrollTop();
      return false;
    }
    return true;
  };

  const fetchMatches = useCallback(async () => {
    if (!pickup || !dest) return;
    setMatchesLoading(true);
    setMatchesError(null);
    setMatches([]);
    setSelectedTruck(null);
    try {
      const res = await fetch("/api/matching/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          destLat: dest.lat,
          destLng: dest.lng,
          weight: weightNum,
          length: goods.lengthM.trim() ? parseFloat(goods.lengthM) : undefined,
          width: goods.widthM.trim() ? parseFloat(goods.widthM) : undefined,
          height: goods.heightM.trim() ? parseFloat(goods.heightM) : undefined,
          isFragile: goods.isFragile,
          needsRefrigeration: goods.needsRefrigeration,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMatchesError(data.error || "We could not search for trucks right now. Please try again in a moment.");
        return;
      }
      setMatches(data.matches || []);
    } catch {
      setMatchesError("We could not search for trucks right now. Please try again in a moment.");
    } finally {
      setMatchesLoading(false);
    }
  }, [pickup, dest, weightNum, goods.lengthM, goods.widthM, goods.heightM, goods.isFragile, goods.needsRefrigeration]);

  const runEstimate = useCallback(async (vehicleTypeId?: string) => {
    if (!pickup || !dest) return;
    setEstimating(true);
    setEstimateError(null);
    try {
      const res = await fetch("/api/pricing/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: { lat: pickup.lat, lng: pickup.lng },
          dest: { lat: dest.lat, lng: dest.lng },
          weight: weightNum,
          length: goods.lengthM.trim() ? parseFloat(goods.lengthM) : undefined,
          width: goods.widthM.trim() ? parseFloat(goods.widthM) : undefined,
          height: goods.heightM.trim() ? parseFloat(goods.heightM) : undefined,
          isFragile: goods.isFragile,
          needsRefrigeration: goods.needsRefrigeration,
          vehicleTypeId: vehicleTypeId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEstimate(null);
        setEstimateError(data.error || "We could not calculate the price right now. Please try again in a moment.");
        return;
      }
      setEstimate(data);
    } catch {
      setEstimate(null);
      setEstimateError("We could not calculate the price right now. Please try again in a moment.");
    } finally {
      setEstimating(false);
    }
  }, [pickup, dest, weightNum, goods.lengthM, goods.widthM, goods.heightM, goods.isFragile, goods.needsRefrigeration]);

  const handleSelectTruck = (truck: MatchedTruck | null) => {
    setSelectedTruck(truck);
    void runEstimate(truck?.vehicleTypeId);
  };

  const handleContinue = () => {
    setSubmitError(null);
    if (step === 1) {
      if (!validateLocations()) return;
      setStep(2);
    } else if (step === 2) {
      if (!validateGoods()) return;
      setStep(3);
    } else if (step === 3) {
      if (!validateSchedule()) return;
      if (!canEstimate) {
        setSubmitError("Please complete the goods information before continuing.");
        scrollTop();
        return;
      }
      void fetchMatches();
      setStep(4);
    } else if (step === 4) {
      if (!estimate) return;
      setStep(5);
    }
    scrollTop();
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4 | 5);
    scrollTop();
  };

  const handleSubmit = async () => {
    if (!pickup || !dest || !canEstimate) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        pickupAddress: pickup.label,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        destAddress: dest.label,
        destLat: dest.lat,
        destLng: dest.lng,
        goodsType: goods.goodsType,
        goodsDescription: goods.description.trim() || null,
        weight: weightNum,
        quantity: qtyNum,
        isFragile: goods.isFragile,
        needsRefrigeration: goods.needsRefrigeration,
        specialInstructions: goods.specialInstructions.trim() || null,
        serviceType,
        pickupAt: pickupAt || null,
        deliveryDeadline: deliveryDeadline || null,
      };
      for (const [key, val] of [
        ["length", goods.lengthM],
        ["width", goods.widthM],
        ["height", goods.heightM],
      ] as const) {
        if (val.trim() !== "") {
          payload[key] = parseFloat(val);
        }
      }
      if (selectedTruck) {
        payload.vehicleId = selectedTruck.vehicleId;
        payload.driverId = selectedTruck.driverId;
      }

      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSubmitError(data?.error || "We could not submit your request. Please try again.");
        scrollTop();
        return;
      }
      setSubmitted(true);
      scrollTop();
    } catch {
      setSubmitError("Something went wrong submitting your request. Please try again.");
      scrollTop();
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div ref={topRef} />
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Request Submitted!</h2>
          <p className="text-muted mb-6">
            {selectedTruck
              ? `Your request has been sent to ${selectedTruck.driverName}. You will be notified when they accept.`
              : "Your transportation request has been received. Available drivers in the area will be notified."}
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <button onClick={() => router.push("/dashboard/requests")} className="btn btn-primary">
              View My Requests
            </button>
            <button onClick={() => router.push("/dashboard")} className="btn btn-outline">
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div ref={topRef} />

      <div>
        <h1 className="text-2xl font-bold">New Transportation Request</h1>
        <p className="text-muted text-sm mt-1">
          Tell us what you need moved and we will handle the rest.
        </p>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex items-center gap-1 sm:gap-2 min-w-max">
          {STEPS.map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    step >= s.num ? "bg-primary text-white" : "bg-surface text-muted border border-border"
                  }`}
                >
                  {s.num}
                </div>
                <span
                  className={`text-xs sm:text-sm ${
                    step >= s.num ? "text-foreground font-medium" : "text-muted"
                  } hidden sm:inline`}
                >
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`w-6 sm:w-10 h-0.5 mx-1 ${step > s.num ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div className="card">
            <h2 className="font-semibold mb-1">Where is the trip?</h2>
            <p className="text-sm text-muted mb-4">
              Search for an address or landmark. You will not need coordinates.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <LocationSearch
                  label="Pickup Location"
                  placeholder="Search for pickup location..."
                  selected={pickup}
                  onSelect={(p) => {
                    setPickup(p);
                    setErrors((prev) => ({ ...prev, pickup: "" }));
                  }}
                  onClear={() => setPickup(null)}
                />
                {errors.pickup && <p className="text-xs text-danger mt-1">{errors.pickup}</p>}
              </div>
              <div>
                <LocationSearch
                  label="Destination"
                  placeholder="Search for destination..."
                  selected={dest}
                  onSelect={(p) => {
                    setDest(p);
                    setErrors((prev) => ({ ...prev, dest: "" }));
                  }}
                  onClear={() => setDest(null)}
                />
                {errors.dest && <p className="text-xs text-danger mt-1">{errors.dest}</p>}
              </div>
            </div>
          </div>

          <div>
            <RequestMap pickup={pickup} dest={dest} height={280} />
          </div>

          <button onClick={handleContinue} className="btn btn-primary w-full">
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="card">
            <h2 className="font-semibold mb-4">What are you moving?</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Goods Type</label>
                <select name="goodsType" value={goods.goodsType} onChange={handleGoodsChange} className="input">
                  <option value="">Select type</option>
                  {GOODS_TYPES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                {errors.goodsType && <p className="text-xs text-danger mt-1">{errors.goodsType}</p>}
              </div>
              <div>
                <label className="label">Quantity</label>
                <input name="quantity" type="number" min="1" max={LIMITS.maxQuantity} step="1" value={goods.quantity} onChange={handleGoodsChange} className="input" />
                {errors.quantity && <p className="text-xs text-danger mt-1">{errors.quantity}</p>}
              </div>
              <div>
                <label className="label">Estimated Weight (kg)</label>
                <input name="weight" type="number" min="0.01" max={LIMITS.maxWeightKg} step="any" value={goods.weight} onChange={handleGoodsChange} className="input" placeholder="500" />
                {errors.weight && <p className="text-xs text-danger mt-1">{errors.weight}</p>}
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <input name="description" type="text" maxLength={LIMITS.maxDescriptionLength} value={goods.description} onChange={handleGoodsChange} className="input" placeholder="e.g. 12 pieces of office furniture" />
              </div>
              <div className="md:col-span-2">
                <label className="label">Dimensions (optional)</label>
                <p className="text-xs text-muted mb-2">Provide the size of the largest item, if known. This helps us recommend a suitable truck.</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <input name="lengthM" type="number" min="0.01" max={LIMITS.maxDimensionM} step="any" value={goods.lengthM} onChange={handleGoodsChange} className="input" placeholder="Length (m)" />
                    {errors.lengthM && <p className="text-xs text-danger mt-1">{errors.lengthM}</p>}
                  </div>
                  <div>
                    <input name="widthM" type="number" min="0.01" max={LIMITS.maxDimensionM} step="any" value={goods.widthM} onChange={handleGoodsChange} className="input" placeholder="Width (m)" />
                    {errors.widthM && <p className="text-xs text-danger mt-1">{errors.widthM}</p>}
                  </div>
                  <div>
                    <input name="heightM" type="number" min="0.01" max={LIMITS.maxDimensionM} step="any" value={goods.heightM} onChange={handleGoodsChange} className="input" placeholder="Height (m)" />
                    {errors.heightM && <p className="text-xs text-danger mt-1">{errors.heightM}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" name="isFragile" checked={goods.isFragile} onChange={handleGoodsChange} className="rounded" />
                Fragile goods
              </label>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" name="needsRefrigeration" checked={goods.needsRefrigeration} onChange={handleGoodsChange} className="rounded" />
                Requires refrigeration
              </label>
            </div>

            <div className="mt-4">
              <label className="label">Special handling instructions (optional)</label>
              <textarea name="specialInstructions" maxLength={LIMITS.maxInstructionsLength} value={goods.specialInstructions} onChange={handleGoodsChange} className="input min-h-[72px]" placeholder="Keep furniture upright and covered." />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleBack} className="btn btn-outline px-6">Back</button>
            <button onClick={handleContinue} className="btn btn-primary flex-1">Continue</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="card">
            <h2 className="font-semibold mb-4">Transport Requirements</h2>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
              <p className="text-sm font-medium text-primary mb-1">Recommended for your goods</p>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-muted">Vehicle type</span>
                <span className="font-semibold">{derivedTypeName} or larger</span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-muted">Required capacity</span>
                <span className="font-semibold">At least {Number.isFinite(weightNum) && weightNum > 0 ? Math.ceil(weightNum).toLocaleString() : "—"} kg</span>
              </div>
              {dims && dims.hasAll && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted">Largest item</span>
                  <span className="font-semibold">{dims.lengthM} m x {dims.widthM} m x {dims.heightM} m</span>
                </div>
              )}
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-muted">Refrigeration</span>
                <span className="font-semibold">{goods.needsRefrigeration ? "Required" : "Not required"}</span>
              </div>
              {goods.isFragile && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted">Fragile handling</span>
                  <span className="font-semibold">Required</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted mt-2">Next, you can pick a specific truck from verified drivers or let us broadcast your request.</p>
          </div>

          <div className="card">
            <h2 className="font-semibold mb-1">Pickup schedule</h2>
            <p className="text-sm text-muted mb-4">All times are Ghana local time (GMT).</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Preferred pickup date & time</label>
                <input type="datetime-local" min={toDateTimeLocal(inOneHour())} value={pickupAt} onChange={(e) => { setPickupAt(e.target.value); setErrors((prev) => ({ ...prev, pickupAt: "" })); }} className="input" />
                {errors.pickupAt && <p className="text-xs text-danger mt-1">{errors.pickupAt}</p>}
              </div>
              <div>
                <label className="label">Delivery deadline (optional)</label>
                <input type="datetime-local" min={pickupAt || toDateTimeLocal(inOneHour())} value={deliveryDeadline} onChange={(e) => { setDeliveryDeadline(e.target.value); setErrors((prev) => ({ ...prev, deliveryDeadline: "" })); }} className="input" />
                {errors.deliveryDeadline && <p className="text-xs text-danger mt-1">{errors.deliveryDeadline}</p>}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold mb-4">Transport Service</h2>
            <div className="grid gap-2">
              {SERVICE_TYPE_VALUES.map((key) => (
                <label key={key} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${serviceType === key ? "border-primary bg-primary/5" : "border-border hover:bg-surface"}`}>
                  <input type="radio" name="serviceType" value={key} checked={serviceType === key} onChange={() => setServiceType(key)} className="accent-[var(--primary)]" />
                  <span className="text-sm font-medium">{SERVICE_TYPES[key]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleBack} className="btn btn-outline px-6">Back</button>
            <button onClick={handleContinue} className="btn btn-primary flex-1">Continue</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <div className="card">
            <h2 className="font-semibold mb-1">Choose a Truck</h2>
            <p className="text-sm text-muted mb-4">Verified trucks that can carry your load, sorted by driver rating.</p>

            {matchesLoading && (
              <div className="py-10 text-center space-y-3">
                <svg className="w-8 h-8 mx-auto animate-spin text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v3m0 6v3m6-6h-3m-6 0H6m12.364-3.364l-2.121 2.121m.707 10.607l2.122-2.121M5.636 16.95l2.121-2.121m0-5.657l-2.121-2.12" />
                </svg>
                <p className="text-sm text-muted">Searching for available trucks...</p>
              </div>
            )}

            {!matchesLoading && matchesError && (
              <div className="py-6 text-center space-y-4">
                <p className="text-sm text-danger">{matchesError}</p>
                <button onClick={() => void fetchMatches()} className="btn btn-outline btn-sm">Try again</button>
              </div>
            )}

            {!matchesLoading && !matchesError && matches.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-sm text-muted mb-2">No trucks are available for this load right now.</p>
                <p className="text-xs text-muted">You can still submit the request and we will notify every available driver.</p>
              </div>
            )}

            {!matchesLoading && !matchesError && matches.length > 0 && (
              <div className="space-y-3">
                {matches.map((truck) => {
                  const active = selectedTruck?.vehicleId === truck.vehicleId;
                  return (
                    <button key={truck.vehicleId} type="button" onClick={() => handleSelectTruck(truck)} disabled={estimating} className={`w-full text-left card transition ${active ? "border-primary ring-2 ring-primary/20" : "hover:border-muted"}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {truck.vehicleImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={truck.vehicleImageUrl} alt={`${truck.vehicleMake} ${truck.vehicleModel}`} className="w-24 h-24 object-cover rounded-lg border border-border shrink-0" />
                          ) : (
                            <div className="w-24 h-24 rounded-lg border border-border bg-surface flex items-center justify-center text-muted shrink-0">
                              <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                              </svg>
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{truck.vehicleMake} {truck.vehicleModel}</span>
                              <span className="badge badge-info">{truck.vehicleTypeName}</span>
                            </div>
                            <div className="text-sm text-muted space-y-0.5 mt-1">
                              <div>Driver: {truck.driverName} • ⭐ {truck.driverRating.toFixed(1)}</div>
                              <div>Registration: {truck.vehicleRegistration} • Capacity: {truck.vehicleCapacity.toLocaleString()}kg</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                          <div className="text-lg font-bold text-primary">{formatMoney(truck.estimatedPrice)}</div>
                          {active && (
                            <span className="badge badge-success flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                              Selected
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}

                <button type="button" onClick={() => handleSelectTruck(null)} disabled={estimating} className={`w-full text-left card transition ${selectedTruck === null ? "border-primary ring-2 ring-primary/20" : "hover:border-muted"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">No preference — any suitable truck</p>
                      <p className="text-sm text-muted">We will notify all available drivers.</p>
                    </div>
                    {selectedTruck === null && (<span className="badge badge-success">Selected</span>)}
                  </div>
                </button>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="font-semibold mb-4">Price Estimate</h2>

            {estimating && (
              <div className="py-8 text-center space-y-3">
                <svg className="w-8 h-8 mx-auto animate-spin text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v3m0 6v3m6-6h-3m-6 0H6m12.364-3.364l-2.121 2.121m.707 10.607l2.122-2.121M5.636 16.95l2.121-2.121m0-5.657l-2.121-2.12" />
                </svg>
                <p className="text-sm text-muted">Calculating the route and your estimate...</p>
              </div>
            )}

            {!estimating && estimateError && (
              <div className="py-4 text-center space-y-4">
                <p className="text-sm text-danger">{estimateError}</p>
                <button onClick={() => void runEstimate(selectedTruck?.vehicleTypeId)} className="btn btn-outline btn-sm">Try again</button>
              </div>
            )}

            {!estimating && !estimateError && estimate && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted">Estimated distance</p>
                    <p className="text-lg font-bold mt-0.5">{formatKm(estimate.distanceKm)}</p>
                    {estimate.distanceFallback && (<p className="text-[11px] text-accent mt-0.5">Approximate (road routing unavailable)</p>)}
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted">Estimated duration</p>
                    <p className="text-lg font-bold mt-0.5">~{estimate.durationMin} min</p>
                  </div>
                </div>

                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted">Estimated price</p>
                  <p className="text-4xl font-extrabold text-primary mt-1">{formatMoney(estimate.price.total)}</p>
                  <p className="text-xs text-muted mt-2">
                    {selectedTruck
                      ? `Based on ${selectedTruck.vehicleMake} ${selectedTruck.vehicleModel} (${estimate.vehicleTypeName}).`
                      : `Based on a ${estimate.vehicleTypeName}.`}{" "}
                    Final price confirmed after driver acceptance.
                  </p>
                </div>

                <div className="text-sm space-y-1.5">
                  <div className="flex justify-between text-muted">
                    <span>Distance charge ({formatKm(estimate.distanceKm)})</span>
                    <span>{formatMoney(estimate.price.distanceCharge)}</span>
                  </div>
                  <div className="flex justify-between text-muted">
                    <span>Weight charge ({Math.round(estimate.requirements.minCapacityKg).toLocaleString()} kg)</span>
                    <span>{formatMoney(estimate.price.weightCharge)}</span>
                  </div>
                  {estimate.price.volumeCharge > 0 && (<div className="flex justify-between text-muted"><span>Volume charge</span><span>{formatMoney(estimate.price.volumeCharge)}</span></div>)}
                  {estimate.price.fragileSurcharge > 0 && (<div className="flex justify-between text-muted"><span>Fragile surcharge</span><span>{formatMoney(estimate.price.fragileSurcharge)}</span></div>)}
                  {estimate.price.refrigerationSurcharge > 0 && (<div className="flex justify-between text-muted"><span>Refrigeration surcharge</span><span>{formatMoney(estimate.price.refrigerationSurcharge)}</span></div>)}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={handleBack} className="btn btn-outline px-6">Back</button>
            <button onClick={handleContinue} disabled={matchesLoading || estimating || !estimate || Boolean(estimateError)} className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed">Continue</button>
          </div>
        </div>
      )}

      {step === 5 && estimate && (
        <div className="space-y-5">
          <div className="card">
            <h2 className="font-semibold mb-4">Review Your Request</h2>
            <dl className="divide-y divide-border text-sm">
              <div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Pickup</dt><dd className="font-medium">{pickup?.label}</dd></div>
              <div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Destination</dt><dd className="font-medium">{dest?.label}</dd></div>
              <div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Estimated distance</dt><dd className="font-medium">{formatKm(estimate.distanceKm)}</dd></div>
              <div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Pickup date & time</dt><dd className="font-medium">{formatDateTime(pickupAt)}</dd></div>
              <div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Delivery deadline</dt><dd className="font-medium">{formatDateTime(deliveryDeadline || null)}</dd></div>
              <div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Service</dt><dd className="font-medium">{SERVICE_TYPES[serviceType]}</dd></div>
              <div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1">
                <dt className="text-muted">Truck</dt>
                <dd className="font-medium">
                  {selectedTruck
                    ? `${selectedTruck.vehicleMake} ${selectedTruck.vehicleModel} (${selectedTruck.vehicleRegistration}) — Driver: ${selectedTruck.driverName}`
                    : "Any available truck"}
                </dd>
              </div>
              <div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Goods</dt><dd className="font-medium">{goods.goodsType}</dd></div>
              <div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Quantity</dt><dd className="font-medium">{qtyNum}</dd></div>
              <div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Weight</dt><dd className="font-medium">{Math.round(weightNum).toLocaleString()} kg</dd></div>
              {goods.description.trim() && (<div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Description</dt><dd className="font-medium">{goods.description.trim()}</dd></div>)}
              {dims && dims.hasAll && (<div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Dimensions</dt><dd className="font-medium">{dims.lengthM} m x {dims.widthM} m x {dims.heightM} m</dd></div>)}
              <div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Fragile</dt><dd className="font-medium">{goods.isFragile ? "Yes" : "No"}</dd></div>
              <div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Refrigeration</dt><dd className="font-medium">{goods.needsRefrigeration ? "Yes" : "No"}</dd></div>
              {goods.specialInstructions.trim() && (<div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Special instructions</dt><dd className="font-medium">{goods.specialInstructions.trim()}</dd></div>)}
              <div className="py-3 grid sm:grid-cols-[180px_1fr] gap-1"><dt className="text-muted">Estimated price</dt><dd className="font-medium text-lg font-bold text-primary">{formatMoney(estimate.price.total)}</dd></div>
            </dl>
            <p className="text-xs text-muted mt-2">This is an estimate only. The final price is confirmed after a driver accepts your request.</p>
          </div>

          {submitError && (<div className="rounded-lg border border-danger/30 bg-danger/5 text-danger text-sm p-3">{submitError}</div>)}

          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleBack} className="btn btn-outline">Back</button>
            <button onClick={() => void handleSubmit()} disabled={submitting} className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? "Submitting..." : "Submit Request"}</button>
          </div>
        </div>
      )}

      {step === 5 && !estimate && (
        <div className="card text-center py-10">
          <p className="text-muted mb-4">The estimate is missing. Please re-run it.</p>
          <button onClick={() => setStep(4)} className="btn btn-outline">Back to Truck Selection</button>
        </div>
      )}
    </div>
  );
}
