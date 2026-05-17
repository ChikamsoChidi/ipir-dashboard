import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, BarChart, Bar, Cell } from "recharts";
import { PIPE_SPEC, DEFECTS, computeB31G, BURST_PRESSURE_MPA, MAOP_MPA, type Defect } from "./mockData";
import { AlertTriangle, CheckCircle, Clock, Shield, TrendingDown } from "lucide-react";

const ACTION_COLOR: Record<string, string> = {
  MONITOR:   "#39d353",
  SCHEDULE:  "#f5a623",
  URGENT:    "#ff6b35",
  IMMEDIATE: "#f85149",
};
const ACTION_LABEL: Record<string, string> = {
  MONITOR:   "Monitor — within limits",
  SCHEDULE:  "Schedule repair within 6 months",
  URGENT:    "Urgent — repair within 30 days",
  IMMEDIATE: "IMMEDIATE shutdown / repair",
};

// ─── Depth vs. time projection for a defect ──────────────────────────────────
function projectionData(d: Defect) {
  const points: { yr: number; depth: number; Pf: number; limit: number }[] = [];
  const { wt_mm } = PIPE_SPEC;
  for (let yr = 0; yr <= 15; yr++) {
    const projDepth = Math.min(d.depth_mm + d.rate_mm_yr * yr, wt_mm);
    // Simplified Pf trend (full B31G would need full recalc; approximate here)
    const frac = projDepth / wt_mm;
    const Pf_approx = BURST_PRESSURE_MPA * (1 - frac * 0.9);
    points.push({
      yr,
      depth:  +projDepth.toFixed(3),
      Pf:     +Pf_approx.toFixed(2),
      limit:  +(PIPE_SPEC.op_pressure_mpa).toFixed(2),
    });
  }
  return points;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c2333] border border-[#30363d] rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-[#8b949e] mb-1">Year +{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.stroke || p.color }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(p.name === "depth" ? 2 : 2) : p.value}</strong>
          {p.name === "depth" ? " mm" : p.name === "Pf" || p.name === "limit" ? " MPa" : ""}
        </div>
      ))}
    </div>
  );
};

export function PredictiveMaintenance() {
  const [active, setActive] = useState<Defect>(DEFECTS[2]); // D-003 default (most critical)

  const res = computeB31G(active);
  const proj = projectionData(active);
  const actionColor = ACTION_COLOR[res.action];

  // All defects summary for the bar chart
  const summary = DEFECTS.map(d => {
    const r = computeB31G(d);
    return { id: d.id, ERF: r.ERF, life: r.remainingLife_yr, action: r.action };
  });

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: defect picker ────────────────────────────────────────────── */}
      <div className="w-44 bg-[#161b22] border-r border-[#21262d] flex flex-col overflow-y-auto text-[11px] shrink-0">
        <div className="p-3 border-b border-[#21262d]">
          <div className="text-[10px] text-[#8b949e] uppercase tracking-widest">Select Defect</div>
        </div>
        {DEFECTS.map(d => {
          const r = computeB31G(d);
          const col = ACTION_COLOR[r.action];
          return (
            <button key={d.id} onClick={() => setActive(d)}
              className={`w-full text-left px-3 py-2.5 border-b border-[#21262d]/50 transition-all ${
                active.id === d.id ? "bg-[#1c2333]" : "hover:bg-[#161b22]/80"
              }`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: col }} />
                <span className="font-mono text-[#e6edf3]">{d.id}</span>
              </div>
              <div className="text-[#8b949e] text-[10px] truncate">{d.type}</div>
              <div className="text-[10px] mt-0.5" style={{ color: col }}>{r.action}</div>
            </button>
          );
        })}
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-cyan-400">{active.id}</span>
              <span className="text-[#e6edf3]">— {active.type}</span>
              <span className="text-[#8b949e] text-[11px]">at {active.pos_m}m · {active.clock_deg}° ({Math.round(active.clock_deg/30)}h)</span>
            </div>
            <div className="text-[11px] text-[#8b949e]">
              Assessment method: <span className="text-[#e6edf3]">Modified B31G (ASME B31G-2012 / Kiefner & Vieth)</span>
            </div>
          </div>
          <div className="shrink-0 px-3 py-2 rounded-lg border text-xs font-semibold text-center min-w-36"
            style={{ background: actionColor + "22", borderColor: actionColor + "66", color: actionColor }}>
            {res.action}<br />
            <span className="text-[10px] font-normal">{ACTION_LABEL[res.action]}</span>
          </div>
        </div>

        {/* ── Engineering parameters grid ───────────────────────────────────── */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="text-xs text-[#8b949e] uppercase tracking-widest mb-3">
            Modified B31G Corrosion Assessment
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-0">
            {/* Input column */}
            <div className="col-span-2 md:col-span-1">
              <div className="text-[10px] text-cyan-400 uppercase tracking-wider mb-1.5">Pipe Inputs</div>
              {[
                ["OD (D)",   `${PIPE_SPEC.od_mm} mm`],
                ["WT (t)",   `${PIPE_SPEC.wt_mm} mm`],
                ["SMYS",     `${PIPE_SPEC.smys_mpa} MPa`],
                ["Pop",      `${PIPE_SPEC.op_pressure_mpa} MPa`],
                ["MAOP",     `${MAOP_MPA.toFixed(2)} MPa`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b border-[#21262d]/50 text-[11px]">
                  <span className="text-[#8b949e] font-mono">{k}</span>
                  <span className="font-mono text-[#e6edf3]">{v}</span>
                </div>
              ))}
            </div>
            {/* Defect column */}
            <div className="col-span-2 md:col-span-1">
              <div className="text-[10px] text-orange-400 uppercase tracking-wider mb-1.5">Defect Measurements</div>
              {[
                ["Depth (d)",       `${active.depth_mm} mm`],
                ["Length (L)",      `${active.length_mm} mm`],
                ["Width (W)",       `${active.width_mm} mm`],
                ["d / t",           `${(active.depth_mm / PIPE_SPEC.wt_mm).toFixed(3)}`],
                ["Corr. Rate",      `${active.rate_mm_yr} mm/yr`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b border-[#21262d]/50 text-[11px]">
                  <span className="text-[#8b949e] font-mono">{k}</span>
                  <span className="font-mono text-[#e6edf3]">{v}</span>
                </div>
              ))}
            </div>
            {/* Calculated column */}
            <div className="col-span-2 md:col-span-1">
              <div className="text-[10px] text-purple-400 uppercase tracking-wider mb-1.5">Calculated Values</div>
              {[
                ["Z  (L²/Dt)",        res.z_factor.toString()],
                ["M  (Folias)",        res.folias_M.toString()],
                ["A  (0.85·d/t)",      ((0.85 * active.depth_mm / PIPE_SPEC.wt_mm).toFixed(3))],
                ["Wall Loss",          `${res.wallLossPct} %`],
                ["Remain. WT",         `${res.remainingWt_mm} mm`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b border-[#21262d]/50 text-[11px]">
                  <span className="text-[#8b949e] font-mono">{k}</span>
                  <span className="font-mono text-[#e6edf3]">{v}</span>
                </div>
              ))}
            </div>
            {/* Results column */}
            <div className="col-span-2 md:col-span-1">
              <div className="text-[10px] text-green-400 uppercase tracking-wider mb-1.5">Assessment Results</div>
              {[
                ["Pf (fail.press.)", `${res.Pf_mpa} MPa`],
                ["Pf (PSI)",         `${res.Pf_psi} PSI`],
                ["ERF (Pop/Pf)",      `${res.ERF}`],
                ["Remaining Life",    `${res.remainingLife_yr} yr`],
                ["Next Insp.",        `${res.nextInspection_yr} yr`],
              ].map(([k, v]) => {
                const isCrit = k === "ERF (Pop/Pf)" && res.ERF >= 0.8;
                const isLife = k === "Remaining Life" && res.remainingLife_yr < 5;
                return (
                  <div key={k} className="flex justify-between py-1 border-b border-[#21262d]/50 text-[11px]">
                    <span className="text-[#8b949e] font-mono">{k}</span>
                    <span className={`font-mono font-semibold ${isCrit || isLife ? "text-red-400" : "text-[#e6edf3]"}`}>{v}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ERF gauge */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-[#8b949e]">Estimated Repair Factor (ERF) — threshold = 1.0</span>
              <span className="font-mono font-semibold" style={{ color: actionColor }}>{res.ERF} / 1.000</span>
            </div>
            <div className="relative h-3 bg-[#30363d] rounded-full overflow-hidden">
              {/* Background zones */}
              <div className="absolute inset-0 flex">
                <div className="flex-1 bg-green-900/40" style={{ width: "60%" }} />
                <div className="flex-1 bg-yellow-900/40" style={{ width: "20%" }} />
                <div className="flex-1 bg-red-900/40"  style={{ width: "20%" }} />
              </div>
              {/* ERF bar */}
              <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{ width: `${Math.min(res.ERF * 100, 100)}%`, background: actionColor }} />
              {/* ERF = 1.0 marker */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-white/50" style={{ left: "100%" }} />
            </div>
            <div className="flex justify-between text-[9px] text-[#8b949e] mt-0.5">
              <span>0.0 — Safe</span>
              <span>0.6</span>
              <span>0.8</span>
              <span>1.0 — Failure threshold</span>
            </div>
          </div>
        </div>

        {/* ── Projection charts ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Depth projection */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
            <div className="text-xs text-[#e6edf3] mb-3">
              Corrosion Depth Projection (at {active.rate_mm_yr} mm/yr)
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={proj}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="yr" tick={{ fontSize: 9, fill: "#8b949e" }} label={{ value: "Years", position: "insideBottom", offset: -2, fill: "#8b949e", fontSize: 9 }} />
                <YAxis domain={[0, PIPE_SPEC.wt_mm + 1]} tick={{ fontSize: 9, fill: "#8b949e" }} unit="mm" />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={PIPE_SPEC.wt_mm} stroke="#f85149" strokeDasharray="4 2" label={{ value: "WT limit", fill: "#f85149", fontSize: 9 }} />
                <ReferenceLine y={res.dCrit_mm} stroke="#f5a623" strokeDasharray="4 2" label={{ value: "d_crit", fill: "#f5a623", fontSize: 9 }} />
                <Line dataKey="depth" stroke="#ff6b35" strokeWidth={2} dot={false} name="depth" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Failure pressure projection */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
            <div className="text-xs text-[#e6edf3] mb-3">
              Remaining Failure Pressure Projection (MPa)
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={proj}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="yr" tick={{ fontSize: 9, fill: "#8b949e" }} label={{ value: "Years", position: "insideBottom", offset: -2, fill: "#8b949e", fontSize: 9 }} />
                <YAxis domain={[0, BURST_PRESSURE_MPA + 2]} tick={{ fontSize: 9, fill: "#8b949e" }} unit=" MPa" />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={PIPE_SPEC.op_pressure_mpa} stroke="#f85149" strokeDasharray="4 2" label={{ value: "Pop", fill: "#f85149", fontSize: 9 }} />
                <ReferenceLine y={MAOP_MPA} stroke="#f5a623" strokeDasharray="4 2" label={{ value: "MAOP", fill: "#f5a623", fontSize: 9 }} />
                <Line dataKey="Pf" stroke="#00d4ff" strokeWidth={2} dot={false} name="Pf" />
                <Line dataKey="limit" stroke="#f85149" strokeWidth={1} strokeDasharray="4 2" dot={false} name="limit" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── All-defects comparison ─────────────────────────────────────────── */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="text-xs text-[#e6edf3] mb-3">
            ERF Comparison — All Defects (threshold = 1.0)
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={summary} layout="vertical">
              <XAxis type="number" domain={[0, 1.0]} tick={{ fontSize: 9, fill: "#8b949e" }} />
              <YAxis type="category" dataKey="id" tick={{ fontSize: 9, fill: "#8b949e" }} width={40} />
              <Tooltip formatter={(v: number) => v.toFixed(3)} />
              <ReferenceLine x={1.0} stroke="#f85149" strokeDasharray="3 2" />
              <Bar dataKey="ERF" name="ERF" radius={[0, 3, 3, 0]}>
                {summary.map(s => (
                  <Cell key={s.id} fill={ACTION_COLOR[s.action]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
            {summary.map(s => (
              <div key={s.id} className="text-[10px] text-center">
                <div className="font-mono text-[#e6edf3]">{s.id}</div>
                <div className="font-mono" style={{ color: ACTION_COLOR[s.action] }}>ERF {s.ERF}</div>
                <div className="text-[#8b949e]">{s.life} yr left</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
