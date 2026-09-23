import http from "node:http";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, randomBytes, createHash, verify as cryptoVerify } from "node:crypto";
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
const LEADERBOARD_BACKUP_SEED = [{"id":"e2e212694d647cd448c6a143","crazyGamesId":null,"name":"Guest-F782","skin":"Default","pistol":"Classic","wins":0,"kills":9,"deaths":36,"shots":55,"hits":19,"best":2,"matches":2,"history":[]},{"id":"950d1a52be89c5cb4ab01662","crazyGamesId":null,"name":"Guest-F0BE","skin":"Default","pistol":"Classic","wins":0,"kills":4,"deaths":16,"shots":24,"hits":6,"best":1,"matches":1,"history":[]},{"id":"9897acfba31a3771dbf5b9b6","crazyGamesId":null,"name":"Guest-ADA4","skin":"Default","pistol":"Classic","wins":0,"kills":3,"deaths":16,"shots":26,"hits":11,"best":1,"matches":1,"history":[]},{"id":"383a0770224a613b8cfdc0e3","crazyGamesId":null,"name":"Guest-F19A","skin":"Default","pistol":"Classic","wins":0,"kills":2,"deaths":13,"shots":21,"hits":4,"best":2,"matches":1,"history":[]},{"id":"ee4cb0144634e2902e1b8f59","crazyGamesId":null,"name":"Guest-4EFE","skin":"Default","pistol":"Classic","wins":0,"kills":1,"deaths":7,"shots":12,"hits":2,"best":1,"matches":1,"history":[]},{"id":"83e080a6c923cd1f3bd6ff8c","crazyGamesId":null,"name":"CharmingKid.69tH","skin":"Default","pistol":"Classic","wins":0,"kills":1,"deaths":16,"shots":5,"hits":1,"best":1,"matches":1,"history":[]},{"id":"c3298edfd2266b30497b640e","crazyGamesId":null,"name":"Guest-D7A3","skin":"Default","pistol":"Classic","wins":0,"kills":0,"deaths":1,"shots":0,"hits":0,"best":0,"matches":1,"history":[]},{"id":"f0b585f543dde757c1f7b061","crazyGamesId":null,"name":"GentleCaveman.Yndb","skin":"Default","pistol":"Classic","wins":0,"kills":0,"deaths":22,"shots":1,"hits":0,"best":0,"matches":1,"history":[]}];
let board = [];
try {
  board = JSON.parse(
    await readFile(resolve(dataDir, "leaderboard.json"), "utf8"),
  );
} catch {}

// Restore/merge the saved Basic Launch leaderboard on every startup.
// Existing live entries are preserved. Any missing backup player is added back.
// Matching IDs are never duplicated.
if (!Array.isArray(board)) board = [];

board = board.map((row) => ({
  ...row,
  crazyGamesId: row.crazyGamesId || null,
  skin: row.skin || "Default",
  pistol: row.pistol || "Classic",
  history: Array.isArray(row.history) ? row.history : [],
}));

let restoredCount = 0;
for (const saved of LEADERBOARD_BACKUP_SEED) {
  const existing = board.find((row) => row.id === saved.id);
  if (!existing) {
    board.push({
      ...saved,
      history: Array.isArray(saved.history) ? saved.history : [],
    });
    restoredCount += 1;
  }
}

try {
  await writeFile(resolve(dataDir, "leaderboard.json"), JSON.stringify(board));
  console.log(`Leaderboard backup merge complete: ${restoredCount} restored, ${board.length} total`);
} catch (e) {
  console.error("Leaderboard backup merge failed:", e.message);
}
const rooms = new Map(),
  sessions = new Map(),
  MAX_ROOMS = 80,
  MAX_CLIENTS = 400;
const clean = (v) =>
  String(v || "Player")
    .replace(/[<>\x00-\x1f]/g, "")
    .trim()
    .slice(0, 18) || "Player";
const nameKey = (v) => clean(v).toLocaleLowerCase("en-US");
const nameTaken = (name, except = null) => {
  const key = nameKey(name);
  return [...sessions.values()].some(
    (other) => other !== except && nameKey(other.name) === key,
  );
};
const requireUniqueName = (name, except = null) => {
  const value = clean(name);
  if (nameTaken(value, except))
    throw Error(`The name "${value}" is already being used by another player.`);
  return value;
};
// Verify CrazyGames JWTs on the server so registered usernames cannot be spoofed.
let crazyPublicKey = "";
let crazyPublicKeyAt = 0;
const b64url = (value) => {
  const x = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(x + "=".repeat((4 - (x.length % 4)) % 4), "base64");
};
async function fetchCrazyPublicKey(force = false) {
  if (!force && crazyPublicKey && Date.now() - crazyPublicKeyAt < 6 * 3600000) return crazyPublicKey;
  const response = await fetch("https://sdk.crazygames.com/publicKey.json", { signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!response.ok) throw Error("CrazyGames public key unavailable");
  const data = await response.json();
  if (!data?.publicKey) throw Error("CrazyGames public key missing");
  crazyPublicKey = String(data.publicKey);
  crazyPublicKeyAt = Date.now();
  return crazyPublicKey;
}
async function verifyCrazyToken(token) {
  if (typeof token !== "string" || token.length < 80 || token.length > 6000) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let header, payload;
  try {
    header = JSON.parse(b64url(parts[0]).toString("utf8"));
    payload = JSON.parse(b64url(parts[1]).toString("utf8"));
  } catch { return null; }
  if (header?.alg !== "RS256") return null;
  const data = Buffer.from(`${parts[0]}.${parts[1]}`);
  const sig = b64url(parts[2]);
  let ok = false;
  try {
    ok = cryptoVerify("RSA-SHA256", data, await fetchCrazyPublicKey(), sig);
    if (!ok) ok = cryptoVerify("RSA-SHA256", data, await fetchCrazyPublicKey(true), sig);
  } catch { return null; }
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000);
  if (!payload?.userId || !payload?.username || Number(payload.exp) <= now) return null;
  if (process.env.CRAZYGAMES_GAME_ID && String(payload.gameId) !== String(process.env.CRAZYGAMES_GAME_ID)) return null;
  return { userId: String(payload.userId).slice(0, 128), username: clean(payload.username) };
}
const stableCrazyId = (userId) => createHash("sha256").update(`crazygames:${userId}`).digest("hex").slice(0, 24);
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

const CHAT_LIMIT = 120;
const CHAT_COOLDOWN_MS = 650;
const chatFilters = [
  /\bn[\W_]*[i1!|][\W_]*g[\W_]*g[\W_]*[a@4]\b/gi,
  /\bn[\W_]*[i1!|][\W_]*g[\W_]*g[\W_]*[e3][\W_]*r\b/gi,
  /\bf[\W_]*[uüv][\W_]*c[\W_]*k(?:[\W_]*(?:e[\W_]*r|e[\W_]*d|i[\W_]*n[\W_]*g))?\b/gi,
  /\bsh[\W_]*[i1!|][\W_]*t\b/gi,
  /\bb[\W_]*[i1!|][\W_]*t[\W_]*c[\W_]*h\b/gi,
  /\bc[\W_]*u[\W_]*n[\W_]*t\b/gi,
  /\ba[\W_]*s[\W_]*s[\W_]*h[\W_]*o[\W_]*l[\W_]*e\b/gi,
  /\bm[\W_]*o[\W_]*t[\W_]*h[\W_]*e[\W_]*r[\W_]*f[\W_]*u[\W_]*c[\W_]*k[\W_]*e[\W_]*r\b/gi,
];

function cleanChatText(value) {
  let text = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CHAT_LIMIT);

  for (const pattern of chatFilters) text = text.replace(pattern, "****");
  return text;
}

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
    startAt: Date.now() + 10000,
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
  if (r.kind === "public" && r.status === "lobby" && r.members.length >= 2)
    r.startAt = Math.min(r.startAt, Date.now() + 2500);
  lobby(r);
}

function joinPublicInProgress(s, r) {
  if (r.kind !== "public" || r.status !== "playing" || !r.game)
    throw Error("This public match is not available.");
  if (r.members.length >= 8) throw Error("This room is full.");

  leave(s);
  s.room = r.code;
  s.ready = false;
  r.members.push(s);

  // Public matches begin with bots filling empty slots. Replace one bot
  // with the arriving real player so late Quick Match users join the
  // existing match instead of being split into a second server.
  const bot = r.game.players.find((p) => p.bot);
  if (bot) removePlayer(r.game, bot.id);

  addPlayer(r.game, {
    id: s.id,
    name: s.name,
    skin: s.skin,
    pistol: s.pistol,
    trail: s.trail,
    emote: s.emote,
    banner: s.banner,
  });

  lobby(r);
  send(s, {
    type: "start",
    state: snapshot(r.game),
    code: r.code,
    kind: r.kind,
  });
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
function persistBoard() {
  const data = JSON.stringify(board);
  saving = saving.then(async () => {
    const path = resolve(dataDir, "leaderboard.json");
    await writeFile(path + ".tmp", data);
    await rename(path + ".tmp", path);
  }).catch((e) => console.error("Score persistence failed:", e.message));
  return saving;
}
function mergeBoardRows(target, source) {
  if (!target || !source || target === source) return target;
  for (const field of ["wins", "kills", "deaths", "shots", "hits", "matches"]) target[field] = Number(target[field] || 0) + Number(source[field] || 0);
  target.best = Math.max(Number(target.best || 0), Number(source.best || 0));
  target.history = [...(target.history || []), ...(source.history || [])].filter((h) => Number(h?.at) > Date.now() - 7 * 86400000).sort((a,b) => Number(a.at) - Number(b.at));
  if (!target.skin && source.skin) target.skin = source.skin;
  if (!target.pistol && source.pistol) target.pistol = source.pistol;
  board = board.filter((r) => r !== source);
  return target;
}
function updateBoardIdentity(id, identity, cosmetics = {}) {
  if (!identity?.userId) return false;
  let rowById = board.find((r) => r.id === id);
  let rowByCg = board.find((r) => r.crazyGamesId === identity.userId);
  if (rowById && rowByCg && rowById !== rowByCg) { rowByCg = mergeBoardRows(rowByCg, rowById); rowById = rowByCg; }
  const row = rowByCg || rowById;
  if (!row) return false;
  let changed = false;
  if (row.name !== identity.username) { row.name = identity.username; changed = true; }
  if (row.crazyGamesId !== identity.userId) { row.crazyGamesId = identity.userId; changed = true; }
  for (const key of ["skin", "pistol"]) if (cosmetics[key] && row[key] !== cosmetics[key]) { row[key] = String(cosmetics[key]).slice(0,20); changed = true; }
  if (changed) persistBoard();
  return changed;
}
async function resolveHelloIdentity(m) {
  const token = typeof m.token === "string" && /^[a-f0-9]{64}$/.test(m.token) ? m.token : randomBytes(32).toString("hex");
  const localId = createHash("sha256").update(token).digest("hex").slice(0,24);
  const cg = await verifyCrazyToken(m.cgToken);
  if (!cg) {
    const existing = sessions.get(localId);
    return { id: localId, token, name: requireUniqueName(m.name, existing), crazyGamesId: null };
  }
  const byCg = board.find((r) => r.crazyGamesId === cg.userId);
  const byLocal = board.find((r) => r.id === localId);
  let linked = byCg || byLocal || null;
  if (byCg && byLocal && byCg !== byLocal) linked = mergeBoardRows(byCg, byLocal);
  if (linked) { linked.crazyGamesId = cg.userId; linked.name = cg.username; persistBoard(); }
  return { id: linked?.id || stableCrazyId(cg.userId), token, name: cg.username, crazyGamesId: cg.userId };
}
function record(r) {
  if (r.recorded) return;
  r.recorded = true;
  for (const p of r.game.players.filter((p) => !p.bot)) {
    const session = sessions.get(p.id);
    let row = session?.crazyGamesId ? board.find((a) => a.crazyGamesId === session.crazyGamesId) : null;
    if (!row) row = board.find((a) => a.id === p.id);
    if (!row) {
      row = { id: p.id, crazyGamesId: session?.crazyGamesId || null, name: p.name, skin: p.skin || session?.skin || "Default", pistol: p.pistol || session?.pistol || "Classic", wins:0, kills:0, deaths:0, shots:0, hits:0, best:0, matches:0, history:[] };
      board.push(row);
    }
    const win = won(r.game,p);
    row.name = p.name;
    row.crazyGamesId = session?.crazyGamesId || row.crazyGamesId || null;
    row.skin = p.skin || session?.skin || row.skin || "Default";
    row.pistol = p.pistol || session?.pistol || row.pistol || "Classic";
    row.wins = Number(row.wins||0) + Number(win);
    row.kills = Number(row.kills||0) + p.stats.kills;
    row.deaths = Number(row.deaths||0) + p.stats.deaths;
    row.shots = Number(row.shots||0) + p.stats.shots;
    row.hits = Number(row.hits||0) + p.stats.hits;
    row.best = Math.max(Number(row.best||0),p.stats.best);
    row.matches = Number(row.matches||0) + 1;
    row.history = Array.isArray(row.history) ? row.history : [];
    row.history.push({ at:Date.now(), wins:Number(win), kills:p.stats.kills, shots:p.stats.shots, hits:p.stats.hits, best:p.stats.best, matches:1 });
    row.history = row.history.filter((h) => h.at > Date.now() - 7*86400000);
  }
  persistBoard();
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
      res.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
      });
      res.end(
        JSON.stringify({ ok: true, version: VERSION, rooms: rooms.size }),
      );
      return;
    }
    if (url.pathname === "/api/leaderboard") {
      const allowed = process.env.ALLOWED_ORIGIN;
      if (!allowed || req.headers.origin === allowed) res.setHeader("Access-Control-Allow-Origin", allowed || "*");
      res.setHeader("Vary", "Origin");
      let rows = board.map(({ history, crazyGamesId, ...source }) => {
        const r = { ...source };
        const safeHistory = Array.isArray(history) ? history : [];
        if (url.searchParams.get("period") === "week") {
          const recent = safeHistory.filter((h) => Number(h.at) > Date.now() - 7*86400000);
          for (const field of ["wins","kills","shots","hits","matches"]) r[field] = recent.reduce((n,h) => n + Number(h[field]||0),0);
          r.best = Math.max(0,...recent.map((h) => Number(h.best||0)));
        }
        return r;
      });
      const metric = ["wins","kills","best","matches","accuracy"].includes(url.searchParams.get("metric")) ? url.searchParams.get("metric") : "wins";
      rows = rows.filter((r) => Number(r.matches||0) > 0).map((r) => ({ ...r, wins:Number(r.wins||0), kills:Number(r.kills||0), deaths:Number(r.deaths||0), matches:Number(r.matches||0), best:Number(r.best||0), accuracy:Number(r.shots||0) ? Math.round((Number(r.hits||0)/Number(r.shots||0))*100) : 0 })).sort((a,b) => b[metric]-a[metric] || b.kills-a.kills).map((r,i) => ({...r,rank:i+1}));
      const top = rows.slice(0,100);
      if (url.searchParams.get("v") !== "2") {
        res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
        res.end(JSON.stringify(top));
        return;
      }
      const playerId = String(url.searchParams.get("playerId") || "").slice(0,64);
      const friendIds = new Set(String(url.searchParams.get("friends") || "").split(",").filter((id) => /^[a-f0-9]{24}$/.test(id)).slice(0,100));
      if (/^[a-f0-9]{24}$/.test(playerId)) friendIds.add(playerId);
      const self = /^[a-f0-9]{24}$/.test(playerId) ? rows.find((r) => r.id === playerId) || null : null;
      const friends = friendIds.size ? rows.filter((r) => friendIds.has(r.id)).slice(0,100) : [];
      res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
      res.end(JSON.stringify({rows:top,self,friends,total:rows.length}));
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
  ws.on("message", async (raw) => {
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
        const identity = await resolveHelloIdentity(m);
        const { id, token } = identity;
        const existing = sessions.get(id);
        s = existing;
        if (!s) {
          s = { id, token, name: identity.name, crazyGamesId: identity.crazyGamesId, room: null, ready: false };
          sessions.set(id,s);
        }
        if (s.ws && s.ws !== ws) s.ws.close(1000, "Connected elsewhere");
        s.ws = ws;
        s.token = token;
        s.disconnected = 0;
        s.name = identity.name;
        s.crazyGamesId = identity.crazyGamesId || s.crazyGamesId || null;
        s.skin = String(m.skin || "Default").slice(0, 20);
        s.pistol = String(m.pistol || "Classic").slice(0, 20);
        s.trail = String(m.trail || "Default").slice(0, 20);
        s.emote = String(m.emote || "GG").slice(0, 20);
        s.banner = String(m.banner || "Rookie").slice(0, 20);
        if (identity.crazyGamesId) updateBoardIdentity(s.id,{userId:identity.crazyGamesId,username:s.name},{skin:s.skin,pistol:s.pistol});
        clearTimeout(helloTimeout);
        send(s, { type: "hello", id: s.id, token, name: s.name, verifiedCrazyGames: !!s.crazyGamesId });
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

      if (m.type === "chat") {
        if (!r) throw Error("Join a room before using chat.");
        const now = Date.now();
        if (now - (s.lastChatAt || 0) < CHAT_COOLDOWN_MS) return;
        const text = cleanChatText(m.text);
        if (!text) return;

        s.lastChatAt = now;
        broadcast(r, {
          type: "chat",
          id: s.id,
          name: s.name,
          text,
          at: now,
        });
        return;
      }

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
            ping: Number.isFinite(m.ping)
              ? Math.max(0, Math.min(350, m.ping))
              : (p.input.ping || 0),
          };
          p.lastInput = Date.now();
        }
        return;
      }
      if (m.type === "profile") {
        if (r?.status === "playing") return;
        const cg = await verifyCrazyToken(m.cgToken);
        if (cg) { s.name = cg.username; s.crazyGamesId = cg.userId; }
        else if (!s.crazyGamesId) s.name = requireUniqueName(m.name,s);
        for (const k of ["skin","pistol","trail","emote","banner"]) s[k] = String(m[k] || s[k]).slice(0,20);
        if (s.crazyGamesId) updateBoardIdentity(s.id,{userId:s.crazyGamesId,username:s.name},{skin:s.skin,pistol:s.pistol});
        return;
      }
      if (m.type === "quick") {
        leave(s);

        // Prefer a waiting public lobby first.
        let room = [...rooms.values()].find(
          (a) =>
            a.kind === "public" &&
            a.status === "lobby" &&
            a.members.length < 8,
        );

        if (room) {
          join(s, room);
          return;
        }

        // If a match has already started with bots, replace a bot with the
        // arriving player instead of creating a separate public server.
        room = [...rooms.values()].find(
          (a) =>
            a.kind === "public" &&
            a.status === "playing" &&
            a.members.length < 8 &&
            a.game?.players?.some((p) => p.bot),
        );

        if (room) {
          joinPublicInProgress(s, room);
          return;
        }

        newRoom(s, "public", m.options);
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
        if (r.kind === "public") r.startAt = Date.now() + 10000;
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
  if (++frame % 2 === 0)
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
