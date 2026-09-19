import { useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { LocateFixed, Maximize2, Minus, Plus } from 'lucide-react';
import type {
  UnitTelemetry,
  Survivor,
  Waypoint,
  GeofencePoint,
  ScoutSurvivorDetection,
  RoverVerificationMission,
} from '@/types';
import {
  UNIT_CONFIG,
  distance,
  mapToLatLng,
  latLngToMap,
} from '@/lib/constants';

interface TacticalMapProps {
  telemetry: UnitTelemetry[];
  survivors: Survivor[];
  scoutDetections: ScoutSurvivorDetection[];
  roverVerificationMission?: RoverVerificationMission | null;
  onVerifyWithRover?: (detection: ScoutSurvivorDetection) => void;
  waypoints: Waypoint[];
  geofence: GeofencePoint[];
  obstacles: { x: number; y: number; w: number; h: number }[];
  missionActive: boolean;
  planningMode: boolean;
  onWaypointAdd?: (latitude: number, longitude: number, altitude?: number) => void;
  onWaypointRemove?: (index: number) => void;
  onGeofenceChange?: (points: GeofencePoint[]) => void;
  geofenceEditing?: boolean;
  selectedUnit: string;
  elapsed: number;
}

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];
const DEFAULT_ZOOM = 13;

function getUnitPosition(unit: UnitTelemetry): [number, number] {
  const gpsLat = Number.parseFloat(unit.gpsLat);
  const gpsLng = Number.parseFloat(unit.gpsLng);

  if (Number.isFinite(gpsLat) && Number.isFinite(gpsLng)) {
    return [gpsLat, gpsLng];
  }

  const fallback = mapToLatLng(unit.x, unit.y);
  return [fallback.lat, fallback.lng];
}

function getWaypointPosition(waypoint: Waypoint): [number, number] {
  if (typeof waypoint.latitude === 'number' && typeof waypoint.longitude === 'number' && Number.isFinite(waypoint.latitude) && Number.isFinite(waypoint.longitude)) {
    return [waypoint.latitude, waypoint.longitude];
  }

  const fallback = mapToLatLng(waypoint.x, waypoint.y);
  return [fallback.lat, fallback.lng];
}

function createVehicleIcon(color: string, type: 'drone' | 'rover', heading: number) {
  const svg = type === 'drone'
    ? `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${heading}deg); transform-origin: 50% 50%;">
        <g>
          <line x1="16" y1="4" x2="16" y2="9" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <line x1="16" y1="23" x2="16" y2="28" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <line x1="6" y1="10" x2="11" y2="15" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <line x1="26" y1="10" x2="21" y2="15" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <line x1="6" y1="22" x2="11" y2="17" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <line x1="26" y1="22" x2="21" y2="17" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <path d="M10 16L16 10L22 16L16 22Z" fill="${color}" stroke="#0a0e14" stroke-width="1.5"/>
          <circle cx="16" cy="16" r="3" fill="#e2e8f0"/>
        </g>
      </svg>
    `
    : `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${heading}deg); transform-origin: 50% 50%;">
        <g>
          <path d="M7 18L11 10H21L25 18L21 23H11L7 18Z" fill="${color}" stroke="#081017" stroke-width="1.5"/>
          <rect x="9" y="13" width="14" height="5" fill="#081017"/>
          <circle cx="11" cy="24" r="3" fill="${color}"/>
          <circle cx="21" cy="24" r="3" fill="${color}"/>
          <path d="M23 16H29" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"/>
        </g>
      </svg>
    `;

  return L.divIcon({
    className: 'leaflet-custom-marker',
    html: svg,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function createWaypointIcon(color: string) {
  return L.divIcon({
    className: 'leaflet-custom-marker',
    html: `<div style="width:14px;height:14px;border-radius:9999px;border:2px solid rgba(15,23,42,0.95);background:${color};box-shadow:0 0 0 3px rgba(255,255,255,0.1);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

function createDetectionIcon(color: string) {
  return L.divIcon({
    className: 'leaflet-custom-marker',
    html: `<div style="width:18px;height:18px;transform:rotate(45deg);border:2px solid ${color};background:rgba(255,255,255,0.15);box-shadow:0 0 0 3px rgba(168,85,247,0.18);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

function MapClickHandler({
  planningMode,
  geofenceEditing,
  geofence,
  onWaypointAdd,
  onWaypointRemove,
  onGeofenceChange,
  waypoints,
}: Pick<TacticalMapProps, 'planningMode' | 'geofenceEditing' | 'geofence' | 'onWaypointAdd' | 'onWaypointRemove' | 'onGeofenceChange' | 'waypoints'>) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;

      if (geofenceEditing && onGeofenceChange) {
        const targetPoint = latLngToMap(lat, lng);
        const existingIndex = geofence.findIndex((point) => distance(point.x, point.y, targetPoint.x, targetPoint.y) < 12);

        if (existingIndex >= 0) {
          onGeofenceChange(geofence.filter((_, index) => index !== existingIndex));
          return;
        }

        onGeofenceChange([...geofence, { x: targetPoint.x, y: targetPoint.y }]);
        return;
      }

      if (!planningMode || !onWaypointAdd) return;

      if (onWaypointRemove) {
        const clickedWaypoint = waypoints.findIndex((wp) => {
          const [lat2, lng2] = getWaypointPosition(wp);
          const d = Math.hypot(lat2 - lat, lng2 - lng) * 111000;
          return d < 14;
        });

        if (clickedWaypoint >= 0) {
          onWaypointRemove(clickedWaypoint);
          return;
        }
      }

      onWaypointAdd(lat, lng, 30);
    },
  });

  return null;
}

function MapRouteLayer({ waypoints, selectedUnit, telemetry, planningMode }: {
  waypoints: Waypoint[];
  selectedUnit: string;
  telemetry: UnitTelemetry[];
  planningMode: boolean;
}) {
  if (waypoints.length === 0) return null;

  const routePositions = waypoints.map(getWaypointPosition);
  const assignedUnit = telemetry.find((item) => item.unitId === selectedUnit);
  const startPosition = assignedUnit ? getUnitPosition(assignedUnit) : routePositions[0];
  const completedCount = assignedUnit?.currentWaypoint ?? 0;

  const segments = [] as [number, number][];
  segments.push(startPosition);
  for (let i = 0; i < waypoints.length; i++) {
    segments.push(routePositions[i]);
  }

  return (
    <>
      <Polyline
        positions={segments}
        pathOptions={{
          color: planningMode ? '#f59e0b' : '#38bdf8',
          opacity: 0.75,
          weight: 2,
          dashArray: completedCount > 0 ? undefined : '6, 8',
        }}
      />
    </>
  );
}

export function TacticalMap({
  telemetry,
  survivors,
  scoutDetections,
  roverVerificationMission,
  onVerifyWithRover,
  waypoints,
  geofence,
  obstacles,
  missionActive,
  planningMode,
  onWaypointAdd,
  onWaypointRemove,
  onGeofenceChange,
  geofenceEditing = false,
  selectedUnit,
}: TacticalMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);

  const routeBounds = useMemo(() => {
    if (waypoints.length === 0) return null;
    const coords = waypoints.map(getWaypointPosition);
    const lats = coords.map(([lat]) => lat);
    const lngs = coords.map(([, lng]) => lng);
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ] as [[number, number], [number, number]];
  }, [waypoints]);

  const resetViewport = () => {
    if (!mapRef.current) return;
    mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });
  };

  const zoomAtCenter = (factor: number) => {
    if (!mapRef.current) return;
    const currentZoom = mapRef.current.getZoom();
    mapRef.current.setZoom(Math.max(2, Math.min(18, currentZoom * factor)));
  };

  const fitRoute = () => {
    if (!mapRef.current || !routeBounds) {
      resetViewport();
      return;
    }

    mapRef.current.fitBounds(routeBounds, { padding: [30, 30] });
  };

  const mapZoom = mapReady && mapRef.current ? Math.round(mapRef.current.getZoom() * 100) : 100;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <MapContainer
        ref={mapRef}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl
        attributionControl
        dragging
        doubleClickZoom
        scrollWheelZoom
        touchZoom
        keyboard
        className="absolute inset-0 z-0"
        whenReady={() => setMapReady(true)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler
          planningMode={planningMode}
          geofenceEditing={geofenceEditing}
          geofence={geofence}
          onWaypointAdd={onWaypointAdd}
          onWaypointRemove={onWaypointRemove}
          onGeofenceChange={onGeofenceChange}
          waypoints={waypoints}
        />

        {geofence.length >= 3 && (
          <Polygon
            positions={geofence.map((point) => {
              const projected = mapToLatLng(point.x, point.y);
              return [projected.lat, projected.lng] as [number, number];
            })}
            pathOptions={{
              color: '#f59e0b',
              fillColor: '#f59e0b',
              fillOpacity: 0.08,
              weight: 2,
              dashArray: '6 6',
            }}
          />
        )}

        {obstacles.map((obs, index) => {
          const topLeft = mapToLatLng(obs.x, obs.y);
          const bottomRight = mapToLatLng(obs.x + obs.w, obs.y + obs.h);
          return (
            <Polygon
              key={`obstacle-${index}`}
              positions={[
                [topLeft.lat, topLeft.lng],
                [topLeft.lat, bottomRight.lng],
                [bottomRight.lat, bottomRight.lng],
                [bottomRight.lat, topLeft.lng],
              ]}
              pathOptions={{
                color: '#64748b',
                fillColor: '#64748b',
                fillOpacity: 0.1,
                weight: 1,
              }}
            />
          );
        })}

        <MapRouteLayer waypoints={waypoints} selectedUnit={selectedUnit} telemetry={telemetry} planningMode={planningMode} />

        {waypoints.map((wp, index) => {
          const position = getWaypointPosition(wp);
          return (
            <Marker key={`wp-${index}`} position={position} icon={createWaypointIcon(planningMode ? '#f59e0b' : '#38bdf8')}>
              <Tooltip direction="top" offset={[0, -8]}>{wp.label}</Tooltip>
              {planningMode && onWaypointRemove && (
                <Popup>
                  <div className="text-[10px] font-mono text-slate-200">
                    <div className="mb-2 font-semibold text-amber-300">{wp.label}</div>
                    <button
                      type="button"
                      onClick={() => onWaypointRemove(index)}
                      className="rounded border border-red-500/60 bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-200"
                    >
                      Remove waypoint
                    </button>
                  </div>
                </Popup>
              )}
            </Marker>
          );
        })}

        {survivors.map((survivor) => {
          const color =
            survivor.severity === 'critical'
              ? '#ef4444'
              : survivor.severity === 'high'
                ? '#f97316'
                : survivor.severity === 'medium'
                  ? '#f59e0b'
                  : '#22c55e';

          return (
            <CircleMarker
              key={survivor.id}
              center={[survivor.lat, survivor.lng]}
              radius={7}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>{survivor.survivor_id}</Tooltip>
            </CircleMarker>
          );
        })}

        {scoutDetections.map((detection) => (
          <Marker
            key={detection.detectionId}
            position={[detection.latitude, detection.longitude]}
            icon={createDetectionIcon('#c084fc')}
          >
            <Popup>
              <div className="w-52 rounded bg-slate-950 text-[10px] font-mono text-slate-200">
                <div className="mb-1 flex items-center justify-between border-b border-slate-700 pb-1 text-[10px] font-semibold text-violet-300">
                  <span>SCOUT DETECTION</span>
                  <span className="rounded bg-violet-500/20 px-1 py-0.5 text-violet-200">{detection.status}</span>
                </div>
                <div className="space-y-1 text-slate-300">
                  <div><span className="text-slate-500">ID:</span> {detection.detectionId}</div>
                  <div><span className="text-slate-500">Latitude:</span> {detection.latitude.toFixed(5)}</div>
                  <div><span className="text-slate-500">Longitude:</span> {detection.longitude.toFixed(5)}</div>
                  <div><span className="text-slate-500">Altitude:</span> {detection.altitude.toFixed(1)} m</div>
                  <div><span className="text-slate-500">Confidence:</span> {(detection.confidence * 100).toFixed(0)}%</div>
                  <div><span className="text-slate-500">Time:</span> {new Date(detection.detectedAt).toLocaleString()}</div>
                </div>
                {onVerifyWithRover && (
                  <button
                    type="button"
                    onClick={() => onVerifyWithRover(detection)}
                    className="mt-2 w-full rounded border border-cyan-500/60 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200 transition hover:bg-cyan-500/20"
                  >
                    VERIFY WITH ROVER
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {roverVerificationMission && (
          <Marker
            position={[roverVerificationMission.targetLatitude, roverVerificationMission.targetLongitude]}
            icon={createWaypointIcon('#14b8a6')}
          >
            <Tooltip direction="top" offset={[0, -8]}>VERIFY</Tooltip>
          </Marker>
        )}

        {telemetry.map((unit) => {
          const cfg = UNIT_CONFIG[unit.unitId];
          const position = getUnitPosition(unit);
          const isActiveUnit = missionActive && unit.unitId === selectedUnit && unit.status !== 'Idle';

          return (
            <Marker
              key={unit.unitId}
              position={position}
              icon={createVehicleIcon(cfg.color, cfg.type, unit.heading)}
            >
              <Tooltip direction="top" offset={[0, -16]}>
                <div className="text-[10px] font-mono text-slate-100">
                  <div className="font-semibold" style={{ color: cfg.color }}>{cfg.name}</div>
                  <div>{unit.status}</div>
                  <div>{unit.battery.toFixed(0)}% • {unit.altitude.toFixed(0)}m</div>
                </div>
              </Tooltip>
              {isActiveUnit && (
                <CircleMarker
                  center={position}
                  radius={18}
                  pathOptions={{
                    color: cfg.color,
                    fillColor: cfg.color,
                    fillOpacity: 0.08,
                    weight: 1,
                  }}
                />
              )}
            </Marker>
          );
        })}
      </MapContainer>

      <div className="map-toolbar panel" aria-label="Map controls">
        <button onClick={() => zoomAtCenter(1.25)} aria-label="Zoom in" title="Zoom in"><Plus className="w-4 h-4" /></button>
        <button onClick={() => zoomAtCenter(0.8)} aria-label="Zoom out" title="Zoom out"><Minus className="w-4 h-4" /></button>
        <span className="map-toolbar__divider" />
        <button onClick={resetViewport} aria-label="Reset map view" title="Reset view"><LocateFixed className="w-4 h-4" /></button>
        <button onClick={fitRoute} aria-label="Fit route on map" title="Fit route"><Maximize2 className="w-4 h-4" /></button>
        <span className="map-toolbar__zoom">{mapZoom}%</span>
      </div>
      {planningMode && (
        <div className="absolute top-3 left-3 panel px-3 py-2 text-xs text-accent-amber animate-fade-in">
          PLANNING MODE — Click map to drop waypoints
        </div>
      )}
    </div>
  );
}
