"use client";

import { useEffect, useState } from "react";

interface EarningsData {
  totalEarnings: number;
  completedTrips: number;
  averagePerTrip: number;
  thisMonth: number;
  recentTrips: {
    id: string;
    driverEarning: number | null;
    completedAt: string | null;
    request: { pickupAddress: string; destAddress: string };
  }[];
}

export default function EarningsPage() {
  const [data, setData] = useState<EarningsData>({
    totalEarnings: 0,
    completedTrips: 0,
    averagePerTrip: 0,
    thisMonth: 0,
    recentTrips: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      const response = await fetch("/api/trips");
      if (response.ok) {
        const trips = await response.json();
        const completedTrips = trips.filter((t: { status: string }) => t.status === "completed");
        const totalEarnings = completedTrips.reduce(
          (sum: number, t: { driverEarning: number | null }) => sum + (t.driverEarning || 0),
          0
        );

        const now = new Date();
        const thisMonth = completedTrips
          .filter((trip: { completedAt: string | null }) => {
            if (!trip.completedAt) return false;
            const date = new Date(trip.completedAt);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          })
          .reduce((sum: number, trip: { driverEarning: number | null }) => sum + (trip.driverEarning || 0), 0);

        setData({
          totalEarnings,
          completedTrips: completedTrips.length,
          averagePerTrip: completedTrips.length > 0 ? totalEarnings / completedTrips.length : 0,
          thisMonth,
          recentTrips: completedTrips.slice(0, 10),
        });
      }
    } catch (error) {
      console.error("Error fetching earnings:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Loading earnings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Earnings</h1>
        <p className="text-muted text-sm mt-1">Track your trip earnings</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value text-secondary">GHS {data.totalEarnings.toFixed(2)}</div>
          <div className="stat-label">Total Earnings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-primary">{data.completedTrips}</div>
          <div className="stat-label">Completed Trips</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-accent">GHS {data.averagePerTrip.toFixed(2)}</div>
          <div className="stat-label">Average Per Trip</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">GHS {data.thisMonth.toFixed(2)}</div>
          <div className="stat-label">This Month</div>
        </div>
      </div>

      {/* Recent Earnings */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Recent Earnings</h2>
        {data.recentTrips.length === 0 ? (
          <p className="text-muted text-center py-4">No completed trips yet.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Earning</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTrips.map((trip) => (
                  <tr key={trip.id}>
                    <td className="text-sm">
                      {trip.request.pickupAddress} → {trip.request.destAddress}
                    </td>
                    <td className="font-medium text-secondary">
                      +GHS {trip.driverEarning?.toFixed(2) || "0.00"}
                    </td>
                    <td className="text-sm text-muted">
                      {trip.completedAt ? new Date(trip.completedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}