"use client";

import { useEffect, useState } from "react";

interface Trip {
  id: string;
  status: string;
  actualPrice: number | null;
  assignedAt: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  request: {
    pickupAddress: string;
    destAddress: string;
    goodsType: string;
  };
  driver: {
    user: { name: string };
  };
  vehicle: {
    make: string;
    model: string;
    registrationNumber: string;
  };
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const response = await fetch("/api/trips");
      if (response.ok) {
        const data = await response.json();
        setTrips(data.trips);
      }
    } catch (error) {
      console.error("Error fetching trips:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "assigned":
        return <span className="badge badge-info">Assigned</span>;
      case "in_transit":
        return <span className="badge badge-warning">In Transit</span>;
      case "completed":
        return <span className="badge badge-success">Completed</span>;
      case "cancelled":
        return <span className="badge badge-danger">Cancelled</span>;
      default:
        return <span className="badge badge-muted">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Trips</h1>
        <p className="text-muted text-sm mt-1">
          Monitor all transportation trips
        </p>
      </div>

      {loading ? (
        <div className="card text-center py-8">
          <p className="text-muted">Loading trips...</p>
        </div>
      ) : trips.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-muted">No trips recorded yet.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Route</th>
                <th>Driver</th>
                <th>Vehicle</th>
                <th>Status</th>
                <th>Price</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.id}>
                  <td className="text-sm">
                    {trip.request.pickupAddress} → {trip.request.destAddress}
                  </td>
                  <td className="text-sm">{trip.driver.user.name}</td>
                  <td className="text-sm">
                    {trip.vehicle.make} {trip.vehicle.model}
                    <div className="text-xs text-muted">
                      {trip.vehicle.registrationNumber}
                    </div>
                  </td>
                  <td>{getStatusBadge(trip.status)}</td>
                  <td className="text-sm">
                    {trip.actualPrice
                      ? `GHS ${trip.actualPrice.toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="text-sm text-muted">
                    {new Date(trip.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
