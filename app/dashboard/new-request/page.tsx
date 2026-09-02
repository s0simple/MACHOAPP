"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface MatchedTruck {
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

export default function NewRequestPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchedTrucks, setMatchedTrucks] = useState<MatchedTruck[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<MatchedTruck | null>(null);

  const [formData, setFormData] = useState({
    pickupAddress: "",
    pickupLat: "",
    pickupLng: "",
    destAddress: "",
    destLat: "",
    destLng: "",
    goodsType: "",
    goodsDescription: "",
    weight: "",
    length: "",
    width: "",
    height: "",
    quantity: "1",
    isFragile: false,
    needsRefrigeration: false,
    preferredVehicleType: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFindTrucks = async (e: React.FormEvent) => {
    e.preventDefault();
    setMatching(true);

    try {
      const response = await fetch("/api/matching/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupLat: parseFloat(formData.pickupLat),
          pickupLng: parseFloat(formData.pickupLng),
          destLat: parseFloat(formData.destLat),
          destLng: parseFloat(formData.destLng),
          weight: parseFloat(formData.weight),
          length: formData.length ? parseFloat(formData.length) : undefined,
          width: formData.width ? parseFloat(formData.width) : undefined,
          height: formData.height ? parseFloat(formData.height) : undefined,
          preferredVehicleType: formData.preferredVehicleType || undefined,
          isFragile: formData.isFragile,
          needsRefrigeration: formData.needsRefrigeration,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMatchedTrucks(data.matches);
        setStep(2);
      } else {
        alert(data.error || "Failed to find matching trucks");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setMatching(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!selectedTruck) return;
    setLoading(true);

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          pickupLat: parseFloat(formData.pickupLat),
          pickupLng: parseFloat(formData.pickupLng),
          destLat: parseFloat(formData.destLat),
          destLng: parseFloat(formData.destLng),
          weight: parseFloat(formData.weight),
          length: formData.length ? parseFloat(formData.length) : undefined,
          width: formData.width ? parseFloat(formData.width) : undefined,
          height: formData.height ? parseFloat(formData.height) : undefined,
          quantity: parseInt(formData.quantity),
          driverId: selectedTruck.driverId,
          vehicleId: selectedTruck.vehicleId,
          estimatedPrice: selectedTruck.estimatedPrice,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep(3);
      } else {
        alert(data.error || "Failed to create request");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">New Transportation Request</h1>
        <p className="text-muted text-sm mt-1">Fill in the details to find available trucks</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s ? "bg-primary text-white" : "bg-surface text-muted"
              }`}
            >
              {s}
            </div>
            <span className={`text-sm ${step >= s ? "text-foreground font-medium" : "text-muted"}`}>
              {s === 1 ? "Details" : s === 2 ? "Select Truck" : "Confirmed"}
            </span>
            {s < 3 && <div className={`w-8 h-0.5 ${step > s ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Request Details */}
      {step === 1 && (
        <form onSubmit={handleFindTrucks} className="space-y-6">
          {/* Locations */}
          <div className="card">
            <h2 className="font-semibold mb-4">Locations</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Pickup Address</label>
                <input
                  name="pickupAddress"
                  value={formData.pickupAddress}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="e.g., Accra Mall, Spintex Road"
                  required
                />
              </div>
              <div>
                <label className="label">Destination Address</label>
                <input
                  name="destAddress"
                  value={formData.destAddress}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="e.g., Kumasi Central Market"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Pickup Latitude</label>
                  <input
                    name="pickupLat"
                    type="number"
                    step="any"
                    value={formData.pickupLat}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="5.5600"
                    required
                  />
                </div>
                <div>
                  <label className="label">Pickup Longitude</label>
                  <input
                    name="pickupLng"
                    type="number"
                    step="any"
                    value={formData.pickupLng}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="-0.2050"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Destination Latitude</label>
                  <input
                    name="destLat"
                    type="number"
                    step="any"
                    value={formData.destLat}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="6.6885"
                    required
                  />
                </div>
                <div>
                  <label className="label">Destination Longitude</label>
                  <input
                    name="destLng"
                    type="number"
                    step="any"
                    value={formData.destLng}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="-1.6244"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Goods Information */}
          <div className="card">
            <h2 className="font-semibold mb-4">Goods Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Goods Type</label>
                <select
                  name="goodsType"
                  value={formData.goodsType}
                  onChange={handleInputChange}
                  className="input"
                  required
                >
                  <option value="">Select type</option>
                  <option value="General Goods">General Goods</option>
                  <option value="Food Items">Food Items</option>
                  <option value="Building Materials">Building Materials</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Agricultural Products">Agricultural Products</option>
                  <option value="Industrial Equipment">Industrial Equipment</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Weight (kg)</label>
                <input
                  name="weight"
                  type="number"
                  value={formData.weight}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="500"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Description</label>
                <textarea
                  name="goodsDescription"
                  value={formData.goodsDescription}
                  onChange={handleInputChange}
                  className="input min-h-[80px]"
                  placeholder="Describe your goods..."
                />
              </div>
              <div>
                <label className="label">Length (m)</label>
                <input
                  name="length"
                  type="number"
                  step="any"
                  value={formData.length}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="2.5"
                />
              </div>
              <div>
                <label className="label">Width (m)</label>
                <input
                  name="width"
                  type="number"
                  step="any"
                  value={formData.width}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="1.8"
                />
              </div>
              <div>
                <label className="label">Height (m)</label>
                <input
                  name="height"
                  type="number"
                  step="any"
                  value={formData.height}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="1.5"
                />
              </div>
              <div>
                <label className="label">Quantity</label>
                <input
                  name="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  className="input"
                  min="1"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isFragile"
                  checked={formData.isFragile}
                  onChange={handleInputChange}
                  className="rounded"
                />
                Fragile goods
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="needsRefrigeration"
                  checked={formData.needsRefrigeration}
                  onChange={handleInputChange}
                  className="rounded"
                />
                Needs refrigeration
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={matching}
          >
            {matching ? "Finding trucks..." : "Find Available Trucks"}
          </button>
        </form>
      )}

      {/* Step 2: Select Truck */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold mb-2">Available Trucks</h2>
            <p className="text-muted text-sm">
              {matchedTrucks.length} truck{matchedTrucks.length !== 1 ? "s" : ""} matched your request, sorted by driver rating.
            </p>
          </div>

          {matchedTrucks.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-muted mb-4">No trucks available for your request. Try adjusting your criteria.</p>
              <button onClick={() => setStep(1)} className="btn btn-outline">
                Modify Request
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {matchedTrucks.map((truck) => (
                 <div
                   key={truck.vehicleId}
                   onClick={() => setSelectedTruck(truck)}
                   className={`card cursor-pointer transition ${
                     selectedTruck?.vehicleId === truck.vehicleId
                       ? "border-primary ring-2 ring-primary/20"
                       : "hover:border-muted"
                   }`}
                 >
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                     <div className="flex-1">
                       <div className="flex items-center gap-3 mb-2">
                         {truck.vehicleImageUrl ? (
                           // eslint-disable-next-line @next/next/no-img-element
                           <img
                             src={truck.vehicleImageUrl}
                             alt={`${truck.vehicleMake} ${truck.vehicleModel}`}
                             className="w-16 h-16 object-cover rounded-lg border border-border"
                           />
                         ) : (
                           <div className="w-16 h-16 rounded-lg border border-border bg-surface flex items-center justify-center text-muted">
                             <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                             </svg>
                           </div>
                         )}
                         <div>
                           <div className="flex items-center gap-2">
                             <span className="font-semibold">{truck.vehicleMake} {truck.vehicleModel}</span>
                             <span className="badge badge-info">{truck.vehicleTypeName}</span>
                           </div>
                           <div className="text-sm text-muted space-y-0.5">
                             <div>Driver: {truck.driverName} • ⭐ {truck.driverRating.toFixed(1)}</div>
                             <div>Registration: {truck.vehicleRegistration}</div>
                             <div>Capacity: {truck.vehicleCapacity}kg</div>
                           </div>
                         </div>
                       </div>
                     </div>
                     <div className="text-right">
                       <div className="text-xl font-bold text-primary">GHS {truck.estimatedPrice.toFixed(2)}</div>
                     </div>
                   </div>
                 </div>
              ))}
            </div>
          )}

          {selectedTruck && (
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn btn-outline flex-1">
                Back
              </button>
              <button onClick={handleSubmitRequest} className="btn btn-primary flex-1" disabled={loading}>
                {loading ? "Confirming..." : "Confirm & Request"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Confirmed */}
      {step === 3 && (
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Request Confirmed!</h2>
          <p className="text-muted mb-6">
            Your transportation request has been submitted. The driver will be notified shortly.
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={() => router.push("/dashboard/requests")} className="btn btn-primary">
              View My Requests
            </button>
            <button onClick={() => router.push("/dashboard")} className="btn btn-outline">
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}