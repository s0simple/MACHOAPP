"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Request {
  id: string;
  pickupAddress: string;
  destAddress: string;
  goodsType: string;
  weight: number;
  status: string;
  estimatedPrice: number | null;
  distance: number | null;
  createdAt: string;
  trip: {
    id: string;
    status: string;
    driver: { user: { name: string } };
    vehicle: { make: string; model: string; registrationNumber: string };
  } | null;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await fetch("/api/requests");
        if (response.ok) {
          const data = await response.json();
          setRequests(Array.isArray(data.requests) ? data.requests : []);
        }
      } catch (error) {
        console.error("Error fetching requests:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  const filteredRequests =
    filter === "all" ? requests : requests.filter((r) => r.status === filter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="badge badge-warning">Pending</span>;
      case "matched":
        return <span className="badge badge-info">Matched</span>;
      case "accepted":
        return <span className="badge badge-info">Accepted</span>;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Requests</h1>
          <p className="text-muted text-sm mt-1">
            View and manage your transportation requests
          </p>
        </div>
        <Link href="/dashboard/new-request" className="btn btn-primary">
          New Request
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          "all",
          "pending",
          "accepted",
          "in_progress",
          "completed",
          "cancelled",
        ].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === status
                ? "bg-primary text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {status === "all"
              ? "All"
              : status
                  .replace("_", " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="card text-center py-8">
          <p className="text-muted">Loading requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-muted mb-4">No requests found.</p>
          <Link
            href="/dashboard/new-request"
            className="btn btn-primary btn-sm"
          >
            Create Request
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <div key={request.id} className="card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusBadge(request.status)}
                    <span className="text-xs text-muted">
                      {request.goodsType}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-foreground font-medium">
                      {request.pickupAddress}
                    </span>
                    <span className="text-muted mx-2">→</span>
                    <span className="text-foreground font-medium">
                      {request.destAddress}
                    </span>
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {request.weight}kg
                    {request.distance && ` • ${request.distance}km`}
                    {request.trip &&
                      ` • Driver: ${request.trip.driver.user.name}`}
                  </div>
                </div>
                <div className="text-right">
                  {request.estimatedPrice && (
                    <div className="font-bold text-primary">
                      GHS {request.estimatedPrice.toFixed(2)}
                    </div>
                  )}
                  <div className="text-xs text-muted mt-1">
                    {new Date(request.createdAt).toLocaleDateString()}
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
