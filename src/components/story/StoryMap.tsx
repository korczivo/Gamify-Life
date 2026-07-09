"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { PROTAGONIST_COLORS, type MissionProgress } from "@/lib/story/progress";

const MAP_SIZE = 8192;

function iconHtml(mp: MissionProgress, selected: boolean, hovered: boolean) {
  const color = PROTAGONIST_COLORS[mp.mission.protagonist] ?? "#9aa4af";
  const cls = ["story-badge", mp.status];
  if (selected) cls.push("selected");
  else if (hovered) cls.push("hovered");
  const label =
    mp.status === "done" ? "✓" : mp.status === "locked" ? "🔒" : String(mp.mission.order);
  return `<div class="${cls.join(" ")}" style="--c:${color}">${label}</div>`;
}

/**
 * The full Los Santos map as the centre of the story page. Blips are the 13
 * Act 1 missions, coloured by protagonist and shaped by status. Selecting one
 * flies the camera to it and rings it; the map is created once and its markers
 * are updated in place so zoom/pan survive every checkbox tick.
 */
export function StoryMap({
  missions,
  selectedId,
  hoveredId,
  onSelect,
}: {
  missions: MissionProgress[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Record<string, import("leaflet").Marker>>({});
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const missionsRef = useRef(missions);
  missionsRef.current = missions;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const prevSelected = useRef<string | null>(null);

  // Create the map + markers exactly once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(containerRef.current, {
        crs: L.CRS.Simple,
        minZoom: -4,
        maxZoom: 1,
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

      for (const mp of missionsRef.current) {
        const pos: [number, number] = [-mp.mission.map.y, mp.mission.map.x];
        const marker = L.marker(pos, {
          icon: L.divIcon({
            className: "story-blip-wrap",
            html: iconHtml(mp, mp.mission.id === selectedId, false),
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
          title: `${mp.mission.order}. ${mp.mission.title}`,
        });
        marker.on("click", () => onSelectRef.current(mp.mission.id));
        marker.addTo(map);
        markersRef.current[mp.mission.id] = marker;
      }

      // Frame the city (where most of Act 1 happens).
      map.fitBounds(
        L.latLngBounds([
          [-7200, 1600],
          [-5400, 5200],
        ])
      );
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repaint markers on status / selection / hover change; fly to a new selection.
  useEffect(() => {
    const L = LRef.current;
    if (!L) return;
    for (const mp of missions) {
      const marker = markersRef.current[mp.mission.id];
      if (!marker) continue;
      marker.setIcon(
        L.divIcon({
          className: "story-blip-wrap",
          html: iconHtml(mp, mp.mission.id === selectedId, mp.mission.id === hoveredId),
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        })
      );
    }
    if (selectedId && selectedId !== prevSelected.current && mapRef.current) {
      const mp = missions.find((x) => x.mission.id === selectedId);
      if (mp) {
        mapRef.current.flyTo(
          [-mp.mission.map.y, mp.mission.map.x],
          Math.max(mapRef.current.getZoom(), -1),
          { duration: 0.6 }
        );
      }
    }
    prevSelected.current = selectedId;
  }, [missions, selectedId, hoveredId]);

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div
        ref={containerRef}
        className="h-[74vh] min-h-[520px] w-full bg-[#0e2a40]"
      />
    </div>
  );
}
