import { useState, useCallback, useEffect, useRef } from "react";
import CityIntroFlow from "./CityIntro.jsx";
import CityRoadScene from "./CityRoadScene.jsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ============================================================
//  DESIGN TOKENS
// ============================================================
const C = {
  pageBg: "#F7F4EF", cardBg: "#FFFFFF", insetBg: "#EAE6DE",
  border: "#D4CFC6", borderLight: "#E8E2D8",
  text: "#1A1714", textSub: "#3D3830", textMuted: "#6B6358", textFaint: "#9C9188",
  blue: "#1B4FD8", blueBg: "#EEF3FF", blueBorder: "#B8CBFF",
  green: "#166534", greenBg: "#F0FDF4", greenBorder: "#86EFAC",
  amber: "#92400E", amberBg: "#FFFBEB", amberBorder: "#FCD34D",
  red: "#991B1B", redBg: "#FFF1F1", redBorder: "#FECACA",
  purple: "#6D28D9", purpleBg: "#F5F3FF", purpleBorder: "#C4B5FD",
  cyan: "#0E7490", cyanBg: "#ECFEFF", cyanBorder: "#A5F3FC",
  uberColor: "#B91C1C", busColor: "#1B4FD8", acColor: "#0E7490",
  track: "#E2DDD6", overlay: "rgba(26,23,20,0.78)",
};

// ============================================================
//  BLUEPRINT
// ============================================================
const CITY_META = {
  name: "Riverdale",
  subtitle: "A city learning to cope with changing seasons",
  population: 200000,
  intro: `Riverdale has 200,000 people. Smallville was just the beginning. The seasons here hit hard — heatwaves and cold snaps drive people off buses and into Ubers, spiking congestion. You have $30M for the year and three levers: tax Uber (earns revenue, cuts congestion), subsidize buses (costs money, keeps people moving), and invest in bus AC & heating (costs money, keeps buses comfortable year-round). When weather is extreme and buses are uncomfortable, bus subsidies alone won't help. Plan for the seasons.`,
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TIMER = { monthDuration: 25, warningAt: 6, endingDuration: 1200 };

const SEASONS = {
  // -1.0 = peak cold, 0 = mild, +1.0 = peak heat
  tempIndex: [-1.0, -0.7, -0.3, 0.0, 0.4, 0.8, 1.0, 0.8, 0.4, 0.0, -0.4, -0.8],
  seasonLabel: ["Deep Winter", "Late Winter", "Early Spring", "Spring", "Late Spring", "Early Summer", "Peak Summer", "Late Summer", "Early Autumn", "Autumn", "Late Autumn", "Early Winter"],
  seasonIcon: ["🥶", "🥶", "🌱", "🌿", "☀️", "🌡️", "🔥", "🌡️", "🍂", "🍂", "🌧️", "❄️"],
  peakBusMobilityPenalty: 22,   // max mobility points lost from bus discomfort
  peakUberDemandBoost: 8,       // extra congestion from weather-driven Uber use
  peakBaselineMobilityPenalty: 5, // mobility drag that exists regardless of AC
  acCollapseThreshold: 0.25,    // AC mitigation below this triggers collapse in extreme weather
  collapseMultiplier: 2.5,      // how much worse the penalty is during collapse
};

const SIMULATION = {
  baseline: { mobilityScore: 58, congestionLevel: 50, happinessScore: 50 },
  uber: {
    congestionReductionPerPercent: 0.42,
    revenueRate: 0.0020,
  },
  bus: {
    mobilityGainPerPercent: 0.35,         // high: bus subsidies boost mobility a lot
    congestionOffsetPerPercent: 0.10,     // low: buses reduce congestion only slightly
    costRate: 0.0014,
  },
  ac: {
    mitigationExponent: 0.7,
    costRate: 0.0018,
  },
  happiness: {
    mobilityWeight: 0.60,
    congestionWeight: 0.40,
    budgetStressWeight: 0.35,
    min: 0, max: 100,
  },
  thresholds: {
    happiness: { good: 65, warning: 40 },
    congestion: { good: 38, warning: 65 },
    mobility: { good: 62, warning: 44 },
    budget: { safe: 0.50, warning: 0.20 },
  },
  politicalFloor: 30,
  politicalStreakNeeded: 3,
};

const BUDGET_CONFIG = {
  annualBudget: 30.0,
  warningFraction: 0.20,
  budgetBonusWeight: 0.12,
};

const SCORING = {
  grades: [
    { min: 85, grade: "A+", label: "All-Season City", color: C.green },
    { min: 75, grade: "A", label: "Thriving Year-Round", color: C.green },
    { min: 65, grade: "B", label: "Good Progress", color: "#3D7A2B" },
    { min: 55, grade: "C", label: "Seasonal Struggles", color: C.amber },
    { min: 45, grade: "D", label: "Gridlock in Heat & Cold", color: "#C05621" },
    { min: 0, grade: "F", label: "City Failing", color: C.red },
  ],
};

const ADVISOR = {
  name: "Maya", title: "Chief Transport Advisor",
  gameIntro: `Welcome to Riverdale — bigger city, bigger weather swings. In July and January, buses empty out unless they're climate-controlled. Your third lever — Bus AC & Heating — costs money but keeps buses attractive year-round. Without it, even a generous bus subsidy fails in extreme months. Use Uber tax revenue to fund both bus subsidies and AC. 25 seconds per month.`,
  monthStartHints: [
    "January 🥶 — Deep winter. Buses are freezing. Low AC means riders switch to Uber — congestion up. Plan your AC investment carefully.",
    "Still cold. Cold buses hit mobility hard. If AC is low, the bus subsidy isn't helping much — riders avoid buses regardless of price.",
    "Winter easing. AC costs drop. Good month to experiment with the tax and subsidy balance before summer arrives.",
    "Spring — mild temperatures. Buses are naturally attractive. A moderate Uber tax + bus subsidy should work well now.",
    "Late spring. Temperatures climbing. Start investing in AC before July — don't wait for the collapse.",
    "Early summer 🌡️ — buses warming. Without AC, riders shift to Uber. Congestion creeps up.",
    "Peak summer 🔥 — hardest month. AC below 25% triggers a bus collapse. Don't let it happen.",
    "Still hot. Uber tax revenue funds the AC you need — use it.",
    "Summer fading. Ease the Uber tax as AC costs drop and buses become more attractive again.",
    "Autumn 🍂 — mild. Recover budget before winter. Moderate policy works well now.",
    "Late autumn. Cold returning. Prepare AC levels before December.",
    "Final month ❄️. Finish strong — remaining budget adds to your final score.",
  ],
  monthEndReactions: {
    highHappiness: [
      "Great month! Mobility is strong, congestion manageable, and buses comfortable.",
      "Riverdale is moving well. Seasonal planning is paying off.",
      "Strong policy. Tax revenue funding real comfort and access.",
      "Outstanding. You've hit the sweet spot of transport logic.",
      "The city is thriving. Your balance of Uber tax and bus comfort is perfect."
    ],
    heatNeedingAC: [
      "Hot buses + high Uber tax = stranded riders. AC would have kept buses attractive this month.",
      "Heat without AC forces people off buses. Congestion follows.",
      "Extreme heat + low AC is a mobility crisis. Invest in climate control before next summer.",
      "The buses are like ovens. We're failing our primary transit users in this heat."
    ],
    coldNeedingAC: [
      "Cold buses + low AC = empty buses. Riders take Uber instead — congestion rises.",
      "Winter without bus heating hurts. AC is your most important lever in extreme months.",
      "Low-income riders can't afford both: a taxed Uber AND a cold bus. Heating is the solution.",
      "Buses are freezing. We need to reinvest tax revenue into better climate control."
    ],
    highCongestion: [
      "Roads are packed. Low Uber tax means cheap rides but clogged streets. Consider raising it.",
      "Too many cars. Uber tax would reduce congestion AND earn revenue.",
      "Gridlock. The weather is pushing people into Ubers — tax them to fund the solution.",
      "The city is grinding to a halt. If we don't tax these Ubers, they'll own the roads."
    ],
    lowMobility: [
      "Mobility dropped. The Uber tax may be too high, or AC too low to keep buses viable.",
      "City isn't moving much. Ease the tax or boost bus comfort.",
      "Total movement is down. We need to ensure transportation remains affordable and comfortable."
    ],
    budgetWarning: [
      "Budget thin. Uber tax is your income — make sure it's earning enough.",
      "Less than 20% remaining. Three cost streams vs one income stream — rebalance.",
      "Our reserves are low. We need to recalibrate the tax and subsidy balance."
    ],
    revenueGain: [
      "Budget grew this month — tax revenue exceeded bus and AC costs. The model is working.",
      "Positive budget month. Keep this balance.",
      "Revenue positive. Consistent policy beats erratic swings.",
      "We're in the black. The Uber tax is pulling its weight."
    ],
    balanced: [
      "Solid month. Mobility decent, buses comfortable, budget stable.",
      "Steady and sustainable.",
      "No alarms this month. A consistent hand on the tiller.",
      "Decent month. City is moving, traffic manageable, budget stable."
    ],
    noPolicy: [
      "No tax, no subsidy, no AC. Buses are uncomfortable, Uber unchecked, congestion high.",
      "Laissez-faire month. Weather and unchecked Uber stack the odds against the city.",
      "Total deregulation this month. The roads are suffering from our inaction."
    ],
    timedOut: [
      "Time ran out. Set AC first in extreme months — then tax and subsidy.",
      "The clock beat you. Hit End Turn earlier next month.",
      "Decision time expired. We're running with the existing policy.",
      "Timer hit zero. Quicker decisions needed next time."
    ],
  },
  tooltips: {
    happiness: "Overall citizen satisfaction. Driven by mobility, congestion, and budget stress. Extreme weather months can drag this down sharply without AC.",
    mobility: "How much citizens are moving. Uber tax reduces it slightly. Bus subsidies raise it directly — buses are the main mobility lever. Weather penalty reduces it — AC mitigates this.",
    congestion: "Road congestion. Uber tax reduces it. Bus subsidy reduces it. Extreme weather boosts Uber demand and raises congestion without AC.",
    budget: "Remaining budget ($30M). Uber tax earns money. Bus subsidies and AC cost money. AC costs scale with weather severity.",
    uberTax: "Tax on every Uber trip. Earns revenue + cuts congestion significantly. Reduces mobility only slightly — Ubers are a congestion lever, not a mobility lever.",
    busSubsidy: "Discount on bus fares. Directly boosts mobility — buses are the key mobility lever. Reduces congestion slightly. Costs budget. In extreme weather, low AC limits its effect — people avoid buses regardless of price.",
    acLevel: "Bus climate control. At 0%, extreme weather empties buses — dropping mobility sharply. At 100%, buses stay attractive year-round. Costs scale with temperature extremity. Below 25% in extreme weather triggers a collapse.",
  },
};

const DEBRIEF = {
  coreInsight: `Christensen & Osman (2023) found that hot weather causes significant mode substitution away from buses toward ride-hailing. When buses are uncomfortable AND Uber is taxed, citizens are caught between two bad options. Bus climate investment isn't just a comfort upgrade — it's a mobility and congestion policy tool.`,
  seasonInsight: `"Weathering the Ride" documents that temperature swings shift bus riders to ride-hailing. Without climate-controlled buses, seasonal extremes become seasonal congestion crises — occurring twice a year, every year. The fix: invest in AC before the peak, funded by Uber tax revenue.`,
  balanceInsight: `You found the balance: moderate Uber tax funding targeted bus subsidies and AC investment. This mirrors real policy recommendations — use ride-hailing taxes to cross-subsidize public transport, with particular attention to comfort in extreme weather.`,
  city3Teaser: `City 3 adds a harder challenge: not everyone is equal. Rich and poor citizens respond very differently to Uber taxes — and the equity implications are significant. How do you make a city work for everyone?`,
  source: `Christensen & Osman (2025) "Demand for Mobility" · Christensen & Osman (2023) "Weathering the Ride"`,
};

const CITY_INTRO_SLIDES = [
  {
    icon: "🌡️",
    label: "City 2: Riverdale",
    title: "Seasonal Struggles",
    text: "Riverdale—200,000 residents, and far less forgiving. Smallville was predictable. Here, extreme heat and freezing cold can disrupt the entire system.",
  },
  {
    icon: "❄️🔥",
    label: "New Lever",
    title: "Bus Climate Control",
    text: "When it's too hot or cold, people ditch buses for Ubers, causing massive congestion. Investing in Bus AC & Heating is now critical to keep buses attractive.",
  },
  {
    icon: "⚖️",
    label: "Strategic Briefing",
    title: "Balance the Seasons",
    text: "Use Uber tax revenue to fund both bus subsidies and year-round climate control. Ignore the weather, and your transit system collapses.",
    bullets: [
      { icon: "🌡️", text: "AC levels below 25% trigger a bus collapse" },
      { icon: "💰", text: "AC costs scale with temperature extremity" },
      { icon: "🚌", text: "Keep buses comfortable to maintain mobility" }
    ],
    buttonText: "Take Office",
    primary: true
  }
];

// ============================================================
//  SIMULATION ENGINE
// ============================================================
function getTemp(roundIndex) {
  const ti = SEASONS.tempIndex[roundIndex];
  return { tempIndex: ti, tempDiscomfort: Math.abs(ti) };
}

// Linear Uber mobility loss — small rate (Ubers give low mobility gain)
function uberMobilityLoss(tax) {
  return tax * 0.15;
}

function simulate(uberTax, busSubsidy, acLevel, roundIndex, budgetRemaining) {
  const { baseline, bus, uber, happiness } = SIMULATION;
  const { tempIndex: ti, tempDiscomfort } = getTemp(roundIndex);
  const acMitigation = Math.pow(acLevel / 100, SIMULATION.ac.mitigationExponent);

  // ── MOBILITY ─────────────────────────────────────────────────
  const uberLoss = uberMobilityLoss(uberTax);
  const mobilityBeforeBus = Math.max(0, baseline.mobilityScore - uberLoss);

  const busEffect = busSubsidy * bus.mobilityGainPerPercent;

  // AC collapse: extreme weather + AC below threshold → 2.5× penalty
  const collapseActive = tempDiscomfort > 0.6 && acMitigation < SEASONS.acCollapseThreshold;
  const collapseMulti = collapseActive ? SEASONS.collapseMultiplier : 1.0;
  const busTempPenalty = tempDiscomfort * SEASONS.peakBusMobilityPenalty * (1 - acMitigation) * collapseMulti;
  const baselineTempPenalty = tempDiscomfort * SEASONS.peakBaselineMobilityPenalty;
  const weatherUberBoost = tempDiscomfort * SEASONS.peakUberDemandBoost * (1 - acMitigation * 0.5);

  const mobilityScore = Math.min(100, Math.max(0,
    mobilityBeforeBus + busEffect - busTempPenalty - baselineTempPenalty + weatherUberBoost * 0.25
  ));

  // ── CONGESTION ───────────────────────────────────────────────
  const congestionLevel = Math.min(100, Math.max(5,
    baseline.congestionLevel
    - uberTax * uber.congestionReductionPerPercent
    - busSubsidy * bus.congestionOffsetPerPercent
    + weatherUberBoost * 0.2
  ));

  // ── BUDGET ───────────────────────────────────────────────────
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const budgetStress = budgetFraction > 0.5 ? 0 : (0.5 - budgetFraction) / 0.5;
  const activity = (mobilityScore + congestionLevel) / 2;
  const uberRevenue = (uberTax / 100) * uber.revenueRate * activity * 200;
  const busCost = (busSubsidy / 100) * bus.costRate * activity * 200;
  const acCost = (acLevel / 100) * SIMULATION.ac.costRate * (0.2 + tempDiscomfort * 0.8) * 200;
  const monthlyDelta = +(uberRevenue - busCost - acCost).toFixed(3);

  // ── HAPPINESS ────────────────────────────────────────────────
  const mobilityGain = mobilityScore - baseline.mobilityScore;
  const congestionPain = congestionLevel - baseline.congestionLevel;
  const happinessScore = Math.min(happiness.max, Math.max(happiness.min,
    baseline.happinessScore
    + mobilityGain * happiness.mobilityWeight
    - congestionPain * happiness.congestionWeight
    - budgetStress * 25 * happiness.budgetStressWeight
  ));

  const busIsConstraining = false; // flip mechanic removed — bus always boosts
  const weatherAlert = tempDiscomfort > 0.6 && acLevel < 30;

  const hMob = mobilityGain * happiness.mobilityWeight;
  const hCong = -congestionPain * happiness.congestionWeight;
  const hBudg = -budgetStress * 25 * happiness.budgetStressWeight;

  return {
    mobilityScore, congestionLevel, happinessScore,
    monthlyDelta, uberRevenue, busCost, acCost,
    budgetStress, busIsConstraining, weatherAlert, collapseActive,
    tempDiscomfort, tempIndex: ti, mobilityBeforeBus,
    mobilityBreakdown: [
      { label: "Bus Boost", value: busEffect, color: C.green },
      { label: "Weather", value: -busTempPenalty, color: C.blue },
      { label: "Uber Loss", value: -uberLoss, color: C.red }
    ],
    happinessBreakdown: [
      { label: "Mobility", value: hMob, color: C.blue },
      { label: "Congestion", value: hCong, color: C.amber },
      { label: "Budget", value: hBudg, color: C.red }
    ]
  };
}

// Causal year-end failure diagnosis
function diagnoseRun(history, finalBudget) {
  const avgM = history.reduce((s, m) => s + m.mobilityScore, 0) / history.length;
  const avgC = history.reduce((s, m) => s + m.congestionLevel, 0) / history.length;
  const avgU = history.reduce((s, m) => s + m.uberTax, 0) / history.length;
  const avgB = history.reduce((s, m) => s + m.busSubsidy, 0) / history.length;
  const avgH = history.reduce((s, m) => s + m.happinessScore, 0) / history.length;
  const budFrac = finalBudget / BUDGET_CONFIG.annualBudget;
  const worstIdx = history.reduce((wi, m, i) => m.happinessScore < history[wi].happinessScore ? i : wi, 0);
  const worst = { ...history[worstIdx], idx: worstIdx };
  const failures = [];

  // Check for seasonal bus collapse
  const extremeMonths = history.filter((_, i) => Math.abs(SEASONS.tempIndex[i]) >= 0.7);
  const collapseMonths = extremeMonths.filter(m => m.acLevel < 15 && m.mobilityScore < 40);
  if (collapseMonths.length >= 2) {
    failures.push({
      icon: "🌡️", color: C.amber, bg: C.amberBg, border: C.amberBorder,
      title: "Seasonal bus collapse",
      body: `In ${collapseMonths.length} extreme weather months, AC was below 15% — triggering a bus collapse. Riders switched to Uber, congestion rose, and mobility fell sharply. This is the "Weathering the Ride" finding in action.`,
      research: "Christensen & Osman (2023): extreme heat dampens the mobility increase from price cuts by 26%, as riders shift towards ride-hailing for climate control. Without AC, the system loses its primary equity tool during temperature spikes.",
    });
  }
  if (avgM < 44 && avgU > 55) {
    failures.push({
      icon: "🚕", color: C.red, bg: C.redBg, border: C.redBorder,
      title: "Uber tax crushed mobility",
      body: `Average Uber tax was ${Math.round(avgU)}%. High Uber tax reduces mobility — pair it with a strong bus subsidy to keep people moving. Worst month: ${MONTHS[worst.idx]} (happiness ${Math.round(worst.happinessScore)}). The fix: moderate Uber tax funding a generous bus subsidy.`,
      research: "Cairo study: Uber price increases reduce mobility, especially for lower-income riders. Reinvesting tax revenue into bus subsidies and AC keeps the city moving.",
    });
  }
  if (avgC > 65 && avgU < 25) {
    failures.push({
      icon: "🚗", color: C.textMuted, bg: C.insetBg, border: C.border,
      title: "Congestion went unchecked",
      body: `Average congestion was ${Math.round(avgC)} with only ${Math.round(avgU)}% Uber tax. A city of 200k with low tax and extreme weather means heavy traffic. Even 25–35% tax would have cleared congestion and earned revenue.`,
      research: "Cairo equilibrium model: market-level Uber price reduction raises external costs by ~0.7% of city GDP. Low tax compounds quickly in large cities.",
    });
  }
  if (budFrac < 0.10 && avgB > 55) {
    failures.push({
      icon: "💸", color: C.blue, bg: C.blueBg, border: C.blueBorder,
      title: "Spending outpaced tax revenue",
      body: `Budget ended at $${finalBudget.toFixed(1)}M. Three cost streams (bus, AC, lost Uber activity) vs one income stream. Average bus subsidy was ${Math.round(avgB)}% — calibrate against Uber tax revenue.`,
      research: "Transport subsidy costs scale with ridership. Consistent, calibrated rates beat erratic high/low swings.",
    });
  }
  if (failures.length === 0 && avgH < 63) {
    failures.push({
      icon: "😐", color: C.textMuted, bg: C.insetBg, border: C.border,
      title: "Cautious policy, cautious results",
      body: `No single disaster — but no bold seasonal planning either. Average happiness ${Math.round(avgH)}. Sweet spot: ~40% Uber tax, ~50% bus subsidy, ~60% AC in extreme months.`,
      research: "Optimal transport policy requires calibrated seasonal intervention — not just consistent averages.",
    });
  }
  return { failures, worstMonth: MONTHS[worst.idx], worstHappiness: Math.round(worst.happinessScore) };
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getMonthEndMessage(stats, uberTax, bus, ac, budgetFraction, timedOut, roundIndex) {
  const r = ADVISOR.monthEndReactions;
  if (timedOut) return pickRandom(r.timedOut);
  if (uberTax === 0 && bus === 0 && ac === 0) return pickRandom(r.noPolicy);
  if (budgetFraction < BUDGET_CONFIG.warningFraction) return pickRandom(r.budgetWarning);
  
  const ti = SEASONS.tempIndex[roundIndex];
  if (stats.weatherAlert && ti > 0.5) return pickRandom(r.heatNeedingAC);
  if (stats.weatherAlert && ti < -0.5) return pickRandom(r.coldNeedingAC);
  
  const t = SIMULATION.thresholds;
  if (stats.happinessScore >= t.happiness.good) return pickRandom(r.highHappiness);
  if (stats.congestionLevel >= t.congestion.warning) return pickRandom(r.highCongestion);
  if (stats.mobilityScore <= t.mobility.warning) return pickRandom(r.lowMobility);
  if (stats.monthlyDelta > 0) return pickRandom(r.revenueGain);
  
  return pickRandom(r.balanced);
}

function getGrade(score) {
  return SCORING.grades.find(g => score >= g.min) || SCORING.grades[SCORING.grades.length - 1];
}

function gc(value, type) {
  const t = SIMULATION.thresholds[type];
  if (!t) return C.textMuted;
  if (type === "congestion") {
    if (value <= t.good) return C.green;
    if (value <= t.warning) return C.amber;
    return C.red;
  }
  if (type === "budget") {
    if (value >= t.safe) return C.green;
    if (value >= t.warning) return C.amber;
    return C.red;
  }
  if (value >= t.good) return C.green;
  if (value >= t.warning) return C.amber;
  return C.red;
}

// ============================================================
//  UI COMPONENTS
// ============================================================
function InfoTip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: "50%", width: 16, height: 16, cursor: "pointer", color: C.textMuted, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>i</button>
      {show && (
        <div style={{ position: "absolute", right: 0, top: 20, width: 220, background: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px", fontSize: 11, color: C.insetBg, zIndex: 300, lineHeight: 1.5, pointerEvents: "none" }}>{text}</div>
      )}
    </div>
  );
}

function GaugeBar({ label, value, type, tooltip, extra, breakdown, target, prev, subLabel }) {
  const color = gc(value, type);
  const barW = type === "budget" ? value * 100 : Math.round(value);
  const display = type === "budget" ? `$${(value * BUDGET_CONFIG.annualBudget).toFixed(1)}M` : Math.round(value);
  const delta = (type !== "budget" && prev != null) ? Math.round(value) - Math.round(prev) : null;
  return (
    <div style={{ marginBottom: 15 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
          {subLabel && <span style={{ fontSize: 9, color: C.textFaint }}>{subLabel}</span>}
          <InfoTip text={tooltip} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{display}</span>
          {delta != null && delta !== 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: delta > 0 ? C.green : C.red, marginLeft: 3 }}>
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
          {extra && <span style={{ fontSize: 9, color: C.textFaint }}>{extra}</span>}
        </div>
      </div>
      <div style={{ height: 6, background: C.track, borderRadius: 3, overflow: "hidden", marginBottom: breakdown ? 6 : 0 }}>
        <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, barW))}%`, background: color, borderRadius: 3, transition: "width 0.35s ease, background 0.3s" }} />
      </div>
      {target && (
        <div style={{ fontSize: 9, color: C.textFaint, marginTop: 2 }}>{target}</div>
      )}
      {breakdown && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {breakdown.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.color }} />
              <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 600 }}>
                {item.label}: <span style={{ color: item.value >= 0 ? C.green : C.red }}>{item.value >= 0 ? "+" : ""}{item.value.toFixed(1)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function SliderInput({ label, value, onChange, color, tooltip, locked, tag, badge, hint }) {
  return (
    <div style={{ marginBottom: 18, opacity: locked ? 0.5 : 1, transition: "opacity 0.3s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: locked ? C.border : color }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: locked ? C.textMuted : C.text }}>{label}</span>
          {tag && <span style={{ fontSize: 9, background: tag.bg, color: tag.color, border: `1px solid ${tag.border}`, borderRadius: 4, padding: "2px 6px", fontWeight: 700 }}>{tag.text}</span>}
          <InfoTip text={tooltip} />
        </div>
        <span style={{ fontSize: 20, fontWeight: 700, color: locked ? C.textMuted : color, fontVariantNumeric: "tabular-nums" }}>{value}%</span>
      </div>
      {badge}
      <input type="range" min={0} max={100} step={5} value={value}
        onChange={e => !locked && onChange(Number(e.target.value))} disabled={locked}
        style={{ width: "100%", accentColor: color, cursor: locked ? "not-allowed" : "pointer", touchAction: "none" }} />
      {hint && (
        <div style={{ fontSize: 9, color: C.textFaint, marginTop: 2, lineHeight: 1.4 }}>{hint}</div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.textFaint, marginTop: 2 }}>
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>
  );
}

function TaxZoneWarning({ tax }) {
  if (tax < 50) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 6, padding: "4px 9px", fontSize: 10, fontWeight: 700, color: C.amber, marginTop: 4 }}>
      ⚠️ High tax — Uber usage falling, boost bus subsidy to maintain mobility
    </div>
  );
}

function BudgetDeltaPreview({ delta, uberRevenue, busCost, acCost }) {
  const pos = delta >= 0;
  return (
    <div style={{ background: pos ? C.greenBg : C.redBg, border: `1px solid ${pos ? C.greenBorder : C.redBorder}`, borderRadius: 8, padding: "9px 13px", marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>Est. budget change</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: pos ? C.green : C.red }}>{pos ? "+" : ""}{delta.toFixed(2)}M</span>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 10, color: C.textFaint }}>
        <span style={{ color: C.green }}>+${uberRevenue.toFixed(2)} tax</span>
        <span style={{ color: C.red }}>−${busCost.toFixed(2)} bus</span>
        <span style={{ color: C.red }}>−${acCost.toFixed(2)} AC</span>
      </div>
    </div>
  );
}

function AdvisorBox({ message }) {
  return (
    <div style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 9, alignItems: "flex-start" }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>🧑‍💼</span>
      <div>
        <div style={{ fontSize: 9, fontWeight: 800, color: C.blue, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 3 }}>{ADVISOR.name} · {ADVISOR.title}</div>
        <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.55 }}>{message}</div>
      </div>
    </div>
  );
}

function SeasonBadge({ roundIndex }) {
  const ti = SEASONS.tempIndex[roundIndex];
  const discomfort = Math.abs(ti);
  const color = discomfort > 0.7 ? C.red : discomfort > 0.3 ? C.amber : C.green;
  const bg = discomfort > 0.7 ? C.redBg : discomfort > 0.3 ? C.amberBg : C.greenBg;
  const bd = discomfort > 0.7 ? C.redBorder : discomfort > 0.3 ? C.amberBorder : C.greenBorder;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, background: bg, border: `1px solid ${bd}`, borderRadius: 6, padding: "4px 9px" }}>
      <span style={{ fontSize: 14 }}>{SEASONS.seasonIcon[roundIndex]}</span>
      <div>
        <div style={{ fontSize: 9, color: C.textFaint, textTransform: "uppercase", letterSpacing: 1 }}>Season</div>
        <div style={{ fontSize: 11, fontWeight: 700, color }}>{SEASONS.seasonLabel[roundIndex]}</div>
      </div>
    </div>
  );
}

function StatPill({ label, value, color, small }) {
  return (
    <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 7, padding: small ? "5px 7px" : "7px 8px", textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 9, color: C.textFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: small ? 14 : 17, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {typeof value === "number" ? Math.round(value) : value}
      </div>
    </div>
  );
}

function CountdownRing({ timeLeft, total }) {
  const r = 25, circ = 2 * Math.PI * r;
  const offset = circ * (1 - timeLeft / total);
  const warn = timeLeft <= TIMER.warningAt;
  const color = warn ? C.red : timeLeft <= total * 0.5 ? C.amber : C.blue;
  return (
    <div style={{ position: "relative", width: 60, height: 60, flexShrink: 0 }}>
      <svg width="60" height="60" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="30" cy="30" r={r} fill="none" stroke={C.track} strokeWidth="5" />
        <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 17, fontWeight: 700, color, lineHeight: 1 }}>{timeLeft}</span>
        <span style={{ fontSize: 8, color: C.textFaint, textTransform: "uppercase" }}>sec</span>
      </div>
    </div>
  );
}

function MonthEndingOverlay({ month }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: C.overlay, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 999, fontFamily: "Georgia,serif" }}>
      <style>{`@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes dot{0%,100%{opacity:0.15}50%{opacity:1}}`}</style>
      <div style={{ textAlign: "center", animation: "slideUp 0.3s ease" }}>
        <div style={{ fontSize: 42, marginBottom: 10 }}>⏰</div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: C.blue, textTransform: "uppercase", marginBottom: 8 }}>Month Locked</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: C.text }}>{month} Ending...</div>
        <div style={{ marginTop: 14, display: "flex", gap: 6, justifyContent: "center" }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.blue, animation: `dot 0.9s ${i * 0.3}s ease-in-out infinite` }} />)}
        </div>
      </div>
    </div>
  );
}

function PoliticalLossScreen({ month, onRestart, onContinue }) {
  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia,serif", padding: 24 }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 54, marginBottom: 10 }}>🗳️</div>
        <div style={{ fontSize: 11, letterSpacing: 3, color: C.purple, textTransform: "uppercase", marginBottom: 8, fontWeight: 800 }}>Political Ejection</div>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: "0 0 10px" }}>You've been voted out</h2>
        <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.7, marginBottom: 10 }}>Citizens lost confidence after <strong>3 consecutive months</strong> of happiness below 30. Riverdale needs a new Transport Director.</p>
        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 20 }}>Removed in <strong>{month}</strong>. Sustained low happiness — especially in extreme weather months — signals policy failure.</p>
        <div style={{ marginBottom: 22 }}><AdvisorBox message="Three consecutive months of deep unhappiness is a political signal. Check whether the Uber tax was too high without bus and AC compensation." /></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onRestart} style={{ flex: 1, background: C.purple, color: "#fff", border: "none", borderRadius: 9, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>↺ Try Again</button>
          <button onClick={onContinue} style={{ flex: 1, background: C.cardBg, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 9, padding: "13px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Continue (no score)</button>
        </div>
      </div>
    </div>
  );
}

function GameOverScreen({ month, onRestart, onContinue }) {
  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia,serif", padding: 20 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>💸</div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: C.red, textTransform: "uppercase", marginBottom: 8 }}>Budget Depleted</div>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: "0 0 8px" }}>Riverdale Bankrupt</h2>
        <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.7, marginBottom: 22 }}>
          The city ran out of funds in <strong>{month}</strong>. Bus and AC costs outpaced Uber tax revenue.
        </p>
        <div style={{ marginBottom: 22 }}><AdvisorBox message="Three cost streams need to balance against one income stream. Raise the Uber tax — it's your only source of revenue." /></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onRestart} style={{ flex: 1, background: C.blue, color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>↺ Start Over</button>
          <button onClick={onContinue} style={{ flex: 1, background: C.cardBg, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Continue (no score)</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  SCREENS
// ============================================================

function StructuralBanner({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, background: C.insetBg, border: `1px solid ${C.border}`, borderRadius: 4, padding: "3px 7px", letterSpacing: 0.3 }}>
          {item}
        </div>
      ))}
    </div>
  );
}

function computeWarnings(uberTax, busSubsidy, acLevel, live, roundIndex, budgetFraction) {
  const w = [];
  if (uberTax > 60 && busSubsidy < 30) w.push("High Uber tax without bus subsidy — mobility will drop. Raise bus subsidy.");
  if (Math.abs(SEASONS.tempIndex[roundIndex]) > 0.6 && acLevel < 25) w.push("Extreme weather + AC below 25% — bus collapse risk this month.");
  if (Math.abs(SEASONS.tempIndex[roundIndex]) > 0.3 && acLevel < 15) w.push("AC very low for seasonal conditions — riders may switch to Uber.");
  if (live.monthlyDelta < -0.3 && budgetFraction < 0.35) w.push("Costs exceed revenue — budget is draining.");
  return w;
}

function generateChangeSummary(stats, prevStats, uberTax, busSubsidy, acLevel, roundIndex) {
  const lines = [];
  const tempHigh = Math.abs(SEASONS.tempIndex[roundIndex]) > 0.6;
  const tempMild = Math.abs(SEASONS.tempIndex[roundIndex]) < 0.3;
  if (uberTax > 0) {
    lines.push({ icon: "💰", text: `Uber tax at ${uberTax}% generated revenue and cut congestion${uberTax > 60 ? " — raise bus subsidy to offset mobility loss" : ""}.` });
  }
  if (busSubsidy > 0) {
    lines.push({ icon: "🚌", text: `Bus subsidy (${busSubsidy}%) boosted mobility and reduced congestion.` });
  }
  if (tempHigh) {
    if (acLevel < 25) lines.push({ icon: "🌡️", text: `Extreme weather with low AC (${acLevel}%) — buses became uncomfortable, riders switched to Uber.` });
    else lines.push({ icon: "❄️", text: `Extreme weather, but AC at ${acLevel}% softened the penalty on bus use.` });
  } else if (!tempMild && acLevel < 30) {
    lines.push({ icon: "🌤️", text: `Seasonal conditions with low AC (${acLevel}%) — mild extra penalty on bus comfort.` });
  }
  if (stats.monthlyDelta < 0) lines.push({ icon: "📉", text: `Budget fell $${Math.abs(stats.monthlyDelta).toFixed(1)}M — costs outpaced revenue.` });
  else lines.push({ icon: "📈", text: `Budget grew $${stats.monthlyDelta.toFixed(1)}M — revenue covered costs.` });
  return lines;
}

function IntroScreen({ onStart }) {
  return (
    <CityIntroFlow
      slides={CITY_INTRO_SLIDES}
      onComplete={onStart}
      colorTokens={C}
    />
  );
}

function PlanningScreen({ month, roundIndex, uberTax, busSubsidy, acLevel, onUberChange, onBusChange, onACChange, onCommit, budgetRemaining }) {
  const [timeLeft, setTimeLeft] = useState(TIMER.monthDuration);
  const [locked, setLocked] = useState(false);
  const [ending, setEnding] = useState(false);
  const uberRef = useRef(uberTax);
  const busRef = useRef(busSubsidy);
  const acRef = useRef(acLevel);
  const lockedRef = useRef(false);
  useEffect(() => { uberRef.current = uberTax; }, [uberTax]);
  useEffect(() => { busRef.current = busSubsidy; }, [busSubsidy]);
  useEffect(() => { acRef.current = acLevel; }, [acLevel]);

  const commitMonth = useCallback((wasTimedOut) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true); setEnding(true);
    setTimeout(() => onCommit(uberRef.current, busRef.current, acRef.current, wasTimedOut), TIMER.endingDuration);
  }, [onCommit]);

  useEffect(() => {
    setTimeLeft(TIMER.monthDuration); setLocked(false); setEnding(false); lockedRef.current = false;
    const iv = setInterval(() => {
      setTimeLeft(prev => { if (prev <= 1) { clearInterval(iv); commitMonth(true); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(iv);
  }, [roundIndex]);

  const live = simulate(uberTax, busSubsidy, acLevel, roundIndex, budgetRemaining);
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const warn = timeLeft <= TIMER.warningAt && timeLeft > 0;

  const budgetColor = gc(budgetFraction, "budget");
  const seasonIcon = SEASONS.seasonIcon[roundIndex];
  const warnings = computeWarnings(uberTax, busSubsidy, acLevel, live, roundIndex, budgetFraction);

  return (
    <div style={{
      height: "100vh", background: C.pageBg, fontFamily: "Georgia,serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
      outline: warn ? `3px solid ${C.red}` : "3px solid transparent",
      outlineOffset: "-3px", transition: "outline 0.3s",
    }}>
      {ending && <MonthEndingOverlay month={month} />}

      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 12,
        padding: "8px 16px", background: C.cardBg,
        borderBottom: `1px solid ${C.border}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}>
        <div style={{ minWidth: 110 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: C.blue, textTransform: "uppercase", fontWeight: 800 }}>City 2 · {CITY_META.name}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>{month}</div>
        </div>
        <SeasonBadge roundIndex={roundIndex} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 9, color: C.textFaint }}>
            <span>Jan</span>
            <span style={{ color: C.blue, fontWeight: 700 }}>{roundIndex + 1}/12</span>
            <span>Dec</span>
          </div>
          <div style={{ height: 5, background: C.track, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${((roundIndex + 1) / 12) * 100}%`, background: C.blue, borderRadius: 3, transition: "width 0.4s" }} />
          </div>
        </div>
        <div style={{
          background: budgetColor === C.green ? C.greenBg : budgetColor === C.amber ? C.amberBg : C.redBg,
          border: `1px solid ${budgetColor === C.green ? C.greenBorder : budgetColor === C.amber ? C.amberBorder : C.redBorder}`,
          borderRadius: 8, padding: "5px 12px", textAlign: "center", minWidth: 88,
        }}>
          <div style={{ fontSize: 9, color: C.textFaint, textTransform: "uppercase", letterSpacing: 1 }}>Budget</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: budgetColor }}>${budgetRemaining.toFixed(1)}M</div>
        </div>
        <CountdownRing timeLeft={timeLeft} total={TIMER.monthDuration} />
        <button onClick={() => commitMonth(false)} disabled={locked} style={{
          background: locked ? C.border : C.green, color: locked ? C.textMuted : "#fff",
          border: "none", borderRadius: 8, padding: "10px 18px",
          fontSize: 14, fontWeight: 800, cursor: locked ? "not-allowed" : "pointer",
          transition: "background 0.2s", whiteSpace: "nowrap",
        }}>
          {locked ? "⏳ Locking..." : "✓ End Turn"}
        </button>
      </div>

      {/* ── 3-COLUMN BODY ───────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT: Policy sliders */}
        <div style={{
          width: 272, flexShrink: 0, overflowY: "auto",
          padding: "14px 16px", borderRight: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Set Policy {locked && <span style={{ color: C.red }}>🔒</span>}
          </div>

          {live.collapseActive && (
            <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10, display: "flex", gap: 7, alignItems: "flex-start" }}>
              <span style={{ fontSize: 15 }}>{seasonIcon}</span>
              <span style={{ fontSize: 10, color: C.red, fontWeight: 700, lineHeight: 1.4 }}>🔴 COLLAPSE — Extreme {live.tempIndex > 0 ? "heat" : "cold"} + AC below 15% is emptying buses.</span>
            </div>
          )}
          {!live.collapseActive && live.weatherAlert && (
            <div style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10, display: "flex", gap: 7, alignItems: "flex-start" }}>
              <span style={{ fontSize: 15 }}>{seasonIcon}</span>
              <span style={{ fontSize: 10, color: C.amber, fontWeight: 700, lineHeight: 1.4 }}>⚠️ Extreme {live.tempIndex > 0 ? "heat" : "cold"} — raise AC to keep buses attractive.</span>
            </div>
          )}

          <SliderInput label="Uber Tax" value={uberTax} onChange={onUberChange} color={C.uberColor}
            tooltip={ADVISOR.tooltips.uberTax} locked={locked}
            tag={{ text: "earns $", bg: C.greenBg, color: C.green, border: C.greenBorder }}
            badge={<TaxZoneWarning tax={uberTax} />}
            hint="Raises revenue · lowers congestion · pair with bus subsidy at high levels" />
          <SliderInput label="Bus Fare Subsidy" value={busSubsidy} onChange={onBusChange} color={C.busColor}
            tooltip={ADVISOR.tooltips.busSubsidy} locked={locked}
            tag={{ text: "costs $", bg: C.redBg, color: C.red, border: C.redBorder }}
            hint="Directly boosts mobility · costs budget · less effective if buses are uncomfortable (low AC)" />
          <SliderInput label="Bus AC & Heating" value={acLevel} onChange={onACChange} color={C.acColor}
            tooltip={ADVISOR.tooltips.acLevel} locked={locked}
            tag={{ text: "costs $", bg: C.redBg, color: C.red, border: C.redBorder }}
            hint="Keeps buses comfortable in extreme weather · costs more in harsh months" />
          <BudgetDeltaPreview delta={live.monthlyDelta} uberRevenue={live.uberRevenue} busCost={live.busCost} acCost={live.acCost} />

          {warnings.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {warnings.map((w, i) => (
                <div key={i} style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 6, padding: "5px 10px", fontSize: 10, color: C.amber, fontWeight: 700, marginBottom: 4 }}>
                  ⚠️ {w}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CENTER: City road visualization */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <CityRoadScene
            cityLevel={2}
            uberTax={uberTax}
            busSubsidy={busSubsidy}
            congestion={live.congestionLevel}
            seasonIcon={seasonIcon}
          />
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "10px 14px",
            background: "rgba(255,255,255,0.93)",
            backdropFilter: "blur(4px)",
            borderTop: `1px solid ${C.border}`,
          }}>
            <AdvisorBox message={ADVISOR.monthStartHints[roundIndex]} />
          </div>
        </div>

        {/* RIGHT: Metrics */}
        <div style={{
          width: 272, flexShrink: 0, overflowY: "auto",
          padding: "14px 16px", borderLeft: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Live Preview</div>
          <GaugeBar
            label="Happiness"
            value={live.happinessScore}
            type="happiness"
            tooltip={ADVISOR.tooltips.happiness}
            breakdown={live.happinessBreakdown}
            target="Goal: 65+"
          />
          <GaugeBar
            label="Mobility"
            value={live.mobilityScore}
            type="mobility"
            tooltip={ADVISOR.tooltips.mobility}
            breakdown={live.mobilityBreakdown}
            target="Target: 55–75"
          />
          <GaugeBar label="Congestion" value={live.congestionLevel} type="congestion" tooltip={ADVISOR.tooltips.congestion} target="Goal: under 40" />
          <GaugeBar label="Budget" value={budgetFraction} type="budget" tooltip={ADVISOR.tooltips.budget} extra={`/ $${BUDGET_CONFIG.annualBudget}M`} target="Safe zone: above $6M" />
          <div style={{ fontSize: 10, color: C.textFaint, marginTop: 4 }}>
            +${live.uberRevenue.toFixed(2)} tax &nbsp;−${live.busCost.toFixed(2)} bus &nbsp;−${live.acCost.toFixed(2)} AC
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ month, roundIndex, stats, uberTax, busSubsidy, acLevel, advisorMessage, onNext, history, timedOut, budgetRemaining }) {
  const prevStats = history.length >= 2 ? history[history.length - 2] : null;
  const { mobilityScore, congestionLevel, happinessScore, monthlyDelta, uberRevenue, busCost, acCost } = stats;
  const ytdH = Math.round(history.reduce((s, m) => s + m.happinessScore, 0) / history.length);
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const isLast = roundIndex === 11;
  const pos = monthlyDelta >= 0;

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: "Georgia,serif", padding: "14px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: C.green, textTransform: "uppercase", fontWeight: 800 }}>Month Complete</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "2px 0 0" }}>{month} Results</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SeasonBadge roundIndex={roundIndex} />
            <span style={{ fontSize: 14, fontWeight: 800, color: C.textMuted }}>{roundIndex + 1}/12</span>
          </div>
        </div>

        {/* Policy row */}
        <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
          {[[uberTax, C.uberColor, "Uber Tax"], [busSubsidy, C.busColor, "Bus Sub"], [acLevel, C.acColor, "AC"]].map(([v, col, l]) => (
            <div key={l} style={{ flex: 1, background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: C.textFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: col }}>{v}%</div>
            </div>
          ))}
          <div style={{ flex: 1.4, background: pos ? C.greenBg : C.redBg, border: `1px solid ${pos ? C.greenBorder : C.redBorder}`, borderRadius: 7, padding: "8px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Budget Δ</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: pos ? C.green : C.red }}>{pos ? "+" : ""}{monthlyDelta.toFixed(2)}M</div>
            <div style={{ fontSize: 8, color: C.textFaint }}>+{uberRevenue.toFixed(1)} −{busCost.toFixed(1)} −{acCost.toFixed(1)}</div>
          </div>
          {timedOut && <div style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 7, padding: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 12 }}>⏰</span></div>}
        </div>

        {/* Stat pills */}
        <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
          <StatPill label="Happiness" value={happinessScore} color={gc(happinessScore, "happiness")} small />
          <StatPill label="Mobility" value={mobilityScore} color={gc(mobilityScore, "mobility")} small />
          <StatPill label="Congestion" value={congestionLevel} color={gc(congestionLevel, "congestion")} small />
          <StatPill label="Budget" value={`$${budgetRemaining.toFixed(1)}M`} color={gc(budgetFraction, "budget")} small />
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 9 }}>
          <GaugeBar label="Happiness" value={happinessScore} type="happiness" tooltip={ADVISOR.tooltips.happiness} breakdown={stats.happinessBreakdown} target="Goal: 65+" prev={prevStats?.happinessScore ?? null} />
          <GaugeBar label="Mobility" value={mobilityScore} type="mobility" tooltip={ADVISOR.tooltips.mobility} breakdown={stats.mobilityBreakdown} target="Target: 55–75" prev={prevStats?.mobilityScore ?? null} />
          <GaugeBar label="Congestion" value={congestionLevel} type="congestion" tooltip={ADVISOR.tooltips.congestion} target="Goal: under 40" prev={prevStats?.congestionLevel ?? null} />
          <GaugeBar label="Budget" value={budgetFraction} type="budget" tooltip={ADVISOR.tooltips.budget} extra={`/ $${BUDGET_CONFIG.annualBudget}M`} target="Safe zone: above $6M" />
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 13px", marginBottom: 9, display: "flex", justifyContent: "space-between" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textFaint }}>YTD Happiness</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: gc(ytdH, "happiness") }}>{ytdH}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textFaint }}>Season</div>
            <div style={{ fontSize: 16 }}>{SEASONS.seasonIcon[roundIndex]}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textFaint }}>Budget Left</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: gc(budgetFraction, "budget") }}>${budgetRemaining.toFixed(1)}M</div>
          </div>
        </div>

        {/* Strategic Success Banner */}
        {(stats.tempDiscomfort > 0.6 && acLevel >= 40) && (
          <div style={{ background: C.purpleBg, border: `1px solid ${C.purpleBorder}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 20 }}>❄️</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Strategic Success</div>
              <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.4 }}>
                Your climate investment is working! High {stats.tempIndex > 0 ? "AC" : "heating"} levels are keeping the bus network viable despite the extreme weather.
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 18 }}><AdvisorBox message={advisorMessage} /></div>

        {/* Why this changed */}
        {(() => {
          const lines = generateChangeSummary(stats, prevStats, uberTax, busSubsidy, acLevel, roundIndex);
          if (lines.length === 0) return null;
          return (
            <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Why this changed</div>
              {lines.map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1.3 }}>{line.icon}</span>
                  <span style={{ fontSize: 11, color: C.textSub, lineHeight: 1.5 }}>{line.text}</span>
                </div>
              ))}
            </div>
          );
        })()}

        <button onClick={onNext} style={{ width: "100%", background: isLast ? C.green : C.blue, color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
          {isLast ? "See Final Score →" : `Next: ${MONTHS[roundIndex + 1]} →`}
        </button>
      </div>
    </div>
  );
}

function YearEndScreen({ history, finalBudget, onRestart, scoreless }) {
  const avgH = history.reduce((s, m) => s + m.happinessScore, 0) / history.length;
  const avgM = history.reduce((s, m) => s + m.mobilityScore, 0) / history.length;
  const avgC = history.reduce((s, m) => s + m.congestionLevel, 0) / history.length;
  const budgetEff = (finalBudget / BUDGET_CONFIG.annualBudget) * 100;
  const bonus = scoreless ? 0 : Math.max(0, (finalBudget / BUDGET_CONFIG.annualBudget) * 100 * BUDGET_CONFIG.budgetBonusWeight);
  const finalScore = scoreless ? 0 : Math.min(100, Math.round(avgH + bonus));
  const grade = getGrade(scoreless ? 0 : finalScore);
  const budgetSpent = BUDGET_CONFIG.annualBudget - finalBudget;
  const { failures, worstMonth, worstHappiness } = diagnoseRun(history, finalBudget);
  const [openIdx, setOpenIdx] = useState(null);

  const chartData = history.map((m, i) => ({
    month: MONTHS[i].slice(0, 3),
    happiness: Math.round(m.happinessScore),
    mobility: Math.round(m.mobilityScore),
    congestion: Math.round(m.congestionLevel),
    delta: +m.monthlyDelta.toFixed(2),
    icon: SEASONS.seasonIcon[i],
  }));

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: "Georgia,serif", padding: "14px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: C.blue, textTransform: "uppercase", marginBottom: 8, fontWeight: 800 }}>Year Complete · {CITY_META.name}</div>
          {scoreless
            ? <div style={{ fontSize: 44, fontWeight: 800, color: C.red }}>Bankrupt</div>
            : <div style={{ fontSize: 86, fontWeight: 800, color: grade.color, lineHeight: 1 }}>{grade.grade}</div>}
          <div style={{ fontSize: 16, color: C.textSub, marginTop: 5, fontWeight: 600 }}>{scoreless ? "City ran out of funds" : grade.label}</div>
          {!scoreless && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
            Score: {finalScore} = happiness {Math.round(avgH)} + budget bonus {Math.round(bonus)}
          </div>}
        </div>

        <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
          <StatPill label="Avg Happiness" value={avgH} color={gc(avgH, "happiness")} small />
          <StatPill label="Avg Mobility" value={avgM} color={gc(avgM, "mobility")} small />
          <StatPill label="Avg Congestion" value={avgC} color={gc(avgC, "congestion")} small />
          <StatPill label="Budget Spent" value={`$${budgetSpent.toFixed(1)}M`} color={gc(finalBudget / BUDGET_CONFIG.annualBudget, "budget")} small />
        </div>

        {/* Happiness chart */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 14px 8px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Happiness — 12 Months</div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11 }} formatter={v => [v, "Happiness"]} />
              <Bar dataKey="happiness" radius={[3, 3, 0, 0]}>
                {chartData.map((e, i) => <Cell key={i} fill={gc(e.happiness, "happiness")} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Budget chart */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 14px 8px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Monthly Budget Δ</div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11 }} formatter={v => [`$${v}M`, "Budget Δ"]} />
              <Bar dataKey="delta" radius={[3, 3, 0, 0]}>
                {chartData.map((e, i) => <Cell key={i} fill={e.delta >= 0 ? C.green : C.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Failure diagnosis */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>🔍 What Held You Back</div>
          <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>Worst month: <strong style={{ color: C.text }}>{worstMonth}</strong> (happiness {worstHappiness}). Here's what the data shows:</p>
          {failures.map((f, i) => (
            <div key={i} style={{ background: f.bg, border: `1px solid ${f.border}`, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
              <button onClick={() => setOpenIdx(openIdx === i ? null : i)}
                style={{ width: "100%", background: "none", border: "none", padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: f.color, flex: 1 }}>{f.title}</span>
                <span style={{ fontSize: 12, color: C.textFaint }}>{openIdx === i ? "▲" : "▼"}</span>
              </button>
              {openIdx === i && (
                <div style={{ padding: "0 14px 14px" }}>
                  <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.7, margin: "0 0 10px" }}>{f.body}</p>
                  <div style={{ background: C.cardBg, borderRadius: 7, padding: "8px 12px", borderLeft: `3px solid ${f.color}` }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: f.color, textTransform: "uppercase", marginBottom: 2 }}>📖 Research link</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{f.research}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Policy log */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14, overflowX: "auto", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Monthly Policy Log</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead><tr>{["Month", "Season", "UberTax", "Bus", "AC", "BudgetΔ", "Happiness", "Mobility", "Congestion"].map(h => (
              <th key={h} style={{ color: C.textMuted, fontWeight: 800, textAlign: "left", paddingBottom: 6, borderBottom: `2px solid ${C.border}`, paddingRight: 6, textTransform: "uppercase", fontSize: 9 }}>{h}</th>
            ))}</tr></thead>
            <tbody>{history.map((m, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ padding: "5px 6px 5px 0", color: C.textSub, fontWeight: 700 }}>{MONTHS[i].slice(0, 3)}</td>
                <td style={{ paddingRight: 6 }}>{SEASONS.seasonIcon[i]}</td>
                <td style={{ color: C.red, fontWeight: 700, paddingRight: 6 }}>{m.uberTax}%</td>
                <td style={{ color: C.blue, fontWeight: 700, paddingRight: 6 }}>{m.busSubsidy}%</td>
                <td style={{ color: C.acColor, fontWeight: 700, paddingRight: 6 }}>{m.acLevel}%</td>
                <td style={{ color: m.monthlyDelta >= 0 ? C.green : C.red, fontWeight: 700, paddingRight: 6 }}>{m.monthlyDelta >= 0 ? "+" : ""}{m.monthlyDelta.toFixed(1)}M</td>
                <td style={{ color: gc(m.happinessScore, "happiness"), fontWeight: 700, paddingRight: 6 }}>{Math.round(m.happinessScore)}</td>
                <td style={{ color: gc(m.mobilityScore, "mobility"), paddingRight: 6 }}>{Math.round(m.mobilityScore)}</td>
                <td style={{ color: gc(m.congestionLevel, "congestion") }}>{Math.round(m.congestionLevel)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        {/* Research debrief */}
        <div style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 12, padding: "14px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: C.blue, textTransform: "uppercase", marginBottom: 12, fontWeight: 800 }}>📖 What the Research Says</div>
          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8, margin: "0 0 10px" }}>{DEBRIEF.coreInsight}</p>
          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8, borderLeft: `3px solid ${C.cyan}`, paddingLeft: 10, margin: "0 0 10px" }}>{DEBRIEF.seasonInsight}</p>
          {avgH >= 65 && <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8, borderLeft: `3px solid ${C.green}`, paddingLeft: 10, margin: "0 0 10px" }}>{DEBRIEF.balanceInsight}</p>}
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 12px", marginTop: 10 }}>
            <div style={{ fontSize: 10, color: C.blue, marginBottom: 4, fontWeight: 800 }}>🏙️ Up Next: City 3</div>
            <div style={{ fontSize: 11, color: C.textSub, lineHeight: 1.6 }}>{DEBRIEF.city3Teaser}</div>
          </div>
          <div style={{ fontSize: 9, color: C.textFaint, marginTop: 10 }}>{DEBRIEF.source}</div>
        </div>

        <button onClick={onRestart} style={{ width: "100%", background: C.cardBg, color: C.textSub, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>↺ Play Again</button>
      </div>
    </div>
  );
}

// ============================================================
//  MAIN GAME CONTROLLER
// ============================================================
export default function RiverdaleTycoonCity2() {
  const [screen, setScreen] = useState("intro");
  const [roundIndex, setRound] = useState(0);
  const [uberTax, setUber] = useState(0);
  const [busSubsidy, setBus] = useState(0);
  const [acLevel, setAC] = useState(0);
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [advisorMsg, setMsg] = useState("");
  const [timedOut, setTO] = useState(false);
  const [budget, setBudget] = useState(BUDGET_CONFIG.annualBudget);
  const [scoreless, setSL] = useState(false);
  const [gameOverMonth, setGOM] = useState("");
  const [polMonth, setPolMonth] = useState("");

  const handleCommit = useCallback((uberVal, busVal, acVal, wasTimedOut) => {
    setBudget(prev => {
      const stats = simulate(uberVal, busVal, acVal, roundIndex, prev);
      const newBudget = +(prev + stats.monthlyDelta).toFixed(3);
      const bf = Math.max(0, newBudget) / BUDGET_CONFIG.annualBudget;
      const msg = getMonthEndMessage(stats, uberVal, busVal, acVal, bf, wasTimedOut, roundIndex);
      const record = { ...stats, uberTax: uberVal, busSubsidy: busVal, acLevel: acVal };
      setResult(record); setMsg(msg); setTO(wasTimedOut);
      setHistory(h => {
        const nh = [...h, record];
        const streak = nh.slice(-SIMULATION.politicalStreakNeeded)
          .filter(r => r.happinessScore < SIMULATION.politicalFloor).length;
        if (streak >= SIMULATION.politicalStreakNeeded && nh.length >= SIMULATION.politicalStreakNeeded) {
          setPolMonth(MONTHS[nh.length - 1]);
          setScreen("politicalLoss");
        }
        return nh;
      });
      if (newBudget <= 0) { setGOM(MONTHS[roundIndex]); setScreen("gameOver"); return 0; }
      setScreen("result");
      return newBudget;
    });
  }, [roundIndex]);

  const handleNext = useCallback(() => {
    if (roundIndex === 11) setScreen("yearEnd");
    else { setRound(r => r + 1); setScreen("planning"); }
  }, [roundIndex]);

  const handleRestart = useCallback(() => {
    setScreen("intro"); setRound(0); setUber(0); setBus(0); setAC(0);
    setHistory([]); setResult(null); setTO(false);
    setBudget(BUDGET_CONFIG.annualBudget); setSL(false); setGOM(""); setPolMonth("");
  }, []);

  const handleContinue = useCallback(() => {
    setSL(true);
    if (roundIndex === 11) setScreen("yearEnd");
    else { setRound(r => r + 1); setBudget(0); setScreen("planning"); }
  }, [roundIndex]);

  if (screen === "intro") return <IntroScreen onStart={() => setScreen("planning")} />;
  if (screen === "gameOver") return <GameOverScreen month={gameOverMonth} onRestart={handleRestart} onContinue={handleContinue} />;
  if (screen === "politicalLoss") return <PoliticalLossScreen month={polMonth} onRestart={handleRestart} onContinue={handleContinue} />;
  if (screen === "planning") return (
    <PlanningScreen month={MONTHS[roundIndex]} roundIndex={roundIndex}
      uberTax={uberTax} busSubsidy={busSubsidy} acLevel={acLevel}
      onUberChange={setUber} onBusChange={setBus} onACChange={setAC}
      onCommit={handleCommit} budgetRemaining={budget} />
  );
  if (screen === "result") return (
    <ResultScreen month={MONTHS[roundIndex]} roundIndex={roundIndex}
      stats={result} uberTax={result?.uberTax ?? 0} busSubsidy={result?.busSubsidy ?? 0} acLevel={result?.acLevel ?? 0}
      advisorMessage={advisorMsg} onNext={handleNext}
      history={history} timedOut={timedOut} budgetRemaining={budget} />
  );
  if (screen === "yearEnd") return <YearEndScreen history={history} finalBudget={budget} onRestart={handleRestart} scoreless={scoreless} />;
}
