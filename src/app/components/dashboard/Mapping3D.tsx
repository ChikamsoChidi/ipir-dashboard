import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Layers, RotateCcw, Loader2 } from "lucide-react";

// ── Configuration Constants ──────────────────────────────────────────────────
const NOMINAL_RADIUS = 35.0; 
const TOTAL_DIST_FT  = 390;  

// ── Anomaly Zones (For Dashboard Sidebar Analytics) ──────────────────────────
const ANOMALIES = [
  { id: "WL-001", label: "External Corrosion",        type: "wall_loss" as const, fi0: 10, fi1: 22, sev: +5.5 },
  { id: "DB-001", label: "Sedimentation Deposit",     type: "debris" as const,     fi0: 28, fi1: 42, sev: -7.0 },
  { id: "WL-002", label: "Severe Pitting",            type: "wall_loss" as const, fi0: 52, fi1: 65, sev: +8.0 },
  { id: "WLD-001", label: "Circumferential Weld Anomaly", type: "weld" as const,      fi0: 71, fi1: 73, sev: +2.0 },
] as const;

type AnomalyType = "wall_loss" | "debris" | "weld";

type ScanPt    = { x: number; y: number; r: number };
type ScanFrame = { 
  id: number; 
  dist: number; 
  segmentType: string;
  roll: number; 
  tilt: number; 
  yaw: number;
  cx: number;
  cy: number;
  cz: number;
  pts: ScanPt[] 
};

// ── Deviation → RGB ─────────────────────────────────────────────────────────────
function devColor(r: number, nom: number): THREE.Color {
  const d = r - nom;
  const a = Math.abs(d);
  if (a < 1.5) return new THREE.Color(0.05, 0.95, 0.45);   // green
  if (d > 0) {
    if (d < 3.0) return new THREE.Color(0.98, 0.85, 0.00); // yellow
    if (d < 5.5) return new THREE.Color(1.00, 0.42, 0.08); // orange
    return           new THREE.Color(1.00, 0.12, 0.07);    // red
  }
  if (a < 3.0) return new THREE.Color(0.45, 0.82, 1.00);   // cyan
  if (a < 5.5) return new THREE.Color(0.20, 0.52, 1.00);   // blue
  return             new THREE.Color(0.65, 0.22, 1.00);    // purple
}

export function Mapping3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const ctrlRef  = useRef<OrbitControls | null>(null);
  
  const [scanData, setScanData] = useState<ScanFrame[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRot, setAutoRot] = useState(false);

  // 1. Fetch and parse the CSV data
  useEffect(() => {
    async function loadCsvData() {
      try {
        const response = await fetch("/pipedata.csv");
        if (!response.ok) {
          throw new Error(`Failed to fetch pipedata.csv (${response.status} ${response.statusText})`);
        }
        
        const text = await response.text();
        const lines = text.split("\n").map(line => line.trim()).filter(line => line.length > 0);
        
        if (lines.length <= 1) {
          throw new Error("CSV file appears to be empty or missing data rows.");
        }

        // Map header tracking for all 12 columns
        const headers = lines[0].split(",").map(h => h.trim());
        const fIdIdx = headers.indexOf("frame_id");
        const distIdx = headers.indexOf("axial_distance_ft");
        const segIdx = headers.indexOf("segment_type");
        const rollIdx = headers.indexOf("frame_roll_rad");
        const tiltIdx = headers.indexOf("frame_tilt_rad");
        const yawIdx = headers.indexOf("frame_yaw_rad");
        const cxIdx = headers.indexOf("center_x_mm");
        const cyIdx = headers.indexOf("center_y_mm");
        const czIdx = headers.indexOf("center_z_mm");
        const radIdx  = headers.indexOf("radius_mm");
        const xIdx    = headers.indexOf("x_mm");
        const yIdx    = headers.indexOf("y_mm");

        const frameMap = new Map<number, ScanFrame>();

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",");
          const frameId = parseInt(cols[fIdIdx], 10);
          
          if (isNaN(frameId)) continue;

          if (!frameMap.has(frameId)) {
            frameMap.set(frameId, {
              id: frameId,
              dist: parseFloat(cols[distIdx]),
              segmentType: cols[segIdx] || "straight",
              roll: parseFloat(cols[rollIdx]),
              tilt: parseFloat(cols[tiltIdx]),
              yaw: parseFloat(cols[yawIdx]),
              cx: parseFloat(cols[cxIdx]),
              cy: parseFloat(cols[cyIdx]),
              cz: parseFloat(cols[czIdx]),
              pts: []
            });
          }

          frameMap.get(frameId)!.pts.push({
            x: parseFloat(cols[xIdx]),
            y: parseFloat(cols[yIdx]),
            r: parseFloat(cols[radIdx])
          });
        }

        const sortedFrames = Array.from(frameMap.values()).sort((a, b) => a.id - b.id);
        setScanData(sortedFrames);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred while parsing CSV.");
        setLoading(false);
      }
    }

    loadCsvData();
  }, []);

  // 2. Initialize and manage the Three.js Environment
  useEffect(() => {
    const el = mountRef.current;
    if (!el || scanData.length === 0) return;

    const W = el.clientWidth  || 800;
    const H = el.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);
    scene.fog = new THREE.FogExp2(0x0a0e16, 0.0004);

    const cam = new THREE.PerspectiveCamera(62, W / H, 0.5, 5000);
    
    // Find spatial midpoints to establish an accurate camera bounding focus
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    scanData.forEach(f => {
      // Convert mm values down to scale matching standard unit rendering frames
      const cx = f.cx / 304.8;
      const cy = f.cy / 304.8;
      const cz = f.cz / 304.8;
      if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
      if (cz < minZ) minZ = cz; if (cz > maxZ) maxZ = cz;
    });

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const midZ = (minZ + maxZ) / 2;

    cam.position.set(midX, midY + 100, maxZ + 120);
    
    const rend = new THREE.WebGLRenderer({ antialias: true });
    rend.setSize(W, H);
    rend.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(rend.domElement);

    const ctrl = new OrbitControls(cam, rend.domElement);
    ctrl.target.set(midX, midY, midZ);
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.06;
    ctrl.minDistance   = 15;
    ctrl.maxDistance   = 2000;
    ctrl.update();
    ctrlRef.current = ctrl;

    const disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

    // Construct 3D Rings along the true calculated spline trajectory
    scanData.forEach(frame => {
      const pos: number[] = [];
      const col: number[] = [];

      frame.pts.forEach(p => {
        // Point layout converted back to scale feet
        pos.push(p.x / 304.8, p.y / 304.8, 0);
        const c = devColor(p.r, NOMINAL_RADIUS);
        col.push(c.r, c.g, c.b);
      });

      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geom.setAttribute("color",    new THREE.Float32BufferAttribute(col, 3));
      const mat  = new THREE.LineBasicMaterial({ vertexColors: true });

      const ring = new THREE.LineLoop(geom, mat);
      
      // Apply exact 3D structural center transformations (translated from mm to feet)
      ring.position.set(frame.cx / 304.8, frame.cy / 304.8, frame.cz / 304.8);
      
      // Apply correct Euler rotation chains matching physical flight platform orientation
      ring.rotation.set(frame.tilt, frame.yaw, frame.roll, "YXZ");
      
      scene.add(ring);
      disposables.push(geom, mat);
    });

    // Generate dynamic bounding guidance lines instead of static cylinders
    const splinePoints: THREE.Vector3[] = scanData.map(f => new THREE.Vector3(f.cx / 304.8, f.cy / 304.8, f.cz / 304.8));
    const splineGeom = new THREE.BufferGeometry().setFromPoints(splinePoints);
    const splineMat = new THREE.LineBasicMaterial({ color: 0x21262d, transparent: true, opacity: 0.3 });
    const centerline = new THREE.Line(splineGeom, splineMat);
    scene.add(centerline);
    disposables.push(splineGeom, splineMat);

    // Dynamic Highlight Halos aligned to absolute calculated coordinates
    ANOMALIES.forEach(an => {
      const idxStart = Math.max(0, Math.min(an.fi0, scanData.length - 1));
      const idxEnd = Math.max(0, Math.min(an.fi1, scanData.length - 1));
      
      const pStart = splinePoints[idxStart];
      const pEnd = splinePoints[idxEnd];
      const midPoint = new THREE.Vector3().addVectors(pStart, pEnd).multiplyScalar(0.5);
      const segmentLen = pStart.distanceTo(pEnd);

      const hue   = an.type === "wall_loss" ? 0xff4400 : an.type === "debris" ? 0x4488ff : 0xf5c842;
      const hGeom = new THREE.CylinderGeometry((NOMINAL_RADIUS + 4) / 304.8, (NOMINAL_RADIUS + 4) / 304.8, segmentLen, 32, 1, true);
      const hMat  = new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
      const halo  = new THREE.Mesh(hGeom, hMat);

      // Orient halo along vector direction connecting start and end points
      halo.position.copy(midPoint);
      const direction = new THREE.Vector3().subVectors(pEnd, pStart).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      halo.quaternion.setFromUnitVectors(up, direction);

      scene.add(halo);
      disposables.push(hGeom, hMat);
    });

    const grid = new THREE.GridHelper(1000, 50, 0x21262d, 0x161b22);
    grid.position.set(midX, minY - 10, midZ);
    scene.add(grid);

    scene.add(new THREE.AmbientLight(0x30405a, 0.8));

    let raf: number;
    const tick = () => { raf = requestAnimationFrame(tick); ctrl.update(); rend.render(scene, cam); };
    tick();

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      rend.setSize(w, h);
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ctrl.dispose();
      disposables.forEach(d => d.dispose());
      rend.dispose();
      if (el.contains(rend.domElement)) el.removeChild(rend.domElement);
      ctrlRef.current = null;
    };
  }, [scanData]);

  // 3. Keep Auto-rotate state synced
  useEffect(() => {
    if (ctrlRef.current) {
      ctrlRef.current.autoRotate      = autoRot;
      ctrlRef.current.autoRotateSpeed = 0.35;
    }
  }, [autoRot]);

  // ── Render States ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#0d1117] text-[#8b949e] font-mono text-[12px] gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
        Parsing pipedata.csv ...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0d1117] text-red-400 font-mono text-[12px] p-6 text-center border border-red-500/20">
        Error loading dataset: {error}
      </div>
    );
  }

  // Pre-calculate anomaly data for UI using dynamic scale array limits
  const anomalyStats = ANOMALIES.map(an => {
    const fStart = scanData[Math.max(0, Math.min(an.fi0, scanData.length - 1))];
    const fEnd = scanData[Math.max(0, Math.min(an.fi1, scanData.length - 1))];
    const posStart_ft = fStart ? fStart.dist : 0;
    const posEnd_ft   = fEnd ? fEnd.dist : 0;
    const absSev      = Math.abs(an.sev);
    const severity    = absSev > 6 ? "CRITICAL" : absSev > 3 ? "MODERATE" : "MINOR";
    const colors: Record<AnomalyType, { dot: string; bg: string; txt: string }> = {
      wall_loss: { dot: "#ff6b35", bg: "bg-orange-500/10 border-orange-500/30", txt: "text-orange-400" },
      debris:    { dot: "#58a6ff", bg: "bg-blue-500/10   border-blue-500/30",   txt: "text-blue-400"   },
      weld:      { dot: "#f5c842", bg: "bg-yellow-500/10 border-yellow-500/30", txt: "text-yellow-400" },
    };
    return { ...an, posStart_ft, posEnd_ft, severity, style: colors[an.type] };
  });

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Canvas Viewport ── */}
      <div ref={mountRef} className="flex-1 relative overflow-hidden">
        <div className="absolute top-2 left-2 z-10 flex gap-1.5">
          <button
            onClick={() => setAutoRot(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] border transition-all ${
              autoRot
                ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                : "bg-black/50 border-[#30363d] text-[#8b949e] hover:border-[#8b949e]/50"
            }`}
          >
            <RotateCcw className="w-3 h-3" />
            Auto-Rotate
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-10 bg-black/72 backdrop-blur-sm rounded-lg px-3 py-2.5 border border-[#30363d]">
          <div className="text-[9px] text-[#8b949e] uppercase tracking-widest mb-1.5">Laser Deviation from Nominal</div>
          {([
            { c: "#0df272", label: "Nominal  (< ±1.5 mm)"       },
            { c: "#f9d800", label: "Wall loss  1.5–3 mm"         },
            { c: "#ff6b14", label: "Wall loss  3–5.5 mm"         },
            { c: "#ff1e12", label: "Wall loss  > 5.5 mm (severe)"},
            { c: "#72d1ff", label: "Debris  1.5–3 mm"            },
            { c: "#3384ff", label: "Debris  3–5.5 mm"            },
            { c: "#a538ff", label: "Debris  > 5.5 mm (severe)"   },
          ] as { c: string; label: string }[]).map(({ c, label }) => (
            <div key={label} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
              <div className="w-3 h-2 rounded-sm shrink-0" style={{ background: c }} />
              <span className="text-[9px] text-[#8b949e]">{label}</span>
            </div>
          ))}
        </div>

        <div className="absolute bottom-3 right-3 z-10 text-[9px] text-[#8b949e] bg-black/50 px-2 py-1 rounded">
          Drag · Scroll to zoom · Right-drag to pan
        </div>
      </div>

      {/* ── Control/Stats Panel ── */}
      <div className="w-60 bg-[#161b22] border-l border-[#21262d] flex flex-col overflow-y-auto text-[11px]">
        <div className="p-3 border-b border-[#21262d]">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-cyan-400 font-mono text-[11px] font-semibold">3D Laser Map</span>
          </div>
          <div className="text-[10px] text-[#8b949e] uppercase tracking-widest mb-1.5">Scan Summary</div>
          {([
            ["Source File", "pipedata.csv"],
            ["Frames",      `${scanData.length} sections`],
            ["Coverage",    `${TOTAL_DIST_FT} ft`],
            ["Nominal ID",  `Ø ${(NOMINAL_RADIUS * 2).toFixed(0)} mm`],
            ["Anomalies",   `${ANOMALIES.length} detected`],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between py-0.5">
              <span className="text-[#8b949e]">{k}</span>
              <span className="font-mono text-[#e6edf3] text-right text-[10px]">{v}</span>
            </div>
          ))}
        </div>

        {/* Anomaly Dashboard Feed */}
        <div className="p-3 flex-1">
          <div className="text-[10px] text-[#8b949e] uppercase tracking-widest mb-2">Detected Anomalies</div>
          {anomalyStats.map(an => (
            <div key={an.id} className={`rounded-lg border p-2 mb-2 last:mb-0 ${an.style.bg}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: an.style.dot }} />
                <span className={`font-mono font-semibold text-[11px] ${an.style.txt}`}>{an.id}</span>
                <span className="ml-auto text-[#8b949e] text-[9px]">
                  {an.posStart_ft.toFixed(0)}–{an.posEnd_ft.toFixed(0)} ft
                </span>
              </div>
              <div className="text-[#e6edf3] text-[10px] mb-0.5">{an.label}</div>
              <div className="flex justify-between text-[9px]">
                <span className="text-[#8b949e]">Max deviation</span>
                <span className={an.style.txt}>{an.sev > 0 ? "+" : ""}{an.sev.toFixed(1)} mm</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-[#8b949e]">Severity</span>
                <span className={an.style.txt}>{an.severity}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}