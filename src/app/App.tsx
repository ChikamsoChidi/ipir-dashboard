import { useState } from "react";
import { TopBar }                from "./components/dashboard/TopBar";
import { Sidebar }               from "./components/dashboard/Sidebar";
import { LiveFeed }              from "./components/dashboard/LiveFeed";
import { PipeModel }             from "./components/dashboard/PipeModel";
import { MLAnalysis }            from "./components/dashboard/MLAnalysis";
import { PredictiveMaintenance } from "./components/dashboard/PredictiveMaintenance";
import { Telemetry }             from "./components/dashboard/Telemetry";
import { Reports }               from "./components/dashboard/Reports";

type Section = "feed" | "model" | "ml" | "maintenance" | "telemetry" | "reports";

export default function App() {
  const [section, setSection] = useState<Section>("feed");

  return (
    <div
      className="w-screen h-screen flex flex-col overflow-hidden bg-[#0d1117]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar active={section} onChange={id => setSection(id as Section)} />
        <main className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden">
            {section === "feed"        && <LiveFeed />}
            {section === "model"       && <PipeModel />}
            {section === "ml"          && <MLAnalysis />}
            {section === "maintenance" && <PredictiveMaintenance />}
            {section === "telemetry"   && <Telemetry />}
            {section === "reports"     && <Reports />}
          </div>
        </main>
      </div>
    </div>
  );
}
