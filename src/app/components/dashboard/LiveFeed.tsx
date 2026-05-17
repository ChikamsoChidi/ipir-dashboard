import { useState, useEffect, useRef } from "react";
import {
  Play, Pause, Sun, Contrast, Circle,
  Download, ZoomIn, Radio
} from "lucide-react";
import { DEFECTS, PIPE_SPEC } from "./mockData";

// Detection boxes relative to feed viewport (%)
const FEED_DETECTIONS = [
  { id: "D-003", label: "Pitting Corrosion", conf: 94.7, x: 15, y: 20, w: 32, h: 28, color: "#f85149" },
  { id: "D-004", label: "Deposit / MIC",     conf: 82.1, x: 58, y: 50, w: 22, h: 18, color: "#58a6ff" },
];

const CAMERAS = ["Front · Wide", "Front · Zoom 4×", "Rear", "Side ◀", "Side ▶", "UV-Fluor"];

function useAnimated(base: number, amp: number, interval = 500) {
  const [v, setV] = useState(base);
  useEffect(() => {
    const t = setInterval(() => setV(base + (Math.random() - 0.5) * amp * 2), interval);
    return () => clearInterval(t);
  }, [base, amp, interval]);
  return v;
}

export function LiveFeed() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cam, setCam]               = useState("Front · Wide");
  const [playing, setPlaying]       = useState(true);
  const [overlay, setOverlay]       = useState(true);
  const [brightness, setBrightness] = useState(50);
  const [contrast, setContrast]     = useState(55);
  const [frame, setFrame]           = useState(0);
  const [scanY, setScanY]           = useState(0);

  const fps     = useAnimated(29.6, 0.6);
  const bitrate = useAnimated(12.4, 0.9);
  const latency = useAnimated(46, 8);

  // Paint pipe interior canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // ── Deep background ───────────────────────────────────────────────────────
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
    bg.addColorStop(0, "#1a1005");
    bg.addColorStop(0.55, "#0c0c0c");
    bg.addColorStop(1, "#000");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Pipe ring vignette ────────────────────────────────────────────────────
    const cx = W / 2, cy = H / 2;
    const outerR = Math.min(W, H) * 0.52;
    const vig = ctx.createRadialGradient(cx, cy, outerR * 0.58, cx, cy, outerR * 1.05);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(0.7, "rgba(0,0,0,0.5)");
    vig.addColorStop(1, "rgba(0,0,0,0.95)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // ── Pipe wall texture (rings perspective) ─────────────────────────────────
    for (let i = 0; i < 6; i++) {
      const r = outerR * (0.95 - i * 0.08);
      const ry = r * 0.38;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(60,40,15,${0.12 + i * 0.06})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // ── Weld seam (top vertical line) ─────────────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR * 0.4);
    ctx.lineTo(cx, cy + outerR * 0.4);
    ctx.strokeStyle = "rgba(80,60,20,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── Rust / corrosion patch (bottom-ish, matches D-003 5 o'clock) ─────────
    const patchCx = cx - 70, patchCy = cy + 55;
    const corrGrad = ctx.createRadialGradient(patchCx, patchCy, 0, patchCx, patchCy, 75);
    corrGrad.addColorStop(0, "rgba(140,30,0,0.85)");
    corrGrad.addColorStop(0.4, "rgba(90,20,0,0.55)");
    corrGrad.addColorStop(1, "rgba(40,10,0,0)");
    ctx.fillStyle = corrGrad;
    ctx.beginPath();
    ctx.ellipse(patchCx, patchCy, 75, 50, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Pitting texture
    for (let p = 0; p < 18; p++) {
      const px = patchCx + (Math.random() - 0.5) * 100;
      const py = patchCy + (Math.random() - 0.5) * 70;
      ctx.beginPath();
      ctx.arc(px, py, 2 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100,20,0,${0.4 + Math.random() * 0.4})`;
      ctx.fill();
    }

    // ── Deposit patch (right side, 3 o'clock) ─────────────────────────────────
    const depCx = cx + 90, depCy = cy + 20;
    const depGrad = ctx.createRadialGradient(depCx, depCy, 0, depCx, depCy, 45);
    depGrad.addColorStop(0, "rgba(60,55,30,0.75)");
    depGrad.addColorStop(1, "rgba(30,25,10,0)");
    ctx.fillStyle = depGrad;
    ctx.beginPath();
    ctx.ellipse(depCx, depCy, 45, 32, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // ── Crawler LED lights (two bright spots near center) ─────────────────────
    [[cx - 110, cy], [cx + 110, cy]].forEach(([lx, ly]) => {
      const light = ctx.createRadialGradient(lx, ly, 0, lx, ly, 90);
      light.addColorStop(0, "rgba(255,230,140,0.22)");
      light.addColorStop(1, "rgba(255,230,140,0)");
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, W, H);
    });

    // ── Horizontal scan line ──────────────────────────────────────────────────
    if (playing) {
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(W, scanY);
      ctx.strokeStyle = "rgba(0,212,255,0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // ── Brightness / contrast filter (faux) – done via CSS ───────────────────
  }, [frame, playing, scanY]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setFrame(f => f + 1);
      setScanY(y => (y + 3) % 400);
    }, 33);
    return () => clearInterval(t);
  }, [playing]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Main viewport ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-black">
        {/* Camera tabs */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0d1117] border-b border-[#21262d]">
          {CAMERAS.map(c => (
            <button key={c} onClick={() => setCam(c)}
              className={`px-2 py-0.5 rounded text-[11px] border transition-all ${
                cam === c
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                  : "border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]/40"
              }`}>{c}</button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 text-[11px]">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 font-medium">REC</span>
            <span className="font-mono text-[#8b949e]">02:14:38</span>
          </div>
        </div>

        {/* Canvas viewport */}
        <div className="relative flex-1 overflow-hidden flex items-center justify-center bg-black select-none">
          <canvas
            ref={canvasRef}
            width={800}
            height={450}
            className="w-full h-full object-contain"
            style={{
              filter: `brightness(${0.6 + brightness / 100}) contrast(${0.6 + contrast / 90})`,
            }}
          />

          {/* ML Detection Boxes */}
          {overlay && playing && (
            <div className="absolute inset-0 pointer-events-none">
              {FEED_DETECTIONS.map(d => (
                <div key={d.id} className="absolute border-2 transition-all"
                  style={{
                    left: `${d.x}%`, top: `${d.y}%`,
                    width: `${d.w}%`, height: `${d.h}%`,
                    borderColor: d.color,
                    boxShadow: `0 0 12px ${d.color}50`,
                  }}>
                  {/* Label */}
                  <div className="absolute -top-[22px] left-0 px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: d.color + "ee", color: "#000" }}>
                    {d.id} · {d.label} · {d.conf}%
                  </div>
                  {/* Corner marks */}
                  {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sy],i) => (
                    <div key={i} className="absolute w-2.5 h-2.5"
                      style={{
                        top: sy === -1 ? -1 : "auto",
                        bottom: sy === 1 ? -1 : "auto",
                        left: sx === -1 ? -1 : "auto",
                        right: sx === 1 ? -1 : "auto",
                        borderTop: sy === -1 ? `2px solid ${d.color}` : "none",
                        borderBottom: sy === 1 ? `2px solid ${d.color}` : "none",
                        borderLeft: sx === -1 ? `2px solid ${d.color}` : "none",
                        borderRight: sx === 1 ? `2px solid ${d.color}` : "none",
                      }} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* HUD */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-3 left-3 space-y-1 font-mono text-[10px]">
              <div className="bg-black/60 px-1.5 py-0.5 rounded text-cyan-400">{cam}</div>
              <div className="bg-black/60 px-1.5 py-0.5 rounded text-green-400">
                {playing ? `${fps.toFixed(1)} FPS` : "PAUSED"}
              </div>
              <div className="bg-black/60 px-1.5 py-0.5 rounded text-[#8b949e]">
                F:{frame.toString().padStart(6, "0")}
              </div>
            </div>
            <div className="absolute top-3 right-3 space-y-1 font-mono text-[10px] text-right">
              <div className="bg-black/60 px-1.5 py-0.5 rounded text-orange-400">POS 12.3m</div>
              <div className="bg-black/60 px-1.5 py-0.5 rounded text-yellow-400">WT≈4.3mm ⚠</div>
            </div>
            {/* Crosshair */}
            <div className="absolute inset-0 flex items-center justify-center opacity-15">
              <div className="relative w-14 h-14">
                <div className="absolute inset-y-0 left-1/2 w-px bg-cyan-400" />
                <div className="absolute inset-x-0 top-1/2 h-px bg-cyan-400" />
                <div className="absolute inset-3 rounded-full border border-cyan-400" />
              </div>
            </div>
            {/* Bottom bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-3 py-1 flex items-center gap-3 text-[10px] font-mono">
              <span className="text-cyan-400">{bitrate.toFixed(1)} Mbps</span>
              <span className="text-[#30363d]">|</span>
              <span className="text-yellow-400">{latency.toFixed(0)}ms</span>
              <span className="text-[#30363d]">|</span>
              <span className="text-[#8b949e]">H.264 · 1080p</span>
              <div className="flex-1" />
              {overlay && <span className="text-red-400">{FEED_DETECTIONS.length} active detections</span>}
            </div>
            {!playing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="text-[#8b949e] font-mono text-sm">FEED PAUSED</span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-[#0d1117] border-t border-[#21262d] px-3 py-2 flex items-center gap-3">
          <button onClick={() => setPlaying(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-xs hover:bg-cyan-500/30 transition-all">
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {playing ? "Pause" : "Resume"}
          </button>
          <div className="flex items-center gap-1.5 text-[11px] text-[#8b949e]">
            <Sun className="w-3.5 h-3.5" />
            <input type="range" min={10} max={90} value={brightness} onChange={e => setBrightness(+e.target.value)}
              className="w-20 h-1 accent-cyan-400" />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#8b949e]">
            <Contrast className="w-3.5 h-3.5" />
            <input type="range" min={10} max={90} value={contrast} onChange={e => setContrast(+e.target.value)}
              className="w-20 h-1 accent-cyan-400" />
          </div>
          <div className="flex-1" />
          <button onClick={() => setOverlay(p => !p)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] border transition-all ${
              overlay ? "bg-red-500/15 border-red-500/40 text-red-400" : "border-[#30363d] text-[#8b949e]"
            }`}>
            <Circle className="w-3 h-3" /> ML Boxes
          </button>
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] border border-[#30363d] text-[#8b949e] hover:border-cyan-500/40 hover:text-cyan-400 transition-all">
            <Download className="w-3 h-3" /> Snapshot
          </button>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div className="w-52 bg-[#161b22] border-l border-[#21262d] flex flex-col overflow-y-auto text-[11px]">
        <div className="p-3 border-b border-[#21262d]">
          <div className="text-[10px] text-[#8b949e] uppercase tracking-widest mb-2">Active Detections</div>
          {FEED_DETECTIONS.map(d => (
            <div key={d.id} className="mb-2 p-2 rounded-lg border" style={{ borderColor: d.color + "40", background: d.color + "0d" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold" style={{ color: d.color }}>{d.id}</span>
                <span className="font-mono" style={{ color: d.color }}>{d.conf}%</span>
              </div>
              <div className="text-[#8b949e] mb-1">{d.label}</div>
              <div className="h-1 bg-[#30363d] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${d.conf}%`, background: d.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-b border-[#21262d]">
          <div className="text-[10px] text-[#8b949e] uppercase tracking-widest mb-2">Stream Stats</div>
          {[
            ["Resolution", "1920×1080"],
            ["Codec", "H.264"],
            ["Bitrate", `${bitrate.toFixed(1)} Mbps`],
            ["FPS", fps.toFixed(1)],
            ["Latency", `${latency.toFixed(0)} ms`],
            ["Recording", "02:14:38"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-0.5">
              <span className="text-[#8b949e]">{k}</span>
              <span className="font-mono text-[#e6edf3]">{v}</span>
            </div>
          ))}
        </div>

        <div className="p-3">
          <div className="text-[10px] text-[#8b949e] uppercase tracking-widest mb-2">Defect Log</div>
          {DEFECTS.slice(0, 5).map(d => (
            <div key={d.id} className="py-1.5 border-b border-[#30363d]/50 last:border-0">
              <div className="flex items-center justify-between">
                <span className="font-mono text-cyan-400">{d.id}</span>
                <span className="text-[#8b949e] font-mono">{d.pos_m}m</span>
              </div>
              <div className="text-[#8b949e] text-[10px]">{d.type}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
