import { Video, Box, Brain, Wrench, Activity, FileText } from "lucide-react";
import { PIPE_SPEC } from "./mockData";

const NAV = [
  { id: "feed",        label: "Live Feed",    icon: Video,     dot: "bg-red-400 animate-pulse" },
  { id: "model",       label: "Pipe Model",   icon: Box,       dot: "" },
  { id: "ml",          label: "ML Analysis",  icon: Brain,     dot: "" },
  { id: "maintenance", label: "Maintenance",  icon: Wrench,    dot: "" },
  { id: "telemetry",   label: "Telemetry",    icon: Activity,  dot: "" },
  { id: "reports",     label: "Reports",      icon: FileText,  dot: "" },
];

export function Sidebar({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <aside className="w-48 bg-[#0d1117] border-r border-[#21262d] flex flex-col shrink-0">
      {/* Pipe identity */}
      <div className="px-3 py-3 border-b border-[#21262d]">
        <div className="bg-[#161b22] rounded-lg px-3 py-2.5 border border-[#30363d]">
          <div className="text-[10px] text-[#8b949e] uppercase tracking-widest mb-1">Active Inspection</div>
          <div className="text-sm text-cyan-400 font-mono font-semibold">CR-047</div>
          <div className="text-[11px] text-[#8b949e] mt-0.5">{PIPE_SPEC.grade}</div>
          <div className="text-[11px] text-[#8b949e]">Ø{PIPE_SPEC.od_in}" · WT {PIPE_SPEC.wt_mm}mm</div>
          <div className="mt-2 flex justify-between text-[10px]">
            <span className="text-[#8b949e]">Progress</span>
            <span className="text-cyan-400">70.6%</span>
          </div>
          <div className="mt-1 h-1 bg-[#30363d] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: "70.6%" }} />
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map(({ id, label, icon: Icon, dot }) => {
          const on = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                on
                  ? "bg-[#1c2333] border border-cyan-500/30 text-cyan-300"
                  : "border border-transparent text-[#8b949e] hover:bg-[#161b22] hover:text-[#e6edf3]"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs">{label}</span>
              {dot && <div className={`ml-auto w-1.5 h-1.5 rounded-full ${dot}`} />}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-2 border-t border-[#21262d] text-[10px] text-[#8b949e]">
        v2.4.1 · PipeWatchAI © 2026
      </div>
    </aside>
  );
}
