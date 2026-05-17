import { useState, useEffect } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { genPressure, genTemp, genFlow, genVibration, genIMU, PIPE_SPEC, MAOP_MPA } from "./mockData";
import { Activity, Thermometer, Gauge, Droplets, Wifi, Battery } from "lucide-react";

const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c2333] border border-[#30363d] rounded-lg px-2.5 py-2 text-[11px]">
      <div className="text-[#8b949e] mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.stroke || p.color || p.fill }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const MAOP_PSI = MAOP_MPA * 145.038;

function Stat({ label, value, sub, color, icon: Icon }: { label: string; value: string; sub?: string; color: string; icon: React.ElementType }) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + "22" }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <div className="text-[10px] text-[#8b949e] uppercase tracking-wider">{label}</div>
        <div className="text-sm font-semibold font-mono" style={{ color }}>{value}</div>
        {sub && <div className="text-[10px] text-[#8b949e]">{sub}</div>}
      </div>
    </div>
  );
}

export function Telemetry() {
  const [pData, setPData] = useState(genPressure());
  const [tData, setTData] = useState(genTemp());
  const [fData, setFData] = useState(genFlow());
  const [vData, setVData] = useState(genVibration());
  const [iData, setIData] = useState(genIMU());

  useEffect(() => {
    const t = setInterval(() => {
      setPData(genPressure());
      setTData(genTemp());
      setFData(genFlow());
      setVData(genVibration());
      setIData(genIMU());
    }, 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <Stat label="Pressure"    value="847 PSI"  sub={`MAOP ${MAOP_PSI.toFixed(0)} PSI`}   color="#f5a623" icon={Gauge} />
        <Stat label="Temperature" value="38.2 °C"  sub="Ambient 32°C"                          color="#ff8c42" icon={Thermometer} />
        <Stat label="Flow Rate"   value="12.4 L/s" sub="Target 13 L/s"                         color="#58a6ff" icon={Droplets} />
        <Stat label="Signal"      value="87%"       sub="4G-LTE"                                color="#00d4ff" icon={Wifi} />
        <Stat label="Battery"     value="73%"       sub="≈4h 12m left"                          color="#39d353" icon={Battery} />
        <Stat label="Vibration"   value="0.22 m/s²" sub="Normal < 0.5"                          color="#bc8cff" icon={Activity} />
      </div>

      {/* Pressure + Temperature */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#e6edf3]">Operating Pressure (PSI)</span>
            <span className="text-[10px] text-orange-400 font-mono">847 PSI</span>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={pData}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f5a623" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f5a623" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="t" tick={{ fontSize: 8, fill: "#8b949e" }} interval={5} />
              <YAxis domain={[780, 920]} tick={{ fontSize: 8, fill: "#8b949e" }} />
              <Tooltip content={<CT />} />
              <ReferenceLine y={MAOP_PSI} stroke="#f85149" strokeDasharray="3 2" strokeWidth={1} label={{ value: "MAOP", fill: "#f85149", fontSize: 8 }} />
              <Area dataKey="value" stroke="#f5a623" fill="url(#pg)" strokeWidth={1.5} dot={false} name="PSI" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#e6edf3]">Temperature (°C)</span>
            <span className="text-[10px] text-yellow-400 font-mono">38.2°C</span>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={tData}>
              <defs>
                <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff8c42" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ff8c42" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="t" tick={{ fontSize: 8, fill: "#8b949e" }} interval={5} />
              <YAxis domain={[28, 48]} tick={{ fontSize: 8, fill: "#8b949e" }} />
              <Tooltip content={<CT />} />
              <Area dataKey="pipe" stroke="#ff8c42" fill="url(#tg)" strokeWidth={1.5} dot={false} name="Pipe °C" />
              <Line dataKey="ambient" stroke="#8b949e" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Ambient" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Flow + UT wall thickness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#e6edf3]">Flow Rate (L/s)</span>
            <span className="text-[10px] text-blue-400 font-mono">12.4 L/s</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={fData}>
              <defs>
                <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#58a6ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="t" tick={{ fontSize: 8, fill: "#8b949e" }} interval={5} />
              <YAxis domain={[8, 16]} tick={{ fontSize: 8, fill: "#8b949e" }} />
              <Tooltip content={<CT />} />
              <Area dataKey="value" stroke="#58a6ff" fill="url(#fg)" strokeWidth={1.5} dot={false} name="L/s" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#e6edf3]">UT Wall Thickness Profile (mm)</span>
            <span className="text-[10px] text-yellow-400">Nominal: {PIPE_SPEC.wt_mm}mm</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={iData}>
              <defs>
                <linearGradient id="wtg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f5a623" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f5a623" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="t" tick={{ fontSize: 8, fill: "#8b949e" }} label={{ value: "axial (×0.6m)", fontSize: 8, fill: "#8b949e", position: "insideBottom", offset: -2 }} />
              <YAxis domain={[3, 11]} tick={{ fontSize: 8, fill: "#8b949e" }} />
              <Tooltip content={<CT />} />
              <ReferenceLine y={PIPE_SPEC.wt_mm * 0.8} stroke="#f85149" strokeDasharray="3 2" label={{ value: "80% min", fill: "#f85149", fontSize: 8 }} />
              <ReferenceLine y={PIPE_SPEC.wt_mm} stroke="#39d353" strokeDasharray="3 2" label={{ value: "nominal", fill: "#39d353", fontSize: 8 }} />
              <Area dataKey="wt" stroke="#f5a623" fill="url(#wtg)" strokeWidth={1.5} dot={false} name="WT mm" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Vibration + IMU */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="text-xs text-[#e6edf3] mb-2">Vibration (m/s²)</div>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={vData}>
              <defs>
                <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#bc8cff" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#bc8cff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="t" tick={{ fontSize: 8, fill: "#8b949e" }} />
              <YAxis tick={{ fontSize: 8, fill: "#8b949e" }} />
              <Tooltip content={<CT />} />
              <ReferenceLine y={0.5} stroke="#f5a623" strokeDasharray="3 2" label={{ value: "warn", fill: "#f5a623", fontSize: 8 }} />
              <Area dataKey="value" stroke="#bc8cff" fill="url(#vg)" strokeWidth={1.5} dot={false} name="m/s²" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="text-xs text-[#e6edf3] mb-2">IMU Accelerometer — X Y Z (g)</div>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={iData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="t" tick={{ fontSize: 8, fill: "#8b949e" }} />
              <YAxis domain={[-1.2, 1.2]} tick={{ fontSize: 8, fill: "#8b949e" }} />
              <Tooltip content={<CT />} />
              <Line dataKey="x" stroke="#f85149" strokeWidth={1.2} dot={false} name="X" />
              <Line dataKey="y" stroke="#39d353" strokeWidth={1.2} dot={false} name="Y" />
              <Line dataKey="z" stroke="#58a6ff" strokeWidth={1.2} dot={false} name="Z" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-1">
            {[["X", "#f85149"], ["Y", "#39d353"], ["Z", "#58a6ff"]].map(([l, c]) => (
              <div key={l} className="flex items-center gap-1 text-[10px]">
                <div className="w-3 h-0.5" style={{ background: c }} />
                <span className="text-[#8b949e]">{l}-axis</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
