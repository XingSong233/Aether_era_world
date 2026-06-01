import { createStarfield } from "./starfield.js";
import { createParticleField } from "./particle-field.js";

const DATA_URL = "./data/starsea-topology.json";

const edgeTypeMeta = {
  stargate: { label: "星门通行", color: "#74c6ff", glow: "rgba(116, 198, 255, 0.42)", width: 3.6, dash: [] },
  etherCurrent: { label: "以太洋流", color: "#77e6bd", glow: "rgba(119, 230, 189, 0.34)", width: 3.0, dash: [10, 8] },
  anchorChain: { label: "锚链航行", color: "#f0d483", glow: "rgba(240, 212, 131, 0.35)", width: 2.7, dash: [5, 6] },
  freeJump: { label: "自由跃迁", color: "#f08aa4", glow: "rgba(240, 138, 164, 0.34)", width: 2.7, dash: [14, 7, 3, 7] },
  darkDrift: { label: "暗区潜航", color: "#aa8ce8", glow: "rgba(170, 140, 232, 0.34)", width: 2.4, dash: [2, 7] }
};

const nodeTypeMeta = {
  capitalHub: { label: "首府枢纽", size: 11, shape: "circle" },
  stargate: { label: "星门枢纽", size: 10, shape: "diamond" },
  researchPort: { label: "研究港", size: 9, shape: "hex" },
  anchor: { label: "空间锚", size: 9, shape: "square" },
  rescueBase: { label: "救援基地", size: 9, shape: "circle" },
  colony: { label: "殖民地", size: 8, shape: "circle" },
  habitat: { label: "生态环", size: 10, shape: "hex" },
  watchPort: { label: "守望锚", size: 9, shape: "square" },
  sealedArchive: { label: "封存库", size: 9, shape: "diamond" },
  freePort: { label: "自由港", size: 10, shape: "circle" },
  clearingHub: { label: "清算枢纽", size: 9, shape: "hex" },
  market: { label: "模块市场", size: 9, shape: "circle" },
  deepStation: { label: "深层站", size: 10, shape: "hex" },
  experimentPort: { label: "实验港", size: 9, shape: "square" },
  anomaly: { label: "异常区", size: 10, shape: "diamond" },
  surveyPoint: { label: "测绘点", size: 8, shape: "square" },
  ruin: { label: "遗迹", size: 10, shape: "diamond" },
  signal: { label: "异常信号", size: 10, shape: "diamond" },
  exclusion: { label: "禁航区", size: 10, shape: "hex" },
  swarmWake: { label: "虫群尾迹", size: 10, shape: "diamond" }
};

const state = {
  data: null,
  nodeById: new Map(),
  edgeById: new Map(),
  adjacency: new Map(),
  selectedNodeId: null,
  hoveredNodeId: null,
  hoveredEdgeId: null,
  startId: null,
  endId: null,
  route: null,
  transform: { scale: 0.78, x: 0, y: 0 },
  drag: { active: false, moved: false, lastX: 0, lastY: 0 },
  pointer: { x: 0, y: 0 },
  layers: {
    influence: true,
    risk: true,
    routes: true,
    labels: true,
    forbidden: true
  }
};

const canvas = document.querySelector("#mapCanvas");
const ctx = canvas.getContext("2d");
const tooltip = document.querySelector("#tooltip");
const mapStage = document.querySelector(".map-stage");

const controls = {
  faction: document.querySelector("#factionSelect"),
  ship: document.querySelector("#shipSelect"),
  mission: document.querySelector("#missionSelect"),
  start: document.querySelector("#startSelect"),
  end: document.querySelector("#endSelect"),
  routeButton: document.querySelector("#routeButton"),
  clearButton: document.querySelector("#clearButton"),
  fitButton: document.querySelector("#fitButton"),
  swapButton: document.querySelector("#swapButton"),
  viewStatus: document.querySelector("#viewStatus"),
  selectedTitle: document.querySelector("#selectedTitle"),
  selectedMeta: document.querySelector("#selectedMeta"),
  selectedTags: document.querySelector("#selectedTags"),
  selectedDescription: document.querySelector("#selectedDescription"),
  selectedMetrics: document.querySelector("#selectedMetrics"),
  routeSummary: document.querySelector("#routeSummary"),
  routeBreakdown: document.querySelector("#routeBreakdown"),
  routeSteps: document.querySelector("#routeSteps"),
  modelSummary: document.querySelector("#modelSummary"),
  layers: {
    influence: document.querySelector("#layerInfluence"),
    risk: document.querySelector("#layerRisk"),
    routes: document.querySelector("#layerRoutes"),
    labels: document.querySelector("#layerLabels"),
    forbidden: document.querySelector("#layerForbidden")
  }
};

init();
createStarfield(mapStage);
createParticleField();

async function init() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`数据读取失败：${response.status}`);
    }
    state.data = await response.json();
    indexData();
    populateControls();
    bindEvents();
    resizeCanvas();
    fitView();
    updateModelSummary();
    updateSelection(null);
    updateRoute();
    render();
    controls.viewStatus.textContent = "已载入拓扑样例，可点击节点或计算航线。";
  } catch (error) {
    controls.viewStatus.textContent = "无法载入拓扑数据，请通过本地服务器打开 index.html。";
    console.error(error);
  }
}

function indexData() {
  state.data.nodes.forEach((node) => state.nodeById.set(node.id, node));
  state.data.edges.forEach((edge) => {
    state.edgeById.set(edge.id, edge);
    if (!state.adjacency.has(edge.from)) state.adjacency.set(edge.from, []);
    if (!state.adjacency.has(edge.to)) state.adjacency.set(edge.to, []);
    state.adjacency.get(edge.from).push({ edge, to: edge.to });
    state.adjacency.get(edge.to).push({ edge, to: edge.from });
  });
}

function populateControls() {
  fillSelect(controls.faction, state.data.factions, "federation");
  fillSelect(controls.ship, state.data.shipProfiles, "expedition");
  fillSelect(controls.mission, state.data.missions, "balanced");

  const sortedNodes = [...state.data.nodes].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  for (const select of [controls.start, controls.end]) {
    select.innerHTML = "";
    for (const node of sortedNodes) {
      const option = document.createElement("option");
      option.value = node.id;
      option.textContent = node.name;
      select.appendChild(option);
    }
  }
  controls.start.value = "solaris-prime";
  controls.end.value = "old-gate-ruin";
  state.startId = controls.start.value;
  state.endId = controls.end.value;
}

function fillSelect(select, collection, defaultValue) {
  select.innerHTML = "";
  Object.entries(collection).forEach(([id, item]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = item.name;
    select.appendChild(option);
  });
  select.value = defaultValue;
}

function bindEvents() {
  window.addEventListener("resize", () => {
    resizeCanvas();
    render();
  });

  controls.faction.addEventListener("change", handleModelChange);
  controls.ship.addEventListener("change", handleModelChange);
  controls.mission.addEventListener("change", handleModelChange);
  controls.start.addEventListener("change", () => {
    state.startId = controls.start.value;
    updateRoute();
    render();
  });
  controls.end.addEventListener("change", () => {
    state.endId = controls.end.value;
    updateRoute();
    render();
  });
  controls.routeButton.addEventListener("click", () => {
    updateRoute(true);
    render();
  });
  controls.clearButton.addEventListener("click", clearRoute);
  controls.fitButton.addEventListener("click", () => {
    fitView();
    render();
  });
  controls.swapButton.addEventListener("click", () => {
    const previousStart = state.startId;
    setStartEnd(state.endId, previousStart);
    updateRoute(true);
    render();
  });

  Object.entries(controls.layers).forEach(([key, checkbox]) => {
    checkbox.addEventListener("change", () => {
      state.layers[key] = checkbox.checked;
      render();
    });
  });

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("dragging");
    state.drag.active = true;
    state.drag.moved = false;
    state.drag.lastX = event.clientX;
    state.drag.lastY = event.clientY;
  });

  canvas.addEventListener("pointermove", (event) => {
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    if (state.drag.active) {
      const dx = event.clientX - state.drag.lastX;
      const dy = event.clientY - state.drag.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        state.drag.moved = true;
      }
      state.transform.x += dx;
      state.transform.y += dy;
      state.drag.lastX = event.clientX;
      state.drag.lastY = event.clientY;
      render();
      return;
    }

    const local = eventToCanvas(event);
    const world = screenToWorld(local.x, local.y);
    const hitNode = findNodeAt(world.x, world.y);
    const hitEdge = hitNode ? null : findEdgeAt(world.x, world.y);
    state.hoveredNodeId = hitNode?.id ?? null;
    state.hoveredEdgeId = hitEdge?.id ?? null;
    updateTooltip(event, hitNode, hitEdge);
    render();
  });

  canvas.addEventListener("pointerup", (event) => {
    canvas.releasePointerCapture(event.pointerId);
    canvas.classList.remove("dragging");
    const wasClick = state.drag.active && !state.drag.moved;
    state.drag.active = false;
    if (wasClick) {
      const local = eventToCanvas(event);
      const world = screenToWorld(local.x, local.y);
      const node = findNodeAt(world.x, world.y);
      if (node) {
        handleNodeClick(node);
      }
    }
  });

  canvas.addEventListener("pointerleave", () => {
    state.hoveredNodeId = null;
    state.hoveredEdgeId = null;
    tooltip.hidden = true;
    render();
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const local = eventToCanvas(event);
      const before = screenToWorld(local.x, local.y);
      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      state.transform.scale = clamp(state.transform.scale * factor, 0.32, 2.4);
      const after = screenToWorld(local.x, local.y);
      state.transform.x += (after.x - before.x) * state.transform.scale;
      state.transform.y += (after.y - before.y) * state.transform.scale;
      render();
    },
    { passive: false }
  );
}

function handleModelChange() {
  updateModelSummary();
  updateRoute();
  render();
}

function handleNodeClick(node) {
  state.selectedNodeId = node.id;
  updateSelection(node);

  if (!state.startId || (state.startId && state.endId)) {
    setStartEnd(node.id, "");
  } else if (state.startId !== node.id) {
    setStartEnd(state.startId, node.id);
  }

  updateRoute();
  render();
}

function setStartEnd(startId, endId) {
  state.startId = startId;
  state.endId = endId;
  controls.start.value = startId || controls.start.options[0]?.value || "";
  controls.end.value = endId || controls.end.options[0]?.value || "";
}

function clearRoute() {
  state.route = null;
  state.startId = "";
  state.endId = "";
  controls.routeSummary.textContent = "请选择起点和终点。";
  controls.routeBreakdown.innerHTML = "";
  controls.routeSteps.innerHTML = "";
  render();
}

function updateRoute(forceMessage = false) {
  state.startId = controls.start.value || state.startId;
  state.endId = controls.end.value || state.endId;

  if (!state.startId || !state.endId || state.startId === state.endId) {
    state.route = null;
    controls.routeSummary.textContent = state.startId === state.endId ? "起点和终点相同。" : "请选择起点和终点。";
    controls.routeBreakdown.innerHTML = "";
    controls.routeSteps.innerHTML = "";
    return;
  }

  state.route = computeRoute(state.startId, state.endId);
  renderRouteResult(forceMessage);
}

function computeRoute(startId, endId) {
  const dist = new Map();
  const previous = new Map();
  const unvisited = new Set(state.data.nodes.map((node) => node.id));

  state.data.nodes.forEach((node) => dist.set(node.id, Infinity));
  dist.set(startId, 0);

  while (unvisited.size) {
    let current = null;
    let best = Infinity;
    for (const id of unvisited) {
      const value = dist.get(id);
      if (value < best) {
        best = value;
        current = id;
      }
    }

    if (!current || best === Infinity) break;
    if (current === endId) break;
    unvisited.delete(current);

    for (const item of state.adjacency.get(current) ?? []) {
      if (!unvisited.has(item.to)) continue;
      const evaluation = evaluateEdge(item.edge);
      if (!evaluation.passable) continue;
      const alt = dist.get(current) + evaluation.cost;
      if (alt < dist.get(item.to)) {
        dist.set(item.to, alt);
        previous.set(item.to, { from: current, edge: item.edge, evaluation });
      }
    }
  }

  if (!previous.has(endId) && startId !== endId) {
    return { found: false, blocked: summarizeBlockedEdges(startId, endId) };
  }

  const steps = [];
  let current = endId;
  while (current !== startId) {
    const item = previous.get(current);
    if (!item) break;
    steps.unshift({
      from: item.from,
      to: current,
      edge: item.edge,
      evaluation: item.evaluation
    });
    current = item.from;
  }

  const totals = summarizeRoute(steps);
  return {
    found: true,
    startId,
    endId,
    cost: dist.get(endId),
    steps,
    totals
  };
}

function evaluateEdge(edge) {
  const faction = state.data.factions[controls.faction.value];
  const ship = state.data.shipProfiles[controls.ship.value];
  const mission = state.data.missions[controls.mission.value];
  const weights = combineWeights(faction.weights, ship.weights, mission.weights);
  const reasons = [];
  let passable = true;
  let penalty = 0;

  if (!ship.allowedTypes.includes(edge.type)) {
    passable = false;
    reasons.push(`${ship.name}不能使用${edgeTypeMeta[edge.type].label}`);
  }
  if (edge.hazard > ship.maxHazard) {
    passable = false;
    reasons.push(`危险等级 ${edge.hazard} 超过船型阈值 ${ship.maxHazard}`);
  }
  if (edge.visibility === "forbidden" && controls.ship.value !== "military") {
    passable = false;
    reasons.push("禁航航迹仅军用审计或封存模拟可读");
  }
  if (edge.visibility === "restricted" && controls.ship.value === "civilian") {
    passable = false;
    reasons.push("民用客运船不能进入限制航迹");
  }
  if (edge.status === "sealed" && !["military", "expedition"].includes(controls.ship.value)) {
    passable = false;
    reasons.push("封存航段需要军用或远征级复核");
  }

  if (controls.faction.value === "ring" && edge.hazard >= 9) penalty += 26;
  if (controls.faction.value === "ring" && edge.visibility !== "public") penalty += 6;
  if (controls.faction.value === "abyss" && edge.type === "darkDrift") penalty -= 5;
  if (controls.faction.value === "compact" && edge.capacity >= 7) penalty -= 3;
  if (controls.faction.value === "federation" && edge.rescue >= 7) penalty -= 2;
  if (controls.ship.value === "covert" && edge.visibility === "public") penalty += 4;
  if (controls.ship.value === "covert" && edge.visibility === "restricted") penalty -= 2;

  if (edge.status === "volatile") penalty += 8;
  if (edge.status === "sealed") penalty += 14;
  if (edge.visibility === "restricted") penalty += 5;
  if (edge.visibility === "forbidden") penalty += 32;

  const rescueGap = Math.max(0, 8 - edge.rescue);
  const raw =
    edge.energy * weights.energy +
    edge.time * weights.time +
    edge.hazard * weights.hazard +
    edge.authority * weights.authority +
    edge.inspection * weights.inspection +
    edge.insurance * weights.insurance +
    rescueGap * weights.rescueGap -
    edge.capacity * weights.capacityBonus +
    penalty;

  return {
    passable,
    reasons,
    cost: Math.max(1, Number(raw.toFixed(2))),
    weights,
    penalty
  };
}

function combineWeights(faction, ship, mission) {
  const result = {};
  for (const key of Object.keys(faction)) {
    result[key] = faction[key] * ship[key] * mission[key];
  }
  return result;
}

function summarizeRoute(steps) {
  return steps.reduce(
    (totals, step) => {
      const edge = step.edge;
      totals.energy += edge.energy;
      totals.time += edge.time;
      totals.hazard += edge.hazard;
      totals.authority += edge.authority;
      totals.inspection += edge.inspection;
      totals.insurance += edge.insurance;
      totals.capacity += edge.capacity;
      totals.rescue += edge.rescue;
      totals.jumpCount += edge.jumpCount;
      totals.cost += step.evaluation.cost;
      totals.penalty += step.evaluation.penalty;
      return totals;
    },
    {
      energy: 0,
      time: 0,
      hazard: 0,
      authority: 0,
      inspection: 0,
      insurance: 0,
      capacity: 0,
      rescue: 0,
      jumpCount: 0,
      cost: 0,
      penalty: 0
    }
  );
}

function summarizeBlockedEdges(startId, endId) {
  const direct = state.data.edges.filter(
    (edge) => (edge.from === startId && edge.to === endId) || (edge.from === endId && edge.to === startId)
  );
  return direct.map((edge) => ({ edge, evaluation: evaluateEdge(edge) }));
}

function renderRouteResult(forceMessage = false) {
  if (!state.route?.found) {
    const blockedText = state.route?.blocked?.length
      ? state.route.blocked
          .map((item) => `${item.edge.description}：${item.evaluation.reasons.join("；") || "成本过高"}`)
          .join(" ")
      : "当前视角和船型下找不到可通行路径。";
    controls.routeSummary.textContent = blockedText;
    controls.routeBreakdown.innerHTML = "";
    controls.routeSteps.innerHTML = "";
    return;
  }

  const route = state.route;
  const start = state.nodeById.get(route.startId);
  const end = state.nodeById.get(route.endId);
  const faction = state.data.factions[controls.faction.value];
  const ship = state.data.shipProfiles[controls.ship.value];
  const mission = state.data.missions[controls.mission.value];
  controls.routeSummary.innerHTML = `<strong>${faction.shortName}</strong>视角下，${ship.name}执行“${mission.name}”任务，从<strong>${start.name}</strong>到<strong>${end.name}</strong>的有效航线共 ${route.steps.length} 段。`;
  controls.routeBreakdown.innerHTML = metricsMarkup([
    ["有效成本", route.totals.cost.toFixed(1)],
    ["跃迁批次", route.totals.jumpCount],
    ["能源成本", route.totals.energy],
    ["风险暴露", route.totals.hazard],
    ["复检压力", route.totals.inspection],
    ["保险压力", route.totals.insurance]
  ]);
  controls.routeSteps.innerHTML = route.steps
    .map((step) => {
      const from = state.nodeById.get(step.from);
      const to = state.nodeById.get(step.to);
      const meta = edgeTypeMeta[step.edge.type];
      return `<li><strong>${from.name}</strong> 到 <strong>${to.name}</strong><br>${meta.label}，${step.edge.status}，成本 ${step.evaluation.cost.toFixed(1)}。${step.edge.description}</li>`;
    })
    .join("");

  if (forceMessage) {
    controls.viewStatus.textContent = `已计算：${start.name} 至 ${end.name}，有效成本 ${route.totals.cost.toFixed(1)}。`;
  }
}

function updateSelection(node) {
  if (!node) {
    controls.selectedTitle.textContent = "未选择节点";
    controls.selectedMeta.textContent = "点击画布节点查看详情；第一次点击设为起点，第二次点击设为终点。";
    controls.selectedTags.innerHTML = "";
    controls.selectedDescription.textContent = "";
    controls.selectedMetrics.innerHTML = "";
    return;
  }

  const faction = state.data.factions[node.owner];
  controls.selectedTitle.textContent = node.name;
  controls.selectedMeta.textContent = `${nodeTypeMeta[node.type]?.label ?? node.type} / ${faction.name}`;
  controls.selectedTags.innerHTML = node.tags.map((tag) => `<span class="tag">${tag}</span>`).join("");
  controls.selectedDescription.textContent = node.description;
  controls.selectedMetrics.innerHTML = metricsMarkup([
    ["星港等级", node.portLevel],
    ["场域稳定", node.stability],
    ["救援能力", node.rescue],
    ["复检强度", node.inspection],
    ["遗产风险", node.legacyRisk],
    ["深层风险", node.deepRisk]
  ]);
}

function updateModelSummary() {
  const faction = state.data.factions[controls.faction.value];
  const ship = state.data.shipProfiles[controls.ship.value];
  const mission = state.data.missions[controls.mission.value];
  controls.modelSummary.innerHTML = `
    <div><b>${faction.name}</b>：${faction.description}</div>
    <div><b>${ship.name}</b>：${ship.description}</div>
    <div><b>${mission.name}</b>：${mission.description}</div>
  `;
}

function metricsMarkup(items) {
  return items
    .map(
      ([label, value]) => `
        <dl class="metric">
          <dt>${label}</dt>
          <dd>${value}</dd>
        </dl>
      `
    )
    .join("");
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function fitView() {
  if (!state.data) return;
  const rect = canvas.getBoundingClientRect();
  const desktopHud = rect.width > 1120;
  const viewport = desktopHud
    ? {
        left: 360,
        top: 112,
        width: Math.max(360, rect.width - 760),
        height: Math.max(360, rect.height - 158)
      }
    : {
        left: 48,
        top: 96,
        width: Math.max(280, rect.width - 96),
        height: Math.max(280, rect.height - 150)
      };
  const bounds = state.data.nodes.reduce(
    (box, node) => ({
      minX: Math.min(box.minX, node.x),
      maxX: Math.max(box.maxX, node.x),
      minY: Math.min(box.minY, node.y),
      maxY: Math.max(box.maxY, node.y)
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );
  const padding = rect.width < 760 ? 70 : 120;
  const scaleX = (viewport.width - padding) / (bounds.maxX - bounds.minX);
  const scaleY = (viewport.height - padding) / (bounds.maxY - bounds.minY);
  state.transform.scale = clamp(Math.min(scaleX, scaleY), 0.35, 1.25);
  state.transform.x = viewport.left + viewport.width / 2 - ((bounds.minX + bounds.maxX) / 2) * state.transform.scale;
  state.transform.y = viewport.top + viewport.height / 2 - ((bounds.minY + bounds.maxY) / 2) * state.transform.scale;
}

function render() {
  if (!state.data) return;
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  drawBackground(rect);

  ctx.save();
  ctx.translate(state.transform.x, state.transform.y);
  ctx.scale(state.transform.scale, state.transform.scale);

  if (state.layers.influence) drawInfluence();
  if (state.layers.risk) drawRiskLayer();
  if (state.layers.routes) drawEdges();
  drawNodes();
  if (state.layers.labels) drawLabels();

  ctx.restore();
}

function drawBackground(rect) {
  ctx.save();
  const background = ctx.createLinearGradient(0, 0, rect.width, rect.height);
  background.addColorStop(0, "rgba(7, 16, 24, 0.28)");
  background.addColorStop(0.48, "rgba(5, 8, 12, 0.18)");
  background.addColorStop(1, "rgba(13, 17, 19, 0.26)");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, rect.width, rect.height);

  const hazeA = ctx.createRadialGradient(rect.width * 0.28, rect.height * 0.24, 0, rect.width * 0.28, rect.height * 0.24, rect.width * 0.48);
  hazeA.addColorStop(0, "rgba(103, 212, 195, 0.13)");
  hazeA.addColorStop(1, "rgba(103, 212, 195, 0)");
  ctx.fillStyle = hazeA;
  ctx.fillRect(0, 0, rect.width, rect.height);

  const hazeB = ctx.createRadialGradient(rect.width * 0.76, rect.height * 0.58, 0, rect.width * 0.76, rect.height * 0.58, rect.width * 0.46);
  hazeB.addColorStop(0, "rgba(170, 140, 232, 0.12)");
  hazeB.addColorStop(1, "rgba(170, 140, 232, 0)");
  ctx.fillStyle = hazeB;
  ctx.fillRect(0, 0, rect.width, rect.height);

  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = "rgba(103, 212, 195, 0.2)";
  ctx.lineWidth = 1;
  for (let x = (state.transform.x % 72) - 72; x < rect.width + 72; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, rect.height);
    ctx.stroke();
  }
  for (let y = (state.transform.y % 72) - 72; y < rect.height + 72; y += 72) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(rect.width, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 210; i += 1) {
    const x = seededNoise(i * 13.3) * rect.width;
    const y = seededNoise(i * 29.7 + 4) * rect.height;
    const size = seededNoise(i * 9.1 + 2) * 1.3 + 0.35;
    ctx.fillStyle = i % 9 === 0 ? "#f0d483" : i % 5 === 0 ? "#77e6bd" : "#dce7df";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawInfluence() {
  for (const node of state.data.nodes) {
    const faction = state.data.factions[node.owner];
    if (!faction || node.owner === "unknown") continue;
    const radius = node.influence * 1.08;
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius);
    gradient.addColorStop(0, faction.softColor);
    gradient.addColorStop(0.38, faction.softColor);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRiskLayer() {
  for (const node of state.data.nodes) {
    const risk = Math.max(node.deepRisk, node.legacyRisk);
    if (risk < 5) continue;
    const radius = 66 + risk * 19;
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius);
    gradient.addColorStop(0, `rgba(225, 115, 108, ${0.04 + risk * 0.012})`);
    gradient.addColorStop(0.48, `rgba(170, 140, 232, ${0.025 + risk * 0.01})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEdges() {
  const routeEdgeIds = new Set(state.route?.found ? state.route.steps.map((step) => step.edge.id) : []);
  for (const edge of state.data.edges) {
    if (!state.layers.forbidden && ["restricted", "forbidden"].includes(edge.visibility)) continue;
    drawEdge(edge, routeEdgeIds.has(edge.id));
  }
}

function drawEdge(edge, highlighted) {
  const from = state.nodeById.get(edge.from);
  const to = state.nodeById.get(edge.to);
  const meta = edgeTypeMeta[edge.type];
  const evaluation = evaluateEdge(edge);
  const opacity = highlighted ? 1 : evaluation.passable ? 0.58 : 0.16;
  const width = highlighted ? meta.width + 3.2 : meta.width;
  const curve = edgeCurve(from, to, edge.id);

  ctx.save();
  ctx.lineCap = "round";
  ctx.setLineDash(meta.dash);
  ctx.globalAlpha = highlighted ? 0.56 : opacity * 0.46;
  ctx.lineWidth = width + 7;
  ctx.strokeStyle = highlighted ? "rgba(255, 239, 176, 0.7)" : meta.glow;
  ctx.shadowColor = highlighted ? "rgba(255, 239, 176, 0.82)" : meta.glow;
  ctx.shadowBlur = highlighted ? 22 : 12;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(curve.cx, curve.cy, to.x, to.y);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = opacity;
  ctx.lineWidth = width;
  ctx.strokeStyle = highlighted ? "#fff0b3" : meta.color;
  ctx.setLineDash(highlighted ? [] : meta.dash);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(curve.cx, curve.cy, to.x, to.y);
  ctx.stroke();

  if (!evaluation.passable) {
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = width + 2;
    ctx.setLineDash([1, 9]);
    ctx.strokeStyle = "#ffaaa0";
    ctx.stroke();
  }
  ctx.restore();
}

function drawNodes() {
  const routeNodeIds = new Set();
  if (state.route?.found) {
    routeNodeIds.add(state.route.startId);
    routeNodeIds.add(state.route.endId);
    state.route.steps.forEach((step) => {
      routeNodeIds.add(step.from);
      routeNodeIds.add(step.to);
    });
  }

  for (const node of state.data.nodes) {
    const faction = state.data.factions[node.owner];
    const meta = nodeTypeMeta[node.type] ?? { size: 8, shape: "circle" };
    const highlighted =
      node.id === state.startId ||
      node.id === state.endId ||
      node.id === state.hoveredNodeId ||
      node.id === state.selectedNodeId ||
      routeNodeIds.has(node.id);
    const size = meta.size + (highlighted ? 4 : 0);

    ctx.save();
    ctx.shadowColor = faction.color;
    ctx.shadowBlur = highlighted ? 28 : 14;
    ctx.globalAlpha = highlighted ? 0.28 : 0.14;
    ctx.fillStyle = faction.color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, size * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = faction.color;
    ctx.strokeStyle = highlighted ? "#fff3c2" : "rgba(234, 250, 246, 0.72)";
    ctx.lineWidth = highlighted ? 2.6 : 1.4;
    drawNodeShape(node.x, node.y, size, meta.shape);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
    drawNodeShape(node.x, node.y, size * 0.58, meta.shape);
    ctx.stroke();

    ctx.shadowBlur = 0;
    if (node.id === state.startId || node.id === state.endId) {
      ctx.fillStyle = "#111313";
      ctx.font = "700 9px Microsoft YaHei, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.id === state.startId ? "起" : "终", node.x, node.y + 0.3);
    }
    ctx.restore();
  }
}

function drawLabels() {
  ctx.save();
  ctx.font = "12px Microsoft YaHei, Noto Sans SC, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const node of state.data.nodes) {
    const meta = nodeTypeMeta[node.type] ?? { size: 8 };
    const labelOffset = meta.size + 9;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(3, 7, 10, 0.82)";
    ctx.fillStyle = node.id === state.hoveredNodeId ? "#fff2bb" : "rgba(239, 249, 246, 0.82)";
    ctx.shadowColor = "rgba(103, 212, 195, 0.24)";
    ctx.shadowBlur = node.id === state.hoveredNodeId ? 16 : 6;
    ctx.strokeText(node.name, node.x, node.y + labelOffset);
    ctx.fillText(node.name, node.x, node.y + labelOffset);
  }
  ctx.restore();
}

function drawNodeShape(x, y, size, shape) {
  ctx.beginPath();
  if (shape === "square") {
    ctx.rect(x - size, y - size, size * 2, size * 2);
  } else if (shape === "diamond") {
    ctx.moveTo(x, y - size * 1.25);
    ctx.lineTo(x + size * 1.25, y);
    ctx.lineTo(x, y + size * 1.25);
    ctx.lineTo(x - size * 1.25, y);
    ctx.closePath();
  } else if (shape === "hex") {
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.PI / 6 + (Math.PI * 2 * i) / 6;
      const px = x + Math.cos(angle) * size * 1.15;
      const py = y + Math.sin(angle) * size * 1.15;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else {
    ctx.arc(x, y, size, 0, Math.PI * 2);
  }
}

function updateTooltip(event, node, edge) {
  if (!node && !edge) {
    tooltip.hidden = true;
    return;
  }

  const rect = canvas.getBoundingClientRect();
  tooltip.hidden = false;
  tooltip.style.left = `${Math.min(rect.width - 292, event.clientX - rect.left + 16)}px`;
  tooltip.style.top = `${Math.max(10, event.clientY - rect.top + 16)}px`;

  if (node) {
    const faction = state.data.factions[node.owner];
    tooltip.innerHTML = `<strong>${node.name}</strong><br>${nodeTypeMeta[node.type]?.label ?? node.type} / ${faction.shortName}<br>稳定 ${node.stability}，救援 ${node.rescue}，深层风险 ${node.deepRisk}`;
    return;
  }

  const from = state.nodeById.get(edge.from);
  const to = state.nodeById.get(edge.to);
  const evaluation = evaluateEdge(edge);
  tooltip.innerHTML = `<strong>${from.name} 到 ${to.name}</strong><br>${edgeTypeMeta[edge.type].label} / ${edge.status}<br>有效成本 ${evaluation.cost.toFixed(1)}，危险 ${edge.hazard}，救援 ${edge.rescue}`;
}

function findNodeAt(x, y) {
  const scaleAware = 9 / state.transform.scale;
  for (let i = state.data.nodes.length - 1; i >= 0; i -= 1) {
    const node = state.data.nodes[i];
    const meta = nodeTypeMeta[node.type] ?? { size: 8 };
    const radius = meta.size + scaleAware;
    if (distance(x, y, node.x, node.y) <= radius) {
      return node;
    }
  }
  return null;
}

function findEdgeAt(x, y) {
  let best = null;
  let bestDistance = 10 / state.transform.scale;
  for (const edge of state.data.edges) {
    const from = state.nodeById.get(edge.from);
    const to = state.nodeById.get(edge.to);
    const curve = edgeCurve(from, to, edge.id);
    const sampled = distanceToQuadratic(x, y, from, curve, to);
    if (sampled < bestDistance) {
      bestDistance = sampled;
      best = edge;
    }
  }
  return best;
}

function edgeCurve(from, to, seed) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / len;
  const normalY = dx / len;
  const bend = (seededString(seed) - 0.5) * 56;
  return { cx: midX + normalX * bend, cy: midY + normalY * bend };
}

function distanceToQuadratic(x, y, from, control, to) {
  let best = Infinity;
  let previous = from;
  for (let i = 1; i <= 24; i += 1) {
    const t = i / 24;
    const point = quadraticPoint(from, control, to, t);
    best = Math.min(best, distanceToSegment(x, y, previous.x, previous.y, point.x, point.y));
    previous = point;
  }
  return best;
}

function quadraticPoint(from, control, to, t) {
  const inv = 1 - t;
  return {
    x: inv * inv * from.x + 2 * inv * t * control.cx + t * t * to.x,
    y: inv * inv * from.y + 2 * inv * t * control.cy + t * t * to.y
  };
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return distance(px, py, x1, y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1);
  return distance(px, py, x1 + t * dx, y1 + t * dy);
}

function eventToCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function screenToWorld(x, y) {
  return {
    x: (x - state.transform.x) / state.transform.scale,
    y: (y - state.transform.y) / state.transform.scale
  };
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function seededNoise(value) {
  return fract(Math.sin(value * 12.9898) * 43758.5453);
}

function seededString(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return seededNoise(hash);
}

function fract(value) {
  return value - Math.floor(value);
}
