"use client";

import { useEffect, useState } from "react";

interface ReportData {
  totalDrivers: number;
  totalPassengers: number;
  totalVehicles: number;
  activeTrips: number;
  completedTrips: number;
  pendingRequests: number;
  totalRevenue: number;
  vehicleTypeDistribution: { name: string; count: number }[];
  requestStatusDistribution: { status: string; count: number }[];
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData>({
    totalDrivers: 0,
    totalPassengers: 0,
    totalVehicles: 0,
    activeTrips: 0,
    completedTrips: 0,
    pendingRequests: 0,
    totalRevenue: 0,
    vehicleTypeDistribution: [],
    requestStatusDistribution: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch("/api/admin/reports");
      if (response.ok) {
        const result = await response.json();
        setData({
          totalDrivers: result.overview?.totalDrivers ?? 0,
          totalPassengers: result.overview?.totalPassengers ?? 0,
          totalVehicles: result.overview?.totalVehicles ?? 0,
          activeTrips: result.trips?.active ?? 0,
          completedTrips: result.trips?.completed ?? 0,
          pendingRequests: result.requests?.pending ?? 0,
          totalRevenue: result.revenue?.total ?? 0,
          vehicleTypeDistribution: result.distributions?.vehicleTypes ?? [],
          requestStatusDistribution: result.distributions?.requestStatuses ?? [],
        });
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-muted text-sm mt-1">System-wide transportation statistics</p>
      </div>

      {/* Overview Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value text-primary">{data.totalDrivers}</div>
          <div className="stat-label">Total Drivers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-secondary">{data.totalPassengers}</div>
          <div className="stat-label">Total Passengers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.totalVehicles}</div>
          <div className="stat-label">Total Vehicles</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-accent">{data.activeTrips}</div>
          <div className="stat-label">Active Trips</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.completedTrips}</div>
          <div className="stat-label">Completed Trips</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-danger">{data.pendingRequests}</div>
          <div className="stat-label">Pending Requests</div>
        </div>
      </div>

      {/* Revenue */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-2">Revenue</h2>
        <div className="text-3xl font-bold text-secondary">
          GHS {data.totalRevenue.toFixed(2)}
        </div>
        <p className="text-sm text-muted mt-1">Total revenue from completed trips</p>
      </div>

      {/* Distributions */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Vehicle Distribution</h2>
          {data.vehicleTypeDistribution.length === 0 ? (
            <p className="text-muted text-sm">No data available</p>
          ) : (
            <div className="space-y-3">
              {data.vehicleTypeDistribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="text-sm">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width: `${Math.min(100, (item.count / data.totalVehicles) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Request Status</h2>
          {data.requestStatusDistribution.length === 0 ? (
            <p className="text-muted text-sm">No data available</p>
          ) : (
            <div className="space-y-3">
              {data.requestStatusDistribution.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{item.status.replace("_", " ")}</span>
                  <span className="text-sm font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}