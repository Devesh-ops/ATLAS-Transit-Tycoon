import { useState, useCallback, useEffect, useRef } from "react";
import CityIntroFlow from "./CityIntro.jsx";
import CityRoadScene from "./CityRoadScene.jsx";
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
  name: "Gilded Hollow",
  subtitle: "A growing city where not everyone is equal",
  population: 200000,
  richFraction: 0.40,
  poorFraction: 0.60,
  intro: `Gilded Hollow has 200,000 people — 60% low-income, 40% wealthy. Uber is taxed, not subsidised: the tax earns revenue AND cuts congestion, but reduces mobility — especially for poor citizens who have fewer alternatives. Bus subsidies and AC investment cost money. Seasons will test you: summer heat and winter cold empty the buses unless they're comfortable. Keep everyone moving, close the equity gap, and don't go broke.`,
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
  weights: { happiness: 0.45, equity: 0.40, budget: 0.15 },
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
  gameIntro: "Welcome to Gilded Hollow — a city with a deep income divide. Here, Uber is primarily a luxury for the wealthy. Taxing it provides the progressive revenue we need to build a premium, climate-controlled bus system for everyone. Your goal is to use this redistributed wealth to bridge the equity gap and keep the city moving. End Turn when you're ready.",
  monthStartHints: [
    "January 🥶 — Deep winter. Cold buses are empty. Wealthy riders are the primary users of Uber — taxing them now funds bus heating for everyone.",
    "Still cold. In this city, wealthy riders have 2.4x higher price sensitivity to Uber — they'll feel the tax most.",
    "Winter easing. AC costs drop. Use this chance to maintain taxes on the rich and flip that revenue into bus subsidies.",
    "Spring — mild temperatures. Buses are popular. A good time to keep Uber taxes high to build your budget.",
    "Late spring. Temperatures climbing. The wealthy shift to Uber even more in the heat — tax them to fund the AC.",
    "Early summer 🌡️ — buses warming. A higher Uber tax on wealthy riders provides the budget to keep buses cool for the poor.",
    "Peak summer 🔥 — hardest month. High AC keeps buses viable. High Uber tax on the wealthy keeps your budget viable.",
    "Still hot. Remember: wealth-based taxes funding public comfort is the key to city equity.",
    "Summer fading. As AC costs drop, keep the Uber tax calibrated to manage rich/poor mobility gaps.",
    "Autumn 🍂 — mild. A good time to build up your budget reserves before the next winter cycle.",
    "Late autumn. Cold returning. High Uber taxes continue to provide the funding for seasonal bus heating.",
    "Final month ❄️. Equity and Happiness are balanced on your last few decisions. Make them count.",
  ],
  monthEndReactions: {
    highHappiness: ["Great month! Both groups moving well — and buses were comfortable.", "Gilded Hollow is working. Mobility up, equity gap manageable.", "Strong policy. Tax revenue funding real access."],
    equityGap: ["The mobility gap is narrow, but we need more revenue from the wealthy to fund the bus. Taxing Uber hits them hardest and provides for the rest.", "Wealthy riders are highly sensitive to this tax. Use it to level the playing field and fund bus subsidies.", "This is the progressive model: pricing policies hit the rich hardest, providing a budget for the common good."],
    heatNeedingAC: ["Hot buses drive wealthy riders to Uber — tax that shift! Use the revenue to keep buses cool for the poor.", "Heat + expensive Uber for the rich is a revenue opportunity to fund bus AC.", "Wealthy riders avoid hot buses and pay the Uber tax — which pays for the AC for everyone else."],
    coldNeedingAC: ["Winter cold drives wealthy riders to Uber. Tax them to fund the bus heating that the poor rely on.", "High Uber taxes on the rich are your most efficient funding lever in winter.", "Wealthy riders avoiding cold buses provides the revenue needed to heat the fleet for the poor."],
    highCongestion: ["Congestion still high despite the Uber tax. Make sure the tax is high enough to shift riders to buses.", "Roads packed. A higher tax shifts more people to shared transport — but watch poor mobility."],
    lowMobility: ["Mobility dropped. The Uber tax may be too high — or bus + AC investment too low to compensate.", "City isn't moving much. Consider easing the tax and boosting bus subsidies."],
    budgetWarning: ["Budget thin. Uber tax is your income — make sure it's earning enough to cover bus and AC costs.", "Less than 20% remaining. Check whether tax revenue is keeping pace with your spending."],
    revenueGain: ["Budget grew this month — tax revenue exceeded bus and AC costs. The self-funding model is working.", "Positive budget month. Uber tax revenue is doing real work.", "Revenue positive. Keep this balance and equity will follow."],
    balanced: ["Solid month. Mobility decent, equity gap manageable, budget stable.", "Steady and sustainable."],
    noPolicy: ["No tax, no subsidy, no AC. Buses are uncomfortable, Uber is unchecked. Congestion is high.", "Laissez-faire month — congestion builds and the equity gap widens without intervention."],
    timedOut: ["Time ran out. Set AC first in extreme months — then tax and subsidy.", "The clock beat you. Hit End Turn earlier next month."],
  },
  tooltips: {
    happiness: "Overall citizen satisfaction (60% poor + 40% rich). Driven by mobility, comfort, and lack of congestion.",
    mobility: "City movement (60% poor + 40% rich). Uber tax reduces it—hitting the rich ~2.4x harder than the poor.",
    congestion: "Road congestion. Uber tax reduces it. Bus subsidy reduces it.",
    equity: "How equal the city is. Calculated as 100 minus the mobility gap between rich and poor. Narrow it by taxing the rich to fund the poor.",
    budget: "Remaining budget ($30M). Uber tax earns money from the rich. Bus subsidies and AC cost money.",
    uberTax: "Tax on every Uber trip. Earns revenue + cuts congestion—hits wealthy riders 2.4x harder than poor ones.",
    busSubsidy: "Discount on bus fares. Essential for poor mobility. Funded by Uber taxes on the wealthy.",
    acLevel: "Bus climate comfort. Essential for keeping all riders on buses. Funded by progressive Uber taxes.",
    poorMobility: "Mobility of low-income population. In Gilded Hollow, they are less sensitive to Uber taxes.",
    richMobility: "Mobility of wealthy population. They are highly sensitive to Uber taxes in this city.",
  },
};

const DEBRIEF = {
  coreInsight: `In Gilded Hollow, wealthier riders are the primary users of premium ride-hailing. When Uber is taxed, it primarily affects the mobility of the rich, providing a reliable stream of revenue to fund the bus systems the poor rely on. This is a progressive funding model for the city.`,
  equityInsight: `The mobility gap is bridged by cross-subsidy. High Uber taxes on wealthy, price-sensitive riders fund the deep bus subsidies and AC investment needed to keep lower-income residents mobile throughout the year.`,
  seasonInsight: `"Weathering the Ride" documents that temperature extremes shift wealthy riders to Uber. Leveraging this shift via progressive taxation allows you to fund the bus comfort that specifically protects the poor.`,
  balanceInsight: `You found the progressive equilibrium: high Uber taxes on the wealthy funding targeted bus and AC investment for the poor. Consistent policy over 12 months is the key to long-term city equity.`,
  city4Teaser: `City 4 adds gender dynamics. Women face specific safety barriers on public transit that price subsidies alone can't fix. Female price elasticity is nearly 2.5× higher than male — but safety investment matters just as much.`,
  source: `Christensen & Osman (2025) "Demand for Mobility" · Christensen & Osman (2023) "Weathering the Ride"`,
};

const CITY_INTRO_SLIDES = [
  {
    icon: "⚖️",
    label: "City 3: Gilded Hollow",
    title: "A Divided City",
    text: "Gilded Hollow is a city of 200,000 people where not everyone is equal. 60% of your citizens are low-income, while 40% are wealthy.",
  },
  {
    icon: "📉",
    label: "The Challenge",
    title: "The Equity Gap",
    text: "Wealthy riders are the primary users of Uber in this city. A high Uber tax allows us to cross-subsidize the bus systems that provide mobility for the poor. Your performance is now measured by Equity: how well you close the mobility gap.",
  },
  {
    icon: "🏗️",
    label: "Strategic Briefing",
    title: "Redistributive Policy",
    text: "Use Uber tax revenue as a social tool. Reinvest those funds into bus subsidies and climate control to ensure the city works for everyone.",
    bullets: [
      { icon: "⚖️", text: "Equity is now 35% of your final score" },
      { icon: "🚕", text: "Rich price elasticity is 2.4x higher than poor" },
      { icon: "🚌", text: "Uber taxes fund the bus for lower-income riders" }
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

// BUG FIX: Two clean separate loss curves.
// Old version had tangled (scale * 3.3) factors that barely moved rich mobility.
// Now: poor lose steeply (up to −69pts at max tax), rich lose modestly but visibly.
function uberMobilityLoss(tax, isPoor) {
  if (isPoor) {
    // Poor are less sensitive and rely on Uber for basic essentials
    if (tax <= 30) return tax * 0.12;
    if (tax <= 60) return 3.6 + (tax - 30) * 0.30;
    return 12.6 + (tax - 60) * 0.45;
  } else {
    // Wealthy riders are the primary users; tax hits their mobility steeply
    if (tax <= 30) return tax * 0.45;
    if (tax <= 60) return 13.5 + (tax - 30) * 0.85;
    return 39.0 + (tax - 60) * 1.30;
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
  const uberVolume = Math.max(5, congestionLevel);
  const busVolume = Math.max(5, poorMobility * 0.7 + richMobility * 0.3);
  const uberRevenue = (uberTax / 100) * SIMULATION.uber.revenueRate * uberVolume * 200;
  const busCost = (busSubsidy / 100) * bus.costRate * busVolume * 200;
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

  const hMobTotal = CITY_META.poorFraction * (poorMobility - baseline.poorMobility) * hw.poor.mobilityWeight + CITY_META.richFraction * (richMobility - baseline.richMobility) * hw.rich.mobilityWeight;
  const hCongTotal = -(congestionLevel - baseline.congestionLevel) * (CITY_META.poorFraction * hw.poor.congestionWeight + CITY_META.richFraction * hw.rich.congestionWeight);
  const hBudgTotal = -budgetStress * (CITY_META.poorFraction * 30 * hw.poor.budgetStressWeight + CITY_META.richFraction * 25 * hw.rich.budgetStressWeight);
  const hACComfortTotal = CITY_META.poorFraction * poorACBonus * hw.poor.acComfortWeight + CITY_META.richFraction * richACBonus * hw.rich.acComfortWeight;

  return {
    poorMobility, richMobility, cityMobility,
    congestionLevel, equityScore,
    poorHappiness, richHappiness, cityHappiness,
    monthlyDelta, uberRevenue, busCost, acCost,
    tempDiscomfort, tempIndex: ti, collapseActive,
    poorMobilityB4Bus,
    happinessBreakdown: [
      { label: "Mobility", value: hMobTotal, color: C.blue },
      { label: "Comfort", value: hACComfortTotal, color: C.acColor },
      { label: "Congestion", value: hCongTotal, color: C.amber },
      { label: "Budget", value: hBudgTotal, color: C.red }
    ]
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

  if (avgRich < 40 && avgU > 55) {
    failures.push({
      icon: "🚕", color: C.red, bg: C.redBg, border: C.redBorder,
      title: "Uber tax suppressed wealthy mobility",
      body: `Your average Uber tax was ${Math.round(avgU)}%. In Gilded Hollow, wealthy riders are 2.4x more price-sensitive—their average mobility fell to ${Math.round(avgRich)}. While this funded the bus, it may have over-taxed high-value city movement. Worst month: ${MONTHS[worst.idx]}.`,
      research: "Optimal integrated transport policy: when ride-hailing is primarily a luxury service, high taxes on the wealthy can fund high-quality public transit for the poor, but excessive taxation may reduce total city economic activity if mobility falls too far.",
    });
  }
  const extremeMonths = history.filter((_, i) => Math.abs(SEASONS.tempIndex[i]) >= 0.7);
  const collapseMonths = extremeMonths.filter(m => m.acLevel < 15 && m.poorMobility < 38);
  if (collapseMonths.length >= 2) {
    failures.push({
      icon: "🌡️", color: C.amber, bg: C.amberBg, border: C.amberBorder,
      title: "Seasonal bus collapse hurt poor riders",
      body: `In ${collapseMonths.length} extreme weather months, AC was below 15% — triggering a bus collapse. Poor citizens couldn't afford taxed Uber and faced hot or cold buses. This is the "Weathering the Ride" finding made real.`,
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
  const r = ADVISOR.monthEndReactions;
  if (timedOut) return pickRandom(r.timedOut);
  if (uberTax === 0 && bus === 0 && ac === 0) return pickRandom(r.noPolicy);
  if (budgetFraction < BUDGET_CONFIG.warningFraction) return pickRandom(r.budgetWarning);

  const ti = SEASONS.tempIndex[roundIndex];
  if (stats.weatherAlert && ti > 0.5) return pickRandom(r.heatNeedingAC);
  if (stats.weatherAlert && ti < -0.5) return pickRandom(r.coldNeedingAC);

  if (stats.equityScore < SIMULATION.thresholds.equity.warning) return pickRandom(r.equityGap);

  const t = SIMULATION.thresholds;
  if (stats.cityHappiness >= t.happiness.good) return pickRandom(r.highHappiness);
  if (stats.congestionLevel >= t.congestion.warning) return pickRandom(r.highCongestion);
  if (stats.cityMobility <= t.mobility.warning) return pickRandom(r.lowMobility);
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

function GaugeBar({ label, value, type, tooltip, extra, subLabel, breakdown, target, prev }) {
  const color = gc(value, type);
  const barW = type === "budget" ? value * 100 : Math.round(value);
  const display = type === "budget" ? `$${(value * BUDGET_CONFIG.annualBudget).toFixed(1)}M` : Math.round(value);
  const delta = (type !== "budget" && prev != null) ? Math.round(value) - Math.round(prev) : null;
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

function SplitGauge({ poorVal, richVal, tooltip, label = "Mobility Split", type = "mobility" }) {
  const poorColor = gc(poorVal, type);
  const richColor = gc(richVal, type);
  return (
    <div style={{ marginBottom: 15 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
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
        <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.7, marginBottom: 10 }}>Citizens lost confidence after <strong>3 consecutive months</strong> of happiness below 30. Gilded Hollow needs a new Transport Director.</p>
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
        <h2 style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: "0 0 8px" }}>Gilded Hollow Bankrupt</h2>
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
  if (uberTax > 60) w.push("Tax above 60% — poor riders hit the hardest (2.4× more elastic).");
  if (Math.abs(SEASONS.tempIndex[roundIndex]) > 0.6 && acLevel < 25) w.push("Extreme weather + AC below 25% — bus collapse risk.");
  if (live.equityScore < 45) w.push("Income equity critically low — poor mobility lagging far behind rich.");
  if (live.monthlyDelta < -0.3 && budgetFraction < 0.35) w.push("Costs exceed revenue — budget draining.");
  return w;
}

function generateChangeSummary(stats, prevStats, uberTax, busSubsidy, acLevel, roundIndex) {
  const lines = [];
  const tempHigh = Math.abs(SEASONS.tempIndex[roundIndex]) > 0.6;
  if (uberTax > 0) {
    if (uberTax > 60) lines.push({ icon: "💰", text: `Uber tax at ${uberTax}% raised revenue — poor riders absorbed most of the mobility cost.` });
    else if (uberTax > 30) lines.push({ icon: "💰", text: `Uber tax at ${uberTax}% generated revenue — moderately shifted poor riders toward buses.` });
    else lines.push({ icon: "💰", text: `Low Uber tax (${uberTax}%) — modest revenue, minimal mobility shift.` });
  }
  if (busSubsidy > 0) {
    const equityHelped = stats.equityScore > (prevStats?.equityScore ?? 50);
    lines.push({ icon: "🚌", text: `Bus subsidy (${busSubsidy}%) primarily helped poor riders — ${equityHelped ? "improved" : "maintained"} income equity.` });
  }
  if (tempHigh) {
    if (acLevel < 25) lines.push({ icon: "🌡️", text: `Extreme weather + low AC (${acLevel}%) — bus collapse hit poor riders hardest.` });
    else lines.push({ icon: "❄️", text: `Extreme weather, but AC at ${acLevel}% kept buses viable for both income groups.` });
  }
  if (stats.monthlyDelta < 0) lines.push({ icon: "📉", text: `Budget fell $${Math.abs(stats.monthlyDelta).toFixed(1)}M this month.` });
  else lines.push({ icon: "📈", text: `Budget grew $${stats.monthlyDelta.toFixed(1)}M — surplus to reinvest.` });
  if (prevStats) {
    const eqDelta = Math.round(stats.equityScore) - Math.round(prevStats.equityScore);
    if (Math.abs(eqDelta) >= 4) lines.push({ icon: eqDelta > 0 ? "⚖️" : "↘️", text: `Income equity ${eqDelta > 0 ? "improved" : "fell"} ${Math.abs(eqDelta)} pts vs last month.` });
  }
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
          <div style={{ fontSize: 9, letterSpacing: 2, color: C.blue, textTransform: "uppercase", fontWeight: 800 }}>City 3 · {CITY_META.name}</div>
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
        {(() => {
          const budgetColor = gc(budgetFraction, "budget");
          return (
            <div style={{
              background: budgetColor === C.green ? C.greenBg : budgetColor === C.amber ? C.amberBg : C.redBg,
              border: `1px solid ${budgetColor === C.green ? C.greenBorder : budgetColor === C.amber ? C.amberBorder : C.redBorder}`,
              borderRadius: 8, padding: "5px 12px", textAlign: "center", minWidth: 88,
            }}>
              <div style={{ fontSize: 9, color: C.textFaint, textTransform: "uppercase", letterSpacing: 1 }}>Budget</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: budgetColor }}>${budgetRemaining.toFixed(1)}M</div>
            </div>
          );
        })()}
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
              <span style={{ fontSize: 15 }}>{SEASONS.seasonIcon[roundIndex]}</span>
              <span style={{ fontSize: 10, color: C.red, fontWeight: 700, lineHeight: 1.4 }}>🔴 COLLAPSE — Extreme {live.tempIndex > 0 ? "heat" : "cold"} + AC below 15%. Poor riders stranded.</span>
            </div>
          )}
          {!live.collapseActive && live.weatherAlert && (
            <div style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10, display: "flex", gap: 7, alignItems: "flex-start" }}>
              <span style={{ fontSize: 15 }}>{SEASONS.seasonIcon[roundIndex]}</span>
              <span style={{ fontSize: 10, color: C.amber, fontWeight: 700, lineHeight: 1.4 }}>⚠️ Extreme {live.tempIndex > 0 ? "heat" : "cold"} — raise AC to keep buses attractive.</span>
            </div>
          )}

          <SliderInput label="Uber Tax" value={uberTax} onChange={onUberChange} color={C.uberColor} tooltip={ADVISOR.tooltips.uberTax} locked={locked} tag={{ text: "earns $", bg: C.greenBg, color: C.green, border: C.greenBorder }}
            hint="Raises revenue · hits poor riders 2.4× harder than rich · above 60% causes sharp mobility loss" />
          <SliderInput label="Bus Fare Subsidy" value={busSubsidy} onChange={onBusChange} color={C.busColor} tooltip={ADVISOR.tooltips.busSubsidy} locked={locked} tag={{ text: "costs $", bg: C.redBg, color: C.red, border: C.redBorder }}
            badge={<BusModeBadge poorMobilityB4Bus={live.poorMobilityB4Bus} busSubsidy={busSubsidy} />}
            hint="Helps poor riders most · funded by Uber tax · less effective above mobility 65" />
          <SliderInput label="Bus AC & Heating" value={acLevel} onChange={onACChange} color={C.acColor} tooltip={ADVISOR.tooltips.acLevel} locked={locked} tag={{ text: "costs $", bg: C.redBg, color: C.red, border: C.redBorder }}
            hint="Prevents weather-driven bus collapse · costs more in summer/winter" />
          <BudgetDeltaPreview delta={live.monthlyDelta} uberRevenue={live.uberRevenue} busCost={live.busCost} acCost={live.acCost} />
        </div>

        {/* CENTER: City road visualization */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <CityRoadScene
            cityLevel={3}
            uberTax={uberTax}
            busSubsidy={busSubsidy}
            congestion={live.congestionLevel}
            seasonIcon={SEASONS.seasonIcon[roundIndex]}
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
          <GaugeBar label="City Happiness" value={live.cityHappiness} type="happiness" tooltip={ADVISOR.tooltips.happiness} breakdown={live.happinessBreakdown} target="Goal: 65+" />
          <SplitGauge label="Happiness Split" poorVal={live.poorHappiness} richVal={live.richHappiness} targetVal={live.cityHappiness} type="happiness" tooltip={ADVISOR.tooltips.happiness} />
          <SplitGauge label="Mobility Split" poorVal={live.poorMobility} richVal={live.richMobility} targetVal={live.cityMobility} type="mobility" tooltip={ADVISOR.tooltips.mobility} />
          <GaugeBar label="Equity" value={live.equityScore} type="equity" tooltip={ADVISOR.tooltips.equity} target="Goal: 60+" />
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
          <GaugeBar label="Happiness" value={cityHappiness} type="happiness" tooltip={ADVISOR.tooltips.happiness} breakdown={stats.happinessBreakdown} target="Goal: 65+" prev={prevStats?.cityHappiness ?? null} />
          <SplitGauge poorVal={poorMobility} richVal={richMobility} tooltip={ADVISOR.tooltips.mobility} />
          <GaugeBar label="Equity" value={equityScore} type="equity" tooltip={ADVISOR.tooltips.equity} target="Goal: 60+" prev={prevStats?.equityScore ?? null} />
          <GaugeBar label="Congestion" value={congestionLevel} type="congestion" tooltip={ADVISOR.tooltips.congestion} target="Goal: under 40" prev={prevStats?.congestionLevel ?? null} />
          <GaugeBar label="Budget" value={budgetFraction} type="budget" tooltip={ADVISOR.tooltips.budget} extra={`/ $${BUDGET_CONFIG.annualBudget}M`} target="Safe zone: above $6M" />
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

        {/* Strategic Success Banner */}
        {(acLevel >= 40 && Math.abs(stats.tempIndex) > 0.6 && stats.equityScore > 65) && (
          <div style={{ background: C.purpleBg, border: `1px solid ${C.purpleBorder}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 20 }}>❄️</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Strategic Success</div>
              <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.4 }}>
                Your climate investment is working! High {stats.tempIndex > 0 ? "AC" : "heating"} levels are keeping the bus network viable for low-income riders despite the extreme weather.
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
            <div style={{ fontSize: 10, color: C.blue, marginBottom: 4, fontWeight: 800 }}>🏙️ Up Next: City 4 — Crestwood</div>
            <div style={{ fontSize: 11, color: C.textSub, lineHeight: 1.6 }}>{DEBRIEF.city4Teaser}</div>
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
export default function GildedHollowTycoon() {
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
