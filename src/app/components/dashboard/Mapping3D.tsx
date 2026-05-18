import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Layers, RotateCcw } from "lucide-react";

// ── Scan constants ─────────────────────────────────────────────────────────────
const NOMINAL_RADIUS   = 35.0;   // laser-scanner nominal inner-wall radius (mm)
const NUM_FRAMES       = 80;
const PTS_PER_FRAME    = 360;    // one ray per degree
const TOTAL_DIST_FT    = 390;    // axial scan length

// ── Anomaly zones ─────────────────────────────────────────────────────────────
const ANOMALIES = [
  {
    id: "WL-001",  label: "External Corrosion",
    type: "wall_loss" as const,
    fi0: 10, fi1: 22, a0: 120, a1: 210,   // 4–7 o'clock
    sev: +5.5,
  },
  {
    id: "DB-001",  label: "Sedimentation Deposit",
    type: "debris" as const,
    fi0: 28, fi1: 42, a0: 300, a1: 420,   // 10–2 o'clock (wraps)
    sev: -7.0,
  },
  {
    id: "WL-002",  label: "Severe Pitting",
    type: "wall_loss" as const,
    fi0: 52, fi1: 65, a0: 150, a1: 190,   // narrow 5 o'clock sector
    sev: +8.0,
  },
  {
    id: "WLD-001", label: "Circumferential Weld Anomaly",
    type: "weld" as const,
    fi0: 71, fi1: 73, a0: 0,   a1: 360,  // full ring
    sev: +2.0,
  },
] as const;

type AnomalyType = "wall_loss" | "debris" | "weld";

// ── Synthetic laser-scan data ──────────────────────────────────────────────────
type ScanPt    = { x: number; y: number; r: number };
type ScanFrame = { id: number; dist: number; roll: number; tilt: number; pts: ScanPt[] };

function buildScanData(): ScanFrame[] {
  const rng = (() => {
    let s = 0xdeadbeef;
    return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return ((s >>> 0) / 0xffffffff); };
  })();

  return Array.from({ length: NUM_FRAMES }, (_, fi) => {
    const dist = (fi / (NUM_FRAMES - 1)) * TOTAL_DIST_FT;
    const pts: ScanPt[] = Array.from({ length: PTS_PER_FRAME }, (__, pi) => {
      const aDeg = (pi / PTS_PER_FRAME) * 360;
      const aRad = (aDeg / 180) * Math.PI;
      let r = NOMINAL_RADIUS + (rng() - 0.5) * 1.4;

      for (const an of ANOMALIES) {
        if (fi < an.fi0 || fi > an.fi1) continue;
        const fp = (fi - an.fi0) / (an.fi1 - an.fi0);
        const fi_ = Math.sin(fp * Math.PI);

        // angle check with wrap-around
        const a1eff = an.a1 > 360 ? an.a1 - 360 : an.a1;
        const inZone = an.a1 > 360
          ? (aDeg >= an.a0 || aDeg <= a1eff)
          : (aDeg >= an.a0 && aDeg <= an.a1);
        if (!inZone) continue;

        const span = an.a1 > 360 ? (360 - an.a0 + a1eff) : (an.a1 - an.a0);
        const fromStart = an.a1 > 360 && aDeg < an.a0 ? aDeg + (360 - an.a0) : aDeg - an.a0;
        const ai = Math.sin((fromStart / span) * Math.PI);

        r += an.sev * fi_ * ai;
        r += (rng() - 0.5) * 1.8 * fi_;   // realistic scatter inside defect zone
      }
      return { x: r * Math.cos(aRad), y: r * Math.sin(aRad), r };
    });

    return {
      id:   fi + 1,
      dist,
      roll: (rng() - 0.5) * 0.012,
      tilt: (rng() - 0.5) * 0.008,
      pts,
    };
  });
}

const SCAN_DATA = buildScanData();

// ── Deviation → RGB ─────────────────────────────────────────────────────────────
function devColor(r: number, nom: number): THREE.Color {
  const d = r - nom;
  const a = Math.abs(d);
  if (a < 1.5)  return new THREE.Color(0.05, 0.95, 0.45);   // green   – nominal
  if (d > 0) {
    if (d < 3.0) return new THREE.Color(0.98, 0.85, 0.00);  // yellow  – minor wall loss
    if (d < 5.5) return new THREE.Color(1.00, 0.42, 0.08);  // orange  – moderate
    return           new THREE.Color(1.00, 0.12, 0.07);     // red     – severe
  }
  if (a < 3.0)   return new THREE.Color(0.45, 0.82, 1.00);  // cyan    – minor debris
  if (a < 5.5)   return new THREE.Color(0.20, 0.52, 1.00);  // blue    – moderate
  return             new THREE.Color(0.65, 0.22, 1.00);     // purple  – severe
}

// ── Summary stats (computed once) ────────────────────────────────────────────
const anomalyStats = ANOMALIES.map(an => {
  const posStart_ft = (an.fi0 / (NUM_FRAMES - 1)) * TOTAL_DIST_FT;
  const posEnd_ft   = (an.fi1 / (NUM_FRAMES - 1)) * TOTAL_DIST_FT;
  const absSev      = Math.abs(an.sev);
  const severity    = absSev > 6 ? "CRITICAL" : absSev > 3 ? "MODERATE" : "MINOR";
  const colors: Record<AnomalyType, { dot: string; bg: string; txt: string }> = {
    wall_loss: { dot: "#ff6b35", bg: "bg-orange-500/10 border-orange-500/30", txt: "text-orange-400" },
    debris:    { dot: "#58a6ff", bg: "bg-blue-500/10   border-blue-500/30",   txt: "text-blue-400"   },
    weld:      { dot: "#f5c842", bg: "bg-yellow-500/10 border-yellow-500/30", txt: "text-yellow-400" },
  };
  return { ...an, posStart_ft, posEnd_ft, severity, style: colors[an.type] };
});

// ── Component ──────────────────────────────────────────────────────────────────
export function Mapping3D() {
  const mountRef    = useRef<HTMLDivElement>(null);
  const ctrlRef     = useRef<OrbitControls | null>(null);
  const [autoRot, setAutoRot] = useState(false);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const W = el.clientWidth  || 800;
    const H = el.clientHeight || 600;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);
    scene.fog = new THREE.FogExp2(0x0a0e16, 0.00065);

    // ── Camera ──
    const cam = new THREE.PerspectiveCamera(62, W / H, 0.5, 3000);
    cam.position.set(0, 0, 70);
    cam.lookAt(0, 0, -TOTAL_DIST_FT / 2);

    // ── Renderer ──
    const rend = new THREE.WebGLRenderer({ antialias: true });
    rend.setSize(W, H);
    rend.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(rend.domElement);

    // ── Controls ──
    const ctrl = new OrbitControls(cam, rend.domElement);
    ctrl.target.set(0, 0, -TOTAL_DIST_FT / 2);
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.06;
    ctrl.minDistance   = 15;
    ctrl.maxDistance   = 1200;
    ctrl.update();
    ctrlRef.current = ctrl;

    // ── Laser rings ──
    const disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

    SCAN_DATA.forEach(frame => {
      const pos: number[] = [];
      const col: number[] = [];

      frame.pts.forEach(p => {
        pos.push(p.x, p.y, 0);
        const c = devColor(p.r, NOMINAL_RADIUS);
        col.push(c.r, c.g, c.b);
      });

      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geom.setAttribute("color",    new THREE.Float32BufferAttribute(col, 3));
      const mat  = new THREE.LineBasicMaterial({ vertexColors: true });

      const ring = new THREE.LineLoop(geom, mat);
      ring.position.z = -frame.dist;
      ring.rotation.z =  frame.roll;
      ring.rotation.x =  frame.tilt;
      scene.add(ring);

      disposables.push(geom, mat);
    });

    // ── Nominal reference tube (ghost) ──
    const refGeom = new THREE.CylinderGeometry(NOMINAL_RADIUS, NOMINAL_RADIUS, TOTAL_DIST_FT, 64, 1, true);
    const refMat  = new THREE.MeshBasicMaterial({ color: 0x21262d, transparent: true, opacity: 0.07, side: THREE.BackSide });
    const refMesh = new THREE.Mesh(refGeom, refMat);
    refMesh.rotation.x = Math.PI / 2;
    refMesh.position.z = -TOTAL_DIST_FT / 2;
    scene.add(refMesh);
    disposables.push(refGeom, refMat);

    // ── Anomaly zone halos ──
    anomalyStats.forEach(an => {
      const len   = an.posEnd_ft - an.posStart_ft;
      const mid   = (an.posStart_ft + an.posEnd_ft) / 2;
      const hue   = an.type === "wall_loss" ? 0xff4400 : an.type === "debris" ? 0x4488ff : 0xf5c842;
      const hGeom = new THREE.CylinderGeometry(NOMINAL_RADIUS + 4, NOMINAL_RADIUS + 4, len, 32, 1, true);
      const hMat  = new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.055, side: THREE.DoubleSide });
      const halo  = new THREE.Mesh(hGeom, hMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.z = -mid;
      scene.add(halo);
      disposables.push(hGeom, hMat);
    });

    // ── Floor grid ──
    const grid = new THREE.GridHelper(600, 60, 0x21262d, 0x161b22);
    grid.position.y = -(NOMINAL_RADIUS + 8);
    grid.position.z = -TOTAL_DIST_FT / 2;
    scene.add(grid);

    // ── Ambient fill ──
    scene.add(new THREE.AmbientLight(0x30405a, 0.6));

    // ── Render loop ──
    let raf: number;
    const tick = () => { raf = requestAnimationFrame(tick); ctrl.update(); rend.render(scene, cam); };
    tick();

    // ── Resize ──
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
      refGeom.dispose(); refMat.dispose();
      rend.dispose();
      if (el.contains(rend.domElement)) el.removeChild(rend.domElement);
      ctrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (ctrlRef.current) {
      ctrlRef.current.autoRotate      = autoRot;
      ctrlRef.current.autoRotateSpeed = 0.35;
    }
  }, [autoRot]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Three.js canvas ── */}
      <div ref={mountRef} className="flex-1 relative overflow-hidden">
        {/* Controls overlay */}
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

        {/* Color-scale legend */}
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

        {/* Hint */}
        <div className="absolute bottom-3 right-3 z-10 text-[9px] text-[#8b949e] bg-black/50 px-2 py-1 rounded">
          Drag · Scroll to zoom · Right-drag to pan
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-60 bg-[#161b22] border-l border-[#21262d] flex flex-col overflow-y-auto text-[11px]">
        {/* Header */}
        <div className="p-3 border-b border-[#21262d]">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-cyan-400 font-mono text-[11px] font-semibold">3D Laser Map</span>
          </div>
          <div className="text-[10px] text-[#8b949e] uppercase tracking-widest mb-1.5">Scan Summary</div>
          {([
            ["Frames",      `${NUM_FRAMES} cross-sections`],
            ["Coverage",    `${TOTAL_DIST_FT} ft`         ],
            ["Resolution",  `${PTS_PER_FRAME} pts / ring` ],
            ["Nominal ID",  `Ø ${(NOMINAL_RADIUS * 2).toFixed(0)} mm`],
            ["Anomalies",   `${ANOMALIES.length} detected`],
            ["Technique",   "Laser triangulation"         ],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between py-0.5">
              <span className="text-[#8b949e]">{k}</span>
              <span className="font-mono text-[#e6edf3] text-right text-[10px]">{v}</span>
            </div>
          ))}
        </div>

        {/* Anomaly list */}
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

        {/* Method note */}
        <div className="p-3 border-t border-[#21262d]">
          <div className="text-[10px] text-[#8b949e] uppercase tracking-widest mb-1.5">Method</div>
          <p className="text-[9px] text-[#8b949e] leading-relaxed">
            Structured-light laser triangulation: a rotating line-laser projects a 360° ring across
            the bore. A camera measures ring distortions to compute inner-wall geometry at each
            frame. Positive deviation = wall loss (corrosion). Negative deviation = debris or deposit.
          </p>
        </div>
      </div>
    </div>
  );
}
