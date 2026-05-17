// ── Pipe Specification (API 5L Grade X65) ────────────────────────────────────
export const PIPE_SPEC = {
  grade: "API 5L X65",
  od_mm: 609.6,          // Outside diameter (24 inch)
  od_in: 24,
  wt_mm: 9.5,            // Nominal wall thickness
  smys_mpa: 448,         // Specified Min Yield Strength (65,000 psi)
  smts_mpa: 531,         // Specified Min Tensile Strength
  design_factor: 0.72,
  op_pressure_psi: 847,
  op_pressure_mpa: 5.84,
  medium: "Crude Oil",
  coating: "FBE + Polyurethane Foam",
  year_installed: 2018,
  total_length_m: 1200,
  scanned_m: 847,
  location: "Offshore Section 47B",
};

// ── Computed pipe design values ───────────────────────────────────────────────
// Burst pressure (Barlow): P = 2 × SMYS × t / OD
export const BURST_PRESSURE_MPA =
  (2 * PIPE_SPEC.smys_mpa * PIPE_SPEC.wt_mm) / PIPE_SPEC.od_mm;   // ~13.93 MPa
// MAOP at design factor
export const MAOP_MPA = PIPE_SPEC.design_factor * BURST_PRESSURE_MPA; // ~10.03 MPa
export const MAOP_PSI = Math.round(MAOP_MPa2psi(MAOP_MPA));
function MAOP_MPa2psi(mpa: number) { return mpa * 145.038; }

// ── Modified B31G corrosion assessment ───────────────────────────────────────
export type Defect = {
  id: string;
  type: string;
  pos_m: number;         // axial position along pipe
  clock_deg: number;     // clock angle 0=12 o'clock, 180=6 o'clock
  depth_mm: number;      // measured corrosion depth
  length_mm: number;     // axial extent
  width_mm: number;      // circumferential extent
  rate_mm_yr: number;    // corrosion rate (measured by UT over history)
  age_yr: number;        // years since last clean WT measurement
  confidence: number;    // ML confidence
  timestamp: string;
};

export const DEFECTS: Defect[] = [
  {
    id: "D-001", type: "External Corrosion",
    pos_m: 4.2, clock_deg: 90,  // 3 o'clock
    depth_mm: 2.8, length_mm: 45, width_mm: 32,
    rate_mm_yr: 0.35, age_yr: 8,
    confidence: 97.2, timestamp: "09:14:22",
  },
  {
    id: "D-002", type: "General Corrosion",
    pos_m: 8.7, clock_deg: 180, // 6 o'clock
    depth_mm: 3.9, length_mm: 120, width_mm: 85,
    rate_mm_yr: 0.48, age_yr: 8,
    confidence: 89.4, timestamp: "09:11:05",
  },
  {
    id: "D-003", type: "Pitting Corrosion",
    pos_m: 12.3, clock_deg: 160, // ~5 o'clock
    depth_mm: 5.2, length_mm: 200, width_mm: 140,
    rate_mm_yr: 0.65, age_yr: 8,
    confidence: 94.7, timestamp: "09:09:14",
  },
  {
    id: "D-004", type: "Deposit / MIC",
    pos_m: 17.8, clock_deg: 200, // ~7 o'clock
    depth_mm: 1.4, length_mm: 60, width_mm: 50,
    rate_mm_yr: 0.18, age_yr: 4,
    confidence: 82.1, timestamp: "09:06:33",
  },
  {
    id: "D-005", type: "Weld Anomaly",
    pos_m: 22.5, clock_deg: 270, // 9 o'clock
    depth_mm: 1.1, length_mm: 25, width_mm: 12,
    rate_mm_yr: 0.12, age_yr: 8,
    confidence: 76.3, timestamp: "09:03:44",
  },
];

// ── Modified B31G: Safe Burst Pressure at a corroded location ────────────────
// Reference: ASME B31G-2012 / Modified B31G (Kiefner & Vieth)
export function computeB31G(defect: Defect) {
  const { wt_mm: t, od_mm: D, smys_mpa: SMYS } = PIPE_SPEC;
  const { depth_mm: d, length_mm: L } = defect;

  const wallLossFrac = d / t;                          // d/t
  const wallLossPct  = wallLossFrac * 100;
  const remainingWt  = t - d;

  // Folias (bulging) factor
  const z = (L * L) / (D * t);
  const M = z <= 50
    ? Math.sqrt(1 + 0.6275 * z - 0.003375 * z * z)
    : 0.032 * z + 3.3;

  // Modified B31G: uses 0.85d/t instead of 2d/3t
  const A = 0.85 * wallLossFrac;

  // Remaining failure pressure (MPa)
  const Pf = (2 * t * SMYS / D) * ((1 - A) / (1 - A / M));
  const Pf_psi = Pf * 145.038;

  // Estimated repair factor (ERF): if ERF ≥ 1 → immediate repair
  const ERF = PIPE_SPEC.op_pressure_mpa / Pf;

  // Remaining life to ERF = 1.0 (iterate depth until Pf = P_op)
  // Approx: find d_crit where Pf = P_op, then remaining = (d_crit - d) / rate
  let dCrit = d;
  for (let dd = d; dd < t; dd += 0.01) {
    const wallLF = dd / t;
    const Aa = 0.85 * wallLF;
    const pf = (2 * t * SMYS / D) * ((1 - Aa) / (1 - Aa / M));
    if (pf <= PIPE_SPEC.op_pressure_mpa) { dCrit = dd; break; }
    dCrit = dd;
  }
  const remainingMM = Math.max(0, dCrit - d);
  const remainingLife_yr = defect.rate_mm_yr > 0 ? remainingMM / defect.rate_mm_yr : 99;

  // Next scheduled inspection (half of remaining life, min 1 yr)
  const nextInspection_yr = Math.max(0.5, remainingLife_yr / 2);

  // Action code
  let action: "MONITOR" | "SCHEDULE" | "URGENT" | "IMMEDIATE";
  if (ERF >= 1.0)            action = "IMMEDIATE";
  else if (ERF >= 0.8)       action = "URGENT";
  else if (ERF >= 0.6)       action = "SCHEDULE";
  else                       action = "MONITOR";

  return {
    wallLossPct:       +wallLossPct.toFixed(1),
    remainingWt_mm:    +remainingWt.toFixed(2),
    folias_M:          +M.toFixed(3),
    z_factor:          +z.toFixed(3),
    Pf_mpa:            +Pf.toFixed(2),
    Pf_psi:            +Pf_psi.toFixed(0),
    ERF:               +ERF.toFixed(3),
    remainingLife_yr:  +remainingLife_yr.toFixed(1),
    nextInspection_yr: +nextInspection_yr.toFixed(1),
    action,
    dCrit_mm:          +dCrit.toFixed(2),
  };
}

// ── Telemetry generators ──────────────────────────────────────────────────────
export const genPressure = (n = 30) =>
  Array.from({ length: n }, (_, i) => ({
    t: `${String(Math.floor(i / 6)).padStart(2, "0")}:${String((i % 6) * 10).padStart(2, "0")}`,
    value: 820 + Math.sin(i * 0.4) * 25 + Math.random() * 10,
    maop: MAOP_PSI,
  }));

export const genTemp = (n = 30) =>
  Array.from({ length: n }, (_, i) => ({
    t: `${String(Math.floor(i / 6)).padStart(2, "0")}:${String((i % 6) * 10).padStart(2, "0")}`,
    pipe: 36 + Math.sin(i * 0.3) * 4 + Math.random() * 2,
    ambient: 32,
  }));

export const genFlow = (n = 30) =>
  Array.from({ length: n }, (_, i) => ({
    t: `${String(Math.floor(i / 6)).padStart(2, "0")}:${String((i % 6) * 10).padStart(2, "0")}`,
    value: 12 + Math.sin(i * 0.5) * 2 + Math.random() * 0.8,
  }));

export const genVibration = (n = 40) =>
  Array.from({ length: n }, (_, i) => ({
    t: i,
    value: Math.random() * 0.35 + 0.05 + (i > 26 && i < 31 ? 1.1 : 0),
  }));

export const genIMU = (n = 40) =>
  Array.from({ length: n }, (_, i) => ({
    t: i,
    x: (Math.random() - 0.5) * 0.28,
    y: (Math.random() - 0.5) * 0.28,
    z: (Math.random() - 0.5) * 0.18 + (i > 26 && i < 31 ? 0.7 : 0),
    wt: 9.5 - DEFECTS.reduce((acc, d) => {
      const near = Math.abs(d.pos_m - i * 0.6) < 2;
      return near ? Math.max(acc, d.depth_mm * 0.5) : acc;
    }, 0) + (Math.random() - 0.5) * 0.3,
  }));

// ── ML classes ────────────────────────────────────────────────────────────────
export const ML_CLASSES = [
  { cls: "External Corrosion", count: 14, color: "#f85149" },
  { cls: "Pitting",            count:  8, color: "#ff8c42" },
  { cls: "General Corrosion",  count:  6, color: "#f5a623" },
  { cls: "Deposit / MIC",      count: 11, color: "#58a6ff" },
  { cls: "Weld Anomaly",       count:  3, color: "#bc8cff" },
  { cls: "No Defect",          count: 318, color: "#39d353" },
];

export const genInference = (n = 25) =>
  Array.from({ length: n }, (_, i) => ({
    f: i + 1,
    ms: 26 + Math.random() * 12,
  }));
