"use client";

import { useEffect, useState } from "react";

interface PricingRule {
  id: string;
  name: string;
  baseRate: number;
  perKmRate: number;
  perKgRate: number;
  minPrice: number;
  surgeMultiplier: number;
  description: string | null;
  isActive: boolean;
  vehicleType: { name: string };
}

export default function PricingPage() {
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({
    vehicleTypeId: "",
    name: "",
    description: "",
    baseRate: "",
    perKmRate: "",
    perKgRate: "",
    minPrice: "",
    surgeMultiplier: "1.0",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPricingRules();
  }, []);

  useEffect(() => {
    fetch("/api/vehicle-types")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setVehicleTypes(data.vehicleTypes ?? data ?? []))
      .catch(() => setVehicleTypes([]));
  }, []);

  const fetchPricingRules = async () => {
    try {
      const response = await fetch("/api/admin/pricing");
      if (response.ok) {
        const data = await response.json();
        setPricingRules(data.rules ?? []);
      }
    } catch (error) {
      console.error("Error fetching pricing rules:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/pricing/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (response.ok) {
        setPricingRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isActive: !currentStatus } : r))
        );
      }
    } catch (error) {
      console.error("Error toggling pricing rule:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setFormData({
          vehicleTypeId: "",
          name: "",
          description: "",
          baseRate: "",
          perKmRate: "",
          perKgRate: "",
          minPrice: "",
          surgeMultiplier: "1.0",
        });
        setShowForm(false);
        fetchPricingRules();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create pricing rule");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pricing Rules</h1>
          <p className="text-muted text-sm mt-1">Configure transportation pricing for each vehicle type</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? "Cancel" : "Add Pricing Rule"}
        </button>
      </div>

      {/* Add Pricing Rule Form */}
      {showForm && (
        <div className="card">
          <h2 className="font-semibold mb-4">Add New Pricing Rule</h2>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
            {error && (
              <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="label">Vehicle Type</label>
              <select
                name="vehicleTypeId"
                value={formData.vehicleTypeId}
                onChange={handleInputChange}
                className="input"
                required
              >
                <option value="">Select type</option>
                {vehicleTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Name</label>
              <input
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="input"
                placeholder="e.g., Standard Cargo"
                required
              />
            </div>
            <div>
              <label className="label">Base Rate (GHS)</label>
              <input
                name="baseRate"
                type="number"
                step="any"
                value={formData.baseRate}
                onChange={handleInputChange}
                className="input"
                placeholder="100"
                required
              />
            </div>
            <div>
              <label className="label">Per Km Rate (GHS)</label>
              <input
                name="perKmRate"
                type="number"
                step="any"
                value={formData.perKmRate}
                onChange={handleInputChange}
                className="input"
                placeholder="5.0"
                required
              />
            </div>
            <div>
              <label className="label">Per Kg Rate (GHS)</label>
              <input
                name="perKgRate"
                type="number"
                step="any"
                value={formData.perKgRate}
                onChange={handleInputChange}
                className="input"
                placeholder="0.10"
                required
              />
            </div>
            <div>
              <label className="label">Min Price (GHS)</label>
              <input
                name="minPrice"
                type="number"
                step="any"
                value={formData.minPrice}
                onChange={handleInputChange}
                className="input"
                placeholder="150"
                required
              />
            </div>
            <div>
              <label className="label">Surge Multiplier</label>
              <input
                name="surgeMultiplier"
                type="number"
                step="any"
                value={formData.surgeMultiplier}
                onChange={handleInputChange}
                className="input"
                placeholder="1.0"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="input min-h-[60px]"
                placeholder="Optional description..."
              />
            </div>
            <button type="submit" className="btn btn-primary md:col-span-2" disabled={submitting}>
              {submitting ? "Creating..." : "Create Pricing Rule"}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card text-center py-8">
          <p className="text-muted">Loading pricing rules...</p>
        </div>
      ) : pricingRules.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-muted">No pricing rules configured.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pricingRules.map((rule) => (
            <div key={rule.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{rule.name}</h3>
                  <p className="text-sm text-muted">{rule.vehicleType.name}</p>
                </div>
                {rule.isActive ? (
                  <span className="badge badge-success">Active</span>
                ) : (
                  <span className="badge badge-muted">Inactive</span>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Base Rate:</span>
                  <span className="font-medium">GHS {rule.baseRate.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Per Km:</span>
                  <span className="font-medium">GHS {rule.perKmRate.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Per Kg:</span>
                  <span className="font-medium">GHS {rule.perKgRate.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Min Price:</span>
                  <span className="font-medium">GHS {rule.minPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Surge:</span>
                  <span className="font-medium">{rule.surgeMultiplier}x</span>
                </div>
              </div>

              {rule.description && (
                <p className="text-xs text-muted mt-3 border-t border-border pt-3">
                  {rule.description}
                </p>
              )}

              <button
                onClick={() => toggleActive(rule.id, rule.isActive)}
                className={`btn btn-sm w-full mt-4 ${rule.isActive ? "btn-danger" : "btn-primary"}`}
              >
                {rule.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
