import type { OccupancyMap } from '@/types';

interface SLAMMapProps {
  map: OccupancyMap;
  roverX: number;
  roverY: number;
  obstacles: { x: number; y: number; w: number; h: number }[];
}

export function SLAMMap({ map, roverX, roverY }: SLAMMapProps) {
  const { grid, width, height, cellSize } = map;
  const canvasW = width * cellSize;
  const canvasH = height * cellSize;

  // Calculate stats
  let explored = 0;
  let obstacles = 0;
  let unknown = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0) unknown++;
    else if (grid[i] === 1) explored++;
    else if (grid[i] === 2) obstacles++;
  }
  const total = grid.length;
  const exploredPct = ((explored / total) * 100).toFixed(1);
  const obstaclePct = ((obstacles / total) * 100).toFixed(1);
  const unknownPct = ((unknown / total) * 100).toFixed(1);

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <span className="panel-title">SLAM Occupancy Map — ROVER R1</span>
        <div className="flex items-center gap-2">
          <span className="status-dot status-dot-live" style={{ background: '#14b8a6' }} />
          <span className="text-[10px] text-slate-500 font-mono">LiDAR ACTIVE</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 bg-bg-primary overflow-auto">
        <div className="relative" style={{ width: canvasW, height: canvasH }}>
          <svg width={canvasW} height={canvasH} className="block">
            {/* Grid background */}
            <rect width={canvasW} height={canvasH} fill="#0a0e14" />

            {Array.from({ length: height + 1 }).map((_, i) => (
              <line
                key={`h${i}`}
                x1={0}
                y1={i * cellSize}
                x2={canvasW}
                y2={i * cellSize}
                stroke="rgba(255,255,255,0.03)"
                strokeWidth={0.5}
              />
            ))}
            {Array.from({ length: width + 1 }).map((_, i) => (
              <line
                key={`v${i}`}
                x1={i * cellSize}
                y1={0}
                x2={i * cellSize}
                y2={canvasH}
                stroke="rgba(255,255,255,0.03)"
                strokeWidth={0.5}
              />
            ))}

            {/* Cells */}
            {Array.from({ length: height }).map((_, y) =>
              Array.from({ length: width }).map((_, x) => {
                const val = grid[y * width + x];
                if (val === 0) return null;
                let fill = 'rgba(20, 184, 166, 0.08)';
                if (val === 2) fill = 'rgba(239, 68, 68, 0.5)';
                else if (val === 1) fill = 'rgba(20, 184, 166, 0.12)';
                return (
                  <rect
                    key={`${x}-${y}`}
                    x={x * cellSize}
                    y={y * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill={fill}
                    stroke={val === 2 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(20, 184, 166, 0.2)'}
                    strokeWidth={0.5}
                  />
                );
              })
            )}

            {/* Rover position */}
            <g transform={`translate(${roverX}, ${roverY})`}>
              <circle r="14" fill="none" stroke="#14b8a6" strokeWidth="1" opacity="0.3">
                <animate attributeName="r" from="8" to="20" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
              </circle>
              <circle r="6" fill="#14b8a6" stroke="#0a0e14" strokeWidth="2" />
              <text y="-12" textAnchor="middle" fill="#14b8a6" fontSize="9" fontFamily="JetBrains Mono">
                R1
              </text>
            </g>
          </svg>
        </div>
      </div>

      <div className="border-t border-white/10 p-3 grid grid-cols-3 gap-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(20, 184, 166, 0.4)' }} />
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Explored</span>
          </div>
          <div className="font-mono text-lg text-accent-teal font-semibold">{exploredPct}%</div>
          <div className="text-[10px] text-slate-600 font-mono">{explored} cells</div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(239, 68, 68, 0.5)' }} />
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Obstacles</span>
          </div>
          <div className="font-mono text-lg text-accent-red font-semibold">{obstaclePct}%</div>
          <div className="text-[10px] text-slate-600 font-mono">{obstacles} cells</div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2.5 h-2.5 rounded-sm border border-white/20" />
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Unknown</span>
          </div>
          <div className="font-mono text-lg text-slate-500 font-semibold">{unknownPct}%</div>
          <div className="text-[10px] text-slate-600 font-mono">{unknown} cells</div>
        </div>
      </div>
    </div>
  );
}
