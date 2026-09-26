import { engine } from "./engine.js";

const MAX_PLAYERS = 8;
const PUBLIC_START_MS = 5000;
const RECONNECT_MS = 30000;
const SNAPSHOT_IDLE_MS = 100; // 10 snapshots/sec while movement is the main activity.
const SNAPSHOT_ACTION_MS = 66; // ~15/sec while bullets are active for better hit readability.
const TICK_MS = 1000 / 60;
const VALID_CODE = /^[A-Z0-9]{5}$/;
const BOT_NAMES = ["Rex", "Nova", "Shadow", "Blaze", "Echo", "Ghost", "Pixel"];

const rooms = new Map();
const sessions = new Map(); // playerId -> session
const socketSessions = new Map();
const tokenRecords = new Map(); // network token -> { id, expiresAt }
const leaderboard = new Map();
let gameLoop = null;

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function send(socket, message) {
  try {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  } catch (_) {}
}

function safeText(value, fallback = "", max = 32) {
  return String(value ?? fallback).replace(/[<>\\\r\n]/g, "").trim().slice(0, max) || fallback;
}

function randomId(prefix = "p") {
  return `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function randomToken() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let tries = 0; tries < 100; tries++) {
    let code = "";
    const bytes = crypto.getRandomValues(new Uint8Array(5));
    for (const b of bytes) code += alphabet[b % alphabet.length];
    if (!rooms.has(code)) return code;
  }
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

function profileFromMessage(message, current = {}) {
  return {
    name: safeText(message.name, current.name || "Player", 18),
    skin: safeText(message.skin, current.skin || "Default", 40),
    pistol: safeText(message.pistol, current.pistol || "Classic", 40),
    weapon: engine.WEAPONS[safeText(message.weapon, current.weapon || "Classic", 40)]
      ? safeText(message.weapon, current.weapon || "Classic", 40)
      : "Classic",
    trail: safeText(message.trail, current.trail || "Default", 40),
    emote: safeText(message.emote, current.emote || "GG", 24),
    banner: safeText(message.banner, current.banner || "Rookie", 40),
  };
}

function optionsFromMessage(value = {}, previous = {}) {
  const merged = { ...previous, ...value };
  return {
    difficulty: ["easy", "normal", "hard"].includes(merged.difficulty) ? merged.difficulty : "normal",
    mode: engine.MODES[merged.mode] ? merged.mode : "ffa",
    map: engine.MAPS[merged.map] ? merged.map : "yard",
    bots: Math.max(0, Math.min(7, Math.floor(Number(merged.bots) || 0))),
    duration: Math.max(30, Math.min(240, Number(merged.duration) || 180)),
    mapVoting: merged.mapVoting !== false,
    modeVoting: merged.modeVoting !== false,
  };
}

function getSessionBySocket(socket) {
  return socketSessions.get(socket) || null;
}

function humanSessions(room) {
  return room.members.map((id) => sessions.get(id)).filter(Boolean);
}

function lobbyPayload(room) {
  const now = Date.now();
  return {
    kind: room.kind,
    status: room.status,
    code: room.code,
    host: room.host,
    startsIn: room.kind === "public" && room.status === "lobby"
      ? Math.max(0, Math.ceil(((room.startsAt || now) - now) / 1000))
      : 0,
    options: room.options,
    players: humanSessions(room).map((s) => ({
      id: s.id,
      name: s.profile.name,
      skin: s.profile.skin,
      pistol: s.profile.pistol,
      weapon: s.profile.weapon,
      trail: s.profile.trail,
      emote: s.profile.emote,
      banner: s.profile.banner,
      ready: !!s.ready,
      connected: !!s.connected,
    })),
  };
}

function broadcastRoom(room, message) {
  for (const s of humanSessions(room)) send(s.socket, message);
}

function broadcastLobby(room) {
  broadcastRoom(room, { type: "lobby", lobby: lobbyPayload(room) });
}

function detachFromRoom(session, notifySelf = false) {
  const room = session.roomCode ? rooms.get(session.roomCode) : null;
  if (!room) {
    session.roomCode = null;
    if (notifySelf) send(session.socket, { type: "left" });
    return;
  }

  room.members = room.members.filter((id) => id !== session.id);
  if (room.game) engine.removePlayer(room.game, session.id);
  session.roomCode = null;
  session.ready = false;

  if (room.host === session.id) room.host = room.members[0] || null;

  if (!room.members.length) {
    if (room.queueTimer) clearTimeout(room.queueTimer);
    for (const timer of room.flowTimers || []) clearTimeout(timer);
    room.flowTimers = [];
    rooms.delete(room.code);
  } else {
    broadcastLobby(room);
  }
  if (notifySelf) send(session.socket, { type: "left" });
}

function joinRoom(session, room) {
  if (session.roomCode && session.roomCode !== room.code) detachFromRoom(session, false);
  if (!room.members.includes(session.id)) room.members.push(session.id);
  session.roomCode = room.code;
  session.ready = session.id === room.host;
  broadcastLobby(room);
}

function createRoom(kind, options, hostSession = null) {
  const code = roomCode();
  const room = {
    code,
    kind,
    status: "lobby",
    host: hostSession?.id || null,
    members: [],
    options: optionsFromMessage(options, { difficulty: "normal", mode: "ffa", map: "yard", bots: 7 }),
    startsAt: kind === "public" ? Date.now() + PUBLIC_START_MS : 0,
    queueTimer: null,
    game: null,
    lastTick: 0,
    accumulator: 0,
    lastSnapshotAt: 0,
    leaderboardSaved: false,
    flowTimers: [],
    vote: null,
  };
  rooms.set(code, room);
  return room;
}

function schedulePublicRoom(room) {
  if (room.kind !== "public" || room.status !== "lobby") return;
  if (!room.startsAt) room.startsAt = Date.now() + PUBLIC_START_MS;
  if (room.queueTimer) clearTimeout(room.queueTimer);

  const tick = () => {
    if (!rooms.has(room.code) || room.status !== "lobby") return;
    broadcastLobby(room);
    if (room.members.length >= MAX_PLAYERS || Date.now() >= room.startsAt) {
      startRoom(room);
      return;
    }
    room.queueTimer = setTimeout(tick, 500);
  };
  tick();
}

function choosePublicRoom() {
  for (const room of rooms.values()) {
    if (room.kind === "public" && room.status === "lobby" && room.members.length < MAX_PLAYERS) return room;
  }
  return null;
}

function addBotsForRoom(room, game) {
  const humans = room.members.length;
  let count = room.options.bots;
  if (engine.teamMode(game) || game.mode === "duel") count = MAX_PLAYERS - humans;
  count = Math.max(0, Math.min(MAX_PLAYERS - humans, count));

  for (let i = 0; i < count; i++) {
    engine.addPlayer(game, {
      id: `bot-${room.code}-${i}`,
      name: `${BOT_NAMES[i % BOT_NAMES.length]} · BOT`,
      bot: true,
      skin: "Default",
      weapon: "Classic",
    });
  }
}

function publicSnapshot(game) {
  const state = engine.snapshot(game);
  // Long event histories are expensive over WebSocket and the client only needs recent effects.
  if (Array.isArray(state.events) && state.events.length > 14) state.events = state.events.slice(-14);
  return state;
}

function startRoom(room) {
  if (!rooms.has(room.code) || room.status !== "lobby" || !room.members.length) return;
  for (const timer of room.flowTimers || []) clearTimeout(timer);
  room.flowTimers = [];
  room.vote = null;
  if (room.queueTimer) {
    clearTimeout(room.queueTimer);
    room.queueTimer = null;
  }

  room.status = "playing";
  room.postmatchStarted = false;
  room.game = engine.createGame(room.options);
  room.leaderboardSaved = false;
  room.accumulator = 0;
  room.lastTick = performance.now();
  room.lastSnapshotAt = 0;

  for (const s of humanSessions(room)) {
    engine.addPlayer(room.game, {
      id: s.id,
      ...s.profile,
      bot: false,
    });
  }
  addBotsForRoom(room, room.game);
  engine.modeInit(room.game);

  const state = publicSnapshot(room.game);
  broadcastRoom(room, { type: "start", kind: room.kind, state });
  ensureGameLoop();
}

function gamePlayer(session) {
  const room = session.roomCode ? rooms.get(session.roomCode) : null;
  if (!room?.game) return { room: null, player: null };
  return { room, player: room.game.players.find((p) => p.id === session.id) || null };
}

function applyInput(player, message) {
  if (!player) return;
  const current = player.input || {};
  const x = Math.max(-1, Math.min(1, Number(message.x) || 0));
  const y = Math.max(-1, Math.min(1, Number(message.y) || 0));
  const angle = Number.isFinite(Number(message.angle)) ? Number(message.angle) : (player.angle || 0);
  player.input = {
    x, y, angle,
    charge: !!message.charge,
    shoot: !!message.shoot || !!current.shoot,
    dash: !!message.dash || !!current.dash,
    melee: !!message.melee || !!current.melee,
    pickup: !!message.pickup || !!current.pickup,
    emote: !!message.emote || !!current.emote,
  };
}

function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}

function emptyLeader(id, name) {
  return { id, name, wins: 0, kills: 0, hits: 0, shots: 0, best: 0, matches: 0, updatedAt: Date.now(), week: null };
}

function addLeaderStats(session, p, won) {
  let row = leaderboard.get(session.id) || emptyLeader(session.id, session.profile.name);
  const wk = weekKey();
  if (!row.week || row.week.key !== wk) row.week = { key: wk, wins: 0, kills: 0, hits: 0, shots: 0, best: 0, matches: 0 };
  const stats = p?.stats || {};
  const delta = {
    wins: won ? 1 : 0,
    kills: Math.max(0, Math.floor(Number(stats.kills) || 0)),
    hits: Math.max(0, Math.floor(Number(stats.hits) || 0)),
    shots: Math.max(0, Math.floor(Number(stats.shots) || 0)),
    best: Math.max(0, Math.floor(Number(stats.best) || 0)),
    matches: 1,
  };
  row.name = session.profile.name;
  row.wins += delta.wins;
  row.kills += delta.kills;
  row.hits += delta.hits;
  row.shots += delta.shots;
  row.best = Math.max(row.best, delta.best);
  row.matches += 1;
  row.updatedAt = Date.now();
  row.week.wins += delta.wins;
  row.week.kills += delta.kills;
  row.week.hits += delta.hits;
  row.week.shots += delta.shots;
  row.week.best = Math.max(row.week.best, delta.best);
  row.week.matches += 1;
  leaderboard.set(session.id, row);
}

function saveMatchLeaderboard(room) {
  if (room.leaderboardSaved || !room.game?.ended) return;
  room.leaderboardSaved = true;
  for (const s of humanSessions(room)) {
    const p = room.game.players.find((x) => x.id === s.id);
    if (!p) continue;
    let won = false;
    try { won = !!engine.won(room.game, p); } catch (_) {}
    addLeaderStats(s, p, won);
  }
}

function leaderboardRow(row, period) {
  const src = period === "week" && row.week?.key === weekKey() ? row.week : period === "week"
    ? { wins: 0, kills: 0, hits: 0, shots: 0, best: 0, matches: 0 }
    : row;
  return {
    id: row.id,
    name: row.name,
    wins: src.wins || 0,
    kills: src.kills || 0,
    accuracy: src.shots ? Math.round((src.hits / src.shots) * 100) : 0,
    best: src.best || 0,
    matches: src.matches || 0,
  };
}

function shuffledChoices(values, count = 3) {
  const list = [...values];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, count);
}

function postmatchVotingMessage(room) {
  const vote = room.vote;
  if (!vote) return null;
  return {
    type: "postmatch",
    phase: "voting",
    id: vote.id,
    maps: vote.maps,
    modes: vote.modes,
    mapVotes: vote.mapVotes,
    modeVotes: vote.modeVotes,
    remainingMs: Math.max(0, vote.endsAt - Date.now()),
  };
}

function finishPostmatchVote(room) {
  if (!rooms.has(room.code) || !room.vote) return;
  const vote = room.vote;
  if (vote.maps.length) room.options.map = engine.modeTally(vote.maps, vote.mapVotes) || room.options.map;
  if (vote.modes.length) room.options.mode = engine.modeTally(vote.modes, vote.modeVotes) || room.options.mode;
  room.vote = null;
  room.status = "intermission";
  broadcastRoom(room, { type: "postmatch", phase: "intermission" });
  const timer = setTimeout(() => {
    if (!rooms.has(room.code) || !room.members.length) return;
    room.game = null;
    room.status = "lobby";
    room.leaderboardSaved = false;
    for (const s of humanSessions(room)) s.ready = s.id === room.host;
    startRoom(room);
  }, 1800);
  room.flowTimers.push(timer);
}

function beginPostmatchFlow(room) {
  if (room.postmatchStarted || !room.game?.ended) return;
  room.postmatchStarted = true;
  room.status = "postmatch";

  const highlightTimer = setTimeout(() => {
    if (!rooms.has(room.code) || !room.members.length) return;
    broadcastRoom(room, { type: "postmatch", phase: "highlight" });
  }, 2200);
  room.flowTimers.push(highlightTimer);

  const votingTimer = setTimeout(() => {
    if (!rooms.has(room.code) || !room.members.length) return;
    const maps = room.options.mapVoting === false ? [] : shuffledChoices(Object.keys(engine.MAPS), 3);
    const modes = room.options.modeVoting === false ? [] : shuffledChoices(Object.keys(engine.MODES), 3);

    if (!maps.length && !modes.length) {
      room.status = "intermission";
      broadcastRoom(room, { type: "postmatch", phase: "intermission" });
      const restart = setTimeout(() => {
        if (!rooms.has(room.code) || !room.members.length) return;
        room.game = null;
        room.status = "lobby";
        room.leaderboardSaved = false;
        room.postmatchStarted = false;
        startRoom(room);
      }, 1800);
      room.flowTimers.push(restart);
      return;
    }

    room.status = "voting";
    room.vote = {
      id: randomId("vote"),
      maps,
      modes,
      mapVotes: {},
      modeVotes: {},
      endsAt: Date.now() + 10000,
    };

    // Give bot-filled sessions a little variety without letting bots dominate a full human room.
    const botIds = room.game.players.filter((p) => p.bot).map((p) => p.id);
    for (const id of botIds) {
      if (maps.length && Math.random() < 0.35) room.vote.mapVotes[id] = maps[Math.floor(Math.random() * maps.length)];
      if (modes.length && Math.random() < 0.35) room.vote.modeVotes[id] = modes[Math.floor(Math.random() * modes.length)];
    }

    broadcastRoom(room, postmatchVotingMessage(room));
    const finishVoteTimer = setTimeout(() => finishPostmatchVote(room), 10050);
    room.flowTimers.push(finishVoteTimer);
  }, 7800);
  room.flowTimers.push(votingTimer);
}

function ensureGameLoop() {
  if (gameLoop) return;
  gameLoop = setInterval(() => {
    const now = performance.now();
    let active = 0;
    for (const room of rooms.values()) {
      const g = room.game;
      if (!g || g.ended || room.status !== "playing") {
        if (g?.ended) {
          saveMatchLeaderboard(room);
          beginPostmatchFlow(room);
        }
        continue;
      }
      active++;
      const elapsed = Math.min(0.10, Math.max(0, (now - room.lastTick) / 1000));
      room.lastTick = now;
      room.accumulator += elapsed;
      let steps = 0;
      while (room.accumulator >= 1 / 60 && steps < 6) {
        engine.step(g, 1 / 60);
        room.accumulator -= 1 / 60;
        steps++;
      }
      if (steps === 6 && room.accumulator > 0.25) room.accumulator = 0;

      const snapshotEvery = g.bullets?.length ? SNAPSHOT_ACTION_MS : SNAPSHOT_IDLE_MS;
      if (now - room.lastSnapshotAt >= snapshotEvery || g.ended) {
        room.lastSnapshotAt = now;
        broadcastRoom(room, { type: "state", state: publicSnapshot(g) });
      }
      if (g.ended) {
        saveMatchLeaderboard(room);
        beginPostmatchFlow(room);
      }
    }
    if (!active) {
      clearInterval(gameLoop);
      gameLoop = null;
    }
  }, TICK_MS);
}

function returnToLobby(room) {
  for (const timer of room.flowTimers || []) clearTimeout(timer);
  room.flowTimers = [];
  room.vote = null;
  room.postmatchStarted = false;
  room.game = null;
  room.status = "lobby";
  room.leaderboardSaved = false;
  for (const s of humanSessions(room)) s.ready = s.id === room.host;
  if (room.kind === "public") {
    room.startsAt = Date.now() + PUBLIC_START_MS;
    schedulePublicRoom(room);
  } else {
    broadcastLobby(room);
  }
}

function updateLivePlayer(session) {
  const { room, player } = gamePlayer(session);
  if (!room || !player) return;
  player.name = session.profile.name;
  player.skin = session.profile.skin;
  player.pistol = session.profile.pistol;
  player.weapon = engine.WEAPONS[session.profile.weapon] ? session.profile.weapon : "Classic";
  player.trail = session.profile.trail;
  player.emote = session.profile.emote;
  player.banner = session.profile.banner;
}

function handleMessage(socket, raw) {
  let message;
  try {
    message = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
  } catch (_) {
    return;
  }
  if (!message || typeof message !== "object") return;

  let session = getSessionBySocket(socket);

  if (message.type === "hello") {
    if (session) return;
    if (Number(message.version) !== Number(engine.VERSION)) {
      send(socket, { type: "error", message: "Game/server version mismatch. Refresh the game." });
      try { socket.close(1008, "version mismatch"); } catch (_) {}
      return;
    }

    const suppliedToken = safeText(message.token, "", 160);
    const record = suppliedToken ? tokenRecords.get(suppliedToken) : null;
    if (record && record.expiresAt > Date.now() && sessions.has(record.id)) {
      session = sessions.get(record.id);
      if (session.socket && session.socket !== socket) {
        try { session.socket.close(1000, "reconnected elsewhere"); } catch (_) {}
      }
      session.socket = socket;
      session.connected = true;
      session.disconnectTimer && clearTimeout(session.disconnectTimer);
      session.disconnectTimer = null;
      socketSessions.set(socket, session);
      session.profile = profileFromMessage(message, session.profile);
    } else {
      const id = randomId("p");
      const token = randomToken();
      session = {
        id,
        token,
        socket,
        connected: true,
        ready: false,
        roomCode: null,
        profile: profileFromMessage(message, {}),
        disconnectTimer: null,
      };
      sessions.set(id, session);
      socketSessions.set(socket, session);
      tokenRecords.set(token, { id, expiresAt: Number.MAX_SAFE_INTEGER });
    }

    tokenRecords.set(session.token, { id: session.id, expiresAt: Number.MAX_SAFE_INTEGER });
    send(socket, { type: "hello", id: session.id, token: session.token, features: { gameplayModes: 1, deno: 1 } });

    const room = session.roomCode ? rooms.get(session.roomCode) : null;
    if (room) {
      broadcastLobby(room);
      if (room.game && ["playing", "results"].includes(room.status)) {
        send(socket, { type: "start", kind: room.kind, state: publicSnapshot(room.game) });
      }
    }
    return;
  }

  if (!session) {
    send(socket, { type: "error", message: "Say hello before using the game server." });
    return;
  }

  switch (message.type) {
    case "profile": {
      session.profile = profileFromMessage(message, session.profile);
      updateLivePlayer(session);
      const room = session.roomCode ? rooms.get(session.roomCode) : null;
      if (room && room.status === "lobby") broadcastLobby(room);
      break;
    }
    case "quick": {
      let room = choosePublicRoom();
      if (!room) room = createRoom("public", message.options, session);
      if (!room.host) room.host = session.id;
      if (room.members.length >= MAX_PLAYERS) {
        room = createRoom("public", message.options, session);
      }
      joinRoom(session, room);
      schedulePublicRoom(room);
      break;
    }
    case "create": {
      detachFromRoom(session, false);
      const room = createRoom("private", message.options, session);
      joinRoom(session, room);
      break;
    }
    case "join": {
      const code = safeText(message.code, "", 5).toUpperCase();
      const room = VALID_CODE.test(code) ? rooms.get(code) : null;
      if (!room || room.kind !== "private") {
        send(socket, { type: "error", message: "Room not found. Check the five-character code." });
        break;
      }
      if (room.status !== "lobby") {
        send(socket, { type: "error", message: "That room is already in a match." });
        break;
      }
      if (room.members.length >= MAX_PLAYERS && !room.members.includes(session.id)) {
        send(socket, { type: "error", message: "That room is full." });
        break;
      }
      joinRoom(session, room);
      break;
    }
    case "ready": {
      const room = session.roomCode ? rooms.get(session.roomCode) : null;
      if (!room || room.status !== "lobby") break;
      if (session.id !== room.host) session.ready = !session.ready;
      broadcastLobby(room);
      break;
    }
    case "options": {
      const room = session.roomCode ? rooms.get(session.roomCode) : null;
      if (!room || room.status !== "lobby" || room.host !== session.id) break;
      room.options = optionsFromMessage(message.options, room.options);
      broadcastLobby(room);
      break;
    }
    case "start": {
      const room = session.roomCode ? rooms.get(session.roomCode) : null;
      if (!room || room.kind !== "private" || room.host !== session.id || room.status !== "lobby") break;
      startRoom(room);
      break;
    }
    case "input": {
      const { room, player } = gamePlayer(session);
      if (!room || room.status !== "playing" || !player || player.dead === 99999) break;
      applyInput(player, message);
      break;
    }
    case "mode-vote": {
      const { room } = gamePlayer(session);
      if (room?.game) engine.modeVote(room.game, session.id, safeText(message.choice, "", 40));
      break;
    }
    case "chat": {
      const room = session.roomCode ? rooms.get(session.roomCode) : null;
      if (!room) break;
      const text = safeText(message.text, "", 120);
      if (!text) break;
      broadcastRoom(room, { type: "chat", id: session.id, name: session.profile.name, text });
      break;
    }
    case "ping":
      send(socket, { type: "pong", time: message.time });
      break;
    case "return": {
      const room = session.roomCode ? rooms.get(session.roomCode) : null;
      if (!room) break;
      if (!room.game || room.game.ended || room.status === "results") returnToLobby(room);
      break;
    }
    case "vote": {
      const room = session.roomCode ? rooms.get(session.roomCode) : null;
      const vote = room?.vote;
      if (!room || !vote || room.status !== "voting" || message.id !== vote.id || Date.now() >= vote.endsAt) break;
      const category = message.category === "map" ? "map" : message.category === "mode" ? "mode" : null;
      const choice = safeText(message.choice, "", 40);
      if (category === "map" && vote.maps.includes(choice)) vote.mapVotes[session.id] = choice;
      if (category === "mode" && vote.modes.includes(choice)) vote.modeVotes[session.id] = choice;
      broadcastRoom(room, postmatchVotingMessage(room));
      break;
    }
    case "leave":
      detachFromRoom(session, true);
      break;
  }
}

function onSocketClose(socket) {
  const session = getSessionBySocket(socket);
  if (!session || session.socket !== socket) {
    socketSessions.delete(socket);
    return;
  }
  socketSessions.delete(socket);
  session.connected = false;
  session.socket = null;
  tokenRecords.set(session.token, { id: session.id, expiresAt: Date.now() + RECONNECT_MS });

  const room = session.roomCode ? rooms.get(session.roomCode) : null;
  if (room?.game) {
    const p = room.game.players.find((x) => x.id === session.id);
    if (p) p.input = { x: 0, y: 0, angle: p.angle || 0, charge: false };
  }
  if (room && room.status === "lobby") broadcastLobby(room);

  session.disconnectTimer = setTimeout(() => {
    if (session.connected) return;
    detachFromRoom(session, false);
    sessions.delete(session.id);
    const rec = tokenRecords.get(session.token);
    if (rec?.id === session.id) tokenRecords.delete(session.token);
  }, RECONNECT_MS + 250);
}

function upgrade(req) {
  const { socket, response } = Deno.upgradeWebSocket(req, { idleTimeout: 120 });
  socket.onmessage = (event) => handleMessage(socket, event.data);
  socket.onclose = () => onSocketClose(socket);
  socket.onerror = () => {};
  return response;
}

function buildLeaderboard(url) {
  const metric = ["wins", "kills", "accuracy", "best", "matches"].includes(url.searchParams.get("metric"))
    ? url.searchParams.get("metric")
    : "wins";
  const period = url.searchParams.get("period") === "week" ? "week" : "all";
  const playerId = safeText(url.searchParams.get("playerId"), "", 80);
  const friends = new Set((url.searchParams.get("friends") || "").split(",").map((x) => x.trim()).filter(Boolean));
  const rows = [...leaderboard.values()].map((r) => leaderboardRow(r, period));
  rows.sort((a, b) => {
    const av = metric === "accuracy" ? a.accuracy : Number(a[metric]) || 0;
    const bv = metric === "accuracy" ? b.accuracy : Number(b[metric]) || 0;
    return bv - av || b.wins - a.wins || b.kills - a.kills || a.name.localeCompare(b.name);
  });
  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const top = ranked.slice(0, 100);
  return {
    rows: top,
    friends: ranked.filter((r) => r.id === playerId || friends.has(r.id)).slice(0, 100),
    self: ranked.find((r) => r.id === playerId) || null,
    total: ranked.length,
  };
}

const indexHtml = await Deno.readTextFile(new URL("./public/index.html", import.meta.url));

Deno.serve((req) => {
  const url = new URL(req.url);

  if (req.headers.get("upgrade")?.toLowerCase() === "websocket") return upgrade(req);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (url.pathname === "/health") {
    return json({
      ok: true,
      service: "ONE BULLET Deno server",
      version: engine.VERSION,
      rooms: rooms.size,
      players: [...sessions.values()].filter((s) => s.connected).length,
      now: new Date().toISOString(),
    });
  }

  if (url.pathname === "/api/leaderboard") return json(buildLeaderboard(url));

  if (url.pathname === "/" || url.pathname === "/index.html") {
    return new Response(indexHtml, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  if (url.pathname === "/favicon.svg") {
    return new Response(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#091726"/><path d="M21 4 7 19h9l-5 10 16-17H16z" fill="#00e5ed"/></svg>`, {
      headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" },
    });
  }

  return new Response("Not found", { status: 404, headers: cors });
});
