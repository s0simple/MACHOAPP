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
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}