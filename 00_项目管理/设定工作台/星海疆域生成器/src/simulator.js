(function () {
  "use strict";

  const CIVS = [
    {
      id: "federation",
      name: "星海联邦",
      shortName: "联邦",
      color: "#2f73bd",
      output: 1.04,
      deepCost: 1.0,
      gateCost: 0.96,
      relicWeight: 0.9,
    },
    {
      id: "ring",
      name: "永恒环带",
      shortName: "环带",
      color: "#3d9b6c",
      output: 0.92,
      deepCost: 1.28,
      gateCost: 1.04,
      relicWeight: 0.72,
    },
    {
      id: "abyss",
      name: "深渊裂谷",
      shortName: "裂谷",
      color: "#a94772",
      output: 0.98,
      deepCost: 0.72,
      gateCost: 1.02,
      relicWeight: 1.28,
    },
    {
      id: "compact",
      name: "商盟",
      shortName: "商盟",
      color: "#d09034",
      output: 1.1,
      deepCost: 1.06,
      gateCost: 0.82,
      relicWeight: 1.0,
    },
  ];

  const CIV_NONE = -1;
  const STORAGE_KEY = "aether-starsea-generator:last-run";
  const WORLD = {
    minX: -3200,
    maxX: 3200,
    minY: -2100,
    maxY: 2100,
  };

  const ids = {
    canvas: "mapCanvas",
    tooltip: "tooltip",
    statusText: "statusText",
    stepBadge: "stepBadge",
    summaryStats: "summaryStats",
    stepSlider: "stepSlider",
    stepInput: "stepInput",
    runButton: "runButton",
    resetViewButton: "resetViewButton",
    exportButton: "exportButton",
    randomSeedButton: "randomSeedButton",
  };

  const controls = [
    "seed",
    "distributionMode",
    "nodeCount",
    "iterationCount",
    "startMinSeparation",
    "claimThreshold",
    "neighborCount",
    "extraRouteChance",
    "lossScale",
    "baseTransfer",
    "rampSteps",
    "deepPenalty",
    "deepZoneCount",
    "deepZoneRadius",
    "currentCount",
    "currentLength",
    "currentDiscount",
    "currentReverseDiscount",
    "stargateCount",
    "stargateCost",
    "stargateThroughput",
    "relicCount",
    "relicMaxBoost",
    "relicScale",
  ];

  let dom = {};
  let model = null;
  let selectedStep = 0;
  let hoverIndex = null;
  let lastRenderPoints = [];
  let lastCanvasRect = null;

  window.addEventListener("DOMContentLoaded", () => {
    dom = Object.fromEntries(
      Object.entries(ids).map(([key, id]) => [key, document.getElementById(id)]),
    );
    controls.forEach((id) => {
      dom[id] = document.getElementById(id);
    });

    bindEvents();
    queueRun();
  });

  function bindEvents() {
    dom.runButton.addEventListener("click", queueRun);
    dom.resetViewButton.addEventListener("click", () => setStep(0));
    dom.exportButton.addEventListener("click", exportCurrentRun);
    dom.randomSeedButton.addEventListener("click", () => {
      dom.seed.value = makeRandomSeed();
      queueRun();
    });
    dom.stepSlider.addEventListener("input", () => setStep(Number(dom.stepSlider.value)));
    dom.stepInput.addEventListener("input", () => setStep(Number(dom.stepInput.value)));
    dom.stepInput.addEventListener("change", () => setStep(Number(dom.stepInput.value)));
    dom.canvas.addEventListener("mousemove", handlePointerMove);
    dom.canvas.addEventListener("mouseleave", () => {
      hoverIndex = null;
      dom.tooltip.hidden = true;
      render();
    });
    window.addEventListener("resize", render);
  }

  function queueRun() {
    const params = readParams();
    dom.statusText.textContent = "生成中";
    dom.runButton.disabled = true;
    window.requestAnimationFrame(() => {
      try {
        model = buildModel(params);
        selectedStep = model.history.length - 1;
        syncTimeline();
        persistRun(model);
        dom.statusText.textContent = "已生成";
        render();
      } catch (error) {
        console.error(error);
        dom.statusText.textContent = "生成失败";
      } finally {
        dom.runButton.disabled = false;
      }
    });
  }

  function readParams() {
    return {
      seed: String(dom.seed.value || "aether-era").trim(),
      distributionMode: dom.distributionMode.value,
      nodeCount: readNumber("nodeCount", 450, 80, 900),
      iterationCount: readNumber("iterationCount", 180, 10, 800),
      startMinSeparation: readNumber("startMinSeparation", 1700, 300, 3200),
      claimThreshold: readNumber("claimThreshold", 34, 5, 120),
      neighborCount: readNumber("neighborCount", 4, 2, 10),
      extraRouteChance: readNumber("extraRouteChance", 0.16, 0, 0.8),
      lossScale: readNumber("lossScale", 560, 120, 1600),
      baseTransfer: readNumber("baseTransfer", 7.5, 1, 30),
      rampSteps: readNumber("rampSteps", 9, 1, 50),
      deepPenalty: readNumber("deepPenalty", 2.25, 1, 5),
      deepZoneCount: readNumber("deepZoneCount", 5, 0, 16),
      deepZoneRadius: readNumber("deepZoneRadius", 560, 160, 1100),
      currentCount: readNumber("currentCount", 5, 0, 12),
      currentLength: readNumber("currentLength", 16, 4, 40),
      currentDiscount: readNumber("currentDiscount", 0.56, 0.25, 1),
      currentReverseDiscount: readNumber("currentReverseDiscount", 0.86, 0.35, 1.2),
      stargateCount: readNumber("stargateCount", 28, 0, 80),
      stargateCost: readNumber("stargateCost", 300, 60, 900),
      stargateThroughput: readNumber("stargateThroughput", 0.24, 0.02, 1.2),
      relicCount: readNumber("relicCount", 42, 0, 140),
      relicMaxBoost: readNumber("relicMaxBoost", 0.16, 0, 0.5),
      relicScale: readNumber("relicScale", 13, 2, 40),
    };
  }

  function readNumber(id, fallback, min, max) {
    const value = Number(dom[id].value);
    if (!Number.isFinite(value)) return fallback;
    return clamp(value, min, max);
  }

  function buildModel(params) {
    const rng = createRng(params.seed);
    const nodes = generateNodes(params, rng);
    const deepZones = generateDeepZones(params, rng);
    applyDeepZones(nodes, deepZones, params);
    const routes = generateRoutes(nodes, deepZones, params, rng);
    let adjacency = buildAdjacency(nodes.length, routes);
    const currents = applyCurrents(nodes, adjacency, params, rng);
    adjacency = buildAdjacency(nodes.length, routes);
    selectStargates(nodes, adjacency, params, rng);
    selectRelics(nodes, params, rng);
    const starts = selectCivilizationStarts(nodes, adjacency, params, rng);
    const history = runSimulation(nodes, routes, adjacency, starts, params);

    return {
      generatedAt: new Date().toISOString(),
      params,
      nodes,
      routes,
      adjacency,
      deepZones,
      currents,
      starts,
      history,
    };
  }

  function generateNodes(params, rng) {
    const nodes = [];
    const clusters = Array.from({ length: 12 }, () => {
      const x = lerp(WORLD.minX + 300, WORLD.maxX - 300, rng());
      return {
        x,
        y: armY(x) + randomNormal(rng) * 280,
        spread: lerp(220, 520, rng()),
      };
    });

    let attempts = 0;
    while (nodes.length < params.nodeCount && attempts < params.nodeCount * 80) {
      attempts += 1;
      const p = params.distributionMode === "uniform"
        ? uniformPoint(rng)
        : densityFieldPoint(rng, clusters);
      if (!isInsideWorld(p.x, p.y)) continue;
      if (tooClose(nodes, p, 26)) continue;

      const resource = clamp(0.55 + rng() * 0.85 + Math.max(0, 1 - Math.abs(p.y - armY(p.x)) / 1200) * 0.22, 0.45, 1.75);
      const habitability = clamp(0.5 + rng() * 0.75 - Math.abs(p.z) / 1000, 0.28, 1.4);
      const anchorValue = clamp(0.4 + rng() * 0.7 + resource * 0.15, 0.3, 1.45);

      nodes.push({
        index: nodes.length,
        id: `N-${String(nodes.length + 1).padStart(3, "0")}`,
        x: p.x,
        y: p.y,
        z: p.z,
        resource,
        habitability,
        anchorValue,
        deepLevel: 0,
        thresholdFactor: 1,
        hasGate: false,
        gateTier: 0,
        relicScore: 0,
        relicClaimedBy: null,
        centrality: 0,
        startCiv: null,
      });
    }

    return nodes;
  }

  function densityFieldPoint(rng, clusters) {
    const mode = rng();
    if (mode < 0.62) {
      const x = lerp(WORLD.minX, WORLD.maxX, rng());
      const armOffset = randomNormal(rng) * lerp(260, 620, rng());
      return {
        x,
        y: armY(x) + armOffset,
        z: randomNormal(rng) * 180,
      };
    }
    if (mode < 0.86) {
      const cluster = clusters[Math.floor(rng() * clusters.length)];
      return {
        x: cluster.x + randomNormal(rng) * cluster.spread,
        y: cluster.y + randomNormal(rng) * cluster.spread * 0.72,
        z: randomNormal(rng) * 230,
      };
    }
    return uniformPoint(rng);
  }

  function uniformPoint(rng) {
    return {
      x: lerp(WORLD.minX, WORLD.maxX, rng()),
      y: lerp(WORLD.minY, WORLD.maxY, rng()),
      z: randomNormal(rng) * 260,
    };
  }

  function armY(x) {
    return 240 * Math.sin((x + 700) / 850) + 120 * Math.sin(x / 1500);
  }

  function tooClose(nodes, p, minDistance) {
    for (let i = Math.max(0, nodes.length - 120); i < nodes.length; i += 1) {
      if (distance2D(nodes[i], p) < minDistance) return true;
    }
    return false;
  }

  function generateDeepZones(params, rng) {
    const zones = [];
    for (let i = 0; i < params.deepZoneCount; i += 1) {
      zones.push({
        id: `DZ-${i + 1}`,
        x: lerp(WORLD.minX + 350, WORLD.maxX - 350, rng()),
        y: lerp(WORLD.minY + 260, WORLD.maxY - 260, rng()),
        radius: params.deepZoneRadius * lerp(0.72, 1.28, rng()),
        lobes: 4 + Math.floor(rng() * 5),
        phase: rng() * Math.PI * 2,
        irregularity: lerp(0.2, 0.45, rng()),
      });
    }
    return zones;
  }

  function applyDeepZones(nodes, zones, params) {
    nodes.forEach((node) => {
      node.deepLevel = deepInfluenceAt(node, zones);
      node.thresholdFactor = 1 + node.deepLevel * 0.42;
      node.resource = clamp(node.resource + node.deepLevel * 0.16, 0.35, 1.9);
    });
  }

  function generateRoutes(nodes, zones, params, rng) {
    const routes = [];
    const edgeMap = new Map();
    const nearest = [];

    for (let i = 0; i < nodes.length; i += 1) {
      const list = [];
      for (let j = 0; j < nodes.length; j += 1) {
        if (i === j) continue;
        list.push({ index: j, distance: spatialDistance(nodes[i], nodes[j]) });
      }
      list.sort((a, b) => a.distance - b.distance);
      nearest[i] = list;
    }

    const addEdge = (a, b) => {
      const key = edgeKey(a, b);
      if (edgeMap.has(key)) return edgeMap.get(key);
      const route = makeRoute(nodes, zones, params, a, b);
      route.index = routes.length;
      routes.push(route);
      edgeMap.set(key, route);
      return route;
    };

    for (let i = 0; i < nodes.length; i += 1) {
      const limit = Math.min(params.neighborCount, nearest[i].length);
      for (let k = 0; k < limit; k += 1) {
        addEdge(i, nearest[i][k].index);
      }
      const extraMax = Math.min(limit + 8, nearest[i].length);
      for (let k = limit; k < extraMax; k += 1) {
        if (rng() < params.extraRouteChance) addEdge(i, nearest[i][k].index);
      }
    }

    ensureConnected(nodes, routes, edgeMap, zones, params);
    return routes;
  }

  function makeRoute(nodes, zones, params, a, b) {
    const from = nodes[a];
    const to = nodes[b];
    const distance = spatialDistance(from, to);
    const mid = {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2,
    };
    const deep = Math.max(from.deepLevel, to.deepLevel, deepInfluenceAt(mid, zones));
    const deepFactor = 1 + (params.deepPenalty - 1) * deep;
    return {
      a,
      b,
      distance,
      baseCost: distance,
      deepLevel: deep,
      deepFactor,
      cost: distance * deepFactor,
      currentId: null,
      currentForward: null,
    };
  }

  function ensureConnected(nodes, routes, edgeMap, zones, params) {
    let guard = 0;
    while (guard < nodes.length) {
      guard += 1;
      const labels = componentLabels(nodes.length, routes);
      const componentCount = Math.max(...labels) + 1;
      if (componentCount <= 1) return;

      let best = null;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          if (labels[i] === labels[j]) continue;
          const d = spatialDistance(nodes[i], nodes[j]);
          if (!best || d < best.distance) best = { a: i, b: j, distance: d };
        }
      }
      if (!best) return;
      const key = edgeKey(best.a, best.b);
      if (!edgeMap.has(key)) {
        const route = makeRoute(nodes, zones, params, best.a, best.b);
        route.index = routes.length;
        routes.push(route);
        edgeMap.set(key, route);
      }
    }
  }

  function buildAdjacency(nodeCount, routes) {
    const adjacency = Array.from({ length: nodeCount }, () => []);
    routes.forEach((route) => {
      adjacency[route.a].push({ to: route.b, route });
      adjacency[route.b].push({ to: route.a, route });
    });
    adjacency.forEach((items, index) => {
      items.sort((a, b) => a.route.cost - b.route.cost);
    });
    return adjacency;
  }

  function applyCurrents(nodes, adjacency, params, rng) {
    const currents = [];
    const usedStarts = new Set();

    for (let i = 0; i < params.currentCount; i += 1) {
      let currentNode = Math.floor(rng() * nodes.length);
      let guard = 0;
      while (usedStarts.has(currentNode) && guard < 20) {
        currentNode = Math.floor(rng() * nodes.length);
        guard += 1;
      }
      usedStarts.add(currentNode);

      const path = [currentNode];
      const localVisited = new Set([currentNode]);
      let heading = rng() * Math.PI * 2;

      for (let step = 0; step < params.currentLength; step += 1) {
        const options = adjacency[currentNode]
          .filter((item) => !localVisited.has(item.to) || step > params.currentLength * 0.65)
          .map((item) => {
            const target = nodes[item.to];
            const angle = Math.atan2(target.y - nodes[currentNode].y, target.x - nodes[currentNode].x);
            const turn = angleDistance(angle, heading);
            const score =
              turn * 360 +
              item.route.cost * 0.34 -
              target.anchorValue * 40 -
              target.resource * 28 +
              rng() * 90;
            return { item, angle, score };
          })
          .sort((a, b) => a.score - b.score);

        if (!options.length) break;
        const chosen = options[0];
        chosen.item.route.currentId = i;
        chosen.item.route.currentForward = `${currentNode}>${chosen.item.to}`;
        chosen.item.route.currentDiscount = params.currentDiscount;
        chosen.item.route.currentReverseDiscount = params.currentReverseDiscount;
        currentNode = chosen.item.to;
        localVisited.add(currentNode);
        path.push(currentNode);
        heading = heading * 0.55 + chosen.angle * 0.45;
      }

      if (path.length > 2) currents.push({ id: i, path });
    }

    return currents;
  }

  function selectStargates(nodes, adjacency, params, rng) {
    nodes.forEach((node, index) => {
      node.centrality = adjacency[index].length;
    });
    const candidates = nodes
      .map((node) => ({
        node,
        score:
          node.centrality * 0.82 +
          node.anchorValue * 2.1 +
          node.resource * 1.1 -
          node.deepLevel * 1.4 +
          rng() * 2.2,
      }))
      .sort((a, b) => b.score - a.score);

    const selected = [];
    for (const candidate of candidates) {
      if (selected.length >= Math.min(params.stargateCount, nodes.length)) break;
      if (selected.some((node) => distance2D(node, candidate.node) < 260)) continue;
      candidate.node.hasGate = true;
      candidate.node.gateTier = selected.length < 5 ? 1 : 2;
      selected.push(candidate.node);
    }
  }

  function selectRelics(nodes, params, rng) {
    const candidates = nodes
      .map((node) => ({
        node,
        score:
          node.deepLevel * 2.4 +
          (node.hasGate ? 0.35 : 0) +
          node.resource * 0.6 +
          rng() * 1.8,
      }))
      .sort((a, b) => b.score - a.score);

    const count = Math.min(params.relicCount, nodes.length);
    for (let i = 0; i < count; i += 1) {
      const node = candidates[i].node;
      node.relicScore = rng() < 0.16 ? 3 : 1;
    }
  }

  function selectCivilizationStarts(nodes, adjacency, params, rng) {
    const starts = [];
    CIVS.forEach((civ, civIndex) => {
      let selected = null;
      let minDistance = params.startMinSeparation;
      for (let pass = 0; pass < 5 && !selected; pass += 1) {
        const ranked = nodes
          .filter((node) => !starts.some((start) => start.nodeIndex === node.index))
          .filter((node) => starts.every((start) => distance2D(nodes[start.nodeIndex], node) >= minDistance))
          .map((node) => ({
            node,
            score: startScore(node, adjacency[node.index], civIndex) + rng() * 0.8,
          }))
          .sort((a, b) => b.score - a.score);
        if (ranked.length) selected = ranked[0].node;
        minDistance *= 0.78;
      }
      if (!selected) {
        selected = nodes.find((node) => !starts.some((start) => start.nodeIndex === node.index));
      }
      selected.startCiv = civ.id;
      starts.push({ civIndex, civId: civ.id, nodeIndex: selected.index });
    });
    return starts;
  }

  function startScore(node, adjacencyItems, civIndex) {
    const central = adjacencyItems.length / 8;
    const safe = 1 - node.deepLevel;
    if (civIndex === 0) {
      return node.resource * 1.4 + central * 1.3 + node.anchorValue * 0.8 + safe * 0.7;
    }
    if (civIndex === 1) {
      return node.habitability * 1.5 + safe * 1.5 + node.anchorValue * 0.8 + central * 0.6;
    }
    if (civIndex === 2) {
      return node.deepLevel * 1.8 + node.relicScore * 0.65 + node.resource + central * 0.65;
    }
    return central * 1.7 + (node.hasGate ? 1.2 : 0) + node.anchorValue + node.resource * 0.8;
  }

  function runSimulation(nodes, routes, adjacency, starts, params) {
    const n = nodes.length;
    const owners = Array(n).fill(CIV_NONE);
    const ages = Array(n).fill(0);
    const influence = Array.from({ length: n }, () => Array(CIVS.length).fill(0));
    const relicScores = Array(CIVS.length).fill(0);

    starts.forEach((start) => {
      owners[start.nodeIndex] = start.civIndex;
      ages[start.nodeIndex] = params.rampSteps;
      influence[start.nodeIndex][start.civIndex] = params.claimThreshold * 1.4;
      const node = nodes[start.nodeIndex];
      if (node.relicScore > 0 && node.relicClaimedBy === null) {
        node.relicClaimedBy = start.civIndex;
        relicScores[start.civIndex] += node.relicScore * CIVS[start.civIndex].relicWeight;
      }
    });

    const history = [makeSnapshot(0, nodes, owners, ages, influence, relicScores, params)];

    for (let step = 1; step <= params.iterationCount; step += 1) {
      const additions = Array.from({ length: n }, () => Array(CIVS.length).fill(0));
      const gateTargets = nodes.filter((node) => node.hasGate && owners[node.index] === CIV_NONE);

      for (let i = 0; i < n; i += 1) {
        const civIndex = owners[i];
        if (civIndex === CIV_NONE) continue;

        const node = nodes[i];
        const output = nodeOutput(node, civIndex, ages[i], relicScores[civIndex], params);

        adjacency[i].forEach((item) => {
          const targetIndex = item.to;
          if (owners[targetIndex] !== CIV_NONE) return;
          const target = nodes[targetIndex];
          const cost = routeCostFrom(item.route, i, targetIndex) * civilizationDeepModifier(target, civIndex);
          const retention = Math.exp(-cost / params.lossScale);
          additions[targetIndex][civIndex] += output * retention;
        });

        if (node.hasGate && gateTargets.length) {
          const divisor = Math.sqrt(gateTargets.length);
          gateTargets.forEach((target) => {
            if (target.index === i) return;
            const cost =
              params.stargateCost *
              CIVS[civIndex].gateCost *
              (1 + target.deepLevel * 0.32);
            const retention = Math.exp(-cost / params.lossScale);
            additions[target.index][civIndex] +=
              (output * params.stargateThroughput * retention) / divisor;
          });
        }
      }

      for (let i = 0; i < n; i += 1) {
        if (owners[i] !== CIV_NONE) {
          ages[i] += 1;
          continue;
        }
        for (let c = 0; c < CIVS.length; c += 1) {
          influence[i][c] += additions[i][c];
        }
      }

      const claims = [];
      for (let i = 0; i < n; i += 1) {
        if (owners[i] !== CIV_NONE) continue;
        const threshold = nodeThreshold(nodes[i], params);
        const ranked = influence[i]
          .map((value, civIndex) => ({ civIndex, value }))
          .sort((a, b) => b.value - a.value);
        const top = ranked[0];
        const second = ranked[1] || { value: 0 };
        if (top.value >= threshold && (second.value <= top.value * 0.88 || top.value >= threshold * 1.45)) {
          claims.push({ nodeIndex: i, civIndex: top.civIndex });
        }
      }

      claims.forEach((claim) => {
        owners[claim.nodeIndex] = claim.civIndex;
        ages[claim.nodeIndex] = 0;
        influence[claim.nodeIndex][claim.civIndex] = Math.max(
          influence[claim.nodeIndex][claim.civIndex],
          nodeThreshold(nodes[claim.nodeIndex], params),
        );
        const node = nodes[claim.nodeIndex];
        if (node.relicScore > 0 && node.relicClaimedBy === null) {
          node.relicClaimedBy = claim.civIndex;
          relicScores[claim.civIndex] += node.relicScore * CIVS[claim.civIndex].relicWeight;
        }
      });

      history.push(makeSnapshot(step, nodes, owners, ages, influence, relicScores, params));
    }

    return history;
  }

  function nodeOutput(node, civIndex, age, relicScore, params) {
    const stage = clamp((age + 1) / params.rampSteps, 0.2, 1);
    const relicMultiplier = 1 + params.relicMaxBoost * (1 - Math.exp(-relicScore / params.relicScale));
    const gateBoost = node.hasGate ? 1.08 : 1;
    return params.baseTransfer * node.resource * stage * CIVS[civIndex].output * relicMultiplier * gateBoost;
  }

  function nodeThreshold(node, params) {
    return params.claimThreshold * node.thresholdFactor * (1 + Math.max(0, node.deepLevel - 0.35) * 0.18);
  }

  function routeCostFrom(route, from, to) {
    if (route.currentId === null) return route.cost;
    const direction = `${from}>${to}`;
    const multiplier = direction === route.currentForward
      ? route.currentDiscount
      : route.currentReverseDiscount;
    return route.cost * multiplier;
  }

  function civilizationDeepModifier(target, civIndex) {
    return 1 + target.deepLevel * (CIVS[civIndex].deepCost - 1);
  }

  function makeSnapshot(step, nodes, owners, ages, influence, relicScores, params) {
    const ownerCopy = owners.slice();
    const ageCopy = ages.slice();
    const influenceCopy = influence.map((row) => row.map((value) => round(value, 3)));
    const contested = Array(nodes.length).fill(0);
    const progress = Array(nodes.length).fill(0);
    const topCiv = Array(nodes.length).fill(CIV_NONE);

    for (let i = 0; i < nodes.length; i += 1) {
      const threshold = nodeThreshold(nodes[i], params);
      const ranked = influence[i]
        .map((value, civIndex) => ({ civIndex, value }))
        .sort((a, b) => b.value - a.value);
      topCiv[i] = ranked[0].value > 0 ? ranked[0].civIndex : CIV_NONE;
      progress[i] = clamp(ranked[0].value / threshold, 0, 1.6);
      if (
        ownerCopy[i] === CIV_NONE &&
        ranked[0].value > threshold * 0.25 &&
        ranked[1] &&
        ranked[1].value > ranked[0].value * 0.62
      ) {
        contested[i] = 1;
      }
    }

    const stats = CIVS.map((civ, civIndex) => {
      const owned = ownerCopy.filter((owner) => owner === civIndex).length;
      const gates = nodes.filter((node) => node.hasGate && ownerCopy[node.index] === civIndex).length;
      const relics = nodes.filter((node) => node.relicScore > 0 && ownerCopy[node.index] === civIndex).length;
      return {
        id: civ.id,
        name: civ.name,
        owned,
        gates,
        relics,
        relicScore: round(relicScores[civIndex], 2),
        transferMultiplier: round(1 + params.relicMaxBoost * (1 - Math.exp(-relicScores[civIndex] / params.relicScale)), 3),
      };
    });

    return {
      step,
      owners: ownerCopy,
      ages: ageCopy,
      influence: influenceCopy,
      contested,
      progress: progress.map((value) => round(value, 3)),
      topCiv,
      stats,
      neutral: ownerCopy.filter((owner) => owner === CIV_NONE).length,
      contestedCount: contested.filter(Boolean).length,
    };
  }

  function render() {
    if (!model) return;
    resizeCanvas();
    const canvas = dom.canvas;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const snapshot = model.history[selectedStep];
    const project = makeProjector(width, height);
    lastRenderPoints = model.nodes.map((node) => project(node.x, node.y));
    lastCanvasRect = canvas.getBoundingClientRect();

    drawBackground(ctx, width, height);
    drawDeepZones(ctx, model.deepZones, project);
    drawRoutes(ctx, model.routes, model.nodes, snapshot, project);
    drawNodes(ctx, model.nodes, snapshot, project);
    updateReadouts(snapshot);
  }

  function resizeCanvas() {
    const rect = dom.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const targetWidth = Math.max(640, Math.floor(rect.width * ratio));
    const targetHeight = Math.max(420, Math.floor(rect.height * ratio));
    if (dom.canvas.width !== targetWidth || dom.canvas.height !== targetHeight) {
      dom.canvas.width = targetWidth;
      dom.canvas.height = targetHeight;
    }
  }

  function makeProjector(width, height) {
    const margin = 46 * (window.devicePixelRatio || 1);
    const scale = Math.min(
      (width - margin * 2) / (WORLD.maxX - WORLD.minX),
      (height - margin * 2) / (WORLD.maxY - WORLD.minY),
    );
    const offsetX = (width - (WORLD.maxX - WORLD.minX) * scale) / 2;
    const offsetY = (height - (WORLD.maxY - WORLD.minY) * scale) / 2;
    return (x, y) => ({
      x: offsetX + (x - WORLD.minX) * scale,
      y: height - (offsetY + (y - WORLD.minY) * scale),
      scale,
    });
  }

  function drawBackground(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#111615");
    gradient.addColorStop(0.55, "#19201d");
    gradient.addColorStop(1, "#131717");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const grid = 90 * (window.devicePixelRatio || 1);
    ctx.save();
    ctx.strokeStyle = "rgba(215, 226, 219, 0.055)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDeepZones(ctx, zones, project) {
    zones.forEach((zone) => {
      ctx.save();
      ctx.beginPath();
      const points = zonePolygon(zone, 80);
      points.forEach((point, index) => {
        const p = project(point.x, point.y);
        if (index === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = "rgba(171, 70, 82, 0.17)";
      ctx.strokeStyle = "rgba(222, 130, 112, 0.42)";
      ctx.lineWidth = 1.2 * (window.devicePixelRatio || 1);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawRoutes(ctx, routes, nodes, snapshot, project) {
    ctx.save();
    routes.forEach((route) => {
      const a = project(nodes[route.a].x, nodes[route.a].y);
      const b = project(nodes[route.b].x, nodes[route.b].y);
      const ownedA = snapshot.owners[route.a] !== CIV_NONE;
      const ownedB = snapshot.owners[route.b] !== CIV_NONE;
      const active = ownedA || ownedB;

      if (route.currentId !== null) {
        ctx.strokeStyle = active ? "rgba(95, 205, 162, 0.72)" : "rgba(95, 205, 162, 0.38)";
        ctx.lineWidth = 2.2 * (window.devicePixelRatio || 1);
      } else if (route.deepLevel > 0.38) {
        ctx.strokeStyle = active ? "rgba(210, 113, 83, 0.46)" : "rgba(210, 113, 83, 0.24)";
        ctx.lineWidth = 1.4 * (window.devicePixelRatio || 1);
      } else {
        ctx.strokeStyle = active ? "rgba(190, 205, 199, 0.34)" : "rgba(190, 205, 199, 0.14)";
        ctx.lineWidth = 1 * (window.devicePixelRatio || 1);
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawNodes(ctx, nodes, snapshot, project) {
    const ratio = window.devicePixelRatio || 1;
    ctx.save();
    nodes.forEach((node, index) => {
      const p = project(node.x, node.y);
      const owner = snapshot.owners[index];
      const top = snapshot.topCiv[index];
      const civ = owner !== CIV_NONE ? CIVS[owner] : top !== CIV_NONE ? CIVS[top] : null;
      const baseColor = civ ? civ.color : "#8b9495";
      const radius = (node.startCiv ? 6.4 : 4.3) * ratio + (node.hasGate ? 1.2 * ratio : 0);
      const alpha = owner !== CIV_NONE ? 0.96 : snapshot.contested[index] ? 0.68 : 0.38;

      if (owner === CIV_NONE && snapshot.progress[index] > 0.02) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 3.6 * ratio, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(snapshot.progress[index], 0, 1));
        ctx.strokeStyle = hexToRgba(baseColor, 0.56);
        ctx.lineWidth = 1.8 * ratio;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(baseColor, alpha);
      ctx.fill();
      ctx.strokeStyle = owner !== CIV_NONE ? "rgba(245, 250, 247, 0.74)" : "rgba(230, 238, 235, 0.28)";
      ctx.lineWidth = (node.startCiv ? 1.8 : 1) * ratio;
      ctx.stroke();

      if (snapshot.contested[index]) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 5.5 * ratio, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(242, 209, 94, 0.72)";
        ctx.lineWidth = 1.3 * ratio;
        ctx.stroke();
      }

      if (node.hasGate) {
        ctx.strokeStyle = "rgba(242, 209, 94, 0.92)";
        ctx.lineWidth = 1.4 * ratio;
        const size = radius + 4.4 * ratio;
        ctx.strokeRect(p.x - size, p.y - size, size * 2, size * 2);
      }

      if (node.relicScore > 0) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = node.relicScore > 1 ? "rgba(255, 239, 172, 0.95)" : "rgba(232, 241, 242, 0.8)";
        ctx.lineWidth = 1.4 * ratio;
        const size = radius + 2.8 * ratio;
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        ctx.restore();
      }

      if (hoverIndex === index) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 8 * ratio, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
        ctx.lineWidth = 1.5 * ratio;
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  function updateReadouts(snapshot) {
    dom.stepBadge.textContent = `第 ${snapshot.step} 步`;
    dom.summaryStats.innerHTML = "";
    const neutral = document.createElement("span");
    neutral.className = "stat-pill";
    neutral.textContent = `无主 ${snapshot.neutral}`;
    dom.summaryStats.appendChild(neutral);

    snapshot.stats.forEach((stat, index) => {
      const pill = document.createElement("span");
      pill.className = "stat-pill";
      pill.style.borderColor = hexToRgba(CIVS[index].color, 0.45);
      pill.textContent = `${CIVS[index].shortName} ${stat.owned} / 星门 ${stat.gates} / 遗迹 ${stat.relics}`;
      dom.summaryStats.appendChild(pill);
    });

    if (snapshot.contestedCount) {
      const contested = document.createElement("span");
      contested.className = "stat-pill";
      contested.textContent = `争议 ${snapshot.contestedCount}`;
      dom.summaryStats.appendChild(contested);
    }
  }

  function syncTimeline() {
    const max = Math.max(0, model.history.length - 1);
    dom.stepSlider.max = String(max);
    dom.stepInput.max = String(max);
    setStep(selectedStep);
  }

  function setStep(step) {
    if (!model) return;
    selectedStep = clamp(Math.round(step), 0, model.history.length - 1);
    dom.stepSlider.value = String(selectedStep);
    dom.stepInput.value = String(selectedStep);
    render();
  }

  function handlePointerMove(event) {
    if (!model || !lastRenderPoints.length || !lastCanvasRect) return;
    const ratio = window.devicePixelRatio || 1;
    const x = (event.clientX - lastCanvasRect.left) * ratio;
    const y = (event.clientY - lastCanvasRect.top) * ratio;
    let nearest = null;
    let best = 14 * ratio;
    lastRenderPoints.forEach((point, index) => {
      const d = Math.hypot(point.x - x, point.y - y);
      if (d < best) {
        best = d;
        nearest = index;
      }
    });

    if (nearest === null) {
      hoverIndex = null;
      dom.tooltip.hidden = true;
      render();
      return;
    }

    hoverIndex = nearest;
    const node = model.nodes[nearest];
    const snapshot = model.history[selectedStep];
    const owner = snapshot.owners[nearest];
    const top = snapshot.topCiv[nearest];
    const status = owner !== CIV_NONE
      ? CIVS[owner].name
      : snapshot.contested[nearest]
        ? "争议节点"
        : "无主节点";
    const topText = top !== CIV_NONE
      ? `${CIVS[top].shortName} ${Math.round(snapshot.progress[nearest] * 100)}%`
      : "未受输送";
    const relicText = node.relicScore > 0 ? ` / 遗迹 ${node.relicScore}` : "";
    const gateText = node.hasGate ? " / 星门" : "";
    dom.tooltip.innerHTML = `
      <strong>${node.id} ${status}</strong>
      坐标 ${Math.round(node.x)}, ${Math.round(node.y)}, ${Math.round(node.z)}<br />
      资源 ${node.resource.toFixed(2)} / 宜居 ${node.habitability.toFixed(2)} / 深层 ${node.deepLevel.toFixed(2)}<br />
      当前影响：${topText}${gateText}${relicText}
    `;
    const left = event.clientX - lastCanvasRect.left + 16;
    const topPos = event.clientY - lastCanvasRect.top + 16;
    dom.tooltip.style.left = `${Math.min(left, lastCanvasRect.width - 280)}px`;
    dom.tooltip.style.top = `${Math.min(topPos, lastCanvasRect.height - 120)}px`;
    dom.tooltip.hidden = false;
    render();
  }

  function exportCurrentRun() {
    if (!model) return;
    const payload = serializeModel(model);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `星海疆域生成_${sanitizeFilename(model.params.seed)}_${model.history.length - 1}步.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function persistRun(run) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          generatedAt: run.generatedAt,
          params: run.params,
          history: run.history,
          nodes: run.nodes.map((node) => ({
            id: node.id,
            x: round(node.x, 2),
            y: round(node.y, 2),
            z: round(node.z, 2),
            hasGate: node.hasGate,
            relicScore: node.relicScore,
            startCiv: node.startCiv,
          })),
        }),
      );
    } catch (error) {
      console.warn("本地缓存空间不足，仍可使用导出 JSON。", error);
    }
  }

  function serializeModel(run) {
    return {
      generatedAt: run.generatedAt,
      params: run.params,
      civilizations: CIVS.map(({ id, name, shortName, color }) => ({ id, name, shortName, color })),
      starts: run.starts,
      nodes: run.nodes.map((node) => ({
        index: node.index,
        id: node.id,
        x: round(node.x, 2),
        y: round(node.y, 2),
        z: round(node.z, 2),
        resource: round(node.resource, 3),
        habitability: round(node.habitability, 3),
        anchorValue: round(node.anchorValue, 3),
        deepLevel: round(node.deepLevel, 3),
        thresholdFactor: round(node.thresholdFactor, 3),
        hasGate: node.hasGate,
        gateTier: node.gateTier,
        relicScore: node.relicScore,
        startCiv: node.startCiv,
        centrality: node.centrality,
      })),
      routes: run.routes.map((route) => ({
        a: route.a,
        b: route.b,
        distance: round(route.distance, 2),
        cost: round(route.cost, 2),
        deepLevel: round(route.deepLevel, 3),
        currentId: route.currentId,
        currentForward: route.currentForward,
      })),
      deepZones: run.deepZones,
      currents: run.currents,
      history: run.history,
    };
  }

  function componentLabels(nodeCount, routes) {
    const adjacency = Array.from({ length: nodeCount }, () => []);
    routes.forEach((route) => {
      adjacency[route.a].push(route.b);
      adjacency[route.b].push(route.a);
    });
    const labels = Array(nodeCount).fill(-1);
    let label = 0;
    for (let i = 0; i < nodeCount; i += 1) {
      if (labels[i] !== -1) continue;
      const stack = [i];
      labels[i] = label;
      while (stack.length) {
        const current = stack.pop();
        adjacency[current].forEach((next) => {
          if (labels[next] !== -1) return;
          labels[next] = label;
          stack.push(next);
        });
      }
      label += 1;
    }
    return labels;
  }

  function zonePolygon(zone, segments) {
    const points = [];
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const radius = zoneRadiusAt(zone, angle);
      points.push({
        x: zone.x + Math.cos(angle) * radius,
        y: zone.y + Math.sin(angle) * radius,
      });
    }
    return points;
  }

  function deepInfluenceAt(point, zones) {
    let influence = 0;
    zones.forEach((zone) => {
      const angle = Math.atan2(point.y - zone.y, point.x - zone.x);
      const radius = zoneRadiusAt(zone, angle);
      const d = Math.hypot(point.x - zone.x, point.y - zone.y);
      if (d >= radius) return;
      const local = Math.pow(1 - d / radius, 0.72);
      influence = Math.max(influence, local);
    });
    return clamp(influence, 0, 1);
  }

  function zoneRadiusAt(zone, angle) {
    const wave =
      Math.sin(angle * zone.lobes + zone.phase) * 0.65 +
      Math.sin(angle * (zone.lobes + 2) - zone.phase * 1.37) * 0.35;
    return zone.radius * (1 + zone.irregularity * wave);
  }

  function spatialDistance(a, b) {
    const dz = (a.z || 0) - (b.z || 0);
    return Math.hypot(a.x - b.x, a.y - b.y, dz * 0.55);
  }

  function distance2D(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function edgeKey(a, b) {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }

  function isInsideWorld(x, y) {
    return x >= WORLD.minX && x <= WORLD.maxX && y >= WORLD.minY && y <= WORLD.maxY;
  }

  function createRng(seedText) {
    let hash = 2166136261;
    const text = String(seedText || "seed");
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    let state = hash >>> 0;
    return function rng() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomNormal(rng) {
    const u = Math.max(1e-8, rng());
    const v = Math.max(1e-8, rng());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
  }

  function angleDistance(a, b) {
    let diff = Math.abs(a - b) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    return diff;
  }

  function hexToRgba(hex, alpha) {
    const value = hex.replace("#", "");
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, digits) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  function sanitizeFilename(value) {
    return String(value || "seed").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
  }

  function makeRandomSeed() {
    const buffer = new Uint32Array(2);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(buffer);
      return `aether-${buffer[0].toString(16)}-${buffer[1].toString(16)}`;
    }
    return `aether-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
  }
})();
