import { W, H, MAPS, clamp, dist, move } from "./engine.js";
export const SKINS = {
  Default: "#36b8ff",
  Rogue: "#ff5d66",
  Neon: "#98e355",
  Arctic: "#ddf5ff",
  Samurai: "#eb6449",
  Pumpkin: "#ffa834",
  Agent: "#8a95aa",
  Galaxy: "#aa75f8",
  Robot: "#8fc7ce",
  Ninja: "#5369ba",
  Knight: "#e2c778",
  Cyber: "#4cddc5",
};
const gunColors = {
  Classic: "#9caeba",
  Goldline: "#ffc944",
  Carbon: "#4c5765",
  Neon: "#49eacb",
  Frost: "#ccf4ff",
  Crimson: "#ed5a67",
  Galaxy: "#b581ed",
  Cyber: "#57c9ff",
};
const trailColors = {
  "Blue Neon": "#36b8ff",
  "Red Laser": "#ff5f72",
  Electric: "#97ecff",
  Fire: "#ff7d3a",
  Ice: "#c5f3ff",
  Galaxy: "#bb79ff",
  Rainbow: "#f298d8",
};
function box(c, x, y, w, h, r, fill, stroke) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
}
function circle(c, x, y, r, fill, stroke) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
}
export function actor(c, p, time = 0, scale = 1) {
  c.save();
  c.translate(p.x || 0, p.y || 0);
  c.scale(scale, scale);
  c.lineWidth = 2.5;
  c.lineJoin = "round";
  const color = SKINS[p.skin] || p.color || "#36b8ff";
  c.fillStyle = "#0006";
  c.beginPath();
  c.ellipse(0, 10, 25, 18, 0, 0, Math.PI * 2);
  c.fill();
  c.rotate(p.angle || 0);
  const stride =
    Math.sin(time * 18) * Math.min(5, Math.hypot(p.vx || 0, p.vy || 0) / 40);
  box(c, -13 + stride, -18, 17, 12, 5, "#0a1422", "#030a11");
  box(c, -13 - stride, 7, 17, 12, 5, "#0a1422", "#030a11");
  box(c, -16, -15, 30, 30, 10, color, "#030b17");
  box(c, -10, -17, 12, 34, 4, "#172d42", "#030b17");
  box(c, 0, -22, 15, 12, 5, color, "#061420");
  box(c, 1, 10, 17, 12, 5, color, "#061420");
  box(c, 9, 11, 24, 8, 3, "#132031", "#071019");
  box(c, 13, 6, 30, 9, 2, gunColors[p.pistol] || gunColors.Classic, "#05111c");
  box(c, 18, 6, 18, 2, 1, "#ebf9ff");
  circle(c, -2, -2, 18, color, "#04101c");
  c.save();
  c.beginPath();
  c.arc(-2, -2, 16, 0, Math.PI * 2);
  c.clip();
  box(c, -1, -17, 19, 27, 8, "#081923", "#050e18");
  c.fillStyle = "#fff2";
  c.beginPath();
  c.moveTo(3, -15);
  c.lineTo(11, -15);
  c.lineTo(0, 11);
  c.lineTo(-5, 11);
  c.fill();
  c.restore();
  box(c, 4, -12, 8, 3, 1, "#8ee8ff");
  c.strokeStyle = "#d8f4ff88";
  c.lineWidth = 1.3;
  c.beginPath();
  c.arc(-2, -2, 15, 3.6, 5);
  c.stroke();
  if (p.skin === "Samurai") {
    c.strokeStyle = "#ffd66a";
    c.lineWidth = 4;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(-6, s * 13);
      c.lineTo(-9, s * 26);
      c.lineTo(0, s * 21);
      c.stroke();
    }
  }
  if (p.skin === "Galaxy") {
    circle(c, -9, -6, 1.6, "#fff");
    circle(c, -5, 5, 1, "#fff");
  }
  if (p.skin === "Robot") box(c, -8, -8, 8, 9, 1, "#e76e60");
  if (p.skin === "Pumpkin") {
    c.strokeStyle = "#683b04";
    for (const y of [-10, 0, 10]) {
      c.beginPath();
      c.moveTo(-16, y);
      c.lineTo(-8, y);
      c.stroke();
    }
  }
  if (p.flash > 0) {
    c.fillStyle = "#fff6a4";
    c.beginPath();
    c.moveTo(42, 9);
    c.lineTo(64, 2);
    c.lineTo(58, 11);
    c.lineTo(66, 20);
    c.lineTo(43, 16);
    c.fill();
  }
  c.restore();
}
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext("2d", { alpha: false });
    this.cam = { x: W / 2, y: H / 2, scale: 1 };
    this.particles = [];
    this.rings = [];
    this.lastEvent = 0;
    this.shake = 0;
    this.floor = null;
    this.map = null;
    this.time = 0;
    this.positions = new Map();
    this.width = innerWidth;
    this.height = innerHeight;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }
  resize() {
    this.width = innerWidth;
    this.height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = this.width * ratio;
    this.canvas.height = this.height * ratio;
    this.c.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.ratio = ratio;
    this.cam.scale = clamp(this.height / 820, 0.55, 1.25);
  }
  world(x, y) {
    return {
      x: (x - this.width / 2) / this.cam.scale + this.cam.x,
      y: (y - this.height / 2) / this.cam.scale + this.cam.y,
    };
  }
  predict(g, p, input, dt, age) {
    if (
      !this.prediction ||
      this.prediction.id !== p.id ||
      dist(this.prediction, p) > 200 ||
      p.dead
    )
      this.prediction = { id: p.id, x: p.x, y: p.y };
    const q = this.prediction;
    const len = Math.hypot(input.x, input.y) || 1;
    const speed = p.dashTime > 0 ? 900 : 235;
    move(
      g,
      q,
      (p.dashTime > 0 ? p.dashX : input.x / len) * speed * dt,
      (p.dashTime > 0 ? p.dashY : input.y / len) * speed * dt,
    );
    const correction = 1 - Math.exp(-dt * 9);
    const target = {
      x: p.x + p.vx * Math.min(age, 0.075),
      y: p.y + p.vy * Math.min(age, 0.075),
    };
    move(g, q, (target.x - q.x) * correction, (target.y - q.y) * correction);
    return q;
  }
  bake(map) {
    this.map = map;
    const surface = document.createElement("canvas");
    surface.width = W;
    surface.height = H;
    const c = surface.getContext("2d"),
      m = MAPS[map];
    c.fillStyle = m.floor;
    c.fillRect(0, 0, W, H);
    c.lineWidth = 1;
    for (let y = 40; y < H; y += 80)
      for (let x = 40; x < W; x += 80) {
        c.fillStyle = (x * 13 + y * 7) % 11 > 5 ? "#ffffff04" : "#00000008";
        c.fillRect(x, y, 78, 78);
        c.strokeStyle = "#060e1766";
        c.strokeRect(x, y, 80, 80);
        c.fillStyle = "#d5f5ff13";
        c.fillRect(x + 5, y + 5, 2, 2);
      }
    c.lineWidth = 3;
    c.strokeStyle = "#64839125";
    c.strokeRect(65, 65, W - 130, H - 130);
    c.setLineDash([18, 18]);
    c.strokeRect(95, 95, W - 190, H - 190);
    c.setLineDash([]);
    c.strokeStyle = m.accent + "44";
    c.lineWidth = 5;
    c.strokeRect(35, 35, W - 70, H - 70);
    c.fillStyle = "#060f1c";
    c.fillRect(0, 0, W, 28);
    c.fillRect(0, H - 28, W, 28);
    c.fillRect(0, 0, 28, H);
    c.fillRect(W - 28, 0, 28, H);
    for (let x = 120; x < W; x += 240) {
      c.fillStyle = m.accent;
      c.fillRect(x, 31, 80, 4);
      c.fillRect(x, H - 35, 80, 4);
    }
    c.save();
    c.translate(800, 500);
    c.strokeStyle = m.accent + "14";
    c.lineWidth = 4;
    c.beginPath();
    c.arc(0, 0, 180, 0, Math.PI * 2);
    c.stroke();
    c.font = "900 65px Arial";
    c.textAlign = "center";
    c.fillStyle = m.accent + "16";
    c.fillText("ONE BULLET", 0, 20);
    c.font = "bold 13px Arial";
    c.fillText("EVERY SHOT MATTERS", 0, 50);
    c.restore();
    for (let i = 0; i < m.cover.length; i++) {
      const [x, y, w, h] = m.cover[i];
      box(c, x + 6, y + 10, w, h, 4, "#0007");
      const crate = i % 3 === 0;
      box(
        c,
        x,
        y,
        w,
        h,
        5,
        crate ? "#514734" : map === "neon" ? "#343659" : "#344652",
        "#0a1620",
      );
      box(
        c,
        x + 5,
        y + 5,
        w - 10,
        h - 12,
        3,
        crate ? "#756244" : map === "neon" ? "#464366" : "#465c67",
        "#82959344",
      );
      c.strokeStyle = crate ? "#b0976599" : "#162e3a";
      c.lineWidth = 5;
      for (let a = 14; a < w - 10; a += 24) {
        c.beginPath();
        c.moveTo(x + a, y + 12);
        c.lineTo(x + a, y + h - 16);
        c.stroke();
      }
      c.strokeStyle = crate ? "#aa8f63" : "#597582";
      c.lineWidth = 4;
      c.strokeRect(x + 8, y + 8, w - 16, h - 22);
      if (crate) {
        c.beginPath();
        c.moveTo(x + 12, y + 12);
        c.lineTo(x + w - 12, y + h - 20);
        c.moveTo(x + w - 12, y + 12);
        c.lineTo(x + 12, y + h - 20);
        c.stroke();
      } else {
        c.fillStyle = m.accent + "aa";
        c.fillRect(x + 12, y + 7, Math.min(w - 24, 35), 3);
        c.fillStyle = "#d9e0d533";
        c.font = "bold 12px monospace";
        c.fillText("0" + (i + 1), x + 12, y + h - 20);
      }
      c.fillStyle = "#101b2566";
      c.fillRect(x + 4, y + h - 12, w - 8, 8);
    }
    this.floor = surface;
  }
  reset() {
    this.particles = [];
    this.rings = [];
    this.positions.clear();
    this.prediction = null;
    this.lastEvent = 0;
    this.cam.x = W / 2;
    this.cam.y = H / 2;
  }
  effects(g, me, settings, onSound) {
    for (const e of g.events || []) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      if (g.time - e.t > 1) continue;
      if (
        [
          "hit",
          "kill",
          "impact",
          "shot",
          "pickup",
          "spawn",
          "dash",
          "melee",
        ].includes(e.type)
      ) {
        const n = settings.quality === "low" ? 4 : e.type === "kill" ? 24 : 10;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2,
            v = 50 + Math.random() * 180;
          this.particles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            life: 0.25 + Math.random() * 0.4,
            max: 0.65,
            color: e.color || "#fff",
            r: e.type === "kill" ? 4 : 2,
          });
        }
        if (["pickup", "spawn", "dash", "melee"].includes(e.type))
          this.rings.push({ ...e, life: 0.4 });
      }
      if (settings.shake && (e.p === me?.id || e.target === me?.id))
        this.shake = e.type === "hit" ? 6 : e.type === "shot" ? 2 : this.shake;
      onSound?.(e);
    }
  }
  draw(g, me, dt, settings, online = false, age = 0) {
    if (!this.floor || this.map !== g.map) this.bake(g.map);
    this.time += dt;
    const c = this.c,
      s = this.cam.scale,
      alpha = 1 - Math.exp(-dt * 17);
    const target =
      me && !me.dead
        ? online && this.prediction
          ? this.prediction
          : me
        : { x: 800, y: 500 };
    const halfW = this.width / 2 / s,
      halfH = this.height / 2 / s;
    this.cam.x +=
      (clamp(target.x, Math.min(halfW - 100, W / 2), Math.max(W - halfW + 100, W / 2)) -
        this.cam.x) *
      alpha;
    this.cam.y +=
      (clamp(target.y, Math.min(halfH - 120, H / 2), Math.max(H - halfH + 120, H / 2)) -
        this.cam.y) *
      alpha;
    this.shake *= Math.exp(-dt * 15);
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    c.fillStyle = "#070f19";
    c.fillRect(0, 0, this.width, this.height);
    c.save();
    c.translate(
      this.width / 2 + (Math.random() - 0.5) * this.shake,
      this.height / 2 + (Math.random() - 0.5) * this.shake,
    );
    c.scale(s, s);
    c.translate(-this.cam.x, -this.cam.y);
    c.drawImage(this.floor, 0, 0);
    if (g.mode === "hill") {
      const h = g.hill,
        color = h.contested
          ? "#ffcf59"
          : h.owner === 0
            ? "#4bc5ff"
            : h.owner === 1
              ? "#ff7784"
              : "#b681ff";
      c.lineWidth = 3;
      c.strokeStyle = color;
      c.fillStyle = color + "13";
      c.beginPath();
      c.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.setLineDash([8, 12]);
      c.lineDashOffset = -this.time * 20;
      c.beginPath();
      c.arc(h.x, h.y, h.r - 12, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = color;
      c.font = "bold 14px Arial";
      c.textAlign = "center";
      c.fillText(
        h.contested
          ? "CONTESTED"
          : h.owner < 0
            ? "CAPTURE THE HILL"
            : h.owner === 0
              ? "BLUE CONTROL"
              : "RED CONTROL",
        h.x,
        h.y - 140,
      );
    }
    for (const b of g.drops) {
      const own = b.owner === me?.id,
        glow = 16 + Math.sin(this.time * 4) * 3;
      c.save();
      c.translate(b.x, b.y);
      c.shadowColor = own ? "#ffdc64" : b.color;
      c.shadowBlur = own ? 20 : 6;
      c.strokeStyle = own ? "#ffd665" : b.color + "66";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(0, 0, glow, 0, Math.PI * 2);
      c.stroke();
      c.rotate(-0.5);
      box(c, -8, -3, 16, 6, 3, own ? "#ffdb77" : b.color, "#fff6");
      c.restore();
      if (own) {
        c.textAlign = "center";
        c.fillStyle = "#ffe7a0";
        c.font = "bold 11px Arial";
        c.fillText("YOUR BULLET", b.x, b.y - 25);
      }
    }
    if (me && !me.dead) {
      const drop = g.drops.find((b) => b.owner === me.id);
      if (!me.ammo && drop && dist(me, drop) > 100) {
        c.save();
        c.translate(me.x, me.y);
        c.rotate(Math.atan2(drop.y - me.y, drop.x - me.x));
        c.fillStyle = "#ffd264bb";
        c.beginPath();
        c.moveTo(65, 0);
        c.lineTo(55, -5);
        c.lineTo(55, 5);
        c.fill();
        c.restore();
      }
      if (me.ammo) {
        c.save();
        c.translate(me.x, me.y);
        c.rotate(me.angle);
        c.strokeStyle = "#ffffff44";
        c.lineWidth = 1;
        c.setLineDash([3, 7]);
        c.beginPath();
        c.moveTo(50, 0);
        c.lineTo(145, 0);
        c.stroke();
        c.restore();
      }
    }
    for (const p of g.players) {
      if (p.dead) continue;
      let point = this.positions.get(p.id);
      if (!point || dist(point, p) > 200) point = { x: p.x, y: p.y };
      const extrapolate = online ? Math.min(age, 0.08) : 0;
      point.x += (p.x + p.vx * extrapolate - point.x) * (online ? alpha : 1);
      point.y += (p.y + p.vy * extrapolate - point.y) * (online ? alpha : 1);
      if (online && p.id === me?.id && this.prediction)
        point = { x: this.prediction.x, y: this.prediction.y };
      this.positions.set(p.id, point);
      if (p.emoting > 0) {
        c.font = "bold 16px Arial";
        c.textAlign = "center";
        box(c, point.x - 57, point.y - 83, 114, 27, 7, "#f2faffee");
        c.fillStyle = "#102532";
        c.fillText(p.emote, point.x, point.y - 64);
      }
      const col =
        g.mode === "ffa" ? p.color : p.team === 0 ? "#49beff" : "#ff5b71";
      if (p.dashTime > 0) {
        c.save();
        c.globalAlpha = 0.15;
        actor(
          c,
          { ...p, x: point.x - p.vx * 0.035, y: point.y - p.vy * 0.035 },
          this.time,
        );
        c.restore();
      }
      c.lineWidth = p.id === me?.id ? 2 : 1;
      c.strokeStyle = col + (p.shield > 0 ? "cc" : "88");
      c.beginPath();
      c.arc(point.x, point.y, 29, 0, Math.PI * 2);
      c.stroke();
      if (p.shield > 0) {
        c.fillStyle = col + "15";
        c.fill();
      }
      actor(c, { ...p, ...point }, this.time);
      c.font = `${p.id === me?.id ? "bold " : ""}12px Arial`;
      c.textAlign = "center";
      c.lineWidth = 3;
      c.strokeStyle = "#07101c";
      c.strokeText(p.name, point.x, point.y - 39);
      c.fillStyle = p.id === me?.id ? "#fff" : col;
      c.fillText(p.name, point.x, point.y - 39);
      box(c, point.x - 20, point.y - 32, 40, 3, 1, "#09101a");
      box(c, point.x - 20, point.y - 32, (40 * p.hp) / 100, 3, 1, col);
      if (!p.ammo) circle(c, point.x, point.y + 36, 3, "#182430", "#ffd369");
    }
    for (const b of g.bullets) {
      c.save();
      const color = trailColors[b.trail] || "#ffd77b";
      c.strokeStyle = color;
      c.lineWidth = 3;
      c.shadowColor = color;
      c.shadowBlur = 10;
      c.beginPath();
      c.moveTo(b.x - Math.cos(b.angle) * 32, b.y - Math.sin(b.angle) * 32);
      c.lineTo(b.x, b.y);
      c.stroke();
      circle(c, b.x, b.y, 3, "#fffce4");
      c.restore();
    }
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      c.globalAlpha = Math.max(0, p.life / p.max);
      c.fillStyle = p.color;
      c.fillRect(p.x, p.y, p.r, p.r);
    }
    c.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life > 0).slice(-250);
    for (const r of this.rings) {
      r.life -= dt;
      c.globalAlpha = Math.max(0, r.life / 0.4);
      c.strokeStyle = r.color || "#fff";
      c.lineWidth = 3;
      c.beginPath();
      if (r.type === "melee") c.arc(r.x, r.y, 65, r.angle - 1.1, r.angle + 1.1);
      else c.arc(r.x, r.y, 20 + (0.4 - r.life) * 100, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
    if (this.pointer && me && !me.dead) {
      const aim = this.world(this.pointer.x, this.pointer.y),
        sx = me.x + (aim.x - me.x) * settings.sensitivity,
        sy = me.y + (aim.y - me.y) * settings.sensitivity;
      c.strokeStyle = me.ammo ? "#e8f6ffbb" : "#ffd26b99";
      c.lineWidth = 1.5;
      c.beginPath();
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        c.moveTo(sx + dx * 6, sy + dy * 6);
        c.lineTo(sx + dx * 13, sy + dy * 13);
      }
      c.stroke();
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    c.restore();
    const vignette = c.createRadialGradient(
      this.width / 2,
      this.height / 2,
      this.height * 0.25,
      this.width / 2,
      this.height / 2,
      this.width * 0.65,
    );
    vignette.addColorStop(0, "#0000");
    vignette.addColorStop(1, "#01081677");
    c.fillStyle = vignette;
    c.fillRect(0, 0, this.width, this.height);
  }
}
export function avatar(canvas, skin, pistol = "Classic") {
  const c = canvas.getContext("2d"),
    w = canvas.width;
  c.clearRect(0, 0, w, canvas.height);
  actor(
    c,
    { x: w / 2 - 5, y: canvas.height / 2 + 2, skin, pistol, angle: -0.4 },
    0,
    w / 85,
  );
}
export function mapThumb(canvas, map) {
  const c = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height,
    m = MAPS[map];
  c.fillStyle = m.floor;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = m.accent + "44";
  for (let x = 0; x < w; x += 20) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, h);
    c.stroke();
  }
  for (const [x, y, a, b] of m.cover) {
    c.fillStyle = "#607484";
    c.fillRect((x / W) * w, (y / H) * h, (a / W) * w, (b / H) * h);
  }
  c.strokeStyle = m.accent;
  c.lineWidth = 2;
  c.strokeRect(7, 7, w - 14, h - 14);
  circle(c, w * 0.5, h * 0.5, 9, m.accent + "44", m.accent);
}
