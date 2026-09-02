"use client";

import { useEffect, useState } from "react";

interface Driver {
  id: string;
  phone: string | null;
  licenseNumber: string | null;
  isAvailable: boolean;
  isApproved: boolean;
  rating: number;
  totalTrips: number;
  createdAt: string;
  user: { name: string; email: string; createdAt: string };
  vehicles: { id: string; make: string; model: string; registrationNumber: string; status: string; isVerified: boolean }[];
  _count?: { trips: number };
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");

  useEffect(() => {
    fetchDrivers();
  }, [filter]);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const query = filter === "all" ? "" : `?status=${filter}`;
      const response = await fetch(`/api/admin/drivers${query}`);
      if (response.ok) {
        const data = await response.json();
        setDrivers(data.drivers);
      }
    } catch (error) {
      console.error("Error fetching drivers:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleApproval = async (driverId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/drivers/${driverId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: !currentStatus }),
      });
      if (response.ok) {
        setDrivers((prev) =>
          prev.map((d) => (d.id === driverId ? { ...d, isApproved: !currentStatus } : d))
        );
      }
    } catch (error) {
      console.error("Error toggling approval:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manage Drivers</h1>
        <p className="text-muted text-sm mt-1">View and approve driver accounts</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "pending", "approved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-outline"}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card text-center py-8">
          <p className="text-muted">Loading drivers...</p>
        </div>
      ) : drivers.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-muted">No drivers found.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Driver</th>
                <th>License</th>
                <th>Rating</th>
                <th>Trips</th>
                <th>Vehicles</th>
                <th>Availability</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td>
                    <div>
                      <div className="font-medium">{driver.user.name}</div>
                      <div className="text-xs text-muted">{driver.user.email}</div>
                    </div>
                  </td>
                  <td className="text-sm">{driver.licenseNumber || "—"}</td>
                  <td className="text-sm">⭐ {driver.rating.toFixed(1)}</td>
                  <td className="text-sm">{driver._count?.trips ?? driver.totalTrips}</td>
                  <td className="text-sm">{driver.vehicles?.length ?? 0}</td>
                  <td>
                    {driver.isAvailable ? (
                      <span className="badge badge-success">Available</span>
                    ) : (
                      <span className="badge badge-muted">Busy</span>
                    )}
                  </td>
                  <td>
                    {driver.isApproved ? (
                      <span className="badge badge-success">Approved</span>
                    ) : (
                      <span className="badge badge-warning">Pending</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => toggleApproval(driver.id, driver.isApproved)}
                      className={`btn btn-sm ${driver.isApproved ? "btn-danger" : "btn-primary"}`}
                    >
                      {driver.isApproved ? "Suspend" : "Approve"}
                    </button>
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