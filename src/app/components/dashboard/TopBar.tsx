import { useState, useEffect } from "react";
import { Battery, Thermometer, Gauge, AlertTriangle, Clock, Signal, Radio } from "lucide-react";
import { PIPE_SPEC } from "./mockData";

export function TopBar() {
  const [time, setTime] = useState(new Date());
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    const b = setInterval(() => setBlink(p => !p), 900);
    return () => { clearInterval(t); clearInterval(b); };
  }, []);

  return (
    <header className="h-12 bg-[#0d1117] border-b border-[#21262d] flex items-center px-4 gap-4 shrink-0 z-20">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-3">
        <div className="w-6 h-6 rounded bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
          </svg>
        </div>
        <span className="text-[#e6edf3] text-sm font-semibold tracking-wide">PipeWatch<span className="text-cyan-400">AI</span></span>
      </div>

      {/* Live badge */}
      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] transition-all ${
        blink ? "bg-green-500/20 border border-green-500/40" : "bg-green-500/10 border border-green-500/20"
      }`}>
        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
        <span className="text-green-400 font-medium">LIVE</span>
      </div>

      {/* Pipe info */}
      <div className="text-[11px] text-[#8b949e]">
        {PIPE_SPEC.grade} · {PIPE_SPEC.od_in}" OD · WT {PIPE_SPEC.wt_mm}mm · {PIPE_SPEC.location}
      </div>

      <div className="flex-1" />

      {/* Metrics */}
      <div className="flex items-center gap-3 text-[11px]">
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-[#8b949e]">847 PSI</span>
        </div>
        <span className="text-[#30363d]">|</span>
        <div className="flex items-center gap-1.5">
          <Thermometer className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-[#8b949e]">38.2°C</span>
        </div>
        <span className="text-[#30363d]">|</span>
        <div className="flex items-center gap-1.5">
          <Signal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[#8b949e]">87%</span>
        </div>
        <span className="text-[#30363d]">|</span>
        <div className="flex items-center gap-1.5">
          <Battery className="w-3.5 h-3.5 text-green-400" />
          <span className="text-green-400">73%</span>
        </div>
        <span className="text-[#30363d]">|</span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 cursor-pointer">
          <AlertTriangle className="w-3 h-3 text-red-400" />
          <span className="text-red-400">3 Critical</span>
        </div>
        <span className="text-[#30363d]">|</span>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-[#8b949e]" />
          <span className="text-[#8b949e] font-mono">
            {time.toLocaleTimeString("en-US", { hour12: false })}
          </span>
        </div>
      </div>
    </header>
  );
}
