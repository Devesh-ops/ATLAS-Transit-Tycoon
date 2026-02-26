import { useState, useCallback, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ============================================================
//  BLUEPRINT
// ============================================================
const CITY_META = {
  name: "Smallville",
  subtitle: "A quiet city learning to move",
  population: 50000,
  intro: `A city of 50,000 people. Everyone travels by ride-hailing or bus. You have a $12M annual budget. You have two levers: tax Uber rides (raises revenue, reduces congestion, but hurts mobility) and subsidize buses (costs money, helps mobility below 50, always cuts congestion). Balance the tradeoffs — and watch the clock.`,
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const TIMER = { monthDuration: 20, warningAt: 5, endingDuration: 1200 };

const SIMULATION = {
  baseline: { mobilityScore: 60, congestionLevel: 45, happinessScore: 50 },
  // UBER TAX: higher tax = less Uber = less mobility, less congestion, more revenue
  uber: {
    mobilityLossPerPercent:      0.40,  // 100% tax → −40 mobility pts
    congestionReductionPerPercent: 0.45, // 100% tax → −45 congestion pts
    revenuePerPercent:           0.10,  // 100% tax → +$10M revenue (per activity unit)
  },
  bus: {
    mobilityFlipPoint: 50,
    mobilityGainPerPercentBelowFlip: 0.24,
    mobilityLossPerPercentAboveFlip: 0.12,
    congestionOffsetPerPercent: 0.15,
  },
  happiness: {
    mobilityWeight:     0.60,
    congestionWeight:   0.40,
    budgetStressWeight: 0.35,
    min: 0, max: 100,
  },
  thresholds: {
    happiness:  { good: 65, warning: 40 },
    congestion: { good: 35, warning: 60 },
    mobility:   { good: 65, warning: 45 },
    budget:     { safe: 0.50, warning: 0.20 },
  },
};

const BUDGET_CONFIG = {
  annualBudget:      12.0,
  busCostRate:       0.0016,   // bus subsidy costs money
  uberRevenueRate:   0.0022,   // uber tax earns money (scales with activity)
  warningFraction:   0.20,
  budgetBonusWeight: 0.15,
};

const SCORING = {
  grades: [
    { min: 85, grade: "A+", label: "Urban Utopia",      color: "#10B981" },
    { min: 75, grade: "A",  label: "Thriving City",     color: "#10B981" },
    { min: 65, grade: "B",  label: "Good Progress",     color: "#84CC16" },
    { min: 55, grade: "C",  label: "Room to Improve",   color: "#F59E0B" },
    { min: 45, grade: "D",  label: "Citizens Restless", color: "#F97316" },
    { min: 0,  grade: "F",  label: "City in Gridlock",  color: "#EF4444" },
  ],
  congestionWarningThreshold: 65,
  mobilityWarningThreshold:   52,
  budgetWarningThreshold:     0.25,
};

const ADVISOR = {
  name: "Maya", title: "Chief Transport Advisor",
  gameIntro: `Hi, I'm Maya. You have $12M for the year. This time, taxing Uber raises revenue AND cuts congestion — but too much tax kills mobility. Bus subsidies cost money but keep people moving. The real skill is using Uber tax revenue to fund bus subsidies. You have 20 seconds per month — or hit End Turn whenever you're ready.`,
  monthStartHints: [
    "January — the year begins. A modest Uber tax funds your bus subsidy without crippling mobility.",
    "Watch the balance: high Uber tax = good revenue + less congestion, but mobility drops.",
    "Bus subsidies are most effective when mobility is below 50. Above that, fixed routes constrain travel.",
    "Try funding your bus subsidy entirely from Uber tax revenue. Can you break even?",
    "Almost halfway. Is your budget growing, shrinking, or flat?",
    "Mid-year check. Uber tax revenue compounds — consistent policy beats erratic swings.",
    "Research: a 50% Uber price increase shifts riders toward buses, cutting congestion significantly.",
    "Bus subsidies always ease congestion — even above the mobility flip point.",
    "The sweet spot: enough Uber tax to fund buses, not so much that mobility collapses.",
    "Three months left. If budget is healthy, you can afford to ease the Uber tax.",
    "Second to last month. Stick to what's working.",
    "Last month! Finish strong — remaining budget adds to your final score.",
  ],
  monthEndReactions: {
    highHappiness:   ["Great month! Mobility is strong, congestion is manageable, and the budget held.", "Smallville is humming. Good policy shows.", "Solid decisions — Uber tax revenue is working for you."],
    highCongestion:  ["Roads are packed. Low Uber tax means cheap rides but clogged streets. Consider raising it.", "Too many cars. Uber tax would reduce congestion AND earn revenue.", "Gridlock. The mobility gains are being eaten by time lost in traffic."],
    lowMobility:     ["Mobility has dropped. The Uber tax may be too high — people are priced out of rides.", "Citizens aren't moving much. Ease the Uber tax or boost the bus subsidy.", "The city feels stuck. High taxes without strong bus support leaves people stranded."],
    busConstraining: ["Mobility is above 50 — your bus subsidy is pulling it back down. Fixed routes are limiting people.", "Bus subsidies above the mobility threshold constrain travel. Consider reducing bus spend.", "People are being pushed onto buses when they'd prefer flexible travel."],
    budgetWarning:   ["Budget running thin. Raise the Uber tax to generate revenue — it's your income stream.", "Less than 20% left. Uber tax is the only lever that earns money, not spends it.", "Tight budget. A modest Uber tax increase could stabilise things."],
    revenueGain:     ["Nice — Uber tax revenue exceeded bus costs this month. The city is self-funding.", "Budget grew this month. Uber tax is pulling its weight.", "Positive month for the budget. The tax-and-reinvest strategy is working."],
    balanced:        ["Decent month. City is moving, traffic manageable, budget stable.", "Steady policy. It compounds well across the year."],
    noPolicy:        ["No tax and no subsidy this month. Uber runs unchecked — congestion is high and budget unchanged.", "Laissez-faire month. Congestion builds without an Uber tax."],
    timedOut:        ["Time ran out. Whatever was on the sliders locked in.", "The clock beat you. Quicker decisions next month — or hit End Turn earlier."],
  },
  tooltips: {
    happiness:   "Overall citizen satisfaction. Goes up with mobility, down with congestion and budget stress. Final score averages this across 12 months.",
    mobility:    "How much citizens are moving. Uber tax reduces it (fewer affordable rides). Bus subsidy helps when mobility < 50, hurts when > 50 (fixed routes).",
    congestion:  "Road congestion. Uber tax reduces it (fewer cars). Bus subsidy also reduces it. Research: pricing Uber up shifts riders to shared transport.",
    budget:      "Remaining annual budget ($12M). Bus subsidies cost money. Uber tax earns money. Net change each month can be positive or negative.",
    uberTax:     "Tax on every Uber trip. Raises revenue for the city, reduces congestion by discouraging private rides — but reduces mobility as Uber becomes expensive. The city's income lever.",
    busSubsidy:  "Discount on bus fares. Costs budget. Boosts mobility when city is under-mobile (<50). Constrains mobility when already mobile (>50). Always reduces congestion.",
  },
};

const DEBRIEF = {
  coreInsight: "Economists Christensen & Osman (Cairo, 2025) found that a 50% Uber price cut increased total mobility ~49.5% but raised low-occupancy vehicle trips ~60% and congestion ~20%. The flip side: taxing Uber reduces congestion and generates revenue — but at the cost of mobility, especially for lower-income riders who can't afford buses either.",
  congestionInsight: "High Uber usage pushed external costs up. In Cairo, a 50% Uber price drop would increase congestion, emissions and accident costs by ~0.7% of the city's GDP. Pricing Uber up is one of the few levers that simultaneously cuts congestion and raises public revenue.",
  mobilityInsight: "Heavy Uber tax without a strong bus alternative leaves people stranded. Research shows enormous latent demand — welfare gains from a 50% Uber price cut equalled ~17% of the average Cairo participant's monthly income. Tax too hard, and that welfare disappears.",
  balanceInsight: "You found the balance: moderate Uber tax funding a meaningful bus subsidy. This is the real-world policy prescription — use ride-hailing taxes to cross-subsidize public transport.",
  budgetInsight: "Uber tax revenue compounds across the year. Consistent modest taxation is more sustainable than lurching between high and low rates.",
  city2Teaser: "In City 2, not everyone is the same. Rich and poor citizens respond very differently to Uber taxes — and the equity implications are significant.",
  source: `Christensen & Osman (2025) "Demand for Mobility" · Christensen & Osman (2023) "Weathering the Ride"`,
};

// ============================================================
//  SIMULATION ENGINE
// ============================================================
function simulate(uberTax, busSubsidy, budgetRemaining) {
  const { baseline, uber, bus, happiness } = SIMULATION;

  // 1. Mobility — Uber tax reduces mobility, bus subsidy adjusts based on flip
  const uberMobilityLoss = uberTax * uber.mobilityLossPerPercent;
  const mobilityBeforeBus = baseline.mobilityScore - uberMobilityLoss;
  const busEffect = mobilityBeforeBus < bus.mobilityFlipPoint
    ? busSubsidy *  bus.mobilityGainPerPercentBelowFlip
    : busSubsidy * -bus.mobilityLossPerPercentAboveFlip;
  const mobilityScore = Math.min(100, Math.max(0, mobilityBeforeBus + busEffect));

  // 2. Congestion — both levers reduce it
  const congestionLevel = Math.min(100, Math.max(5,
    baseline.congestionLevel
    - uberTax    * uber.congestionReductionPerPercent
    - busSubsidy * bus.congestionOffsetPerPercent
  ));

  // 3. Budget delta this month
  const activity = (mobilityScore + congestionLevel) / 2;
  const uberRevenue = (uberTax    / 100) * BUDGET_CONFIG.uberRevenueRate * activity * 100;
  const busCost     = (busSubsidy / 100) * BUDGET_CONFIG.busCostRate     * activity * 100;
  const monthlyDelta = +(uberRevenue - busCost).toFixed(3); // positive = budget grows

  // 4. Budget stress
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const budgetStress = budgetFraction > 0.5 ? 0 : (0.5 - budgetFraction) / 0.5;

  // 5. Happiness
  const mobilityGain   = mobilityScore   - baseline.mobilityScore;
  const congestionPain = congestionLevel - baseline.congestionLevel;
  const happinessScore = Math.min(happiness.max, Math.max(happiness.min,
    baseline.happinessScore
    + mobilityGain   * happiness.mobilityWeight
    - congestionPain * happiness.congestionWeight
    - budgetStress * 25 * happiness.budgetStressWeight
  ));

  const busIsConstraining = mobilityBeforeBus >= bus.mobilityFlipPoint && busSubsidy > 0;
  const revenuePositive   = monthlyDelta > 0;

  return { mobilityScore, congestionLevel, happinessScore, monthlyDelta, uberRevenue, busCost, budgetStress, busIsConstraining, revenuePositive };
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getMonthEndMessage(stats, uberTax, bus, budgetFraction, timedOut) {
  if (timedOut)  return pickRandom(ADVISOR.monthEndReactions.timedOut);
  if (uberTax === 0 && bus === 0) return pickRandom(ADVISOR.monthEndReactions.noPolicy);
  if (budgetFraction < BUDGET_CONFIG.warningFraction) return pickRandom(ADVISOR.monthEndReactions.budgetWarning);
  if (stats.busIsConstraining && bus > 0) return pickRandom(ADVISOR.monthEndReactions.busConstraining);
  const t = SIMULATION.thresholds;
  if (stats.happinessScore  >= t.happiness.good)     return pickRandom(ADVISOR.monthEndReactions.highHappiness);
  if (stats.congestionLevel >= t.congestion.warning) return pickRandom(ADVISOR.monthEndReactions.highCongestion);
  if (stats.mobilityScore   <= t.mobility.warning)   return pickRandom(ADVISOR.monthEndReactions.lowMobility);
  if (stats.revenuePositive) return pickRandom(ADVISOR.monthEndReactions.revenueGain);
  return pickRandom(ADVISOR.monthEndReactions.balanced);
}

function getGrade(score) { return SCORING.grades.find(g => score >= g.min) || SCORING.grades[SCORING.grades.length - 1]; }

function getColor(value, type) {
  const t = SIMULATION.thresholds[type];
  if (!t) return "#64748B";
  if (type === "congestion") {
    if (value <= t.good)    return "#10B981";
    if (value <= t.warning) return "#F59E0B";
    return "#EF4444";
  }
  if (type === "budget") {
    if (value >= t.safe)    return "#10B981";
    if (value >= t.warning) return "#F59E0B";
    return "#EF4444";
  }
  if (value >= t.good)    return "#10B981";
  if (value >= t.warning) return "#F59E0B";
  return "#EF4444";
}

// ============================================================
//  UI COMPONENTS
// ============================================================
function InfoTip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        style={{ background: "none", border: "1px solid #1E293B", borderRadius: "50%", width: 16, height: 16, cursor: "pointer", color: "#334155", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>i</button>
      {show && (
        <div style={{ position: "absolute", right: 0, top: 20, width: 220, background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, padding: "9px 11px", fontSize: 11, color: "#94A3B8", zIndex: 300, lineHeight: 1.5, pointerEvents: "none" }}>{text}</div>
      )}
    </div>
  );
}

function GaugeBar({ label, value, type, tooltip, extra }) {
  const color = getColor(value, type);
  const barW  = type === "budget" ? value * 100 : Math.round(value);
  const display = type === "budget" ? `$${(value * BUDGET_CONFIG.annualBudget).toFixed(1)}M` : Math.round(value);
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#334155", letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
          <InfoTip text={tooltip} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{display}</span>
          {extra && <span style={{ fontSize: 9, color: "#1E293B" }}>{extra}</span>}
        </div>
      </div>
      <div style={{ height: 6, background: "#0A1628", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, barW))}%`, background: color, borderRadius: 3, transition: "width 0.35s ease, background 0.3s" }} />
      </div>
    </div>
  );
}

function SliderInput({ label, value, onChange, color, tooltip, locked, tag }) {
  return (
    <div style={{ marginBottom: 20, opacity: locked ? 0.5 : 1, transition: "opacity 0.3s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: locked ? "#1E293B" : color }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: locked ? "#334155" : "#CBD5E1" }}>{label}</span>
          {tag && <span style={{ fontSize: 9, background: tag.bg, color: tag.color, borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>{tag.text}</span>}
          <InfoTip text={tooltip} />
        </div>
        <span style={{ fontSize: 20, fontWeight: 700, color: locked ? "#1E293B" : color, fontVariantNumeric: "tabular-nums" }}>{value}%</span>
      </div>
      <input type="range" min={0} max={100} step={5} value={value}
        onChange={e => !locked && onChange(Number(e.target.value))} disabled={locked}
        style={{ width: "100%", accentColor: color, cursor: locked ? "not-allowed" : "pointer" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#1E293B", marginTop: 2 }}>
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>
  );
}

function BudgetDeltaPreview({ delta }) {
  const positive = delta >= 0;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: positive ? "#030E07" : "#1A0505", border: `1px solid ${positive ? "#052E16" : "#3B0000"}`, borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
      <span style={{ fontSize: 10, color: "#1E293B" }}>Est. budget change this month</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: positive ? "#10B981" : "#EF4444", fontVariantNumeric: "tabular-nums" }}>
        {positive ? "+" : ""}{delta.toFixed(2)}M
      </span>
    </div>
  );
}

function AdvisorBox({ message }) {
  return (
    <div style={{ background: "#050D1A", border: "1px solid #0C1E30", borderRadius: 10, padding: "11px 13px", display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>🧑‍💼</span>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#1D4ED8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 3 }}>{ADVISOR.name} · {ADVISOR.title}</div>
        <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6 }}>{message}</div>
      </div>
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 7, padding: "7px 8px", textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 9, color: "#1E293B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{typeof value === "number" ? Math.round(value) : value}</div>
    </div>
  );
}

function CountdownRing({ timeLeft, total }) {
  const r = 25, circ = 2 * Math.PI * r;
  const offset = circ * (1 - timeLeft / total);
  const warn = timeLeft <= TIMER.warningAt;
  const color = warn ? "#EF4444" : timeLeft <= total * 0.5 ? "#F59E0B" : "#3B82F6";
  return (
    <div style={{ position: "relative", width: 60, height: 60, flexShrink: 0 }}>
      <svg width="60" height="60" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="30" cy="30" r={r} fill="none" stroke="#0A1628" strokeWidth="5" />
        <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 17, fontWeight: 700, color, lineHeight: 1, animation: warn ? "warnPulse 0.5s ease-in-out infinite alternate" : "none" }}>{timeLeft}</span>
        <span style={{ fontSize: 8, color: "#1E293B", textTransform: "uppercase" }}>sec</span>
      </div>
      <style>{`@keyframes warnPulse{from{opacity:1}to{opacity:0.25}}`}</style>
    </div>
  );
}

function MonthEndingOverlay({ month }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(2,8,23,0.94)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
      <style>{`@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes dot{0%,100%{opacity:0.15}50%{opacity:1}}`}</style>
      <div style={{ textAlign: "center", animation: "slideUp 0.3s ease" }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>⏰</div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#1D4ED8", textTransform: "uppercase", marginBottom: 8 }}>Month Locked</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#F1F5F9" }}>{month} Ending...</div>
        <div style={{ marginTop: 16, display: "flex", gap: 6, justifyContent: "center" }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D4ED8", animation: `dot 0.9s ${i*0.3}s ease-in-out infinite` }} />)}
        </div>
      </div>
    </div>
  );
}

function GameOverScreen({ month, onRestart, onContinue }) {
  return (
    <div style={{ minHeight: "100vh", background: "#020817", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", padding: 20 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>💸</div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#EF4444", textTransform: "uppercase", marginBottom: 8 }}>Budget Depleted</div>
        <h2 style={{ fontSize: 30, fontWeight: 700, color: "#F1F5F9", margin: "0 0 8px" }}>Smallville Bankrupt</h2>
        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, marginBottom: 22 }}>
          The city ran out of funds in <strong style={{ color: "#94A3B8" }}>{month}</strong>. Bus subsidies outpaced Uber tax revenue. Citizens are stranded.
        </p>
        <div style={{ marginBottom: 22 }}><AdvisorBox message="Heavy bus subsidies without enough Uber tax revenue drained the budget. Try raising the Uber tax — it's your income stream. Use that revenue to fund buses." /></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onRestart} style={{ flex: 1, background: "#1D4ED8", color: "white", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>↺ Start Over</button>
          <button onClick={onContinue} style={{ flex: 1, background: "#0F172A", color: "#475569", border: "1px solid #1E293B", borderRadius: 8, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Continue (no score)</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  SCREENS
// ============================================================
function IntroScreen({ onStart }) {
  return (
    <div style={{ minHeight: "100vh", background: "#020817", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", padding: 20 }}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <div style={{ fontSize: 50, marginBottom: 10 }}>🏙️</div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#1D4ED8", textTransform: "uppercase", marginBottom: 10 }}>Transport Tycoon · City 1</div>
        <h1 style={{ fontSize: 40, fontWeight: 700, color: "#F1F5F9", margin: "0 0 5px" }}>{CITY_META.name}</h1>
        <p style={{ fontSize: 12, color: "#1E293B", marginBottom: 20, fontStyle: "italic" }}>{CITY_META.subtitle}</p>
        <div style={{ marginBottom: 20 }}><AdvisorBox message={ADVISOR.gameIntro} /></div>
        <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.75, marginBottom: 22 }}>{CITY_META.intro}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
          {[["👥","50k people"],["💰","$12M budget"],["📅","12 months"],["⏱","20 sec/month"],["🚕","Uber tax earns $"],["🚌","Bus subsidy costs $"]].map(([icon, label]) => (
            <div key={label} style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 7, padding: "6px 10px", fontSize: 10, color: "#334155" }}>{icon} {label}</div>
          ))}
        </div>
        <button onClick={onStart} style={{ background: "#1D4ED8", color: "white", border: "none", borderRadius: 10, padding: "13px 34px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Start as Transport Director →
        </button>
        <p style={{ fontSize: 10, color: "#0C1F35", marginTop: 10 }}>Set policy then hit End Turn — or wait for the timer</p>
      </div>
    </div>
  );
}

function PlanningScreen({ month, roundIndex, uberTax, busSubsidy, onUberChange, onBusChange, onCommit, budgetRemaining }) {
  const [timeLeft, setTimeLeft] = useState(TIMER.monthDuration);
  const [locked, setLocked]     = useState(false);
  const [ending, setEnding]     = useState(false);
  const uberRef = useRef(uberTax);
  const busRef  = useRef(busSubsidy);
  const lockedRef = useRef(false);
  useEffect(() => { uberRef.current = uberTax;     }, [uberTax]);
  useEffect(() => { busRef.current  = busSubsidy;  }, [busSubsidy]);

  const commitMonth = useCallback((wasTimedOut) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true);
    setEnding(true);
    setTimeout(() => onCommit(uberRef.current, busRef.current, wasTimedOut), TIMER.endingDuration);
  }, [onCommit]);

  useEffect(() => {
    setTimeLeft(TIMER.monthDuration);
    setLocked(false);
    setEnding(false);
    lockedRef.current = false;
    const iv = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(iv); commitMonth(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [roundIndex]);

  const live = simulate(uberTax, busSubsidy, budgetRemaining);
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const warn = timeLeft <= TIMER.warningAt && timeLeft > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#020817", fontFamily: "Georgia, serif", padding: "16px", outline: warn ? "3px solid rgba(239,68,68,0.3)" : "3px solid transparent", transition: "outline 0.3s" }}>
      {ending && <MonthEndingOverlay month={month} />}
      <div style={{ maxWidth: 580, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#1D4ED8", textTransform: "uppercase" }}>City 1 · {CITY_META.name}</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#F1F5F9", margin: "3px 0 0" }}>{month}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#0C1F35" }}>Month</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B" }}>{roundIndex+1}/12</div>
            </div>
            <CountdownRing timeLeft={timeLeft} total={TIMER.monthDuration} />
          </div>
        </div>

        <div style={{ height: 3, background: "#050E1A", borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(roundIndex/12)*100}%`, background: "#1D4ED8", transition: "width 0.4s" }} />
        </div>

        <div style={{ marginBottom: 12 }}><AdvisorBox message={ADVISOR.monthStartHints[roundIndex]} /></div>

        {/* Sliders */}
        <div style={{ background: "#050E1A", border: warn ? "1px solid rgba(239,68,68,0.4)" : "1px solid #0C2340", borderRadius: 11, padding: "16px 16px 4px", marginBottom: 10, transition: "border 0.3s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 9, letterSpacing: 2, color: "#0C1F35", textTransform: "uppercase" }}>Set Policy</span>
            {locked && <span style={{ fontSize: 10, color: "#EF4444", fontWeight: 700 }}>🔒 LOCKED</span>}
          </div>
          <SliderInput label="Uber Tax" value={uberTax} onChange={onUberChange} color="#EF4444"
            tooltip={ADVISOR.tooltips.uberTax} locked={locked}
            tag={{ text: "earns $", bg: "#052E16", color: "#10B981" }} />
          <SliderInput label="Bus Fare Subsidy" value={busSubsidy} onChange={onBusChange} color="#3B82F6"
            tooltip={ADVISOR.tooltips.busSubsidy} locked={locked}
            tag={{ text: "costs $", bg: "#1A0505", color: "#EF4444" }} />
          <BudgetDeltaPreview delta={live.monthlyDelta} />
        </div>

        {/* Gauges */}
        <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 11, padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#0C1F35", textTransform: "uppercase", marginBottom: 12 }}>Live Preview</div>
          <GaugeBar label="Happiness"  value={live.happinessScore}  type="happiness"  tooltip={ADVISOR.tooltips.happiness} />
          <GaugeBar label="Mobility"   value={live.mobilityScore}   type="mobility"   tooltip={ADVISOR.tooltips.mobility}
            extra={live.busIsConstraining && busSubsidy > 0 ? "⚠ bus constraining" : ""} />
          <GaugeBar label="Congestion" value={live.congestionLevel} type="congestion" tooltip={ADVISOR.tooltips.congestion} />
          <GaugeBar label="Budget"     value={budgetFraction}       type="budget"     tooltip={ADVISOR.tooltips.budget} extra={`/ $${BUDGET_CONFIG.annualBudget}M`} />
        </div>

        {/* End Turn button */}
        {!locked && (
          <button onClick={() => commitMonth(false)}
            style={{ width: "100%", background: "#059669", color: "white", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3 }}>
            ✓ End Turn — Lock in {month}'s Policy
          </button>
        )}
      </div>
    </div>
  );
}

function ResultScreen({ month, roundIndex, stats, uberTax, busSubsidy, advisorMessage, onNext, history, timedOut, budgetRemaining }) {
  const { mobilityScore, congestionLevel, happinessScore, monthlyDelta, uberRevenue, busCost } = stats;
  const ytd = Math.round(history.reduce((s, m) => s + m.happinessScore, 0) / history.length);
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const isLast = roundIndex === 11;
  const deltaPositive = monthlyDelta >= 0;

  return (
    <div style={{ minHeight: "100vh", background: "#020817", fontFamily: "Georgia, serif", padding: "16px" }}>
      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#059669", textTransform: "uppercase" }}>Month Complete</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#F1F5F9", margin: "3px 0 0" }}>{month} Results</h2>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1E293B" }}>{roundIndex+1}/12</span>
        </div>

        {/* Policy + budget flow */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: "#100303", border: "1px solid #2A0000", borderRadius: 7, padding: "10px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#7F1D1D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Uber Tax</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#EF4444" }}>{uberTax}%</div>
          </div>
          <div style={{ flex: 1, background: "#020810", border: "1px solid #0C1A2E", borderRadius: 7, padding: "10px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#0C2340", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Bus Subsidy</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#3B82F6" }}>{busSubsidy}%</div>
          </div>
          <div style={{ flex: 1.2, background: deltaPositive ? "#030E07" : "#100303", border: `1px solid ${deltaPositive ? "#052E16" : "#2A0000"}`, borderRadius: 7, padding: "10px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#1E293B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Budget Change</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: deltaPositive ? "#10B981" : "#EF4444" }}>
              {deltaPositive ? "+" : ""}{monthlyDelta.toFixed(2)}M
            </div>
            <div style={{ fontSize: 9, color: "#1E293B", marginTop: 2 }}>+${uberRevenue.toFixed(2)} tax / −${busCost.toFixed(2)} bus</div>
          </div>
          {timedOut && <div style={{ background: "#080202", border: "1px solid #1A0505", borderRadius: 7, padding: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10, color: "#EF4444" }}>⏰</span>
          </div>}
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <StatPill label="Happiness"  value={happinessScore}  color={getColor(happinessScore, "happiness")} />
          <StatPill label="Mobility"   value={mobilityScore}   color={getColor(mobilityScore, "mobility")} />
          <StatPill label="Congestion" value={congestionLevel} color={getColor(congestionLevel, "congestion")} />
          <StatPill label="Budget"     value={`$${budgetRemaining.toFixed(1)}M`} color={getColor(budgetFraction, "budget")} />
        </div>

        <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 11, padding: "14px 16px", marginBottom: 10 }}>
          <GaugeBar label="Happiness"  value={happinessScore}  type="happiness"  tooltip={ADVISOR.tooltips.happiness} />
          <GaugeBar label="Mobility"   value={mobilityScore}   type="mobility"   tooltip={ADVISOR.tooltips.mobility} />
          <GaugeBar label="Congestion" value={congestionLevel} type="congestion" tooltip={ADVISOR.tooltips.congestion} />
          <GaugeBar label="Budget"     value={budgetFraction}  type="budget"     tooltip={ADVISOR.tooltips.budget} extra={`/ $${BUDGET_CONFIG.annualBudget}M`} />
        </div>

        <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 8, padding: "10px 14px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#1E293B" }}>Year-to-date avg happiness</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: getColor(ytd, "happiness") }}>{ytd}<span style={{ fontSize: 10, color: "#1E293B" }}>/100</span></span>
        </div>

        <div style={{ marginBottom: 20 }}><AdvisorBox message={advisorMessage} /></div>

        <button onClick={onNext} style={{ width: "100%", background: isLast ? "#059669" : "#1D4ED8", color: "white", border: "none", borderRadius: 9, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          {isLast ? "See Final Score →" : `Next: ${MONTHS[roundIndex+1]} →`}
        </button>
      </div>
    </div>
  );
}

function YearEndScreen({ history, finalBudget, onRestart, scoreless }) {
  const avgH = history.reduce((s, m) => s + m.happinessScore, 0) / history.length;
  const avgM = history.reduce((s, m) => s + m.mobilityScore, 0) / history.length;
  const avgC = history.reduce((s, m) => s + m.congestionLevel, 0) / history.length;
  const budgetEff   = (finalBudget / BUDGET_CONFIG.annualBudget) * 100;
  const finalScore  = scoreless ? 0 : avgH * (1 - BUDGET_CONFIG.budgetBonusWeight) + budgetEff * BUDGET_CONFIG.budgetBonusWeight;
  const grade       = getGrade(scoreless ? 0 : finalScore);
  const budgetSpent = BUDGET_CONFIG.annualBudget - finalBudget;
  const showCongest  = avgC > SCORING.congestionWarningThreshold;
  const showMobility = avgM < SCORING.mobilityWarningThreshold;
  const showBudget   = finalBudget / BUDGET_CONFIG.annualBudget < SCORING.budgetWarningThreshold;
  const showBalance  = !showCongest && !showMobility && !showBudget;

  const chartData = history.map((m, i) => ({
    month: MONTHS[i].slice(0,3),
    happiness: Math.round(m.happinessScore),
    delta: +m.monthlyDelta.toFixed(2),
  }));

  return (
    <div style={{ minHeight: "100vh", background: "#020817", fontFamily: "Georgia, serif", padding: "16px" }}>
      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: "#1D4ED8", textTransform: "uppercase", marginBottom: 10 }}>Year Complete · {CITY_META.name}</div>
          {scoreless ? <div style={{ fontSize: 48, fontWeight: 700, color: "#EF4444" }}>Bankrupt</div>
            : <div style={{ fontSize: 90, fontWeight: 700, color: grade.color, lineHeight: 1 }}>{grade.grade}</div>}
          <div style={{ fontSize: 17, color: "#475569", marginTop: 6 }}>{scoreless ? "City ran out of funds" : grade.label}</div>
          {!scoreless && <div style={{ fontSize: 11, color: "#1E293B", marginTop: 3 }}>Final score: {Math.round(finalScore)} = happiness {Math.round(avgH)} + budget bonus {Math.round(budgetEff * BUDGET_CONFIG.budgetBonusWeight)}</div>}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <StatPill label="Avg Happiness"  value={avgH} color={getColor(avgH, "happiness")} />
          <StatPill label="Avg Mobility"   value={avgM} color={getColor(avgM, "mobility")} />
          <StatPill label="Avg Congestion" value={avgC} color={getColor(avgC, "congestion")} />
          <StatPill label="Net Budget"     value={finalBudget >= BUDGET_CONFIG.annualBudget ? `+$${(finalBudget-BUDGET_CONFIG.annualBudget).toFixed(1)}M` : `$${finalBudget.toFixed(1)}M`} color={getColor(finalBudget/BUDGET_CONFIG.annualBudget, "budget")} />
        </div>

        {/* Happiness chart */}
        <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 11, padding: "16px 16px 10px", marginBottom: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#0C1F35", textTransform: "uppercase", marginBottom: 12 }}>Happiness — 12 Months</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#1E293B" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0,100]} tick={{ fontSize: 9, fill: "#0C1F35" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 7, fontSize: 11 }} />
              <Bar dataKey="happiness" radius={[3,3,0,0]}>{chartData.map((e,i) => <Cell key={i} fill={getColor(e.happiness,"happiness")} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Budget delta chart */}
        <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 11, padding: "16px 16px 10px", marginBottom: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#0C1F35", textTransform: "uppercase", marginBottom: 12 }}>Monthly Budget Change ($M) — Tax Revenue vs Bus Cost</div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#1E293B" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#0C1F35" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 7, fontSize: 11 }} formatter={v => [`$${v}M`, "Budget change"]} />
              <Bar dataKey="delta" radius={[3,3,0,0]}>{chartData.map((e,i) => <Cell key={i} fill={e.delta >= 0 ? "#10B981" : "#EF4444"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 4 }}>
            {[["#10B981","Tax earned more than bus cost"],["#EF4444","Bus cost more than tax earned"]].map(([c,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#334155" }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Policy log */}
        <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 11, padding: "14px 16px", marginBottom: 16, overflowX: "auto" }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#0C1F35", textTransform: "uppercase", marginBottom: 8 }}>Monthly Policy Log</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>{["Month","Uber Tax","Bus %","Budget Δ","Happiness","Mobility","Congestion"].map(h => (
                <th key={h} style={{ color: "#0C1F35", fontWeight: 600, textAlign: "left", paddingBottom: 6, borderBottom: "1px solid #0C2340", paddingRight: 8 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {history.map((m, i) => (
                <tr key={i}>
                  <td style={{ padding: "4px 8px 4px 0", color: "#1E293B" }}>{MONTHS[i].slice(0,3)}</td>
                  <td style={{ color: "#EF4444", fontWeight: 600, paddingRight: 8 }}>{m.uberTax}%</td>
                  <td style={{ color: "#3B82F6", fontWeight: 600, paddingRight: 8 }}>{m.busSubsidy}%</td>
                  <td style={{ color: m.monthlyDelta >= 0 ? "#10B981" : "#EF4444", fontWeight: 600, paddingRight: 8 }}>{m.monthlyDelta >= 0 ? "+" : ""}{m.monthlyDelta.toFixed(2)}M</td>
                  <td style={{ color: getColor(m.happinessScore, "happiness"), fontWeight: 600, paddingRight: 8 }}>{Math.round(m.happinessScore)}</td>
                  <td style={{ color: getColor(m.mobilityScore, "mobility"), paddingRight: 8 }}>{Math.round(m.mobilityScore)}</td>
                  <td style={{ color: getColor(m.congestionLevel, "congestion") }}>{Math.round(m.congestionLevel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Research debrief */}
        <div style={{ background: "#020C18", border: "1px solid #0C1A2E", borderRadius: 11, padding: "16px", marginBottom: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#1D4ED8", textTransform: "uppercase", marginBottom: 12 }}>📖 What the Research Says</div>
          <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.8, margin: "0 0 10px" }}>{DEBRIEF.coreInsight}</p>
          {showCongest  && <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.8, borderLeft: "3px solid #EF4444", paddingLeft: 11, margin: "0 0 10px" }}>{DEBRIEF.congestionInsight}</p>}
          {showMobility && <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.8, borderLeft: "3px solid #F59E0B", paddingLeft: 11, margin: "0 0 10px" }}>{DEBRIEF.mobilityInsight}</p>}
          {showBudget   && <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.8, borderLeft: "3px solid #F59E0B", paddingLeft: 11, margin: "0 0 10px" }}>{DEBRIEF.budgetInsight}</p>}
          {showBalance  && <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.8, borderLeft: "3px solid #10B981", paddingLeft: 11, margin: "0 0 10px" }}>{DEBRIEF.balanceInsight}</p>}
          <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 7, padding: "10px 12px", marginTop: 10 }}>
            <div style={{ fontSize: 10, color: "#1D4ED8", marginBottom: 4 }}>🏙️ Up Next: City 2 — Riverdale</div>
            <div style={{ fontSize: 11, color: "#1E293B", lineHeight: 1.6 }}>{DEBRIEF.city2Teaser}</div>
          </div>
          <div style={{ fontSize: 9, color: "#0C1F35", marginTop: 10 }}>{DEBRIEF.source}</div>
        </div>

        <button onClick={onRestart} style={{ width: "100%", background: "#050E1A", color: "#1E293B", border: "1px solid #0C2340", borderRadius: 9, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>↺ Play Again</button>
      </div>
    </div>
  );
}

// ============================================================
//  MAIN GAME CONTROLLER
// ============================================================
export default function TransportTycoon() {
  const [screen, setScreen]         = useState("intro");
  const [roundIndex, setRoundIndex] = useState(0);
  const [uberTax,    setUber]       = useState(0);
  const [busSubsidy, setBus]        = useState(0);
  const [history, setHistory]       = useState([]);
  const [result, setResult]         = useState(null);
  const [advisorMsg, setAdvisorMsg] = useState("");
  const [timedOut, setTimedOut]     = useState(false);
  const [budget, setBudget]         = useState(BUDGET_CONFIG.annualBudget);
  const [scoreless, setScoreless]   = useState(false);
  const [gameOverMonth, setGameOverMonth] = useState("");

  const handleCommit = useCallback((uberVal, busVal, wasTimedOut) => {
    setBudget(prev => {
      const stats = simulate(uberVal, busVal, prev);
      const newBudget = +(prev + stats.monthlyDelta).toFixed(3);
      const msg = getMonthEndMessage(stats, uberVal, busVal, Math.max(0,newBudget)/BUDGET_CONFIG.annualBudget, wasTimedOut);
      const record = { ...stats, uberTax: uberVal, busSubsidy: busVal };
      setResult(record); setAdvisorMsg(msg); setTimedOut(wasTimedOut);
      setHistory(h => [...h, record]);
      if (newBudget <= 0) { setGameOverMonth(MONTHS[roundIndex]); setScreen("gameOver"); return 0; }
      setScreen("result");
      return newBudget;
    });
  }, [roundIndex]);

  const handleNext = useCallback(() => {
    if (roundIndex === 11) { setScreen("yearEnd"); }
    else { setRoundIndex(r => r+1); setUber(0); setBus(0); setScreen("planning"); }
  }, [roundIndex]);

  const handleRestart = useCallback(() => {
    setScreen("intro"); setRoundIndex(0); setUber(0); setBus(0);
    setHistory([]); setResult(null); setTimedOut(false);
    setBudget(BUDGET_CONFIG.annualBudget); setScoreless(false); setGameOverMonth("");
  }, []);

  const handleContinue = useCallback(() => {
    setScoreless(true); setRoundIndex(r => r+1); setUber(0); setBus(0); setBudget(0); setScreen("planning");
  }, []);

  if (screen === "intro")    return <IntroScreen onStart={() => setScreen("planning")} />;
  if (screen === "gameOver") return <GameOverScreen month={gameOverMonth} onRestart={handleRestart} onContinue={handleContinue} />;
  if (screen === "planning") return (
    <PlanningScreen month={MONTHS[roundIndex]} roundIndex={roundIndex}
      uberTax={uberTax} busSubsidy={busSubsidy}
      onUberChange={setUber} onBusChange={setBus}
      onCommit={handleCommit} budgetRemaining={budget} />
  );
  if (screen === "result") return (
    <ResultScreen month={MONTHS[roundIndex]} roundIndex={roundIndex}
      stats={result} uberTax={result?.uberTax ?? 0} busSubsidy={result?.busSubsidy ?? 0}
      advisorMessage={advisorMsg} onNext={handleNext}
      history={history} timedOut={timedOut} budgetRemaining={budget} />
  );
  if (screen === "yearEnd") return <YearEndScreen history={history} finalBudget={budget} onRestart={handleRestart} scoreless={scoreless} />;
}
