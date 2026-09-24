"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CANCELLATION_REASONS, MAX_CANCELLATION_NOTE_LENGTH } from "@/lib/constants";

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
    // Phone is only populated by the API while the trip is active.
    driver: { phone: string | null; user: { name: string } };
    vehicle: { make: string; model: string; registrationNumber: string };
  } | null;
}

// Safe monetary formatting — never calls toFixed on undefined/null/Decimal.
function formatMoney(value: number | null | undefined): string {
  return `GHS ${Number(value ?? 0).toFixed(2)}`;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  // Cancellation modal state.
  const [cancelTarget, setCancelTarget] = useState<Request | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelNote, setCancelNote] = useState<string>("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

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

  const openCancel = (request: Request) => {
    setCancelTarget(request);
    setCancelReason("");
    setCancelNote("");
    setCancelError(null);
  };

  const closeCancel = () => {
    if (cancelling) return;
    setCancelTarget(null);
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;
    // A reason is required (like Uber); "Other" also expects a short note.
    if (!cancelReason) {
      setCancelError("Please choose a reason for cancelling.");
      return;
    }
    if (cancelReason === "Other" && !cancelNote.trim()) {
      setCancelError("Please add a short note explaining why.");
      return;
    }

    setCancelling(true);
    setCancelError(null);
    try {
      const response = await fetch(`/api/requests/${cancelTarget.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason, note: cancelNote.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        const updated = data.request as Request | undefined;
        // Reflect the cancellation locally; keep the trip info we already had.
        setRequests((prev) =>
          prev.map((r) =>
            r.id === cancelTarget.id
              ? { ...r, ...(updated ?? {}), status: "cancelled" }
              : r
          )
        );
        setCancelTarget(null);
      } else {
        const data = await response.json().catch(() => null);
        setCancelError(data?.error || "Failed to cancel request");
      }
    } catch {
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

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
          {filteredRequests.map((request) => {
            const driverPhone = request.trip?.driver?.phone ?? null;
            return (
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
                    {driverPhone && (
                      <a
                        href={`tel:${driverPhone.replace(/[^0-9+]/g, "")}`}
                        className="text-primary text-xs font-medium hover:underline inline-flex items-center gap-1 mt-1"
                        title={`Call ${request.trip?.driver.user.name}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                          />
                        </svg>
                        Call {driverPhone}
                      </a>
                    )}
                  </div>
                  <div className="text-right">
                    {request.estimatedPrice != null && (
                      <div className="font-bold text-primary">
                        {formatMoney(request.estimatedPrice)}
                      </div>
                    )}
                    <div className="text-xs text-muted mt-1">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </div>
                    {request.status === "pending" && (
                      <button
                        onClick={() => openCancel(request)}
                        className="btn btn-outline btn-sm mt-2 w-full"
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation reason modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-lg font-bold mb-1">Cancel this request?</h2>
            <p className="text-sm text-muted mb-4">
              This order hasn't been accepted by a driver yet, so you can
              still cancel it. Tell us why so we can improve.
            </p>

            {cancelError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-3 text-sm">
                {cancelError}
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {CANCELLATION_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    cancelReason === reason
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-surface"
                  }`}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    value={reason}
                    checked={cancelReason === reason}
                    onChange={() => {
                      setCancelReason(reason);
                      setCancelError(null);
                    }}
                    className="accent-[var(--primary)]"
                  />
                  <span className="text-sm font-medium">{reason}</span>
                </label>
              ))}
            </div>

            {(cancelReason === "Other" || cancelNote) && (
              <textarea
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                maxLength={MAX_CANCELLATION_NOTE_LENGTH}
                className="input mt-3 min-h-[72px]"
                placeholder={
                  cancelReason === "Other"
                    ? "Tell us more (required)"
                    : "Add a note (optional)"
                }
              />
            )}

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={closeCancel}
                disabled={cancelling}
                className="btn btn-outline"
              >
                Keep Request
              </button>
              <button
                onClick={() => void submitCancel()}
                disabled={cancelling}
                className="btn btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelling ? "Cancelling..." : "Cancel Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}