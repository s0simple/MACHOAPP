"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import type {
  AdminDashboardData,
  DriverDashboardData,
  PassengerDashboardData,
} from "@/lib/dashboard-types";

// Safe monetary formatting — never calls toFixed on undefined/null/Decimal.
function formatMoney(value: number | null | undefined): string {
  return `GHS ${Number(value ?? 0).toFixed(2)}`;
}

export default function DashboardPage() {
  const { data: session } = useSession();

  // Role detection via the existing Better Auth session.
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  const [dashboardData, setDashboardData] = useState<PassengerDashboardData | DriverDashboardData | AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/dashboard/stats");
        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="badge badge-warning">Pending</span>;
      case "matched":
        return <span className="badge badge-info">Matched</span>;
      case "accepted":
        return <span className="badge badge-info">Accepted</span>;
      case "assigned":
        return <span className="badge badge-info">Assigned</span>;
      case "in_transit":
      case "in_progress":
        return <span className="badge badge-success">In Progress</span>;
      case "completed":
        return <span className="badge badge-success">Completed</span>;
      case "cancelled":
        return <span className="badge badge-danger">Cancelled</span>;
      default:
        return <span className="badge badge-muted">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Loading dashboard...</div>
      </div>
    );
  }

  // Header action: drivers get the Availability Toggle, passengers get the
  // New Request button, admins get neither.
  const headerAction =
    userRole === "driver" ? (
      <AvailabilityToggle />
    ) : userRole === "admin" ? null : (
      <Link href="/dashboard/new-request" className="btn btn-primary">
        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New Request
      </Link>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted text-sm mt-1">
            {userRole === "admin"
              ? "Platform-wide transportation overview"
              : userRole === "driver"
                ? "Overview of your trips and earnings"
                : "Overview of your transportation activity"}
          </p>
        </div>
        {headerAction}
      </div>

      {/* Role-specific stats */}
      {dashboardData?.role === "passenger" && <PassengerStatsCards stats={dashboardData.stats} />}
      {dashboardData?.role === "driver" && <DriverStatsCards stats={dashboardData.stats} />}
      {dashboardData?.role === "admin" && <AdminStatsCards stats={dashboardData.stats} />}

      {/* Role-specific recent activity */}
      {dashboardData?.role === "passenger" && (
        <PassengerRecentRequests
          requests={dashboardData.recentRequests}
          getStatusBadge={getStatusBadge}
        />
      )}
      {dashboardData?.role === "driver" && (
        <DriverRecentTrips
          trips={dashboardData.recentRequests}
          getStatusBadge={getStatusBadge}
        />
      )}
      {dashboardData?.role === "admin" && (
        <AdminRecentRequests
          requests={dashboardData.recentRequests}
          getStatusBadge={getStatusBadge}
        />
      )}
    </div>
  );
}

/* ------------------------------ Passenger ------------------------------ */

function PassengerStatsCards({ stats }: { stats: PassengerDashboardData["stats"] }) {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-value text-primary">{stats.totalRequests}</div>
        <div className="stat-label">Total Requests</div>
      </div>
      <div className="stat-card">
        <div className="stat-value text-secondary">{stats.activeTrips}</div>
        <div className="stat-label">Active Trips</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{stats.completedTrips}</div>
        <div className="stat-label">Completed Trips</div>
      </div>
      <div className="stat-card">
        <div className="stat-value text-accent">{formatMoney(stats.totalSpent)}</div>
        <div className="stat-label">Total Spent</div>
      </div>
    </div>
  );
}

function PassengerRecentRequests({
  requests,
  getStatusBadge,
}: {
  requests: PassengerDashboardData["recentRequests"];
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Recent Requests</h2>
        <Link href="/dashboard/requests" className="text-primary text-sm font-medium hover:underline">
          View all
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted mb-4">No requests yet. Create your first one below.</p>
          <Link href="/dashboard/new-request" className="btn btn-primary btn-sm">
            Create Your First Request
          </Link>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Route</th>
                <th>Status</th>
                <th>Price</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <div className="text-sm">
                      <span className="text-foreground">{request.pickupAddress}</span>
                      <span className="text-muted mx-2">→</span>
                      <span className="text-foreground">{request.destAddress}</span>
                    </div>
                  </td>
                  <td>{getStatusBadge(request.status)}</td>
                  <td className="text-sm">
                    {request.estimatedPrice !== null
                      ? formatMoney(request.estimatedPrice)
                      : "—"}
                  </td>
                  <td className="text-sm text-muted">
                    {new Date(request.createdAt).toLocaleDateString()}
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

/* ------------------------------- Driver -------------------------------- */

function DriverStatsCards({ stats }: { stats: DriverDashboardData["stats"] }) {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-value text-primary">{stats.totalTrips}</div>
        <div className="stat-label">Total Trips</div>
      </div>
      <div className="stat-card">
        <div className="stat-value text-secondary">{stats.activeTrips}</div>
        <div className="stat-label">Active Trips</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{stats.completedTrips}</div>
        <div className="stat-label">Completed Trips</div>
      </div>
      <div className="stat-card">
        <div className="stat-value text-accent">{formatMoney(stats.totalEarnings)}</div>
        <div className="stat-label">Total Earnings</div>
      </div>
    </div>
  );
}

function DriverRecentTrips({
  trips,
  getStatusBadge,
}: {
  trips: DriverDashboardData["recentRequests"];
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Recent Trips</h2>
        <Link href="/dashboard/my-trips" className="text-primary text-sm font-medium hover:underline">
          View all
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted mb-4">No trips yet. Browse available requests below.</p>
          <Link href="/dashboard/available-requests" className="btn btn-primary btn-sm">
            Browse Available Requests
          </Link>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Route</th>
                <th>Status</th>
                <th>Earnings</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.id}>
                  <td>
                    <div className="text-sm">
                      <span className="text-foreground">{trip.pickupAddress}</span>
                      <span className="text-muted mx-2">→</span>
                      <span className="text-foreground">{trip.destAddress}</span>
                    </div>
                  </td>
                  <td>{getStatusBadge(trip.status)}</td>
                  <td className="text-sm">
                    {trip.driverEarning !== null
                      ? formatMoney(trip.driverEarning)
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

/* -------------------------------- Admin -------------------------------- */

function AdminStatsCards({ stats }: { stats: AdminDashboardData["stats"] }) {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-value text-primary">{stats.totalDrivers}</div>
        <div className="stat-label">Total Drivers</div>
      </div>
      <div className="stat-card">
        <div className="stat-value text-secondary">{stats.totalPassengers}</div>
        <div className="stat-label">Total Passengers</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{stats.totalVehicles}</div>
        <div className="stat-label">Total Vehicles</div>
      </div>
      <div className="stat-card">
        <div className="stat-value text-accent">{formatMoney(stats.totalRevenue)}</div>
        <div className="stat-label">Total Revenue</div>
      </div>
    </div>
  );
}

function AdminRecentRequests({
  requests,
  getStatusBadge,
}: {
  requests: AdminDashboardData["recentRequests"];
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Recent Requests</h2>
        <Link href="/dashboard/requests" className="text-primary text-sm font-medium hover:underline">
          View all
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted">No transportation requests on the platform yet.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Route</th>
                <th>Passenger</th>
                <th>Status</th>
                <th>Price</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <div className="text-sm">
                      <span className="text-foreground">{request.pickupAddress}</span>
                      <span className="text-muted mx-2">→</span>
                      <span className="text-foreground">{request.destAddress}</span>
                    </div>
                  </td>
                  <td className="text-sm">{request.passengerName ?? "—"}</td>
                  <td>{getStatusBadge(request.status)}</td>
                  <td className="text-sm">
                    {request.estimatedPrice !== null
                      ? formatMoney(request.estimatedPrice)
                      : "—"}
                  </td>
                  <td className="text-sm text-muted">
                    {new Date(request.createdAt).toLocaleDateString()}
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

/* --------------------------- Availability toggle ------------------------ */

function AvailabilityToggle() {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isApproved, setIsApproved] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch("/api/driver/availability")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setIsAvailable(data.isAvailable);
          setIsApproved(data.isApproved);
        }
      })
      .catch(() => setIsAvailable(null));
  }, []);

  const toggle = async () => {
    if (isAvailable === null || updating) return;
    setUpdating(true);
    try {
      const response = await fetch("/api/driver/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !isAvailable }),
      });
      if (response.ok) {
        const data = await response.json();
        setIsAvailable(data.isAvailable);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update availability");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setUpdating(false);
    }
  };

  if (isAvailable === null) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted">Availability</span>
      <button
        onClick={toggle}
        disabled={updating || !isApproved}
        className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${
          isAvailable ? "bg-secondary" : "bg-border"
        } ${!isApproved ? "opacity-50 cursor-not-allowed" : ""}`}
        title={isAvailable ? "You are visible to passengers" : "You are hidden from new requests"}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            isAvailable ? "translate-x-8" : "translate-x-1"
          }`}
        />
      </button>
      <span className={`badge ${isAvailable ? "badge-success" : "badge-muted"}`}>
        {isAvailable ? "Available" : "Unavailable"}
      </span>
    </div>
  );
}