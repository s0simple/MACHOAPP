"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { SelectedPlace } from "@/lib/request-form-types";

interface MapViewProps {
  pickup: SelectedPlace | null;
  dest: SelectedPlace | null;
  height?: number;
}

const PICKUP_COLOR = "#2563eb";
const DEST_COLOR = "#059669";

/**
 * Static SVG drop-pin so we do not depend on Leaflet's default PNG assets
 * (which usually 404 when bundled) and never interpolate user data into HTML.
 * Popups use textContent below, so addresses from OSM/Nominatim are safe.
 */
function createPin(color: string): L.DivIcon {
  const html = `<svg width="30" height="36" viewBox="0 0 30 36" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))"><path d="M15 0C6.7 0 0 6.7 0 15c0 11.2 15 21 15 21s15-9.8 15-21C30 6.7 23.3 0 15 0z" fill="${color}"/><circle cx="15" cy="15" r="5.2" fill="#fff"/></svg>`;
  return L.divIcon({
    className: "",
    html,
    iconSize: [30, 36],
    iconAnchor: [15, 34],
    popupAnchor: [0, -32],
  });
}

function plainPopup(title: string, label: string): HTMLElement {
  const el = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = title;
  el.appendChild(strong);
  const span = document.createElement("span");
  span.style.display = "block";
  span.style.maxWidth = "220px";
  span.textContent = label;
  el.appendChild(span);
  return el;
}

/**
 * Lightweight Leaflet + OSM map showing pickup/destination markers and, when
 * both are chosen, a straight polyline between them as a visual aid. Loaded
 * exclusively on the client (see RequestMap.tsx) because Leaflet touches the
 * DOM.
 */
export default function MapView({ pickup, dest, height = 300 }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ pickup?: L.Marker; dest?: L.Marker; line?: L.Polyline }>({});
  const pickupIconRef = useRef<L.DivIcon | null>(null);
  const destIconRef = useRef<L.DivIcon | null>(null);

  // Create/destroy the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    pickupIconRef.current = createPin(PICKUP_COLOR);
    destIconRef.current = createPin(DEST_COLOR);

    // Default to Ghana (Accra) until a location is picked.
    const map = L.map(containerRef.current, {
      center: [5.6037, -0.187],
      zoom: 12,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []);

  // Update markers + connecting line when the places change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const hasPickup = Boolean(pickup);
    const hasDest = Boolean(dest);

    if (!hasPickup && markersRef.current.pickup) {
      markersRef.current.pickup.remove();
      markersRef.current.pickup = undefined;
    }
    if (!hasDest && markersRef.current.dest) {
      markersRef.current.dest.remove();
      markersRef.current.dest = undefined;
    }

    if (pickup && pickupIconRef.current) {
      const icon = pickupIconRef.current;
      const marker = markersRef.current.pickup ?? L.marker([pickup.lat, pickup.lng], { icon }).addTo(map);
      marker.setLatLng([pickup.lat, pickup.lng]);
      marker.bindPopup(() => plainPopup("Pickup", pickup.label));
      markersRef.current.pickup = marker;
    }

    if (dest && destIconRef.current) {
      const icon = destIconRef.current;
      const marker = markersRef.current.dest ?? L.marker([dest.lat, dest.lng], { icon }).addTo(map);
      marker.setLatLng([dest.lat, dest.lng]);
      marker.bindPopup(() => plainPopup("Destination", dest.label));
      markersRef.current.dest = marker;
    }

    // Redraw the connecting line when possible.
    if (markersRef.current.line) {
      markersRef.current.line.remove();
      markersRef.current.line = undefined;
    }
    if (pickup && dest) {
      const line = L.polyline(
        [
          [pickup.lat, pickup.lng],
          [dest.lat, dest.lng],
        ],
        { color: "#1e40af", dashArray: "6 6", weight: 3 }
      ).addTo(map);
      markersRef.current.line = line;
      map.fitBounds(line.getBounds(), { padding: [40, 40] });
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 14);
    } else if (dest) {
      map.setView([dest.lat, dest.lng], 14);
    }
  }, [pickup, dest]);

  return <div ref={containerRef} style={{ height }} className="w-full rounded-xl border border-border overflow-hidden" />;
}