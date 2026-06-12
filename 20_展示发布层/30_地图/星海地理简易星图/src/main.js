import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {
  CIVILIZATIONS,
  STATUS_LABELS,
  TYPE_LABELS,
  createStarMapData,
} from "./star-map-data.js";

const MAX_PIXEL_RATIO = 1.35;
const MAP_SCALE = { x: 1 / 360, y: 1 / 360 };
const GROUND_Y = 0;
const ELEVATION_RANGE = { min: 0.12, max: 2.18 };
const PAN_LIMITS = {
  x: { min: -2.85, max: 2.85 },
  y: { min: 0.26, max: 1.08 },
  z: { min: -1.95, max: 1.95 },
};
const WHITE = new THREE.Color(0xffffff);

const canvas = document.querySelector("#starmap");
const mapStatus = document.querySelector("#mapStatus");
const civilizationFilters = document.querySelector("#civilizationFilters");
const tierFilters = document.querySelector("#tierFilters");
const legend = document.querySelector("#legend");
const nodeDetail = document.querySelector("#nodeDetail");
const selectionState = document.querySelector("#selectionState");
const resetView = document.querySelector("#resetView");
const focusRisk = document.querySelector("#focusRisk");
const cursorReticle = document.querySelector("#cursorReticle");
const cursorReadout = document.querySelector("#cursorReadout");

const data = createStarMapData();
const filters = {
  civilizations: new Set(Object.keys(CIVILIZATIONS)),
  maxTier: 3,
};

let visibleNodeIds = new Set();
let hoveredNode = null;
let selectedNode = null;
let particleField = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02070d);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
renderer.setSize(window.innerWidth, window.innerHeight);

const camera = createCamera();
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enableRotate = true;
controls.rotateSpeed = 0.34;
controls.enablePan = true;
controls.panSpeed = 0.56;
controls.screenSpacePanning = true;
controls.minZoom = 0.72;
controls.maxZoom = 4.2;
controls.minAzimuthAngle = -0.44;
controls.maxAzimuthAngle = 0.24;
controls.minPolarAngle = 0.82;
controls.maxPolarAngle = 1.08;
controls.target.set(0, 0.46, 0);

const composer = new EffectComposer(renderer);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.42,
  0.58,
  0.42,
);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const root = new THREE.Group();
scene.add(root);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(10, 10);
const clock = new THREE.Clock();

buildInterface();
createEnvironment();
const nodeLayers = createNodeLayers();
const hoverMarker = createMarker(0xd9f7ff);
const selectedMarker = createMarker(0x55c8ff);
hoverMarker.visible = false;
selectedMarker.visible = false;
root.add(hoverMarker, selectedMarker);

applyFilters();
renderDetail(null);
animate();

window.addEventListener("resize", onResize);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerleave", hideCursorOverlay);
window.addEventListener("click", onClick);
resetView.addEventListener("click", () => setCameraHome());
focusRisk.addEventListener("click", () => focusHighRiskNodes());

function buildInterface() {
  civilizationFilters.replaceChildren(
    ...Object.entries(CIVILIZATIONS).map(([key, civilization]) => {
      const label = document.createElement("label");
      label.className = "check-item";
      label.innerHTML = `
        <input type="checkbox" data-civ="${key}" checked />
        <span class="swatch" style="color: ${civilization.color}; background: ${civilization.color}"></span>
        <span>${civilization.shortLabel}</span>
      `;
      label.querySelector("input").addEventListener("change", (event) => {
        if (event.target.checked) filters.civilizations.add(key);
        else filters.civilizations.delete(key);
        applyFilters();
      });
      return label;
    }),
  );

  for (const button of tierFilters.querySelectorAll("button")) {
    button.addEventListener("click", () => {
      for (const current of tierFilters.querySelectorAll("button")) current.classList.remove("active");
      button.classList.add("active");
      filters.maxTier = Number(button.dataset.tier);
      applyFilters();
    });
  }

  legend.replaceChildren(
    ...Object.entries(CIVILIZATIONS).map(([key, civilization]) => {
      const item = document.createElement("span");
      item.className = "legend-item";
      item.innerHTML = `
        <span class="swatch" style="color: ${civilization.color}; background: ${civilization.color}"></span>
        ${civilization.label}
      `;
      return item;
    }),
  );
}

function createEnvironment() {
  scene.add(new THREE.AmbientLight(0x86c7ff, 0.72));
  root.add(createMapPlane());
  root.add(createTacticalGrid());
  root.add(createBlueprintFrames());
  particleField = createBoilingParticlePlane();
  root.add(particleField);
}

function createMapPlane() {
  const geometry = new THREE.PlaneGeometry(18.8, 12.8);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0x07111b,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(geometry, material);
  plane.position.y = GROUND_Y - 0.12;
  plane.renderOrder = -2;
  return plane;
}

function createTacticalGrid() {
  const group = new THREE.Group();
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x1d5d76,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });
  const strongMaterial = new THREE.LineBasicMaterial({
    color: 0x3ac7df,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });

  for (let x = -9; x <= 9; x += 1) {
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, GROUND_Y - 0.075, -6.2),
          new THREE.Vector3(x, GROUND_Y - 0.075, 6.2),
        ]),
        x === 0 ? strongMaterial : lineMaterial,
      ),
    );
  }

  for (let z = -6; z <= 6; z += 1) {
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-9.2, GROUND_Y - 0.075, z),
          new THREE.Vector3(9.2, GROUND_Y - 0.075, z),
        ]),
        z === 0 ? strongMaterial : lineMaterial,
      ),
    );
  }

  group.renderOrder = -1;
  return group;
}

function createBlueprintFrames() {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: 0x2f8caf,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });

  const rectangles = [
    [-8.6, -5.7, 17.2, 11.4],
    [-7.8, -4.9, 5.4, 2.4],
    [-0.8, -5.0, 6.6, 1.9],
    [4.9, 3.55, 3.6, 2.1],
  ];

  for (const [x, z, width, height] of rectangles) {
    const points = [
      new THREE.Vector3(x, GROUND_Y - 0.06, z),
      new THREE.Vector3(x + width, GROUND_Y - 0.06, z),
      new THREE.Vector3(x + width, GROUND_Y - 0.06, z + height),
      new THREE.Vector3(x, GROUND_Y - 0.06, z + height),
      new THREE.Vector3(x, GROUND_Y - 0.06, z),
    ];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  }

  group.renderOrder = 0;
  return group;
}

function createBoilingParticlePlane() {
  const positions = [];
  const colors = [];
  const strengths = [];
  const edgeFades = [];
  const phases = [];
  const rates = [];
  const scales = [];
  const rippleSeeds = [];
  const columns = 84;
  const rows = 56;
  const width = 18.4;
  const depth = 12.2;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const u = column / (columns - 1);
      const v = row / (rows - 1);
      const jitterX = (Math.random() - 0.5) * 0.035;
      const jitterZ = (Math.random() - 0.5) * 0.035;
      const x = (u - 0.5) * width + jitterX;
      const z = (v - 0.5) * depth + jitterZ;
      const y = GROUND_Y - 0.044 + Math.random() * 0.018;
      const edgeX = 1 - Math.min(1, Math.abs(x) / (width * 0.5));
      const edgeZ = 1 - Math.min(1, Math.abs(z) / (depth * 0.5));
      const edgeFade = Math.min(1, Math.pow(Math.min(edgeX, edgeZ) * 2.8, 0.7));

      if (edgeFade < 0.08 && Math.random() > 0.28) continue;

      positions.push(x, y, z);
      colors.push(1, 1, 1);
      strengths.push(0.42 + Math.random() * 0.86);
      edgeFades.push(edgeFade);
      phases.push(Math.random());
      rates.push(0.72 + Math.random() * 0.58);
      scales.push(0.72 + Math.random() * 0.72);
      rippleSeeds.push(Math.random());
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("aStrength", new THREE.Float32BufferAttribute(strengths, 1));
  geometry.setAttribute("aEdgeFade", new THREE.Float32BufferAttribute(edgeFades, 1));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute("aRate", new THREE.Float32BufferAttribute(rates, 1));
  geometry.setAttribute("aScale", new THREE.Float32BufferAttribute(scales, 1));
  geometry.setAttribute("aRippleSeed", new THREE.Float32BufferAttribute(rippleSeeds, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.48 },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float aStrength;
      attribute float aEdgeFade;
      attribute float aPhase;
      attribute float aRate;
      attribute float aScale;
      attribute float aRippleSeed;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vCrest;
      varying float vLift;

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      vec2 hash22(vec2 p) {
        float n = hash12(p);
        return vec2(n, hash12(p + n + 19.19));
      }

      void main() {
        vec3 transformed = position;
        vec2 plane = position.xz;
        float phase = aPhase * 6.2831853;
        float wideWave =
          sin(plane.x * 0.42 + uTime * 0.4 + phase) * 0.38 +
          sin(plane.y * 0.48 - uTime * 0.36 + phase * 1.73) * 0.3 +
          sin((plane.x + plane.y) * 0.24 + uTime * 0.28 + phase * 0.41) * 0.24;

        vec2 cellCoord = plane * (0.2 + aScale * 0.07);
        vec2 cell = floor(cellCoord + vec2(aRippleSeed * 17.0, aRippleSeed * 11.0));
        vec2 local = fract(cellCoord + vec2(aRippleSeed * 17.0, aRippleSeed * 11.0)) - 0.5;
        float cellSeed = hash12(cell + aRippleSeed * 31.0);
        vec2 center = (hash22(cell + vec2(9.17, 3.41)) - 0.5) * 0.36;
        float age = fract(uTime * (0.1 + cellSeed * 0.05) + cellSeed + aPhase * 0.42);
        float lift = smoothstep(0.02, 0.38, age) * (1.0 - smoothstep(0.78, 1.0, age));
        float distToBubble = length(local - center);
        float ringRadius = mix(0.14, 1.08, age);
        float ringWidth = 0.09 + age * 0.105;
        float ripple = exp(-pow((distToBubble - ringRadius) / ringWidth, 2.0)) * lift;
        float rebound = exp(-distToBubble * distToBubble / (0.045 + age * 0.24)) * lift * (1.0 - age * 0.42);
        float smallReturn = sin(distToBubble * 21.0 - age * 13.0) * 0.5 + 0.5;
        ripple *= 0.76 + smallReturn * 0.24;

        float crest = clamp(abs(wideWave) * 0.22 + ripple * 1.12 + rebound * 0.52, 0.0, 1.0);
        transformed.y += (wideWave * 0.07 + ripple * 0.2 + rebound * 0.08) * aStrength;
        vColor = color;
        vCrest = crest;
        vLift = lift;
        vAlpha = aEdgeFade * (0.055 + crest * 0.96 + lift * 0.12) * (0.7 + aStrength * 0.18);
        gl_PointSize = (1.74 + crest * 7.25 + lift * 2.15 + aScale * 0.62) * uPixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vCrest;
      varying float vLift;

      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        float dotShape = 1.0 - smoothstep(0.28, 0.5, d);
        float inner = 1.0 - smoothstep(0.0, 0.24, d);
        vec3 tint = vec3(1.0);
        float alpha = dotShape * (0.64 + inner * 0.24) * vAlpha * uOpacity;
        if (alpha < 0.015) discard;
        gl_FragColor = vec4(tint * (0.68 + vCrest * 0.18), alpha);
      }
    `,
  });
  const particles = new THREE.Points(geometry, material);
  particles.renderOrder = 1;
  return particles;
}

function createNodeLayers() {
  const groundGeometry = createFlatRingGeometry(0.18, 1);
  const columnGeometry = createElevationColumnGeometry();
  const crystalGeometry = createCrystalGeometry();
  const coreGeometry = createCrystalGeometry();
  const pickGeometry = createFlatCircleGeometry(1);
  const ground = createLayerMesh(groundGeometry, 0.24, THREE.AdditiveBlending, 2, "ground");
  const column = createLayerMesh(columnGeometry, 0.18, THREE.AdditiveBlending, 3, "column");
  const face = createLayerMesh(crystalGeometry, 0.34, THREE.NormalBlending, 4, "crystalFace");
  const glow = createLayerMesh(crystalGeometry, 0.34, THREE.AdditiveBlending, 5, "crystalGlow");
  const wire = createLayerMesh(crystalGeometry, 0.7, THREE.AdditiveBlending, 6, "crystalWire");
  const core = createLayerMesh(coreGeometry, 0.52, THREE.AdditiveBlending, 7, "crystalCore");
  const pick = createLayerMesh(pickGeometry, 0, THREE.NormalBlending, 8, "pick");
  root.add(ground, column, face, glow, wire, core, pick);
  return { ground, column, face, glow, wire, core, pick };
}

function createFlatCircleGeometry(radius) {
  const geometry = new THREE.CircleGeometry(radius, 32);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createFlatRingGeometry(innerRadius, outerRadius) {
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 36);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createFlatDiamondGeometry(radius) {
  const geometry = new THREE.CircleGeometry(radius, 4);
  geometry.rotateZ(Math.PI / 4);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createCrystalGeometry() {
  const geometry = new THREE.OctahedronGeometry(1, 0);
  geometry.rotateY(Math.PI / 4);
  return geometry;
}

function createElevationColumnGeometry() {
  return new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
}

function createFlatTickGeometry(radius, width, thickness, count) {
  const vertices = [];
  const indices = [];

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const radial = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    const tangent = new THREE.Vector2(-Math.sin(angle), Math.cos(angle));
    const center = radial.clone().multiplyScalar(radius);
    const baseIndex = vertices.length / 3;
    const corners = [
      center.clone().add(tangent.clone().multiplyScalar(-width * 0.5)).add(radial.clone().multiplyScalar(-thickness * 0.5)),
      center.clone().add(tangent.clone().multiplyScalar(width * 0.5)).add(radial.clone().multiplyScalar(-thickness * 0.5)),
      center.clone().add(tangent.clone().multiplyScalar(width * 0.5)).add(radial.clone().multiplyScalar(thickness * 0.5)),
      center.clone().add(tangent.clone().multiplyScalar(-width * 0.5)).add(radial.clone().multiplyScalar(thickness * 0.5)),
    ];

    for (const corner of corners) vertices.push(corner.x, 0, corner.y);
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createLayerMesh(geometry, opacity, blending, renderOrder, style) {
  let material;
  if (style === "ground") {
    material = createNodeShaderMaterial(opacity, style, blending);
  } else if (style === "column") {
    material = createColumnShaderMaterial(opacity, blending);
  } else if (style === "crystalFace" || style === "crystalCore" || style === "crystalGlow") {
    material = createCrystalShaderMaterial(
      opacity,
      style === "crystalCore" ? 1 : style === "crystalGlow" ? 2 : 0,
      blending,
    );
  } else if (style === "crystalWire") {
    material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true,
      blending,
      wireframe: true,
      vertexColors: true,
      toneMapped: false,
    });
  } else if (style === "pick") {
    material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      colorWrite: false,
    });
  } else {
    material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: false,
      blending,
      toneMapped: false,
    });
  }
  const mesh = new THREE.InstancedMesh(geometry, material, data.nodes.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(data.nodes.length * 3), 3);
  mesh.renderOrder = renderOrder;
  return mesh;
}

function createNodeShaderMaterial(opacity, style, blending) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending,
    toneMapped: false,
    uniforms: {
      uOpacity: { value: opacity },
      uStyle: { value: style === "ring" ? 1 : style === "ground" ? 2 : 0 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vColor;

      void main() {
        vUv = uv;
        vColor = instanceColor;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform int uStyle;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vColor;

      void main() {
        float d = distance(vUv, vec2(0.5));
        float grain = fract(sin(dot(vUv * 91.0, vec2(12.9898, 78.233))) * 43758.5453);
        float alpha;
        if (uStyle == 1) {
          float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
          float segment = fract(angle / 6.2831853 * 10.0 + 0.04);
          float dash = smoothstep(0.08, 0.16, segment) * (1.0 - smoothstep(0.72, 0.86, segment));
          float band = 1.0 - smoothstep(0.035, 0.115, abs(d - 0.43));
          float etchedEdge = 1.0 - smoothstep(0.46, 0.5, d);
          alpha = band * dash * etchedEdge * (0.8 + grain * 0.14);
        } else if (uStyle == 2) {
          float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
          float ring = 1.0 - smoothstep(0.045, 0.13, abs(d - 0.36));
          float outerRing = 1.0 - smoothstep(0.08, 0.2, abs(d - 0.43));
          float innerHaze = 1.0 - smoothstep(0.12, 0.5, d);
          float fade = 1.0 - smoothstep(0.42, 0.5, d);
          float scan = 0.72 + 0.28 * sin(uTime * 1.08 + d * 19.0 + angle * 2.0);
          float radialPulse = 0.82 + 0.18 * sin(uTime * 1.6 - d * 26.0);
          alpha = (ring * 0.74 + outerRing * 0.18 + innerHaze * innerHaze * 0.3)
            * fade
            * scan
            * radialPulse
            * (0.62 + grain * 0.08);
        } else {
          float inner = 1.0 - smoothstep(0.0, 0.13, d);
          float aura = 1.0 - smoothstep(0.18, 0.5, d);
          float breathing = 0.88 + 0.12 * sin(uTime * 1.7 + grain * 6.2831853);
          alpha = (aura * aura * 0.72 + inner * 0.16) * breathing * (0.72 + grain * 0.08);
        }
        if (alpha < 0.02) discard;
        vec3 color = vColor;
        if (uStyle == 2) {
          float ringBoost = 1.0 - smoothstep(0.05, 0.17, abs(d - 0.36));
          color = mix(vColor, vec3(0.9, 0.98, 1.0), 0.18 + ringBoost * 0.16);
          color *= 1.36 + ringBoost * 0.58;
        }
        gl_FragColor = vec4(color, alpha * uOpacity);
      }
    `,
  });
}

function createColumnShaderMaterial(opacity, blending) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uOpacity: { value: opacity },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vColor;
      varying vec3 vLocal;
      varying float vVertical;

      void main() {
        vColor = instanceColor;
        vLocal = position;
        vVertical = position.y + 0.5;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uTime;
      varying vec3 vColor;
      varying vec3 vLocal;
      varying float vVertical;

      void main() {
        float vertical = clamp(vVertical, 0.0, 1.0);
        float angle = atan(vLocal.z, vLocal.x);
        float edge = smoothstep(0.58, 1.0, length(vLocal.xz));
        float baseGlow = 1.0 - smoothstep(0.0, 0.38, vertical);
        float tipGlow = smoothstep(0.54, 1.0, vertical);
        float scanner = 0.5 + 0.5 * sin(uTime * 1.72 + vertical * 9.4);
        float seam = 0.62 + 0.38 * sin(angle * 8.0 + uTime * 0.78);
        float falloff = 1.0 - smoothstep(0.9, 1.02, vertical);
        float alpha = (edge * 0.34 + baseGlow * 0.32 + tipGlow * 0.2 + scanner * 0.12)
          * seam
          * falloff
          * uOpacity;
        if (alpha < 0.012) discard;
        vec3 color = mix(vColor, vec3(0.88, 0.98, 1.0), 0.3 + tipGlow * 0.18);
        color *= 1.65 + edge * 0.76 + tipGlow * 0.48;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

function createCrystalShaderMaterial(opacity, style, blending) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: style !== 2,
    blending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uOpacity: { value: opacity },
      uStyle: { value: style },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vLocal;

      void main() {
        vColor = instanceColor;
        vLocal = position;
        vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform int uStyle;
      uniform float uTime;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vLocal;

      void main() {
        float facet = 0.38 + abs(vNormal.y) * 0.32 + abs(vNormal.x - vNormal.z) * 0.16;
        float vertical = smoothstep(-0.95, 0.92, vLocal.y);
        float pulse = 0.88 + 0.12 * sin(uTime * 1.35 + vLocal.y * 4.0);
        vec3 darkFacet = vColor * 0.36;
        vec3 brightFacet = mix(vColor, vec3(0.88, 0.98, 1.0), 0.38);
        vec3 color = mix(darkFacet, brightFacet, facet * 0.78 + vertical * 0.18);
        float alpha = uOpacity * pulse * (0.45 + facet * 0.52);
        color *= 1.06 + facet * 0.32;

        if (uStyle == 1) {
          float center = 1.0 - smoothstep(0.0, 0.72, length(vLocal));
          color = mix(vColor, vec3(0.92, 1.0, 1.0), 0.48 + center * 0.28);
          alpha = uOpacity * (0.22 + center * 0.74) * pulse;
          color *= 1.45 + center * 0.7;
        } else if (uStyle == 2) {
          float rim = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.18, 0.98))), 1.18);
          float tip = smoothstep(0.62, 1.0, abs(vLocal.y));
          float edgeLine = smoothstep(0.1, 0.86, length(vLocal.xz));
          color = mix(vColor, vec3(0.82, 0.97, 1.0), 0.6 + tip * 0.16);
          alpha = uOpacity * pulse * (rim * 0.42 + tip * 0.22 + edgeLine * 0.12);
          color *= 2.55 + tip * 0.72;
        }

        if (alpha < 0.015) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

function applyFilters() {
  visibleNodeIds = new Set();
  const matrixDummy = new THREE.Object3D();
  const baseColor = new THREE.Color();
  const groundColor = new THREE.Color();
  const columnColor = new THREE.Color();
  const faceColor = new THREE.Color();
  const glowColor = new THREE.Color();
  const wireColor = new THREE.Color();
  const coreColor = new THREE.Color();

  data.nodes.forEach((node, index) => {
    const visible = filters.civilizations.has(node.civilization) && node.display_tier <= filters.maxTier;
    const groundPosition = groundPositionFromNode(node);
    const position = positionFromNode(node);
    const elevation = visible ? elevationFromNode(node) : 0.0001;
    const size = visible ? nodeSize(node) : 0.0001;

    baseColor.set(CIVILIZATIONS[node.civilization].color);
    if (node.risk_level >= 4) baseColor.lerp(new THREE.Color(0xc74b5b), 0.32);
    groundColor.copy(baseColor).lerp(WHITE, 0.32).multiplyScalar(1.35);
    columnColor.copy(baseColor).lerp(WHITE, 0.42).multiplyScalar(1.55);
    faceColor.copy(baseColor).lerp(WHITE, node.display_tier === 1 ? 0.28 : 0.16);
    glowColor.copy(baseColor).lerp(WHITE, 0.78).multiplyScalar(2.2);
    wireColor.copy(baseColor).lerp(WHITE, node.display_tier === 1 ? 0.5 : 0.34);
    coreColor.copy(baseColor).lerp(WHITE, 0.66).multiplyScalar(1.9);
    wireColor.multiplyScalar(1.36);

    setLayerInstance(nodeLayers.ground, index, matrixDummy, groundPosition, size * 0.86, groundColor, 0.012);
    setColumnInstance(nodeLayers.column, index, matrixDummy, groundPosition, elevation, size * 0.033, columnColor);
    setCrystalInstance(nodeLayers.face, index, matrixDummy, position, size * 1.95, faceColor, 0.045, index, 1);
    setCrystalInstance(nodeLayers.glow, index, matrixDummy, position, size * 2.62, glowColor, 0.048, index, 1.12);
    setCrystalInstance(nodeLayers.wire, index, matrixDummy, position, size * 2.03, wireColor, 0.048, index, 1.02);
    setCrystalInstance(nodeLayers.core, index, matrixDummy, position, size * 0.72, coreColor, 0.05, index, 0.72);
    setLayerInstance(nodeLayers.pick, index, matrixDummy, position, size * 1.55, baseColor, 0.02);
    if (visible) visibleNodeIds.add(node.id);
  });

  for (const mesh of [
    nodeLayers.ground,
    nodeLayers.column,
    nodeLayers.face,
    nodeLayers.glow,
    nodeLayers.wire,
    nodeLayers.core,
    nodeLayers.pick,
  ]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  updateStatus();
  if (selectedNode && !visibleNodeIds.has(selectedNode.id)) {
    selectedNode = null;
    selectedMarker.visible = false;
    renderDetail(hoveredNode && visibleNodeIds.has(hoveredNode.id) ? hoveredNode : null);
  }
}

function setLayerInstance(mesh, index, dummy, position, size, color, yOffset) {
  dummy.position.set(position.x, position.y + yOffset, position.z);
  dummy.scale.setScalar(size);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
  mesh.setColorAt(index, color);
}

function setColumnInstance(mesh, index, dummy, groundPosition, height, radius, color) {
  dummy.position.set(groundPosition.x, GROUND_Y + height * 0.5, groundPosition.z);
  dummy.scale.set(radius, height, radius);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
  mesh.setColorAt(index, color);
}

function setCrystalInstance(mesh, index, dummy, position, size, color, yOffset, spinSeed, heightScale) {
  dummy.position.set(position.x, position.y + yOffset, position.z);
  dummy.rotation.set(0, spinSeed * 0.618, 0.08 * Math.sin(spinSeed * 1.73));
  dummy.scale.set(size * 0.42, size * 1.28 * heightScale, size * 0.42);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
  mesh.setColorAt(index, color);
}

function createMarker(colorValue) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: colorValue,
    transparent: true,
    opacity: 0.72,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: false,
  });
  const outer = new THREE.Mesh(createFlatRingGeometry(0.82, 1), material);
  const inner = new THREE.Mesh(createFlatRingGeometry(0.42, 0.48), material.clone());
  inner.material.opacity = 0.48;
  group.add(outer, inner);
  group.renderOrder = 6;
  return group;
}

function onPointerMove(event) {
  if (event.target !== canvas) {
    hoveredNode = null;
    hoverMarker.visible = false;
    hideCursorOverlay();
    if (!selectedNode) renderDetail(null);
    return;
  }
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  hoveredNode = pickNode();
  updateCursorOverlay(event, hoveredNode);
  updateMarker(hoverMarker, hoveredNode, 1.4);
  if (!selectedNode) renderDetail(hoveredNode);
}

function onClick(event) {
  if (event.target !== canvas) return;
  const node = pickNode();
  if (node) {
    selectedNode = node;
    updateMarker(selectedMarker, selectedNode, 1.75);
    renderDetail(selectedNode);
  }
}

function pickNode() {
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObject(nodeLayers.pick, false);
  const hit = intersects.find((item) => {
    const node = data.nodes[item.instanceId];
    return node && visibleNodeIds.has(node.id);
  });
  return hit ? data.nodes[hit.instanceId] : null;
}

function updateMarker(marker, node, multiplier) {
  if (!node || !visibleNodeIds.has(node.id)) {
    marker.visible = false;
    return;
  }
  marker.visible = true;
  marker.position.copy(positionFromNode(node));
  marker.position.y += 0.056;
  marker.scale.setScalar(nodeSize(node) * multiplier);
}

function updateCursorOverlay(event, node) {
  if (!cursorReticle || !cursorReadout) return;
  cursorReticle.classList.add("visible");
  cursorReticle.classList.toggle("locked", Boolean(node));
  cursorReadout.classList.add("visible");
  cursorReticle.style.left = `${event.clientX}px`;
  cursorReticle.style.top = `${event.clientY}px`;
  cursorReadout.style.left = `${event.clientX}px`;
  cursorReadout.style.top = `${event.clientY}px`;

  if (node) {
    const civilization = CIVILIZATIONS[node.civilization];
    cursorReadout.textContent = `${node.name} · ${civilization.shortLabel} · Z ${node.z}`;
  } else {
    cursorReadout.textContent = `SCAN ${pointer.x.toFixed(2)}, ${pointer.y.toFixed(2)}`;
  }
}

function hideCursorOverlay() {
  if (!cursorReticle || !cursorReadout) return;
  cursorReticle.classList.remove("visible", "locked");
  cursorReadout.classList.remove("visible");
}

function renderDetail(node) {
  if (!node) {
    selectionState.textContent = "未选择";
    nodeDetail.innerHTML = `<div class="detail-empty">深色 HUD 视图 · 2.5D 高差沙盘<br />${data.summary.nodeCount} 个样本节点</div>`;
    return;
  }

  const civilization = CIVILIZATIONS[node.civilization];
  selectionState.textContent = selectedNode?.id === node.id ? "已固定" : "悬停";
  nodeDetail.innerHTML = `
    <div class="detail-title">
      <strong>${node.name}</strong>
      <span class="pill" style="border-color:${civilization.color}; color:${civilization.color}">${civilization.shortLabel}</span>
    </div>
    <div>${TYPE_LABELS[node.type]} · ${STATUS_LABELS[node.status]}</div>
    <div class="metric-grid">
      <div class="metric"><span>坐标</span><strong>${node.x}, ${node.y}, ${node.z}</strong></div>
      <div class="metric"><span>层级</span><strong>D${node.display_tier} / A${node.anchor_tier}</strong></div>
      <div class="metric"><span>人口</span><strong>${node.population_tier}</strong></div>
      <div class="metric"><span>风险</span><strong>${node.risk_level}</strong></div>
    </div>
    <div class="tags">${node.tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
  `;
}

function updateStatus() {
  const highRisk = data.nodes.filter((node) => visibleNodeIds.has(node.id) && node.risk_level >= 4).length;
  mapStatus.textContent = `${visibleNodeIds.size}/${data.summary.nodeCount} 节点 · 高危 ${highRisk} · 2.5D 高差 · 白色稀疏沸腾粒子 · ${data.summary.extents}`;
}

function positionFromNode(node) {
  const position = groundPositionFromNode(node);
  position.y += elevationFromNode(node);
  return position;
}

function groundPositionFromNode(node) {
  return new THREE.Vector3(node.x * MAP_SCALE.x, GROUND_Y, -node.y * MAP_SCALE.y);
}

function elevationFromNode(node) {
  const normalized = THREE.MathUtils.clamp((node.z + 800) / 1600, 0, 1);
  return THREE.MathUtils.lerp(ELEVATION_RANGE.min, ELEVATION_RANGE.max, normalized);
}

function nodeSize(node) {
  const tierSize = { 1: 0.13, 2: 0.098, 3: 0.074, 4: 0.054 }[node.display_tier];
  return tierSize + node.route_importance * 0.005 + node.population_tier * 0.002;
}

function createCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = getResponsiveFrustumSize();
  const cameraInstance = new THREE.OrthographicCamera(
    (frustumSize * aspect) / -2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    frustumSize / -2,
    -30,
    60,
  );
  cameraInstance.position.set(-1.6, 7.8, 9.8);
  cameraInstance.lookAt(0, 0, 0);
  return cameraInstance;
}

function setCameraHome() {
  camera.position.set(-1.6, 7.8, 9.8);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  controls.target.set(0, 0.46, 0);
}

function clampViewPan() {
  const before = controls.target.clone();
  controls.target.set(
    THREE.MathUtils.clamp(controls.target.x, PAN_LIMITS.x.min, PAN_LIMITS.x.max),
    THREE.MathUtils.clamp(controls.target.y, PAN_LIMITS.y.min, PAN_LIMITS.y.max),
    THREE.MathUtils.clamp(controls.target.z, PAN_LIMITS.z.min, PAN_LIMITS.z.max),
  );
  const correction = controls.target.clone().sub(before);
  camera.position.add(correction);
}

function focusHighRiskNodes() {
  const highRiskNodes = data.nodes.filter((node) => visibleNodeIds.has(node.id) && node.risk_level >= 4);
  if (!highRiskNodes.length) return;
  const center = highRiskNodes
    .map(positionFromNode)
    .reduce((sum, position) => sum.add(position), new THREE.Vector3())
    .divideScalar(highRiskNodes.length);
  controls.target.copy(center);
  clampViewPan();
  camera.zoom = 1.28;
  camera.updateProjectionMatrix();
}

function getResponsiveFrustumSize() {
  const aspect = window.innerWidth / window.innerHeight;
  if (aspect < 0.6) return 17.2;
  if (aspect < 1) return 14.4;
  return 12.4;
}

function onResize() {
  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = getResponsiveFrustumSize();
  camera.left = (frustumSize * aspect) / -2;
  camera.right = (frustumSize * aspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = frustumSize / -2;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
  if (particleField) particleField.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
}

function animate() {
  const elapsed = clock.getElapsedTime();
  controls.update();
  clampViewPan();
  nodeLayers.ground.material.uniforms.uTime.value = elapsed;
  nodeLayers.column.material.uniforms.uTime.value = elapsed;
  nodeLayers.face.material.uniforms.uTime.value = elapsed;
  nodeLayers.glow.material.uniforms.uTime.value = elapsed;
  nodeLayers.core.material.uniforms.uTime.value = elapsed;
  hoverMarker.rotation.y += 0.018;
  selectedMarker.rotation.y -= 0.014;
  if (particleField) {
    particleField.material.uniforms.uTime.value = elapsed;
    particleField.material.uniforms.uOpacity.value = 0.5 + Math.sin(elapsed * 0.42) * 0.035;
  }
  composer.render();
  requestAnimationFrame(animate);
}
