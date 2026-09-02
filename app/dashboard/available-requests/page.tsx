"use client";

import { useEffect, useState } from "react";

interface AvailableRequest {
  id: string;
  pickupAddress: string;
  destAddress: string;
  goodsType: string;
  goodsDescription: string | null;
  weight: number;
  length: number | null;
  width: number | null;
  height: number | null;
  quantity: number;
  isFragile: boolean;
  needsRefrigeration: boolean;
  distance: number | null;
  estimatedPrice: number | null;
  status: string;
  createdAt: string;
  passenger: {
    user: { name: string; email: string };
  };
}

export default function AvailableRequestsPage() {
  const [requests, setRequests] = useState<AvailableRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch("/api/requests?status=pending");
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    setAccepting(requestId);
    try {
      const response = await fetch(`/api/requests/${requestId}/accept`, {
        method: "POST",
      });

      if (response.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      } else {
        const data = await response.json();
        alert(data.error || "Failed to accept request");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setAccepting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Available Requests</h1>
        <p className="text-muted text-sm mt-1">Transportation requests waiting for drivers</p>
      </div>

      {loading ? (
        <div className="card text-center py-8">
          <p className="text-muted">Loading available requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-muted">No available requests at the moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div key={request.id} className="card">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  {/* Route */}
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {request.pickupAddress} → {request.destAddress}
                    </div>
                    {request.distance && (
                      <span className="text-xs text-muted">{request.distance}km</span>
                    )}
                  </div>

                  {/* Goods Info */}
                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-info">{request.goodsType}</span>
                    <span className="badge badge-muted">{request.weight}kg</span>
                    {request.isFragile && <span className="badge badge-warning">Fragile</span>}
                    {request.needsRefrigeration && <span className="badge badge-info">Refrigerated</span>}
                  </div>

                  {/* Details */}
                  <div className="text-sm text-muted space-y-1">
                    {request.goodsDescription && <p>{request.goodsDescription}</p>}
                    {(request.length || request.width || request.height) && (
                      <p>
                        Dimensions: {request.length || "?"}m × {request.width || "?"}m × {request.height || "?"}m
                      </p>
                    )}
                    <p>Passenger: {request.passenger.user.name}</p>
                  </div>
                </div>

                {/* Price & Action */}
                <div className="text-right shrink-0">
                  {request.estimatedPrice && (
                    <div className="text-xl font-bold text-primary mb-1">
                      GHS {request.estimatedPrice.toFixed(2)}
                    </div>
                  )}
                  <div className="text-xs text-muted mb-3">
                    {new Date(request.createdAt).toLocaleString()}
                  </div>
                  <button
                    onClick={() => handleAccept(request.id)}
                    className="btn btn-primary btn-sm w-full"
                    disabled={accepting === request.id}
                  >
                    {accepting === request.id ? "Accepting..." : "Accept Request"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}