"use client";

import { useCallback, useEffect, useState } from "react";

interface MonthlyBucket {
  month: string;
  label: string;
  total: number;
  trips: number;
}

interface EarningsTrip {
  id: string;
  driverEarning: number | null;
  actualPrice: number | null;
  completedAt: string | null;
  request: { pickupAddress: string; destAddress: string };
}

interface EarningsResponse {
  range: { from: string; to: string };
  summary: {
    totalEarnings: number;
    completedTrips: number;
    averagePerTrip: number;
  };
  monthly: MonthlyBucket[];
  trips: EarningsTrip[];
}

function formatMoney(value: number): string {
  return `GHS ${value.toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** First day of the month 11 months ago (default range start). */
function defaultFrom(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 11);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Earnings for the current calendar month, derived from the monthly buckets. */
function thisMonthTotal(monthly: MonthlyBucket[]): number {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return monthly.find((m) => m.month === key)?.total ?? 0;
}

export default function EarningsPage() {
  const [from, setFrom] = useState<string>(defaultFrom());
  const [to, setTo] = useState<string>(today());
  const [applied, setApplied] = useState<{ from: string; to: string }>({ from: defaultFrom(), to: today() });

  const [summary, setSummary] = useState({ totalEarnings: 0, completedTrips: 0, averagePerTrip: 0 });
  const [monthly, setMonthly] = useState<MonthlyBucket[]>([]);
  const [trips, setTrips] = useState<EarningsTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEarnings = useCallback(async (range: { from: string; to: string }) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetch(`/api/driver/earnings?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "We could not load your earnings right now. Please try again.");
        return;
      }
      setSummary(data.summary ?? { totalEarnings: 0, completedTrips: 0, averagePerTrip: 0 });
      setMonthly(data.monthly ?? []);
      setTrips(data.trips ?? []);
    } catch {
      setError("We could not load your earnings right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEarnings(applied);
  }, [applied, fetchEarnings]);

  const applyRange = () => {
    if (!from || !to || from > to) {
      setError("Please choose a valid date range (From must be before To).");
      return;
    }
    setApplied({ from, to });
  };

  const resetRange = () => {
    const def = { from: defaultFrom(), to: today() };
    setFrom(def.from);
    setTo(def.to);
    setApplied(def);
  };

  // Quick presets.
  const setThisMonth = () => {
    const d = new Date();
    const f = new Date(d.getFullYear(), d.getMonth(), 1);
    const next = { from: f.toISOString().slice(0, 10), to: today() };
    setFrom(next.from);
    setTo(next.to);
    setApplied(next);
  };

  const setLastMonth = () => {
    const d = new Date();
    const f = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const t = new Date(d.getFullYear(), d.getMonth(), 0);
    const next = { from: f.toISOString().slice(0, 10), to: t.toISOString().slice(0, 10) };
    setFrom(next.from);
    setTo(next.to);
    setApplied(next);
  };

  const maxMonthly = Math.max(...monthly.map((m) => m.total), 0);

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
        <p className="text-muted text-sm mt-1">Track your trip earnings by month or custom period</p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 text-danger text-sm p-3">{error}</div>
      )}

      {/* Period filter */}
      <div className="card">
        <h2 className="font-semibold mb-3">Period</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">From</label>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} className="input" />
          </div>
          <button onClick={applyRange} className="btn btn-primary">Apply</button>
          <button onClick={resetRange} className="btn btn-outline">Reset</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={setThisMonth} className="btn btn-outline btn-sm">This month</button>
          <button onClick={setLastMonth} className="btn btn-outline btn-sm">Last month</button>
          <button onClick={() => setApplied({ from: defaultFrom(), to: today() })} className="btn btn-outline btn-sm">Last 12 months</button>
        </div>
        <p className="text-xs text-muted mt-3">
          Showing completed trips from {formatDate(applied.from)} to {formatDate(applied.to)}.
        </p>
      </div>

      {/* Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value text-secondary">{formatMoney(summary.totalEarnings)}</div>
          <div className="stat-label">Total Earnings (period)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-primary">{summary.completedTrips}</div>
          <div className="stat-label">Completed Trips</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-accent">{formatMoney(summary.averagePerTrip)}</div>
          <div className="stat-label">Average Per Trip</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatMoney(thisMonthTotal(monthly))}</div>
          <div className="stat-label">This Month</div>
        </div>
      </div>

      {/* Monthly breakdown */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Monthly Earnings (last 12 months)</h2>
        {monthly.every((m) => m.trips === 0) ? (
          <p className="text-muted text-center py-4">No completed trips in the last 12 months.</p>
        ) : (
          <div className="space-y-2">
            {monthly.map((m) => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="text-xs text-muted w-20 shrink-0">{m.label}</span>
                <div className="flex-1 h-6 bg-surface rounded-md overflow-hidden border border-border">
                  <div
                    className="h-full bg-primary/70 rounded-md"
                    style={{ width: maxMonthly > 0 ? `${Math.max((m.total / maxMonthly) * 100, m.trips > 0 ? 2 : 0)}%` : "0%" }}
                  />
                </div>
                <span className="text-sm font-medium w-28 text-right shrink-0">{formatMoney(m.total)}</span>
                <span className="text-xs text-muted w-16 text-right shrink-0">{m.trips} {m.trips === 1 ? "trip" : "trips"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trips in period */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Trips in Selected Period</h2>
        {trips.length === 0 ? (
          <p className="text-muted text-center py-4">No completed trips in this period.</p>
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
                {trips.map((trip) => (
                  <tr key={trip.id}>
                    <td className="text-sm">
                      {trip.request.pickupAddress} → {trip.request.destAddress}
                    </td>
                    <td className="font-medium text-secondary">
                      +{formatMoney(Number(trip.driverEarning ?? 0))}
                    </td>
                    <td className="text-sm text-muted">{formatDate(trip.completedAt)}</td>
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
