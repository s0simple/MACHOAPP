"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";

interface VehicleImage {
  id: string;
  url: string;
  isMain: boolean;
}

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number | null;
  registrationNumber: string;
  capacity: number;
  color: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  status: string;
  isVerified: boolean;
  vehicleType: { name: string };
  images: VehicleImage[];
  driver?: {
    user: { name: string };
  };
}

type VerificationFilter = "all" | "pending" | "verified";

export default function VehiclesPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = userRole === "admin";

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<VerificationFilter>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // Bump the token to re-run the fetch effect after mutations.
  const refresh = () => setRefreshToken((token) => token + 1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/vehicles");
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setVehicles(data.vehicles);
        }
      } catch (error) {
        console.error("Error fetching vehicles:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  // Admin-only: verify or revoke verification via the admin endpoint.
  const setVerification = async (vehicleId: string, isVerified: boolean) => {
    setUpdatingId(vehicleId);
    try {
      const response = await fetch(`/api/admin/vehicles/${vehicleId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVerified }),
      });
      if (response.ok) {
        refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update vehicle");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setUpdatingId(null);
    }
  };

  // Driver-only: set an image as the vehicle's main image.
  const setMainImage = async (vehicleId: string, imageId: string) => {
    setUpdatingId(vehicleId);
    try {
      const response = await fetch("/api/vehicle-images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      if (response.ok) {
        refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to set main image");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available": return <span className="badge badge-success">Available</span>;
      case "in_transit": return <span className="badge badge-info">In Transit</span>;
      case "maintenance": return <span className="badge badge-warning">Maintenance</span>;
      case "unavailable": return <span className="badge badge-danger">Unavailable</span>;
      default: return <span className="badge badge-muted">{status}</span>;
    }
  };

  const visibleVehicles = isAdmin
    ? vehicles.filter((vehicle) =>
        filter === "all"
          ? true
          : filter === "pending"
            ? !vehicle.isVerified
            : vehicle.isVerified
      )
    : vehicles;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? "Vehicles" : "My Vehicles"}</h1>
          <p className="text-muted text-sm mt-1">
            {isAdmin ? "Review and verify driver vehicle registrations" : "Manage your truck fleet"}
          </p>
        </div>
        {!isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
            {showForm ? "Cancel" : "Add Vehicle"}
          </button>
        )}
      </div>

      {/* Admin: verification filter tabs */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "all", label: "All" },
              { key: "pending", label: "Pending Verification" },
              { key: "verified", label: "Verified" },
            ] as { key: VerificationFilter; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`btn btn-sm ${filter === key ? "btn-primary" : "btn-outline"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Add Vehicle Form (drivers only) */}
      {showForm && !isAdmin && (
        <div className="card">
          <h2 className="font-semibold mb-4">Add New Vehicle</h2>
          <VehicleForm onSuccess={() => { setShowForm(false); refresh(); }} />
        </div>
      )}

      {/* Vehicles List */}
      {loading ? (
        <div className="card text-center py-8">
          <p className="text-muted">Loading vehicles...</p>
        </div>
      ) : visibleVehicles.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-muted">
            {isAdmin
              ? filter === "pending"
                ? "No vehicles pending verification."
                : "No vehicles registered yet."
              : "No vehicles registered yet."}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {visibleVehicles.map((vehicle) => (
            <div key={vehicle.id} className="card">
              {/* Main image + thumbnails */}
              {vehicle.images.length > 0 && (
                <div className="mb-3">
                  {(() => {
                    const main = vehicle.images.find((img) => img.isMain) ?? vehicle.images[0];
                    return (
                      <div className="flex gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={main.url}
                          alt={`${vehicle.make} ${vehicle.model}`}
                          className="w-32 h-32 object-cover rounded-lg border border-border"
                        />
                        <div className="flex gap-1 overflow-x-auto">
                          {vehicle.images.map((img) => (
                            <button
                              key={img.id}
                              type="button"
                              onClick={() => setMainImage(vehicle.id, img.id)}
                              disabled={img.isMain || updatingId === vehicle.id}
                              className={`shrink-0 rounded-md overflow-hidden border-2 transition ${
                                img.isMain
                                  ? "border-primary"
                                  : "border-border hover:border-muted"
                              }`}
                              title={img.isMain ? "Main image" : "Set as main image"}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img.url}
                                alt={`${vehicle.make} ${vehicle.model}`}
                                className="w-12 h-12 object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{vehicle.make} {vehicle.model}</h3>
                  <p className="text-sm text-muted">{vehicle.vehicleType.name}</p>
                  {isAdmin && vehicle.driver?.user?.name && (
                    <p className="text-sm text-muted mt-1">
                      Driver: <span className="text-foreground">{vehicle.driver.user.name}</span>
                    </p>
                  )}
                </div>
                {getStatusBadge(vehicle.status)}
              </div>
              <div className="space-y-1 text-sm text-muted">
                <div>Registration: <span className="text-foreground">{vehicle.registrationNumber}</span></div>
                <div>Capacity: <span className="text-foreground">{vehicle.capacity}kg</span></div>
                {vehicle.color && (
                  <div>Color: <span className="text-foreground">{vehicle.color}</span></div>
                )}
                {vehicle.length && (
                  <div>Dimensions: <span className="text-foreground">{vehicle.length}m × {vehicle.width}m × {vehicle.height}m</span></div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {vehicle.isVerified ? (
                    <span className="badge badge-success">Verified</span>
                  ) : (
                    <span className="badge badge-warning">Pending Verification</span>
                  )}
                  {isAdmin && (
                    vehicle.isVerified ? (
                      <button
                        onClick={() => setVerification(vehicle.id, false)}
                        disabled={updatingId === vehicle.id}
                        className="btn btn-outline btn-sm"
                      >
                        {updatingId === vehicle.id ? "Updating..." : "Revoke"}
                      </button>
                    ) : (
                      <button
                        onClick={() => setVerification(vehicle.id, true)}
                        disabled={updatingId === vehicle.id}
                        className="btn btn-primary btn-sm"
                      >
                        {updatingId === vehicle.id ? "Updating..." : "Verify"}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Image uploader for this vehicle (drivers only) */}
              {!isAdmin && (
                <div className="mt-4 pt-4 border-t border-border">
                  <ImageUploader
                    vehicleId={vehicle.id}
                    onUploaded={refresh}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VehicleForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    make: "",
    model: "",
    year: "",
    registrationNumber: "",
    typeId: "",
    capacity: "",
    color: "",
    length: "",
    width: "",
    height: "",
  });
  const [vehicleTypes, setVehicleTypes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/vehicle-types")
      .then((r) => (r.ok ? r.json() : []))
      .then(setVehicleTypes)
      .catch(() => setVehicleTypes([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to add vehicle");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
      {error && (
        <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div>
        <label className="label">Make (Brand)</label>
        <input
          className="input"
          value={formData.make}
          onChange={(e) => setFormData({ ...formData, make: e.target.value })}
          placeholder="e.g., Isuzu"
          required
        />
      </div>
      <div>
        <label className="label">Model</label>
        <input
          className="input"
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          placeholder="e.g., NPR"
          required
        />
      </div>
      <div>
        <label className="label">Registration Number</label>
        <input
          className="input"
          value={formData.registrationNumber}
          onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
          placeholder="e.g., GR 1234-20"
          required
        />
      </div>
      <div>
        <label className="label">Vehicle Type</label>
        <select
          className="input"
          value={formData.typeId}
          onChange={(e) => setFormData({ ...formData, typeId: e.target.value })}
          required
        >
          <option value="">Select type</option>
          {vehicleTypes.map((type) => (
            <option key={type.id} value={type.id}>{type.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Capacity (kg)</label>
        <input
          type="number"
          className="input"
          value={formData.capacity}
          onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
          placeholder="5000"
          required
        />
      </div>
      <div>
        <label className="label">Color</label>
        <input
          className="input"
          value={formData.color}
          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
          placeholder="e.g., White"
        />
      </div>
      <div>
        <label className="label">Year</label>
        <input
          type="number"
          className="input"
          value={formData.year}
          onChange={(e) => setFormData({ ...formData, year: e.target.value })}
          placeholder="2020"
        />
      </div>
      <div>
        <label className="label">Length (m)</label>
        <input
          type="number"
          step="any"
          className="input"
          value={formData.length}
          onChange={(e) => setFormData({ ...formData, length: e.target.value })}
          placeholder="6.0"
        />
      </div>
      <div>
        <label className="label">Width (m)</label>
        <input
          type="number"
          step="any"
          className="input"
          value={formData.width}
          onChange={(e) => setFormData({ ...formData, width: e.target.value })}
          placeholder="2.2"
        />
      </div>
      <div>
        <label className="label">Height (m)</label>
        <input
          type="number"
          step="any"
          className="input"
          value={formData.height}
          onChange={(e) => setFormData({ ...formData, height: e.target.value })}
          placeholder="2.5"
        />
      </div>
      <button type="submit" className="btn btn-primary md:col-span-2" disabled={loading}>
        {loading ? "Adding..." : "Add Vehicle"}
      </button>
    </form>
  );
}

function ImageUploader({ vehicleId, onUploaded }: { vehicleId: string; onUploaded: () => void }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("vehicleId", vehicleId);
      list.forEach((file) => formData.append("images", file));

      const response = await fetch("/api/vehicle-images", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setMessage(`Uploaded ${list.length} image${list.length !== 1 ? "s" : ""}`);
        onUploaded();
      } else {
        const data = await response.json();
        setMessage(data.error || "Upload failed");
      }
    } catch {
      setMessage("Something went wrong during upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
        }}
        className={`block cursor-pointer rounded-lg border-2 border-dashed p-4 text-center text-sm transition ${
          dragActive
            ? "border-primary bg-primary/5 text-primary"
            : "border-border text-muted hover:border-muted"
        }`}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {uploading
          ? "Uploading..."
          : dragActive
            ? "Drop images here"
            : "Drag & drop vehicle images here, or click to browse (max 5, JPEG/PNG/WebP, 5MB each)"}
      </label>
      {message && <p className="text-xs text-muted mt-2">{message}</p>}
    </div>
  );
}