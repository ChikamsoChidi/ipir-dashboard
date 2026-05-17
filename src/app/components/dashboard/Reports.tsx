import { useState } from "react";
import { FileText, Download, Printer, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { PIPE_SPEC, DEFECTS, computeB31G, BURST_PRESSURE_MPA, MAOP_MPA } from "./mockData";

const ACTION_COLOR: Record<string, string> = {
  MONITOR: "#39d353", SCHEDULE: "#f5a623", URGENT: "#ff6b35", IMMEDIATE: "#f85149",
};

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#30363d] rounded-xl overflow-hidden mb-4">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#161b22] hover:bg-[#1c2333] transition-colors"
      >
        <span className="text-xs font-semibold text-[#e6edf3] uppercase tracking-widest">{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-[#8b949e]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#8b949e]" />}
      </button>
      {open && <div className="bg-[#0d1117] p-4">{children}</div>}
    </div>
  );
}

export function Reports() {
  const [saved, setSaved] = useState(false);
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour12: false });

  const totalWallLoss = DEFECTS.reduce((sum, d) => sum + (d.depth_mm / PIPE_SPEC.wt_mm) * 100, 0) / DEFECTS.length;
  const criticalCount = DEFECTS.filter(d => computeB31G(d).action === "IMMEDIATE" || computeB31G(d).action === "URGENT").length;
  const overallStatus = criticalCount > 0 ? "ACTION REQUIRED" : "ACCEPTABLE";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#161b22] border-b border-[#21262d] shrink-0">
        <span className="text-xs text-[#8b949e] flex-1">Inspection Report — {dateStr} {timeStr}</span>
        <button
          onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 3000); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-xs hover:bg-cyan-500/30 transition-all"
        >
          {saved ? <CheckCircle className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
          {saved ? "Saved!" : "Save Report"}
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] text-xs hover:border-cyan-500/40 hover:text-cyan-400 transition-all">
          <Download className="w-3.5 h-3.5" /> Export PDF
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] text-xs hover:border-cyan-500/40 hover:text-cyan-400 transition-all">
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* ── Report header ────────────────────────────────────────────────── */}
        <div className="mb-4 bg-[#161b22] border border-[#30363d] rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] text-[#8b949e] uppercase tracking-widest mb-1">In-Line Inspection Report</div>
              <div className="text-base text-[#e6edf3] font-semibold">
                Pipeline Crawler Inspection — {PIPE_SPEC.location}
              </div>
              <div className="text-xs text-[#8b949e] mt-1">
                Crawler ID: CR-047 · Date: {dateStr} · Inspector: PipeWatchAI v2.4.1
              </div>
            </div>
            <div className={`px-3 py-2 rounded-lg border text-xs font-semibold ${
              overallStatus === "ACCEPTABLE"
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
              {overallStatus === "ACCEPTABLE" ? <CheckCircle className="w-4 h-4 mb-1 mx-auto" /> : <AlertTriangle className="w-4 h-4 mb-1 mx-auto" />}
              {overallStatus}
            </div>
          </div>
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            {[
              ["Pipe Grade",     PIPE_SPEC.grade],
              ["Total Length",   `${PIPE_SPEC.total_length_m} m`],
              ["Length Scanned", `${PIPE_SPEC.scanned_m} m (70.6%)`],
              ["Defects Found",  DEFECTS.length.toString()],
              ["Avg. Wall Loss", `${totalWallLoss.toFixed(1)}%`],
            ].map(([k, v]) => (
              <div key={k} className="bg-[#0d1117] rounded-lg px-3 py-2">
                <div className="text-[10px] text-[#8b949e]">{k}</div>
                <div className="text-xs font-semibold font-mono text-[#e6edf3]">{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Pipe specification ───────────────────────────────────────────── */}
        <Section title="1 · Pipe Specification">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-0 text-[11px]">
            {[
              ["Material Grade",        PIPE_SPEC.grade],
              ["Outside Diameter",      `${PIPE_SPEC.od_mm} mm (${PIPE_SPEC.od_in}")`],
              ["Wall Thickness (nom.)", `${PIPE_SPEC.wt_mm} mm`],
              ["SMYS",                  `${PIPE_SPEC.smys_mpa} MPa (${(PIPE_SPEC.smys_mpa * 145.038 / 1000).toFixed(0)} ksi)`],
              ["SMTS",                  `${PIPE_SPEC.smts_mpa} MPa`],
              ["Design Factor",         PIPE_SPEC.design_factor.toString()],
              ["Burst Pressure",        `${BURST_PRESSURE_MPA.toFixed(2)} MPa`],
              ["MAOP",                  `${MAOP_MPA.toFixed(2)} MPa (${(MAOP_MPA * 145.038).toFixed(0)} PSI)`],
              ["Op. Pressure",          `${PIPE_SPEC.op_pressure_psi} PSI (${PIPE_SPEC.op_pressure_mpa} MPa)`],
              ["Medium",                PIPE_SPEC.medium],
              ["Coating",               PIPE_SPEC.coating],
              ["Year Installed",        PIPE_SPEC.year_installed.toString()],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1.5 border-b border-[#21262d]/50">
                <span className="text-[#8b949e]">{k}</span>
                <span className="font-mono text-[#e6edf3] text-right">{v}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Defect table ─────────────────────────────────────────────────── */}
        <Section title="2 · Detected Anomalies">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#30363d] text-[#8b949e]">
                  {["ID", "Type", "Pos. (m)", "Clock", "Depth (mm)", "d/t (%)", "L × W (mm)", "Rate (mm/yr)", "Conf. (%)", "Timestamp"].map(h => (
                    <th key={h} className="text-left py-2 pr-4 font-normal text-[10px] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEFECTS.map(d => {
                  const wl = (d.depth_mm / PIPE_SPEC.wt_mm) * 100;
                  return (
                    <tr key={d.id} className="border-b border-[#21262d]/50 hover:bg-[#161b22] transition-colors">
                      <td className="py-2 pr-4 font-mono text-cyan-400">{d.id}</td>
                      <td className="py-2 pr-4 text-[#e6edf3]">{d.type}</td>
                      <td className="py-2 pr-4 font-mono text-[#e6edf3]">{d.pos_m}</td>
                      <td className="py-2 pr-4 font-mono text-[#8b949e]">{d.clock_deg}°</td>
                      <td className="py-2 pr-4 font-mono text-[#e6edf3]">{d.depth_mm}</td>
                      <td className="py-2 pr-4">
                        <span className={`font-mono ${wl >= 50 ? "text-red-400" : wl >= 35 ? "text-yellow-400" : "text-green-400"}`}>
                          {wl.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-[#8b949e]">{d.length_mm} × {d.width_mm}</td>
                      <td className="py-2 pr-4 font-mono text-[#e6edf3]">{d.rate_mm_yr}</td>
                      <td className="py-2 pr-4 font-mono text-[#e6edf3]">{d.confidence}</td>
                      <td className="py-2 font-mono text-[#8b949e]">{d.timestamp}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── B31G assessment table ────────────────────────────────────────── */}
        <Section title="3 · Modified B31G Fitness-for-Service Assessment">
          <div className="text-[11px] text-[#8b949e] mb-3">
            Assessment standard: ASME B31G-2012 / Modified B31G (Kiefner & Vieth). ERF ≥ 1.0 requires immediate remediation.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#30363d] text-[#8b949e]">
                  {["ID", "Z", "M (Folias)", "A (0.85d/t)", "Wall Loss", "Rem. WT", "Pf (MPa)", "ERF", "Life (yr)", "Action"].map(h => (
                    <th key={h} className="text-left py-2 pr-4 font-normal text-[10px] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEFECTS.map(d => {
                  const r = computeB31G(d);
                  const ac = ACTION_COLOR[r.action];
                  return (
                    <tr key={d.id} className="border-b border-[#21262d]/50 hover:bg-[#161b22]">
                      <td className="py-2 pr-4 font-mono text-cyan-400">{d.id}</td>
                      <td className="py-2 pr-4 font-mono text-[#8b949e]">{r.z_factor}</td>
                      <td className="py-2 pr-4 font-mono text-[#8b949e]">{r.folias_M}</td>
                      <td className="py-2 pr-4 font-mono text-[#8b949e]">{(0.85 * d.depth_mm / PIPE_SPEC.wt_mm).toFixed(3)}</td>
                      <td className="py-2 pr-4">
                        <span className={`font-mono ${r.wallLossPct >= 50 ? "text-red-400" : r.wallLossPct >= 35 ? "text-yellow-400" : "text-green-400"}`}>
                          {r.wallLossPct}%
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-[#e6edf3]">{r.remainingWt_mm} mm</td>
                      <td className="py-2 pr-4 font-mono text-[#e6edf3]">{r.Pf_mpa}</td>
                      <td className="py-2 pr-4 font-mono font-semibold" style={{ color: r.ERF >= 0.8 ? "#f85149" : r.ERF >= 0.6 ? "#f5a623" : "#39d353" }}>
                        {r.ERF}
                      </td>
                      <td className="py-2 pr-4 font-mono" style={{ color: r.remainingLife_yr < 5 ? "#f5a623" : "#39d353" }}>
                        {r.remainingLife_yr > 50 ? ">50" : r.remainingLife_yr}
                      </td>
                      <td className="py-2">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full border font-semibold"
                          style={{ background: ac + "22", borderColor: ac + "66", color: ac }}>
                          {r.action}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Recommendations ──────────────────────────────────────────────── */}
        <Section title="4 · Recommendations & Next Steps">
          <div className="space-y-2">
            {DEFECTS.map(d => {
              const r = computeB31G(d);
              const ac = ACTION_COLOR[r.action];
              return (
                <div key={d.id} className="flex gap-3 p-3 rounded-lg border" style={{ background: ac + "0a", borderColor: ac + "44" }}>
                  <div className="w-1 rounded-full shrink-0" style={{ background: ac }} />
                  <div className="flex-1 text-[11px]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono font-semibold" style={{ color: ac }}>{r.action} — {d.id}</span>
                      <span className="text-[#8b949e]">{d.type} at {d.pos_m}m</span>
                    </div>
                    <div className="text-[#8b949e]">
                      Wall loss {r.wallLossPct}% · ERF {r.ERF} · Remaining life ≈ {r.remainingLife_yr > 50 ? ">50" : r.remainingLife_yr} yr ·
                      Next inspection in {r.nextInspection_yr} yr ·
                      Corrosion rate {d.rate_mm_yr} mm/yr
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── Telemetry summary ────────────────────────────────────────────── */}
        <Section title="5 · Telemetry Snapshot" defaultOpen={false}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px]">
            {[
              ["Operating Pressure",   "847 PSI"],
              ["Temperature (pipe)",   "38.2°C"],
              ["Ambient Temp.",        "32.0°C"],
              ["Flow Rate",            "12.4 L/s"],
              ["Crawler Speed",        "2.1 m/min"],
              ["Battery",              "73%"],
              ["Signal Strength",      "87% (4G-LTE)"],
              ["Vibration",            "0.22 m/s²"],
              ["IMU X/Y/Z",           "−0.04 / 0.02 / 0.01 g"],
              ["GPU Utilization",      "78%"],
              ["Inference Time (avg)", "31 ms / 29.8 FPS"],
              ["Storage Used",         "14.2 GB"],
            ].map(([k, v]) => (
              <div key={k} className="border-b border-[#21262d]/50 pb-2">
                <div className="text-[#8b949e]">{k}</div>
                <div className="font-mono text-[#e6edf3]">{v}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Signature block */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 text-[11px]">
          <div className="grid grid-cols-3 gap-8">
            {["Prepared by: PipeWatchAI v2.4.1", "Reviewed by: ________________", "Approved by: ________________"].map(l => (
              <div key={l}>
                <div className="text-[#8b949e]">{l}</div>
                <div className="text-[#8b949e] mt-3">Date: {dateStr}</div>
                <div className="mt-4 border-t border-[#30363d]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
