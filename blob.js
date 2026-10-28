/* ============================================================
   blob.js — the second 3D moment, beside the Toolkit heading.

   A glossy black sculpture: a UV sphere pushed around by three
   multiplied sine waves, lit entirely by speculars and a fresnel
   rim. Two hairline rings and three pebbles orbit it on their own
   rotation state, so the whole thing reads like a gyroscope.

   Move the pointer to guide it, drag to spin it, arrow keys when
   focused.
   ============================================================ */

import * as THREE from "three";

const RADIUS   = 1.22;
const EASE_K   = 2.8;     // exponential damping constant
const RING_A   = 2.78;
const RING_B   = 3.08;

// The hero lanyard already holds a WebGL context; a second one is a real cost
// on a phone, and this sculpture is decorative. Desktop only.
const wrap = window.innerWidth >= 760 ? document.querySelector("[data-blob]") : null;
const canvas = wrap && wrap.querySelector("canvas");
if (canvas) start(wrap, canvas);

function start(wrap, canvas) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.z = 8.4;

  /* ---- the sculpture ------------------------------------------------ */
  const uniforms = { uTime: { value: 0 } };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec3 p = position;
        float wave = sin(p.y * 4.2 + uTime * 0.9) * cos(p.x * 3.1 - uTime * 0.55);
        wave += sin(p.z * 4.7 - uTime * 0.7) * 0.35;
        p += normalize(p) * wave * 0.075;

        // Deliberately the direction of the displaced vertex, not the true
        // surface normal — that is what makes it read as liquid rather than
        // showing every ridge of the wave.
        vNormal = normalize(mat3(modelMatrix) * normalize(p));

        vec4 world = modelMatrix * vec4(p, 1.0);
        vView = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vView);
        vec3 lightA = normalize(vec3(-0.45, 0.72, 0.52));
        vec3 lightB = normalize(vec3(0.62, 0.28, 0.46));

        float diffuse = max(dot(n, lightA), 0.0);
        float glossA  = pow(max(dot(reflect(-lightA, n), v), 0.0), 52.0);
        float glossB  = pow(max(dot(reflect(-lightB, n), v), 0.0), 24.0) * 0.28;
        float glossC  = pow(max(dot(reflect(-lightA, n), v), 0.0),  8.0) * 0.24;
        float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.8);
        float sheen   = pow(max(dot(n, normalize(vec3(-0.25, 0.82, 0.5))), 0.0), 8.0) * 0.24;

        vec3 color = vec3(0.008) + vec3(0.045) * diffuse
                   + vec3(0.70) * glossA + vec3(0.24) * glossB
                   + vec3(0.20) * fresnel + vec3(0.25) * sheen
                   + vec3(0.60) * glossC;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const sphere = new THREE.SphereGeometry(RADIUS, 64, 48);
  const blobGroup = new THREE.Group();
  blobGroup.add(new THREE.Mesh(sphere, material));
  scene.add(blobGroup);

  /* ---- rings, dots and pebbles -------------------------------------- */
  const orbitGroup = new THREE.Group();
  scene.add(orbitGroup);

  function ringPoints(radius, count) {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      a[i * 3] = Math.cos(t) * radius;
      a[i * 3 + 1] = Math.sin(t) * radius;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(a, 3));
    return g;
  }

  function dotTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "#0a0a0a";
    g.beginPath();
    g.arc(32, 32, 27, 0, Math.PI * 2);
    g.fill();
    return new THREE.CanvasTexture(c);
  }
  const dotMap = dotTexture();

  [[RING_A, 0.6, 12, 6.5], [RING_B, 0.42, 8, 4.5]].forEach(function (cfg) {
    const [radius, opacity, dots, size] = cfg;
    const line = new THREE.LineLoop(
      ringPoints(radius, 240),
      new THREE.LineBasicMaterial({
        color: 0x141414, transparent: true, opacity: opacity, depthWrite: false,
      })
    );
    orbitGroup.add(line);

    const pts = new THREE.Points(
      ringPoints(radius, dots),
      new THREE.PointsMaterial({
        size: size, map: dotMap, transparent: true, depthWrite: false,
        sizeAttenuation: false, color: 0x0a0a0a,
      })
    );
    orbitGroup.add(pts);
  });

  const pebbles = [
    { phase: 0.35, radius: 3.16, size: [0.14, 0.105, 0.12], dir: 0.13 },
    { phase: 2.65, radius: 3.22, size: [0.10, 0.15, 0.12], dir: -0.16 },
    { phase: 4.80, radius: 3.18, size: [0.12, 0.105, 0.16], dir: 0.13 },
  ].map(function (cfg) {
    const m = new THREE.Mesh(sphere, material);
    m.scale.set(cfg.size[0], cfg.size[1], cfg.size[2]);
    orbitGroup.add(m);
    return { mesh: m, cfg: cfg };
  });

  /* ---- interaction state -------------------------------------------- */
  const S = { x: -0.12, y: 0, tiltX: 0, tiltY: 0, spin: 0 };
  const T = { x: -0.12, y: 0, tiltX: 0, tiltY: 0, spin: 0 };
  let dragging = false, lastX = 0, lastY = 0;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  wrap.addEventListener("pointermove", function (e) {
    const r = wrap.getBoundingClientRect();
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      T.y += (dx / r.width) * Math.PI * 2;
      T.x = clamp(T.x - dy * 0.008, -1.1, 1.1);
      T.tiltX += (dy / r.height) * Math.PI * 2;
      T.tiltY += (dx / r.width) * Math.PI * 2;
      T.spin += (dx / r.width) * Math.PI * 2;
    } else {
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      T.y = (x - 0.5) * 0.9;
      T.x = clamp(-(y - 0.5) * 0.7 - 0.12, -0.55, 0.55);
      T.tiltX = (y - 0.5) * 0.8;
      T.tiltY = (x - 0.5) * 0.9;
      T.spin = (x - 0.5) * 0.32;
    }
    if (reduced) render();
  });

  wrap.addEventListener("pointerdown", function (e) {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    wrap.setPointerCapture(e.pointerId);
    wrap.classList.add("is-dragging");
  });
  const release = function () { dragging = false; wrap.classList.remove("is-dragging"); };
  wrap.addEventListener("pointerup", release);
  wrap.addEventListener("pointercancel", release);

  wrap.addEventListener("keydown", function (e) {
    const step = e.shiftKey ? 0.18 : 0.08;
    if (e.key === "ArrowLeft")  { T.y -= step; T.tiltY -= step; }
    else if (e.key === "ArrowRight") { T.y += step; T.tiltY += step; }
    else if (e.key === "ArrowUp")    { T.x = clamp(T.x - step, -1.1, 1.1); }
    else if (e.key === "ArrowDown")  { T.x = clamp(T.x + step, -1.1, 1.1); }
    else return;
    e.preventDefault();
    if (reduced) render();
  });

  /* ---- sizing -------------------------------------------------------- */
  function resize() {
    const w = canvas.clientWidth || wrap.clientWidth;
    const h = canvas.clientHeight || wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(wrap);
  window.addEventListener("resize", resize);
  resize();

  let visible = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && reduced) render();
    }, { threshold: 0.01 }).observe(wrap);
  }

  /* ---- loop ---------------------------------------------------------- */
  let last = performance.now();

  function render() {
    blobGroup.rotation.x = S.x;
    blobGroup.rotation.y = S.y;
    orbitGroup.rotation.x = S.tiltX;
    orbitGroup.rotation.y = S.tiltY;
    orbitGroup.rotation.z = S.spin;

    const t = uniforms.uTime.value;
    pebbles.forEach(function (p, i) {
      const angle = t * p.cfg.dir + p.cfg.phase;
      p.mesh.position.set(
        Math.cos(angle) * p.cfg.radius,
        Math.sin(angle) * p.cfg.radius * 0.7,
        Math.sin(angle * 1.3) * 0.55
      );
    });
    renderer.render(scene, camera);
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const ease = 1 - Math.exp(-EASE_K * dt);
    S.x += (T.x - S.x) * ease;
    S.y += (T.y - S.y) * ease;
    S.tiltX += (T.tiltX - S.tiltX) * ease;
    S.tiltY += (T.tiltY - S.tiltY) * ease;
    S.spin += (T.spin - S.spin) * ease;
    uniforms.uTime.value = now / 1000;
    if (visible) render();
    requestAnimationFrame(frame);
  }

  if (reduced) {
    // stays fully interactive, but nothing moves on its own
    S.x = T.x; S.y = T.y; S.tiltX = T.tiltX; S.tiltY = T.tiltY; S.spin = T.spin;
    render();
  } else {
    requestAnimationFrame(frame);
  }
}
