import { useState, useCallback, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";

// ============================================================
//  DESIGN TOKENS
// ============================================================
const C = {
  pageBg: "#F5F2EC", cardBg: "#FFFFFF", insetBg: "#EAE6DE",
  border: "#D4CFC6", borderLight: "#E8E2D8",
  text: "#1A1714", textSub: "#3D3830", textMuted: "#6B6358", textFaint: "#9C9188",
  blue: "#1B4FD8", blueBg: "#EEF3FF", blueBorder: "#B8CBFF",
  green: "#166534", greenBg: "#F0FDF4", greenBorder: "#86EFAC",
  amber: "#92400E", amberBg: "#FFFBEB", amberBorder: "#FCD34D",
  red: "#991B1B", redBg: "#FFF1F1", redBorder: "#FECACA",
  purple: "#6D28D9", purpleBg: "#F5F3FF", purpleBorder: "#C4B5FD",
  cyan: "#0E7490", cyanBg: "#ECFEFF", cyanBorder: "#A5F3FC",
  rose: "#9F1239", roseBg: "#FFF1F3", roseBorder: "#FECDD3",
  teal: "#0F766E", tealBg: "#F0FDFA", tealBorder: "#99F6E4",
  uberColor: "#B91C1C", busColor: "#1B4FD8", acColor: "#0E7490", safetyColor: "#6D28D9",
  track: "#E2DDD6", overlay: "rgba(26,23,20,0.80)",
};

// ============================================================
//  BLUEPRINT
// ============================================================
const CITY_META = {
  name: "Crestwood",
  subtitle: "A city where the final barrier is safety",
  population: 300000,
  intro: `Crestwood has 300,000 people — and every challenge a transport director can face. Seasons disrupt bus comfort. Income inequality means the poor absorb Uber taxes worst. And gender shapes who can safely use public transit at all. Women here are less mobile than men — not because they want to be, but because they do not feel safe on buses. Price subsidies alone will not fix this. You have four levers: Uber tax, bus fare subsidy, bus AC & heating, and a new one — bus safety investment. Closing the gender gap requires that fourth lever. You have $50M for the year.`,
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TIMER = { monthDuration: 30, warningAt: 7, endingDuration: 1200 };

const SEASONS = {
  tempIndex: [-1.0, -0.7, -0.3, 0.0, 0.4, 0.8, 1.0, 0.8, 0.4, 0.0, -0.4, -0.8],
  seasonLabel: ["Deep Winter", "Late Winter", "Early Spring", "Spring", "Late Spring", "Early Summer", "Peak Summer", "Late Summer", "Early Autumn", "Autumn", "Late Autumn", "Early Winter"],
  seasonIcon: ["🥶", "🥶", "🌱", "🌿", "☀️", "🌡️", "🔥", "🌡️", "🍂", "🍂", "🌧️", "❄️"],
  peakBusMobilityPenalty: 20,
  peakUberDemandBoost: 9,
  peakBaselineMobilityPenalty: 5,
  acCollapseThreshold: 0.25,
  collapseMultiplier: 2.5,
};

// ============================================================
//  POPULATION STRUCTURE
//  Four groups — each 25% of city.
//  Row = income (poor / rich), Col = gender (women / men)
// ============================================================
const POP = {
  // Fractions
  poorWomenFrac: 0.25, poorMenFrac: 0.25,
  richWomenFrac: 0.25, richMenFrac: 0.25,

  // Baseline mobility (research: women ~35% less mobile than men; poor ~40% less mobile than rich)
  poorWomenBaseline:  28,
  poorMenBaseline:    42,
  richWomenBaseline:  44,
  richMenBaseline:    62,

  // Baseline happiness
  poorWomenHappiness: 34, poorMenHappiness: 40,
  richWomenHappiness: 50, richMenHappiness: 58,
};

const SIMULATION = {
  baseline: { congestionLevel: 52 },

  uber: {
    // Price elasticity: women ~2.4× more elastic than men (Cairo finding)
    // Poor ~2.4× more elastic than rich (City 3 finding)
    // Loss curves per group at each tax zone
    congestionReductionPerPercent: 0.38,
    revenueRate: 0.0018,
  },

  bus: {
    // Flip point: bus subsidies boost mobility below this, constrain above
    mobilityFlipPoint: 55,
    // Base gains per % subsidy (below flip)
    poorMenGain: 0.28,   poorWomenBaseGain: 0.28,
    richMenGain: 0.10,   richWomenBaseGain: 0.10,
    // Above flip — constraining loss
    constrainingLoss: 0.07,
    congestionOffsetPerPercent: 0.17,
    costRate: 0.0013,
  },

  ac: {
    mitigationExponent: 0.7,
    costRate: 0.0019,
  },

  // KEY GENDER MECHANIC
  // Safety investment (0–100%) gates how much women can benefit from bus subsidies.
  // At 0% safety: women only receive 15% of the normal bus gain (they avoid unsafe buses).
  // At 100% safety: women receive 100% of the normal bus gain.
  // Safety also directly boosts women's baseline mobility (they travel more when transit feels safe).
  safety: {
    costRate: 0.0022,
    // Women's bus gain multiplier = safetyFactor (0.15 → 1.0)
    minBusGainMultiplier: 0.15,
    // Each % of safety investment raises women's baseline mobility slightly
    womenBaselineLiftPerPercent: 0.08,
    // Women's direct safety happiness bonus
    womenHappinessBonusPerPercent: 0.10,
  },

  happiness: {
    mobilityWeight: 0.65,
    congestionWeight: 0.35,
    budgetStressWeight: 0.30,
    min: 0, max: 100,
  },

  equity: {
    // Income gap penalty
    incomePenaltyPerGapPoint: 1.4,
    // Gender gap penalty
    genderPenaltyPerGapPoint: 1.6,
    min: 0, max: 100,
  },

  thresholds: {
    happiness:    { good: 65, warning: 40 },
    congestion:   { good: 38, warning: 65 },
    mobility:     { good: 60, warning: 42 },
    genderEquity: { good: 62, warning: 38 },
    incomeEquity: { good: 62, warning: 38 },
    budget:       { safe: 0.50, warning: 0.20 },
  },

  politicalFloor: 28,
  politicalStreakNeeded: 3,
};

const BUDGET_CONFIG = {
  annualBudget: 50.0,
  warningFraction: 0.20,
  budgetBonusWeight: 0.10,
};

const SCORING = {
  weights: { happiness: 0.35, genderEquity: 0.30, incomeEquity: 0.20, budget: 0.15 },
  grades: [
    { min: 85, grade: "A+", label: "Equitable City for All", color: C.green },
    { min: 75, grade: "A",  label: "Thriving & Fair",        color: C.green },
    { min: 65, grade: "B",  label: "Progress Made",          color: "#3D7A2B" },
    { min: 55, grade: "C",  label: "Gaps Persist",           color: C.amber },
    { min: 45, grade: "D",  label: "Divided City",           color: "#C05621" },
    { min: 0,  grade: "F",  label: "Left Behind",            color: C.red },
  ],
};

const ADVISOR = {
  name: "Maya", title: "Chief Transport Advisor",
  gameIntro: `Welcome to Crestwood — the most complex city yet. Everything you've learned comes together here: seasonal weather, an income gap, and now a gender gap rooted in bus safety. Women are less mobile than men because they don't feel safe on public transit. Cheap Uber matters more to them — a heavy tax strands them. The new lever, Bus Safety Investment, is what actually unlocks buses for women. Without it, bus subsidies barely reach them. You need all four levers working together. 30 seconds per month.`,
  monthStartHints: [
    "January 🥶 — Deep winter. Cold buses repel riders. Women avoid unsafe, cold buses doubly. AC and safety investment together keep them moving.",
    "Still cold. Poor women face the hardest conditions — taxed Uber, cold buses, unsafe stops. Safety investment has a lasting effect.",
    "Winter easing. Good month to build up safety investment before summer heat arrives.",
    "Spring — mild. Buses naturally attractive. A good month to earn budget surplus and invest in safety.",
    "Late spring. Women's mobility gap is most visible now — bus subsidies work for men but stall for women without safety.",
    "Early summer 🌡️ — heat building. Without AC, riders flee buses. Without safety, women flee buses doubly.",
    "Peak summer 🔥 — hardest month for all groups. AC + Safety + Bus subsidy is the triple lock that keeps women mobile.",
    "Still hot. Uber tax revenue should fund all three: bus, AC, and safety. Can you stay budget-positive?",
    "Summer fading. Ease the Uber tax slightly and reassess your safety investment level.",
    "Autumn 🍂 — mild and manageable. Recover budget. Safety investment effects compound over the year.",
    "Late autumn. Cold returning. Safety investment keeps women on buses even as temperatures drop.",
    "Final month ❄️. Gender equity is 30% of your score. Close the gap before the year ends.",
  ],
  monthEndReactions: {
    highHappiness: ["All groups moving well — buses comfortable, safe, and affordable.", "The city is working for everyone. Mobility, equity, and safety aligned.", "Strong policy across all four levers. This is what integrated transport planning looks like."],
    genderGap: ["Women are still less mobile than men. Bus subsidies help men — they already use buses. Safety investment is what gets women onto them.", "The gender gap persists. Women have higher price sensitivity AND lower baseline bus use. Safety investment changes that.", "Taxed Uber + unsafe buses = stranded women. Increase safety investment to close this gap."],
    incomeGap: ["Rich citizens absorb the Uber tax. The poor cannot — and they also rely on buses with less safety. Both levers need calibrating.", "Income gap widening. Poor riders are disproportionately hurt by Uber taxes and helped by bus+safety investment."],
    heatNeedingAC: ["Extreme heat + low AC = bus collapse. Women disproportionately stranded when both AC and safety are low.", "Hot, unsafe buses are doubly repellent to women. This month needed more AC investment."],
    coldNeedingAC: ["Cold buses with low AC drove riders back to Uber — spiking congestion. Women especially avoid uncomfortable and unsafe buses.", "Bus heating is your seasonal equity tool. It keeps all riders on buses regardless of weather."],
    highCongestion: ["Roads clogged. A higher Uber tax would reduce congestion AND earn revenue to fund bus + safety investment.", "Too many cars. The tax is your income lever — use it to fund the other three."],
    lowMobility: ["Mobility dropped. Uber tax may be too high, or safety/AC too low to keep women and the poor on buses.", "City isn't moving enough. With four levers, the balance matters — check which group is being left behind."],
    budgetWarning: ["Budget running thin. Uber tax is your only income source — it funds all three cost levers.", "Less than 20% budget left. Safety and AC costs are fixed; re-check the Uber tax level."],
    revenueGain: ["Budget grew — tax revenue covers all three cost streams. This is the self-funding model working.", "Positive budget month. Keep this balance and equity will follow."],
    balanced: ["Steady policy. City moving, gaps narrowing, budget stable.", "All four levers calibrated. Compound this over the year."],
    noPolicy: ["No levers engaged. Buses unsafe, cold, unsubsidised. Women and the poor bear the full cost.", "Laissez-faire month. All three gaps — congestion, income, gender — widen without intervention."],
    timedOut: ["Time ran out. In extreme months, set AC and safety first — then tax and subsidy.", "The clock beat you. Hit End Turn earlier next month."],
  },
  tooltips: {
    happiness:   "Weighted city happiness across all four groups (poor women, poor men, rich women, rich men). Extreme weather and low safety hurt women and the poor most.",
    mobility:    "City-wide average mobility. Masked by group differences — check gender and income gaps for the full picture.",
    congestion:  "Road congestion. Uber tax reduces it. Bus subsidy + safety reduce it by keeping riders off road. Weather boosts it without AC.",
    genderEquity:"100 minus the men/women mobility gap. Closes when safety investment is high. Bus subsidies alone don't close it — women avoid unsafe buses regardless of price.",
    incomeEquity:"100 minus the rich/poor mobility gap. Closes when bus subsidies are high and Uber tax is moderate. Heavy Uber tax widens this gap.",
    budget:      "Remaining budget ($50M). Uber tax earns money. Bus, AC, and safety all cost money. AC costs scale with weather severity.",
    uberTax:     "Tax on every Uber trip. Earns revenue + cuts congestion. Hits women and the poor ~2–2.5× harder than men and the wealthy (fewer alternatives, higher price sensitivity).",
    busSubsidy:  "Bus fare discount. Strongly benefits poor men. Weakly benefits women unless safety investment is also high — women avoid unsafe buses regardless of price. Costs budget.",
    acLevel:     "Bus climate control. Below 25% in extreme weather triggers a bus collapse. Costs scale with temperature extremity. Reduces weather penalty for all groups.",
    safetyLevel: "Safety cameras, lighting, security personnel at bus stops and on vehicles. Gates how much women benefit from bus subsidies. At 0%: women barely use buses. At 100%: full benefit. Also directly lifts women's baseline mobility. Costs budget year-round.",
  },
};

const DEBRIEF = {
  coreInsight: `Christensen & Osman (2025) found that effects and welfare gains from Uber price changes are substantially larger for women, who are less mobile at baseline and perceive public transit as unsafe. A 50% Uber price reduction increased women's total weekly travel by 849 km — compared to 652 km for men. Women who felt unsafe on buses showed the largest response of all sub-groups.`,
  genderInsight: `The research shows women in Cairo have over twice the price elasticity of men for Uber services. This cuts both ways: cheap Uber is a huge welfare gain for women; expensive Uber (via taxation) strands them. The antidote is not cheaper Uber — it is making buses safe enough that women are willing to use them as an alternative.`,
  incomeInsight: `Lower-income citizens have ~2.4× higher Uber price elasticity than the wealthy. Combined with the gender effect, poor women face the highest double-disadvantage: the most price-sensitive group AND the most safety-constrained bus users.`,
  seasonInsight: `"Weathering the Ride" documents that temperature extremes shift bus riders to Uber. For women who already avoid buses due to safety concerns, cold or hot buses compound the barrier — making climate investment doubly important for gender equity.`,
  balanceInsight: `You found the full balance: moderate Uber tax funding bus subsidies, AC investment, AND safety investment. Safety is the key insight — you cannot close the gender gap through price alone.`,
  source: `Christensen & Osman (2025) "Demand for Mobility" · Christensen & Osman (2023) "Weathering the Ride"`,
};

// ============================================================
//  SIMULATION ENGINE
// ============================================================
function getTemp(roundIndex) {
  const ti = SEASONS.tempIndex[roundIndex];
  return { tempIndex: ti, tempDiscomfort: Math.abs(ti) };
}

// Non-linear Uber mobility loss curves, per group
// Women: ~2.4× steeper than men (research finding)
// Poor: ~2.4× steeper than rich (income elasticity finding)
function uberLoss(tax, isWomen, isPoor) {
  const base = isPoor
    ? (tax <= 30 ? tax * 0.42 : tax <= 60 ? 12.6 + (tax - 30) * 0.72 : 34.2 + (tax - 60) * 0.90)
    : (tax <= 30 ? tax * 0.10 : tax <= 60 ? 3.0  + (tax - 30) * 0.26 : 10.8 + (tax - 60) * 0.36);
  // Women pay an additional ~50% Uber loss on top of the income-based curve
  return isWomen ? base * 1.50 : base;
}

// How much women actually benefit from bus subsidies, gated by safety investment
function safetyGate(safetyLevel) {
  const sf = safetyLevel / 100;
  const minG = SIMULATION.safety.minBusGainMultiplier; // 0.15
  return minG + (1 - minG) * sf; // 0.15 → 1.0 as safety goes 0 → 100%
}

function simulate(uberTax, busSubsidy, acLevel, safetyLevel, roundIndex, budgetRemaining) {
  const { bus, uber, ac, safety, happiness, equity } = SIMULATION;
  const { tempIndex: ti, tempDiscomfort } = getTemp(roundIndex);
  const acMitigation = Math.pow(acLevel / 100, ac.mitigationExponent);

  // ── SEASONAL EFFECTS ──────────────────────────────────────────────────
  const collapseActive = tempDiscomfort > 0.6 && acMitigation < SEASONS.acCollapseThreshold;
  const collapseMulti  = collapseActive ? SEASONS.collapseMultiplier : 1.0;
  const busTempPenalty = tempDiscomfort * SEASONS.peakBusMobilityPenalty * (1 - acMitigation) * collapseMulti;
  const baselineTempPenalty = tempDiscomfort * SEASONS.peakBaselineMobilityPenalty;
  const weatherUberBoost    = tempDiscomfort * SEASONS.peakUberDemandBoost * (1 - acMitigation * 0.5);

  // Safety gate for women's bus gain
  const womenBusMultiplier = safetyGate(safetyLevel);
  // Safety directly lifts women's accessible baseline mobility
  const safetyBaselineLift = (safetyLevel / 100) * safety.womenBaselineLiftPerPercent * 100;

  // ── GROUP MOBILITY FUNCTION ──────────────────────────────────────────
  function groupMobility(baseMobility, isWomen, isPoor) {
    const loss = uberLoss(uberTax, isWomen, isPoor);
    const mobAfterUber = Math.max(0, baseMobility - loss + (isWomen ? safetyBaselineLift : 0));

    const busGain = isPoor
      ? (isWomen ? bus.poorWomenBaseGain  * womenBusMultiplier : bus.poorMenGain)
      : (isWomen ? bus.richWomenBaseGain  * womenBusMultiplier : bus.richMenGain);

    const busEffect = mobAfterUber < bus.mobilityFlipPoint
      ? busSubsidy * busGain
      : busSubsidy * -bus.constrainingLoss;

    // Women face extra temperature-driven bus penalty (unsafe + uncomfortable = doubly repellent)
    const womenWeatherPenalty = isWomen ? busTempPenalty * 0.30 * (1 - safetyLevel / 100) : 0;
    const totalBusPenalty = busTempPenalty + baselineTempPenalty + womenWeatherPenalty;

    return Math.min(100, Math.max(0,
      mobAfterUber + busEffect - totalBusPenalty + weatherUberBoost * 0.2
    ));
  }

  const poorWomenMob = groupMobility(POP.poorWomenBaseline, true,  true);
  const poorMenMob   = groupMobility(POP.poorMenBaseline,   false, true);
  const richWomenMob = groupMobility(POP.richWomenBaseline,  true,  false);
  const richMenMob   = groupMobility(POP.richMenBaseline,    false, false);

  const cityMobility =
    POP.poorWomenFrac * poorWomenMob +
    POP.poorMenFrac   * poorMenMob   +
    POP.richWomenFrac * richWomenMob +
    POP.richMenFrac   * richMenMob;

  const womenMobility = (poorWomenMob + richWomenMob) / 2;
  const menMobility   = (poorMenMob   + richMenMob)   / 2;
  const poorMobility  = (poorWomenMob + poorMenMob)   / 2;
  const richMobility  = (richWomenMob + richMenMob)   / 2;

  // ── CONGESTION ───────────────────────────────────────────────────────
  const congestionLevel = Math.min(100, Math.max(5,
    SIMULATION.baseline.congestionLevel
    - uberTax    * uber.congestionReductionPerPercent
    - busSubsidy * bus.congestionOffsetPerPercent
    + weatherUberBoost * 0.22
  ));

  // ── EQUITY SCORES ────────────────────────────────────────────────────
  const genderGap = Math.max(0, menMobility - womenMobility);
  const incomeGap = Math.max(0, richMobility - poorMobility);
  const genderEquityScore = Math.min(100, Math.max(0, 100 - genderGap * equity.genderPenaltyPerGapPoint));
  const incomeEquityScore = Math.min(100, Math.max(0, 100 - incomeGap * equity.incomePenaltyPerGapPoint));

  // ── BUDGET ───────────────────────────────────────────────────────────
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const budgetStress = budgetFraction > 0.5 ? 0 : (0.5 - budgetFraction) / 0.5;
  const activity = (cityMobility + congestionLevel) / 2;
  const uberRevenue  = (uberTax     / 100) * uber.revenueRate   * activity * 300;
  const busCost      = (busSubsidy  / 100) * bus.costRate        * activity * 300;
  const acCost       = (acLevel     / 100) * ac.costRate         * (0.2 + tempDiscomfort * 0.8) * 300;
  const safetyCost   = (safetyLevel / 100) * safety.costRate     * 300;
  const monthlyDelta = +(uberRevenue - busCost - acCost - safetyCost).toFixed(3);

  // ── HAPPINESS PER GROUP ──────────────────────────────────────────────
  const hw = happiness;
  function groupHappiness(baseMob, groupMob, baseHappy, isWomen) {
    const safetyBonus = isWomen ? (safetyLevel / 100) * safety.womenHappinessBonusPerPercent * 100 * 0.35 : 0;
    return Math.min(hw.max, Math.max(hw.min,
      baseHappy
      + (groupMob - baseMob) * hw.mobilityWeight
      - (congestionLevel - SIMULATION.baseline.congestionLevel) * hw.congestionWeight
      + safetyBonus
      - budgetStress * 28 * hw.budgetStressWeight
    ));
  }
  const poorWomenH = groupHappiness(POP.poorWomenBaseline, poorWomenMob, POP.poorWomenHappiness, true);
  const poorMenH   = groupHappiness(POP.poorMenBaseline,   poorMenMob,   POP.poorMenHappiness,   false);
  const richWomenH = groupHappiness(POP.richWomenBaseline, richWomenMob, POP.richWomenHappiness, true);
  const richMenH   = groupHappiness(POP.richMenBaseline,   richMenMob,   POP.richMenHappiness,   false);

  const cityHappiness =
    POP.poorWomenFrac * poorWomenH +
    POP.poorMenFrac   * poorMenH   +
    POP.richWomenFrac * richWomenH +
    POP.richMenFrac   * richMenH;

  const busIsConstraining = busSubsidy > 0 && (
    (POP.poorMenBaseline   - uberLoss(uberTax, false, true))  >= bus.mobilityFlipPoint ||
    (POP.richMenBaseline   - uberLoss(uberTax, false, false)) >= bus.mobilityFlipPoint
  );
  const weatherAlert = tempDiscomfort > 0.6 && acLevel < 30;

  return {
    cityMobility, womenMobility, menMobility, poorMobility, richMobility,
    poorWomenMob, poorMenMob, richWomenMob, richMenMob,
    congestionLevel, genderEquityScore, incomeEquityScore,
    cityHappiness, poorWomenH, poorMenH, richWomenH, richMenH,
    monthlyDelta, uberRevenue, busCost, acCost, safetyCost,
    budgetStress, busIsConstraining, weatherAlert, collapseActive,
    tempDiscomfort, genderGap, incomeGap,
  };
}

// ── FAILURE DIAGNOSIS ──────────────────────────────────────────────────
function diagnoseRun(history, finalBudget) {
  const avgGE = history.reduce((s, m) => s + m.genderEquityScore,  0) / history.length;
  const avgIE = history.reduce((s, m) => s + m.incomeEquityScore,  0) / history.length;
  const avgC  = history.reduce((s, m) => s + m.congestionLevel,    0) / history.length;
  const avgH  = history.reduce((s, m) => s + m.cityHappiness,      0) / history.length;
  const avgU  = history.reduce((s, m) => s + m.uberTax,            0) / history.length;
  const avgB  = history.reduce((s, m) => s + m.busSubsidy,         0) / history.length;
  const avgS  = history.reduce((s, m) => s + m.safetyLevel,        0) / history.length;
  const avgWM = history.reduce((s, m) => s + m.womenMobility,      0) / history.length;
  const avgMM = history.reduce((s, m) => s + m.menMobility,        0) / history.length;
  const budFrac = finalBudget / BUDGET_CONFIG.annualBudget;
  const worstIdx = history.reduce((wi, m, i) => m.cityHappiness < history[wi].cityHappiness ? i : wi, 0);
  const worst = { ...history[worstIdx], idx: worstIdx };
  const failures = [];

  if (avgGE < 50) {
    failures.push({
      icon: "♀️", color: C.rose, bg: C.roseBg, border: C.roseBorder,
      title: "Gender gap never closed",
      body: `Average gender equity was ${Math.round(avgGE)}. Women's average mobility (${Math.round(avgWM)}) lagged men's (${Math.round(avgMM)}) all year. Average safety investment was only ${Math.round(avgS)}% — below the level needed for women to benefit from bus subsidies. The fix: increase safety investment so bus subsidies actually reach women.`,
      research: "Cairo study: women who perceived buses as unsafe showed the largest response to Uber price changes — 2.93 IHS points increase in utilization for a 50% discount. Safety is the lever that makes bus subsidies effective for women.",
    });
  }
  if (avgIE < 50) {
    failures.push({
      icon: "⚖️", color: C.purple, bg: C.purpleBg, border: C.purpleBorder,
      title: "Income gap persisted",
      body: `Average income equity was ${Math.round(avgIE)}. Poor citizens absorbed the Uber tax hardest — their price elasticity is ~2.4× higher than the wealthy. Average bus subsidy was ${Math.round(avgB)}% — not enough to compensate. Bus investment is the equity correction for the poor.`,
      research: "Research finding: lower-income elasticity is ~2.4× higher than wealthy citizens. Uniform Uber taxes are regressive without targeted bus reinvestment.",
    });
  }
  const extremeMonths = history.filter((_, i) => Math.abs(SEASONS.tempIndex[i]) >= 0.7);
  const collapseMonths = extremeMonths.filter(m => m.acLevel < 25 && m.womenMobility < 32);
  if (collapseMonths.length >= 2) {
    failures.push({
      icon: "🌡️", color: C.amber, bg: C.amberBg, border: C.amberBorder,
      title: "Seasonal collapse hit women hardest",
      body: `In ${collapseMonths.length} extreme weather months, AC was below 25% and women's mobility fell below 32. Cold or hot buses without climate control doubly repel women — who already avoid unsafe buses. AC and safety investment work together.`,
      research: "Weathering the Ride: extreme temperatures shift bus riders to ride-hailing. Women who already avoid buses due to safety face a compounded seasonal barrier.",
    });
  }
  if (avgC > 65 && avgU < 25) {
    failures.push({
      icon: "🚗", color: C.textMuted, bg: C.insetBg, border: C.border,
      title: "Congestion went unchecked",
      body: `Average congestion was ${Math.round(avgC)} with only ${Math.round(avgU)}% Uber tax. In a city of 300k, even 25–35% tax would clear congestion and earn revenue to fund bus + safety investment. Worst month: ${MONTHS[worst.idx]}.`,
      research: "Cairo equilibrium model: market-level Uber price reduction raises external costs by ~0.7% of city GDP. This compounds fast in a large city.",
    });
  }
  if (budFrac < 0.10) {
    failures.push({
      icon: "💸", color: C.blue, bg: C.blueBg, border: C.blueBorder,
      title: "Four levers, one income stream",
      body: `Budget ended at $${finalBudget.toFixed(1)}M. You have three cost levers (bus, AC, safety) against one income source (Uber tax). The key is running them concurrently at calibrated levels — not maxing one and starving the others.`,
      research: "Transport subsidy costs scale with ridership. Safety costs are fixed regardless of ridership. Sustainable policy balances all streams.",
    });
  }
  if (failures.length === 0 && avgH < 63) {
    failures.push({
      icon: "😐", color: C.textMuted, bg: C.insetBg, border: C.border,
      title: "Cautious policy across the board",
      body: `No single disaster — but no bold investment either. Average happiness ${Math.round(avgH)}, gender equity ${Math.round(avgGE)}, income equity ${Math.round(avgIE)}. Sweet spot: ~40% Uber tax, ~50% bus subsidy, ~55% AC in extreme months, ~60% safety investment year-round.`,
      research: "Optimal integrated transport policy requires calibrated intervention across all four levers simultaneously.",
    });
  }
  return { failures, worstMonth: MONTHS[worst.idx], worstHappiness: Math.round(worst.cityHappiness) };
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getMonthEndMessage(stats, uberTax, bus, ac, safety, budgetFraction, timedOut, roundIndex) {
  if (timedOut)  return pickRandom(ADVISOR.monthEndReactions.timedOut);
  if (uberTax === 0 && bus === 0 && ac === 0 && safety === 0)
    return pickRandom(ADVISOR.monthEndReactions.noPolicy);
  if (budgetFraction < BUDGET_CONFIG.warningFraction)
    return pickRandom(ADVISOR.monthEndReactions.budgetWarning);
  const ti = SEASONS.tempIndex[roundIndex];
  if (stats.weatherAlert && ti > 0.5)  return pickRandom(ADVISOR.monthEndReactions.heatNeedingAC);
  if (stats.weatherAlert && ti < -0.5) return pickRandom(ADVISOR.monthEndReactions.coldNeedingAC);
  if (stats.genderEquityScore < SIMULATION.thresholds.genderEquity.warning)
    return pickRandom(ADVISOR.monthEndReactions.genderGap);
  if (stats.incomeEquityScore < SIMULATION.thresholds.incomeEquity.warning)
    return pickRandom(ADVISOR.monthEndReactions.incomeGap);
  const t = SIMULATION.thresholds;
  if (stats.cityHappiness  >= t.happiness.good)   return pickRandom(ADVISOR.monthEndReactions.highHappiness);
  if (stats.congestionLevel >= t.congestion.warning) return pickRandom(ADVISOR.monthEndReactions.highCongestion);
  if (stats.cityMobility   <= t.mobility.warning)  return pickRandom(ADVISOR.monthEndReactions.lowMobility);
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
    if (value <= t.good) return C.green; if (value <= t.warning) return C.amber; return C.red;
  }
  if (type === "budget") {
    if (value >= t.safe) return C.green; if (value >= t.warning) return C.amber; return C.red;
  }
  if (value >= t.good) return C.green; if (value >= t.warning) return C.amber; return C.red;
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
        <div style={{ position: "absolute", right: 0, top: 20, width: 230, background: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px", fontSize: 11, color: C.insetBg, zIndex: 300, lineHeight: 1.5, pointerEvents: "none" }}>{text}</div>
      )}
    </div>
  );
}

function GaugeBar({ label, value, type, tooltip, extra }) {
  const color = gc(value, type);
  const barW = type === "budget" ? value * 100 : Math.round(value);
  const display = type === "budget" ? `$${(value * BUDGET_CONFIG.annualBudget).toFixed(1)}M` : Math.round(value);
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
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

// Dual-line gauge showing women vs men mobility side by side
function GenderGauge({ womenVal, menVal, tooltip }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: 1, textTransform: "uppercase" }}>Mobility Split</span>
          <InfoTip text={tooltip} />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: C.rose }}>♀ Women</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: gc(womenVal, "mobility") }}>{Math.round(womenVal)}</span>
          <span style={{ fontSize: 10, color: C.textFaint }}>·</span>
          <span style={{ fontSize: 10, color: C.blue }}>♂ Men</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: gc(menVal, "mobility") }}>{Math.round(menVal)}</span>
        </div>
      </div>
      <div style={{ height: 6, background: C.track, borderRadius: 3, overflow: "hidden", marginBottom: 2 }}>
        <div style={{ height: "100%", width: `${Math.round(womenVal)}%`, background: C.rose, borderRadius: 3, transition: "width 0.35s ease" }} />
      </div>
      <div style={{ height: 4, background: C.track, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.round(menVal)}%`, background: C.blue, opacity: 0.5, borderRadius: 3, transition: "width 0.35s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.textFaint, marginTop: 2 }}>
        <span>← Women</span><span>Men →</span>
      </div>
    </div>
  );
}

// Four-cell group breakdown table
function GroupBreakdown({ poorW, poorM, richW, richM }) {
  const cell = (label, val, color) => (
    <div style={{ flex: 1, textAlign: "center", background: C.insetBg, borderRadius: 6, padding: "6px 4px" }}>
      <div style={{ fontSize: 9, color: C.textFaint, marginBottom: 2, lineHeight: 1.2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>{Math.round(val)}</div>
    </div>
  );
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Group Breakdown — Mobility</div>
      <div style={{ display: "flex", gap: 5 }}>
        {cell("Poor\nWomen ♀",  poorW, C.rose)}
        {cell("Poor\nMen ♂",    poorM, C.amber)}
        {cell("Rich\nWomen ♀",  richW, C.purple)}
        {cell("Rich\nMen ♂",    richM, C.blue)}
      </div>
    </div>
  );
}

function SliderInput({ label, value, onChange, color, tooltip, locked, tag, badge, accent }) {
  return (
    <div style={{ marginBottom: 17, opacity: locked ? 0.5 : 1, transition: "opacity 0.3s" }}>
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

function SafetyGateWarning({ safetyLevel }) {
  const gate = safetyGate(safetyLevel);
  const pct = Math.round(gate * 100);
  const color = pct < 40 ? C.red : pct < 70 ? C.amber : C.green;
  const bg = pct < 40 ? C.redBg : pct < 70 ? C.amberBg : C.greenBg;
  const border = pct < 40 ? C.redBorder : pct < 70 ? C.amberBorder : C.greenBorder;
  const icon = pct < 40 ? "🔴" : pct < 70 ? "⚠️" : "🟢";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: "4px 9px", fontSize: 10, fontWeight: 700, color, marginBottom: 5 }}>
      {icon} Women receive {pct}% of bus subsidy benefit · {pct < 40 ? "buses feel unsafe" : pct < 70 ? "some safety established" : "buses feel safe"}
    </div>
  );
}

function TaxZoneWarning({ tax }) {
  if (tax <= 30) return null;
  const steep = tax <= 60;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: steep ? C.amberBg : C.redBg, border: `1px solid ${steep ? C.amberBorder : C.redBorder}`, borderRadius: 6, padding: "4px 9px", fontSize: 10, fontWeight: 700, color: steep ? C.amber : C.red, marginTop: 3, marginBottom: 4 }}>
      {steep ? "⚠️ Steep zone — women & poor hit hardest" : "🔴 Cliff — women and poor face near-total mobility loss"}
    </div>
  );
}

function BudgetDeltaPreview({ delta, uberRevenue, busCost, acCost, safetyCost }) {
  const pos = delta >= 0;
  return (
    <div style={{ background: pos ? C.greenBg : C.redBg, border: `1px solid ${pos ? C.greenBorder : C.redBorder}`, borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>Est. budget change</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: pos ? C.green : C.red }}>{pos ? "+" : ""}{delta.toFixed(2)}M</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 10, color: C.textFaint, flexWrap: "wrap" }}>
        <span style={{ color: C.green }}>+${uberRevenue.toFixed(2)} tax</span>
        <span style={{ color: C.red }}>−${busCost.toFixed(2)} bus</span>
        <span style={{ color: C.red }}>−${acCost.toFixed(2)} AC</span>
        <span style={{ color: C.rose }}>−${safetyCost.toFixed(2)} safety</span>
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
  const d = Math.abs(ti);
  const col = d > 0.7 ? C.red : d > 0.3 ? C.amber : C.green;
  const bg  = d > 0.7 ? C.redBg : d > 0.3 ? C.amberBg : C.greenBg;
  const bd  = d > 0.7 ? C.redBorder : d > 0.3 ? C.amberBorder : C.greenBorder;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, background: bg, border: `1px solid ${bd}`, borderRadius: 6, padding: "4px 9px" }}>
      <span style={{ fontSize: 14 }}>{SEASONS.seasonIcon[roundIndex]}</span>
      <div>
        <div style={{ fontSize: 9, color: C.textFaint, textTransform: "uppercase", letterSpacing: 1 }}>Season</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: col }}>{SEASONS.seasonLabel[roundIndex]}</div>
      </div>
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 7px", textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 9, color: C.textFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
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
        <div style={{ fontSize: 26, fontWeight: 700, color: "#FFF" }}>{month} Ending...</div>
        <div style={{ marginTop: 14, display: "flex", gap: 6, justifyContent: "center" }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.blue, animation: `dot 0.9s ${i*0.3}s ease-in-out infinite` }} />)}
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
        <h2 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: "0 0 10px" }}>You've been voted out</h2>
        <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.7, marginBottom: 10 }}>Citizens lost confidence after <strong>3 consecutive months</strong> of happiness below 28. Crestwood needs new leadership.</p>
        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 20 }}>Removed in <strong>{month}</strong>. The gender gap, income gap, and seasonal failures compounded into a political crisis.</p>
        <div style={{ marginBottom: 22 }}><AdvisorBox message="Three months of deep unhappiness across multiple groups is a political signal. Check if women and the poor were being left behind simultaneously." /></div>
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
        <h2 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: "0 0 8px" }}>Crestwood Bankrupt</h2>
        <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.7, marginBottom: 22 }}>
          The city ran out of funds in <strong>{month}</strong>. Four cost streams outpaced one income stream.
        </p>
        <div style={{ marginBottom: 22 }}><AdvisorBox message="Bus, AC, safety, and reduced Uber activity all drain budget. The Uber tax is your only income — it needs to cover all three cost levers." /></div>
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
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>🏙️</div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: C.rose, textTransform: "uppercase", marginBottom: 10 }}>Transport Tycoon · City 4</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: C.text, margin: "0 0 5px" }}>{CITY_META.name}</h1>
        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 18, fontStyle: "italic" }}>{CITY_META.subtitle}</p>
        <div style={{ marginBottom: 18 }}><AdvisorBox message={ADVISOR.gameIntro} /></div>
        <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.75, marginBottom: 20 }}>{CITY_META.intro}</p>
        <div style={{ display: "flex", gap: 7, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
          {[["👥","300k people"],["⚖️","60% poor · 40% rich"],["♀♂","50% women · 50% men"],["💰","$50M budget"],["📅","12 months"],["⏱","30 sec/month"],["🚕","Uber tax earns $"],["🚌","Bus subsidy costs $"],["❄️🔥","AC (scales w/ weather)"],["🔒","Safety investment costs $"]].map(([icon, label]) => (
            <div key={label} style={{ background: C.insetBg, border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 9px", fontSize: 10, color: C.textSub }}>{icon} {label}</div>
          ))}
        </div>
        <button onClick={onStart} style={{ background: C.rose, color: "white", border: "none", borderRadius: 9, padding: "13px 34px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
          Start as Transport Director →
        </button>
        <p style={{ fontSize: 10, color: C.textFaint, marginTop: 8 }}>Hit End Turn when ready — or the timer decides</p>
      </div>
    </div>
  );
}

function PlanningScreen({ month, roundIndex, uberTax, busSubsidy, acLevel, safetyLevel,
  onUberChange, onBusChange, onACChange, onSafetyChange, onCommit, budgetRemaining }) {
  const [timeLeft, setTimeLeft] = useState(TIMER.monthDuration);
  const [locked, setLocked]     = useState(false);
  const [ending, setEnding]     = useState(false);
  const uberRef   = useRef(uberTax);
  const busRef    = useRef(busSubsidy);
  const acRef     = useRef(acLevel);
  const safetyRef = useRef(safetyLevel);
  const lockedRef = useRef(false);
  useEffect(() => { uberRef.current   = uberTax;     }, [uberTax]);
  useEffect(() => { busRef.current    = busSubsidy;  }, [busSubsidy]);
  useEffect(() => { acRef.current     = acLevel;     }, [acLevel]);
  useEffect(() => { safetyRef.current = safetyLevel; }, [safetyLevel]);

  const commitMonth = useCallback((wasTimedOut) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true); setEnding(true);
    setTimeout(() => onCommit(uberRef.current, busRef.current, acRef.current, safetyRef.current, wasTimedOut), TIMER.endingDuration);
  }, [onCommit]);

  useEffect(() => {
    setTimeLeft(TIMER.monthDuration); setLocked(false); setEnding(false); lockedRef.current = false;
    const iv = setInterval(() => {
      setTimeLeft(prev => { if (prev <= 1) { clearInterval(iv); commitMonth(true); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(iv);
  }, [roundIndex]);

  const live = simulate(uberTax, busSubsidy, acLevel, safetyLevel, roundIndex, budgetRemaining);
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const warn = timeLeft <= TIMER.warningAt && timeLeft > 0;

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: "Georgia,serif", padding: "14px", outline: warn ? `3px solid ${C.red}` : "3px solid transparent", outlineOffset: "-3px", transition: "outline 0.3s" }}>
      {ending && <MonthEndingOverlay month={month} />}
      <div style={{ maxWidth: 620, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: C.rose, textTransform: "uppercase", fontWeight: 800 }}>City 4 · {CITY_META.name}</div>
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
          <div style={{ height: "100%", width: `${(roundIndex / 12) * 100}%`, background: C.rose, transition: "width 0.4s" }} />
        </div>

        {/* Alerts */}
        {live.collapseActive && (
          <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "8px 12px", marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 15 }}>{SEASONS.seasonIcon[roundIndex]}</span>
            <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>🔴 COLLAPSE — Extreme weather + AC below 25%. Women avoiding unsafe, uncomfortable buses at 2.5× normal rate.</span>
          </div>
        )}
        {!live.collapseActive && live.weatherAlert && (
          <div style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 8, padding: "8px 12px", marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 15 }}>{SEASONS.seasonIcon[roundIndex]}</span>
            <span style={{ fontSize: 11, color: C.amber, fontWeight: 700 }}>⚠️ Extreme weather — raise AC to keep buses comfortable. Women face a compounded comfort + safety barrier.</span>
          </div>
        )}
        {live.genderGap > 18 && (
          <div style={{ background: C.roseBg, border: `1px solid ${C.roseBorder}`, borderRadius: 8, padding: "7px 12px", marginBottom: 8, fontSize: 11, color: C.rose, fontWeight: 700 }}>
            ♀ Gender gap is {Math.round(live.genderGap)} points — women's mobility significantly below men's. Safety investment narrows this gap.
          </div>
        )}

        <div style={{ marginBottom: 10 }}><AdvisorBox message={ADVISOR.monthStartHints[roundIndex]} /></div>

        {/* Policy card */}
        <div style={{ background: C.cardBg, border: `1px solid ${warn ? C.red : C.border}`, borderRadius: 12, padding: "14px 14px 6px", marginBottom: 9, boxShadow: "0 1px 6px rgba(0,0,0,0.06)", transition: "border 0.3s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Set Policy</span>
            {locked && <span style={{ fontSize: 10, color: C.red, fontWeight: 800 }}>🔒 LOCKED</span>}
          </div>
          <SliderInput label="Uber Tax" value={uberTax} onChange={onUberChange} color={C.uberColor}
            tooltip={ADVISOR.tooltips.uberTax} locked={locked}
            tag={{ text: "earns $", bg: C.greenBg, color: C.green, border: C.greenBorder }}
            badge={<TaxZoneWarning tax={uberTax} />} />
          <SliderInput label="Bus Fare Subsidy" value={busSubsidy} onChange={onBusChange} color={C.busColor}
            tooltip={ADVISOR.tooltips.busSubsidy} locked={locked}
            tag={{ text: "costs $", bg: C.redBg, color: C.red, border: C.redBorder }} />
          <SliderInput label="Bus AC & Heating" value={acLevel} onChange={onACChange} color={C.acColor}
            tooltip={ADVISOR.tooltips.acLevel} locked={locked}
            tag={{ text: "costs $", bg: C.redBg, color: C.red, border: C.redBorder }} />
          <SliderInput label="Bus Safety Investment" value={safetyLevel} onChange={onSafetyChange} color={C.safetyColor}
            tooltip={ADVISOR.tooltips.safetyLevel} locked={locked}
            tag={{ text: "costs $ · unlocks women's bus access", bg: C.purpleBg, color: C.purple, border: C.purpleBorder }}
            badge={<SafetyGateWarning safetyLevel={safetyLevel} />} />
          <BudgetDeltaPreview delta={live.monthlyDelta}
            uberRevenue={live.uberRevenue} busCost={live.busCost}
            acCost={live.acCost} safetyCost={live.safetyCost} />
        </div>

        {/* Live preview */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 9, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Live Preview</div>
          <GaugeBar label="Happiness" value={live.cityHappiness} type="happiness" tooltip={ADVISOR.tooltips.happiness} />
          <GenderGauge womenVal={live.womenMobility} menVal={live.menMobility} tooltip={ADVISOR.tooltips.mobility} />
          <GaugeBar label="Gender Equity" value={live.genderEquityScore} type="genderEquity" tooltip={ADVISOR.tooltips.genderEquity} />
          <GaugeBar label="Income Equity" value={live.incomeEquityScore} type="incomeEquity" tooltip={ADVISOR.tooltips.incomeEquity} />
          <GaugeBar label="Congestion" value={live.congestionLevel} type="congestion" tooltip={ADVISOR.tooltips.congestion} />
          <GaugeBar label="Budget" value={budgetFraction} type="budget" tooltip={ADVISOR.tooltips.budget} extra={`/ $${BUDGET_CONFIG.annualBudget}M`} />
          <div style={{ marginTop: 8 }}>
            <GroupBreakdown poorW={live.poorWomenMob} poorM={live.poorMenMob} richW={live.richWomenMob} richM={live.richMenMob} />
          </div>
        </div>

        <button onClick={() => commitMonth(false)} disabled={locked}
          style={{ width: "100%", background: locked ? C.border : C.rose, color: locked ? C.textMuted : "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 800, cursor: locked ? "not-allowed" : "pointer", transition: "background 0.2s" }}>
          {locked ? "⏳ Locking in..." : `✓ End Turn — Lock in ${month}'s Policy`}
        </button>
      </div>
    </div>
  );
}

function ResultScreen({ month, roundIndex, stats, uberTax, busSubsidy, acLevel, safetyLevel,
  advisorMessage, onNext, history, timedOut, budgetRemaining }) {
  const { cityMobility, womenMobility, menMobility, congestionLevel,
    genderEquityScore, incomeEquityScore, cityHappiness,
    monthlyDelta, uberRevenue, busCost, acCost, safetyCost,
    poorWomenMob, poorMenMob, richWomenMob, richMenMob } = stats;
  const ytdH = Math.round(history.reduce((s, m) => s + m.cityHappiness, 0) / history.length);
  const ytdGE = Math.round(history.reduce((s, m) => s + m.genderEquityScore, 0) / history.length);
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const isLast = roundIndex === 11;
  const pos = monthlyDelta >= 0;

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: "Georgia,serif", padding: "14px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
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
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {[[uberTax, C.uberColor, "Uber Tax"], [busSubsidy, C.busColor, "Bus Sub"], [acLevel, C.acColor, "AC"], [safetyLevel, C.safetyColor, "Safety"]].map(([v, col, l]) => (
            <div key={l} style={{ flex: 1, minWidth: 60, background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: C.textFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: col }}>{v}%</div>
            </div>
          ))}
          <div style={{ flex: 1.4, minWidth: 80, background: pos ? C.greenBg : C.redBg, border: `1px solid ${pos ? C.greenBorder : C.redBorder}`, borderRadius: 7, padding: "7px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Budget Δ</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: pos ? C.green : C.red }}>{pos ? "+" : ""}{monthlyDelta.toFixed(2)}M</div>
            <div style={{ fontSize: 8, color: C.textFaint }}>+{uberRevenue.toFixed(1)} −{busCost.toFixed(1)} −{acCost.toFixed(1)} −{safetyCost.toFixed(1)}</div>
          </div>
          {timedOut && <div style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 7, padding: "7px", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 12 }}>⏰</span></div>}
        </div>

        {/* Stat pills */}
        <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
          <StatPill label="Happiness"     value={cityHappiness}    color={gc(cityHappiness, "happiness")} />
          <StatPill label="Gender Eq."    value={genderEquityScore} color={gc(genderEquityScore, "genderEquity")} />
          <StatPill label="Income Eq."    value={incomeEquityScore} color={gc(incomeEquityScore, "incomeEquity")} />
          <StatPill label="Congestion"    value={congestionLevel}  color={gc(congestionLevel, "congestion")} />
          <StatPill label="Budget"        value={`$${budgetRemaining.toFixed(1)}M`} color={gc(budgetFraction, "budget")} />
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 9 }}>
          <GaugeBar label="Happiness"     value={cityHappiness}    type="happiness"    tooltip={ADVISOR.tooltips.happiness} />
          <GenderGauge womenVal={womenMobility} menVal={menMobility} tooltip={ADVISOR.tooltips.mobility} />
          <GaugeBar label="Gender Equity" value={genderEquityScore} type="genderEquity" tooltip={ADVISOR.tooltips.genderEquity} />
          <GaugeBar label="Income Equity" value={incomeEquityScore} type="incomeEquity" tooltip={ADVISOR.tooltips.incomeEquity} />
          <GaugeBar label="Congestion"    value={congestionLevel}  type="congestion"   tooltip={ADVISOR.tooltips.congestion} />
          <GaugeBar label="Budget"        value={budgetFraction}   type="budget"       tooltip={ADVISOR.tooltips.budget} extra={`/ $${BUDGET_CONFIG.annualBudget}M`} />
          <div style={{ marginTop: 8 }}>
            <GroupBreakdown poorW={poorWomenMob} poorM={poorMenMob} richW={richWomenMob} richM={richMenMob} />
          </div>
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 13px", marginBottom: 9, display: "flex", justifyContent: "space-around" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textFaint }}>YTD Happiness</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: gc(ytdH, "happiness") }}>{ytdH}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textFaint }}>YTD Gender Eq.</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: gc(ytdGE, "genderEquity") }}>{ytdGE}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textFaint }}>Budget Left</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: gc(budgetFraction, "budget") }}>${budgetRemaining.toFixed(1)}M</div>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}><AdvisorBox message={advisorMessage} /></div>

        <button onClick={onNext} style={{ width: "100%", background: isLast ? C.green : C.rose, color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
          {isLast ? "See Final Score →" : `Next: ${MONTHS[roundIndex + 1]} →`}
        </button>
      </div>
    </div>
  );
}

function YearEndScreen({ history, finalBudget, onRestart, scoreless }) {
  const avgH  = history.reduce((s, m) => s + m.cityHappiness,      0) / history.length;
  const avgGE = history.reduce((s, m) => s + m.genderEquityScore,  0) / history.length;
  const avgIE = history.reduce((s, m) => s + m.incomeEquityScore,  0) / history.length;
  const avgC  = history.reduce((s, m) => s + m.congestionLevel,    0) / history.length;
  const avgWM = history.reduce((s, m) => s + m.womenMobility,      0) / history.length;
  const avgMM = history.reduce((s, m) => s + m.menMobility,        0) / history.length;
  const budFrac = finalBudget / BUDGET_CONFIG.annualBudget;
  const { weights } = SCORING;
  const bonus = scoreless ? 0 : Math.max(0, budFrac * 100 * BUDGET_CONFIG.budgetBonusWeight);
  const rawScore = scoreless ? 0 :
    avgH  * weights.happiness   +
    avgGE * weights.genderEquity +
    avgIE * weights.incomeEquity +
    budFrac * 100 * weights.budget;
  const finalScore = Math.min(100, Math.round(rawScore));
  const grade = getGrade(scoreless ? 0 : finalScore);
  const { failures, worstMonth, worstHappiness } = diagnoseRun(history, finalBudget);
  const [openIdx, setOpenIdx] = useState(null);

  const chartData = history.map((m, i) => ({
    month: MONTHS[i].slice(0, 3),
    happiness:    Math.round(m.cityHappiness),
    genderEquity: Math.round(m.genderEquityScore),
    incomeEquity: Math.round(m.incomeEquityScore),
    women:  Math.round(m.womenMobility),
    men:    Math.round(m.menMobility),
    delta:  +m.monthlyDelta.toFixed(2),
    icon:   SEASONS.seasonIcon[i],
  }));

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: "Georgia,serif", padding: "14px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: C.rose, textTransform: "uppercase", marginBottom: 8, fontWeight: 800 }}>Year Complete · {CITY_META.name}</div>
          {scoreless
            ? <div style={{ fontSize: 44, fontWeight: 800, color: C.red }}>Bankrupt</div>
            : <div style={{ fontSize: 80, fontWeight: 800, color: grade.color, lineHeight: 1 }}>{grade.grade}</div>}
          <div style={{ fontSize: 16, color: C.textSub, marginTop: 5, fontWeight: 600 }}>
            {scoreless ? "City ran out of funds" : grade.label}
          </div>
          {!scoreless && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
            Score: {finalScore} = H {Math.round(avgH)}×{weights.happiness} + GE {Math.round(avgGE)}×{weights.genderEquity} + IE {Math.round(avgIE)}×{weights.incomeEquity} + B {Math.round(budFrac * 100)}×{weights.budget}
          </div>}
        </div>

        {/* Summary pills */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <StatPill label="Avg Happiness"  value={avgH}  color={gc(avgH, "happiness")} />
          <StatPill label="Avg Gender Eq." value={avgGE} color={gc(avgGE, "genderEquity")} />
          <StatPill label="Avg Income Eq." value={avgIE} color={gc(avgIE, "incomeEquity")} />
          <StatPill label="Avg Congestion" value={avgC}  color={gc(avgC, "congestion")} />
          <StatPill label="Budget Left"    value={`$${finalBudget.toFixed(1)}M`} color={gc(budFrac, "budget")} />
        </div>

        {/* Happiness + Equity chart */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 14px 8px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Happiness, Gender Equity & Income Equity — 12 Months</div>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11 }} />
              <Line type="monotone" dataKey="happiness"    stroke={C.green}  strokeWidth={2} dot={false} name="Happiness" />
              <Line type="monotone" dataKey="genderEquity" stroke={C.rose}   strokeWidth={2} dot={false} name="Gender Equity" />
              <Line type="monotone" dataKey="incomeEquity" stroke={C.purple} strokeWidth={2} dot={false} name="Income Equity" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 4, flexWrap: "wrap" }}>
            {[[C.green, "Happiness"], [C.rose, "Gender Equity"], [C.purple, "Income Equity"]].map(([col, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.textMuted }}>
                <div style={{ width: 16, height: 2, background: col }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Women vs Men mobility chart */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 14px 8px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Women vs Men Mobility — 12 Months</div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11 }} />
              <Line type="monotone" dataKey="women" stroke={C.rose}  strokeWidth={2} dot={false} name="Women" />
              <Line type="monotone" dataKey="men"   stroke={C.blue}  strokeWidth={2} dot={false} name="Men" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 4 }}>
            {[[C.rose, "Women ♀"], [C.blue, "Men ♂"]].map(([col, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.textMuted }}>
                <div style={{ width: 16, height: 2, background: col }} />{l}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8, textAlign: "center" }}>
            Avg women: <strong style={{ color: C.rose }}>{Math.round(avgWM)}</strong> · Avg men: <strong style={{ color: C.blue }}>{Math.round(avgMM)}</strong> · Gap: <strong style={{ color: Math.abs(avgMM - avgWM) > 10 ? C.red : C.amber }}>{Math.round(Math.abs(avgMM - avgWM))} pts</strong>
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
            <thead><tr>{["Month","Season","Uber","Bus","AC","Safety","BudgetΔ","Happy","GndEq","IncEq"].map(h => (
              <th key={h} style={{ color: C.textMuted, fontWeight: 800, textAlign: "left", paddingBottom: 6, borderBottom: `2px solid ${C.border}`, paddingRight: 5, textTransform: "uppercase", fontSize: 9 }}>{h}</th>
            ))}</tr></thead>
            <tbody>{history.map((m, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ padding: "5px 5px 5px 0", color: C.textSub, fontWeight: 700 }}>{MONTHS[i].slice(0,3)}</td>
                <td style={{ paddingRight: 5 }}>{SEASONS.seasonIcon[i]}</td>
                <td style={{ color: C.red,         fontWeight: 700, paddingRight: 5 }}>{m.uberTax}%</td>
                <td style={{ color: C.blue,        fontWeight: 700, paddingRight: 5 }}>{m.busSubsidy}%</td>
                <td style={{ color: C.acColor,     fontWeight: 700, paddingRight: 5 }}>{m.acLevel}%</td>
                <td style={{ color: C.safetyColor, fontWeight: 700, paddingRight: 5 }}>{m.safetyLevel}%</td>
                <td style={{ color: m.monthlyDelta >= 0 ? C.green : C.red, fontWeight: 700, paddingRight: 5 }}>{m.monthlyDelta >= 0 ? "+" : ""}{m.monthlyDelta.toFixed(1)}M</td>
                <td style={{ color: gc(m.cityHappiness,     "happiness"),    fontWeight: 700, paddingRight: 5 }}>{Math.round(m.cityHappiness)}</td>
                <td style={{ color: gc(m.genderEquityScore, "genderEquity"), fontWeight: 700, paddingRight: 5 }}>{Math.round(m.genderEquityScore)}</td>
                <td style={{ color: gc(m.incomeEquityScore, "incomeEquity") }}>{Math.round(m.incomeEquityScore)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        {/* Research debrief */}
        <div style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 12, padding: "14px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: C.blue, textTransform: "uppercase", marginBottom: 12, fontWeight: 800 }}>📖 What the Research Says</div>
          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8, margin: "0 0 10px" }}>{DEBRIEF.coreInsight}</p>
          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8, borderLeft: `3px solid ${C.rose}`, paddingLeft: 10, margin: "0 0 10px" }}>{DEBRIEF.genderInsight}</p>
          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8, borderLeft: `3px solid ${C.purple}`, paddingLeft: 10, margin: "0 0 10px" }}>{DEBRIEF.incomeInsight}</p>
          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8, borderLeft: `3px solid ${C.cyan}`, paddingLeft: 10, margin: "0 0 10px" }}>{DEBRIEF.seasonInsight}</p>
          {!scoreless && avgH >= 65 && <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8, borderLeft: `3px solid ${C.green}`, paddingLeft: 10, margin: "0 0 10px" }}>{DEBRIEF.balanceInsight}</p>}
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
export default function CrestwoodTycoonCity4() {
  const [screen,       setScreen]   = useState("intro");
  const [roundIndex,   setRound]    = useState(0);
  const [uberTax,      setUber]     = useState(0);
  const [busSubsidy,   setBus]      = useState(0);
  const [acLevel,      setAC]       = useState(0);
  const [safetyLevel,  setSafety]   = useState(0);
  const [history,      setHistory]  = useState([]);
  const [result,       setResult]   = useState(null);
  const [advisorMsg,   setMsg]      = useState("");
  const [timedOut,     setTO]       = useState(false);
  const [budget,       setBudget]   = useState(BUDGET_CONFIG.annualBudget);
  const [scoreless,    setSL]       = useState(false);
  const [gameOverMonth,setGOM]      = useState("");
  const [polMonth,     setPolMonth] = useState("");

  const handleCommit = useCallback((uberVal, busVal, acVal, safetyVal, wasTimedOut) => {
    setBudget(prev => {
      const stats = simulate(uberVal, busVal, acVal, safetyVal, roundIndex, prev);
      const newBudget = +(prev + stats.monthlyDelta).toFixed(3);
      const bf = Math.max(0, newBudget) / BUDGET_CONFIG.annualBudget;
      const msg = getMonthEndMessage(stats, uberVal, busVal, acVal, safetyVal, bf, wasTimedOut, roundIndex);
      const record = { ...stats, uberTax: uberVal, busSubsidy: busVal, acLevel: acVal, safetyLevel: safetyVal };
      setResult(record); setMsg(msg); setTO(wasTimedOut);
      setHistory(h => {
        const nh = [...h, record];
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
    else { setRound(r => r + 1); setUber(0); setBus(0); setAC(0); setSafety(0); setScreen("planning"); }
  }, [roundIndex]);

  const handleRestart = useCallback(() => {
    setScreen("intro"); setRound(0); setUber(0); setBus(0); setAC(0); setSafety(0);
    setHistory([]); setResult(null); setTO(false);
    setBudget(BUDGET_CONFIG.annualBudget); setSL(false); setGOM(""); setPolMonth("");
  }, []);

  const handleContinue = useCallback(() => {
    setSL(true); setRound(r => r + 1); setUber(0); setBus(0); setAC(0); setSafety(0);
    setBudget(0); setScreen("planning");
  }, []);

  if (screen === "intro")         return <IntroScreen onStart={() => setScreen("planning")} />;
  if (screen === "gameOver")      return <GameOverScreen month={gameOverMonth} onRestart={handleRestart} onContinue={handleContinue} />;
  if (screen === "politicalLoss") return <PoliticalLossScreen month={polMonth} onRestart={handleRestart} onContinue={handleContinue} />;
  if (screen === "planning")      return (
    <PlanningScreen month={MONTHS[roundIndex]} roundIndex={roundIndex}
      uberTax={uberTax} busSubsidy={busSubsidy} acLevel={acLevel} safetyLevel={safetyLevel}
      onUberChange={setUber} onBusChange={setBus} onACChange={setAC} onSafetyChange={setSafety}
      onCommit={handleCommit} budgetRemaining={budget} />
  );
  if (screen === "result")        return (
    <ResultScreen month={MONTHS[roundIndex]} roundIndex={roundIndex}
      stats={result} uberTax={result?.uberTax ?? 0} busSubsidy={result?.busSubsidy ?? 0}
      acLevel={result?.acLevel ?? 0} safetyLevel={result?.safetyLevel ?? 0}
      advisorMessage={advisorMsg} onNext={handleNext}
      history={history} timedOut={timedOut} budgetRemaining={budget} />
  );
  if (screen === "yearEnd")       return <YearEndScreen history={history} finalBudget={budget} onRestart={handleRestart} scoreless={scoreless} />;
}
