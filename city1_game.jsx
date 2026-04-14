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
  uberColor: "#B91C1C", busColor: "#1B4FD8",
  track: "#E2DDD6", overlay: "rgba(26,23,20,0.78)",
};

// ============================================================
//  BLUEPRINT
// ============================================================
const CITY_META = {
  name: "Smallville",
  subtitle: "Where autonomous vehicles just arrived",
  population: 50000,
  intro: `Smallville has 50,000 people. Autonomous vehicles just flooded the city — Uber prices have crashed, everyone is using them, and congestion is rising. You have a $12M annual budget. Watch the first two months: your Uber tax lever is unavailable until March. Then it's your job to bring things back to normal using two levers — Uber tax (raises revenue, cuts congestion) and bus subsidies (costs money, helps mobility when city is under-mobile).`,
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TIMER = { monthDuration: 20, warningAt: 5, endingDuration: 1200 };

// Non-linear Uber tax: three zones match Cairo research finding that large price
// changes cause sharp mode-switching, while moderate changes barely shift behaviour.
const SIMULATION = {
  baseline: { mobilityScore: 60, congestionLevel: 45, happinessScore: 50 },
  uber: {
    congestionReductionPerPercent: 0.45,
    revenuePerPercent: 0.10,
  },
  bus: {
    mobilityFlipPoint: 50,
    mobilityGainPerPercentBelowFlip: 0.24,
    mobilityLossPerPercentAboveFlip: 0.12,
    congestionOffsetPerPercent: 0.15,
  },
  happiness: {
    mobilityWeight: 0.60,
    congestionWeight: 0.40,
    budgetStressWeight: 0.35,
    min: 0, max: 100,
  },
  thresholds: {
    happiness: { good: 65, warning: 40 },
    congestion: { good: 35, warning: 60 },
    mobility: { good: 65, warning: 45 },
    budget: { safe: 0.50, warning: 0.20 },
  },
  politicalFloor: 30,
  politicalStreakNeeded: 3,
};

const BUDGET_CONFIG = {
  annualBudget: 12.0,
  busCostRate: 0.0016,
  uberRevenueRate: 0.0022,
  warningFraction: 0.20,
  budgetBonusWeight: 0.10,
};

const SCORING = {
  grades: [
    { min: 85, grade: "A+", label: "Urban Utopia", color: C.green },
    { min: 75, grade: "A", label: "Thriving City", color: C.green },
    { min: 65, grade: "B", label: "Good Progress", color: "#3D7A2B" },
    { min: 55, grade: "C", label: "Room to Improve", color: C.amber },
    { min: 45, grade: "D", label: "Citizens Restless", color: "#C05621" },
    { min: 0, grade: "F", label: "City in Gridlock", color: C.red },
  ],
  congestionWarningThreshold: 65,
  mobilityWarningThreshold: 52,
  budgetWarningThreshold: 0.25,
};

const ADVISOR = {
  name: "Maya", title: "Chief Transport Advisor",
  gameIntro: `Hi, I'm Maya. Autonomous vehicles just arrived in Smallville — Uber is cheap, everyone's using it, and congestion is climbing. For January and February you can't tax Uber yet — just watch what happens to congestion. From March, the Uber tax lever is yours: it raises revenue AND cuts congestion. Use that revenue to fund bus subsidies. 20 seconds per month — or hit End Turn.`,
  monthStartHints: [
    "January — autonomous vehicles just arrived. Uber is cheap and roads are packing up. 🚨 Your Uber tax is locked this month — watch the congestion build. Bus subsidies are still available.",
    "February — congestion is still rising unchecked. The Uber tax unlocks next month. Use buses if you want, but the real fix is coming.",
    "March — your Uber tax is now unlocked! Even a modest tax earns revenue AND cuts congestion. This is the moment to start pushing back.",
    "Watch the balance: high Uber tax = good revenue + less congestion, but mobility drops.",
    "Bus subsidies are most effective when mobility is below 50. Above that, fixed routes constrain travel.",
    "Try funding your bus subsidy entirely from Uber tax revenue. Can you break even?",
    "Almost halfway. Is your budget growing, shrinking, or flat?",
    "Mid-year check. Uber tax revenue compounds — consistent policy beats erratic swings.",
    "Research: a 50% Uber price increase shifts riders toward buses, cutting congestion significantly.",
    "Three months left. If budget is healthy, you can afford to ease the Uber tax.",
    "Second to last month. Stick to what's working.",
    "Last month! Finish strong — remaining budget adds to your final score.",
  ],
  monthEndReactions: {
    highHappiness: [
      "Great month! Mobility is strong, congestion is manageable, and the budget held.",
      "Smallville is humming. This is exactly the kind of balanced transport policy we need.",
      "Voters are noticing. Mobility is up and congestion is down — solid decisions.",
      "Outstanding. You've hit the sweet spot of transport logic."
    ],
    highCongestion: [
      "Roads are looking clogged. A slightly higher Uber tax would discourage low-occupancy AV trips.",
      "Traffic is building up. We need to push more people towards shared transport with higher taxes.",
      "The city is grinding to a halt. If we don't tax these AVs, they'll own the roads.",
      "Gridlock. The mobility gains are being eaten by time lost in traffic."
    ],
    lowMobility: [
      "Mobility has dropped. The Uber tax may be too high — you're past the cliff. Ease back or boost bus.",
      "Citizens aren't moving much. Above 60% tax, mobility falls sharply. We need more flow.",
      "The city feels stuck. High taxes without strong bus support leaves people stranded.",
      "People aren't moving enough. Consider lowering the tax or increasing the bus subsidy."
    ],
    busConstraining: [
      "Mobility is above 50 — your bus subsidy is pulling it back down. Fixed routes are limiting people.",
      "Bus subsidies above the mobility threshold constrain travel. Consider reducing bus spend.",
      "People are being pushed onto buses when they'd prefer flexible travel.",
      "Strategic mismatch: the city is already mobile, so high subsidies are actually hurting."
    ],
    budgetWarning: [
      "Budget running thin. Raise the Uber tax to generate revenue — it's your only income stream.",
      "Less than 20% left. Every dollar counts from here on out. Watch the spending.",
      "Tight budget. A modest Uber tax increase could stabilise our reserves.",
      "Our bus subsidies are outpacing our revenue. We need to recalibrate."
    ],
    revenueGain: [
      "Nice — Uber tax revenue exceeded bus costs this month. The city is self-funding.",
      "Budget grew this month. The self-funding model is working as intended.",
      "Positive month for the budget. This surplus gives us breathing room for next month.",
      "We're in the black. The Uber tax is pulling its weight."
    ],
    balanced: [
      "Decent month. City is moving, traffic manageable, budget stable.",
      "Steady policy. It compounds well across the year.",
      "A solid result. No major crises, and the budget is stable.",
      "Consistent hand on the tiller. Everything is in order."
    ],
    noPolicy: [
      "No tax and no subsidy this month. Uber runs unchecked — congestion is high and budget unchanged.",
      "Laissez-faire month. Congestion builds without an Uber tax.",
      "Total deregulation this month. AVs are winning, but the city's health is losing.",
      "Unchecked market forces at work. The roads are suffering."
    ],
    timedOut: [
      "Time ran out. Whatever was on the sliders locked in.",
      "The clock beat you. Quicker decisions next month — or hit End Turn earlier.",
      "Decision time expired. We're running with the existing policy.",
      "The timer hit zero before you could commit. Hopefully, the current rates work."
    ],
  },
  tooltips: {
    happiness: "Overall citizen satisfaction. Goes up with mobility, down with congestion and budget stress. Final score averages this across 12 months.",
    mobility: "How much citizens are moving. Uber tax reduces it — but not linearly. Low tax has little effect; above 60% it causes sharp drops. Bus helps when < 50, hurts when > 50.",
    congestion: "Road congestion. AV arrival boosted it in January–February. Uber tax reduces it (fewer cars). Bus subsidy also reduces it. Research: pricing Uber up shifts riders to shared transport.",
    budget: "Remaining annual budget ($12M). Bus subsidies cost money. Uber tax earns money. Net change each month can be positive or negative.",
    uberTax: "Tax on every Uber/AV trip. Earns revenue + cuts congestion — but non-linearly reduces mobility. Gentle below 30%, steep 30–60%, punishing above 60%. Locked for January and February.",
    busSubsidy: "Discount on bus fares. Costs budget. Boosts mobility when city is under-mobile (<50). Constrains mobility when already mobile (>50). Always reduces congestion.",
  },
};

const DEBRIEF = {
  coreInsight: "Economists Christensen & Osman (Cairo, 2025) found that a 50% Uber price cut increased total mobility ~49.5% but raised low-occupancy vehicle trips ~60% and congestion ~20%. Critically the effect is non-linear — moderate price changes shift behaviour little, but large changes cause sharp mode-switching. This is why low tax felt gentle and high tax felt brutal.",
  congestionInsight: "High Uber usage pushed external costs up. In Cairo, a 50% Uber price drop would increase congestion, emissions and accident costs by ~0.7% of the city's GDP. Pricing Uber up is one of the few levers that simultaneously cuts congestion and raises public revenue.",
  mobilityInsight: "Heavy Uber tax without a strong bus alternative leaves people stranded. Research shows enormous latent demand — welfare gains from a 50% Uber price cut equalled ~17% of the average Cairo participant's monthly income. Tax too hard, and that welfare disappears.",
  balanceInsight: "You found the balance: moderate Uber tax funding a meaningful bus subsidy. This is the real-world policy prescription — use ride-hailing taxes to cross-subsidize public transport.",
  budgetInsight: "Uber tax revenue compounds across the year. Consistent modest taxation is more sustainable than lurching between high and low rates.",
  city2Teaser: "In City 2 — Riverdale — the seasons change everything. Heatwaves and cold snaps drive people off buses and into Ubers. Bus climate control becomes your critical lever.",
  source: `Christensen & Osman (2025) "Demand for Mobility" · Christensen & Osman (2023) "Weathering the Ride"`,
};

const CITY_INTRO_SLIDES = [
  {
    icon: "🏙️",
    label: "City 1: Smallville",
    title: "The Autonomous Arrival",
    text: "Smallville is a quiet city of 50,000 residents. However, things are changing as autonomous vehicles flood our streets and ride-hailing prices drop day by day. The city is on the brink of chaos.",
  },
  {
    icon: "🚦",
    label: "The Challenge",
    title: "Rising Congestion",
    text: "With Uber cheaper than ever, people are ditching public transit. Congestion is climbing fast. You have a $12M annual budget to maintain order.",
  },
  {
    icon: "🔒",
    label: "Strategic Briefing",
    title: "Rules of Engagement",
    text: "Your Uber tax lever is LOCKED for January and February. Watch the impact of unregulated AVs, then take full control in March.",
    bullets: [
      { icon: "💰", text: "Uber Tax earns revenue & cuts congestion" },
      { icon: "🚌", text: "Bus Subsidies help mobility increase while balancing congestion" },
      { icon: "⚖️", text: "Balance budget, mobility, and happiness" }
    ],
    buttonText: "Take Office",
    primary: true
  }
];

// ============================================================
//  SIMULATION ENGINE
// ============================================================

// Linear Uber mobility loss
function uberMobilityLoss(tax) {
  return tax * 0.40;
}

// roundIndex is used to apply the AV congestion boost in January and February
function simulate(uberTax, busSubsidy, budgetRemaining, roundIndex = 12) {
  const { baseline, uber, bus, happiness } = SIMULATION;

  // 1. Mobility — linear Uber loss, bus flip mechanic
  const uberLoss = uberMobilityLoss(uberTax);
  const mobilityBeforeBus = baseline.mobilityScore - uberLoss;
  const busEffect = mobilityBeforeBus < bus.mobilityFlipPoint
    ? busSubsidy * bus.mobilityGainPerPercentBelowFlip
    : busSubsidy * -bus.mobilityLossPerPercentAboveFlip;
  const mobilityScore = Math.min(100, Math.max(0, mobilityBeforeBus + busEffect));

  // 2. Congestion — AV boost for first two months (January, February)
  //    AVs arrived, prices crashed → extra cars on the road
  const avBoost = roundIndex < 2 ? 15 : 0;
  const congestionLevel = Math.min(100, Math.max(5,
    baseline.congestionLevel + avBoost
    - uberTax * uber.congestionReductionPerPercent
    - busSubsidy * bus.congestionOffsetPerPercent
  ));

  // 3. Budget delta
  const activity = (mobilityScore + congestionLevel) / 2;
  const uberRevenue = (uberTax / 100) * BUDGET_CONFIG.uberRevenueRate * activity * 100;
  const busCost = (busSubsidy / 100) * BUDGET_CONFIG.busCostRate * activity * 100;
  const monthlyDelta = +(uberRevenue - busCost).toFixed(3);

  // 4. Budget stress
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const budgetStress = budgetFraction > 0.5 ? 0 : (0.5 - budgetFraction) / 0.5;

  // 5. Happiness
  const mobilityGain = mobilityScore - baseline.mobilityScore;
  const congestionPain = congestionLevel - baseline.congestionLevel;
  const happinessScore = Math.min(happiness.max, Math.max(happiness.min,
    baseline.happinessScore
    + mobilityGain * happiness.mobilityWeight
    - congestionPain * happiness.congestionWeight
    - budgetStress * 25 * happiness.budgetStressWeight
  ));

  const busIsConstraining = mobilityBeforeBus >= bus.mobilityFlipPoint && busSubsidy > 0;
  const revenuePositive = monthlyDelta > 0;
  const taxZone = uberTax <= 30 ? "gentle" : uberTax <= 60 ? "steep" : "cliff";

  const hMob = mobilityGain * happiness.mobilityWeight;
  const hCong = -congestionPain * happiness.congestionWeight;
  const hBudg = -budgetStress * 25 * happiness.budgetStressWeight;

  return {
    mobilityScore, congestionLevel, happinessScore, monthlyDelta, uberRevenue, busCost, budgetStress,
    busIsConstraining, revenuePositive, taxZone,
    mobilityBreakdown: [
      { label: "Bus Boost", value: busEffect, color: C.green },
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
  // Only look at months 2-11 for policy failure (months 0-1 had forced 0% uber)
  const policyMonths = history.slice(2);
  const avgM = history.reduce((s, m) => s + m.mobilityScore, 0) / history.length;
  const avgC = history.reduce((s, m) => s + m.congestionLevel, 0) / history.length;
  const avgU = policyMonths.length > 0 ? policyMonths.reduce((s, m) => s + m.uberTax, 0) / policyMonths.length : 0;
  const avgB = history.reduce((s, m) => s + m.busSubsidy, 0) / history.length;
  const avgH = history.reduce((s, m) => s + m.happinessScore, 0) / history.length;
  const budFrac = finalBudget / BUDGET_CONFIG.annualBudget;
  const worstIdx = history.reduce((wi, m, i) => m.happinessScore < history[wi].happinessScore ? i : wi, 0);
  const worst = { ...history[worstIdx], idx: worstIdx };
  const failures = [];

  if (avgM < 45 && avgU > 55) {
    failures.push({
      icon: "🚕", color: C.red, bg: C.redBg, border: C.redBorder,
      title: "Uber tax crushed mobility",
      body: `Your average Uber tax (from March onwards) was ${Math.round(avgU)}% — well past the 60% cliff where mobility drops sharply. Worst month: ${MONTHS[worst.idx]} (happiness ${Math.round(worst.happinessScore)}). The fix: stay in the 30–50% sweet spot to earn revenue without triggering the cliff.`,
      research: "Cairo study: moderate price changes have little mobility effect. Large changes cause sharp substitution — the non-linear zone you hit.",
    });
  }
  if (avgC > 65 && avgU < 25) {
    failures.push({
      icon: "🚗", color: C.amber, bg: C.amberBg, border: C.amberBorder,
      title: "Congestion went unchecked",
      body: `Average congestion was ${Math.round(avgC)} with an Uber tax of only ${Math.round(avgU)}% from March. Even a 25–35% tax would have cleared congestion AND earned revenue. Worst month: ${MONTHS[worst.idx]}.`,
      research: "Cairo equilibrium model: market-level Uber price reduction raises external costs by ~0.7% of city GDP. Low tax on even a small city compounds quickly.",
    });
  }
  if (budFrac < 0.15 && avgB > 55) {
    failures.push({
      icon: "🚌", color: C.blue, bg: C.blueBg, border: C.blueBorder,
      title: "Bus subsidies drained the treasury",
      body: `Average bus subsidy was ${Math.round(avgB)}% — too high for your tax revenue. Budget ended at $${finalBudget.toFixed(1)}M. Bus subsidies always cost money; above the mobility flip they cost money AND reduce mobility.`,
      research: "Transport subsidies scale with ridership. Cheaper rides attract more riders, raising the total bill. Calibrate bus spend against Uber tax revenue.",
    });
  }
  if (failures.length === 0 && avgH < 63) {
    failures.push({
      icon: "😐", color: C.textMuted, bg: C.insetBg, border: C.border,
      title: "Cautious policy, cautious results",
      body: `No single disaster — but no bold reinvestment either. Average happiness ${Math.round(avgH)}. The sweet spot: ~40% Uber tax funding ~50% bus subsidy. You stayed too conservative to find it.`,
      research: "Optimal transport policy requires calibrated intervention. Moderate everything is not the same as balanced.",
    });
  }
  return { failures, worstMonth: MONTHS[worst.idx], worstHappiness: Math.round(worst.happinessScore) };
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getMonthEndMessage(stats, uberTax, bus, budgetFraction, timedOut) {
  const r = ADVISOR.monthEndReactions;
  if (timedOut) return pickRandom(r.timedOut);
  if (uberTax === 0 && bus === 0) return pickRandom(r.noPolicy);
  if (budgetFraction < BUDGET_CONFIG.warningFraction) return pickRandom(r.budgetWarning);
  
  if (stats.busIsConstraining && bus > 40) return pickRandom(r.busConstraining);
  
  const t = SIMULATION.thresholds;
  if (stats.happinessScore >= t.happiness.good) return pickRandom(r.highHappiness);
  if (stats.congestionLevel >= t.congestion.warning) return pickRandom(r.highCongestion);
  if (stats.mobilityScore <= t.mobility.warning) return pickRandom(r.lowMobility);
  if (stats.revenuePositive) return pickRandom(r.revenueGain);
  
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
        style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: "50%", width: 16, height: 16, cursor: "pointer", color: C.textMuted, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>i</button>
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
    <div style={{ marginBottom: 16 }}>
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

function BusModeBadge({ mobilityBeforeBus, busSubsidy }) {
  if (busSubsidy === 0) return null;
  const boosting = mobilityBeforeBus < SIMULATION.bus.mobilityFlipPoint;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: boosting ? C.greenBg : C.redBg, border: `1px solid ${boosting ? C.greenBorder : C.redBorder}`, borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: boosting ? C.green : C.red, marginBottom: 5 }}>
      {boosting ? "🟢 Boosting mobility" : "🔴 Constraining mobility"}
    </div>
  );
}

function SliderInput({ label, value, onChange, color, tooltip, locked, tag, badge, hint }) {
  return (
    <div style={{ marginBottom: 20, opacity: locked ? 0.5 : 1, transition: "opacity 0.3s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
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
  if (tax <= 30) return null;
  const steep = tax <= 60;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: steep ? C.amberBg : C.redBg, border: `1px solid ${steep ? C.amberBorder : C.redBorder}`, borderRadius: 6, padding: "4px 9px", fontSize: 10, fontWeight: 700, color: steep ? C.amber : C.red, marginTop: 4 }}>
      {steep ? "⚠️ Steep zone — mobility dropping noticeably" : "🔴 Cliff — mobility falling sharply past 60%"}
    </div>
  );
}

function BudgetDeltaPreview({ delta }) {
  const pos = delta >= 0;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: pos ? C.greenBg : C.redBg, border: `1px solid ${pos ? C.greenBorder : C.redBorder}`, borderRadius: 8, padding: "9px 13px", marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>Estimated budget change</span>
      <span style={{ fontSize: 18, fontWeight: 800, color: pos ? C.green : C.red }}>{pos ? "+" : ""}{delta.toFixed(2)}M</span>
    </div>
  );
}

function AdvisorBox({ message }) {
  return (
    <div style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 10, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ fontSize: 20 }}>🧑‍💼</span>
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, color: C.blue, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>Maya · Chief Transport Advisor</div>
        <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6 }}>{message}</div>
      </div>
    </div>
  );
}

function CountdownRing({ timeLeft, total }) {
  const pct = timeLeft / total;
  const r = 20, circ = 2 * Math.PI * r;
  const warn = timeLeft <= TIMER.warningAt && timeLeft > 0;
  const col = warn ? C.red : C.blue;
  return (
    <div style={{ position: "relative", width: 52, height: 52 }}>
      <svg width="52" height="52" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="26" cy="26" r={r} fill="none" stroke={C.track} strokeWidth="4" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={col} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: warn ? C.red : C.text }}>{timeLeft}</span>
    </div>
  );
}

function MonthEndingOverlay({ month }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: C.overlay, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia,serif" }}>
      <style>{`@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes dot{0%,100%{opacity:0.15}50%{opacity:1}}`}</style>
      <div style={{ textAlign: "center", animation: "slideUp 0.3s ease" }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>⏰</div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: C.blue, textTransform: "uppercase", marginBottom: 8 }}>Month Locked</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>{month} Ending...</div>
        <div style={{ marginTop: 16, display: "flex", gap: 6, justifyContent: "center" }}>
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
        <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.7, marginBottom: 10 }}>Citizens lost confidence after <strong>3 consecutive months</strong> of happiness below 30. Smallville needs a new Transport Director.</p>
        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 20 }}>Removed in <strong>{month}</strong>. Sustained low happiness signals policy failure — not just a bad month.</p>
        <div style={{ marginBottom: 22 }}><AdvisorBox message="Three consecutive months of deep unhappiness is a political signal, not just a number. Check whether the Uber tax was too high without bus compensation." /></div>
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
        <h2 style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: "0 0 8px" }}>Smallville Bankrupt</h2>
        <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.7, marginBottom: 22 }}>
          The city ran out of funds in <strong>{month}</strong>. Bus subsidies outpaced Uber tax revenue.
        </p>
        <div style={{ marginBottom: 22 }}><AdvisorBox message="Heavy bus subsidies without enough Uber tax revenue drained the budget. Try raising the Uber tax — it's your income stream. Use that revenue to fund buses." /></div>
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

function computeWarnings(uberTax, busSubsidy, live, budgetFraction) {
  const w = [];
  if (uberTax > 60) w.push("Tax above 60% — mobility drops sharply (cliff zone).");
  if (uberTax > 30 && uberTax <= 60) w.push("Tax in steep zone (30–60%) — women and poor riders absorb more of the hit.");
  if (live.monthlyDelta < -0.3 && budgetFraction < 0.35) w.push("Costs exceed revenue — budget is draining.");
  if (busSubsidy > 60 && live.mobilityScore > 60) w.push("High subsidy with high mobility — buses may be constraining, not helping.");
  return w;
}

function generateChangeSummary(stats, prevStats, uberTax, busSubsidy) {
  const lines = [];
  if (uberTax > 0) {
    if (uberTax > 60) lines.push({ icon: "💰", text: `Uber tax at ${uberTax}% raised revenue but pushed mobility into cliff-zone drop.` });
    else if (uberTax > 30) lines.push({ icon: "💰", text: `Uber tax at ${uberTax}% generated revenue with a moderate mobility cost.` });
    else lines.push({ icon: "💰", text: `Low Uber tax (${uberTax}%) had minimal effect on mobility and moderate revenue.` });
  }
  if (busSubsidy > 0) {
    if (stats.busIsConstraining) lines.push({ icon: "🚌", text: `Bus subsidy (${busSubsidy}%) hit the ridership ceiling — spending budget without adding mobility.` });
    else lines.push({ icon: "🚌", text: `Bus subsidy (${busSubsidy}%) supported mobility and reduced congestion.` });
  }
  if (stats.monthlyDelta < 0) lines.push({ icon: "📉", text: `Budget fell by $${Math.abs(stats.monthlyDelta).toFixed(1)}M — costs outpaced Uber revenue.` });
  else lines.push({ icon: "📈", text: `Budget grew by $${stats.monthlyDelta.toFixed(1)}M — revenue covered costs.` });
  if (prevStats) {
    const happyDelta = Math.round(stats.happinessScore) - Math.round(prevStats.happinessScore);
    if (Math.abs(happyDelta) >= 4) lines.push({ icon: happyDelta > 0 ? "😊" : "😟", text: `Happiness ${happyDelta > 0 ? "rose" : "fell"} ${Math.abs(happyDelta)} pts vs last month.` });
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

function PlanningScreen({ month, roundIndex, uberTax, busSubsidy, onUberChange, onBusChange, onCommit, budgetRemaining }) {
  const [timeLeft, setTimeLeft] = useState(TIMER.monthDuration);
  const [locked, setLocked] = useState(false);
  const [ending, setEnding] = useState(false);
  const uberRef = useRef(uberTax);
  const busRef = useRef(busSubsidy);
  const lockedRef = useRef(false);
  useEffect(() => { uberRef.current = uberTax; }, [uberTax]);
  useEffect(() => { busRef.current = busSubsidy; }, [busSubsidy]);

  // Uber is locked for the first two months (January, February)
  const uberLocked = roundIndex < 2;

  const commitMonth = useCallback((wasTimedOut) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true); setEnding(true);
    setTimeout(() => onCommit(uberRef.current, busRef.current, wasTimedOut), TIMER.endingDuration);
  }, [onCommit]);

  useEffect(() => {
    setTimeLeft(TIMER.monthDuration); setLocked(false); setEnding(false); lockedRef.current = false;
    const iv = setInterval(() => {
      setTimeLeft(prev => { if (prev <= 1) { clearInterval(iv); commitMonth(true); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(iv);
  }, [roundIndex]);

  const live = simulate(uberTax, busSubsidy, budgetRemaining, roundIndex);
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const warn = timeLeft <= TIMER.warningAt && timeLeft > 0;
  const uberLoss = uberMobilityLoss(uberTax);
  const mobilityB4Bus = SIMULATION.baseline.mobilityScore - uberLoss;

  const budgetColor = gc(budgetFraction, "budget");
  const warnings = computeWarnings(uberTax, busSubsidy, live, budgetFraction);

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
        flexShrink: 0, display: "flex", alignItems: "center", gap: 14,
        padding: "8px 16px", background: C.cardBg,
        borderBottom: `1px solid ${C.border}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}>
        <div style={{ minWidth: 110 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: C.blue, textTransform: "uppercase", fontWeight: 800 }}>City 1 · {CITY_META.name}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>{month}</div>
        </div>
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
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Set Policy {locked && <span style={{ color: C.red }}>🔒</span>}
          </div>

          {uberLocked && (
            <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 9, padding: "10px 12px", marginBottom: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>🚗</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.red, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Uber Tax Locked until March</div>
                <div style={{ fontSize: 11, color: C.textSub, lineHeight: 1.5 }}>AVs just flooded the city — watch the road fill up. Your Uber tax lever unlocks in March.</div>
              </div>
            </div>
          )}

          <SliderInput
            label="Uber / AV Tax" value={uberTax} onChange={onUberChange} color={C.uberColor}
            tooltip={ADVISOR.tooltips.uberTax} locked={locked || uberLocked}
            tag={uberLocked
              ? { text: "🔒 unlocks March", bg: C.redBg, color: C.red, border: C.redBorder }
              : { text: "earns $", bg: C.greenBg, color: C.green, border: C.greenBorder }}
            badge={!uberLocked && <TaxZoneWarning tax={uberTax} />}
            hint="Raises revenue · lowers congestion · high levels suppress mobility"
          />
          <SliderInput
            label="Bus Fare Subsidy" value={busSubsidy} onChange={onBusChange} color={C.busColor}
            tooltip={ADVISOR.tooltips.busSubsidy} locked={locked}
            tag={{ text: "costs $", bg: C.redBg, color: C.red, border: C.redBorder }}
            badge={<BusModeBadge mobilityBeforeBus={mobilityB4Bus} busSubsidy={busSubsidy} />}
            hint="Boosts mobility when city is under-served · less effective above mobility 65"
          />
          <BudgetDeltaPreview delta={live.monthlyDelta} />

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
            cityLevel={1}
            uberTax={uberTax}
            busSubsidy={busSubsidy}
            congestion={live.congestionLevel}
          />
          {/* Advisor strip at bottom of scene */}
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
          <GaugeBar label="Budget" value={budgetFraction} type="budget" tooltip={ADVISOR.tooltips.budget} target="Safe zone: above $2.4M" />
          <div style={{ fontSize: 10, color: C.textFaint, marginTop: 4 }}>
            +${live.uberRevenue.toFixed(2)} tax &nbsp;−${live.busCost.toFixed(2)} bus
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ month, roundIndex, stats, uberTax, busSubsidy, advisorMessage, onNext, history, timedOut, budgetRemaining }) {
  const prevStats = history.length >= 2 ? history[history.length - 2] : null;
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const chartData = history.map((m, i) => ({
    name: MONTHS[i].slice(0, 3),
    delta: m.monthlyDelta,
    happiness: Math.round(m.happinessScore),
  }));

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: "Georgia,serif", padding: "16px" }}>
      <div style={{ maxWidth: 580, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 3, color: C.green, textTransform: "uppercase", fontWeight: 800 }}>Month Complete</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: "3px 0 0" }}>{month} Results</h2>
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.textMuted }}>{roundIndex + 1}/12</span>
        </div>

        {/* Policy summary */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 9, padding: "11px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.red, textTransform: "uppercase", letterSpacing: 1, fontWeight: 800 }}>Uber Tax</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.uberColor }}>{uberTax}%</div>
            {roundIndex < 2 && <div style={{ fontSize: 9, color: C.textFaint }}>locked this month</div>}
          </div>
          <div style={{ flex: 1, background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 9, padding: "11px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.blue, textTransform: "uppercase", letterSpacing: 1, fontWeight: 800 }}>Bus Subsidy</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.busColor }}>{busSubsidy}%</div>
          </div>
          <div style={{ flex: 1.3, background: stats.monthlyDelta >= 0 ? C.greenBg : C.redBg, border: `1px solid ${stats.monthlyDelta >= 0 ? C.greenBorder : C.redBorder}`, borderRadius: 9, padding: "11px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 800 }}>Budget Δ</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: stats.monthlyDelta >= 0 ? C.green : C.red }}>{stats.monthlyDelta >= 0 ? "+" : ""}{stats.monthlyDelta.toFixed(2)}M</div>
            <div style={{ fontSize: 10, color: C.textFaint }}>+${stats.uberRevenue.toFixed(2)} tax / −${stats.busCost.toFixed(2)} bus</div>
          </div>
        </div>

        {/* Stats gauges with breakdown */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <GaugeBar
            label="Happiness"
            value={stats.happinessScore}
            type="happiness"
            tooltip={ADVISOR.tooltips.happiness}
            breakdown={stats.happinessBreakdown}
            target="Goal: 65+"
            prev={prevStats?.happinessScore ?? null}
          />
          <GaugeBar
            label="Mobility"
            value={stats.mobilityScore}
            type="mobility"
            tooltip={ADVISOR.tooltips.mobility}
            breakdown={stats.mobilityBreakdown}
            target="Target: 55–75"
            prev={prevStats?.mobilityScore ?? null}
          />
          <GaugeBar
            label="Congestion"
            value={stats.congestionLevel}
            type="congestion"
            tooltip={ADVISOR.tooltips.congestion}
            target="Goal: under 40"
            prev={prevStats?.congestionLevel ?? null}
          />
          <GaugeBar
            label="Budget Remaining"
            value={budgetFraction}
            type="budget"
            tooltip={ADVISOR.tooltips.budget}
            extra={`/ $${BUDGET_CONFIG.annualBudget}M`}
            target="Safe zone: above $2.4M"
          />
        </div>

        {timedOut && (
          <div style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: C.amber, fontWeight: 700, marginBottom: 12 }}>
            ⏰ Time ran out — policy locked automatically
          </div>
        )}

        <div style={{ marginBottom: 14 }}><AdvisorBox message={advisorMessage} /></div>

        {/* Why this changed */}
        {(() => {
          const lines = generateChangeSummary(stats, prevStats, uberTax, busSubsidy);
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

        {/* Budget chart */}
        {history.length > 1 && (
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Monthly Budget Δ</div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: C.textFaint }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: C.textFaint }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11 }} formatter={v => [`${v >= 0 ? "+" : ""}${v.toFixed(2)}M`, "Δ"]} />
                <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
                  {chartData.map((e, i) => <Cell key={i} fill={e.delta >= 0 ? C.green : C.red} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
              {[[C.green, "Tax earned more"], [C.red, "Bus cost more"]].map(([col, lbl]) => (
                <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textMuted }}><div style={{ width: 10, height: 10, borderRadius: 2, background: col }} />{lbl}</div>
              ))}
            </div>
          </div>
        )}

        {/* YTD */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 9, padding: "11px 15px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>Year-to-date average happiness</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: gc(history.reduce((s, m) => s + m.happinessScore, 0) / history.length, "happiness") }}>
            {Math.round(history.reduce((s, m) => s + m.happinessScore, 0) / history.length)}<span style={{ fontSize: 12, color: C.textFaint }}>/100</span>
          </span>
        </div>

        <button onClick={onNext} style={{ width: "100%", background: C.blue, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
          {roundIndex === 11 ? "See Year Results →" : `Next: ${MONTHS[roundIndex + 1]} →`}
        </button>
      </div>
    </div>
  );
}

function YearEndScreen({ history, finalBudget, onRestart, scoreless }) {
  const avgH = history.reduce((s, m) => s + m.happinessScore, 0) / history.length;
  const avgM = history.reduce((s, m) => s + m.mobilityScore, 0) / history.length;
  const avgC = history.reduce((s, m) => s + m.congestionLevel, 0) / history.length;
  const budFrac = finalBudget / BUDGET_CONFIG.annualBudget;
  const bonus = scoreless ? 0 : Math.max(0, budFrac * 100 * BUDGET_CONFIG.budgetBonusWeight);
  const rawScore = avgH + bonus;
  const finalScore = Math.min(100, Math.round(rawScore));
  const grade = getGrade(finalScore);
  const { failures, worstMonth, worstHappiness } = diagnoseRun(history, finalBudget);
  const chartData = history.map((m, i) => ({ name: MONTHS[i].slice(0, 3), happiness: Math.round(m.happinessScore), delta: m.monthlyDelta }));
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: "Georgia,serif", padding: "16px" }}>
      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: C.blue, textTransform: "uppercase", fontWeight: 800, marginBottom: 8 }}>Year Complete · Smallville</div>
          {!scoreless && <>
            <div style={{ fontSize: 90, fontWeight: 800, color: grade.color, lineHeight: 1 }}>{grade.grade}</div>
            <div style={{ fontSize: 18, color: C.textSub, fontWeight: 600 }}>{grade.label}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Score: {finalScore} = happiness {Math.round(avgH)} + budget bonus {Math.round(bonus)}</div>
          </>}
          {scoreless && <div style={{ fontSize: 18, color: C.textMuted }}>Year complete — no score (continued after failure)</div>}
        </div>

        {/* Summary stats */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {[["Avg Happiness", Math.round(avgH), "happiness"], ["Avg Mobility", Math.round(avgM), "mobility"], ["Avg Congestion", Math.round(avgC), "congestion"]].map(([l, v, t]) => (
            <div key={l} style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: 9, color: C.textFaint, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: gc(v, t) }}>{v}</div>
            </div>
          ))}
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 9, color: C.textFaint, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Budget Left</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: gc(budFrac, "budget") }}>${finalBudget.toFixed(1)}M</div>
          </div>
        </div>

        {/* Happiness chart */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Happiness Across the Year</div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: C.textFaint }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11 }} formatter={v => [v, "Happiness"]} />
              <Bar dataKey="happiness" radius={[3, 3, 0, 0]}>
                {chartData.map((e, i) => <Cell key={i} fill={gc(e.happiness, "happiness")} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Failure diagnosis */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
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
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)", overflowX: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Monthly Policy Log</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>{["Month", "Uber Tax", "Bus %", "Budget Δ", "Happiness", "Mobility", "Congestion"].map(h => (
              <th key={h} style={{ color: C.textMuted, fontWeight: 800, textAlign: "left", paddingBottom: 8, borderBottom: `2px solid ${C.border}`, paddingRight: 10, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
            ))}</tr></thead>
            <tbody>{history.map((m, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ padding: "6px 10px 6px 0", color: C.textSub, fontWeight: 700 }}>{MONTHS[i].slice(0, 3)}</td>
                <td style={{ color: i < 2 ? C.textFaint : C.red, fontWeight: 800, paddingRight: 10 }}>{i < 2 ? "🔒" : `${m.uberTax}%`}</td>
                <td style={{ color: C.blue, fontWeight: 800, paddingRight: 10 }}>{m.busSubsidy}%</td>
                <td style={{ color: m.monthlyDelta >= 0 ? C.green : C.red, fontWeight: 800, paddingRight: 10 }}>{m.monthlyDelta >= 0 ? "+" : ""}{m.monthlyDelta.toFixed(2)}M</td>
                <td style={{ color: gc(m.happinessScore, "happiness"), fontWeight: 700, paddingRight: 10 }}>{Math.round(m.happinessScore)}</td>
                <td style={{ color: gc(m.mobilityScore, "mobility"), paddingRight: 10 }}>{Math.round(m.mobilityScore)}</td>
                <td style={{ color: gc(m.congestionLevel, "congestion") }}>{Math.round(m.congestionLevel)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        {/* Research debrief */}
        <div style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 12, padding: "18px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: C.blue, textTransform: "uppercase", marginBottom: 14, fontWeight: 800 }}>📖 What the Research Says</div>
          <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8, margin: "0 0 12px" }}>{DEBRIEF.coreInsight}</p>
          {avgC > 65 && <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8, borderLeft: `3px solid ${C.red}`, paddingLeft: 12, margin: "0 0 12px" }}>{DEBRIEF.congestionInsight}</p>}
          {avgM < 52 && <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8, borderLeft: `3px solid ${C.amber}`, paddingLeft: 12, margin: "0 0 12px" }}>{DEBRIEF.mobilityInsight}</p>}
          {finalBudget / BUDGET_CONFIG.annualBudget < 0.15 && <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8, borderLeft: `3px solid ${C.amber}`, paddingLeft: 12, margin: "0 0 12px" }}>{DEBRIEF.budgetInsight}</p>}
          {avgC <= 65 && avgM >= 52 && finalBudget / BUDGET_CONFIG.annualBudget >= 0.15 && <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8, borderLeft: `3px solid ${C.green}`, paddingLeft: 12, margin: "0 0 12px" }}>{DEBRIEF.balanceInsight}</p>}
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginTop: 12 }}>
            <div style={{ fontSize: 11, color: C.blue, marginBottom: 5, fontWeight: 800 }}>🏙️ Up Next: City 2 — Riverdale</div>
            <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>{DEBRIEF.city2Teaser}</div>
          </div>
          <div style={{ fontSize: 10, color: C.textFaint, marginTop: 12 }}>{DEBRIEF.source}</div>
        </div>

        <button onClick={onRestart} style={{ width: "100%", background: C.cardBg, color: C.textSub, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>↺ Play Again</button>
      </div>
    </div>
  );
}

// ============================================================
//  MAIN GAME CONTROLLER
// ============================================================
export default function TransportTycoon() {
  const [screen, setScreen] = useState("intro");
  const [roundIndex, setRound] = useState(0);
  const [uberTax, setUber] = useState(0);
  const [busSubsidy, setBus] = useState(0);
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [advisorMsg, setMsg] = useState("");
  const [timedOut, setTO] = useState(false);
  const [budget, setBudget] = useState(BUDGET_CONFIG.annualBudget);
  const [scoreless, setSL] = useState(false);
  const [gameOverMonth, setGOM] = useState("");
  const [polMonth, setPolMonth] = useState("");

  const handleCommit = useCallback((uberVal, busVal, wasTimedOut) => {
    setBudget(prev => {
      const stats = simulate(uberVal, busVal, prev, roundIndex);
      const newBudget = +(prev + stats.monthlyDelta).toFixed(3);
      const msg = getMonthEndMessage(stats, uberVal, busVal, Math.max(0, newBudget) / BUDGET_CONFIG.annualBudget, wasTimedOut);
      const record = { ...stats, uberTax: uberVal, busSubsidy: busVal };
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
    setScreen("intro"); setRound(0); setUber(0); setBus(0);
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
