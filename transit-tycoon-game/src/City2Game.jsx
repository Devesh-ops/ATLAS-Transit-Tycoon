import { useState, useCallback, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";

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

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const TIMER = { monthDuration: 25, warningAt: 6, endingDuration: 1200 };

const SEASONS = {
  tempIndex:   [-1.0, -0.7, -0.3, 0.0, 0.4, 0.8, 1.0, 0.8, 0.4, 0.0, -0.4, -0.8],
  seasonLabel: ["Deep Winter","Late Winter","Early Spring","Spring","Late Spring","Early Summer","Peak Summer","Late Summer","Early Autumn","Autumn","Late Autumn","Early Winter"],
  seasonIcon:  ["🥶","🥶","🌱","🌿","☀️","🌡️","🔥","🌡️","🍂","🍂","🌧️","❄️"],
  peakBusMobilityPenalty:     18,
  peakUberDemandBoost:         8,
  peakBaselineMobilityPenalty: 5,
};

const SIMULATION = {
  baseline: {
    poorMobility:    55,   // higher than City 1 — bigger city, more latent activity
    richMobility:    70,
    congestionLevel: 50,   // bigger city = higher baseline congestion
    poorHappiness:   45,
    richHappiness:   60,
  },
  // UBER TAX: higher tax = less Uber rides = less mobility (especially poor), less congestion, more revenue
  uber: {
    poorMobilityLossPerPercent:  0.50,  // poor rely on Uber more → hit harder by tax
    richMobilityLossPerPercent:  0.12,  // rich have cars / alternatives
    congestionReductionPerPercent: 0.50,
    revenueRate: 0.0020,                // scales with city activity
  },
  bus: {
    poorMobilityGain:  0.30,
    richMobilityGain:  0.08,
    congestionOffsetPerPercent: 0.18,
    costRate: 0.0014,
  },
  ac: {
    mitigationExponent:         0.7,
    poorComfortBonusPerPercent: 0.12,
    richComfortBonusPerPercent: 0.03,
    costRate:                   0.0018,
  },
  happiness: {
    poor: { mobilityWeight: 0.50, congestionWeight: 0.20, acComfortWeight: 0.30, budgetStressWeight: 0.45 },
    rich: { mobilityWeight: 0.55, congestionWeight: 0.40, acComfortWeight: 0.05, budgetStressWeight: 0.35 },
    min: 0, max: 100,
  },
  equity: { penaltyPerGapPoint: 2.0, min: 0, max: 100 },
  thresholds: {
    happiness:  { good: 65, warning: 40 },
    congestion: { good: 40, warning: 65 },
    mobility:   { good: 60, warning: 42 },
    equity:     { good: 65, warning: 40 },
    budget:     { safe: 0.50, warning: 0.20 },
  },
};

const BUDGET_CONFIG = {
  annualBudget:    30.0,
  warningFraction: 0.20,
};

const SCORING = {
  weights: { happiness: 0.40, equity: 0.35, budget: 0.25 },
  grades: [
    { min: 85, grade: "A+", label: "Model City",           color: "#10B981" },
    { min: 75, grade: "A",  label: "Equitable & Thriving", color: "#10B981" },
    { min: 65, grade: "B",  label: "Getting There",        color: "#84CC16" },
    { min: 55, grade: "C",  label: "Uneven Progress",      color: "#F59E0B" },
    { min: 45, grade: "D",  label: "Widening Gap",         color: "#F97316" },
    { min: 0,  grade: "F",  label: "Two-Tier City",        color: "#EF4444" },
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
    highHappiness:   ["Great month! Both groups moving well — and buses were comfortable.", "Riverdale is working. Mobility up, equity gap manageable.", "Strong policy. Tax revenue funding real access."],
    equityGap:       ["Rich can absorb the Uber tax — poor can't. The gap is widening. Invest in bus + AC to compensate.", "Heavy Uber tax disproportionately hurts low-income riders. Bus subsidies and AC are the equity correction.", "This is the core finding: pricing policies hit the poor hardest. Targeted investment is the antidote."],
    heatNeedingAC:   ["Hot buses, high Uber tax — poor citizens are stranded. AC would have kept buses attractive.", "Heat + expensive Uber is a mobility crisis for low-income riders.", "Without AC, extreme weather forces poor citizens to choose between a hot bus and a taxed Uber they can't afford."],
    coldNeedingAC:   ["Cold buses + expensive Uber = poor citizens staying home. AC heating is the equity tool here.", "Winter cold without bus heating hits the poor hardest.", "Low-income riders avoiding cold buses. AC is your most equity-efficient lever in winter."],
    highCongestion:  ["Congestion still high despite the Uber tax. Make sure the tax is high enough to shift riders to buses.", "Roads packed. A higher tax shifts more people to shared transport — but watch poor mobility."],
    lowMobility:     ["Mobility dropped. The Uber tax may be too high — or bus + AC investment too low to compensate.", "City isn't moving much. Consider easing the tax and boosting bus subsidies."],
    budgetWarning:   ["Budget thin. Uber tax is your income — make sure it's earning enough to cover bus and AC costs.", "Less than 20% remaining. Check whether tax revenue is keeping pace with your spending."],
    revenueGain:     ["Budget grew this month — tax revenue exceeded bus and AC costs. The self-funding model is working.", "Positive budget month. Uber tax revenue is doing real work.", "Revenue positive. Keep this balance and equity will follow."],
    balanced:        ["Solid month. Mobility decent, equity gap manageable, budget stable.", "Steady and sustainable."],
    noPolicy:        ["No tax, no subsidy, no AC. Buses are uncomfortable, Uber is unchecked. Congestion is high.", "Laissez-faire month — congestion builds and the equity gap widens without intervention."],
    timedOut:        ["Time ran out. Set AC first in extreme months — then tax and subsidy.", "The clock beat you. Hit End Turn earlier next month."],
  },
  tooltips: {
    happiness:    "Weighted city happiness: 60% poor + 40% rich. Poor happiness driven by mobility, AC comfort, budget stress. Rich by mobility and congestion.",
    mobility:     "City mobility: 60% poor + 40% rich. Uber tax reduces mobility — hitting poor hardest. Bus subsidy always helps mobility. AC offsets seasonal drops.",
    congestion:   "Road congestion. Uber tax reduces it (fewer cars). Bus subsidy reduces it. Bigger city = faster compounding.",
    equity:       "How equal the city is. 100 minus the rich/poor mobility gap. Narrow it with bus subsidies and AC — tools that specifically help poor riders.",
    budget:       "Remaining budget ($30M). Uber tax earns money. Bus subsidies and AC cost money. Net delta can be positive or negative each month.",
    uberTax:      "Tax on every Uber trip. Earns revenue + cuts congestion — but reduces mobility. Hits poor citizens 4× harder than rich (fewer alternatives). Your income lever.",
    busSubsidy:   "Discount on bus fares. Strong effect on poor, helping mobility and always reducing congestion. Costs budget.",
    acLevel:      "Bus climate comfort. At 0%, extreme weather empties buses — hitting poor hardest. At 100%, buses stay attractive year-round. Costs scale with temperature extremity.",
    poorMobility: "Mobility of 60% low-income population. Key driver of equity score. Uber tax hits them hardest.",
    richMobility: "Mobility of 40% wealthy population. Low sensitivity to Uber tax — they have private alternatives.",
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

function simulate(uberTax, busSubsidy, acLevel, roundIndex, budgetRemaining) {
  const { baseline, uber, bus, ac, happiness, equity } = SIMULATION;
  const { tempIndex: ti, tempDiscomfort } = getTemp(roundIndex);
  const acMitigation = Math.pow(acLevel / 100, ac.mitigationExponent);
  const acComfort = acLevel / 100;

  // ── POOR MOBILITY ─────────────────────────────────────────
  const poorUberLoss = uberTax * uber.poorMobilityLossPerPercent;
  const poorMobilityBeforeBus = baseline.poorMobility - poorUberLoss;
  const poorBusEffect = busSubsidy * bus.poorMobilityGain;
  const busTempPenalty     = tempDiscomfort * SEASONS.peakBusMobilityPenalty * (1 - acMitigation);
  const baselineTempPenalty = tempDiscomfort * SEASONS.peakBaselineMobilityPenalty;
  const weatherUberBoost   = tempDiscomfort * SEASONS.peakUberDemandBoost * (1 - acMitigation * 0.5);
  const poorMobility = Math.min(100, Math.max(0,
    poorMobilityBeforeBus + poorBusEffect
    - busTempPenalty - baselineTempPenalty + weatherUberBoost * 0.3
  ));

  // ── RICH MOBILITY ─────────────────────────────────────────
  const richUberLoss = uberTax * uber.richMobilityLossPerPercent;
  const richMobilityBeforeBus = baseline.richMobility - richUberLoss;
  const richBusEffect = busSubsidy * bus.richMobilityGain;
  const richMobility = Math.min(100, Math.max(0,
    richMobilityBeforeBus + richBusEffect - baselineTempPenalty * 0.4
  ));

  const cityMobility = CITY_META.poorFraction * poorMobility + CITY_META.richFraction * richMobility;

  // ── CONGESTION ────────────────────────────────────────────
  const congestionLevel = Math.min(100, Math.max(5,
    baseline.congestionLevel
    - uberTax    * uber.congestionReductionPerPercent
    - busSubsidy * bus.congestionOffsetPerPercent
    + weatherUberBoost * 0.2   // extreme weather slightly boosts remaining Uber use
  ));

  // ── EQUITY ────────────────────────────────────────────────
  const mobilityGap = Math.max(0, richMobility - poorMobility);
  const equityScore = Math.min(100, Math.max(0, 100 - mobilityGap * equity.penaltyPerGapPoint));

  // ── AC COMFORT ────────────────────────────────────────────
  const comfortRelevance = 0.3 + tempDiscomfort * 0.7;
  const poorACBonus = acComfort * ac.poorComfortBonusPerPercent * 100 * comfortRelevance;
  const richACBonus = acComfort * ac.richComfortBonusPerPercent * 100 * comfortRelevance;

  // ── BUDGET ────────────────────────────────────────────────
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const budgetStress = budgetFraction > 0.5 ? 0 : (0.5 - budgetFraction) / 0.5;

  const activity  = (cityMobility + congestionLevel) / 2;
  const uberRevenue = (uberTax   / 100) * uber.revenueRate   * activity * 200;
  const busCost     = (busSubsidy/ 100) * bus.costRate       * activity * 200;
  const acCost      = (acLevel   / 100) * ac.costRate        * (0.3 + tempDiscomfort * 0.7) * 200;
  const monthlyDelta = +(uberRevenue - busCost - acCost).toFixed(3);

  // ── HAPPINESS ─────────────────────────────────────────────
  const hw = happiness;
  const poorMobilityGain  = poorMobility  - baseline.poorMobility;
  const richMobilityGain  = richMobility  - baseline.richMobility;
  const congestionPain    = congestionLevel - baseline.congestionLevel;

  const poorHappiness = Math.min(hw.max, Math.max(hw.min,
    baseline.poorHappiness
    + poorMobilityGain  * hw.poor.mobilityWeight
    - congestionPain    * hw.poor.congestionWeight
    + poorACBonus       * hw.poor.acComfortWeight
    - budgetStress * 30 * hw.poor.budgetStressWeight
  ));
  const richHappiness = Math.min(hw.max, Math.max(hw.min,
    baseline.richHappiness
    + richMobilityGain  * hw.rich.mobilityWeight
    - congestionPain    * hw.rich.congestionWeight
    + richACBonus       * hw.rich.acComfortWeight
    - budgetStress * 25 * hw.rich.budgetStressWeight
  ));
  const cityHappiness = CITY_META.poorFraction * poorHappiness + CITY_META.richFraction * richHappiness;

  const weatherAlert = tempDiscomfort > 0.6 && acLevel < 30;

  return {
    poorMobility, richMobility, cityMobility,
    congestionLevel, equityScore,
    poorHappiness, richHappiness, cityHappiness,
    monthlyDelta, uberRevenue, busCost, acCost,
    budgetStress, weatherAlert,
    tempDiscomfort,
  };
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getMonthEndMessage(stats, uberTax, bus, ac, budgetFraction, timedOut, roundIndex) {
  if (timedOut) return pickRandom(ADVISOR.monthEndReactions.timedOut);
  if (uberTax === 0 && bus === 0 && ac === 0) return pickRandom(ADVISOR.monthEndReactions.noPolicy);
  if (budgetFraction < BUDGET_CONFIG.warningFraction) return pickRandom(ADVISOR.monthEndReactions.budgetWarning);
  const ti = SEASONS.tempIndex[roundIndex];
  if (stats.weatherAlert && ti > 0.5)  return pickRandom(ADVISOR.monthEndReactions.heatNeedingAC);
  if (stats.weatherAlert && ti < -0.5) return pickRandom(ADVISOR.monthEndReactions.coldNeedingAC);
  if (stats.equityScore < SIMULATION.thresholds.equity.warning) return pickRandom(ADVISOR.monthEndReactions.equityGap);
  const t = SIMULATION.thresholds;
  if (stats.cityHappiness  >= t.happiness.good)      return pickRandom(ADVISOR.monthEndReactions.highHappiness);
  if (stats.congestionLevel >= t.congestion.warning) return pickRandom(ADVISOR.monthEndReactions.highCongestion);
  if (stats.cityMobility   <= t.mobility.warning)    return pickRandom(ADVISOR.monthEndReactions.lowMobility);
  if (stats.monthlyDelta > 0) return pickRandom(ADVISOR.monthEndReactions.revenueGain);
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
        style={{ background: "none", border: "1px solid #1E293B", borderRadius: "50%", width: 16, height: 16, cursor: "pointer", color: "#334155", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>i</button>
      {show && (
        <div style={{ position: "absolute", right: 0, top: 20, width: 220, background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, padding: "9px 11px", fontSize: 11, color: "#94A3B8", zIndex: 300, lineHeight: 1.5, pointerEvents: "none" }}>{text}</div>
      )}
    </div>
  );
}

function GaugeBar({ label, value, type, tooltip, extra, subLabel }) {
  const color  = getColor(value, type);
  const barW   = type === "budget" ? value * 100 : Math.round(value);
  const display = type === "budget" ? `$${(value * BUDGET_CONFIG.annualBudget).toFixed(1)}M` : Math.round(value);
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#334155", letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
          {subLabel && <span style={{ fontSize: 9, color: "#1E293B" }}>{subLabel}</span>}
          <InfoTip text={tooltip} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{display}</span>
          {extra && <span style={{ fontSize: 9, color: extra.startsWith("⚠") ? "#F97316" : "#1E293B" }}>{extra}</span>}
        </div>
      </div>
      <div style={{ height: 6, background: "#0A1628", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, barW))}%`, background: color, borderRadius: 3, transition: "width 0.35s ease, background 0.3s" }} />
      </div>
    </div>
  );
}

function SplitGauge({ poorVal, richVal, tooltip }) {
  const poorColor = getColor(poorVal, "mobility");
  const richColor = getColor(richVal, "mobility");
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#334155", letterSpacing: 1, textTransform: "uppercase" }}>Mobility Split</span>
          <InfoTip text={tooltip} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#334155" }}>Poor</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: poorColor }}>{Math.round(poorVal)}</span>
          <span style={{ fontSize: 10, color: "#1E293B" }}>·</span>
          <span style={{ fontSize: 10, color: "#334155" }}>Rich</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: richColor }}>{Math.round(richVal)}</span>
        </div>
      </div>
      <div style={{ height: 6, background: "#0A1628", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.round(poorVal)}%`, background: poorColor, borderRadius: 3, transition: "width 0.35s ease" }} />
      </div>
      <div style={{ height: 4, marginTop: 2, background: "#0A1628", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.round(richVal)}%`, background: richColor, opacity: 0.45, borderRadius: 3, transition: "width 0.35s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#1E293B", marginTop: 2 }}>
        <span>← Poor (60%)</span><span>Rich (40%) →</span>
      </div>
    </div>
  );
}

function SliderInput({ label, value, onChange, color, tooltip, locked, tag }) {
  return (
    <div style={{ marginBottom: 18, opacity: locked ? 0.5 : 1, transition: "opacity 0.3s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
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

function BudgetDeltaPreview({ delta, uberRevenue, busCost, acCost }) {
  const pos = delta >= 0;
  return (
    <div style={{ background: pos ? "#030E07" : "#1A0505", border: `1px solid ${pos ? "#052E16" : "#3B0000"}`, borderRadius: 7, padding: "8px 12px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#1E293B" }}>Est. budget change</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: pos ? "#10B981" : "#EF4444" }}>{pos ? "+" : ""}{delta.toFixed(2)}M</span>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 9, color: "#1E293B" }}>
        <span style={{ color: "#10B981" }}>+${uberRevenue.toFixed(2)} tax</span>
        <span style={{ color: "#EF4444" }}>−${busCost.toFixed(2)} bus</span>
        <span style={{ color: "#EF4444" }}>−${acCost.toFixed(2)} AC</span>
      </div>
    </div>
  );
}

function AdvisorBox({ message }) {
  return (
    <div style={{ background: "#050D1A", border: "1px solid #0C1E30", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 9, alignItems: "flex-start" }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>🧑‍💼</span>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#1D4ED8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 3 }}>{ADVISOR.name} · {ADVISOR.title}</div>
        <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.55 }}>{message}</div>
      </div>
    </div>
  );
}

function SeasonBadge({ roundIndex }) {
  const ti = SEASONS.tempIndex[roundIndex];
  const discomfort = Math.abs(ti);
  const color = discomfort > 0.7 ? "#EF4444" : discomfort > 0.3 ? "#F59E0B" : "#10B981";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#050E1A", border: `1px solid ${color}30`, borderRadius: 6, padding: "4px 9px" }}>
      <span style={{ fontSize: 14 }}>{SEASONS.seasonIcon[roundIndex]}</span>
      <div>
        <div style={{ fontSize: 9, color: "#1E293B", textTransform: "uppercase", letterSpacing: 1 }}>Season</div>
        <div style={{ fontSize: 11, fontWeight: 600, color }}>{SEASONS.seasonLabel[roundIndex]}</div>
      </div>
    </div>
  );
}

function StatPill({ label, value, color, small }) {
  return (
    <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 7, padding: small ? "5px 7px" : "7px 8px", textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 9, color: "#1E293B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
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
        <div style={{ fontSize: 40, marginBottom: 10 }}>⏰</div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#1D4ED8", textTransform: "uppercase", marginBottom: 6 }}>Month Locked</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#F1F5F9" }}>{month} Ending...</div>
        <div style={{ marginTop: 14, display: "flex", gap: 6, justifyContent: "center" }}>
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
        <h2 style={{ fontSize: 30, fontWeight: 700, color: "#F1F5F9", margin: "0 0 8px" }}>Riverdale Bankrupt</h2>
        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, marginBottom: 22 }}>
          The city ran out of funds in <strong style={{ color: "#94A3B8" }}>{month}</strong>. Bus and AC costs outpaced Uber tax revenue. Poor citizens are stranded.
        </p>
        <div style={{ marginBottom: 22 }}><AdvisorBox message="Three cost streams outpaced your one income stream. In extreme seasons, AC alone can drain the budget. Raise the Uber tax earlier — it's your only lever that earns money." /></div>
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
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏘️</div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#1D4ED8", textTransform: "uppercase", marginBottom: 8 }}>Transport Tycoon · City 2</div>
        <h1 style={{ fontSize: 38, fontWeight: 700, color: "#F1F5F9", margin: "0 0 4px" }}>{CITY_META.name}</h1>
        <p style={{ fontSize: 12, color: "#1E293B", marginBottom: 18, fontStyle: "italic" }}>{CITY_META.subtitle}</p>
        <div style={{ marginBottom: 18 }}><AdvisorBox message={ADVISOR.gameIntro} /></div>
        <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.75, marginBottom: 20 }}>{CITY_META.intro}</p>
        <div style={{ display: "flex", gap: 7, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          {[["👥","200k people"],["⚖️","60% poor / 40% rich"],["💰","$30M budget"],["🌡️","Seasons"],["⏱","25 sec/month"],["🚕","Uber tax earns $"],["🚌","Bus costs $"],["❄️","AC costs $"]].map(([icon, label]) => (
            <div key={label} style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 6, padding: "5px 9px", fontSize: 10, color: "#334155" }}>{icon} {label}</div>
          ))}
        </div>
        <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 9, padding: "11px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: 9, color: "#1E293B", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Final Score =</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["😊 Happiness","40%","#10B981"],["⚖️ Equity","35%","#A78BFA"],["💰 Budget","25%","#F59E0B"]].map(([l,w,c]) => (
              <div key={l} style={{ flex: 1, textAlign: "center", background: "#020C18", borderRadius: 6, padding: "7px 4px" }}>
                <div style={{ fontSize: 11 }}>{l}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{w}</div>
              </div>
            ))}
          </div>
        </div>
        <button onClick={onStart} style={{ background: "#1D4ED8", color: "white", border: "none", borderRadius: 9, padding: "12px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Start as Transport Director →
        </button>
        <p style={{ fontSize: 10, color: "#0C1F35", marginTop: 8 }}>Hit End Turn when ready — or the timer decides</p>
      </div>
    </div>
  );
}

function PlanningScreen({ month, roundIndex, uberTax, busSubsidy, acLevel, onUberChange, onBusChange, onACChange, onCommit, budgetRemaining }) {
  const [timeLeft, setTimeLeft] = useState(TIMER.monthDuration);
  const [locked, setLocked]     = useState(false);
  const [ending, setEnding]     = useState(false);
  const uberRef   = useRef(uberTax);
  const busRef    = useRef(busSubsidy);
  const acRef     = useRef(acLevel);
  const lockedRef = useRef(false);
  useEffect(() => { uberRef.current = uberTax;    }, [uberTax]);
  useEffect(() => { busRef.current  = busSubsidy; }, [busSubsidy]);
  useEffect(() => { acRef.current   = acLevel;    }, [acLevel]);

  const commitMonth = useCallback((wasTimedOut) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true); setEnding(true);
    setTimeout(() => onCommit(uberRef.current, busRef.current, acRef.current, wasTimedOut), TIMER.endingDuration);
  }, [onCommit]);

  useEffect(() => {
    setTimeLeft(TIMER.monthDuration); setLocked(false); setEnding(false); lockedRef.current = false;
    const iv = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(iv); commitMonth(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [roundIndex]);

  const live = simulate(uberTax, busSubsidy, acLevel, roundIndex, budgetRemaining);
  const budgetFraction = budgetRemaining / BUDGET_CONFIG.annualBudget;
  const warn = timeLeft <= TIMER.warningAt && timeLeft > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#020817", fontFamily: "Georgia, serif", padding: "14px", outline: warn ? "3px solid rgba(239,68,68,0.3)" : "3px solid transparent", transition: "outline 0.3s" }}>
      {ending && <MonthEndingOverlay month={month} />}
      <div style={{ maxWidth: 600, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#1D4ED8", textTransform: "uppercase" }}>City 2 · {CITY_META.name}</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#F1F5F9", margin: "2px 0 0" }}>{month}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SeasonBadge roundIndex={roundIndex} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#0C1F35" }}>Month</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{roundIndex+1}/12</div>
            </div>
            <CountdownRing timeLeft={timeLeft} total={TIMER.monthDuration} />
          </div>
        </div>

        <div style={{ height: 3, background: "#050E1A", borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(roundIndex/12)*100}%`, background: "#1D4ED8", transition: "width 0.4s" }} />
        </div>

        {live.weatherAlert && (
          <div style={{ background: "#1A0A00", border: "1px solid #451A00", borderRadius: 7, padding: "7px 11px", marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 16 }}>{SEASONS.seasonIcon[roundIndex]}</span>
            <span style={{ fontSize: 11, color: "#F97316" }}>Extreme weather — buses uncomfortable without AC. Poor citizens hit hardest.</span>
          </div>
        )}

        <div style={{ marginBottom: 10 }}><AdvisorBox message={ADVISOR.monthStartHints[roundIndex]} /></div>

        {/* Sliders */}
        <div style={{ background: "#050E1A", border: warn ? "1px solid rgba(239,68,68,0.4)" : "1px solid #0C2340", borderRadius: 10, padding: "14px 14px 4px", marginBottom: 9, transition: "border 0.3s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 9, letterSpacing: 2, color: "#0C1F35", textTransform: "uppercase" }}>Set Policy</span>
            {locked && <span style={{ fontSize: 10, color: "#EF4444", fontWeight: 700 }}>🔒 LOCKED</span>}
          </div>
          <SliderInput label="Uber Tax"         value={uberTax}    onChange={onUberChange} color="#EF4444" tooltip={ADVISOR.tooltips.uberTax}    locked={locked} tag={{ text: "earns $", bg: "#052E16", color: "#10B981" }} />
          <SliderInput label="Bus Fare Subsidy"  value={busSubsidy} onChange={onBusChange}  color="#3B82F6" tooltip={ADVISOR.tooltips.busSubsidy} locked={locked} tag={{ text: "costs $", bg: "#1A0505", color: "#EF4444" }} />
          <SliderInput label="Bus AC & Heating"  value={acLevel}    onChange={onACChange}   color="#06B6D4" tooltip={ADVISOR.tooltips.acLevel}    locked={locked} tag={{ text: "costs $", bg: "#1A0505", color: "#EF4444" }} />
          <BudgetDeltaPreview delta={live.monthlyDelta} uberRevenue={live.uberRevenue} busCost={live.busCost} acCost={live.acCost} />
        </div>

        {/* Gauges */}
        <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#0C1F35", textTransform: "uppercase", marginBottom: 10 }}>Live Preview</div>
          <GaugeBar label="Happiness"  value={live.cityHappiness}  type="happiness"  tooltip={ADVISOR.tooltips.happiness} />
          <SplitGauge poorVal={live.poorMobility} richVal={live.richMobility} tooltip={ADVISOR.tooltips.mobility} />
          <GaugeBar label="Equity"     value={live.equityScore}    type="equity"     tooltip={ADVISOR.tooltips.equity} />
          <GaugeBar label="Congestion" value={live.congestionLevel} type="congestion" tooltip={ADVISOR.tooltips.congestion} />
          <GaugeBar label="Budget"     value={budgetFraction}       type="budget"     tooltip={ADVISOR.tooltips.budget} extra={`/ $${BUDGET_CONFIG.annualBudget}M`} />
        </div>

        {/* End Turn button */}
        {!locked && (
          <button onClick={() => commitMonth(false)}
            style={{ width: "100%", background: "#059669", color: "white", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            ✓ End Turn — Lock in {month}'s Policy
          </button>
        )}
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
    <div style={{ minHeight: "100vh", background: "#020817", fontFamily: "Georgia, serif", padding: "14px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#059669", textTransform: "uppercase" }}>Month Complete</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#F1F5F9", margin: "2px 0 0" }}>{month} Results</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SeasonBadge roundIndex={roundIndex} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{roundIndex+1}/12</span>
          </div>
        </div>

        {/* Policy row */}
        <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
          {[[uberTax,"#EF4444","Uber Tax"],[busSubsidy,"#3B82F6","Bus Sub"],[acLevel,"#06B6D4","AC"]].map(([v,c,l]) => (
            <div key={l} style={{ flex: 1, background: "#050808", border: `1px solid ${c}20`, borderRadius: 7, padding: "8px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#1E293B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}%</div>
            </div>
          ))}
          <div style={{ flex: 1.4, background: pos ? "#030E07" : "#100303", border: `1px solid ${pos ? "#052E16" : "#2A0000"}`, borderRadius: 7, padding: "8px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#1E293B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Budget Δ</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: pos ? "#10B981" : "#EF4444" }}>{pos?"+":""}{monthlyDelta.toFixed(2)}M</div>
            <div style={{ fontSize: 8, color: "#1E293B" }}>+{uberRevenue.toFixed(1)} −{busCost.toFixed(1)} −{acCost.toFixed(1)}</div>
          </div>
          {timedOut && <div style={{ background: "#080202", border: "1px solid #1A0505", borderRadius: 7, padding: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 12, color: "#EF4444" }}>⏰</span></div>}
        </div>

        {/* Stat pills */}
        <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
          <StatPill label="Happiness"  value={cityHappiness}  color={getColor(cityHappiness, "happiness")} small />
          <StatPill label="Equity"     value={equityScore}    color={getColor(equityScore, "equity")} small />
          <StatPill label="Congestion" value={congestionLevel} color={getColor(congestionLevel, "congestion")} small />
          <StatPill label="Budget"     value={`$${budgetRemaining.toFixed(1)}M`} color={getColor(budgetFraction, "budget")} small />
        </div>

        <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 10, padding: "12px 14px", marginBottom: 9 }}>
          <GaugeBar label="Happiness"  value={cityHappiness}  type="happiness"  tooltip={ADVISOR.tooltips.happiness} />
          <SplitGauge poorVal={poorMobility} richVal={richMobility} tooltip={ADVISOR.tooltips.mobility} />
          <GaugeBar label="Equity"     value={equityScore}    type="equity"     tooltip={ADVISOR.tooltips.equity} />
          <GaugeBar label="Congestion" value={congestionLevel} type="congestion" tooltip={ADVISOR.tooltips.congestion} />
          <GaugeBar label="Budget"     value={budgetFraction}  type="budget"     tooltip={ADVISOR.tooltips.budget} extra={`/ $${BUDGET_CONFIG.annualBudget}M`} />
        </div>

        <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 7, padding: "9px 13px", marginBottom: 9, display: "flex", justifyContent: "space-between" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#1E293B" }}>YTD Happiness</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: getColor(ytdH, "happiness") }}>{ytdH}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#1E293B" }}>YTD Equity</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: getColor(ytdE, "equity") }}>{ytdE}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#1E293B" }}>Budget Left</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: getColor(budgetFraction, "budget") }}>${budgetRemaining.toFixed(1)}M</div>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}><AdvisorBox message={advisorMessage} /></div>

        <button onClick={onNext} style={{ width: "100%", background: isLast ? "#059669" : "#1D4ED8", color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          {isLast ? "See Final Score →" : `Next: ${MONTHS[roundIndex+1]} →`}
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
  const avgRichM = history.reduce((s, m) => s + m.richMobility, 0) / history.length;
  const budgetEff = (finalBudget / BUDGET_CONFIG.annualBudget) * 100;
  const { weights } = SCORING;
  const finalScore = scoreless ? 0 : avgH * weights.happiness + avgE * weights.equity + budgetEff * weights.budget;
  const grade = getGrade(scoreless ? 0 : finalScore);
  const budgetSpent = BUDGET_CONFIG.annualBudget - finalBudget;

  const chartData = history.map((m, i) => ({
    month: MONTHS[i].slice(0,3),
    happiness: Math.round(m.cityHappiness),
    equity:    Math.round(m.equityScore),
    poor:      Math.round(m.poorMobility),
    rich:      Math.round(m.richMobility),
    delta:     +m.monthlyDelta.toFixed(2),
  }));

  return (
    <div style={{ minHeight: "100vh", background: "#020817", fontFamily: "Georgia, serif", padding: "14px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: "#1D4ED8", textTransform: "uppercase", marginBottom: 8 }}>Year Complete · {CITY_META.name}</div>
          {scoreless ? <div style={{ fontSize: 44, fontWeight: 700, color: "#EF4444" }}>Bankrupt</div>
            : <div style={{ fontSize: 86, fontWeight: 700, color: grade.color, lineHeight: 1 }}>{grade.grade}</div>}
          <div style={{ fontSize: 16, color: "#475569", marginTop: 5 }}>{scoreless ? "City ran out of funds" : grade.label}</div>
          {!scoreless && <div style={{ fontSize: 11, color: "#1E293B", marginTop: 3 }}>
            Score: {Math.round(finalScore)} = H {Math.round(avgH)}×{weights.happiness} + E {Math.round(avgE)}×{weights.equity} + B {Math.round(budgetEff)}×{weights.budget}
          </div>}
        </div>

        <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
          <StatPill label="Avg Happiness" value={avgH} color={getColor(avgH, "happiness")} small />
          <StatPill label="Avg Equity"    value={avgE} color={getColor(avgE, "equity")} small />
          <StatPill label="Avg Congestion" value={avgC} color={getColor(avgC, "congestion")} small />
          <StatPill label="Budget Spent"  value={`$${budgetSpent.toFixed(1)}M`} color={getColor(finalBudget/BUDGET_CONFIG.annualBudget, "budget")} small />
        </div>

        {/* Happiness + Equity */}
        <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 10, padding: "14px 14px 8px", marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#0C1F35", textTransform: "uppercase", marginBottom: 10 }}>Happiness & Equity — 12 Months</div>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#1E293B" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0,100]} tick={{ fontSize: 9, fill: "#0C1F35" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 7, fontSize: 11 }} labelStyle={{ color: "#64748B" }} />
              <Line type="monotone" dataKey="happiness" stroke="#10B981" strokeWidth={2} dot={false} name="Happiness" />
              <Line type="monotone" dataKey="equity"    stroke="#A78BFA" strokeWidth={2} dot={false} name="Equity" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 4 }}>
            {[["#10B981","Happiness"],["#A78BFA","Equity"]].map(([c,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#334155" }}>
                <div style={{ width: 16, height: 2, background: c }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Poor vs Rich gap */}
        <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 10, padding: "14px 14px 8px", marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#0C1F35", textTransform: "uppercase", marginBottom: 10 }}>Poor vs Rich Mobility — The Gap</div>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#1E293B" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0,100]} tick={{ fontSize: 9, fill: "#0C1F35" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 7, fontSize: 11 }} labelStyle={{ color: "#64748B" }} />
              <Line type="monotone" dataKey="poor" stroke="#F59E0B" strokeWidth={2} dot={false} name="Poor mobility" />
              <Line type="monotone" dataKey="rich" stroke="#3B82F6" strokeWidth={2} dot={false} name="Rich mobility" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 4 }}>
            {[["#F59E0B","Poor (60%)"],["#3B82F6","Rich (40%)"]].map(([c,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#334155" }}>
                <div style={{ width: 16, height: 2, background: c }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Budget delta */}
        <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 10, padding: "14px 14px 8px", marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#0C1F35", textTransform: "uppercase", marginBottom: 10 }}>Monthly Budget Change — Tax Revenue vs Spend</div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#1E293B" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#0C1F35" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 7, fontSize: 11 }} formatter={v => [`$${v}M`, "Budget Δ"]} />
              <Bar dataKey="delta" radius={[3,3,0,0]}>{chartData.map((e,i) => <Cell key={i} fill={e.delta >= 0 ? "#10B981" : "#EF4444"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Policy log */}
        <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 10, padding: "12px 14px", marginBottom: 14, overflowX: "auto" }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#0C1F35", textTransform: "uppercase", marginBottom: 8 }}>Monthly Policy Log</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead>
              <tr>{["Month","Season","UberTax","Bus","AC","BudgetΔ","Happy","Equity"].map(h => (
                <th key={h} style={{ color: "#0C1F35", fontWeight: 600, textAlign: "left", paddingBottom: 5, borderBottom: "1px solid #0C2340", paddingRight: 6 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {history.map((m, i) => (
                <tr key={i}>
                  <td style={{ padding: "4px 6px 4px 0", color: "#1E293B" }}>{MONTHS[i].slice(0,3)}</td>
                  <td style={{ paddingRight: 6 }}>{SEASONS.seasonIcon[i]}</td>
                  <td style={{ color: "#EF4444", fontWeight: 600, paddingRight: 6 }}>{m.uberTax}%</td>
                  <td style={{ color: "#3B82F6", fontWeight: 600, paddingRight: 6 }}>{m.busSubsidy}%</td>
                  <td style={{ color: "#06B6D4", fontWeight: 600, paddingRight: 6 }}>{m.acLevel}%</td>
                  <td style={{ color: m.monthlyDelta >= 0 ? "#10B981" : "#EF4444", fontWeight: 600, paddingRight: 6 }}>{m.monthlyDelta >= 0 ? "+" : ""}{m.monthlyDelta.toFixed(1)}M</td>
                  <td style={{ color: getColor(m.cityHappiness, "happiness"), fontWeight: 600, paddingRight: 6 }}>{Math.round(m.cityHappiness)}</td>
                  <td style={{ color: getColor(m.equityScore, "equity") }}>{Math.round(m.equityScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Research debrief */}
        <div style={{ background: "#020C18", border: "1px solid #0C1A2E", borderRadius: 10, padding: "14px", marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#1D4ED8", textTransform: "uppercase", marginBottom: 10 }}>📖 What the Research Says</div>
          <p style={{ fontSize: 11, color: "#334155", lineHeight: 1.8, margin: "0 0 9px" }}>{DEBRIEF.coreInsight}</p>
          <p style={{ fontSize: 11, color: "#334155", lineHeight: 1.8, borderLeft: "3px solid #A78BFA", paddingLeft: 10, margin: "0 0 9px" }}>{DEBRIEF.equityInsight}</p>
          <p style={{ fontSize: 11, color: "#334155", lineHeight: 1.8, borderLeft: "3px solid #06B6D4", paddingLeft: 10, margin: "0 0 9px" }}>{DEBRIEF.seasonInsight}</p>
          <div style={{ background: "#050E1A", border: "1px solid #0C2340", borderRadius: 7, padding: "9px 12px", marginTop: 10 }}>
            <div style={{ fontSize: 10, color: "#1D4ED8", marginBottom: 4 }}>🏙️ Up Next: City 3 — New Meridian</div>
            <div style={{ fontSize: 11, color: "#1E293B", lineHeight: 1.6 }}>{DEBRIEF.city3Teaser}</div>
          </div>
          <div style={{ fontSize: 9, color: "#0C1F35", marginTop: 9 }}>{DEBRIEF.source}</div>
        </div>

        <button onClick={onRestart} style={{ width: "100%", background: "#050E1A", color: "#1E293B", border: "1px solid #0C2340", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>↺ Play Again</button>
      </div>
    </div>
  );
}

// ============================================================
//  MAIN GAME CONTROLLER
// ============================================================
export default function RiverdaleTycoon() {
  const [screen, setScreen]         = useState("intro");
  const [roundIndex, setRoundIndex] = useState(0);
  const [uberTax,    setUber]       = useState(0);
  const [busSubsidy, setBus]        = useState(0);
  const [acLevel,    setAC]         = useState(0);
  const [history, setHistory]       = useState([]);
  const [result, setResult]         = useState(null);
  const [advisorMsg, setAdvisorMsg] = useState("");
  const [timedOut, setTimedOut]     = useState(false);
  const [budget, setBudget]         = useState(BUDGET_CONFIG.annualBudget);
  const [scoreless, setScoreless]   = useState(false);
  const [gameOverMonth, setGameOverMonth] = useState("");

  const handleCommit = useCallback((uberVal, busVal, acVal, wasTimedOut) => {
    setBudget(prev => {
      const stats = simulate(uberVal, busVal, acVal, roundIndex, prev);
      const newBudget = +(prev + stats.monthlyDelta).toFixed(3);
      const bf = Math.max(0, newBudget) / BUDGET_CONFIG.annualBudget;
      const msg = getMonthEndMessage(stats, uberVal, busVal, acVal, bf, wasTimedOut, roundIndex);
      const record = { ...stats, uberTax: uberVal, busSubsidy: busVal, acLevel: acVal };
      setResult(record); setAdvisorMsg(msg); setTimedOut(wasTimedOut);
      setHistory(h => [...h, record]);
      if (newBudget <= 0) { setGameOverMonth(MONTHS[roundIndex]); setScreen("gameOver"); return 0; }
      setScreen("result");
      return newBudget;
    });
  }, [roundIndex]);

  const handleNext = useCallback(() => {
    if (roundIndex === 11) { setScreen("yearEnd"); }
    else { setRoundIndex(r => r+1); setUber(0); setBus(0); setAC(0); setScreen("planning"); }
  }, [roundIndex]);

  const handleRestart = useCallback(() => {
    setScreen("intro"); setRoundIndex(0); setUber(0); setBus(0); setAC(0);
    setHistory([]); setResult(null); setTimedOut(false);
    setBudget(BUDGET_CONFIG.annualBudget); setScoreless(false); setGameOverMonth("");
  }, []);

  const handleContinue = useCallback(() => {
    setScoreless(true); setRoundIndex(r => r+1); setUber(0); setBus(0); setAC(0); setBudget(0); setScreen("planning");
  }, []);

  if (screen === "intro")    return <IntroScreen onStart={() => setScreen("planning")} />;
  if (screen === "gameOver") return <GameOverScreen month={gameOverMonth} onRestart={handleRestart} onContinue={handleContinue} />;
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
