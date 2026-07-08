"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { ASSET_CATALOG } from "@/lib/economy";

const MAP_SIZE = 8192;

/**
 * The real Southern San Andreas map with property blips.
 * Unowned locations sit dimmed; owned ones light up; producing businesses pulse.
 */
export function LosSantosMap({
  ownedIds,
  producing,
}: {
  ownedIds: string[];
  producing: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const owned = new Set(ownedIds);
      const producingSet = new Set(producing);

      const map = L.map(containerRef.current, {
        crs: L.CRS.Simple,
        minZoom: -4,
        maxZoom: 0,
        zoomSnap: 0.25,
        attributionControl: false,
        zoomControl: true,
      });
      mapRef.current = map;

      const bounds = L.latLngBounds([
        [-MAP_SIZE, 0],
        [0, MAP_SIZE],
      ]);
      L.imageOverlay("/map/los-santos.jpg", bounds).addTo(map);
      map.setMaxBounds(bounds.pad(0.05));

      const markerBounds: [number, number][] = [];
      for (const def of ASSET_CATALOG) {
        if (!def.map) continue;
        const isOwned = owned.has(def.id);
        const isProducing = producingSet.has(def.id);
        const cls = isProducing ? "blip blip-producing" : isOwned ? "blip" : "blip blip-locked";
        const icon = L.divIcon({
          className: "blip-wrap",
          html: `<img src="/map/blips/${def.map.blip}.png" class="${cls}" width="26" height="26" alt="" />`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        const pos: [number, number] = [-def.map.y, def.map.x];
        const status = isProducing
          ? '<span style="color:#9dfb53">PRODUCING</span>'
          : isOwned
            ? '<span style="color:#e8b71a">OWNED</span>'
            : `<span style="color:#8b949e">FOR SALE · $${def.price.toLocaleString("en-US")}</span>`;
        L.marker(pos, { icon })
          .addTo(map)
          .bindPopup(
            `<div class="blip-popup"><strong>${def.name}</strong><br/>${def.tagline}<br/>${status}</div>`
          );
        if (isOwned) markerBounds.push(pos);
      }

      // Frame the city (bottom half of the state) by default.
      map.fitBounds(
        markerBounds.length >= 2
          ? L.latLngBounds(markerBounds).pad(0.4)
          : L.latLngBounds([
              [-7600, 1500],
              [-5200, 5400],
            ])
      );
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Map is initialized once; ownership changes re-render via key on the server side.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overflow-hidden rounded border border-line">
      <div ref={containerRef} className="h-[440px] w-full bg-[#143d5c]" />
    </div>
  );
}
