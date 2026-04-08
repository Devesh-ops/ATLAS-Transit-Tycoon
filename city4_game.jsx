import { useState, useCallback, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import CityIntroFlow from "./CityIntro";

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
  uberColor: "#B91C1C", busColor: "#1B4FD8", acColor: "#0E7490",
  track: "#E2DDD6", overlay: "rgba(26,23,20,0.80)",
};

// ============================================================
//  BLUEPRINT
// ============================================================
const CITY_META = {
  name: "Crestwood",
  subtitle: "A city where gender shapes who can move",
  population: 300000,
  intro: `Crestwood has 300,000 people — and every challenge a transport director can face. Seasons disrupt bus comfort. Income inequality means the poor absorb Uber taxes worst. And gender shapes who can safely use public transit at all. Women here are 35% less mobile than men — not because they choose to be, but because buses feel unsafe. This is a structural fact about Crestwood. You cannot fix it with a lever. What you can do is watch who your policies reach — and who they miss. You have three levers: Uber tax, bus fare subsidy, and bus AC & heating. You have $50M for the year.`,
};

// Safety is a fixed structural property of Crestwood — not a player lever.
// At this level, buses have minimal safety infrastructure, so women receive
// only a fraction of bus subsidy benefit. This reflects the research finding
// that safety is a non-price barrier that price levers cannot overcome.
const FIXED_SAFETY_LEVEL = 0;

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
  poorWomenBaseline: 28,
  poorMenBaseline: 42,
  richWomenBaseline: 44,
  richMenBaseline: 62,

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
    poorMenGain: 0.28, poorWomenBaseGain: 0.28,
    richMenGain: 0.10, richWomenBaseGain: 0.10,
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
    happiness: { good: 65, warning: 40 },
    congestion: { good: 38, warning: 65 },
    mobility: { good: 60, warning: 42 },
    genderEquity: { good: 62, warning: 38 },
    incomeEquity: { good: 62, warning: 38 },
    budget: { safe: 0.50, warning: 0.20 },
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
    { min: 75, grade: "A", label: "Thriving & Fair", color: C.green },
    { min: 65, grade: "B", label: "Progress Made", color: "#3D7A2B" },
    { min: 55, grade: "C", label: "Gaps Persist", color: C.amber },
    { min: 45, grade: "D", label: "Divided City", color: "#C05621" },
    { min: 0, grade: "F", label: "Left Behind", color: C.red },
  ],
};

const CITY_INTRO_SLIDES = [
  {
    icon: "🏙️",
    label: "Level 4: The Final Frontier",
    title: "Welcome to Crestwood",
    text: "Crestwood is a city of 300,000 people and your final challenge. Every mechanic you've learned comes together here: extreme seasons, income inequality, and a structural gender gap in transit access.",
    primary: true,
    buttonText: "See the Challenge →"
  },
  {
    icon: "♀️",
    label: "New Feature: Gender Gap",
    title: "A Barrier You Cannot Remove",
    text: "Women in Crestwood are 35% less mobile than men — not by choice, but because buses feel unsafe. This is baked into the city. You have no safety lever. Watch how your three policy levers reach men and women differently.",
    bullets: [
      { icon: "📊", text: "Gender Equity score tracks the mobility gap", color: C.rose },
      { icon: "⚠️", text: "Bus subsidies barely reach women — they avoid unsafe buses", color: C.purple },
      { icon: "🔍", text: "Your policy choices reveal who gets left behind", color: C.blue }
    ]
  },
  {
    icon: "🌡️",
    label: "Climate + Gender",
    title: "The Double Barrier",
    text: "Extreme weather compounds the gender gap. In peak summer or deep winter, uncomfortable buses repel all riders — but women, who already avoid unsafe buses, are the first to be stranded. AC investment helps everyone, but helps women the least.",
    bullets: [
      { icon: "❄️", text: "AC/Heating below 25% triggers bus collapse", color: C.blue },
      { icon: "🚕", text: "Uber tax on the rich funds AC and bus subsidies", color: C.green }
    ],
    primary: true,
    buttonText: "Start Final Level"
  }
];

const ADVISOR = {
  name: "Maya", title: "Chief Transport Advisor",
  gameIntro: `Welcome to Crestwood — the most complex city yet. Everything you've learned comes together here: seasonal weather, an income gap, and a structural gender gap. Women are 35% less mobile than men because buses feel unsafe — and this is a city-level reality, not something your budget can fix. You have three levers: Uber tax, bus subsidy, and AC. Watch carefully how your choices reach different groups. Your goal is to use redistribution to narrow all equity gaps — while knowing some of the gender gap will persist. 30 seconds per month.`,
  monthStartHints: [
    "January 🥶 — Deep winter. Cold buses repel riders. Wealthy riders provide revenue through Uber taxes — reinvest into bus heating. Watch how women and the poor respond differently.",
    "Still cold. Poor women face the hardest conditions — cold buses compound the gender barrier. Bus heating is your best tool right now.",
    "Winter easing. A good month to earn budget surplus before summer heat arrives.",
    "Spring — mild. Buses naturally attractive. Good time to build up budget and watch how the gender gap shifts with your bus subsidy.",
    "Late spring. Women's mobility gap is most visible now — bus subsidies reach men more than women. This gap reflects the structural safety barrier, not your policy.",
    "Early summer 🌡️ — heat building. Without AC, riders flee buses. Women are doubly repelled: heat plus unsafe buses.",
    "Peak summer 🔥 — hardest month for all groups. AC is essential. Even with it, the gender gap persists — women avoid unsafe buses regardless of comfort.",
    "Still hot. Uber tax revenue should fund both bus and AC. The gender gap is likely widest in hot months — note who is being left behind.",
    "Summer fading. Ease the Uber tax slightly and check how gender and income equity shifted over the summer.",
    "Autumn 🍂 — mild and manageable. Recover budget. Observe how the gender gap compares to milder months — is it structural or seasonal?",
    "Late autumn. Cold returning. Note which group is stranded first when buses get uncomfortable.",
    "Final month ❄️. Gender equity is 30% of your score. The gap cannot be fully closed without city-level safety reform — but your three levers can narrow it.",
  ],
  monthEndReactions: {
    highHappiness: ["All groups moving reasonably well — buses comfortable and affordable.", "The city is working for most people. The gender gap persists structurally, but your policy kept it contained.", "Strong policy across three levers. This is what evidence-based transport planning looks like."],
    genderGap: ["Women are still less mobile than men. Bus subsidies help men more — women avoid unsafe buses regardless of price. This is the structural reality of Crestwood.", "The gender gap persists. Women have higher Uber price sensitivity AND lower baseline bus use because of safety concerns beyond your control.", "The gender gap in Crestwood reflects a safety barrier that price levers cannot overcome. Observe, but don't expect to fully fix it."],
    incomeGap: ["Wealthy riders are still moving too freely compared to the poor. A higher Uber tax would bridge this gap while earning budget for the bus.", "The income gap is widening. Use the Uber tax as a wealth-leveller to ensure the poor aren't left behind."],
    heatNeedingAC: ["Extreme heat + low AC = bus collapse. Women are disproportionately stranded — heat compounds the existing safety barrier.", "Hot buses are doubly repellent to women who already avoid unsafe transit. This month needed more AC investment."],
    coldNeedingAC: ["Cold buses with low AC drove riders back to Uber — spiking congestion. Women especially avoid uncomfortable buses.", "Bus heating is your seasonal equity tool. It keeps all riders on buses regardless of weather."],
    highCongestion: ["Roads clogged. A higher Uber tax would reduce congestion AND earn revenue to fund bus and AC investment.", "Too many cars. The Uber tax is your income lever — use it to fund the other two."],
    lowMobility: ["Mobility dropped. Uber tax may be too high, or AC too low to keep riders on buses.", "City isn't moving enough. With three levers, the balance matters — check which group is being left behind."],
    budgetWarning: ["Budget running thin. Uber tax is your only income source — it funds both cost levers.", "Less than 20% budget left. AC costs scale with weather severity; re-check the Uber tax level."],
    revenueGain: ["Budget grew — tax revenue covers both cost streams. This is the self-funding model working.", "Positive budget month. Keep this balance and equity will follow."],
    balanced: ["Steady policy. City moving, gaps visible but contained, budget stable.", "Three levers calibrated. Compound this over the year."],
    noPolicy: ["No levers engaged. Buses cold, unsubsidised. Women and the poor bear the full cost.", "Laissez-faire month. Both gaps — income and gender — widen without intervention."],
    busConstraining: ["Bus subsidies are maxed out, but mobility is stalling. Riders are hitting the bus capacity limit — try lowering the subsidy to save budget.", "Max bus subsidies have hit the ridership ceiling. You're spending budget without gaining more mobility. Consider reinvesting into AC instead."],
    timedOut: ["Time ran out. In extreme months, set AC first — then tax and subsidy.", "The clock beat you. Hit End Turn earlier next month."],
  },
  tooltips: {
    happiness: "Weighted city happiness across all four groups (poor women, poor men, rich women, rich men). Extreme weather hurts all groups; the gender gap is a structural background feature.",
    mobility: "City-wide average mobility. Masked by group differences — check gender and income gaps for the full picture.",
    congestion: "Road congestion. Uber tax reduces it. Bus subsidy reduces it by keeping riders off roads. Weather boosts it without AC.",
    genderEquity: "100 minus the men/women mobility gap. Women avoid unsafe buses regardless of price — this gap reflects a structural barrier in Crestwood that your levers can narrow but not eliminate.",
    incomeEquity: "100 minus the rich/poor mobility gap. Closes when bus subsidies are high and Uber tax is moderate. Heavy Uber tax widens this gap.",
    budget: "Remaining budget ($50M). Uber tax earns money. Bus and AC both cost money. AC costs scale with weather severity.",
    uberTax: "Tax on every Uber trip. Earns revenue + cuts congestion. Hits wealthy riders ~2–3× harder than the poor — serving as a progressive funding source for bus comfort.",
    busSubsidy: "Bus fare discount. Strongly benefits poor male riders. Reaches women only partially — unsafe buses limit their uptake regardless of price.",
    acLevel: "Bus climate control. Essential for keeping all riders on buses in extreme weather. Funded by progressive Uber taxes.",
  },
};

const DEBRIEF = {
  coreInsight: `Christensen & Osman (2025) found that effects and welfare gains from Uber price changes are substantially larger for women, who are less mobile at baseline and perceive public transit as unsafe. A 50% Uber price reduction increased women's total weekly travel by 849 km — compared to 652 km for men. Women who felt unsafe on buses showed the largest response of all sub-groups.`,
  genderInsight: `The research shows women in Cairo have over twice the price elasticity of men for Uber services. This cuts both ways: cheap Uber is a huge welfare gain for women; expensive Uber (via taxation) strands them. The antidote is not cheaper Uber — it is making buses safe enough that women are willing to use them as an alternative.`,
  incomeInsight: `In Crestwood, Uber taxes serve as a progressive mechanism. Taxing wealthier riders provides the budget needed for high-quality, air-conditioned, and safe bus services for lower-income residents who are currently stranded.`,
  seasonInsight: `"Weathering the Ride" documents that temperature extremes shift bus riders to Uber. For women who already avoid buses due to safety concerns, cold or hot buses compound the barrier — making climate investment doubly important for gender equity.`,
  balanceInsight: `You found the balance: moderate Uber tax funding bus subsidies and AC investment. The gender gap persisted — as it does in Crestwood structurally — but you kept it from widening. The key insight: price policy alone cannot close a gap rooted in safety.`,
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
    ? (tax <= 30 ? tax * 0.12 : tax <= 60 ? 3.6 + (tax - 30) * 0.28 : 12.0 + (tax - 60) * 0.42)
    : (tax <= 30 ? tax * 0.45 : tax <= 60 ? 13.5 + (tax - 30) * 0.85 : 39.0 + (tax - 60) * 1.30);
  // Women still face the safety multiplier, but it's now applied to a progressive base
  return isWomen ? base * 1.50 : base;
}

// How much women actually benefit from bus subsidies, gated by safety investment
function safetyGate(safetyLevel) {
  const sf = safetyLevel / 100;
  const minG = SIMULATION.safety.minBusGainMultiplier; // 0.15
  return minG + (1 - minG) * sf; // 0.15 → 1.0 as safety goes 0 → 100%
}

function simulate(uberTax, busSubsidy, acLevel, roundIndex, budgetRemaining) {
  const safetyLevel = FIXED_SAFETY_LEVEL;
  const { bus, uber, ac, safety, happiness, equity } = SIMULATION;
  const { tempIndex: ti, tempDiscomfort } = getTemp(roundIndex);
  const acMitigation = Math.pow(acLevel / 100, ac.mitigationExponent);

  // ── SEASONAL EFFECTS ──────────────────────────────────────────────────
  const collapseActive = tempDiscomfort > 0.6 && acMitigation < SEASONS.acCollapseThreshold;
  const collapseMulti = collapseActive ? SEASONS.collapseMultiplier : 1.0;
  const busTempPenalty = tempDiscomfort * SEASONS.peakBusMobilityPenalty * (1 - acMitigation) * collapseMulti;
  const baselineTempPenalty = tempDiscomfort * SEASONS.peakBaselineMobilityPenalty;
  const weatherUberBoost = tempDiscomfort * SEASONS.peakUberDemandBoost * (1 - acMitigation * 0.5);

  // Safety gate for women's bus gain
  const womenBusMultiplier = safetyGate(safetyLevel);
  // Safety directly lifts women's accessible baseline mobility
  const safetyBaselineLift = (safetyLevel / 100) * safety.womenBaselineLiftPerPercent * 100;

  // ── GROUP MOBILITY FUNCTION ──────────────────────────────────────────
  function groupMobility(baseMobility, isWomen, isPoor) {
    const loss = uberLoss(uberTax, isWomen, isPoor);
    const mobAfterUber = Math.max(0, baseMobility - loss + (isWomen ? safetyBaselineLift : 0));

    const busGain = isPoor
      ? (isWomen ? bus.poorWomenBaseGain * womenBusMultiplier : bus.poorMenGain)
      : (isWomen ? bus.richWomenBaseGain * womenBusMultiplier : bus.richMenGain);

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

  const poorWomenMob = groupMobility(POP.poorWomenBaseline, true, true);
  const poorMenMob = groupMobility(POP.poorMenBaseline, false, true);
  const richWomenMob = groupMobility(POP.richWomenBaseline, true, false);
  const richMenMob = groupMobility(POP.richMenBaseline, false, false);

  const cityMobility =
    POP.poorWomenFrac * poorWomenMob +
    POP.poorMenFrac * poorMenMob +
    POP.richWomenFrac * richWomenMob +
    POP.richMenFrac * richMenMob;

  const womenMobility = (poorWomenMob + richWomenMob) / 2;
  const menMobility = (poorMenMob + richMenMob) / 2;
  const poorMobility = (poorWomenMob + poorMenMob) / 2;
  const richMobility = (richWomenMob + richMenMob) / 2;

  // ── CONGESTION ───────────────────────────────────────────────────────
  const congestionLevel = Math.min(100, Math.max(5,
    SIMULATION.baseline.congestionLevel
    - uberTax * uber.congestionReductionPerPercent
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
  const uberRevenue = (uberTax / 100) * uber.revenueRate * activity * 300;
  const busCost = (busSubsidy / 100) * bus.costRate * activity * 300;
  const acCost = (acLevel / 100) * ac.costRate * (0.2 + tempDiscomfort * 0.8) * 300;
  const safetyCost = (safetyLevel / 100) * safety.costRate * 300;
  const monthlyDelta = +(uberRevenue - busCost - acCost).toFixed(3);

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
  const poorMenH = groupHappiness(POP.poorMenBaseline, poorMenMob, POP.poorMenHappiness, false);
  const richWomenH = groupHappiness(POP.richWomenBaseline, richWomenMob, POP.richWomenHappiness, true);
  const richMenH = groupHappiness(POP.richMenBaseline, richMenMob, POP.richMenHappiness, false);

  const cityHappiness =
    POP.poorWomenFrac * poorWomenH +
    POP.poorMenFrac * poorMenH +
    POP.richWomenFrac * richWomenH +
    POP.richMenFrac * richMenH;

  const hMobTotal = (
    POP.poorWomenFrac * (poorWomenMob - POP.poorWomenBaseline) +
    POP.poorMenFrac * (poorMenMob - POP.poorMenBaseline) +
    POP.richWomenFrac * (richWomenMob - POP.richWomenBaseline) +
    POP.richMenFrac * (richMenMob - POP.richMenBaseline)
  ) * hw.mobilityWeight;
  const hCongTotal = -(congestionLevel - SIMULATION.baseline.congestionLevel) * hw.congestionWeight;
  const hSafeTotal = (POP.poorWomenFrac + POP.richWomenFrac) * (safetyLevel / 100) * safety.womenHappinessBonusPerPercent * 100 * 0.35;
  const hBudgTotal = -budgetStress * 28 * hw.budgetStressWeight;

  const busIsConstraining = busSubsidy > 0 && (
    (POP.poorMenBaseline - uberLoss(uberTax, false, true)) >= bus.mobilityFlipPoint ||
    (POP.richMenBaseline - uberLoss(uberTax, false, false)) >= bus.mobilityFlipPoint ||
    (POP.poorWomenBaseline - uberLoss(uberTax, true, true)) >= bus.mobilityFlipPoint ||
    (POP.richWomenBaseline - uberLoss(uberTax, true, false)) >= bus.mobilityFlipPoint
  );
  const weatherAlert = tempDiscomfort > 0.6 && acMitigation < 0.35;

  return {
    cityMobility, womenMobility, menMobility, poorMobility, richMobility,
    poorWomenMob, poorMenMob, richWomenMob, richMenMob,
    congestionLevel, genderEquityScore, incomeEquityScore,
    cityHappiness, poorWomenH, poorMenH, richWomenH, richMenH,
    monthlyDelta, uberRevenue, busCost, acCost, safetyCost,
    budgetStress, busIsConstraining, weatherAlert, collapseActive,
    tempDiscomfort, tempIndex: ti, genderGap, incomeGap,
    happinessBreakdown: [
      { label: "Mobility", value: hMobTotal, color: C.blue },
      { label: "Congestion", value: hCongTotal, color: C.amber },
      { label: "Budget", value: hBudgTotal, color: C.red }
    ]
  };
}

// ── FAILURE DIAGNOSIS ──────────────────────────────────────────────────
function diagnoseRun(history, finalBudget) {
  const avgGE = history.reduce((s, m) => s + m.genderEquityScore, 0) / history.length;
  const avgIE = history.reduce((s, m) => s + m.incomeEquityScore, 0) / history.length;
  const avgC = history.reduce((s, m) => s + m.congestionLevel, 0) / history.length;
  const avgH = history.reduce((s, m) => s + m.cityHappiness, 0) / history.length;
  const avgU = history.reduce((s, m) => s + m.uberTax, 0) / history.length;
  const avgB = history.reduce((s, m) => s + m.busSubsidy, 0) / history.length;
  const avgWM = history.reduce((s, m) => s + m.womenMobility, 0) / history.length;
  const avgMM = history.reduce((s, m) => s + m.menMobility, 0) / history.length;
  const budFrac = finalBudget / BUDGET_CONFIG.annualBudget;
  const worstIdx = history.reduce((wi, m, i) => m.cityHappiness < history[wi].cityHappiness ? i : wi, 0);
  const worst = { ...history[worstIdx], idx: worstIdx };
  const failures = [];

  if (avgGE < 50) {
    failures.push({
      icon: "♀️", color: C.rose, bg: C.roseBg, border: C.roseBorder,
      title: "Gender gap remained wide",
      body: `Average gender equity was ${Math.round(avgGE)}. Women's average mobility (${Math.round(avgWM)}) lagged men's (${Math.round(avgMM)}) all year. This reflects Crestwood's structural safety barrier — women avoid buses regardless of price. Bus subsidies reach women only partially. The income gap and seasonal collapse compound this further.`,
      research: "Cairo study: women who perceived buses as unsafe showed the largest response to Uber price changes — 2.93 IHS points increase in utilization for a 50% discount. Price alone cannot fix a safety barrier.",
    });
  }
  if (avgIE < 50) {
    failures.push({
      icon: "⚖️", color: C.purple, bg: C.purpleBg, border: C.purpleBorder,
      title: "Income gap persisted",
      body: `Average income equity was ${Math.round(avgIE)}. In Crestwood, Uber taxes primarily hit the wealthy — but you didn't reinvest enough into the poor. Average bus subsidy was only ${Math.round(avgB)}% — failing to leverage the top-down funding for the bottom-up need.`,
      research: "Progressive urban transport: when luxury services are taxed, the resulting revenue must be aggressively reinvested into public transit to bridge baseline mobility gaps.",
    });
  }
  const extremeMonths = history.filter((_, i) => Math.abs(SEASONS.tempIndex[i]) >= 0.7);
  const collapseMonths = extremeMonths.filter(m => m.acLevel < 15 && m.womenMobility < 32);
  if (collapseMonths.length >= 2) {
    failures.push({
      icon: "🌡️", color: C.amber, bg: C.amberBg, border: C.amberBorder,
      title: "Seasonal collapse hit women hardest",
      body: `In ${collapseMonths.length} extreme weather months, AC was below 15% and women's mobility fell below 32. Cold or hot buses compound Crestwood's existing safety barrier for women — who avoid unsafe buses regardless of price. AC investment reduces the seasonal layer of this compounded barrier.`,
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
      title: "Two cost levers, one income stream",
      body: `Budget ended at $${finalBudget.toFixed(1)}M. You have two cost levers (bus subsidy, AC) against one income source (Uber tax). The key is calibrating both at sustainable levels — not maxing one while starving the other.`,
      research: "Transport subsidy costs scale with ridership. AC costs scale with weather severity. Sustainable policy balances both cost streams against a single tax revenue source.",
    });
  }
  if (failures.length === 0 && avgH < 63) {
    failures.push({
      icon: "😐", color: C.textMuted, bg: C.insetBg, border: C.border,
      title: "Cautious policy across the board",
      body: `No single disaster — but no bold investment either. Average happiness ${Math.round(avgH)}, gender equity ${Math.round(avgGE)}, income equity ${Math.round(avgIE)}. Sweet spot: ~40% Uber tax, ~50% bus subsidy, ~55% AC in extreme months. The gender gap will persist — it's structural — but it can be kept narrow.`,
      research: "Optimal integrated transport policy requires calibrated intervention across all levers. Gender gaps rooted in safety cannot be fully closed through price policy alone.",
    });
  }
  return { failures, worstMonth: MONTHS[worst.idx], worstHappiness: Math.round(worst.cityHappiness) };
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getMonthEndMessage(stats, uberTax, bus, ac, budgetFraction, timedOut, roundIndex) {
  const r = ADVISOR.monthEndReactions;
  if (timedOut) return pickRandom(r.timedOut);
  if (uberTax === 0 && bus === 0 && ac === 0)
    return pickRandom(r.noPolicy);
  if (budgetFraction < BUDGET_CONFIG.warningFraction)
    return pickRandom(r.budgetWarning);
  const ti = SEASONS.tempIndex[roundIndex];
  if (stats.weatherAlert && ti > 0.5) return pickRandom(r.heatNeedingAC);
  if (stats.weatherAlert && ti < -0.5) return pickRandom(r.coldNeedingAC);
  if (stats.busIsConstraining) return pickRandom(r.busConstraining);

  if (stats.genderEquityScore < SIMULATION.thresholds.genderEquity.warning)
    return pickRandom(r.genderGap);
  if (stats.incomeEquityScore < SIMULATION.thresholds.incomeEquity.warning)
    return pickRandom(r.incomeGap);

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

function GaugeBar({ label, value, type, tooltip, extra, breakdown }) {
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
      <div style={{ height: 6, background: C.track, borderRadius: 3, overflow: "hidden", marginBottom: breakdown ? 6 : 0 }}>
        <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, barW))}%`, background: color, borderRadius: 3, transition: "width 0.35s ease, background 0.3s" }} />
      </div>
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
        {cell("Poor\nWomen ♀", poorW, C.rose)}
        {cell("Poor\nMen ♂", poorM, C.amber)}
        {cell("Rich\nWomen ♀", richW, C.purple)}
        {cell("Rich\nMen ♂", richM, C.blue)}
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
        style={{ width: "100%", accentColor: color, cursor: locked ? "not-allowed" : "pointer", touchAction: "none" }} />
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

function BudgetDeltaPreview({ delta, uberRevenue, busCost, acCost }) {
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
  const bg = d > 0.7 ? C.redBg : d > 0.3 ? C.amberBg : C.greenBg;
  const bd = d > 0.7 ? C.redBorder : d > 0.3 ? C.amberBorder : C.greenBorder;
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
    <CityIntroFlow
      slides={CITY_INTRO_SLIDES}
      onComplete={onStart}
      colorTokens={C}
    />
  );
}

function PlanningScreen({ month, roundIndex, uberTax, busSubsidy, acLevel,
  onUberChange, onBusChange, onACChange, onCommit, budgetRemaining }) {
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
            ♀ Gender gap is {Math.round(live.genderGap)} points — women's mobility lags men's due to unsafe buses. This is a structural barrier in Crestwood.
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
          <BudgetDeltaPreview delta={live.monthlyDelta}
            uberRevenue={live.uberRevenue} busCost={live.busCost}
            acCost={live.acCost} />
        </div>

        {/* Live preview */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 9, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Live Preview</div>
          <GaugeBar label="Happiness" value={live.cityHappiness} type="happiness" tooltip={ADVISOR.tooltips.happiness} breakdown={live.happinessBreakdown} />
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

function ResultScreen({ month, roundIndex, stats, uberTax, busSubsidy, acLevel,
  advisorMessage, onNext, history, timedOut, budgetRemaining }) {
  const { cityMobility, womenMobility, menMobility, congestionLevel,
    genderEquityScore, incomeEquityScore, cityHappiness,
    monthlyDelta, uberRevenue, busCost, acCost,
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
          {[[uberTax, C.uberColor, "Uber Tax"], [busSubsidy, C.busColor, "Bus Sub"], [acLevel, C.acColor, "AC"]].map(([v, col, l]) => (
            <div key={l} style={{ flex: 1, minWidth: 60, background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: C.textFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: col }}>{v}%</div>
            </div>
          ))}
          <div style={{ flex: 1.4, minWidth: 80, background: pos ? C.greenBg : C.redBg, border: `1px solid ${pos ? C.greenBorder : C.redBorder}`, borderRadius: 7, padding: "7px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textFaint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Budget Δ</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: pos ? C.green : C.red }}>{pos ? "+" : ""}{monthlyDelta.toFixed(2)}M</div>
            <div style={{ fontSize: 8, color: C.textFaint }}>+{uberRevenue.toFixed(1)} −{busCost.toFixed(1)} −{acCost.toFixed(1)}</div>
          </div>
          {timedOut && <div style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 7, padding: "7px", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 12 }}>⏰</span></div>}
        </div>

        {/* Stat pills */}
        <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
          <StatPill label="Happiness" value={cityHappiness} color={gc(cityHappiness, "happiness")} />
          <StatPill label="Gender Eq." value={genderEquityScore} color={gc(genderEquityScore, "genderEquity")} />
          <StatPill label="Income Eq." value={incomeEquityScore} color={gc(incomeEquityScore, "incomeEquity")} />
          <StatPill label="Congestion" value={congestionLevel} color={gc(congestionLevel, "congestion")} />
          <StatPill label="Budget" value={`$${budgetRemaining.toFixed(1)}M`} color={gc(budgetFraction, "budget")} />
        </div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 9 }}>
          <GaugeBar label="Happiness" value={cityHappiness} type="happiness" tooltip={ADVISOR.tooltips.happiness} breakdown={stats.happinessBreakdown} />
          <GenderGauge womenVal={womenMobility} menVal={menMobility} tooltip={ADVISOR.tooltips.mobility} />
          <GaugeBar label="Gender Equity" value={genderEquityScore} type="genderEquity" tooltip={ADVISOR.tooltips.genderEquity} />
          <GaugeBar label="Income Equity" value={incomeEquityScore} type="incomeEquity" tooltip={ADVISOR.tooltips.incomeEquity} />
          <GaugeBar label="Congestion" value={congestionLevel} type="congestion" tooltip={ADVISOR.tooltips.congestion} />
          <GaugeBar label="Budget" value={budgetFraction} type="budget" tooltip={ADVISOR.tooltips.budget} extra={`/ $${BUDGET_CONFIG.annualBudget}M`} />
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

        {/* Strategic Success Banners */}
        {(acLevel >= 40 && Math.abs(stats.tempIndex) > 0.6 && stats.cityHappiness > 65) && (
          <div style={{ background: C.purpleBg, border: `1px solid ${C.purpleBorder}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 20 }}>❄️</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Strategic Success: Climate</div>
              <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.4 }}>
                Your climate investment is working! High {stats.tempIndex > 0 ? "AC" : "heating"} levels are keeping the bus network viable despite the extreme weather.
              </div>
            </div>
          </div>
        )}

        {((stats.menMobility - stats.womenMobility) < 5 && stats.cityHappiness > 65) && (
          <div style={{ background: C.roseBg, border: `1px solid ${C.roseBorder}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.rose, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Gender Gap Narrowed</div>
              <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.4 }}>
                The mobility gap between women and men is small this month — despite the structural safety barrier. Note: closing this gap fully requires addressing safety at a city level beyond transport policy.
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 18 }}><AdvisorBox message={advisorMessage} /></div>

        <button onClick={onNext} style={{ width: "100%", background: isLast ? C.green : C.rose, color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
          {isLast ? "See Final Score →" : `Next: ${MONTHS[roundIndex + 1]} →`}
        </button>
      </div>
    </div>
  );
}

function YearEndScreen({ history, finalBudget, onRestart, scoreless }) {
  const avgH = history.reduce((s, m) => s + m.cityHappiness, 0) / history.length;
  const avgGE = history.reduce((s, m) => s + m.genderEquityScore, 0) / history.length;
  const avgIE = history.reduce((s, m) => s + m.incomeEquityScore, 0) / history.length;
  const avgC = history.reduce((s, m) => s + m.congestionLevel, 0) / history.length;
  const avgWM = history.reduce((s, m) => s + m.womenMobility, 0) / history.length;
  const avgMM = history.reduce((s, m) => s + m.menMobility, 0) / history.length;
  const budFrac = finalBudget / BUDGET_CONFIG.annualBudget;
  const { weights } = SCORING;
  const rawScore = scoreless ? 0 :
    avgH * weights.happiness +
    avgGE * weights.genderEquity +
    avgIE * weights.incomeEquity +
    budFrac * 100 * weights.budget;
  const finalScore = Math.min(100, Math.round(rawScore));
  const grade = getGrade(scoreless ? 0 : finalScore);
  const { failures, worstMonth, worstHappiness } = diagnoseRun(history, finalBudget);
  const [openIdx, setOpenIdx] = useState(null);

  const chartData = history.map((m, i) => ({
    month: MONTHS[i].slice(0, 3),
    happiness: Math.round(m.cityHappiness),
    genderEquity: Math.round(m.genderEquityScore),
    incomeEquity: Math.round(m.incomeEquityScore),
    women: Math.round(m.womenMobility),
    men: Math.round(m.menMobility),
    delta: +m.monthlyDelta.toFixed(2),
    icon: SEASONS.seasonIcon[i],
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
          <StatPill label="Avg Happiness" value={avgH} color={gc(avgH, "happiness")} />
          <StatPill label="Avg Gender Eq." value={avgGE} color={gc(avgGE, "genderEquity")} />
          <StatPill label="Avg Income Eq." value={avgIE} color={gc(avgIE, "incomeEquity")} />
          <StatPill label="Avg Congestion" value={avgC} color={gc(avgC, "congestion")} />
          <StatPill label="Budget Left" value={`$${finalBudget.toFixed(1)}M`} color={gc(budFrac, "budget")} />
        </div>

        {/* Happiness + Equity chart */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 14px 8px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Happiness, Gender Equity & Income Equity — 12 Months</div>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11 }} />
              <Line type="monotone" dataKey="happiness" stroke={C.green} strokeWidth={2} dot={false} name="Happiness" />
              <Line type="monotone" dataKey="genderEquity" stroke={C.rose} strokeWidth={2} dot={false} name="Gender Equity" />
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
              <Line type="monotone" dataKey="women" stroke={C.rose} strokeWidth={2} dot={false} name="Women" />
              <Line type="monotone" dataKey="men" stroke={C.blue} strokeWidth={2} dot={false} name="Men" />
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
            <thead><tr>{["Month", "Season", "Uber", "Bus", "AC", "BudgetΔ", "Happy", "GndEq", "IncEq"].map(h => (
              <th key={h} style={{ color: C.textMuted, fontWeight: 800, textAlign: "left", paddingBottom: 6, borderBottom: `2px solid ${C.border}`, paddingRight: 5, textTransform: "uppercase", fontSize: 9 }}>{h}</th>
            ))}</tr></thead>
            <tbody>{history.map((m, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ padding: "5px 5px 5px 0", color: C.textSub, fontWeight: 700 }}>{MONTHS[i].slice(0, 3)}</td>
                <td style={{ paddingRight: 5 }}>{SEASONS.seasonIcon[i]}</td>
                <td style={{ color: C.red, fontWeight: 700, paddingRight: 5 }}>{m.uberTax}%</td>
                <td style={{ color: C.blue, fontWeight: 700, paddingRight: 5 }}>{m.busSubsidy}%</td>
                <td style={{ color: C.acColor, fontWeight: 700, paddingRight: 5 }}>{m.acLevel}%</td>
                <td style={{ color: m.monthlyDelta >= 0 ? C.green : C.red, fontWeight: 700, paddingRight: 5 }}>{m.monthlyDelta >= 0 ? "+" : ""}{m.monthlyDelta.toFixed(1)}M</td>
                <td style={{ color: gc(m.cityHappiness, "happiness"), fontWeight: 700, paddingRight: 5 }}>{Math.round(m.cityHappiness)}</td>
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
      stats={result} uberTax={result?.uberTax ?? 0} busSubsidy={result?.busSubsidy ?? 0}
      acLevel={result?.acLevel ?? 0}
      advisorMessage={advisorMsg} onNext={handleNext}
      history={history} timedOut={timedOut} budgetRemaining={budget} />
  );
  if (screen === "yearEnd") return <YearEndScreen history={history} finalBudget={budget} onRestart={handleRestart} scoreless={scoreless} />;
}
