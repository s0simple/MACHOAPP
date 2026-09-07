"use client";

import dynamic from "next/dynamic";
import type { SelectedPlace } from "@/lib/request-form-types";

// Leaflet manipulates the DOM and must never run on the server. Wrapping the
// import with ssr:false (inside a Client Component) guarantees that.
const MapView = dynamic(() => import("./map/MapView"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-xl border border-border bg-surface flex items-center justify-center text-muted text-sm"
      style={{ height: 300 }}
    >
      Loading map...
    </div>
  ),
});

export default function RequestMap({
  pickup,
  dest,
  height = 300,
}: {
  pickup: SelectedPlace | null;
  dest: SelectedPlace | null;
  height?: number;
}) {
  return <MapView pickup={pickup} dest={dest} height={height} />;
}