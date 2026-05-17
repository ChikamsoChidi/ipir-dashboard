import { useEffect, useRef, useState } from "react";
import { PIPE_SPEC, DEFECTS, type Defect } from "./mockData";
import { Info, Maximize2 } from "lucide-react";

type View = "3d" | "cscan" | "xsection";

// Color by wall-loss fraction
function lossColor(frac: number): string {
  if (frac < 0.2)  return "#39d353";
  if (frac < 0.35) return "#7ee787";
  if (frac < 0.5)  return "#f5a623";
  if (frac < 0.65) return "#ff6b35";
  return "#f85149";
}

// ── 3-D perspective pipe renderer ─────────────────────────────────────────────
function draw3D(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  defects: Defect[],
  crawlerX: number,
  frame: number,
  selected: Defect | null,
) {
  const { od_mm, wt_mm } = PIPE_SPEC;
  const VISIBLE_M = 30; // metres shown along X

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, W, H);

  // Pipe dimensions mapped to canvas
  const pipeLeft   = 40;
  const pipeRight  = W - 40;
  const pipeLen    = pipeRight - pipeLeft;
  const pipeCY     = H / 2;
  const pipeRY     = Math.min(H * 0.36, 120);  // semi-minor (perspective ellipse)
  const pipeRX     = pipeRY * 0.38;             // semi-major of end caps

  // ── Pipe body fill (top half visible) ──────────────────────────────────────
  // Draw as thick band with radial-ish gradient
  const bodyGrad = ctx.createLinearGradient(0, pipeCY - pipeRY, 0, pipeCY + pipeRY);
  bodyGrad.addColorStop(0,   "#2a1f0a");
  bodyGrad.addColorStop(0.3, "#1a1510");
  bodyGrad.addColorStop(0.6, "#0d0d0d");
  bodyGrad.addColorStop(1,   "#050505");
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(pipeLeft, pipeCY - pipeRY, pipeLen, pipeRY * 2);

  // Top highlight stripe
  const hilite = ctx.createLinearGradient(0, pipeCY - pipeRY, 0, pipeCY - pipeRY * 0.5);
  hilite.addColorStop(0, "rgba(255,200,100,0.12)");
  hilite.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = hilite;
  ctx.fillRect(pipeLeft, pipeCY - pipeRY, pipeLen, pipeRY * 0.5);

  // Shadow stripe at bottom
  const shadow = ctx.createLinearGradient(0, pipeCY + pipeRY * 0.5, 0, pipeCY + pipeRY);
  shadow.addColorStop(0, "rgba(0,0,0,0)");
  shadow.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = shadow;
  ctx.fillRect(pipeLeft, pipeCY + pipeRY * 0.5, pipeLen, pipeRY * 0.5);

  // ── Weld lines (every ~12m at scale) ────────────────────────────────────────
  for (let wm = 0; wm <= VISIBLE_M; wm += 12) {
    const wx = pipeLeft + (wm / VISIBLE_M) * pipeLen;
    ctx.beginPath();
    ctx.moveTo(wx, pipeCY - pipeRY);
    ctx.lineTo(wx, pipeCY + pipeRY);
    ctx.strokeStyle = "rgba(80,65,30,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ── Defect patches ─────────────────────────────────────────────────────────
  defects.forEach(d => {
    const cx = pipeLeft + (d.pos_m / VISIBLE_M) * pipeLen;
    // Map clock angle to Y offset on visible pipe surface
    // 0°=top (visible max), 90°=side (half visible), 180°=bottom (inside shadow)
    const angleRad = (d.clock_deg * Math.PI) / 180;
    const yOffset  = Math.sin(angleRad) * pipeRY * 0.75;
    const xScale   = Math.abs(Math.cos(angleRad)) * 0.6 + 0.4; // perspective scale
    const hw = (d.length_mm / 1000) * pipeLen * (VISIBLE_M / VISIBLE_M) * (pipeLen / (VISIBLE_M * 33.33));
    const hh = (d.width_mm / od_mm) * pipeRY * 2 * xScale;
    const frac = d.depth_mm / wt_mm;
    const col = lossColor(frac);
    const isSelected = selected?.id === d.id;

    // Glow if selected
    if (isSelected) {
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 18;
    }
    const patchGrad = ctx.createRadialGradient(cx, pipeCY + yOffset, 0, cx, pipeCY + yOffset, Math.max(hw, hh) * 0.8);
    patchGrad.addColorStop(0, col + "cc");
    patchGrad.addColorStop(0.6, col + "66");
    patchGrad.addColorStop(1, col + "00");
    ctx.fillStyle = patchGrad;
    ctx.beginPath();
    ctx.ellipse(cx, pipeCY + yOffset, Math.max(hw * 0.5, 8), Math.max(hh * 0.5, 6), 0, 0, Math.PI * 2);
    ctx.fill();
    if (isSelected) ctx.restore();

    // Label
    ctx.font = "9px monospace";
    ctx.fillStyle = col;
    ctx.textAlign = "center";
    ctx.fillText(d.id, cx, pipeCY + yOffset - Math.max(hh * 0.5, 6) - 6);
  });

  // ── End caps (ellipses) ────────────────────────────────────────────────────
  [[pipeLeft, true], [pipeRight, false]].forEach(([ex, isLeft]) => {
    const x = ex as number;
    ctx.beginPath();
    ctx.ellipse(x, pipeCY, pipeRX, pipeRY, 0, 0, Math.PI * 2);
    const capGrad = ctx.createRadialGradient(x, pipeCY - pipeRY * 0.3, 0, x, pipeCY, pipeRY);
    capGrad.addColorStop(0, "#3a2f15");
    capGrad.addColorStop(0.5, "#1a1510");
    capGrad.addColorStop(1, "#050505");
    ctx.fillStyle = capGrad;
    ctx.fill();
    ctx.strokeStyle = "#2a2010";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Bore hole
    ctx.beginPath();
    ctx.ellipse(x, pipeCY, pipeRX * 0.72, pipeRY * 0.72, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#000";
    ctx.fill();
  });

  // Top/bottom edges of pipe body
  ctx.strokeStyle = "#2a2010";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pipeLeft, pipeCY - pipeRY);
  ctx.lineTo(pipeRight, pipeCY - pipeRY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pipeLeft, pipeCY + pipeRY);
  ctx.lineTo(pipeRight, pipeCY + pipeRY);
  ctx.stroke();

  // ── Crawler ────────────────────────────────────────────────────────────────
  const cX = pipeLeft + (crawlerX / VISIBLE_M) * pipeLen;
  const pulse = 0.4 + 0.6 * Math.abs(Math.sin(frame * 0.08));
  const glow = ctx.createRadialGradient(cX, pipeCY, 0, cX, pipeCY, 20);
  glow.addColorStop(0, `rgba(0,212,255,${pulse * 0.5})`);
  glow.addColorStop(1, "rgba(0,212,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cX - 22, pipeCY - 22, 44, 44);

  ctx.beginPath();
  ctx.arc(cX, pipeCY, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#00d4ff";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Pulse ring
  const pr = 6 + (frame % 28) * 0.9;
  ctx.beginPath();
  ctx.arc(cX, pipeCY, pr, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(0,212,255,${1 - (frame % 28) / 28})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Label
  ctx.font = "bold 9px monospace";
  ctx.fillStyle = "#00d4ff";
  ctx.textAlign = "center";
  ctx.fillText("CR-047", cX, pipeCY - 14);

  // ── Scale bar ──────────────────────────────────────────────────────────────
  const scaleLen = pipeLen / VISIBLE_M * 5;
  ctx.strokeStyle = "#8b949e";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pipeLeft, H - 18);
  ctx.lineTo(pipeLeft + scaleLen, H - 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pipeLeft, H - 22);
  ctx.lineTo(pipeLeft, H - 14);
  ctx.moveTo(pipeLeft + scaleLen, H - 22);
  ctx.lineTo(pipeLeft + scaleLen, H - 14);
  ctx.stroke();
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "#8b949e";
  ctx.textAlign = "center";
  ctx.fillText("5 m", pipeLeft + scaleLen / 2, H - 6);

  // ── Axis position labels ────────────────────────────────────────────────────
  ctx.textAlign = "center";
  [0, 5, 10, 15, 20, 25, 30].forEach(m => {
    const x = pipeLeft + (m / VISIBLE_M) * pipeLen;
    ctx.fillStyle = "#8b949e";
    ctx.font = "9px monospace";
    ctx.fillText(`${m}m`, x, H - 28);
    ctx.beginPath();
    ctx.moveTo(x, H - 38);
    ctx.lineTo(x, H - 33);
    ctx.strokeStyle = "#30363d";
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

// ── C-Scan (unrolled pipe surface) ────────────────────────────────────────────
function drawCScan(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  defects: Defect[],
  crawlerX: number,
) {
  const { wt_mm } = PIPE_SPEC;
  const VISIBLE_M = 30;
  const PAD = { top: 28, bottom: 28, left: 48, right: 12 };
  const pw = W - PAD.left - PAD.right;
  const ph = H - PAD.top - PAD.bottom;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, W, H);

  // Grid background
  ctx.fillStyle = "#0f1620";
  ctx.fillRect(PAD.left, PAD.top, pw, ph);

  // Grid lines
  ctx.strokeStyle = "#21262d";
  ctx.lineWidth = 0.5;
  for (let m = 0; m <= VISIBLE_M; m += 5) {
    const x = PAD.left + (m / VISIBLE_M) * pw;
    ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + ph); ctx.stroke();
    ctx.fillStyle = "#8b949e"; ctx.font = "9px monospace"; ctx.textAlign = "center";
    ctx.fillText(`${m}m`, x, PAD.top + ph + 14);
  }
  for (let deg = 0; deg <= 360; deg += 90) {
    const y = PAD.top + (deg / 360) * ph;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + pw, y); ctx.stroke();
    const labels: Record<number,string> = { 0: "12h", 90: "3h", 180: "6h", 270: "9h", 360: "12h" };
    ctx.fillStyle = "#8b949e"; ctx.font = "9px monospace"; ctx.textAlign = "right";
    ctx.fillText(labels[deg] ?? "", PAD.left - 4, y + 3);
  }

  // Axis labels
  ctx.fillStyle = "#8b949e"; ctx.font = "9px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("Axial Position", PAD.left + pw / 2, H - 4);
  ctx.save();
  ctx.translate(10, PAD.top + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Clock Position", 0, 0);
  ctx.restore();

  // Defect patches
  defects.forEach(d => {
    const frac = d.depth_mm / wt_mm;
    const col = lossColor(frac);
    const x0 = PAD.left + (d.pos_m / VISIBLE_M) * pw;
    const y0 = PAD.top  + (d.clock_deg / 360) * ph;
    const dw = (d.length_mm / 1000 / VISIBLE_M) * pw * 33;
    const dh = (d.width_mm / (Math.PI * PIPE_SPEC.od_mm) * 1000 / 360) * ph * 1000;

    // Colour blob
    const g = ctx.createRadialGradient(x0, y0, 0, x0, y0, Math.max(dw, dh) * 0.7);
    g.addColorStop(0, col + "cc");
    g.addColorStop(0.5, col + "66");
    g.addColorStop(1, col + "00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x0, y0, Math.max(dw * 0.5, 12), Math.max(dh * 0.5, 10), 0, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.font = "9px monospace"; ctx.fillStyle = col; ctx.textAlign = "left";
    ctx.fillText(`${d.id} −${d.depth_mm}mm`, x0 + 4, y0 - 4);
  });

  // Crawler line
  const cx = PAD.left + (crawlerX / VISIBLE_M) * pw;
  ctx.beginPath();
  ctx.moveTo(cx, PAD.top);
  ctx.lineTo(cx, PAD.top + ph);
  ctx.strokeStyle = "#00d4ff";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = "9px monospace"; ctx.fillStyle = "#00d4ff"; ctx.textAlign = "center";
  ctx.fillText("←CR-047", cx + 4, PAD.top - 8);

  // Legend
  const legItems = [
    { label: "< 20%",  c: "#39d353" },
    { label: "20–35%", c: "#7ee787" },
    { label: "35–50%", c: "#f5a623" },
    { label: "50–65%", c: "#ff6b35" },
    { label: "> 65%",  c: "#f85149" },
  ];
  let lx = PAD.left;
  ctx.textAlign = "left";
  legItems.forEach(({ label, c }) => {
    ctx.fillStyle = c;
    ctx.fillRect(lx, 10, 10, 10);
    ctx.fillStyle = "#8b949e"; ctx.font = "9px sans-serif";
    ctx.fillText(`Wall loss ${label}`, lx + 14, 19);
    lx += 110;
  });
}

// ── Cross-section view ────────────────────────────────────────────────────────
function drawXSection(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  defects: Defect[],
) {
  const { od_mm, wt_mm } = PIPE_SPEC;
  const cx = W / 2, cy = H / 2 + 10;
  const scale = Math.min(W, H) * 0.36 / (od_mm / 2);
  const OR = (od_mm / 2) * scale;
  const IR = ((od_mm / 2) - wt_mm) * scale;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, W, H);

  // Outer circle
  ctx.beginPath();
  ctx.arc(cx, cy, OR, 0, Math.PI * 2);
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();
  ctx.strokeStyle = "#30363d";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Wall arc (nominal) - coloured by severity per clock segment
  const SEGS = 360;
  for (let i = 0; i < SEGS; i++) {
    const a0 = (i / SEGS) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / SEGS) * Math.PI * 2 - Math.PI / 2;
    // Find max defect depth at this clock position
    const clockDeg = (i / SEGS) * 360;
    let maxDepth = 0;
    defects.forEach(d => {
      const angDiff = Math.abs(((clockDeg - d.clock_deg + 540) % 360) - 180);
      const angSpan = (d.width_mm / (Math.PI * od_mm)) * 360;
      if (angDiff <= angSpan / 2) maxDepth = Math.max(maxDepth, d.depth_mm);
    });
    const col = lossColor(maxDepth / wt_mm);
    ctx.beginPath();
    ctx.moveTo(cx + IR * Math.cos(a0), cy + IR * Math.sin(a0));
    ctx.arc(cx, cy, IR, a0, a1);
    ctx.arc(cx, cy, OR, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = maxDepth > 0 ? col + "cc" : "#2a2a2a";
    ctx.fill();
  }

  // Bore (inner) circle
  ctx.beginPath();
  ctx.arc(cx, cy, IR, 0, Math.PI * 2);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.strokeStyle = "#30363d";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Clock labels
  ctx.font = "10px monospace"; ctx.fillStyle = "#8b949e"; ctx.textAlign = "center";
  [["12h", 0], ["3h", 90], ["6h", 180], ["9h", 270]].forEach(([l, deg]) => {
    const a = (+deg - 90) * Math.PI / 180;
    const lr = OR + 16;
    ctx.fillText(l as string, cx + lr * Math.cos(a), cy + lr * Math.sin(a) + 4);
  });

  // Dimension labels
  ctx.fillStyle = "#8b949e"; ctx.font = "9px monospace"; ctx.textAlign = "left";
  // OD arrow
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + OR, cy);
  ctx.strokeStyle = "#58a6ff";
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 2]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#58a6ff";
  ctx.fillText(`OD = ${od_mm}mm`, cx + OR + 4, cy - 4);

  // WT arrow
  ctx.beginPath();
  ctx.moveTo(cx + IR, cy + 20);
  ctx.lineTo(cx + OR, cy + 20);
  ctx.strokeStyle = "#f5a623";
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 2]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#f5a623"; ctx.textAlign = "center";
  ctx.fillText(`WT = ${wt_mm}mm`, cx + (IR + OR) / 2, cy + 32);

  // Title
  ctx.fillStyle = "#e6edf3"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(`${PIPE_SPEC.od_in}" Cross Section — Colour = Wall Loss Severity`, cx, 16);
}

// ═════════════════════════════════════════════════════════════════════════════
export function PipeModel() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [view, setView]         = useState<View>("3d");
  const [selected, setSelected] = useState<Defect | null>(null);
  const [crawlerX, setCrawlerX] = useState(12.3);
  const [frame, setFrame]       = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setCrawlerX(p => { const n = p + 0.015; return n > 29 ? 0 : n; });
      setFrame(f => f + 1);
    }, 50);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    if (view === "3d")       draw3D(ctx, W, H, DEFECTS, crawlerX, frame, selected);
    else if (view === "cscan") drawCScan(ctx, W, H, DEFECTS, crawlerX);
    else                     drawXSection(ctx, W, H, DEFECTS);
  }, [view, crawlerX, frame, selected]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (view !== "3d") return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
    const VISIBLE_M = 30;
    const pL = 40, pR = canvas.width - 40;
    const pLen = pR - pL;
    const pCY  = canvas.height / 2;

    let nearest: Defect | null = null, minD = Infinity;
    DEFECTS.forEach(d => {
      const dx = pL + (d.pos_m / VISIBLE_M) * pLen;
      const angleRad = (d.clock_deg * Math.PI) / 180;
      const pipeRY = Math.min(canvas.height * 0.36, 120);
      const dy = pCY + Math.sin(angleRad) * pipeRY * 0.75;
      const dist = Math.hypot(mx - dx, my - dy);
      if (dist < minD) { minD = dist; nearest = d; }
    });
    setSelected(minD < 60 ? nearest : null);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
        {/* View selector */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#0d1117] border-b border-[#21262d]">
          {(["3d", "cscan", "xsection"] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded text-xs border transition-all ${
                view === v
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                  : "border-[#30363d] text-[#8b949e] hover:border-[#8b949e]/50"
              }`}>
              {v === "3d" ? "3D Perspective" : v === "cscan" ? "C-Scan (Unrolled)" : "Cross-Section"}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-[10px] text-[#8b949e]">
            {PIPE_SPEC.grade} · Ø{PIPE_SPEC.od_mm}mm · WT {PIPE_SPEC.wt_mm}mm
          </span>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <canvas
            ref={canvasRef}
            width={860}
            height={440}
            className="w-full h-full cursor-crosshair"
            onClick={handleClick}
          />
          {view === "3d" && (
            <div className="absolute bottom-8 right-3 text-[10px] font-mono text-[#8b949e] bg-black/50 px-2 py-1 rounded">
              Crawler: {crawlerX.toFixed(1)}m of 30m
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="w-56 bg-[#161b22] border-l border-[#21262d] flex flex-col overflow-y-auto text-[11px]">
        {/* Pipe spec */}
        <div className="p-3 border-b border-[#21262d]">
          <div className="text-[10px] text-[#8b949e] uppercase tracking-widest mb-2">Pipe Specification</div>
          {[
            ["Grade",        PIPE_SPEC.grade],
            ["OD",           `${PIPE_SPEC.od_mm} mm (${PIPE_SPEC.od_in}")`],
            ["Wall Thick.",  `${PIPE_SPEC.wt_mm} mm`],
            ["SMYS",         `${PIPE_SPEC.smys_mpa} MPa`],
            ["Medium",       PIPE_SPEC.medium],
            ["Op. Pressure", `${PIPE_SPEC.op_pressure_psi} PSI`],
            ["Installed",    PIPE_SPEC.year_installed.toString()],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-0.5">
              <span className="text-[#8b949e]">{k}</span>
              <span className="font-mono text-[#e6edf3] text-right">{v}</span>
            </div>
          ))}
        </div>

        {/* Defect list */}
        <div className="p-3 border-b border-[#21262d]">
          <div className="text-[10px] text-[#8b949e] uppercase tracking-widest mb-2">Defect Index</div>
          {DEFECTS.map(d => {
            const col = lossColor(d.depth_mm / PIPE_SPEC.wt_mm);
            const isActive = selected?.id === d.id;
            return (
              <button key={d.id} onClick={() => setSelected(s => s?.id === d.id ? null : d)}
                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded mb-1 transition-all ${
                  isActive ? "bg-[#1c2333] border border-cyan-500/30" : "hover:bg-[#1c2333] border border-transparent"
                }`}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: col }} />
                <span className="font-mono text-[#e6edf3]">{d.id}</span>
                <span className="text-[#8b949e] flex-1 truncate">{d.type}</span>
                <span className="font-mono text-right shrink-0" style={{ color: col }}>{d.pos_m}m</span>
              </button>
            );
          })}
        </div>

        {/* Selected defect detail */}
        {selected && (
          <div className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-cyan-400 font-mono">{selected.id}</span>
            </div>
            {[
              ["Type",          selected.type],
              ["Position",      `${selected.pos_m} m`],
              ["Clock",         `${selected.clock_deg}° (${Math.round(selected.clock_deg / 30)}h)`],
              ["Depth",         `${selected.depth_mm} mm`],
              ["Wall Loss",     `${((selected.depth_mm / PIPE_SPEC.wt_mm) * 100).toFixed(1)}%`],
              ["Length × W",   `${selected.length_mm} × ${selected.width_mm} mm`],
              ["Corr. Rate",    `${selected.rate_mm_yr} mm/yr`],
              ["ML Conf.",      `${selected.confidence}%`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-0.5 border-b border-[#21262d]/50 last:border-0">
                <span className="text-[#8b949e]">{k}</span>
                <span className={`font-mono ${
                  k === "Wall Loss" && selected.depth_mm / PIPE_SPEC.wt_mm > 0.5
                    ? "text-red-400" : "text-[#e6edf3]"
                }`}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
