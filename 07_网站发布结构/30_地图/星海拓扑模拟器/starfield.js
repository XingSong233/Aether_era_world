const THREE_MODULE_URL = "./vendor/three.module.js";

export async function createStarfield(container) {
  if (!container) return null;

  let THREE;
  try {
    THREE = await import(THREE_MODULE_URL);
  } catch (error) {
    container.classList.add("starfield-fallback");
    console.warn("Three.js starfield failed to load; canvas map fallback remains active.", error);
    return null;
  }

  const layer = container.querySelector("#starfieldLayer");
  if (!layer) return null;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "starfield-canvas";
  layer.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 2400);
  camera.position.set(0, 0, 820);

  const starGroup = new THREE.Group();
  scene.add(starGroup);

  const starGeometry = new THREE.BufferGeometry();
  const starCount = 1400;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const colorA = new THREE.Color("#dff8f3");
  const colorB = new THREE.Color("#6fe2d0");
  const colorC = new THREE.Color("#f0d483");
  const colorD = new THREE.Color("#9f88e6");

  for (let i = 0; i < starCount; i += 1) {
    const radius = 240 + random(i * 3.7) * 980;
    const theta = random(i * 5.1 + 2) * Math.PI * 2;
    const band = (random(i * 8.3 + 4) - 0.5) * 0.52;
    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = Math.sin(theta) * radius * 0.62 + band * radius;
    positions[i * 3 + 2] = (random(i * 11.9 + 7) - 0.5) * 760;

    const mixColor = random(i * 13.1 + 9);
    const color = colorA.clone();
    if (mixColor > 0.82) color.lerp(colorC, 0.52);
    else if (mixColor > 0.62) color.lerp(colorB, 0.48);
    else if (mixColor < 0.12) color.lerp(colorD, 0.42);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const starMaterial = new THREE.PointsMaterial({
    size: 2.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  starGroup.add(stars);

  const veilTexture = makeVeilTexture(THREE);
  const veils = [
    { x: -250, y: 120, z: -120, scale: 680, color: "#67d4c3", opacity: 0.15 },
    { x: 270, y: -70, z: -180, scale: 760, color: "#9f88e6", opacity: 0.13 },
    { x: 30, y: -240, z: -260, scale: 620, color: "#f0d483", opacity: 0.08 }
  ].map((item) => {
    const material = new THREE.SpriteMaterial({
      map: veilTexture,
      color: new THREE.Color(item.color),
      transparent: true,
      opacity: item.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(item.x, item.y, item.z);
    sprite.scale.set(item.scale, item.scale, 1);
    scene.add(sprite);
    return sprite;
  });

  const ringGeometry = makeRingGeometry(THREE);
  const ringMaterial = new THREE.LineBasicMaterial({
    color: 0x67d4c3,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending
  });
  const rings = new THREE.LineSegments(ringGeometry, ringMaterial);
  rings.position.z = -210;
  scene.add(rings);

  let frameId = 0;
  let lastTime = performance.now();

  function resize() {
    const rect = layer.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate(now) {
    const dt = Math.min(0.035, (now - lastTime) / 1000);
    lastTime = now;
    starGroup.rotation.z += dt * 0.006;
    starGroup.rotation.x = Math.sin(now * 0.00008) * 0.04;
    rings.rotation.z -= dt * 0.018;
    veils.forEach((sprite, index) => {
      sprite.material.opacity = sprite.userData.baseOpacity ?? sprite.material.opacity;
      sprite.material.opacity *= 0.96 + Math.sin(now * 0.0006 + index) * 0.04;
      sprite.rotation += dt * (0.012 + index * 0.004);
    });
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  }

  veils.forEach((sprite) => {
    sprite.userData.baseOpacity = sprite.material.opacity;
  });

  resize();
  window.addEventListener("resize", resize);
  frameId = requestAnimationFrame(animate);

  return {
    renderer,
    dispose() {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      starGeometry.dispose();
      starMaterial.dispose();
      veilTexture.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}

function makeVeilTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.86)");
  gradient.addColorStop(0.32, "rgba(255, 255, 255, 0.2)");
  gradient.addColorStop(0.68, "rgba(255, 255, 255, 0.045)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function makeRingGeometry(THREE) {
  const points = [];
  const rings = [180, 320, 520, 760];
  for (const radius of rings) {
    for (let i = 0; i < 128; i += 1) {
      if (i % 5 === 0) continue;
      const a = (Math.PI * 2 * i) / 128;
      const b = (Math.PI * 2 * (i + 0.55)) / 128;
      points.push(Math.cos(a) * radius, Math.sin(a) * radius * 0.58, 0);
      points.push(Math.cos(b) * radius, Math.sin(b) * radius * 0.58, 0);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function random(value) {
  return fract(Math.sin(value * 12.9898) * 43758.5453);
}

function fract(value) {
  return value - Math.floor(value);
}
