import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, PieChart, Pie
} from "recharts";
import { ML_CLASSES, DEFECTS, genInference } from "./mockData";
import { Brain, Cpu, Zap, Target } from "lucide-react";

const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c2333] border border-[#30363d] rounded-lg px-2.5 py-2 text-[11px]">
      <div className="text-[#8b949e] mb-1">{label ?? ""}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.stroke || p.fill || p.color }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const RADAR_DATA = [
  { m: "Precision",   v: 94.2 },
  { m: "Recall",      v: 91.7 },
  { m: "F1",          v: 92.9 },
  { m: "mAP@50",      v: 89.3 },
  { m: "mAP@95",      v: 72.4 },
  { m: "Specificity", v: 96.1 },
];

function useAnimated(base: number, amp: number, ms = 1000) {
  const [v, setV] = useState(base);
  useEffect(() => {
    const t = setInterval(() => setV(base + (Math.random() - 0.5) * amp * 2), ms);
    return () => clearInterval(t);
  }, [base, amp, ms]);
  return v;
}

export function MLAnalysis() {
  const [infData, setInfData] = useState(genInference());
  const fps   = useAnimated(29.6, 0.8);
  const gpu   = useAnimated(78, 10);
  const total = useAnimated(364, 4, 1500);

  useEffect(() => {
    const t = setInterval(() => {
      setInfData(prev => [
        ...prev.slice(1),
        { f: (prev[prev.length - 1]?.f ?? 25) + 1, ms: 26 + Math.random() * 14 },
      ]);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Model",          value: "YOLOv9-Pipe",     sub: "v2.4.1", icon: Brain, color: "#bc8cff" },
          { label: "Inference",      value: `${fps.toFixed(1)} FPS`, sub: `${infData[infData.length - 1]?.ms.toFixed(0)}ms / frame`, icon: Zap, color: "#00d4ff" },
          { label: "GPU Load",       value: `${gpu.toFixed(0)}%`,    sub: "NVIDIA A100 · 40GB", icon: Cpu, color: "#f5a623" },
          { label: "Total Detected", value: Math.round(total).toString(), sub: "Session total", icon: Target, color: "#39d353" },
        ].map(item => (
          <div key={item.label} className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: item.color + "22" }}>
              <item.icon className="w-5 h-5" style={{ color: item.color }} />
            </div>
            <div>
              <div className="text-[10px] text-[#8b949e] uppercase tracking-wider">{item.label}</div>
              <div className="text-sm font-semibold font-mono text-[#e6edf3]">{item.value}</div>
              <div className="text-[10px] text-[#8b949e]">{item.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Detection distribution */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="text-xs text-[#e6edf3] mb-3">Detection Distribution</div>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={ML_CLASSES} dataKey="count" nameKey="cls" cx="50%" cy="50%"
                outerRadius={68} innerRadius={38} paddingAngle={2}>
                {ML_CLASSES.map(d => <Cell key={d.cls} fill={d.color} />)}
              </Pie>
              <Tooltip content={<CT />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
            {ML_CLASSES.map(d => (
              <div key={d.cls} className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: d.color }} />
                <span className="text-[#8b949e] truncate">{d.cls}</span>
                <span className="ml-auto font-mono" style={{ color: d.color }}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Model performance radar */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="text-xs text-[#e6edf3] mb-3">Model Performance</div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={RADAR_DATA}>
              <PolarGrid stroke="#30363d" />
              <PolarAngleAxis dataKey="m" tick={{ fontSize: 9, fill: "#8b949e" }} />
              <Radar dataKey="v" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.15} strokeWidth={1.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Inference time */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[#e6edf3]">Inference Time (ms)</span>
            <span className="text-[10px] text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 rounded-full">LIVE</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={infData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="f" tick={{ fontSize: 8, fill: "#8b949e" }} />
              <YAxis domain={[20, 50]} tick={{ fontSize: 8, fill: "#8b949e" }} />
              <Tooltip content={<CT />} />
              <Line dataKey="ms" stroke="#00d4ff" strokeWidth={1.5} dot={false} name="ms" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Class-wise bar */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-xs text-[#e6edf3] mb-3">Class-wise Detection Count</div>
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={ML_CLASSES} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 8, fill: "#8b949e" }} />
            <YAxis type="category" dataKey="cls" tick={{ fontSize: 9, fill: "#8b949e" }} width={110} />
            <Tooltip content={<CT />} />
            <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
              {ML_CLASSES.map(d => <Cell key={d.cls} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detections table */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-xs text-[#e6edf3] mb-3">Defect Detection Log</div>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[#30363d] text-[#8b949e]">
              {["ID", "Type", "Position", "Depth", "Wall Loss", "ML Confidence", "Timestamp"].map(h => (
                <th key={h} className="text-left pb-2 font-normal text-[10px] uppercase tracking-wider pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEFECTS.map(d => {
              const wl = ((d.depth_mm / 9.5) * 100).toFixed(1);
              const cls = ML_CLASSES.find(m => m.cls.toLowerCase().includes(d.type.toLowerCase().split(" ")[0]));
              return (
                <tr key={d.id} className="border-b border-[#21262d]/50 hover:bg-[#1c2333] transition-colors">
                  <td className="py-2 pr-4 font-mono text-cyan-400">{d.id}</td>
                  <td className="py-2 pr-4">
                    <span className="px-1.5 py-0.5 rounded text-[10px]"
                      style={{ background: (cls?.color ?? "#8b949e") + "22", color: cls?.color ?? "#8b949e" }}>
                      {d.type}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-[#8b949e]">{d.pos_m}m · {d.clock_deg}°</td>
                  <td className="py-2 pr-4 font-mono text-[#e6edf3]">{d.depth_mm}mm</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 bg-[#30363d] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${wl}%`, background: +wl >= 50 ? "#f85149" : +wl >= 35 ? "#f5a623" : "#39d353" }} />
                      </div>
                      <span className="font-mono text-[#e6edf3]">{wl}%</span>
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 bg-[#30363d] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${d.confidence}%` }} />
                      </div>
                      <span className="font-mono text-cyan-400">{d.confidence}%</span>
                    </div>
                  </td>
                  <td className="py-2 font-mono text-[#8b949e]">{d.timestamp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
