"use client";

import { useEffect, useState } from "react";

interface Trip {
  id: string;
  status: string;
  actualPrice: number | null;
  driverEarning: number | null;
  startedAt: string | null;
  completedAt: string | null;
  assignedAt: string;
  request: {
    pickupAddress: string;
    destAddress: string;
    goodsType: string;
    weight: number;
  };
  vehicle: {
    make: string;
    model: string;
    registrationNumber: string;
  };
}

export default function MyTripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [completedTrip, setCompletedTrip] = useState<Trip | null>(null);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const response = await fetch("/api/trips");
      if (response.ok) {
        const data = await response.json();
        setTrips(data.trips ?? []);
      }
    } catch (error) {
      console.error("Error fetching trips:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateTripStatus = async (tripId: string, status: string) => {
    setUpdatingId(tripId);
    try {
      const response = await fetch("/api/trips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, status }),
      });
      if (response.ok) {
        const updated = await response.json();
        if (status === "completed") {
          // Show the price modal with the final amount
          setCompletedTrip({ ...updated, request: trips.find(t => t.id === tripId)?.request, vehicle: trips.find(t => t.id === tripId)?.vehicle } as Trip);
        }
        fetchTrips();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update trip");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredTrips = filter === "all" ? trips : trips.filter((t) => t.status === filter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "assigned": return <span className="badge badge-info">Assigned</span>;
      case "started": return <span className="badge badge-warning">Started</span>;
      case "in_progress": return <span className="badge badge-success">In Progress</span>;
      case "completed": return <span className="badge badge-success">Completed</span>;
      case "cancelled": return <span className="badge badge-danger">Cancelled</span>;
      default: return <span className="badge badge-muted">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Trips</h1>
        <p className="text-muted text-sm mt-1">View and manage your assigned trips</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["all", "assigned", "in_progress", "completed", "cancelled"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === status
                ? "bg-primary text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {status === "all" ? "All" : status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card text-center py-8">
          <p className="text-muted">Loading trips...</p>
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-muted">No trips found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTrips.map((trip) => (
            <div key={trip.id} className="card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusBadge(trip.status)}
                    <span className="text-xs text-muted">{trip.request.goodsType}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-foreground font-medium">{trip.request.pickupAddress}</span>
                    <span className="text-muted mx-2">→</span>
                    <span className="text-foreground font-medium">{trip.request.destAddress}</span>
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {trip.vehicle.make} {trip.vehicle.model} • {trip.vehicle.registrationNumber} • {trip.request.weight}kg
                  </div>
                </div>
                <div className="text-right">
                  {trip.driverEarning && (
                    <div className="font-bold text-secondary">+GHS {trip.driverEarning.toFixed(2)}</div>
                  )}
                  <div className="text-xs text-muted mt-1">
                    {new Date(trip.assignedAt).toLocaleDateString()}
                  </div>
                  {trip.status === "assigned" && (
                    <button
                      onClick={() => updateTripStatus(trip.id, "in_transit")}
                      disabled={updatingId === trip.id}
                      className="btn btn-primary btn-sm mt-2 w-full"
                    >
                      {updatingId === trip.id ? "Starting..." : "Start Trip"}
                    </button>
                  )}
                  {trip.status === "in_transit" && (
                    <button
                      onClick={() => updateTripStatus(trip.id, "completed")}
                      disabled={updatingId === trip.id}
                      className="btn btn-success btn-sm mt-2 w-full"
                    >
                      {updatingId === trip.id ? "Completing..." : "Complete Trip"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Price reveal modal on trip completion */}
      {completedTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2">Trip Completed!</h2>
            <p className="text-muted text-sm mb-4">Trip ended. Customer will pay:</p>
            <div className="text-4xl font-bold text-primary mb-6">
              GHS {Number(completedTrip.actualPrice ?? 0).toFixed(2)}
            </div>
            <button
              onClick={() => setCompletedTrip(null)}
              className="btn btn-primary w-full"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
