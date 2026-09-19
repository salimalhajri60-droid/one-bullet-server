// Shared deterministic rules. Online matches run this module exclusively on the server.
export const W = 1600,
  H = 1000,
  R = 19,
  VERSION = 1;
export const COLORS = [
  "#39baff",
  "#ff6473",
  "#a1e34b",
  "#b786ff",
  "#ffa647",
  "#3de1d3",
  "#fa7cd0",
  "#f8dd62",
];
export const MAPS = {
  yard: {
    name: "Urban Yard",
    tag: "Industrial district",
    floor: "#192b37",
    accent: "#43c8f4",
    cover: [
      [260, 170, 180, 70],
      [1160, 760, 180, 70],
      [260, 760, 180, 70],
      [1160, 170, 180, 70],
      [630, 240, 80, 190],
      [890, 570, 80, 190],
      [600, 650, 100, 70],
      [900, 280, 100, 70],
      [100, 430, 130, 130],
      [1370, 430, 130, 130],
      [400, 440, 90, 120],
      [1110, 440, 90, 120],
    ],
  },
  roof: {
    name: "Skyline",
    tag: "High above the city",
    floor: "#243144",
    accent: "#8bafff",
    cover: [
      [260, 200, 130, 120],
      [1210, 680, 130, 120],
      [260, 680, 130, 120],
      [1210, 200, 130, 120],
      [660, 130, 280, 70],
      [660, 800, 280, 70],
      [570, 400, 80, 200],
      [950, 400, 80, 200],
      [90, 460, 120, 90],
      [1390, 460, 120, 90],
    ],
  },
  neon: {
    name: "Neon Arena",
    tag: "Built for the clutch",
    floor: "#181b38",
    accent: "#bc6eff",
    cover: [
      [360, 180, 70, 230],
      [1170, 590, 70, 230],
      [360, 590, 70, 230],
      [1170, 180, 70, 230],
      [670, 240, 260, 65],
      [670, 695, 260, 65],
      [620, 435, 70, 130],
      [910, 435, 70, 130],
      [170, 455, 100, 90],
      [1330, 455, 100, 90],
    ],
  },
  warehouse: {
    name: "Warehouse",
    tag: "Close quarters. Big plays.",
    floor: "#2b2e30",
    accent: "#ffb44f",
    cover: [
      [280, 160, 100, 250],
      [280, 590, 100, 250],
      [1220, 160, 100, 250],
      [1220, 590, 100, 250],
      [570, 160, 170, 70],
      [860, 770, 170, 70],
      [540, 400, 180, 80],
      [880, 520, 180, 80],
      [100, 470, 100, 80],
      [1400, 470, 100, 80],
    ],
  },
};
export const MODES = {
  ffa: "Free for all",
  tdm: "Team deathmatch",
  hill: "King of the hill",
};
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const emptyStats = () => ({
  kills: 0,
  deaths: 0,
  score: 0,
  shots: 0,
  hits: 0,
  retrieved: 0,
  dashes: 0,
  melees: 0,
  streak: 0,
  best: 0,
});
export function valid(x, y, r, map) {
  return (
    x >= r + 35 &&
    x <= W - r - 35 &&
    y >= r + 35 &&
    y <= H - r - 35 &&
    !MAPS[map].cover.some(
      ([a, b, w, h]) =>
        x + r > a && x - r < a + w && y + r > b && y - r < b + h,
    )
  );
}
export function safePoint(x, y, map, r = R) {
  if (valid(x, y, r, map)) return { x, y };
  for (let d = 12; d < 1800; d += 12)
    for (let a = 0; a < Math.PI * 2; a += 0.4) {
      const xx = clamp(x + Math.cos(a) * d, r + 36, W - r - 36),
        yy = clamp(y + Math.sin(a) * d, r + 36, H - r - 36);
      if (valid(xx, yy, r, map)) return { x: xx, y: yy };
    }
  return { x: 100, y: 100 };
}
export function createGame(options = {}) {
  return {
    matchId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    map: MAPS[options.map] ? options.map : "yard",
    mode: MODES[options.mode] ? options.mode : "ffa",
    difficulty: ["easy", "normal", "hard"].includes(options.difficulty)
      ? options.difficulty
      : "normal",
    duration: clamp(Number(options.duration) || 180, 30, 240),
    time: 0,
    countdown: 3,
    ended: false,
    players: [],
    bullets: [],
    drops: [],
    events: [],
    eid: 0,
    teamScore: [0, 0],
    hill: { x: 800, y: 500, r: 125, owner: -1, contested: false },
    seed: 1,
  };
}
export function event(g, type, data = {}) {
  g.events.push({ id: ++g.eid, type, t: g.time, ...data });
  if (g.events.length > 48) g.events.shift();
}
export function addPlayer(
  g,
  {
    id,
    name = "Player",
    bot = false,
    color,
    skin = "Default",
    pistol = "Classic",
    trail = "Default",
    emote = "GG",
    banner = "Rookie",
  } = {},
) {
  const i = g.players.length,
    p = {
      id: id || `bot-${i}`,
      name: String(name).slice(0, 18),
      bot,
      color: color || COLORS[i % 8],
      skin,
      pistol,
      trail,
      emote,
      banner,
      team: i % 2,
      x: 100,
      y: 100,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: 100,
      ammo: 1,
      dash: 0,
      dashTime: 0,
      melee: 0,
      dead: 0,
      shield: 1.3,
      flash: 0,
      stats: emptyStats(),
      input: {},
      brain: { wait: 0, path: [], nav: 0, side: Math.random() < 0.5 ? -1 : 1 },
    };
  g.players.push(p);
  spawn(g, p);
  return p;
}
export function spawn(g, p) {
  let best = null,
    bestD = -1;
  const points = [
    [100, 100],
    [800, 85],
    [1500, 100],
    [1510, 500],
    [1500, 900],
    [800, 910],
    [100, 900],
    [90, 500],
  ];
  for (const [sx, sy] of points) {
    const { x, y } = safePoint(sx, sy, g.map, R + 2);
    const d =
      Math.min(
        ...g.players
          .filter((q) => q !== p && !q.dead)
          .map((q) => Math.hypot(x - q.x, y - q.y)),
        2000,
      ) +
      Math.random() * 60;
    if (d > bestD) {
      best = { x, y };
      bestD = d;
    }
  }
  Object.assign(p, best, {
    vx: 0,
    vy: 0,
    hp: 100,
    ammo: 1,
    dead: 0,
    shield: 1.3,
    dashTime: 0,
  });
  g.bullets = g.bullets.filter((b) => b.owner !== p.id);
  g.drops = g.drops.filter((b) => b.owner !== p.id);
  event(g, "spawn", { x: p.x, y: p.y, p: p.id, color: p.color });
}
export function removePlayer(g, id) {
  g.players = g.players.filter((p) => p.id !== id);
  g.bullets = g.bullets.filter((b) => b.owner !== id);
  g.drops = g.drops.filter((b) => b.owner !== id);
}
export const enemy = (g, a, b) =>
  a.id !== b.id && (g.mode === "ffa" || a.team !== b.team);
export function lineClear(g, a, b) {
  const d = dist(a, b),
    n = Math.ceil(d / 14);
  for (let i = 1; i < n; i++)
    if (
      !valid(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, 2, g.map)
    )
      return false;
  return true;
}
export function move(g, p, dx, dy) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
  for (let i = 0; i < n; i++) {
    if (valid(p.x + dx / n, p.y, R, g.map)) p.x += dx / n;
    if (valid(p.x, p.y + dy / n, R, g.map)) p.y += dy / n;
  }
}
export function fire(g, p) {
  if (g.ended || g.countdown > 0 || p.dead || p.ammo !== 1) return false;
  p.ammo = 0;
  p.shield = 0;
  p.stats.shots++;
  p.flash = 0.12;
  g.bullets.push({
    id: ++g.seed,
    owner: p.id,
    x: p.x,
    y: p.y,
    angle: p.angle,
    life: 0,
    color: p.color,
    trail: p.trail,
  });
  event(g, "shot", { x: p.x, y: p.y, p: p.id, angle: p.angle, color: p.color });
  return true;
}
export function damage(g, target, source, amount) {
  if (target.dead || target.shield > 0 || !enemy(g, target, source))
    return false;
  target.hp -= amount;
  event(g, "hit", {
    x: target.x,
    y: target.y,
    p: source.id,
    target: target.id,
    color: target.color,
  });
  if (target.hp <= 0) {
    target.hp = 0;
    target.dead = 2.4;
    target.stats.deaths++;
    target.stats.streak = 0;
    source.stats.kills++;
    source.stats.streak++;
    source.stats.best = Math.max(source.stats.best, source.stats.streak);
    if (g.mode !== "hill") {
      source.stats.score++;
      g.teamScore[source.team]++;
    }
    g.bullets = g.bullets.filter((b) => b.owner !== target.id);
    g.drops = g.drops.filter((b) => b.owner !== target.id);
    event(g, "kill", {
      x: target.x,
      y: target.y,
      p: source.id,
      target: target.id,
      killer: source.name,
      victim: target.name,
      color: source.color,
    });
  }
  return true;
}
export function melee(g, p) {
  if (p.dead || p.melee > 0 || g.countdown > 0 || g.ended) return;
  p.melee = 0.8;
  p.shield = 0;
  event(g, "melee", {
    x: p.x,
    y: p.y,
    p: p.id,
    angle: p.angle,
    color: p.color,
  });
  for (const q of g.players) {
    if (!q.dead && enemy(g, p, q) && dist(p, q) < 92 && lineClear(g, p, q)) {
      const diff = Math.atan2(
        Math.sin(Math.atan2(q.y - p.y, q.x - p.x) - p.angle),
        Math.cos(Math.atan2(q.y - p.y, q.x - p.x) - p.angle),
      );
      if (Math.abs(diff) < 1.3 && damage(g, q, p, 30)) {
        p.stats.melees++;
        move(g, q, Math.cos(p.angle) * 90, Math.sin(p.angle) * 90);
      }
    }
  }
}
export function dash(g, p, dx, dy) {
  if (p.dead || p.dash > 0 || g.countdown > 0 || g.ended) return;
  const len = Math.hypot(dx, dy);
  p.dashX = len ? dx / len : Math.cos(p.angle);
  p.dashY = len ? dy / len : Math.sin(p.angle);
  p.dash = 3;
  p.dashTime = 0.17;
  p.stats.dashes++;
  event(g, "dash", { x: p.x, y: p.y, p: p.id, color: p.color });
}
export function collect(g, p, r = 34) {
  if (p.dead || p.ammo) return false;
  const i = g.drops.findIndex((b) => b.owner === p.id && dist(b, p) < r);
  if (i < 0) return false;
  g.drops.splice(i, 1);
  p.ammo = 1;
  p.stats.retrieved++;
  event(g, "pickup", { x: p.x, y: p.y, p: p.id, color: p.color });
  return true;
}
function pathTo(g, p, target) {
  const size = 40,
    cols = W / size,
    rows = H / size,
    key = (x, y) => y * cols + x,
    sx = clamp(Math.floor(p.x / size), 0, cols - 1),
    sy = clamp(Math.floor(p.y / size), 0, rows - 1),
    tx = clamp(Math.floor(target.x / size), 0, cols - 1),
    ty = clamp(Math.floor(target.y / size), 0, rows - 1),
    start = key(sx, sy),
    end = key(tx, ty),
    queue = [start],
    prev = new Int32Array(cols * rows).fill(-1);
  prev[start] = start;
  let found = -1;
  for (let index = 0; index < queue.length; index++) {
    const k = queue[index],
      x = k % cols,
      y = Math.floor(k / cols);
    if (k === end || Math.hypot(x - tx, y - ty) < 1.5) {
      found = k;
      break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        n = key(nx, ny);
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= cols ||
        ny >= rows ||
        prev[n] !== -1 ||
        !valid(nx * size + 20, ny * size + 20, R, g.map)
      )
        continue;
      prev[n] = k;
      queue.push(n);
    }
  }
  if (found < 0) return [];
  const path = [];
  for (let k = found; k !== start; k = prev[k])
    path.unshift({
      x: (k % cols) * size + 20,
      y: Math.floor(k / cols) * size + 20,
    });
  return path;
}
function botInput(g, p, dt) {
  const b = p.brain,
    hard = g.difficulty === "hard",
    easy = g.difficulty === "easy";
  b.wait -= dt;
  b.nav -= dt;
  let opponents = g.players.filter((q) => !q.dead && enemy(g, p, q));
  opponents.sort((a, c) => dist(a, p) - dist(c, p));
  const q = opponents[0];
  if (!q) return {};
  const d = dist(p, q),
    drop = g.drops.find((a) => a.owner === p.id),
    clear = lineClear(g, p, q);
  let target = q;
  if (!p.ammo && drop) target = drop;
  else if (g.mode === "hill" && dist(p, g.hill) > 85) target = g.hill;
  else if (p.ammo && clear && d < 420) {
    const away = d < 180 ? 1 : -0.2;
    target = {
      x: clamp(
        p.x + (p.x - q.x) * away + (q.y - p.y) * 0.8 * b.side,
        60,
        W - 60,
      ),
      y: clamp(
        p.y + (p.y - q.y) * away - (q.x - p.x) * 0.8 * b.side,
        60,
        H - 60,
      ),
    };
  }
  if (b.nav <= 0) {
    b.nav = easy ? 0.8 : 0.45;
    b.path = lineClear(g, p, target) ? [] : pathTo(g, p, target);
  }
  while (b.path.length && dist(p, b.path[0]) < 28) b.path.shift();
  const dest = b.path[0] || target;
  let dx = dest.x - p.x,
    dy = dest.y - p.y;
  if (dist(p, dest) < 12) dx = dy = 0;
  const lead = hard ? d / 1000 : 0.03;
  const angle = Math.atan2(q.y + q.vy * lead - p.y, q.x + q.vx * lead - p.x);
  let shoot = false;
  if (clear && d < 780 && p.ammo && b.wait <= 0) {
    b.wait = (easy ? 1.6 : hard ? 0.45 : 0.85) + Math.random() * 0.6;
    shoot = true;
    b.error = (Math.random() - 0.5) * (easy ? 0.45 : hard ? 0.085 : 0.2);
  }
  const incoming = g.bullets.some((a) => a.owner !== p.id && dist(a, p) < 150);
  return {
    x: dx,
    y: dy,
    angle: angle + (b.error || 0),
    shoot,
    dash:
      !p.dash &&
      ((incoming && Math.random() < (hard ? 0.1 : 0.02)) ||
        (!p.ammo && drop && dist(p, drop) > 160 && Math.random() < 0.008)),
    melee: d < 78 && clear,
    pickup: true,
  };
}
export function step(g, dt) {
  if (g.ended) return;
  dt = clamp(dt, 0, 0.05);
  g.time += dt;
  if (g.countdown > 0) {
    g.countdown = Math.max(0, g.countdown - dt);
    return;
  }
  if (g.time >= g.duration + 3) {
    g.ended = true;
    event(g, "end");
    return;
  }
  for (const p of g.players) {
    p.dash = Math.max(0, p.dash - dt);
    p.melee = Math.max(0, p.melee - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.emoting = Math.max(0, (p.emoting || 0) - dt);
    p.emoteCooldown = Math.max(0, (p.emoteCooldown || 0) - dt);
    p.shield = Math.max(0, p.shield - dt);
    if (p.dead) {
      p.dead = Math.max(0, p.dead - dt);
      if (!p.dead) spawn(g, p);
      continue;
    }
    const input = p.bot ? botInput(g, p, dt) : p.input;
    let dx = Number(input.x) || 0,
      dy = Number(input.y) || 0;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }
    if (Number.isFinite(input.angle)) p.angle = input.angle;
    if (input.dash) dash(g, p, dx, dy);
    if (input.melee) melee(g, p);
    if (input.shoot) fire(g, p);
    if (input.pickup) collect(g, p, 62);
    if (input.emote && !p.emoteCooldown) {
      p.emoting = 1.5;
      p.emoteCooldown = 4;
    }
    const speed = 235;
    if (p.dashTime > 0) {
      p.dashTime = Math.max(0, p.dashTime - dt);
      dx = p.dashX;
      dy = p.dashY;
    }
    const velocity = p.dashTime > 0 ? 900 : speed;
    p.vx = dx * velocity;
    p.vy = dy * velocity;
    move(g, p, p.vx * dt, p.vy * dt);
    collect(g, p);
    if (!p.bot) {
      input.shoot = false;
      input.dash = false;
      input.melee = false;
      input.pickup = false;
      input.emote = false;
    }
  }
  // Sweep projectiles to avoid tunnelling through characters and cover.
  for (const b of [...g.bullets]) {
    if (!g.bullets.includes(b)) continue;
    const owner = g.players.find((p) => p.id === b.owner);
    if (!owner) {
      g.bullets = g.bullets.filter((a) => a !== b);
      continue;
    }
    const n = Math.ceil((1050 * dt) / 8);
    let done = false;
    for (let i = 0; i < n && !done; i++) {
      const px = b.x,
        py = b.y;
      b.x += (Math.cos(b.angle) * 1050 * dt) / n;
      b.y += (Math.sin(b.angle) * 1050 * dt) / n;
      b.life += dt / n;
      const target = g.players.find(
        (q) =>
          !q.dead && q.shield <= 0 && enemy(g, owner, q) && dist(b, q) < R + 4,
      );
      if (target) {
        damage(g, target, owner, 85);
        owner.stats.hits++;
        owner.ammo = 1;
        event(g, "restore", { x: owner.x, y: owner.y, p: owner.id });
        done = true;
      } else if (!valid(b.x, b.y, 4, g.map) || b.life > 1.25) {
        const point = safePoint(px, py, g.map, R + 2);
        g.drops = g.drops.filter((a) => a.owner !== owner.id);
        g.drops.push({
          ...point,
          owner: owner.id,
          color: owner.color,
          id: b.id,
        });
        event(g, "impact", { ...point, p: owner.id, color: "#ffcf59" });
        done = true;
      }
    }
    if (done) g.bullets = g.bullets.filter((a) => a !== b);
  }
  if (g.mode === "hill") {
    const inside = g.players.filter(
        (p) => !p.dead && dist(p, g.hill) < g.hill.r,
      ),
      teams = [...new Set(inside.map((p) => p.team))];
    g.hill.contested = teams.length > 1;
    g.hill.owner = teams.length === 1 ? teams[0] : -1;
    if (teams.length === 1) {
      g.teamScore[teams[0]] += dt;
      for (const p of inside) p.stats.score += dt / inside.length;
    }
  }
}
export function snapshot(g) {
  return {
    matchId: g.matchId,
    map: g.map,
    mode: g.mode,
    difficulty: g.difficulty,
    duration: g.duration,
    time: g.time,
    countdown: g.countdown,
    ended: g.ended,
    players: g.players.map(({ brain, input, ...p }) => p),
    bullets: g.bullets,
    drops: g.drops,
    events: g.events,
    eid: g.eid,
    teamScore: g.teamScore,
    hill: g.hill,
  };
}
export function ranking(g) {
  return [...g.players].sort(
    (a, b) =>
      b.stats.score - a.stats.score ||
      b.stats.kills - a.stats.kills ||
      a.stats.deaths - b.stats.deaths,
  );
}
export function won(g, p) {
  return g.mode === "ffa"
    ? ranking(g)[0]?.id === p.id
    : g.teamScore[p.team] > g.teamScore[1 - p.team];
}
