export const CIVILIZATIONS = {
  federation: { label: "星海联邦", shortLabel: "联邦", color: "#2c9bd1", count: 110 },
  ring: { label: "永恒环带", shortLabel: "环带", color: "#40aa68", count: 90 },
  abyss: { label: "深渊裂谷", shortLabel: "裂谷", color: "#d54f84", count: 90 },
  compact: { label: "商盟", shortLabel: "商盟", color: "#c8962f", count: 110 },
  neutral: { label: "中立节点", shortLabel: "中立", color: "#6f7f8d", count: 16 },
  contested: { label: "争议边境", shortLabel: "争议", color: "#d36d50", count: 12 },
  heritage: { label: "遗产隔离", shortLabel: "遗产", color: "#8f68c7", count: 12 },
  dark_zone: { label: "暗区边缘", shortLabel: "暗区", color: "#4f6072", count: 10 },
};

export const TYPE_LABELS = {
  capital: "文明首府",
  sector_capital: "星区首府",
  stargate_hub: "星门枢纽",
  major_anchor: "主空间锚",
  fleet_base: "舰队基地",
  ecology_core: "生态核心",
  sealed_gate: "封存门户",
  experiment_city: "实验城邦",
  deep_dive_outpost: "深潜前哨",
  trade_port: "贸易港",
  settlement: "定居节点",
  arbitration_port: "仲裁港",
  heritage_isolation: "遗产隔离点",
  incident_site: "事件地点",
};

export const STATUS_LABELS = {
  active: "运行",
  frontier: "边境",
  contested: "争议",
  sealed: "封存",
  quarantine: "隔离",
  incident: "事故",
  lost: "失联",
  draft: "草稿",
};

const TYPE_POOLS = {
  federation: ["sector_capital", "stargate_hub", "major_anchor", "fleet_base", "settlement"],
  ring: ["ecology_core", "sealed_gate", "major_anchor", "settlement"],
  abyss: ["experiment_city", "deep_dive_outpost", "incident_site", "settlement"],
  compact: ["trade_port", "stargate_hub", "arbitration_port", "major_anchor", "settlement"],
  neutral: ["arbitration_port", "trade_port", "settlement"],
  contested: ["arbitration_port", "incident_site", "major_anchor"],
  heritage: ["heritage_isolation", "incident_site", "sealed_gate"],
  dark_zone: ["incident_site", "deep_dive_outpost", "heritage_isolation"],
};

export function createStarMapData(seed = 1487002) {
  const rng = mulberry32(seed);
  const nodes = [];
  for (const civilization of Object.keys(CIVILIZATIONS)) {
    createNodes(nodes, civilization, rng);
  }

  return {
    nodes,
    summary: {
      seed,
      nodeCount: nodes.length,
      extents: "6500 x 4200 x 800 ly",
    },
  };
}

function createNodes(nodes, civilization, rng) {
  const count = CIVILIZATIONS[civilization].count;
  for (let index = 0; index < count; index += 1) {
    const position = projectPosition(civilization, index, count, rng);
    const type = chooseType(civilization, index, count, rng);
    const displayTier = chooseDisplayTier(civilization, index, count, type, rng);

    nodes.push({
      id: `${civilization}_${String(index + 1).padStart(3, "0")}`,
      name: `${CIVILIZATIONS[civilization].shortLabel}样本-${String(index + 1).padStart(3, "0")}`,
      civilization,
      type,
      x: Math.round(position.x),
      y: Math.round(position.y),
      z: Math.round(position.z),
      display_tier: displayTier,
      anchor_tier: chooseAnchorTier(type, displayTier, rng),
      population_tier: choosePopulationTier(type, displayTier, civilization, rng),
      route_importance: chooseRouteImportance(type, displayTier, civilization, rng),
      risk_level: chooseRiskLevel(civilization, displayTier, rng),
      status: chooseStatus(civilization, displayTier, rng),
      tags: createTags(civilization, type, displayTier),
      source: "03_专题设定/星际航行和开拓秩序/星海地理与星图节点.md",
    });
  }
}

function projectPosition(civilization, index, count, rng) {
  if (civilization === "federation") {
    if (index < 56) {
      const centers = [
        [-1980, -120],
        [-1360, 260],
        [-720, -80],
        [120, 180],
      ];
      const center = centers[index % centers.length];
      return pointNear(center[0], center[1] + armY(center[0]) * 0.2, 185, 135, 65, rng);
    }
    const arms = [
      [[-900, 60], [-2860, 980]],
      [[-420, 120], [880, 1340]],
      [[-160, -120], [1360, 760]],
      [[-1420, 160], [-2680, -720]],
    ];
    const arm = arms[index % arms.length];
    const t = ((index - 56) / Math.max(1, count - 56)) * 0.92 + rng() * 0.1;
    return pointOnSegment(arm[0], arm[1], t, 135, 55, rng);
  }

  if (civilization === "ring") {
    const t = index / Math.max(1, count - 1);
    const x = lerp(-2520, 2180, t);
    const y = armY(x) + 740 + 320 * Math.sin(t * Math.PI * 1.12) + normal(rng) * 85;
    return clampPosition({ x: x + normal(rng) * 82, y, z: normal(rng) * 48 });
  }

  if (civilization === "abyss") {
    const t = index / Math.max(1, count - 1);
    const x = lerp(320, 3020, t) + normal(rng) * 120;
    const y = lerp(-1510, -300, t) + normal(rng) * 120;
    return clampPosition({ x, y, z: normal(rng) * (index % 5 === 0 ? 150 : 88) });
  }

  if (civilization === "compact") {
    const centers = [
      [-1740, -360],
      [-980, 620],
      [120, 920],
      [860, -820],
      [1380, 360],
      [2240, -120],
      [2780, 520],
    ];
    const center = centers[index % centers.length];
    return pointNear(center[0], center[1] + armY(center[0]) * 0.1, 155, 125, 58, rng);
  }

  const rareCenters = {
    neutral: [[-360, 640], [690, 540], [1540, -180], [-2140, 420]],
    contested: [[-780, -760], [640, 1260], [1860, 60], [2360, -560]],
    heritage: [[-2780, -940], [420, -1320], [2020, -1180], [2820, 960]],
    dark_zone: [[-3120, 1180], [-2500, -1180], [2420, 1240], [3040, -880], [1420, -1700]],
  };
  const center = rareCenters[civilization][index % rareCenters[civilization].length];
  return pointNear(center[0], center[1], 125, 115, civilization === "dark_zone" ? 190 : 135, rng);
}

function chooseType(civilization, index, count, rng) {
  if (index === 0 && ["federation", "ring", "abyss", "compact"].includes(civilization)) return "capital";
  const pool = TYPE_POOLS[civilization];
  if (index < Math.ceil(count * 0.1)) return pool[0];
  if (index < Math.ceil(count * 0.28)) return pool[index % Math.min(pool.length, 3)];
  return pool[Math.floor(rng() * pool.length)];
}

function chooseDisplayTier(civilization, index, count, type, rng) {
  if (type === "capital") return 1;
  if (["heritage", "dark_zone"].includes(civilization)) return index < 3 ? 2 : 3;
  if (index < Math.round(count * 0.11)) return 1;
  if (index < Math.round(count * 0.42)) return 2;
  if (rng() > 0.72) return 4;
  return 3;
}

function chooseAnchorTier(type, displayTier, rng) {
  if (["capital", "stargate_hub", "major_anchor"].includes(type)) return 1;
  if (["fleet_base", "ecology_core", "trade_port", "sealed_gate"].includes(type)) return 2;
  if (displayTier <= 3 && rng() > 0.45) return 3;
  return 0;
}

function choosePopulationTier(type, displayTier, civilization, rng) {
  if (type === "capital") return 5;
  if (["sector_capital", "ecology_core", "trade_port", "stargate_hub"].includes(type)) return displayTier <= 2 ? 4 : 3;
  if (["heritage", "dark_zone"].includes(civilization)) return rng() > 0.7 ? 1 : 0;
  if (type === "settlement") return rng() > 0.45 ? 3 : 2;
  return Math.max(1, 4 - displayTier);
}

function chooseRouteImportance(type, displayTier, civilization, rng) {
  if (type === "capital") return 5;
  if (["stargate_hub", "major_anchor", "trade_port"].includes(type)) return rng() > 0.35 ? 5 : 4;
  if (displayTier === 1) return 4;
  if (displayTier === 2) return 3 + Math.round(rng());
  if (civilization === "dark_zone" || civilization === "heritage") return rng() > 0.55 ? 2 : 1;
  return 1 + Math.floor(rng() * 3);
}

function chooseRiskLevel(civilization, displayTier, rng) {
  if (civilization === "ring") return displayTier <= 2 ? 0 : 1;
  if (civilization === "federation") return displayTier <= 2 ? 1 : 1 + Math.round(rng());
  if (civilization === "compact") return displayTier <= 2 ? 1 + Math.round(rng()) : 2 + Math.round(rng());
  if (civilization === "abyss") return 2 + Math.min(2, Math.floor(rng() * 3));
  if (civilization === "neutral") return 1 + Math.floor(rng() * 3);
  if (civilization === "contested") return 3 + Math.round(rng());
  if (civilization === "heritage") return 4 + Math.round(rng());
  return 4 + Math.round(rng());
}

function chooseStatus(civilization, displayTier, rng) {
  if (civilization === "ring" && rng() > 0.84) return "sealed";
  if (civilization === "abyss") return rng() > 0.78 ? "incident" : "frontier";
  if (civilization === "compact") return rng() > 0.88 ? "contested" : "active";
  if (civilization === "neutral") return rng() > 0.75 ? "contested" : "active";
  if (civilization === "contested") return "contested";
  if (civilization === "heritage") return rng() > 0.55 ? "quarantine" : "sealed";
  if (civilization === "dark_zone") return rng() > 0.58 ? "lost" : "incident";
  if (displayTier === 4 && rng() > 0.62) return "draft";
  return "active";
}

function createTags(civilization, type, displayTier) {
  const tags = [CIVILIZATIONS[civilization].shortLabel, TYPE_LABELS[type]];
  if (displayTier === 1) tags.push("常驻核心");
  if (displayTier === 2) tags.push("区域节点");
  if (displayTier === 3) tags.push("剧情样本");
  if (displayTier === 4) tags.push("背景节点");
  if (["stargate_hub", "major_anchor"].includes(type)) tags.push("空间锚");
  if (civilization === "abyss" || civilization === "dark_zone") tags.push("深层扰动");
  if (civilization === "heritage") tags.push("遗产审查");
  return tags;
}

function armY(x) {
  return 240 * Math.sin((x + 700) / 850) + 120 * Math.sin(x / 1500);
}

function pointNear(x, y, spreadX, spreadY, spreadZ, rng) {
  return clampPosition({
    x: x + normal(rng) * spreadX,
    y: y + normal(rng) * spreadY,
    z: normal(rng) * spreadZ,
  });
}

function pointOnSegment(start, end, t, spread, spreadZ, rng) {
  return clampPosition({
    x: lerp(start[0], end[0], t) + normal(rng) * spread,
    y: lerp(start[1], end[1], t) + normal(rng) * spread,
    z: normal(rng) * spreadZ,
  });
}

function clampPosition(position) {
  return {
    x: clamp(position.x, -3200, 3200),
    y: clamp(position.y, -2100, 2100),
    z: clamp(position.z, -800, 800),
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normal(rng) {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
