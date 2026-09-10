import { useRef, useEffect, useState, useCallback } from 'react';
import type { UnitTelemetry, Survivor, Waypoint, GeofencePoint } from '@/types';
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  UNIT_CONFIG,
  STATUS_COLORS,
  distance,
} from '@/lib/constants';

interface TacticalMapProps {
  telemetry: UnitTelemetry[];
  survivors: Survivor[];
  waypoints: Waypoint[];
  geofence: GeofencePoint[];
  obstacles: { x: number; y: number; w: number; h: number }[];
  missionActive: boolean;
  planningMode: boolean;
  onWaypointAdd?: (x: number, y: number) => void;
  onWaypointRemove?: (index: number) => void;
  selectedUnit: string;
  elapsed: number;
}

export function TacticalMap({
  telemetry,
  survivors,
  waypoints,
  geofence,
  obstacles,
  missionActive,
  planningMode,
  onWaypointAdd,
  onWaypointRemove,
  selectedUnit,
  elapsed,
}: TacticalMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const interpRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Interpolation for smooth movement
  useEffect(() => {
    const id = setInterval(() => {
      const newInterp = new Map<string, { x: number; y: number }>();
      for (const t of telemetry) {
        const prev = interpRef.current.get(t.unitId) || { x: t.x, y: t.y };
        const nx = prev.x + (t.x - prev.x) * 0.3;
        const ny = prev.y + (t.y - prev.y) * 0.3;
        newInterp.set(t.unitId, { x: nx, y: ny });
      }
      interpRef.current = newInterp;
      draw();
    }, 50);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telemetry, survivors, waypoints, geofence, obstacles, missionActive, planningMode, scale, offset, hoverPoint, selectedUnit, elapsed]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= MAP_WIDTH; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, MAP_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= MAP_HEIGHT; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(MAP_WIDTH, y);
      ctx.stroke();
    }

    // Major grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = 0; x <= MAP_WIDTH; x += 200) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, MAP_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= MAP_HEIGHT; y += 200) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(MAP_WIDTH, y);
      ctx.stroke();
    }

    // Geofence
    if (geofence.length > 0) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(geofence[0].x, geofence[0].y);
      for (let i = 1; i < geofence.length; i++) {
        ctx.lineTo(geofence[i].x, geofence[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      // Fill
      ctx.fillStyle = 'rgba(245, 158, 11, 0.03)';
      ctx.fill();
    }

    // Obstacles
    for (const obs of obstacles) {
      ctx.fillStyle = 'rgba(100, 116, 139, 0.15)';
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = 1;
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      // Hatch pattern
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
      for (let i = 0; i < obs.w + obs.h; i += 8) {
        ctx.beginPath();
        ctx.moveTo(obs.x + i, obs.y);
        ctx.lineTo(obs.x, obs.y + i);
        ctx.stroke();
      }
    }

    // Waypoints
    if (waypoints.length > 0) {
      const wpColor = planningMode ? '#f59e0b' : 'rgba(56, 189, 248, 0.6)';
      ctx.strokeStyle = wpColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);

      // Connect waypoints
      const assignedUnit = telemetry.find((t) => t.unitId === selectedUnit);
      const startX = assignedUnit ? interpRef.current.get(assignedUnit.unitId)?.x ?? assignedUnit.x : waypoints[0].x;
      const startY = assignedUnit ? interpRef.current.get(assignedUnit.unitId)?.y ?? assignedUnit.y : waypoints[0].y;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      for (const wp of waypoints) {
        ctx.lineTo(wp.x, wp.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Waypoint markers
      for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        ctx.fillStyle = planningMode ? '#f59e0b' : 'rgba(56, 189, 248, 0.8)';
        ctx.strokeStyle = '#0a0e14';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(wp.label, wp.x + 10, wp.y - 8);

        // Remove button in planning mode
        if (planningMode && onWaypointRemove) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
          ctx.beginPath();
          ctx.arc(wp.x + 10, wp.y - 10, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '8px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('×', wp.x + 10, wp.y - 10);
          ctx.textBaseline = 'alphabetic';
        }
      }
    }

    // Survivors
    for (const s of survivors) {
      const color =
        s.severity === 'critical'
          ? '#ef4444'
          : s.severity === 'high'
            ? '#f97316'
            : s.severity === 'medium'
              ? '#f59e0b'
              : '#22c55e';

      // Pulse ring
      const pulse = (Math.sin(elapsed / 300) + 1) / 2;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.3 * (1 - pulse);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.lat, s.lng, 12 + pulse * 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Marker
      ctx.fillStyle = color;
      ctx.strokeStyle = '#0a0e14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.lat, s.lng, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Cross marker
      ctx.strokeStyle = '#0a0e14';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.lat - 3, s.lng);
      ctx.lineTo(s.lat + 3, s.lng);
      ctx.moveTo(s.lat, s.lng - 3);
      ctx.lineTo(s.lat, s.lng + 3);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(s.survivor_id, s.lat + 10, s.lng + 3);
      ctx.fillStyle = '#64748b';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillText(`${(s.confidence * 100).toFixed(0)}%`, s.lat + 10, s.lng + 13);
    }

    // Unit trails
    for (const t of telemetry) {
      if (t.trail.length < 2) continue;
      const cfg = UNIT_CONFIG[t.unitId];
      ctx.strokeStyle = cfg.color + '40';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < t.trail.length; i++) {
        const p = t.trail[i];
        const alpha = i / t.trail.length;
        ctx.globalAlpha = alpha * 0.5;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Units
    for (const t of telemetry) {
      const pos = interpRef.current.get(t.unitId) || { x: t.x, y: t.y };
      const cfg = UNIT_CONFIG[t.unitId];

      // Scan radius for scanning units
      if (t.status === 'Scanning') {
        const scanAngle = (elapsed / 20) % 360;
        const rad = (scanAngle * Math.PI) / 180;
        const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 80);
        gradient.addColorStop(0, cfg.color + '20');
        gradient.addColorStop(1, cfg.color + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.arc(pos.x, pos.y, 80, rad - 0.4, rad + 0.4);
        ctx.closePath();
        ctx.fill();
      }

      // Unit icon
      ctx.save();
      ctx.translate(pos.x, pos.y);

      if (cfg.type === 'drone') {
        // Drone: rotated triangle
        ctx.rotate((t.heading * Math.PI) / 180);
        ctx.fillStyle = cfg.color;
        ctx.strokeStyle = '#0a0e14';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(7, 7);
        ctx.lineTo(0, 4);
        ctx.lineTo(-7, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Rotors
        ctx.rotate(-(t.heading * Math.PI) / 180);
        ctx.strokeStyle = cfg.color + '60';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2 + (elapsed / 100) % (Math.PI * 2);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
          ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
          ctx.stroke();
        }
      } else {
        // Rover: rectangle
        ctx.rotate((t.heading * Math.PI) / 180);
        ctx.fillStyle = cfg.color;
        ctx.strokeStyle = '#0a0e14';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(-8, -6, 16, 12);
        ctx.fill();
        ctx.stroke();
        // Direction indicator
        ctx.fillStyle = '#0a0e14';
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(2, -3);
        ctx.lineTo(2, 3);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      // Label
      ctx.fillStyle = cfg.color;
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.callsign, pos.x, pos.y - 16);

      // Status pill
      const statusColor = STATUS_COLORS[t.status];
      ctx.fillStyle = statusColor + '30';
      ctx.strokeStyle = statusColor + '60';
      const statusText = t.status.toUpperCase();
      ctx.font = '8px "Inter", sans-serif';
      const tw = ctx.measureText(statusText).width + 10;
      ctx.beginPath();
      ctx.roundRect(pos.x - tw / 2, pos.y + 14, tw, 14, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = statusColor;
      ctx.textAlign = 'center';
      ctx.fillText(statusText, pos.x, pos.y + 24);

      // Live indicator
      if (missionActive) {
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(pos.x + 10, pos.y - 14, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Hover crosshair
    if (hoverPoint && planningMode) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hoverPoint.x, 0);
      ctx.lineTo(hoverPoint.x, MAP_HEIGHT);
      ctx.moveTo(0, hoverPoint.y);
      ctx.lineTo(MAP_WIDTH, hoverPoint.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(hoverPoint.x, hoverPoint.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Compass
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', w - 30, 20);
    ctx.fillText('S', w - 30, 50);
    ctx.fillText('E', w - 45, 35);
    ctx.fillText('W', w - 15, 35);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w - 30, 35, 12, 0, Math.PI * 2);
    ctx.stroke();
  }, [telemetry, survivors, waypoints, geofence, obstacles, missionActive, planningMode, scale, offset, hoverPoint, selectedUnit, elapsed, onWaypointRemove]);

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const sx = rect.width / MAP_WIDTH;
      const sy = rect.height / MAP_HEIGHT;
      const s = Math.min(sx, sy);
      setScale(s);
      setOffset({
        x: (rect.width - MAP_WIDTH * s) / 2,
        y: (rect.height - MAP_HEIGHT * s) / 2,
      });
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const getMapCoords = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    return {
      x: (px - offset.x) / scale,
      y: (py - offset.y) / scale,
    };
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!planningMode || !onWaypointAdd) return;
    const { x, y } = getMapCoords(e);
    if (x < 0 || x > MAP_WIDTH || y < 0 || y > MAP_HEIGHT) return;

    // Check if clicking on a waypoint remove button
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      if (distance(x, y, wp.x + 10, wp.y - 10) < 8) {
        onWaypointRemove?.(i);
        return;
      }
    }

    onWaypointAdd(x, y);
  };

  const handleMove = (e: React.MouseEvent) => {
    if (!planningMode) return;
    setHoverPoint(getMapCoords(e));
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverPoint(null)}
        className={planningMode ? 'cursor-crosshair' : 'cursor-default'}
      />
      {planningMode && (
        <div className="absolute top-3 left-3 panel px-3 py-2 text-xs text-accent-amber animate-fade-in">
          PLANNING MODE — Click map to drop waypoints
        </div>
      )}
    </div>
  );
}
