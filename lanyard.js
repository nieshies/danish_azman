/* ============================================================
   lanyard.js — the hero object.

   A student ID card hanging from a lanyard: a verlet rope
   (points + distance constraints) rendered as a flat ribbon,
   with a rigid card at the end you can grab and swing.
   Plain Three.js, no physics engine.
   ============================================================ */

import * as THREE from "three";

const SEGMENTS   = 18;     // rope points
const ITERATIONS = 26;     // constraint solve passes per step
const SUBSTEPS   = 3;      // physics steps per frame
const GRAVITY    = -0.0085;
const DAMPING    = 0.982;
const BAND_W     = 0.2;    // ribbon half-width is BAND_W / 2
const CARD_W     = 2.35;
const CARD_H     = 3.45;
const SLOT_Y     = 0.3;    // slot centre, as a fraction of card height from centre
const SLOT_HH    = 0.035;  // slot half-height, in units

const canvas = document.getElementById("lanyard");
if (canvas) start(canvas);

function start(canvas) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 20);

  // ---- rope state ----------------------------------------------------
  const pos  = [];
  const prev = [];
  for (let i = 0; i < SEGMENTS; i++) {
    pos.push(new THREE.Vector3());
    prev.push(new THREE.Vector3());
  }
  let anchor = new THREE.Vector3();
  let segLen = 0.4;

  // ---- ribbon (the strap) --------------------------------------------
  const bandGeo = new THREE.BufferGeometry();
  const bandPos = new Float32Array(SEGMENTS * 2 * 3);
  bandGeo.setAttribute("position", new THREE.BufferAttribute(bandPos, 3));
  const idx = [];
  for (let i = 0; i < SEGMENTS - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  bandGeo.setIndex(idx);
  const band = new THREE.Mesh(
    bandGeo,
    new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide })
  );
  scene.add(band);

  // ---- card ------------------------------------------------------------
  const cardGroup = new THREE.Group();   // sits at the rope end, tilts with it
  const flipGroup = new THREE.Group();   // spins on Y so the card can turn over
  cardGroup.add(flipGroup);
  scene.add(cardGroup);

  // metal clip
  const clip = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.2, 0.07),
    new THREE.MeshBasicMaterial({ color: 0xa8a8a4 })
  );
  clip.position.z = 0.07;
  cardGroup.add(clip);

  const shape = roundedCardShape(CARD_W, CARD_H, 0.16);
  const frontGeo = new THREE.ShapeGeometry(shape, 12);
  remapUV(frontGeo, CARD_W, CARD_H);
  const backGeo = frontGeo.clone();

  const texture = makeCardTexture();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const front = new THREE.Mesh(frontGeo, new THREE.MeshBasicMaterial({ map: texture }));
  const back  = new THREE.Mesh(backGeo,  new THREE.MeshBasicMaterial({ color: 0xe8e8e4 }));
  back.rotation.y = Math.PI;
  back.position.z = -0.012;
  front.position.z = 0.012;

  const card = new THREE.Group();
  card.add(front, back);
  card.position.y = -CARD_H * SLOT_Y;
  flipGroup.add(card);

  let flipAngle = 0, flipVel = 0;

  // ---- layout ----------------------------------------------------------
  let viewH = 1, viewW = 1, narrow = false;

  function layout() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    viewH = 2 * Math.tan((camera.fov * Math.PI) / 180 / 2) * camera.position.z;
    viewW = viewH * camera.aspect;
    narrow = w < 760;

    // Hangs from the top edge, right of centre on desktop.
    // on phones it tucks into the top-right corner, clear of the name
    anchor.set(narrow ? viewW * 0.28 : viewW * 0.1, viewH / 2 + 0.3, 0);
    segLen = (viewH * (narrow ? 0.22 : 0.4)) / (SEGMENTS - 1);

    const scale = narrow ? 0.7 : 1;
    cardGroup.scale.setScalar(scale);
    clip.scale.setScalar(scale);
  }

  function resetRope() {
    for (let i = 0; i < SEGMENTS; i++) {
      pos[i].set(anchor.x, anchor.y - segLen * i, 0);
      prev[i].copy(pos[i]);
    }
    // a small nudge so it settles with some life in it
    prev[SEGMENTS - 1].x -= 0.22;
  }

  layout();
  resetRope();

  // ---- pointer ---------------------------------------------------------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hitPoint = new THREE.Vector3();
  const grabOffset = new THREE.Vector3();
  let dragging = false;

  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    ray.ray.intersectPlane(plane, hitPoint);
    return hitPoint;
  }

  canvas.addEventListener("pointerdown", (e) => {
    const p = toWorld(e);
    const r = ray.intersectObject(front, false);
    const end = pos[SEGMENTS - 1];
    // grab the card itself, or anywhere close to the dangling end
    if (r.length || p.distanceTo(end) < CARD_H * 0.75) {
      dragging = true;
      grabOffset.copy(end).sub(p);
      canvas.classList.add("dragging");
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const p = toWorld(e);
    const end = pos[SEGMENTS - 1];
    end.copy(p).add(grabOffset);
    e.preventDefault();
  });

  const release = () => {
    dragging = false;
    canvas.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("pointerleave", release);

  window.addEventListener("resize", () => { layout(); });

  // ---- simulation ------------------------------------------------------
  const dir = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function step() {
    const last = SEGMENTS - 1;

    for (let i = 1; i < SEGMENTS; i++) {
      if (dragging && i === last) continue;        // the pointer owns this one
      tmp.copy(pos[i]);
      pos[i].x += (pos[i].x - prev[i].x) * DAMPING;
      pos[i].y += (pos[i].y - prev[i].y) * DAMPING + GRAVITY;
      prev[i].copy(tmp);
    }
    pos[0].copy(anchor);

    for (let k = 0; k < ITERATIONS; k++) {
      for (let i = 0; i < SEGMENTS - 1; i++) {
        const a = pos[i], b = pos[i + 1];
        dir.subVectors(b, a);
        const d = dir.length() || 1e-6;
        const corr = (d - segLen) / d;
        const pinA = i === 0;
        const pinB = dragging && i + 1 === last;
        if (pinA && pinB) continue;
        if (pinA)      b.addScaledVector(dir, -corr);
        else if (pinB) a.addScaledVector(dir, corr);
        else {
          a.addScaledVector(dir, corr * 0.5);
          b.addScaledVector(dir, -corr * 0.5);
        }
      }
      pos[0].copy(anchor);
    }
  }

  function updateCard() {
    const end = pos[SEGMENTS - 1];
    const before = pos[SEGMENTS - 3];
    dir.subVectors(end, before);
    const angle = Math.atan2(dir.y, dir.x) + Math.PI / 2;

    cardGroup.position.copy(end);
    cardGroup.rotation.z = angle;

    // sideways motion sets the card spinning, then it settles facing front
    const vx = end.x - prev[SEGMENTS - 1].x;
    flipVel += vx * 0.035;
    flipVel -= flipAngle * 0.006;
    flipVel *= 0.93;
    flipAngle += flipVel;
    flipGroup.rotation.y = flipAngle;
  }

  function updateBand() {
    for (let i = 0; i < SEGMENTS; i++) {
      const a = pos[Math.max(0, i - 1)];
      const b = pos[Math.min(SEGMENTS - 1, i + 1)];
      dir.subVectors(b, a).normalize();
      nrm.set(-dir.y, dir.x, 0).multiplyScalar(BAND_W / 2);
      const o = i * 6;
      bandPos[o]     = pos[i].x + nrm.x;
      bandPos[o + 1] = pos[i].y + nrm.y;
      bandPos[o + 2] = 0;
      bandPos[o + 3] = pos[i].x - nrm.x;
      bandPos[o + 4] = pos[i].y - nrm.y;
      bandPos[o + 5] = 0;
    }
    bandGeo.attributes.position.needsUpdate = true;
    bandGeo.computeBoundingSphere();
  }

  function frame() {
    if (!reduced) for (let s = 0; s < SUBSTEPS; s++) step();
    updateCard();
    updateBand();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
}

/* ---------- geometry helpers ------------------------------------------ */

function roundedCardShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);

  // slot the lanyard clip passes through
  const hw = w * 0.125, cy = h * SLOT_Y;
  const hole = new THREE.Path();
  hole.moveTo(-hw, cy - SLOT_HH);
  hole.lineTo(hw, cy - SLOT_HH);
  hole.lineTo(hw, cy + SLOT_HH);
  hole.lineTo(-hw, cy + SLOT_HH);
  hole.lineTo(-hw, cy - SLOT_HH);
  s.holes.push(hole);
  return s;
}

// ShapeGeometry lays UVs out in shape units — remap them to 0..1.
function remapUV(geo, w, h) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) + w / 2) / w, (uv.getY(i) + h / 2) / h);
  }
  uv.needsUpdate = true;
}

/* ---------- the card face --------------------------------------------- */

function makeCardTexture() {
  const W = 620, H = 908;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);

  const draw = (photo) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, W, H);

    // header
    g.fillStyle = "#111111";
    g.fillRect(0, 0, W, 132);
    g.fillStyle = "#ffffff";
    g.font = "600 25px 'Inter Tight', Inter, sans-serif";
    g.letterSpacing = "2px";
    g.fillText("UNIVERSITI SAINS", 42, 62);
    g.fillText("MALAYSIA", 42, 96);

    g.font = "500 15px Inter, sans-serif";
    g.letterSpacing = "3px";
    g.fillStyle = "rgba(255,255,255,.55)";
    g.fillText("STUDENT CARD", 42, 120);

    // slot — ringed, so the cut-out reads as a reinforced punch hole
    g.fillStyle = "#e9e9e5";
    roundRect(g, W / 2 - 100, 0.2 * H - 23, 200, 46, 23);
    g.fill();

    // photo
    const px = 42, py = 236, pw = 212, ph = 268;
    g.fillStyle = "#e6e6e2";
    g.fillRect(px, py, pw, ph);
    if (photo) {
      g.save();
      g.beginPath(); g.rect(px, py, pw, ph); g.clip();
      // cover, biased upward so a headshot keeps the top of the head
      const s = Math.max(pw / photo.width, ph / photo.height);
      g.drawImage(photo, px + (pw - photo.width * s) / 2, py + (ph - photo.height * s) * 0.3,
                  photo.width * s, photo.height * s);
      g.restore();
      // the visa photo's white background would otherwise bleed into the card
      g.strokeStyle = "#dededa";
      g.lineWidth = 2;
      g.strokeRect(px, py, pw, ph);
    } else {
      g.fillStyle = "#b9b9b3";
      g.font = "600 60px 'Inter Tight', Inter, sans-serif";
      g.letterSpacing = "0px";
      g.fillText("MD", px + 62, py + 160);
    }

    // details beside the photo
    let ty = 262;
    const row = (label, value, size = 21) => {
      g.fillStyle = "#9a9a94";
      g.font = "500 13px Inter, sans-serif";
      g.letterSpacing = "2.4px";
      g.fillText(label.toUpperCase(), 290, ty);
      g.fillStyle = "#111111";
      g.font = `600 ${size}px 'Inter Tight', Inter, sans-serif`;
      g.letterSpacing = "-0.3px";
      ty += 30;
      for (const line of value) { g.fillText(line, 290, ty); ty += size + 6; }
      ty += 22;
    };
    row("Name", ["Muhammad Danish", "bin Mohd Azman"]);
    row("Programme", ["Software", "Engineering (Hons)"], 19);

    // footer block
    g.fillStyle = "#111111";
    g.fillRect(42, 556, W - 84, 1);

    g.fillStyle = "#9a9a94";
    g.font = "500 13px Inter, sans-serif";
    g.letterSpacing = "2.4px";
    g.fillText("SESSION", 42, 596);
    g.fillText("GITHUB", 320, 596);
    g.fillStyle = "#111111";
    g.font = "600 20px 'Inter Tight', Inter, sans-serif";
    g.letterSpacing = "-0.2px";
    g.fillText("2023 — PRESENT", 42, 626);
    g.fillText("nieshies", 320, 626);

    // barcode
    let bx = 42;
    g.fillStyle = "#111111";
    for (let i = 0; bx < W - 42; i++) {
      const bw = 2 + ((i * 37) % 5);
      g.fillRect(bx, 690, bw, 72);
      bx += bw + 3 + ((i * 17) % 4);
    }

    g.fillStyle = "#9a9a94";
    g.font = "500 13px Inter, sans-serif";
    g.letterSpacing = "3px";
    g.fillText("SOFTWARE ENGINEERING  ·  USM", 42, 800);

    g.fillStyle = "#111111";
    g.fillRect(0, H - 54, W, 54);
    g.fillStyle = "#ffffff";
    g.font = "600 17px 'Inter Tight', Inter, sans-serif";
    g.letterSpacing = "2px";
    g.fillText("DANISH AZMAN.", 42, H - 20);

    tex.needsUpdate = true;
  };

  draw(null);

  // Drop a headshot at images/card-photo.jpg and it appears on the card.
  const img = new Image();
  img.onload = () => draw(img);
  img.src = "images/card-photo.jpg";

  // Fonts land after first paint — redraw once they're ready.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => draw(img.complete && img.naturalWidth ? img : null));
  }

  return tex;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
