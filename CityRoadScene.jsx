import React, { useMemo } from "react";

// ─────────────────────────────────────────────────────────────
//  CITY CONFIGS  (one per city level)
// ─────────────────────────────────────────────────────────────
const CITY_CONFIGS = {
  1: {
    lanes: 1,
    buildingStripH: 105,
    skyH: 48,
    groundH: 28,
    roadLaneH: 30,
    sidewalkH: 10,
    skyColor: "#C4D9E8",
    groundColor: "#B8A86A",
    sidewalkColor: "#C8BC8A",
    roadColor: "#374151",
    roadColorAlt: "#2D3748",
    palette: ["#D4845A", "#C86B40", "#E8A46A", "#DDB87A", "#B87A4A", "#E0A060", "#C8904A"],
    hRange: [38, 65],
    wRange: [52, 80],
    gapRange: [8, 18],
    winRows: [1, 2],
    winCols: [1, 2],
  },
  2: {
    lanes: 1,
    buildingStripH: 125,
    skyH: 52,
    groundH: 26,
    roadLaneH: 30,
    sidewalkH: 10,
    skyColor: "#B4C6D8",
    groundColor: "#A89060",
    sidewalkColor: "#BCAF88",
    roadColor: "#374151",
    roadColorAlt: "#2D3748",
    palette: ["#7B8EC8", "#8B95C0", "#D4845A", "#A8B0C8", "#C8A878", "#6A80AA", "#9890B0"],
    hRange: [55, 90],
    wRange: [44, 68],
    gapRange: [3, 8],
    winRows: [2, 3],
    winCols: [2, 3],
  },
  3: {
    lanes: 2,
    buildingStripH: 158,
    skyH: 48,
    groundH: 22,
    roadLaneH: 26,
    sidewalkH: 9,
    skyColor: "#A4B4CC",
    groundColor: "#988070",
    sidewalkColor: "#A49880",
    roadColor: "#2D3748",
    roadColorAlt: "#252D3D",
    palette: ["#6B7DB3", "#8B6B8A", "#A89878", "#7DA87D", "#7A8E9A", "#9A8878", "#6880A0"],
    hRange: [70, 128],
    wRange: [38, 68],
    gapRange: [2, 5],
    winRows: [3, 5],
    winCols: [2, 4],
  },
  4: {
    lanes: 2,
    buildingStripH: 225,
    skyH: 44,
    groundH: 18,
    roadLaneH: 26,
    sidewalkH: 9,
    skyColor: "#8494AC",
    groundColor: "#706070",
    sidewalkColor: "#847070",
    roadColor: "#1E293B",
    roadColorAlt: "#162032",
    palette: ["#3D4A5E", "#4A5568", "#5E6880", "#6B7080", "#445068", "#384060", "#5A6070"],
    hRange: [95, 205],
    wRange: [36, 72],
    gapRange: [1, 4],
    winRows: [4, 10],
    winCols: [2, 5],
  },
};

// ─────────────────────────────────────────────────────────────
//  VEHICLE POOL  (stable — defined once at module level)
// ─────────────────────────────────────────────────────────────
const MAX_CARS = 18;
const MAX_BUSES = 8;

const CAR_COLORS = [
  "#DC2626", "#9CA3AF", "#1E40AF", "#D97706",
  "#6B7280", "#B91C1C", "#374151", "#92400E",
];

// Pre-computed stable pool — keys never change so CSS animations never restart
const CAR_POOL = Array.from({ length: MAX_CARS }, (_, i) => ({
  id: `car-${i}`,
  delay: -((i * 3.7) % 20),
  baseDuration: 9 + (i * 2.1) % 9,
  color: CAR_COLORS[i % CAR_COLORS.length],
  laneSlot: i % 2,
  yOffset: ((i % 3) - 1) * 2,
}));

const BUS_POOL = Array.from({ length: MAX_BUSES }, (_, i) => ({
  id: `bus-${i}`,
  delay: -((i * 5.3) % 24),
  baseDuration: 16 + (i * 2.7) % 10,
  laneSlot: i % 2,
  yOffset: ((i % 2) - 0.5) * 3,
}));

// ─────────────────────────────────────────────────────────────
//  SEEDED RANDOM  (deterministic, no dependencies)
// ─────────────────────────────────────────────────────────────
function seededRand(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function generateBuildings(cfg, side, cityLevel) {
  const { palette, hRange, wRange, gapRange, winRows, winCols } = cfg;
  const buildings = [];
  let x = 0;
  // Each city+side gets a distinct seed base
  let seed = cityLevel * 500 + (side === "top" ? 0 : 250);

  while (x < 1700) {
    const w = Math.floor(wRange[0] + seededRand(seed++) * (wRange[1] - wRange[0]));
    const h = Math.floor(hRange[0] + seededRand(seed++) * (hRange[1] - hRange[0]));
    const gap = Math.floor(gapRange[0] + seededRand(seed++) * (gapRange[1] - gapRange[0]));
    const colorIdx = Math.floor(seededRand(seed++) * palette.length);
    const rows = Math.floor(winRows[0] + seededRand(seed++) * (winRows[1] - winRows[0] + 0.99));
    const cols = Math.floor(winCols[0] + seededRand(seed++) * (winCols[1] - winCols[0] + 0.99));
    buildings.push({ x, w, h, color: palette[colorIdx], winRows: rows, winCols: cols });
    x += w + gap;
  }
  return buildings;
}

// ─────────────────────────────────────────────────────────────
//  BUILDING
// ─────────────────────────────────────────────────────────────
function darkHex(color, amt) {
  try {
    const n = parseInt(color.slice(1), 16);
    const r = Math.max(0, ((n >> 16) & 0xff) + amt);
    const g = Math.max(0, ((n >> 8) & 0xff) + amt);
    const b = Math.max(0, (n & 0xff) + amt);
    return `rgb(${r},${g},${b})`;
  } catch {
    return color;
  }
}

function Building({ x, w, h, color, winRows, winCols, side }) {
  const roofH = Math.max(5, Math.round(h * 0.1));
  const roofColor = darkHex(color, -25);

  const winW = Math.max(3, Math.floor((w - 10) / (winCols * 1.9)));
  const winH = Math.max(4, Math.round(winW * 1.4));
  const colGap = Math.max(3, Math.floor((w - 8 - winCols * winW) / (winCols + 1)));
  const usableH = h - roofH - 10;
  const rowGap = Math.max(3, Math.floor((usableH - winRows * winH) / (winRows + 1)));

  const windows = [];
  for (let r = 0; r < winRows; r++) {
    for (let c = 0; c < winCols; c++) {
      const wx = 4 + colGap + c * (winW + colGap);
      const wy = (side === "top" ? roofH : 0) + 5 + r * (winH + rowGap);
      if (wx + winW <= w - 3 && wy + winH <= h - 4) {
        windows.push(
          <div key={`${r}-${c}`} style={{
            position: "absolute", left: wx, top: wy,
            width: winW, height: winH,
            background: "rgba(255,228,140,0.65)",
            borderRadius: 1,
          }} />
        );
      }
    }
  }

  const posStyle = side === "top"
    ? { bottom: 0, borderRadius: "3px 3px 0 0" }
    : { top: 0, borderRadius: "0 0 3px 3px" };

  return (
    <div style={{ position: "absolute", left: x, width: w, height: h, background: color, ...posStyle }}>
      {side === "top" && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: roofH, background: roofColor, borderRadius: "3px 3px 0 0" }} />
      )}
      {side === "bottom" && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: roofH, background: roofColor, borderRadius: "0 0 3px 3px" }} />
      )}
      {windows}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  BUILDING STRIP
// ─────────────────────────────────────────────────────────────
function CityBuildings({ cfg, side, cityLevel }) {
  // useMemo on cityLevel + side ensures buildings are only regenerated when city changes
  const buildings = useMemo(
    () => generateBuildings(cfg, side, cityLevel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cityLevel, side]
  );

  return (
    <div style={{
      position: "relative", width: "100%",
      height: cfg.buildingStripH,
      overflow: "hidden", flexShrink: 0,
      background: side === "top" ? cfg.skyColor : cfg.groundColor,
    }}>
      {buildings.map((b, i) => <Building key={i} {...b} side={side} />)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  VEHICLE KEYFRAMES  (injected once)
// ─────────────────────────────────────────────────────────────
const VEHICLE_KEYFRAMES = `
  @keyframes crs-driveRight {
    from { left: -95px; }
    to   { left: 105%;  }
  }
  @keyframes crs-driveLeft {
    from { left: 105%;  }
    to   { left: -165px; }
  }
`;

// ─────────────────────────────────────────────────────────────
//  CAR
// ─────────────────────────────────────────────────────────────
function Car({ delay, duration, color, visible, yOffset, laneH }) {
  const top = Math.round(laneH / 2 - 7 + yOffset);
  return (
    <div style={{
      position: "absolute",
      left: 0, top,
      width: 28, height: 14,
      background: color,
      borderRadius: 3,
      opacity: visible ? 1 : 0,
      transition: "opacity 0.5s",
      animation: `crs-driveRight ${duration}s ${delay}s linear infinite`,
      zIndex: 2,
      willChange: "left",
    }}>
      {/* Windshield */}
      <div style={{ position: "absolute", right: 3, top: 2, width: 8, height: 5, background: "rgba(180,220,255,0.75)", borderRadius: 1 }} />
      {/* Rear window */}
      <div style={{ position: "absolute", left: 3, top: 2, width: 6, height: 5, background: "rgba(180,220,255,0.55)", borderRadius: 1 }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  BUS
// ─────────────────────────────────────────────────────────────
function Bus({ delay, duration, visible, yOffset, laneH }) {
  const top = Math.round(laneH / 2 - 10 + yOffset);
  return (
    <div style={{
      position: "absolute",
      left: 0, top,
      width: 58, height: 20,
      background: "#1D4ED8",
      borderRadius: 3,
      opacity: visible ? 1 : 0,
      transition: "opacity 0.5s",
      animation: `crs-driveLeft ${duration}s ${delay}s linear infinite`,
      zIndex: 2,
      willChange: "left",
    }}>
      {/* Windows */}
      {[8, 18, 28, 38].map(wx => (
        <div key={wx} style={{ position: "absolute", left: wx, top: 3, width: 8, height: 11, background: "rgba(180,220,255,0.72)", borderRadius: 1 }} />
      ))}
      {/* Front stripe */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, background: "#FCD34D", borderRadius: "0 3px 3px 0" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ROAD SECTION
// ─────────────────────────────────────────────────────────────
function CityRoad({ cfg, uberTax, busSubsidy, congestion }) {
  const { lanes, roadLaneH: laneH, sidewalkH: swH, sidewalkColor, roadColor, roadColorAlt } = cfg;

  // Vehicle visibility — policy drives count
  const carPressure = Math.max(0, (1 - uberTax / 100)) * (0.4 + 0.6 * (congestion / 100));
  const visibleCars = Math.min(MAX_CARS, Math.round(MAX_CARS * carPressure));
  const visibleBuses = Math.min(MAX_BUSES, Math.round(MAX_BUSES * (busSubsidy / 100)));

  // Speed: high congestion slows traffic
  const slowFactor = 1 + (congestion / 100) * 2.2;

  // Road tint overlay color at high congestion
  const tintAlpha = congestion > 65 ? 0.16 : congestion > 42 ? 0.09 : 0;
  const tintColor = congestion > 65
    ? `rgba(210, 75, 20, ${tintAlpha})`
    : `rgba(200, 140, 10, ${tintAlpha})`;

  const renderCarLane = (li) => {
    const pool = lanes === 1 ? CAR_POOL : CAR_POOL.filter(c => c.laneSlot === li % 2);
    const active = lanes === 1 ? visibleCars : Math.round(visibleCars * (li === 0 ? 0.55 : 0.45));
    return (
      <div key={`car-${li}`} style={{ position: "relative", height: laneH, background: roadColor, overflow: "hidden" }}>
        {li < lanes - 1 && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
            background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.3) 0, rgba(255,255,255,0.3) 20px, transparent 20px, transparent 42px)" }} />
        )}
        {pool.map((car, ci) => (
          <Car key={car.id}
            delay={car.delay}
            duration={car.baseDuration * slowFactor}
            color={car.color}
            visible={ci < active}
            yOffset={car.yOffset}
            laneH={laneH} />
        ))}
      </div>
    );
  };

  const renderBusLane = (li) => {
    const pool = lanes === 1 ? BUS_POOL : BUS_POOL.filter(b => b.laneSlot === li % 2);
    const active = lanes === 1 ? visibleBuses : Math.ceil(visibleBuses / lanes);
    return (
      <div key={`bus-${li}`} style={{ position: "relative", height: laneH, background: roadColorAlt, overflow: "hidden" }}>
        {li < lanes - 1 && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
            background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0, rgba(255,255,255,0.18) 20px, transparent 20px, transparent 42px)" }} />
        )}
        {pool.map((bus, bi) => (
          <Bus key={bus.id}
            delay={bus.delay}
            duration={bus.baseDuration * (slowFactor * 0.72)}
            visible={bi < active}
            yOffset={bus.yOffset}
            laneH={laneH} />
        ))}
      </div>
    );
  };

  return (
    <div style={{ width: "100%", position: "relative" }}>
      {/* Congestion tint */}
      {tintAlpha > 0 && (
        <div style={{ position: "absolute", inset: 0, background: tintColor, zIndex: 5, pointerEvents: "none", transition: "background 0.5s" }} />
      )}
      {/* Top sidewalk */}
      <div style={{ height: swH, background: sidewalkColor }} />
      {/* Car lanes → */}
      {Array.from({ length: lanes }, (_, i) => renderCarLane(i))}
      {/* Center double-yellow divider */}
      <div style={{ height: 4, background: roadColor, borderTop: "2px solid rgba(252,211,77,0.7)", borderBottom: "2px solid rgba(252,211,77,0.7)" }} />
      {/* Bus lanes ← */}
      {Array.from({ length: lanes }, (_, i) => renderBusLane(i))}
      {/* Bottom sidewalk */}
      <div style={{ height: swH, background: sidewalkColor }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  LEGEND  (floating bottom-left)
// ─────────────────────────────────────────────────────────────
function SceneLegend({ congestion }) {
  const congLabel = congestion > 65 ? "High" : congestion > 40 ? "Moderate" : "Low";
  const congColor = congestion > 65 ? "#DC2626" : congestion > 40 ? "#D97706" : "#166534";
  return (
    <div style={{
      position: "absolute", bottom: 10, left: 10,
      display: "flex", gap: 10, alignItems: "center",
      background: "rgba(255,255,255,0.88)",
      borderRadius: 8, padding: "5px 10px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      fontSize: 10, fontWeight: 600, color: "#374151",
      zIndex: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ width: 20, height: 9, background: "#DC2626", borderRadius: 2 }} />
        Car →
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ width: 32, height: 10, background: "#1D4ED8", borderRadius: 2 }} />
        Bus ←
      </div>
      <div style={{ color: congColor, fontWeight: 700 }}>
        Traffic: {congLabel}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN EXPORT
// ─────────────────────────────────────────────────────────────
export default function CityRoadScene({
  cityLevel = 1,
  uberTax = 0,
  busSubsidy = 0,
  congestion = 50,
  seasonIcon = null,
}) {
  const cfg = CITY_CONFIGS[cityLevel] || CITY_CONFIGS[1];

  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      background: cfg.groundColor,
      overflow: "hidden", userSelect: "none",
      position: "relative",
    }}>
      <style>{VEHICLE_KEYFRAMES}</style>

      {/* Sky */}
      <div style={{ height: cfg.skyH, background: cfg.skyColor, flexShrink: 0 }} />

      {/* Top buildings (rooftops face road) */}
      <CityBuildings cfg={cfg} side="top" cityLevel={cityLevel} />

      {/* Road — vertically centered in remaining space */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <CityRoad cfg={cfg} uberTax={uberTax} busSubsidy={busSubsidy} congestion={congestion} />
      </div>

      {/* Bottom buildings */}
      <CityBuildings cfg={cfg} side="bottom" cityLevel={cityLevel} />

      {/* Ground strip */}
      <div style={{ height: cfg.groundH, background: cfg.groundColor, flexShrink: 0 }} />

      {/* Scene overlays */}
      <SceneLegend congestion={congestion} />

      {seasonIcon && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          fontSize: 24,
          filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.3))",
          zIndex: 20,
        }}>
          {seasonIcon}
        </div>
      )}
    </div>
  );
}
