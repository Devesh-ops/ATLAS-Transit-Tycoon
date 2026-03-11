import { useState, useCallback, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";

// ============================================================
//  DESIGN TOKENS  (new warm palette)
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
  subtitle: "A growing city where not everyone is equal",
  population: 200000,
  richFraction: 0.40,
  poorFraction: 0.60,
  intro: `Riverdale has 200,000 people — 60% low-income, 40% wealthy. Uber is taxed, not subsidised: the tax earns revenue AND cuts congestion, but reduces mobility — especially for poor citizens who have fewer alternatives. Bus subsidies and AC investment cost money. Seasons will test you: summer heat and winter cold empty the buses unless they're comfortable. Keep everyone moving, close the equity gap, and don't go broke.`,
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TIMER = { monthDuration: 25, warningAt: 6, endingDuration: 1200 };

const SEASONS = {
  tempIndex: [-1.0, -0.7, -0.3, 0.0, 0.4, 0.8, 1.0, 0.8, 0.4, 0.0, -0.4, -0.8],
  seasonLabel: ["Deep Winter", "Late Winter", "Early Spring", "Spring", "Late Spring", "Early Summer", "Peak Summer", "Late Summer", "Early Autumn", "Autumn", "Late Autumn", "Early Winter"],
  seasonIcon: ["🥶", "🥶", "🌱", "🌿", "☀️", "🌡️", "🔥", "🌡️", "🍂", "🍂", "🌧️", "❄️"],
  peakBusMobilityPenalty: 18,
  peakUberDemandBoost: 8,
  peakBaselineMobilityPenalty: 5,
  // CHANGE 2: AC collapse mechanic
  acCollapseThreshold: 0.25,
  collapseMultiplier: 2.5,
};

// BUG FIX: Baselines corrected so bus subsidies start in "boosting" mode for poor.
// Old: poorMobility:55 was ABOVE the old flipPoint:50 → bus always constrained poor.
// New: poorMobility:35 is well BELOW flipPoint:65 → bus boosts poor from rest state.
const SIMULATION = {
  baseline: {
    poorMobility: 35,   // BUG FIX: lowered from 55
    richMobility: 58,   // BUG FIX: lowered from 70
    congestionLevel: 50,
    poorHappiness: 40,   // adjusted to match new baseline
    richHappiness: 58,
  },
  uber: {
    congestionReductionPerPercent: 0.35,  // BUG FIX: reduced from 0.50 (was masking rich mobility drop)
    revenueRate: 0.0020,
  },
  bus: {
    // BUG FIX: flipPoint raised from 50→65 so poor (baseline 35) have growth room before flip
    mobilityFlipPoint: 65,
    poorMobilityGainBelowFlip: 0.35,   // BUG FIX: increased from 0.30 for clearer boost effect
    poorMobilityLossAboveFlip: 0.08,
    richMobilityGainBelowFlip: 0.06,
    richMobilityLossAboveFlip: 0.04,
    congestionOffsetPerPercent: 0.18,
    costRate: 0.0014,
  },
  ac: {
    mitigationExponent: 0.7,
    poorComfortBonusPerPercent: 0.12,
    richComfortBonusPerPercent: 0.03,
    costRate: 0.0018,
  },
  happiness: {
    // BUG FIX: higher mobility weights so bus gains are visible in happiness
    poor: { mobilityWeight: 0.65, congestionWeight: 0.15, acComfortWeight: 0.20, budgetStressWeight: 0.35 },
    rich: { mobilityWeight: 0.45, congestionWeight: 0.45, acComfortWeight: 0.05, budgetStressWeight: 0.30 },
    min: 0, max: 100,
  },
  // BUG FIX: smaller gap penalty so equity score isn't pinned at extremes
  equity: { penaltyPerGapPoint: 1.5, min: 0, max: 100 },
  thresholds: {
    happiness: { good: 65, warning: 40 },
    congestion: { good: 40, warning: 65 },
    mobility: { good: 60, warning: 42 },
    equity: { good: 65, warning: 40 },
    budget: { safe: 0.50, warning: 0.20 },
  },
  // CHANGE 3: Political ejection
  politicalFloor: 30,
  politicalStreakNeeded: 3,
};

const BUDGET_CONFIG = {
  annualBudget: 30.0,
  warningFraction: 0.20,
};

const SCORING = {
  weights: { happiness: 0.40, equity: 0.35, budget: 0.25 },
  grades: [
    { min: 85, grade: "A+", label: "Model City", color: C.green },
    { min: 75, grade: "A", label: "Equitable & Thriving", color: C.green },
    { min: 65, grade: "B", label: "Getting There", color: "#3D7A2B" },
    { min: 55, grade: "C", label: "Uneven Progress", color: C.amber },
    { min: 45, grade: "D", label: "Widening Gap", color: "#C05621" },
    { min: 0, grade: "F", label: "Two-Tier City", color: C.red },
  ],
};

const ADVISOR = {
  name: "Maya", title: "Chief Transport Advisor",
  gameIntro: `Welcome to Riverdale — 200,000 people, very unequal. You now tax Uber rather than subsidise it. The tax earns revenue and cuts congestion — but it hits poor citizens hardest, since they rely on Uber more than the wealthy. Use that revenue to fund bus subsidies and AC. Equity is 35% of your final score. Hit End Turn when you're ready, or the clock decides.`,
  monthStartHints: [
    "January 🥶 — Deep winter. Cold buses are empty. AC costs budget — but the Uber tax helps fund it.",
    "Still cold. Heavy Uber tax hits poor mobility hardest — they have fewer alternatives than the rich.",
    "Winter easing. AC costs drop. Good month to experiment with tax and subsidy balance.",
    "Spring — mild temperatures. Buses are naturally attractive. A lower Uber tax won't hurt as much now.",
    "Late spring. Temperatures climbing. Plan your AC strategy before July.",
    "Early summer 🌡️ — buses warming. The equity gap widens when poor riders can't afford taxed Uber AND buses are hot.",
    "Peak summer 🔥 — hardest month. High AC keeps poor riders on buses. Without it, they're stranded.",
    "Still hot. Uber tax revenue can fund the AC you need — use it.",
    "Summer fading. Ease the Uber tax to restore mobility as AC costs drop.",
    "Autumn 🍂 — mild. Recover budget before winter.",
    "Late autumn. Cold returning. Prepare AC before December.",
    "Final month ❄️. Equity is 35% of your score — close the gap before the year ends.",
  ],
  monthEndReactions: {
    highHappiness: ["Great month! Both groups moving well — and buses were comfortable.", "Riverdale is working. Mobility up, equity gap manageable.", "Strong policy. Tax revenue funding real access."],
    equityGap: ["Rich can absorb the Uber tax — poor can't. The gap is widening. Invest in bus + AC to compensate.", "Heavy Uber tax disproportionately hurts low-income riders. Bus subsidies and AC are the equity correction.", "This is the core finding: pricing policies hit the poor hardest. Targeted investment is the antidote."],
    heatNeedingAC: ["Hot buses, high Uber tax — poor citizens are stranded. AC would have kept buses attractive.", "Heat + expensive Uber is a mobility crisis for low-income riders.", "Without AC, extreme weather forces poor citizens to choose between a hot bus and a taxed Uber they can't afford."],
    coldNeedingAC: ["Cold buses + expensive Uber = poor citizens staying home. AC heating is the equity tool here.", "Winter cold without bus heating hits the poor hardest.", "Low-income riders avoiding cold buses. AC is your most equity-efficient lever in winter."],
    highCongestion: ["Congestion still high despite the Uber tax. Make sure the tax is high enough to shift riders to buses.", "Roads packed. A higher tax shifts more people to shared transport — but watch poor mobility."],
    lowMobility: ["Mobility dropped. The Uber tax may be too high — or bus + AC investment too low to compensate.", "City isn't moving much. Consider easing the tax and boosting bus subsidies."],
    budgetWarning: ["Budget thin. Uber tax is your income — make sure it's earning enough to cover bus and AC costs.", "Less than 20% remaining. Check whether tax revenue is keeping pace with your spending."],
    revenueGain: ["Budget grew this month — tax revenue exceeded bus and AC costs. The self-funding model is working.", "Positive budget month. Uber tax revenue is doing real work.", "Revenue positive. Keep this balance and equity will follow."],
    balanced: ["Solid month. Mobility decent, equity gap manageable, budget stable.", "Steady and sustainable."],
    noPolicy: ["No tax, no subsidy, no AC. Buses are uncomfortable, Uber is unchecked. Congestion is high.", "Laissez-faire month — congestion builds and the equity gap widens without intervention."],
    timedOut: ["Time ran out. Set AC first in extreme months — then tax and subsidy.", "The clock beat you. Hit End Turn earlier next month."],
  },
  tooltips: {
    happiness: "Weighted city happiness: 60% poor + 40% rich. Poor happiness driven by mobility, AC comfort, budget stress. Rich by mobility and congestion.",
    mobility: "City mobility: 60% poor + 40% rich. Uber tax reduces mobility — hitting poor ~4× harder. Bus helps below flip point, constrains above. AC offsets seasonal drops.",
    congestion: "Road congestion. Uber tax reduces it (fewer cars). Bus subsidy reduces it. Bigger city = faster compounding.",
    equity: "How equal the city is. 100 minus the rich/poor mobility gap. Narrow it with bus subsidies and AC — tools that specifically help poor riders.",
    budget: "Remaining budget ($30M). Uber tax earns money. Bus subsidies and AC cost money. Net delta can be positive or negative each month.",
    uberTax: "Tax on every Uber trip. Earns revenue + cuts congestion — but reduces mobility. Hits poor citizens ~4× harder than rich (fewer alternatives). Your income lever.",
    busSubsidy: "Discount on bus fares. Strong effect on poor. Mobility flips above 65. Always reduces congestion. Costs budget.",
    acLevel: "Bus climate comfort. At 0%, extreme weather empties buses — hitting poor hardest. At 100%, buses stay attractive year-round. Costs scale with temperature extremity.",
    poorMobility: "Mobility of 60% low-income population. Key driver of equity score. Uber tax hits them ~4× harder than rich.",
    richMobility: "Mobility of 40% wealthy population. Lower sensitivity to Uber tax — they have private alternatives.",
  },
};

const DEBRIEF = {
  coreInsight: `Christensen & Osman (2023) found that hot weather causes significant mode substitution away from buses toward ride-hailing — especially among lower-income riders. When buses are uncomfortable AND Uber is expensive, poor citizens are left without viable options. This is why bus comfort investment is an equity intervention, not just a service upgrade.`,
  equityInsight: `The research shows poor citizens have price elasticity ~2.4× higher than wealthy ones. Uber taxes are regressive — they hit the poor hardest. The antidote is reinvesting that tax revenue into public transport that specifically serves lower-income riders: bus subsidies and AC investment.`,
  seasonInsight: `"Weathering the Ride" documents that temperature swings shift bus riders to ride-hailing. Without climate-controlled buses, seasonal extremes become seasonal equity crises — occurring twice a year, every year.`,
  balanceInsight: `You found the balance: moderate Uber tax funding targeted bus and AC investment. This mirrors real policy recommendations — use ride-hailing taxes to cross-subsidize public transport, with particular attention to comfort in extreme weather.`,
  city3Teaser: `City 3 adds gender dynamics. Women face specific safety barriers on public transit that price subsidies alone can't fix. Female price elasticity is nearly 2.5× higher than male — but safety investment matters just as much.`,
  source: `Christensen & Osman (2025) "Demand for Mobility" · Christensen & Osman (2023) "Weathering the Ride"`,
};

// ============================================================
//  SIMULATION ENGINE
// ============================================================
function getTemp(roundIndex) {
  const ti = SEASONS.tempIndex[roundIndex];
  return { tempIndex: ti, tempDiscomfort: Math.abs(ti) };
}

// BUG FIX: Two clean separate loss curves.
// Old version had tangled (scale * 3.3) factors that barely moved rich mobility.
// Now: poor lose steeply (up to −69pts at max tax), rich lose modestly but visibly.
function uberMobilityLoss(tax, isPoor) {
  if (isPoor) {
    if (tax <= 30) return tax * 0.40;
    if (tax <= 60) return 12 + (tax - 30) * 0.70;
    return 33 + (tax - 60) * 0.90;
  } else {
    if (tax <= 30) return tax * 0.10;
    if (tax <= 60) return 3 + (tax - 30) * 0.25;
    return 10.5 + (tax - 60) * 0.35;
  }
}

function simulate(uberTax, busSubsidy, acLevel, roundIndex, budgetRemaining) {
  const { baseline, bus, ac, happiness, equity } = SIMULATION;
  const { tempIndex: ti, tempDiscomfort } = getTemp(roundIndex);
  const acMitigation = Math.pow(acLevel / 100, ac.mitigationExponent);
  const acComfort = acLevel / 100;

  // ── POOR MOBILITY ──────────────────────────────────────────
  const poorUberLoss = uberMobilityLoss(uberTax, true);
  const poorMobilityB4Bus = Math.max(0, baseline.poorMobility - poorUberLoss);
  const poorBusEffect = poorMobilityB4Bus < bus.mobilityFlipPoint
    ? busSubsidy * bus.poorMobilityGainBelowFlip
    : busSubsidy * -bus.poorMobilityLossAboveFlip;

  // CHANGE 2: AC collapse mechanic — extreme heat/cold without AC is 2.5× worse
  const collapseActive = tempDiscomfort > 0.6 && acMitigation < SEASONS.acCollapseThreshold;
  const collapseMulti = collapseActive ? SEASONS.collapseMultiplier : 1.0;
  const busTempPenalty = tempDiscomfort * SEASONS.peakBusMobilityPenalty * (1 - acMitigation) * collapseMulti;
  const baselineTempPenalty = tempDiscomfort * SEASONS.peakBaselineMobilityPenalty;
  const weatherUberBoost = tempDiscomfort * SEASONS.peakUberDemandBoost * (1 - acMitigation * 0.5);

  const poorMobility = Math.min(100, Math.max(0,
    poorMobilityB4Bus + poorBusEffect
    - busTempPenalty - baselineTempPenalty + weatherUberBoost * 0.3
  ));

  // ── RICH MOBILITY ──────────────────────────────────────────
  const richUberLoss = uberMobilityLoss(uberTax, false);
  const richMobilityB4Bus = Math.max(0, baseline.richMobility - richUberLoss);
  const richBusEffect = richMobilityB4Bus < bus.mobilityFlipPoint
    ? busSubsidy * bus.richMobilityGainBelowFlip
    : busSubsidy * -bus.richMobilityLossAboveFlip;
  const richMobility = Math.min(100, Math.max(0,
    richMobilityB4Bus + richBusEffect - baselineTempPenalty * 0.4
  ));

  const cityMobility = CITY_META.poorFraction * poorMobility + CITY_META.richFraction * richMobility;

  // ── CONGESTION ─────────────────────────────────────────────
  const congestionLevel = Math.min(100, Math.max(5,
    baseline.congestionLevel
    - uberTax * SIMULATION.uber.congestionReductionPerPercent
    - busSubsidy * bus.congestionOffsetPerPercent
    + weatherUberBoost * 0.2
  ));

  // ── EQUITY ─────────────────────────────────────────────────
  const mobilityGap = Math.max(0, richMobility - poorMobility);
  const equityScore = Math.min(100, Math.max(0, 100 - mobilityGap * equity.penaltyPerGapPoint));

  // ── AC COMFORT ─────────────────────────────────────────────
  const comfortRelevance = 0.3 + tempDiscomfort * 0.7;
  const poorACBonus = acComfort * ac.poorComfortBonusPerPercent * 100 * comfortRelevance;
  const richACBonus = acComfort * ac.richComfortBonusPerPercent * 100 * comfortRelevance;

  // ── BUDGET ─────────────────────────────────────────────────
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const budgetStress = budgetFraction > 0.5 ? 0 : (0.5 - budgetFraction) / 0.5;
  const activity = (cityMobility + congestionLevel) / 2;
  const uberRevenue = (uberTax / 100) * SIMULATION.uber.revenueRate * activity * 200;
  const busCost = (busSubsidy / 100) * bus.costRate * activity * 200;
  const acCost = (acLevel / 100) * ac.costRate * (0.3 + tempDiscomfort * 0.7) * 200;
  const monthlyDelta = +(uberRevenue - busCost - acCost).toFixed(3);

  // ── HAPPINESS ──────────────────────────────────────────────
  const hw = happiness;
  const poorHappiness = Math.min(hw.max, Math.max(hw.min,
    baseline.poorHappiness
    + (poorMobility - baseline.poorMobility) * hw.poor.mobilityWeight
    - (congestionLevel - baseline.congestionLevel) * hw.poor.congestionWeight
    + poorACBonus * hw.poor.acComfortWeight
    - budgetStress * 30 * hw.poor.budgetStressWeight
  ));
  const richHappiness = Math.min(hw.max, Math.max(hw.min,
    baseline.richHappiness
    + (richMobility - baseline.richMobility) * hw.rich.mobilityWeight
    - (congestionLevel - baseline.congestionLevel) * hw.rich.congestionWeight
    + richACBonus * hw.rich.acComfortWeight
    - budgetStress * 25 * hw.rich.budgetStressWeight
  ));
  const cityHappiness = CITY_META.poorFraction * poorHappiness + CITY_META.richFraction * richHappiness;

  const busIsConstraining = (poorMobilityB4Bus >= bus.mobilityFlipPoint || richMobilityB4Bus >= bus.mobilityFlipPoint) && busSubsidy > 0;
  const weatherAlert = tempDiscomfort > 0.6 && acLevel < 30;

  return {
    poorMobility, richMobility, cityMobility,
    congestionLevel, equityScore,
    poorHappiness, richHappiness, cityHappiness,
    monthlyDelta, uberRevenue, busCost, acCost,
    budgetStress, busIsConstraining, weatherAlert,
    tempDiscomfort, collapseActive,
    poorMobilityB4Bus,
  };
}

// CHANGE 6: Causal year-end failure diagnosis
function diagnoseRun(history, finalBudget) {
  const avgPoor = history.reduce((s, m) => s + m.poorMobility, 0) / history.length;
  const avgRich = history.reduce((s, m) => s + m.richMobility, 0) / history.length;
  const avgC = history.reduce((s, m) => s + m.congestionLevel, 0) / history.length;
  const avgU = history.reduce((s, m) => s + m.uberTax, 0) / history.length;
  const avgB = history.reduce((s, m) => s + m.busSubsidy, 0) / history.length;
  const avgH = history.reduce((s, m) => s + m.cityHappiness, 0) / history.length;
  const avgE = history.reduce((s, m) => s + m.equityScore, 0) / history.length;
  const budFrac = finalBudget / BUDGET_CONFIG.annualBudget;
  const worstIdx = history.reduce((wi, m, i) => m.cityHappiness < history[wi].cityHappiness ? i : wi, 0);
  const worst = { ...history[worstIdx], idx: worstIdx };
  const failures = [];

  if (avgPoor < 40 && avgU > 55) {
    failures.push({
      icon: "🚕", color: C.red, bg: C.redBg, border: C.redBorder,
      title: "Uber tax hammered poor citizens",
      body: `Your average Uber tax was ${Math.round(avgU)}%. Poor citizens bore the brunt: their average mobility was ${Math.round(avgPoor)}, far below the wealthy (${Math.round(avgRich)}). Worst month: ${MONTHS[worst.idx]} (happiness ${Math.round(worst.cityHappiness)}). The fix: reinvest tax revenue into buses and AC.`,
      research: "Cairo study: poor citizens have ~2.4× higher price elasticity than wealthy. A uniform Uber tax is a regressive instrument without compensating bus investment.",
    });
  }
  const extremeMonths = history.filter((_, i) => Math.abs(SEASONS.tempIndex[i]) >= 0.7);
  const collapseMonths = extremeMonths.filter(m => m.acLevel < 25 && m.poorMobility < 38);
  if (collapseMonths.length >= 2) {
    failures.push({
      icon: "🌡️", color: C.amber, bg: C.amberBg, border: C.amberBorder,
      title: "Seasonal bus collapse hurt poor riders",
      body: `In ${collapseMonths.length} extreme weather months, AC was below 25% — triggering a bus collapse. Poor citizens couldn't afford taxed Uber and faced hot or cold buses. This is the "Weathering the Ride" finding made real.`,
      research: "Christensen & Osman (2023): temperature increases shift bus riders to ride-hailing. Without AC, poor riders — who can't afford the alternative — are simply stranded.",
    });
  }
  if (avgE < 50) {
    failures.push({
      icon: "⚖️", color: C.purple, bg: C.purpleBg, border: C.purpleBorder,
      title: "Persistent equity gap — two-tier city",
      body: `Average equity score was ${Math.round(avgE)} — a sustained rich/poor mobility gap. Rich averaged ${Math.round(avgRich)} mobility, poor averaged ${Math.round(avgPoor)}. Uber tax revenue was not adequately recycled into buses and AC.`,
      research: "The research finding: lower-income price elasticity is ~2.4× higher than wealthy. Uniform revenue instruments without targeted reinvestment widen the gap.",
    });
  }
  if (avgC > 65 && avgU < 25) {
    failures.push({
      icon: "🚗", color: C.textMuted, bg: C.insetBg, border: C.border,
      title: "Congestion went unchecked",
      body: `Average congestion was ${Math.round(avgC)} with only ${Math.round(avgU)}% Uber tax. A city of 200k with low Uber tax means heavy traffic — eroding happiness for rich citizens and slowing buses for poor riders.`,
      research: "Cairo equilibrium model: market-level Uber price reduction raises external costs by ~0.7% of city GDP. Low tax on a large city compounds quickly.",
    });
  }
  if (budFrac < 0.10 && avgB > 55) {
    failures.push({
      icon: "💸", color: C.blue, bg: C.blueBg, border: C.blueBorder,
      title: "Spending outpaced tax revenue",
      body: `Budget ended at $${finalBudget.toFixed(1)}M with average bus subsidy ${Math.round(avgB)}%. Three cost streams (bus, AC, plus reduced Uber activity) need to be balanced against a single income stream.`,
      research: "Transport subsidy costs scale with ridership. Consistent, calibrated tax rates beat erratic high/low swings.",
    });
  }
  if (failures.length === 0 && avgH < 63) {
    failures.push({
      icon: "😐", color: C.textMuted, bg: C.insetBg, border: C.border,
      title: "Cautious policy, cautious results",
      body: `No single disaster — but no bold reinvestment either. Average happiness ${Math.round(avgH)}, equity ${Math.round(avgE)}. With three levers, there's a self-funding sweet spot: ~40% Uber tax funding ~50% bus subsidy + ~50% AC in extreme months.`,
      research: "Optimal transport policy requires calibrated intervention. Moderate everything is not the same as balanced.",
    });
  }
  return { failures, worstMonth: MONTHS[worst.idx], worstHappiness: Math.round(worst.cityHappiness) };
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getMonthEndMessage(stats, uberTax, bus, ac, budgetFraction, timedOut, roundIndex) {
  if (timedOut) return pickRandom(ADVISOR.monthEndReactions.timedOut);
  if (uberTax === 0 && bus === 0 && ac === 0) return pickRandom(ADVISOR.monthEndReactions.noPolicy);
  if (budgetFraction < BUDGET_CONFIG.warningFraction) return pickRandom(ADVISOR.monthEndReactions.budgetWarning);
  const ti = SEASONS.tempIndex[roundIndex];
  if (stats.weatherAlert && ti > 0.5) return pickRandom(ADVISOR.monthEndReactions.heatNeedingAC);
  if (stats.weatherAlert && ti < -0.5) return pickRandom(ADVISOR.monthEndReactions.coldNeedingAC);
  if (stats.equityScore < SIMULATION.thresholds.equity.warning) return pickRandom(ADVISOR.monthEndReactions.equityGap);
  const t = SIMULATION.thresholds;
  if (stats.cityHappiness >= t.happiness.good) return pickRandom(ADVISOR.monthEndReactions.highHappiness);
  if (stats.congestionLevel >= t.congestion.warning) return pickRandom(ADVISOR.monthEndReactions.highCongestion);
  if (stats.cityMobility <= t.mobility.warning) return pickRandom(ADVISOR.monthEndReactions.lowMobility);
  if (stats.monthlyDelta > 0) return pickRandom(ADVISOR.monthEndReactions.revenueGain);
  return pickRandom(ADVISOR.monthEndReactions.balanced);
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

function GaugeBar({ label, value, type, tooltip, extra, subLabel }) {
  const color = gc(value, type);
  const barW = type === "budget" ? value * 100 : Math.round(value);
  const display = type === "budget" ? `$${(value * BUDGET_CONFIG.annualBudget).toFixed(1)}M` : Math.round(value);
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
          {subLabel && <span style={{ fontSize: 9, color: C.textFaint }}>{subLabel}</span>}
          <InfoTip text={tooltip} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{display}</span>
          {extra && <span style={{ fontSize: 9, color: C.textFaint }}>{extra}</span>}
        </div>
      </div>
      <div style={{ height: 6, background: C.track, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, barW))}%`, background: color, borderRadius: 3, transition: "width 0.35s ease, background 0.3s" }} />
      </div>
    </div>
  );
}

function SplitGauge({ poorVal, richVal, tooltip }) {
  const poorColor = gc(poorVal, "mobility");
  const richColor = gc(richVal, "mobility");
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1, textTransform: "uppercase" }}>Mobility Split</span>
          <InfoTip text={tooltip} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: C.textMuted }}>Poor</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: poorColor }}>{Math.round(poorVal)}</span>
          <span style={{ fontSize: 10, color: C.textFaint }}>·</span>
          <span style={{ fontSize: 10, color: C.textMuted }}>Rich</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: richColor }}>{Math.round(richVal)}</span>
        </div>
      </div>
      <div style={{ height: 6, background: C.track, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.round(poorVal)}%`, background: poorColor, borderRadius: 3, transition: "width 0.35s ease" }} />
      </div>
      <div style={{ height: 4, marginTop: 2, background: C.track, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.round(richVal)}%`, background: richColor, opacity: 0.45, borderRadius: 3, transition: "width 0.35s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.textFaint, marginTop: 2 }}>
        <span>← Poor (60%)</span><span>Rich (40%) →</span>
      </div>
    </div>
  );
}

// CHANGE 2: Bus mode badge
function BusModeBadge({ poorMobilityB4Bus, busSubsidy }) {
  if (busSubsidy === 0) return null;
  const boosting = poorMobilityB4Bus < SIMULATION.bus.mobilityFlipPoint;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: boosting ? C.greenBg : C.redBg, border: `1px solid ${boosting ? C.greenBorder : C.redBorder}`, borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: boosting ? C.green : C.red, marginBottom: 5 }}>
      {boosting ? "🟢 Boosting poor mobility" : "🔴 Constraining poor mobility"}
    </div>
  );
}

function SliderInput({ label, value, onChange, color, tooltip, locked, tag, badge }) {
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
        style={{ width: "100%", accentColor: color, cursor: locked ? "not-allowed" : "pointer" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.textFaint, marginTop: 2 }}>
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
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

// CHANGE 3: Political loss screen
function PoliticalLossScreen({ month, onRestart, onContinue }) {
  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia,serif", padding: 24 }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 54, marginBottom: 10 }}>🗳️</div>
        <div style={{ fontSize: 11, letterSpacing: 3, color: C.purple, textTransform: "uppercase", marginBottom: 8, fontWeight: 800 }}>Political Ejection</div>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: "0 0 10px" }}>You've been voted out</h2>
        <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.7, marginBottom: 10 }}>Citizens lost confidence after <strong>3 consecutive months</strong> of happiness below 30. Riverdale needs a new Transport Director.</p>
        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 20 }}>Removed in <strong>{month}</strong>. Sustained low happiness signals policy failure — not just a bad month.</p>
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
        <div style={{ marginBottom: 22 }}><AdvisorBox message="Three cost streams need to be balanced against one income stream. Raise the Uber tax — it's your only source of revenue." /></div>
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
function IntroScreen({ onStart }) {
  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia,serif", padding: 20 }}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <div style={{ fontSize: 50, marginBottom: 10 }}>🏙️</div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: C.blue, textTransform: "uppercase", marginBottom: 10 }}>Transport Tycoon · City 2</div>
        <h1 style={{ fontSize: 38, fontWeight: 800, color: C.text, margin: "0 0 5px" }}>{CITY_META.name}</h1>
        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 20, fontStyle: "italic" }}>{CITY_META.subtitle}</p>
        <div style={{ marginBottom: 20 }}><AdvisorBox message={ADVISOR.gameIntro} /></div>
        <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.75, marginBottom: 22 }}>{CITY_META.intro}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
          {[["👥", "200k people"], ["⚖️", "60% poor · 40% rich"], ["💰", "$30M budget"], ["📅", "12 months"], ["⏱", "25 sec/month"], ["🚕", "Uber tax earns $"], ["🚌", "Bus subsidy costs $"], ["❄️", "AC costs $"]].map(([icon, label]) => (
            <div key={label} style={{ background: C.insetBg, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 10px", fontSize: 10, color: C.textSub }}>{icon} {label}</div>
          ))}
        </div>
        <button onClick={onStart} style={{ background: C.blue, color: "white", border: "none", borderRadius: 9, padding: "12px 32px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
          Start as Transport Director →
        </button>
        <p style={{ fontSize: 10, color: C.textFaint, marginTop: 8 }}>Hit End Turn when ready — or the timer decides</p>
      </div>
    </div>
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

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: "Georgia,serif", padding: "14px", outline: warn ? `3px solid ${C.red}` : "3px solid transparent", outlineOffset: "-3px", transition: "outline 0.3s" }}>
      {ending && <MonthEndingOverlay month={month} />}
      <div style={{ maxWidth: 600, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: C.blue, textTransform: "uppercase", fontWeight: 800 }}>City 2 · {CITY_META.name}</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "2px 0 0" }}>{month}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SeasonBadge roundIndex={roundIndex} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: C.textFaint }}>Month</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.textSub }}>{roundIndex + 1}/12</div>
            </div>
            <CountdownRing timeLeft={timeLeft} total={TIMER.monthDuration} />
          </div>
        </div>

        <div style={{ height: 3, background: C.track, borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(roundIndex / 12) * 100}%`, background: C.blue, transition: "width 0.4s" }} />
        </div>

        {/* CHANGE 2: AC collapse warning banner */}
        {live.collapseActive && (
          <div style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 8, padding: "8px 12px", marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 16 }}>{SEASONS.seasonIcon[roundIndex]}</span>
            <span style={{ fontSize: 11, color: C.amber, fontWeight: 700 }}>Extreme weather — AC below 25% is triggering a bus collapse for poor riders · COLLAPSE ACTIVE 🔴</span>
          </div>
        )}
        {!live.collapseActive && live.weatherAlert && (
          <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "8px 12px", marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 16 }}>{SEASONS.seasonIcon[roundIndex]}</span>
            <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>Extreme weather — buses uncomfortable without AC. Poor citizens hit hardest.</span>
          </div>
        )}

        <div style={{ marginBottom: 10 }}><AdvisorBox message={ADVISOR.monthStartHints[roundIndex]} /></div>

        {/* Policy card */}
        <div style={{ background: C.cardBg, border: `1px solid ${warn ? C.red : C.border}`, borderRadius: 12, padding: "14px 14px 6px", marginBottom: 9, boxShadow: "0 1px 6px rgba(0,0,0,0.06)", transition: "border 0.3s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Set Policy</span>
            {locked && <span style={{ fontSize: 10, color: C.red, fontWeight: 800 }}>🔒 LOCKED</span>}
          </div>
          <SliderInput label="Uber Tax" value={uberTax} onChange={onUberChange} color={C.uberColor} tooltip={ADVISOR.tooltips.uberTax} locked={locked} tag={{ text: "earns $", bg: C.greenBg, color: C.green, border: C.greenBorder }} />
          <SliderInput label="Bus Fare Subsidy" value={busSubsidy} onChange={onBusChange} color={C.busColor} tooltip={ADVISOR.tooltips.busSubsidy} locked={locked} tag={{ text: "costs $", bg: C.redBg, color: C.red, border: C.redBorder }}
            badge={<BusModeBadge poorMobilityB4Bus={live.poorMobilityB4Bus} busSubsidy={busSubsidy} />} />
          <SliderInput label="Bus AC & Heating" value={acLevel} onChange={onACChange} color={C.acColor} tooltip={ADVISOR.tooltips.acLevel} locked={locked} tag={{ text: "costs $", bg: C.redBg, color: C.red, border: C.redBorder }} />
          <BudgetDeltaPreview delta={live.monthlyDelta} uberRevenue={live.uberRevenue} busCost={live.busCost} acCost={live.acCost} />
        </div>

        {/* Live preview */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 9, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Live Preview</div>
          <GaugeBar label="Happiness" value={live.cityHappiness} type="happiness" tooltip={ADVISOR.tooltips.happiness} />
          <SplitGauge poorVal={live.poorMobility} richVal={live.richMobility} tooltip={ADVISOR.tooltips.mobility} />
          <GaugeBar label="Equity" value={live.equityScore} type="equity" tooltip={ADVISOR.tooltips.equity} />
          <GaugeBar label="Congestion" value={live.congestionLevel} type="congestion" tooltip={ADVISOR.tooltips.congestion} />
          <GaugeBar label="Budget" value={budgetFraction} type="budget" tooltip={ADVISOR.tooltips.budget} extra={`/ $${BUDGET_CONFIG.annualBudget}M`} />
        </div>

        <button onClick={() => commitMonth(false)} disabled={locked}
          style={{ width: "100%", background: locked ? C.border : C.green, color: locked ? C.textMuted : "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 800, cursor: locked ? "not-allowed" : "pointer", transition: "background 0.2s" }}>
          {locked ? "⏳ Locking in..." : `✓ End Turn — Lock in ${month}'s Policy`}
        </button>
      </div>
    </div>
  );
}

function ResultScreen({ month, roundIndex, stats, uberTax, busSubsidy, acLevel, advisorMessage, onNext, history, timedOut, budgetRemaining }) {
  const { poorMobility, richMobility, congestionLevel, equityScore, cityHappiness, monthlyDelta, uberRevenue, busCost, acCost } = stats;
  const ytdH = Math.round(history.reduce((s, m) => s + m.cityHappiness, 0) / history.length);
  const ytdE = Math.round(history.reduce((s, m) => s + m.equityScore, 0) / history.length);
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
          <StatPill label="Happiness" value={cityHappiness} color={gc(cityHappiness, "happiness")} small />
          <StatPill label="Equity" value={equityScore} color={gc(equityScore, "equity")} small />
          <StatPill label="Congestion" value={congestionLevel} color={gc(congestionLevel, "congestion")} small />
          <StatPill label="Budget" value={`$${budgetRemaining.toFixed(1)}M`} color={gc(budgetFraction, "budget")} small />
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 9 }}>
          <GaugeBar label="Happiness" value={cityHappiness} type="happiness" tooltip={ADVISOR.tooltips.happiness} />
          <SplitGauge poorVal={poorMobility} richVal={richMobility} tooltip={ADVISOR.tooltips.mobility} />
          <GaugeBar label="Equity" value={equityScore} type="equity" tooltip={ADVISOR.tooltips.equity} />
          <GaugeBar label="Congestion" value={congestionLevel} type="congestion" tooltip={ADVISOR.tooltips.congestion} />
          <GaugeBar label="Budget" value={budgetFraction} type="budget" tooltip={ADVISOR.tooltips.budget} extra={`/ $${BUDGET_CONFIG.annualBudget}M`} />
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 13px", marginBottom: 9, display: "flex", justifyContent: "space-between" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textFaint }}>YTD Happiness</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: gc(ytdH, "happiness") }}>{ytdH}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textFaint }}>YTD Equity</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: gc(ytdE, "equity") }}>{ytdE}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textFaint }}>Budget Left</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: gc(budgetFraction, "budget") }}>${budgetRemaining.toFixed(1)}M</div>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}><AdvisorBox message={advisorMessage} /></div>

        <button onClick={onNext} style={{ width: "100%", background: isLast ? C.green : C.blue, color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
          {isLast ? "See Final Score →" : `Next: ${MONTHS[roundIndex + 1]} →`}
        </button>
      </div>
    </div>
  );
}

function YearEndScreen({ history, finalBudget, onRestart, scoreless }) {
  const avgH = history.reduce((s, m) => s + m.cityHappiness, 0) / history.length;
  const avgE = history.reduce((s, m) => s + m.equityScore, 0) / history.length;
  const avgC = history.reduce((s, m) => s + m.congestionLevel, 0) / history.length;
  const avgPoorM = history.reduce((s, m) => s + m.poorMobility, 0) / history.length;
  const budgetEff = (finalBudget / BUDGET_CONFIG.annualBudget) * 100;
  const { weights } = SCORING;
  const finalScore = scoreless ? 0 : avgH * weights.happiness + avgE * weights.equity + budgetEff * weights.budget;
  const grade = getGrade(scoreless ? 0 : finalScore);
  const budgetSpent = BUDGET_CONFIG.annualBudget - finalBudget;
  const { failures, worstMonth, worstHappiness } = diagnoseRun(history, finalBudget);
  const [openIdx, setOpenIdx] = useState(null);

  const chartData = history.map((m, i) => ({
    month: MONTHS[i].slice(0, 3),
    happiness: Math.round(m.cityHappiness),
    equity: Math.round(m.equityScore),
    poor: Math.round(m.poorMobility),
    rich: Math.round(m.richMobility),
    delta: +m.monthlyDelta.toFixed(2),
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
            Score: {Math.round(finalScore)} = H {Math.round(avgH)}×{weights.happiness} + E {Math.round(avgE)}×{weights.equity} + B {Math.round(budgetEff)}×{weights.budget}
          </div>}
        </div>

        <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
          <StatPill label="Avg Happiness" value={avgH} color={gc(avgH, "happiness")} small />
          <StatPill label="Avg Equity" value={avgE} color={gc(avgE, "equity")} small />
          <StatPill label="Avg Congestion" value={avgC} color={gc(avgC, "congestion")} small />
          <StatPill label="Budget Spent" value={`$${budgetSpent.toFixed(1)}M`} color={gc(finalBudget / BUDGET_CONFIG.annualBudget, "budget")} small />
        </div>

        {/* Happiness + Equity chart */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 14px 8px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Happiness & Equity — 12 Months</div>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11 }} />
              <Line type="monotone" dataKey="happiness" stroke={C.green} strokeWidth={2} dot={false} name="Happiness" />
              <Line type="monotone" dataKey="equity" stroke={C.purple} strokeWidth={2} dot={false} name="Equity" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 4 }}>
            {[[C.green, "Happiness"], [C.purple, "Equity"]].map(([col, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.textMuted }}>
                <div style={{ width: 16, height: 2, background: col }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Poor/Rich mobility chart */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 14px 8px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Poor vs Rich Mobility — 12 Months</div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11 }} />
              <Line type="monotone" dataKey="poor" stroke={C.amber} strokeWidth={2} dot={false} name="Poor" />
              <Line type="monotone" dataKey="rich" stroke={C.blue} strokeWidth={2} dot={false} name="Rich" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 4 }}>
            {[[C.amber, "Poor (60%)"], [C.blue, "Rich (40%)"]].map(([col, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.textMuted }}>
                <div style={{ width: 16, height: 2, background: col }} />{l}
              </div>
            ))}
          </div>
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

        {/* CHANGE 6: Failure diagnosis */}
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
            <thead><tr>{["Month", "Season", "UberTax", "Bus", "AC", "BudgetΔ", "Happy", "Equity"].map(h => (
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
                <td style={{ color: gc(m.cityHappiness, "happiness"), fontWeight: 700, paddingRight: 6 }}>{Math.round(m.cityHappiness)}</td>
                <td style={{ color: gc(m.equityScore, "equity") }}>{Math.round(m.equityScore)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        {/* Research debrief */}
        <div style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 12, padding: "14px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: C.blue, textTransform: "uppercase", marginBottom: 12, fontWeight: 800 }}>📖 What the Research Says</div>
          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8, margin: "0 0 10px" }}>{DEBRIEF.coreInsight}</p>
          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8, borderLeft: `3px solid ${C.purple}`, paddingLeft: 10, margin: "0 0 10px" }}>{DEBRIEF.equityInsight}</p>
          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8, borderLeft: `3px solid ${C.cyan}`, paddingLeft: 10, margin: "0 0 10px" }}>{DEBRIEF.seasonInsight}</p>
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 12px", marginTop: 10 }}>
            <div style={{ fontSize: 10, color: C.blue, marginBottom: 4, fontWeight: 800 }}>🏙️ Up Next: City 3 — New Meridian</div>
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
export default function RiverdaleTycoon() {
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
  // CHANGE 3: political ejection state
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
        // CHANGE 3: 3 consecutive months below political floor
        const streak = nh.slice(-SIMULATION.politicalStreakNeeded)
          .filter(r => r.cityHappiness < SIMULATION.politicalFloor).length;
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
    else { setRound(r => r + 1); setUber(0); setBus(0); setAC(0); setScreen("planning"); }
  }, [roundIndex]);

  const handleRestart = useCallback(() => {
    setScreen("intro"); setRound(0); setUber(0); setBus(0); setAC(0);
    setHistory([]); setResult(null); setTO(false);
    setBudget(BUDGET_CONFIG.annualBudget); setSL(false); setGOM(""); setPolMonth("");
  }, []);

  const handleContinue = useCallback(() => {
    setSL(true); setRound(r => r + 1); setUber(0); setBus(0); setAC(0); setBudget(0); setScreen("planning");
  }, []);

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
