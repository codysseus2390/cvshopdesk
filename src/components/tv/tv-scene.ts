import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * The 3D shop behind TV mode, drawn with three.js onto a transparent canvas
 * that sits over the CSS brushed-metal base:
 *
 * - two tires on the balancer, turning slowly at different depths, with a
 *   glowing lip on each rim (orange right, green left);
 * - diagonal neon light streaks sliding along their own axis at several
 *   depths, the same slashes as the brand art;
 * - a shop floor grid rolling toward the camera and fading into the dark;
 * - embers drifting up through the whole volume;
 * - two coloured lights orbiting the tires, and a camera that sways just
 *   enough to give real parallax.
 *
 * Everything is sized for a shop TV left on all day: no allocations per
 * frame, pixel ratio capped, the loop parks while the tab is hidden, and with
 * `reducedMotion` it renders a single still frame and never animates.
 *
 * Loaded with a dynamic import from `TvBackground`, so three.js only ships
 * with the TV route and never runs during SSR.
 */

export interface TvSceneHandle {
  dispose: () => void;
}

const ORANGE = 0xf2581a;
const GREEN = 0x86c232;
const EMBER = 0xffb27a;
const FOG = 0x15110e;

/** Soft round falloff used for embers and light pools. */
function radialTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Bright core fading out to both sides — the cross-section of a neon tube. */
function streakTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const across = ctx.createLinearGradient(0, 0, 64, 0);
    across.addColorStop(0, "rgba(255,255,255,0)");
    across.addColorStop(0.42, "rgba(255,255,255,0.35)");
    across.addColorStop(0.5, "rgba(255,255,255,1)");
    across.addColorStop(0.58, "rgba(255,255,255,0.35)");
    across.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, 64, 256);
    // Taper both ends so a streak never shows a hard cut-off.
    ctx.globalCompositeOperation = "destination-in";
    const along = ctx.createLinearGradient(0, 0, 0, 256);
    along.addColorStop(0, "rgba(0,0,0,0)");
    along.addColorStop(0.3, "rgba(0,0,0,1)");
    along.addColorStop(0.7, "rgba(0,0,0,1)");
    along.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = along;
    ctx.fillRect(0, 0, 64, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A tire on a machined five-spoke rim, lying in the XY plane (axle on Z). */
function buildTire(accent: number): THREE.Group {
  const tire = new THREE.Group();

  const rubber = new THREE.MeshStandardMaterial({
    color: 0x151311,
    roughness: 0.82,
    metalness: 0.08,
  });
  const casing = new THREE.Mesh(new THREE.TorusGeometry(3, 1.05, 28, 120), rubber);
  tire.add(casing);

  // Directional tread: two staggered rows of angled blocks round the crown.
  const blocks = 64;
  const tread = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.3, 0.95), rubber, blocks);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < blocks; i++) {
    const row = i % 2 === 0 ? 1 : -1;
    const angle = (Math.floor(i / 2) / (blocks / 2)) * Math.PI * 2 + (row > 0 ? 0 : Math.PI / 32);
    const radius = 4.08;
    dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, row * 0.48);
    dummy.rotation.set(0, 0, angle);
    dummy.rotateY(row * 0.42);
    dummy.updateMatrix();
    tread.setMatrixAt(i, dummy.matrix);
  }
  tire.add(tread);

  const metal = new THREE.MeshStandardMaterial({ color: 0x5a5a5e, metalness: 0.95, roughness: 0.28 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 1.5, 72, 1, true), metal);
  barrel.rotation.x = Math.PI / 2;
  tire.add(barrel);

  const face = new THREE.Mesh(new THREE.CircleGeometry(2.0, 72), metal);
  face.position.z = -0.35;
  tire.add(face);

  const spokeGeometry = new THREE.BoxGeometry(0.42, 1.75, 0.22);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(spokeGeometry, metal);
    const angle = (i / 5) * Math.PI * 2;
    spoke.position.set(Math.cos(angle) * 1.0, Math.sin(angle) * 1.0, 0.25);
    spoke.rotation.z = angle - Math.PI / 2;
    tire.add(spoke);
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 0.5, 40), metal);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.3;
  tire.add(hub);

  // The glowing lip is the accent that reads from across the shop.
  const glow = new THREE.MeshBasicMaterial({ color: accent, toneMapped: false });
  const lip = new THREE.Mesh(new THREE.TorusGeometry(2.02, 0.045, 10, 120), glow);
  lip.position.z = 0.76;
  tire.add(lip);
  const cap = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 48), glow);
  cap.position.z = 0.56;
  tire.add(cap);

  return tire;
}

interface Streak {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  travel: number;
  speed: number;
  offset: number;
  peak: number;
}

export function createTvScene(
  canvas: HTMLCanvasElement,
  options: { reducedMotion: boolean; onContextLost?: () => void },
): TvSceneHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG, 14, 46);

  // A neutral studio environment so the rims read as polished metal.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTarget = pmrem.fromScene(room, 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 120);
  camera.position.set(0, 0.5, 12);
  const lookTarget = new THREE.Vector3(0, -0.5, -10);

  // --- Lights -------------------------------------------------------------
  scene.add(new THREE.AmbientLight(0x3a2c22, 0.7));
  const key = new THREE.DirectionalLight(0xfff1e2, 0.55);
  key.position.set(-6, 10, 8);
  scene.add(key);
  const orangeLight = new THREE.PointLight(ORANGE, 140, 40, 1.6);
  scene.add(orangeLight);
  const greenLight = new THREE.PointLight(GREEN, 90, 36, 1.6);
  scene.add(greenLight);

  // --- Tires ----------------------------------------------------------------
  const bigTire = buildTire(ORANGE);
  bigTire.position.set(11.5, -3.2, -12);
  bigTire.scale.setScalar(1.55);
  bigTire.rotation.y = -0.55;
  scene.add(bigTire);

  const farTire = buildTire(GREEN);
  farTire.position.set(-15, 6.5, -22);
  farTire.scale.setScalar(1.25);
  farTire.rotation.y = 0.65;
  scene.add(farTire);

  // Light pools under each tire, so they sit on something.
  const radial = radialTexture();
  const poolGeometry = new THREE.PlaneGeometry(1, 1);
  for (const [color, x, z, size] of [
    [ORANGE, 11.5, -12, 20],
    [GREEN, -15, -22, 18],
  ] as const) {
    const pool = new THREE.Mesh(
      poolGeometry,
      new THREE.MeshBasicMaterial({
        map: radial,
        color,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, -9.4, z);
    pool.scale.setScalar(size);
    scene.add(pool);
  }

  // --- Floor grid -------------------------------------------------------------
  const cell = 2.5;
  const gridLines: number[] = [];
  for (let x = -60; x <= 60; x += cell) gridLines.push(x, 0, -80, x, 0, 20);
  for (let z = -80; z <= 20; z += cell) gridLines.push(-60, 0, z, 60, 0, z);
  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(gridLines, 3));
  const grid = new THREE.LineSegments(
    gridGeometry,
    new THREE.LineBasicMaterial({ color: 0x5b3a26, transparent: true, opacity: 0.55 }),
  );
  grid.position.y = -9.5;
  scene.add(grid);

  // --- Neon streaks ---------------------------------------------------------
  const streakMap = streakTexture();
  const streakGeometry = new THREE.PlaneGeometry(1, 1);
  const streaks: Streak[] = [];
  const streakSpecs: [number, number, number, number, number, number][] = [
    // color, x, y, z, angle (rad from vertical), width
    [ORANGE, 17, 6, -6, 0.72, 0.5],
    [ORANGE, 13, 10, -14, 0.72, 0.7],
    [ORANGE, -17, -6, -8, 0.72, 0.55],
    [ORANGE, -12, -11, -18, 0.72, 0.8],
    [GREEN, -19, 2, -16, 0.72, 0.45],
    [ORANGE, 4, 13, -26, 0.72, 1.1],
    [GREEN, 20, -8, -20, 0.72, 0.6],
  ];
  streakSpecs.forEach(([color, x, y, z, angle, width], index) => {
    const material = new THREE.MeshBasicMaterial({
      map: streakMap,
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(streakGeometry, material);
    mesh.scale.set(width, 16 + (index % 3) * 5, 1);
    mesh.rotation.z = angle;
    scene.add(mesh);
    streaks.push({
      mesh,
      material,
      origin: new THREE.Vector3(x, y, z),
      // Travel along the streak's own long axis.
      direction: new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0),
      travel: 26,
      speed: 0.018 + (index % 4) * 0.006,
      offset: index * 0.37,
      peak: 0.55 + (index % 3) * 0.15,
    });
  });

  // --- Embers ---------------------------------------------------------------
  const emberCount = 420;
  const emberPositions = new Float32Array(emberCount * 3);
  const emberColors = new Float32Array(emberCount * 3);
  const emberSpeeds = new Float32Array(emberCount);
  const emberPhases = new Float32Array(emberCount);
  const bounds = { x: 26, yMin: -10, yMax: 14, zMin: -30, zMax: 4 };
  const orange = new THREE.Color(ORANGE);
  const ember = new THREE.Color(EMBER);
  const green = new THREE.Color(GREEN);
  for (let i = 0; i < emberCount; i++) {
    emberPositions[i * 3] = (Math.random() * 2 - 1) * bounds.x;
    emberPositions[i * 3 + 1] = bounds.yMin + Math.random() * (bounds.yMax - bounds.yMin);
    emberPositions[i * 3 + 2] = bounds.zMin + Math.random() * (bounds.zMax - bounds.zMin);
    const pick = Math.random();
    const color = pick < 0.55 ? orange : pick < 0.85 ? ember : green;
    const brightness = 0.45 + Math.random() * 0.55;
    emberColors[i * 3] = color.r * brightness;
    emberColors[i * 3 + 1] = color.g * brightness;
    emberColors[i * 3 + 2] = color.b * brightness;
    emberSpeeds[i] = 0.25 + Math.random() * 0.75;
    emberPhases[i] = Math.random() * Math.PI * 2;
  }
  const emberGeometry = new THREE.BufferGeometry();
  const emberPositionAttr = new THREE.BufferAttribute(emberPositions, 3);
  emberPositionAttr.setUsage(THREE.DynamicDrawUsage);
  emberGeometry.setAttribute("position", emberPositionAttr);
  emberGeometry.setAttribute("color", new THREE.BufferAttribute(emberColors, 3));
  const embers = new THREE.Points(
    emberGeometry,
    new THREE.PointsMaterial({
      map: radial,
      size: 0.32,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  scene.add(embers);

  // --- Sizing ---------------------------------------------------------------
  const resize = () => {
    const parent = canvas.parentElement;
    const width = parent?.clientWidth || window.innerWidth;
    const height = parent?.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };
  resize();

  // --- Animation ------------------------------------------------------------
  let elapsed = 0;
  let last = performance.now();
  let frame = 0;
  let running = false;

  const update = (dt: number) => {
    elapsed += dt;
    const t = elapsed;

    bigTire.rotation.z -= dt * 0.22;
    farTire.rotation.z += dt * 0.3;
    bigTire.position.y = -3.2 + Math.sin(t * 0.4) * 0.25;
    farTire.position.y = 6.5 + Math.sin(t * 0.33 + 1.4) * 0.3;

    orangeLight.position.set(
      11.5 + Math.cos(t * 0.35) * 9,
      2 + Math.sin(t * 0.5) * 3,
      -6 + Math.sin(t * 0.35) * 6,
    );
    greenLight.position.set(
      -13 + Math.cos(t * 0.28 + 2) * 8,
      3 + Math.cos(t * 0.42) * 3,
      -14 + Math.sin(t * 0.28 + 2) * 6,
    );
    orangeLight.intensity = 130 + Math.sin(t * 1.3) * 18;

    grid.position.z = (t * 0.9) % cell;

    for (const s of streaks) {
      const phase = (t * s.speed + s.offset) % 1;
      s.mesh.position.copy(s.origin).addScaledVector(s.direction, (phase - 0.5) * s.travel);
      // Fade in and out across each pass so the wrap is never visible.
      s.material.opacity = Math.sin(phase * Math.PI) * s.peak;
    }

    for (let i = 0; i < emberCount; i++) {
      const i3 = i * 3;
      const y = (emberPositions[i3 + 1] ?? 0) + (emberSpeeds[i] ?? 0) * dt;
      if (y > bounds.yMax) {
        emberPositions[i3] = (Math.random() * 2 - 1) * bounds.x;
        emberPositions[i3 + 1] = bounds.yMin;
      } else {
        const sway = Math.sin(t * 0.6 + (emberPhases[i] ?? 0)) * dt * 0.25;
        emberPositions[i3] = (emberPositions[i3] ?? 0) + sway;
        emberPositions[i3 + 1] = y;
      }
    }
    emberPositionAttr.needsUpdate = true;

    camera.position.x = Math.sin(t * 0.07) * 1.4;
    camera.position.y = 0.5 + Math.sin(t * 0.05) * 0.6;
    camera.lookAt(lookTarget);
  };

  const render = () => renderer.render(scene, camera);

  const tick = (now: number) => {
    if (!running) return;
    // Clamp so a long stall (sleeping TV, throttled tab) doesn't jump the scene.
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    update(dt);
    render();
    frame = requestAnimationFrame(tick);
  };

  const start = () => {
    if (running || options.reducedMotion) return;
    running = true;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
  };

  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);

  const observer = new ResizeObserver(() => {
    resize();
    if (!running) render();
  });
  if (canvas.parentElement) observer.observe(canvas.parentElement);

  const onContextLost = (event: Event) => {
    event.preventDefault();
    stop();
    options.onContextLost?.();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  // First frame either way; reduced motion stops here.
  update(options.reducedMotion ? 6 : 0);
  render();
  if (!document.hidden) start();

  return {
    dispose: () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      observer.disconnect();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.LineSegments ||
          object instanceof THREE.Points
        ) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      });
      radial.dispose();
      streakMap.dispose();
      envTarget.dispose();
      room.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
