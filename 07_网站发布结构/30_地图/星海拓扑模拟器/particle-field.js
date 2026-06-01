export async function createParticleField() {
  const layer = document.querySelector("#particleLayer");
  const engine = await waitForParticlesEngine();
  if (!layer || !engine) {
    return null;
  }

  const options = {
    fullScreen: { enable: false },
    fpsLimit: 60,
    detectRetina: true,
    background: { color: "transparent" },
    particles: {
      number: {
        value: 105,
        density: {
          enable: true,
          width: 1200,
          height: 900
        }
      },
      color: {
        value: ["#dff8f3", "#67d4c3", "#f0d483", "#aa8ce8"]
      },
      shape: {
        type: "circle"
      },
      opacity: {
        value: { min: 0.18, max: 0.78 },
        animation: {
          enable: true,
          speed: 0.55,
          minimumValue: 0.16,
          sync: false
        }
      },
      size: {
        value: { min: 0.8, max: 2.7 },
        animation: {
          enable: true,
          speed: 1.1,
          minimumValue: 0.4,
          sync: false
        }
      },
      links: {
        enable: true,
        distance: 150,
        color: "#8ce8dc",
        opacity: 0.18,
        width: 0.8,
        blink: false,
        consent: false
      },
      move: {
        enable: true,
        speed: { min: 0.08, max: 0.42 },
        direction: "none",
        random: true,
        straight: false,
        outModes: {
          default: "out"
        },
        attract: {
          enable: true,
          rotate: {
            x: 900,
            y: 1200
          }
        }
      }
    },
    interactivity: {
      detectsOn: "window",
      events: {
        onHover: {
          enable: true,
          mode: "grab"
        },
        resize: {
          enable: true
        }
      },
      modes: {
        grab: {
          distance: 180,
          links: {
            opacity: 0.32
          }
        }
      }
    }
  };

  try {
    return await loadParticles(engine, options);
  } catch (error) {
    layer.classList.add("particle-fallback");
    console.warn("tsParticles layer failed to load; map remains usable.", error);
    return null;
  }
}

function waitForParticlesEngine() {
  if (window.tsParticles) {
    return Promise.resolve(window.tsParticles);
  }

  return new Promise((resolve) => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (window.tsParticles || attempts >= 20) {
        window.clearInterval(timer);
        resolve(window.tsParticles ?? null);
      }
    }, 100);
  });
}

async function loadParticles(engine, options) {
  try {
    return await engine.load({ id: "particleLayer", options });
  } catch {
    return await engine.load("particleLayer", options);
  }
}
