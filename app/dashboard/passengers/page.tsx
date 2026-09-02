"use client";

import { useEffect, useState } from "react";

interface Passenger {
  id: string;
  phone: string | null;
  createdAt: string;
  user: { name: string; email: string; createdAt: string };
  _count?: { requests: number };
}

export default function PassengersPage() {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPassengers();
  }, []);

  const fetchPassengers = async () => {
    try {
      const response = await fetch("/api/admin/passengers");
      if (response.ok) {
        const data = await response.json();
        setPassengers(data.passengers);
      }
    } catch (error) {
      console.error("Error fetching passengers:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manage Passengers</h1>
        <p className="text-muted text-sm mt-1">View registered passengers</p>
      </div>

      {loading ? (
        <div className="card text-center py-8">
          <p className="text-muted">Loading passengers...</p>
        </div>
      ) : passengers.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-muted">No passengers registered yet.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Passenger</th>
                <th>Phone</th>
                <th>Requests</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {passengers.map((passenger) => (
                <tr key={passenger.id}>
                  <td>
                    <div>
                      <div className="font-medium">{passenger.user.name}</div>
                      <div className="text-xs text-muted">{passenger.user.email}</div>
                    </div>
                  </td>
                  <td className="text-sm">{passenger.phone || "—"}</td>
                  <td className="text-sm">{passenger._count?.requests ?? 0}</td>
                  <td className="text-sm text-muted">
                    {new Date(passenger.createdAt).toLocaleDateString()}
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