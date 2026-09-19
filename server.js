import http from "node:http";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import {
  createGame,
  addPlayer,
  removePlayer,
  step,
  snapshot,
  MAPS,
  MODES,
  VERSION,
  won,
} from "./public/engine.js";
const root = dirname(fileURLToPath(import.meta.url)),
  publicDir = resolve(root, "public"),
  dataDir = resolve(process.env.DATA_DIR || resolve(root, "data"));
await mkdir(dataDir, { recursive: true });
let board = [];
try {
  board = JSON.parse(
    await readFile(resolve(dataDir, "leaderboard.json"), "utf8"),
  );
} catch {}
const rooms = new Map(),
  sessions = new Map(),
  MAX_ROOMS = 80,
  MAX_CLIENTS = 400;
const clean = (v) =>
  String(v || "Player")
    .replace(/[<>\x00-\x1f]/g, "")
    .trim()
    .slice(0, 18) || "Player";
const options = (o) => ({
  map: MAPS[o?.map] ? o.map : "yard",
  mode: MODES[o?.mode] ? o.mode : "ffa",
  difficulty: ["easy", "normal", "hard"].includes(o?.difficulty)
    ? o.difficulty
    : "normal",
  bots: Math.max(0, Math.min(7, Math.floor(Number(o?.bots) || 0))),
  duration: 180,
});
const send = (s, data) => {
  if (s?.ws?.readyState === WebSocket.OPEN && s.ws.bufferedAmount < 250000)
    s.ws.send(JSON.stringify(data));
};
const publicLobby = (r) => ({
  code: r.code,
  host: r.host,
  kind: r.kind,
  status: r.status,
  options: r.options,
  players: r.members.map((s) => ({
    id: s.id,
    name: s.name,
    skin: s.skin,
    ready: s.ready,
    connected: !!s.ws,
  })),
  startsIn:
    r.kind === "public"
      ? Math.max(0, Math.ceil((r.startAt - Date.now()) / 1000))
      : 0,
});
function broadcast(r, data) {
  for (const s of r.members) send(s, data);
}
function lobby(r) {
  broadcast(r, { type: "lobby", lobby: publicLobby(r) });
}
function leave(s, notify = true) {
  if (!s.room) return;
  const r = rooms.get(s.room);
  s.room = null;
  s.ready = false;
  if (!r) return;
  r.members = r.members.filter((p) => p !== s);
  if (r.game) removePlayer(r.game, s.id);
  if (!r.members.length) {
    rooms.delete(r.code);
    return;
  }
  if (r.host === s.id) r.host = r.members[0].id;
  if (notify) lobby(r);
}
function newRoom(s, kind, opts) {
  if (rooms.size >= MAX_ROOMS)
    throw Error("All arenas are busy. Please try again shortly.");
  let code;
  do {
    code = randomBytes(4).toString("hex").slice(0, 5).toUpperCase();
  } while (rooms.has(code));
  const r = {
    code,
    kind,
    options: options(opts),
    members: [],
    host: s.id,
    status: "lobby",
    created: Date.now(),
    startAt: Date.now() + 3500,
    game: null,
    recorded: false,
  };
  rooms.set(code, r);
  join(s, r);
  return r;
}
function join(s, r) {
  if (r.status === "playing")
    throw Error("This match is already in progress. Join after the round.");
  if (r.members.length >= 8) throw Error("This room is full.");
  leave(s);
  s.room = r.code;
  s.ready = false;
  r.members.push(s);
  lobby(r);
}
const botNames = ["Rex", "Nova", "Shadow", "Blaze", "Echo", "Ghost", "Pixel"];
function start(r) {
  r.game = createGame(r.options);
  r.recorded = false;
  for (const s of r.members) {
    addPlayer(r.game, {
      id: s.id,
      name: s.name,
      skin: s.skin,
      pistol: s.pistol,
      trail: s.trail,
      emote: s.emote,
      banner: s.banner,
    });
    s.ready = false;
  }
  const count =
    r.kind === "public"
      ? 8 - r.members.length
      : Math.min(r.options.bots, 8 - r.members.length);
  for (let i = 0; i < count; i++)
    addPlayer(r.game, { name: `${botNames[i]} · BOT`, bot: true,
      skin: ["Rogue", "Neon", "Galaxy", "Pumpkin", "Arctic", "Cyber", "Knight"][i] });
  r.status = "playing";
  broadcast(r, {
    type: "start",
    state: snapshot(r.game),
    code: r.code,
    kind: r.kind,
  });
}
let saving = Promise.resolve();
function record(r) {
  if (r.recorded) return;
  r.recorded = true;
  for (const p of r.game.players.filter((p) => !p.bot)) {
    let row = board.find((a) => a.id === p.id);
    if (!row) {
      row = {
        id: p.id,
        name: p.name,
        wins: 0,
        kills: 0,
        deaths: 0,
        shots: 0,
        hits: 0,
        best: 0,
        matches: 0,
        history: [],
      };
      board.push(row);
    }
    const win = won(r.game, p);
    row.name = p.name;
    row.wins += Number(win);
    row.kills += p.stats.kills;
    row.deaths += p.stats.deaths;
    row.shots += p.stats.shots;
    row.hits += p.stats.hits;
    row.best = Math.max(row.best, p.stats.best);
    row.matches++;
    row.history.push({
      at: Date.now(),
      wins: Number(win),
      kills: p.stats.kills,
      shots: p.stats.shots,
      hits: p.stats.hits,
      best: p.stats.best,
      matches: 1,
    });
    row.history = row.history.filter((h) => h.at > Date.now() - 7 * 86400000);
  }
  const data = JSON.stringify(board);
  saving = saving
    .then(async () => {
      const path = resolve(dataDir, "leaderboard.json");
      await writeFile(path + ".tmp", data);
      await rename(path + ".tmp", path);
    })
    .catch((e) => console.error("Score persistence failed:", e.message));
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://local");
    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({ ok: true, version: VERSION, rooms: rooms.size }),
      );
      return;
    }
    if (url.pathname === "/api/leaderboard") {
      const allowed = process.env.ALLOWED_ORIGIN;
      if (!allowed || req.headers.origin === allowed)
        res.setHeader("Access-Control-Allow-Origin", allowed || "*");
      res.setHeader("Vary", "Origin");
      let rows = board.map(({ history, ...r }) => {
        if (url.searchParams.get("period") === "week") {
          const recent = history.filter(
            (h) => h.at > Date.now() - 7 * 86400000,
          );
          for (const field of ["wins", "kills", "shots", "hits", "matches"])
            r[field] = recent.reduce((n, h) => n + h[field], 0);
          r.best = Math.max(0, ...recent.map((h) => h.best));
        }
        return r;
      });
      const metric = ["wins", "kills", "best", "matches", "accuracy"].includes(
        url.searchParams.get("metric"),
      )
        ? url.searchParams.get("metric")
        : "wins";
      rows = rows
        .filter((r) => r.matches > 0)
        .map((r) => ({
          ...r,
          accuracy: r.shots ? Math.round((r.hits / r.shots) * 100) : 0,
        }))
        .sort((a, b) => b[metric] - a[metric] || b.kills - a.kills)
        .slice(0, 100);
      res.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(rows));
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const path = resolve(
      publicDir,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (
      !path.startsWith(publicDir + "\\") &&
      !path.startsWith(publicDir + "/")
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    const content = await readFile(path);
    res.writeHead(200, {
      "content-type": mime[extname(path)] || "application/octet-stream",
      "x-content-type-options": "nosniff",
      "cache-control": "no-cache",
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
});
const wss = new WebSocketServer({
  server,
  maxPayload: 4096,
  perMessageDeflate: false,
});
wss.on("connection", (ws, req) => {
  if (wss.clients.size > MAX_CLIENTS) {
    ws.close(1013, "Server full");
    return;
  }
  if (
    process.env.ALLOWED_ORIGIN &&
    req.headers.origin !== process.env.ALLOWED_ORIGIN
  ) {
    ws.close(1008, "Origin rejected");
    return;
  }
  let s = null,
    windowStart = Date.now(),
    count = 0;
  const helloTimeout = setTimeout(() => {
    if (!s) ws.close(1008, "Handshake required");
  }, 7000);
  ws.on("error", () => {});
  ws.on("message", (raw) => {
    try {
      if (Date.now() - windowStart > 1000) {
        windowStart = Date.now();
        count = 0;
      }
      if (++count > 100) {
        ws.close(1008, "Too many messages");
        return;
      }
      const m = JSON.parse(raw);
      if (m.type === "hello") {
        if (s) return;
        if (m.version !== VERSION) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Version mismatch. Refresh to update the game.",
            }),
          );
          ws.close();
          return;
        }
        const token =
          typeof m.token === "string" && /^[a-f0-9]{64}$/.test(m.token)
            ? m.token
            : randomBytes(32).toString("hex");
        const id = createHash("sha256")
          .update(token)
          .digest("hex")
          .slice(0, 24);
        s = sessions.get(id);
        if (!s) {
          s = { id, token, name: clean(m.name), room: null, ready: false };
          sessions.set(id, s);
        }
        if (s.ws && s.ws !== ws) s.ws.close(1000, "Connected elsewhere");
        s.ws = ws;
        s.disconnected = 0;
        s.name = clean(m.name);
        s.skin = String(m.skin || "Default").slice(0, 20);
        s.pistol = String(m.pistol || "Classic").slice(0, 20);
        s.trail = String(m.trail || "Default").slice(0, 20);
        s.emote = String(m.emote || "GG").slice(0, 20);
        s.banner = String(m.banner || "Rookie").slice(0, 20);
        clearTimeout(helloTimeout);
        send(s, { type: "hello", id: s.id, token });
        const r = rooms.get(s.room);
        if (r) {
          send(s, { type: "lobby", lobby: publicLobby(r) });
          if (r.game)
            send(s, {
              type: "start",
              state: snapshot(r.game),
              code: r.code,
              kind: r.kind,
            });
        }
        return;
      }
      if (!s) return;
      if (m.type === "ping") {
        send(s, { type: "pong", time: m.time });
        return;
      }
      const r = rooms.get(s.room);
      if (m.type === "input") {
        const p = r?.game?.players.find((p) => p.id === s.id);
        if (r?.status === "playing" && p) {
          p.input = {
            x: Number.isFinite(m.x) ? Math.max(-1, Math.min(1, m.x)) : 0,
            y: Number.isFinite(m.y) ? Math.max(-1, Math.min(1, m.y)) : 0,
            angle: Number.isFinite(m.angle) ? m.angle % (Math.PI * 2) : p.angle,
            shoot: !!m.shoot || p.input.shoot,
            dash: !!m.dash || p.input.dash,
            melee: !!m.melee || p.input.melee,
            pickup: !!m.pickup || p.input.pickup,
            emote: !!m.emote || p.input.emote,
          };
          p.lastInput = Date.now();
        }
        return;
      }
      if (m.type === "profile") {
        if (r?.status === "playing") return;
        s.name = clean(m.name);
        for (const k of ["skin", "pistol", "trail", "emote", "banner"])
          s[k] = String(m[k] || s[k]).slice(0, 20);
        return;
      }
      if (m.type === "quick") {
        leave(s);
        let room = [...rooms.values()].find(
          (a) =>
            a.kind === "public" && a.status === "lobby" && a.members.length < 8,
        );
        if (room) join(s, room);
        else newRoom(s, "public", m.options);
        return;
      }
      if (m.type === "create") {
        leave(s);
        newRoom(s, "private", m.options);
        return;
      }
      if (m.type === "join") {
        const room = rooms.get(
          String(m.code || "")
            .trim()
            .toUpperCase(),
        );
        if (!room || room.kind !== "private")
          throw Error("Room not found. Check the five-character code.");
        join(s, room);
        return;
      }
      if (m.type === "leave") {
        leave(s);
        send(s, { type: "left" });
        return;
      }
      if (!r) throw Error("Choose or create a room first.");
      if (m.type === "ready") {
        s.ready = !s.ready;
        lobby(r);
      }
      if (m.type === "options") {
        if (r.host !== s.id || r.status !== "lobby") return;
        r.options = options(m.options);
        for (const member of r.members) member.ready = false;
        lobby(r);
      }
      if (m.type === "start") {
        if (r.host !== s.id || r.status !== "lobby") return;
        if (r.members.some((p) => p.id !== s.id && !p.ready))
          throw Error("Wait for your friends to get ready.");
        if (r.members.length + r.options.bots < 2)
          throw Error("Invite a friend or add at least one bot.");
        start(r);
      }
      if (m.type === "return") {
        if (r.status !== "ended") return;
        r.status = "lobby";
        r.game = null;
        for (const member of r.members) member.ready = false;
        if (r.kind === "public") r.startAt = Date.now() + 3500;
        lobby(r);
      }
    } catch (e) {
      if (s)
        send(s, {
          type: "error",
          message: e instanceof SyntaxError ? "Invalid message." : e.message,
        });
    }
  });
  ws.on("close", () => {
    clearTimeout(helloTimeout);
    if (s?.ws === ws) {
      s.ws = null;
      s.disconnected = Date.now();
      const r = rooms.get(s.room);
      const p = r?.game?.players.find((p) => p.id === s.id);
      if (p) p.input = {};
      if (r) {
        if (r.host === s.id) {
          const next = r.members.find((a) => a.ws);
          if (next) r.host = next.id;
        }
        lobby(r);
      }
    }
  });
});
let last = performance.now(),
  acc = 0,
  frame = 0;
setInterval(() => {
  const now = performance.now();
  acc += Math.min(0.2, (now - last) / 1000);
  last = now;
  while (acc >= 1 / 60) {
    for (const r of rooms.values()) {
      if (
        r.status === "lobby" &&
        r.kind === "public" &&
        Date.now() >= r.startAt
      )
        start(r);
      if (r.status === "playing") {
        for (const p of r.game.players)
          if (!p.bot && Date.now() - (p.lastInput || 0) > 600) p.input = {};
        step(r.game, 1 / 60);
        if (r.game.ended) {
          r.status = "ended";
          record(r);
          broadcast(r, { type: "state", state: snapshot(r.game) });
        }
      }
    }
    acc -= 1 / 60;
  }
  if (++frame % 3 === 0)
    for (const r of rooms.values())
      if (r.status === "playing")
        broadcast(r, { type: "state", state: snapshot(r.game) });
}, 1000 / 60);
setInterval(() => {
  for (const s of sessions.values())
    if (s.disconnected && Date.now() - s.disconnected > 30000) {
      leave(s);
      sessions.delete(s.id);
    }
  for (const r of rooms.values())
    if (r.status === "lobby" && r.kind === "public") lobby(r);
}, 1000);
server.listen(
  Number(process.env.PORT) || 4173,
  process.env.HOST || "0.0.0.0",
  () =>
    console.log(
      `ONE BULLET ready at http://localhost:${Number(process.env.PORT) || 4173}`,
    ),
);
