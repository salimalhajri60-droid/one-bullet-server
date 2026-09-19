import { platform } from "./platform.js";
import {
  createGame,
  addPlayer,
  step,
  MAPS,
  MODES,
  COLORS,
  VERSION,
  ranking,
  won,
  clamp,
} from "./engine.js";
import { Renderer, avatar, mapThumb, SKINS } from "./render.js";
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  canvas = $("#game"),
  renderer = new Renderer(canvas);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  play: "M8 4l13 8-13 8Z",
  bolt: "M13 2 4 14h7l-1 8 10-12h-7Z",
  cross: "M12 2v4m0 12v4M2 12h4m12 0h4M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
  friends:
    "M15 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M15 4a4 4 0 0 1 0 8m3 3a4 4 0 0 1 4 4v2M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  bot: "M7 5h10a3 3 0 0 1 3 3v10H4V8a3 3 0 0 1 3-3ZM12 2v3M1 10v5m22-5v5M8 10v2m8-2v2M9 15h6",
  case: "M8 6V3h8v3M3 7h18v14H3ZM3 12h18M10 11v3h4v-3",
  shop: "M3 3h2l3 12h11l3-9H6M10 20h.1M18 20h.1",
  trophy:
    "M8 3h8v7a4 4 0 0 1-8 0ZM8 5H3v3a5 5 0 0 0 5 5m8-8h5v3a5 5 0 0 1-5 5M12 14v6M7 21h10",
  target:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-4 0h.1",
  gift: "M3 9h18v4H3ZM5 13v8h14v-8M12 9v12M12 9S3 8 5 4s7 5 7 5Zm0 0s9-1 7-5-7 5-7 5Z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5m6-6-6 6 6 6",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2",
  shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z",
  copy: "M9 9h12v12H9ZM15 9V3H3v12h6",
  check: "m5 12 4 4L20 5",
  close: "m6 6 12 12M6 18 18 6",
  pause: "M8 5v14M16 5v14",
  volume: "M3 9h4l5-5v16l-5-5H3Zm12-1c3 2 3 6 0 8m3-11c5 4 5 10 0 14",
  full: "M3 9V3h6m6 0h6v6m0 6v6h-6M9 21H3v-6",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a8 8 0 0 1 16 0v3",
  bullet: "M9 17V7c0-3 3-5 3-5s3 2 3 5v10ZM9 20h6",
};
const icon = (name, cls = "") =>
  `<svg class="icon-svg ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.target}"/></svg>`;
const btn = (label, action, cls = "", extra = "") =>
  `<button class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
const money = (n) =>
  `<span class="coin">C</span> ${Number(n).toLocaleString()}`;
const initial = {
  name: "PlayerOne",
  coins: 500,
  xp: 0,
  skin: "Default",
  pistol: "Classic",
  trail: "Default",
  emote: "GG",
  banner: "Rookie",
  owned: [
    "Characters:Default",
    "Pistols:Classic",
    "Bullet trails:Default",
    "Emotes:GG",
    "Profile:Rookie",
  ],
  stats: {
    matches: 0,
    wins: 0,
    kills: 0,
    deaths: 0,
    shots: 0,
    hits: 0,
    retrieved: 0,
    dashes: 0,
    melees: 0,
    best: 0,
    minutes: 0,
  },
  settings: {
    master: 0.65,
    music: 0.25,
    sfx: 0.8,
    sensitivity: 1,
    shake: true,
    quality: "high",
    fps: false,
  },
  daily: { day: 0, last: "" },
  missions: { date: "", values: {}, claimed: [] },
  achievements: [],
  tutorial: false,
  rewarded: [],
  friends: [],
  networkToken: "",
};
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem("one-bullet-save") || "{}");
} catch {}
const profile = {
  ...structuredClone(initial),
  ...saved,
  stats: { ...initial.stats, ...saved.stats },
  settings: { ...initial.settings, ...saved.settings },
};
const today = () => new Date().toLocaleDateString("en-CA");
function refreshMissions() {
  if (profile.missions.date !== today())
    profile.missions = { date: today(), values: {}, claimed: [] };
}
refreshMissions();
function save() {
  try {
    localStorage.setItem("one-bullet-save", JSON.stringify(profile));
  } catch {
    toast("Your browser could not save progress. Check storage permissions.");
  }
}
const level = () => 1 + Math.floor(profile.xp / 500),
  xpProgress = () => profile.xp % 500;
let view = "menu",
  game = null,
  myId = "local",
  online = false,
  paused = false,
  scoreboard = false,
  lobby = null,
  kind = "bots",
  socket = null,
  connectPromise = null,
  netState = "idle",
  snapshotAt = 0,
  ping = 0,
  lastPing = 0,
  lastInput = 0,
  lastFrame = performance.now(),
  uiAt = 0,
  accumulator = 0,
  feedback = "",
  feedbackUntil = 0,
  toastTimer,
  selectedCategory = "Characters",
  selectedItem = "Default",
  shop = false,
  leaderRows = [],
  leaderLoading = false,
  leaderError = "",
  leaderMetric = "wins",
  leaderPeriod = "all",
  leaderScope = "global",
  lastReward = { coins: 0, xp: 0 },
  emoteUntil = 0,
  oldFocus = null;
let setup = { difficulty: "normal", mode: "ffa", map: "yard", bots: 7 };
const keys = new Set(),
  pointer = { x: innerWidth / 2, y: innerHeight / 2 },
  actions = { shoot: false, dash: false, melee: false, pickup: false };
const catalog = {
  Characters: Object.keys(SKINS),
  Pistols: [
    "Classic",
    "Goldline",
    "Carbon",
    "Neon",
    "Frost",
    "Crimson",
    "Galaxy",
    "Cyber",
  ],
  "Bullet trails": [
    "Default",
    "Blue Neon",
    "Red Laser",
    "Electric",
    "Fire",
    "Ice",
    "Galaxy",
    "Rainbow",
  ],
  Emotes: ["GG", "Nice shot!", "Salute", "Victory"],
  Profile: ["Rookie", "Sharpshooter", "Bullet Hunter", "Arena Legend"],
};
const fields = {
  Characters: "skin",
  Pistols: "pistol",
  "Bullet trails": "trail",
  Emotes: "emote",
  Profile: "banner",
};
const price = (category, name) =>
  Math.max(0, catalog[category].indexOf(name)) * 125 +
  (catalog[category].indexOf(name) ? 250 : 0);
const owns = (category, name) => profile.owned.includes(`${category}:${name}`);
const missions = [
  {
    id: "kills",
    name: "Make every shot count",
    desc: "Get 5 eliminations",
    goal: 5,
    reward: 200,
    icon: "cross",
  },
  {
    id: "hits",
    name: "Right on target",
    desc: "Land 10 shots",
    goal: 10,
    reward: 175,
    icon: "target",
  },
  {
    id: "retrieved",
    name: "Pick yourself back up",
    desc: "Recover 8 missed bullets",
    goal: 8,
    reward: 150,
    icon: "bullet",
  },
  {
    id: "dashes",
    name: "Stay one step ahead",
    desc: "Dash 20 times",
    goal: 20,
    reward: 150,
    icon: "bolt",
  },
  {
    id: "matches",
    name: "Just one more",
    desc: "Finish 3 matches",
    goal: 3,
    reward: 250,
    icon: "play",
  },
  {
    id: "wins",
    name: "Take the crown",
    desc: "Win a match",
    goal: 1,
    reward: 250,
    icon: "trophy",
  },
];
const achievements = [
  ["first", "First Blood", "Get your first elimination", "kills", 1],
  ["hunter", "Bullet Hunter", "Recover 50 bullets", "retrieved", 50],
  ["dash", "Dash Master", "Dash 100 times", "dashes", 100],
  ["ten", "Rising Champion", "Win 10 matches", "wins", 10],
  ["hundred", "Arena Champion", "Win 100 matches", "wins", 100],
  ["eliminator", "Sharpshooter", "Get 100 eliminations", "kills", 100],
  ["legend", "Arena Legend", "Get 1,000 eliminations", "kills", 1000],
  ["melee", "Close Call", "Land 25 melee hits", "melees", 25],
  ["streak", "Untouchable", "Get a 5 elimination streak", "best", 5],
];
function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 3500);
}
const avatarTag = (skin = profile.skin, size = 80, pistol = profile.pistol) =>
  `<canvas data-avatar="${escape(skin)}" data-pistol="${escape(pistol)}" width="${size}" height="${size}" aria-label="${escape(skin)} character"></canvas>`;
function paintPreviews() {
  document
    .querySelectorAll("[data-avatar]")
    .forEach((c) => avatar(c, c.dataset.avatar, c.dataset.pistol));
  document
    .querySelectorAll("[data-map]")
    .forEach((c) => mapThumb(c, c.dataset.map));
}
function header(title, sub = "ONE BULLET", back = "menu") {
  return `<div class="page-head">${btn(icon("back"), `nav:${back}`, "icon ghost", 'aria-label="Back"')}<div class="heading"><div class="eyebrow">${sub}</div><h2>${title}</h2></div><div class="wallet row">${money(profile.coins)}</div></div>`;
}
function page(title, content, sub, back) {
  return `<main class="page">${header(title, sub, back)}<div class="page-content">${content}</div></main>`;
}
function menu() {
  const nav = [
    ["play", "play", "PLAY"],
    ["loadout", "case", "LOADOUT"],
    ["shop", "shop", "SHOP"],
    ["leaderboard", "trophy", "LEADERBOARD"],
    ["missions", "target", "MISSIONS"],
    ["daily", "gift", "DAILY REWARDS"],
    ["settings", "settings", "SETTINGS"],
  ];
  return `<main class="menu"><header class="topbar"><div class="brand"><i class="brand-mark"></i>ONE <span>BULLET</span></div><div class="row"><div class="wallet row">${money(profile.coins)}</div>${btn(`${avatarTag(profile.skin, 70)}<div><b>${escape(profile.name)}</b><div class="row small muted" style="gap:8px;margin-top:3px"><span>LV. ${level()}</span><div class="progress"><i style="width:${xpProgress() / 5}%"></i></div></div></div>`, "nav:profile", "profile-pill")}${btn(icon("full"), "fullscreen", "icon ghost", 'aria-label="Fullscreen"')}</div></header><nav class="side-nav" aria-label="Main menu">${nav.map(([action, i, label], n) => `${n === 4 ? '<div class="nav-separator"></div>' : ""}${btn(`${icon(i)}${label}${action === "daily" && profile.daily.last !== today() ? '<span class="nav-count">1</span>' : ""}`, `nav:${action}`, `nav-button ${n === 0 ? "selected" : ""}`)}`).join("")}</nav><section class="hero"><div class="eyebrow">ONE SHOT. ENDLESS POSSIBILITIES.</div><h1 class="logo">ONE<span>BULLET</span></h1><p class="hero-subtitle">A small rule. A bigger challenge.</p><p class="hero-description">Land your shot. Get it back.<br>Miss? Go and earn another chance.</p>${btn(`PLAY ${icon("play")}`, "nav:play", "primary big-play")}<div class="match-hint">Quick match · Private rooms · Play vs bots</div><div class="hero-tags"><span>${icon("clock")} 3-minute matches</span><span>${icon("shield")} Skill over everything</span></div><p class="mobile-hint">Best played with a keyboard and mouse.</p></section><aside class="daily-widget"><div class="row"><div class="gift-icon">${icon("gift")}</div><div><h3>Your daily drop</h3><p>${profile.daily.last === today() ? "Collected. See you tomorrow." : "A little something for showing up."}</p></div></div>${btn(profile.daily.last === today() ? "VIEW REWARDS" : "CLAIM REWARD", "nav:daily", profile.daily.last === today() ? "ghost" : "primary")}</aside><div class="character-caption"><b>${escape(profile.skin).toUpperCase()}</b><span>READY FOR THE ARENA</span></div><section class="bottom-strip"><div class="feature-tile"><div class="tile-icon">${icon("bullet")}</div><div><h3>ONE BULLET. MAKE IT COUNT.</h3><p>A hit reloads. A miss changes everything.</p></div></div><div class="feature-tile"><div class="tile-icon">${icon("friends")}</div><div><h3>BETTER WITH RIVALS</h3><p>8 players. One very good reason to aim.</p></div></div><div class="feature-tile"><div class="tile-icon">${icon("trophy")}</div><div><h3>ALL SKILL. NO SHORTCUTS.</h3><p>Every cosmetic. Zero advantage.</p></div></div></section><footer class="footer"><span><i></i>INSTANT PLAY · NO ACCOUNT NEEDED</span><span>WASD MOVE &nbsp; / &nbsp; MOUSE AIM &nbsp; / &nbsp; SPACE DASH</span><span>ONE BULLET &nbsp; V1.0</span></footer></main>`;
}
function playMenu() {
  return page(
    "Choose your arena",
    `<p class="page-intro">One bullet is all you get. How you use it is up to you.</p><div class="cards3">${[
      [
        "globe",
        "Quick match",
        "Play against random online players. Open slots fill with clearly marked bots.",
        "FIND A MATCH",
        "quick",
        "01",
      ],
      [
        "friends",
        "Play with friends",
        "Your friends. Your rules. Create a private room or join with a code.",
        "CREATE OR JOIN",
        "nav:friends",
        "02",
      ],
      [
        "bot",
        "Play vs bots",
        "Get straight into the action. Pick your difficulty and sharpen your aim.",
        "PLAY INSTANTLY",
        "nav:bots",
        "03",
      ],
    ]
      .map(([i, title, desc, cta, a, n]) =>
        btn(
          `<span class="card-num">${n}</span><span class="large-icon">${icon(i)}</span><h3>${title.toUpperCase()}</h3><p>${desc}</p><span class="bottom">${cta}${icon("arrow")}</span>`,
          a,
          "play-card",
        ),
      )
      .join("")}</div><div class="rule-cards">${[
      [
        "01",
        "Spawn with one bullet",
        "Aim with your mouse. Click when it counts.",
      ],
      [
        "02",
        "Hit to get it back",
        "Land a shot and your bullet is instantly restored.",
      ],
      [
        "03",
        "Miss? Make your move.",
        "Retrieve your bullet. Dash and melee to stay alive.",
      ],
    ]
      .map(
        ([n, t, d]) =>
          `<div><span class="step">${n}</span><div><b>${t}</b>${d}</div></div>`,
      )
      .join(
        "",
      )}</div><p class="onboarding-hint">WASD move · Mouse aim · Click shoot · Space dash · F melee · E retrieve</p>`,
    "LET’S PLAY",
  );
}
function selection(key, values, value, disabled = false) {
  return `<select data-setting="${key}" ${disabled ? "disabled" : ""}>${Object.entries(
    values,
  )
    .map(
      ([v, label]) =>
        `<option value="${v}" ${v === String(value) ? "selected" : ""}>${label}</option>`,
    )
    .join("")}</select>`;
}
function setupFields(opts, disabled = false, privateRoom = false) {
  return `<div class="form-grid"><div class="field"><label>Game mode</label>${selection("mode", MODES, opts.mode, disabled)}</div><div class="field"><label>Bot difficulty</label>${selection("difficulty", { easy: "Easy — warm up", normal: "Normal — find your rhythm", hard: "Hard — earn every shot" }, opts.difficulty, disabled)}</div><div class="field"><label>${privateRoom ? "Fill with bots" : "Number of bots"}</label>${selection("bots", Object.fromEntries(Array.from({ length: privateRoom ? 8 : 7 }, (_, i) => [i + (privateRoom ? 0 : 1), `${i + (privateRoom ? 0 : 1)} bots`])), opts.bots, disabled)}</div><div class="field"><label>Match length</label><div class="chip" style="height:46px;width:100%">${icon("clock")} 3 MINUTES</div></div></div><label>Choose a map</label><div class="map-grid">${Object.entries(
    MAPS,
  )
    .map(([key, m]) =>
      btn(
        `<canvas width="240" height="125" data-map="${key}"></canvas><div class="map-label"><b>${m.name}</b>${key === opts.map ? "<small>SELECTED</small>" : ""}</div>`,
        `map:${key}`,
        `map-button ${key === opts.map ? "selected" : ""}`,
        disabled ? "disabled" : "",
      ),
    )
    .join("")}</div>`;
}
function botMenu() {
  return page(
    "Train. Adapt. Outplay.",
    `<div class="two-col"><div class="panel">${setupFields(setup)}<div class="form-actions">${btn(`START MATCH ${icon("arrow")}`, "start-bots", "primary full")}</div></div><aside class="panel"><div class="eyebrow">PLAY VS BOTS</div><h3 style="margin-top:10px">Same rules. Zero waiting.</h3><div class="backdrop-preview">${avatarTag(profile.skin, 220)}</div><p class="muted" style="line-height:1.6;font-size:14px">Bots shoot, recover their own bullets, use cover, dash, and fight for the objective.</p><ul class="bullets-list"><li>100 health · 85 damage per shot</li><li>Dash recharges in 3 seconds</li><li>Melee deals 30 damage and knocks back</li><li>Your missed bullet belongs to you</li><li>Earn coins and XP after the match</li></ul><div class="chip gold">${icon("shield")} COSMETICS NEVER CHANGE STATS</div></aside></div>`,
    "INSTANT ACTION",
    "play",
  );
}
function friendsMenu() {
  return page(
    "Bring your rivals",
    `<p class="page-intro">Share a room code and settle it in the arena.</p><div class="two-col"><section class="panel stack"><div class="large-icon cyan">${icon("friends")}</div><h3>CREATE A PRIVATE ROOM</h3><p class="muted" style="line-height:1.7">Choose the map, set the mode, and invite up to seven friends. Add bots whenever you need more competition.</p>${btn(`CREATE ROOM ${icon("arrow")}`, "create-room", "primary")}</section><section class="panel stack"><h3>HAVE A CODE?</h3><label for="room-input">Five-character room code</label><input id="room-input" placeholder="7K4P2" maxlength="5" autocomplete="off" spellcheck="false" style="text-transform:uppercase;font-size:28px;letter-spacing:8px;text-align:center">${btn("JOIN ROOM", "join-room", "full")}<p class="muted small">Everyone must connect to the same game server.</p></section></div>`,
    "PLAY WITH FRIENDS",
    "play",
  );
}
function lobbyMenu() {
  if (!lobby)
    return page(
      "Connecting…",
      '<div class="scanner">' + icon("globe") + "</div>",
    );
  if (lobby.kind === "public")
    return page(
      "Finding your match",
      `<section class="panel matchmaking"><div class="scanner">${icon("globe")}</div><h2>${lobby.startsIn > 0 ? "ASSEMBLING THE ARENA" : "STARTING MATCH"}</h2><p><b class="cyan">${lobby.players.length} human player${lobby.players.length !== 1 ? "s" : ""} connected</b> / 8 slots<br>${8 - lobby.players.length} bot${8 - lobby.players.length !== 1 ? "s" : ""} will fill the remaining slots.<br>Starting in ${lobby.startsIn} seconds.</p>${btn("CANCEL", "leave-room", "ghost")}</section>`,
      "QUICK MATCH",
      "play",
    );
  const host = lobby.host === myId;
  return page(
    "Your arena. Your rules.",
    `<div class="two-col"><section class="panel"><div class="row between"><div><div class="eyebrow">PRIVATE ROOM CODE</div><div class="room-code">${lobby.code}</div></div>${btn(`${icon("copy")} COPY`, "copy-code", "ghost")}</div><p class="muted small">Share this code with your friends. ${lobby.players.length}/8 players connected.</p><div class="player-list">${lobby.players.map((p) => `<div class="player-slot">${avatarTag(p.skin, 60)}<div><b>${escape(p.name)}</b><small>${p.id === lobby.host ? "HOST" : p.id === myId ? "YOU" : "PLAYER"}${p.connected ? "" : " · reconnecting"}</small></div><span class="ready">${p.ready ? "READY" : p.id === lobby.host ? "★" : ""}</span></div>`).join("")}${Array.from({ length: Math.max(0, 4 - lobby.players.length) }, () => '<div class="player-slot waiting-slot">+ Waiting for a rival</div>').join("")}</div><div class="form-actions">${host ? btn("START MATCH", "start-room", "primary flex") : btn(lobby.players.find((p) => p.id === myId)?.ready ? "NOT READY" : "READY", "ready", "primary flex")}${btn("LEAVE ROOM", "leave-room", "ghost")}</div></section><section class="panel"><h3 style="margin-bottom:20px">MATCH SETTINGS</h3>${setupFields(lobby.options, !host, true)}${!host ? '<p class="muted small" style="margin-top:15px">The host chooses the match settings.</p>' : ""}</section></div>`,
    "PLAY WITH FRIENDS",
    "friends",
  );
}
function cosmeticMenu() {
  const field = fields[selectedCategory],
    equipped = profile[field],
    selected = selectedItem,
    owned = owns(selectedCategory, selected),
    cost = price(selectedCategory, selected);
  const previewSkin =
      selectedCategory === "Characters" ? selected : profile.skin,
    previewPistol = selectedCategory === "Pistols" ? selected : profile.pistol;
  return page(
    shop ? "Look good. Play your way." : "Make it yours.",
    `<div class="tabs">${Object.keys(catalog)
      .map((c) =>
        btn(c, `category:${c}`, c === selectedCategory ? "active" : ""),
      )
      .join(
        "",
      )}</div><div class="cosmetic-layout"><div class="cosmetic-grid">${catalog[
      selectedCategory
    ]
      .map((name) => {
        const isOwned = owns(selectedCategory, name),
          isEquipped = equipped === name;
        return btn(
          `${isEquipped ? '<span class="equipped-check">✓</span>' : ""}${["Characters", "Pistols"].includes(selectedCategory) ? avatarTag(selectedCategory === "Characters" ? name : profile.skin, 120, selectedCategory === "Pistols" ? name : profile.pistol) : `<span class="item-symbol" style="color:${selectedCategory === "Bullet trails" ? ["#ffcf59", "#44bfff", "#ff687d", "#a2eaff", "#ff9547", "#c4edff", "#ba8ff5", "#fb85d3"][catalog[selectedCategory].indexOf(name)] : "var(--gold)"}">${selectedCategory === "Bullet trails" ? "━➤" : selectedCategory === "Emotes" ? (name === "GG" ? "GG" : name === "Nice shot!" ? "◎" : name === "Salute" ? "✦" : "♛") : icon("shield")}</span>`}<h3>${name}</h3><small>${isEquipped ? "EQUIPPED" : isOwned ? "OWNED" : `${costFor(name)} COINS`}</small>`,
          `item:${name}`,
          `cosmetic ${isEquipped ? "equipped" : ""} ${selected === name ? "chosen" : ""}`,
        );
      })
      .join(
        "",
      )}</div><aside class="panel preview-panel"><div class="eyebrow">LOADOUT PREVIEW</div>${avatarTag(previewSkin, 230, previewPistol)}<h3>${selected}</h3><div class="rarity">${cost > 1000 ? "Legendary" : cost > 600 ? "Epic" : cost ? "Rare" : "Classic"} ${selectedCategory === "Characters" ? "fighter" : selectedCategory.toLowerCase()}</div><p>${selectedCategory === "Bullet trails" ? "A signature streak for every shot." : selectedCategory === "Emotes" ? "Press G in a safe moment to express yourself." : selectedCategory === "Profile" ? "Your title, shown on your profile." : "A fresh look for your next clutch."}<br>Same bullet. Same chance.</p>${owned ? btn(equipped === selected ? "EQUIPPED" : "EQUIP", `equip`, equipped === selected ? "ghost full" : "primary full", equipped === selected ? "disabled" : "") : btn(`${money(cost)} UNLOCK`, "purchase", "primary full", profile.coins < cost ? "disabled" : "")}<p class="small" style="margin-bottom:0">${!owned && profile.coins < cost ? "Play matches to earn more coins." : "Every item is cosmetic only."}</p></aside></div>`,
    shop ? "COSMETIC SHOP" : "YOUR LOADOUT",
  );
}
function costFor(name) {
  return price(selectedCategory, name);
}
function profileMenu() {
  const s = profile.stats;
  return page(
    "Your story so far",
    `<div class="panel"><div class="profile-large">${avatarTag(profile.skin, 140)}<div><div class="eyebrow">${escape(profile.banner)}</div><h3>${escape(profile.name)}</h3><div class="row small muted" style="margin-top:8px">LEVEL ${level()} · ${xpProgress()}/500 XP</div><div class="progress"><i style="width:${xpProgress() / 5}%"></i></div></div></div><div class="row" style="max-width:470px;margin-bottom:25px"><input id="name-input" aria-label="Player name" value="${escape(profile.name)}" maxlength="18">${btn("SAVE NAME", "save-name")}</div><div class="stats-grid">${[
      ["Matches played", s.matches],
      ["Wins", s.wins],
      ["Eliminations", s.kills],
      ["Deaths", s.deaths],
      ["Accuracy", s.shots ? `${Math.round((s.hits / s.shots) * 100)}%` : "—"],
      ["Best streak", s.best],
      ["Shots fired", s.shots],
      ["Bullets recovered", s.retrieved],
      ["Minutes played", Math.round(s.minutes)],
    ]
      .map(
        ([name, v]) =>
          `<div class="stat"><strong>${v}</strong><span>${name}</span></div>`,
      )
      .join(
        "",
      )}</div><p class="muted small" style="margin-top:20px">Progress is saved on this browser. Online leaderboard scores are verified by the game server.</p></div>`,
    "PLAYER PROFILE",
  );
}
function missionsMenu() {
  refreshMissions();
  return page(
    "A little extra motivation",
    `<div class="two-col"><section><h3 style="margin-bottom:18px">DAILY MISSIONS</h3><div class="missions-list">${missions
      .map((m) => {
        const n = profile.missions.values[m.id] || 0,
          done = profile.missions.claimed.includes(m.id);
        return `<div class="mission"><span class="mission-icon">${icon(m.icon)}</span><div class="flex"><h3>${m.name}</h3><small>${m.desc} · ${Math.min(n, m.goal)}/${m.goal}</small><div class="progress"><i style="width:${Math.min(100, (n / m.goal) * 100)}%"></i></div></div>${btn(done ? "CLAIMED" : `${money(m.reward)}`, `claim-mission:${m.id}`, n >= m.goal && !done ? "primary" : "ghost", n < m.goal || done ? "disabled" : "")}</div>`;
      })
      .join(
        "",
      )}</div></section><section class="panel"><h3>ACHIEVEMENTS</h3><p class="muted small" style="margin:8px 0 20px">Milestones worth 100 coins each.</p><div class="stack">${achievements.map(([id, n, d, key, goal]) => `<div class="row"><span class="${profile.achievements.includes(id) ? "gold" : "muted"}">${icon(profile.achievements.includes(id) ? "trophy" : "shield")}</span><div class="flex"><b style="font-size:14px">${n}</b><p class="muted small" style="margin-top:4px">${d}</p></div><small class="muted">${profile.achievements.includes(id) ? "✓" : Math.min(profile.stats[key], goal) + "/" + goal}</small></div>`).join("")}</div></section></div>`,
    "MISSIONS & ACHIEVEMENTS",
  );
}
const dailyRewards = [100, 150, 250, 200, 250, 350, "Galaxy"];
function dailyMenu() {
  const claimed = profile.daily.last === today(),
    day = profile.daily.day % 7;
  return page(
    "Good to see you again",
    `<section class="panel"><div class="row between"><div><div class="eyebrow">YOUR DAILY DROP</div><h3 style="margin-top:8px">Seven visits. Seven reasons to return.</h3></div><span class="gold">${icon("gift")}</span></div><p class="muted" style="margin-top:15px;line-height:1.6">Claim a free reward each day. Miss a day? Your track stays right where you left it.</p><div class="reward-track">${dailyRewards.map((r, i) => `<div class="reward-day ${i === day && !claimed ? "current" : ""}"><div class="eyebrow" style="font-size:10px">DAY ${i + 1}</div><div class="reward-icon gold">${typeof r === "number" ? "◉" : "✦"}</div><b>${typeof r === "number" ? r + " COINS" : "GALAXY SKIN"}</b><small>${i === day && !claimed ? "READY TO CLAIM" : i < day ? "✓ COLLECTED" : i === 6 ? "LEGENDARY COSMETIC" : "FREE REWARD"}</small></div>`).join("")}</div>${btn(claimed ? "COLLECTED — COME BACK TOMORROW" : `CLAIM DAY ${day + 1} REWARD`, "claim-daily", "primary", claimed ? "disabled" : "")}<p class="muted small" style="margin-top:17px">Cosmetics only. No streak resets. No ads required.</p></section>`,
    "DAILY REWARDS",
  );
}
function controls() {
  return `<div class="controls-list">${[
    ["W A S D", "Move"],
    ["MOUSE", "Aim"],
    ["LEFT CLICK", "Shoot"],
    ["SPACE", "Dash"],
    ["E", "Pick up your bullet"],
    ["F", "Melee · knockback"],
    ["TAB", "Scoreboard"],
    ["G", "Emote"],
    ["ESC", "Pause / settings"],
  ]
    .map(
      ([k, d]) =>
        `<div class="control"><div>${k
          .split(k === "W A S D" ? " " : "|")
          .map((a) => `<kbd>${a}</kbd>`)
          .join("")}</div><span>${d}</span></div>`,
    )
    .join("")}</div>`;
}
function settingsMenu() {
  return page(
    "Dial it in",
    `<div class="settings-grid"><section class="panel"><h3 style="margin-bottom:25px">SOUND & DISPLAY</h3>${[
      ["master", "Master volume"],
      ["music", "Music volume"],
      ["sfx", "Sound effects"],
    ]
      .map(
        ([k, t]) =>
          `<div class="setting"><label>${t}<span id="value-${k}">${Math.round(profile.settings[k] * 100)}%</span></label><input aria-label="${t}" data-pref="${k}" type="range" min="0" max="1" step="0.05" value="${profile.settings[k]}"></div>`,
      )
      .join(
        "",
      )}<div class="setting"><label>Screen shake<input type="checkbox" data-pref="shake" ${profile.settings.shake ? "checked" : ""}></label></div><div class="setting"><label>Show FPS<input type="checkbox" data-pref="fps" ${profile.settings.fps ? "checked" : ""}></label></div><div class="setting"><label>Graphics quality</label><select data-pref="quality"><option value="high" ${profile.settings.quality === "high" ? "selected" : ""}>High</option><option value="low" ${profile.settings.quality === "low" ? "selected" : ""}>Low — fewer particles</option></select></div>${btn(`${icon("full")} TOGGLE FULLSCREEN`, "fullscreen", "full ghost")}</section><section class="panel"><h3 style="margin-bottom:22px">CONTROLS</h3>${controls()}<div class="rule"></div><label>Aim guide sensitivity <span id="value-sensitivity">${profile.settings.sensitivity}×</span></label><input aria-label="Aim guide sensitivity" type="range" min="0.5" max="1.5" step="0.1" data-pref="sensitivity" value="${profile.settings.sensitivity}"><p class="muted small" style="line-height:1.6;margin-top:12px">Adjusts the aiming reticle’s distance from your fighter. Movement and shot accuracy stay consistent.</p></section></div>`,
    "SETTINGS",
  );
}
function leaderboardMenu() {
  let rows = leaderRows;
  if (leaderScope === "friends")
    rows = rows.filter((r) => r.id === myId || profile.friends.includes(r.id));
  return page(
    "Earn your place",
    `<div class="row between" style="margin-bottom:22px;flex-wrap:wrap"><div class="segmented">${[
      ["global", "Global"],
      ["friends", "Friends"],
    ]
      .map(([k, t]) =>
        btn(t, `leader-scope:${k}`, leaderScope === k ? "active" : ""),
      )
      .join(
        "",
      )}</div><div class="row"><select aria-label="Leaderboard category" data-leader="metric">${[
      ["wins", "Wins"],
      ["kills", "Eliminations"],
      ["accuracy", "Accuracy"],
      ["best", "Best streak"],
      ["matches", "Matches"],
    ]
      .map(
        ([k, n]) =>
          `<option value="${k}" ${leaderMetric === k ? "selected" : ""}>${n}</option>`,
      )
      .join(
        "",
      )}</select><select aria-label="Leaderboard period" data-leader="period"><option value="all" ${leaderPeriod === "all" ? "selected" : ""}>All time</option><option value="week" ${leaderPeriod === "week" ? "selected" : ""}>This week</option></select></div></div><div class="table-wrap">${leaderLoading ? '<div class="empty">Loading verified scores…</div>' : leaderError ? `<div class="empty">${escape(leaderError)}<br>${btn("TRY AGAIN", "refresh-board", "ghost")}</div>` : rows.length ? `<table><thead><tr><th>Rank</th><th>Player</th><th>Wins</th><th>Eliminations</th><th>Accuracy</th><th>Best streak</th></tr></thead><tbody>${rows.map((r, i) => `<tr class="${r.id === myId ? "you" : ""}"><td class="gold">${String(i + 1).padStart(2, "0")}</td><td><b>${escape(r.name)}</b></td><td>${r.wins}</td><td>${r.kills}</td><td>${r.accuracy}%</td><td>${r.best}</td></tr>`).join("")}</tbody></table>` : '<div class="empty">The arena is waiting for its first champion.<br>Complete an online match to post a verified score.</div>'}</div><p class="muted small" style="margin-top:17px">${leaderScope === "friends" ? "Friends includes players you have shared a private lobby with." : "Scores from real completed online matches on this server. Bot practice stays in your personal profile."}</p>`,
    "LEADERBOARD",
  );
}
function scoreTable(g) {
  return `<div class="table-wrap"><table><thead><tr><th>Player</th><th>K</th><th>D</th><th>Score</th></tr></thead><tbody>${ranking(
    g,
  )
    .map(
      (p, i) =>
        `<tr class="${p.id === myId ? "you" : ""}"><td><span style="color:${g.mode === "ffa" ? p.color : p.team === 0 ? "var(--cyan)" : "#ff7182"}">${String(i + 1).padStart(2, "0")} &nbsp;</span>${escape(p.name)}${p.id === myId ? ' <small class="cyan">YOU</small>' : ""}</td><td>${p.stats.kills}</td><td>${p.stats.deaths}</td><td>${Math.floor(p.stats.score)}</td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}
function resultsMenu() {
  const me = game?.players.find((p) => p.id === myId);
  if (!me) return menu();
  const s = me.stats,
    win = won(game, me),
    place = ranking(game).findIndex((p) => p.id === myId) + 1;
  return page(
    "Match complete",
    `<div class="results-header"><div class="eyebrow">${MODES[game.mode]} · ${MAPS[game.map].name}</div><h1>${win ? "VICTORY!" : "NEXT SHOT. NEW CHANCE."}</h1><p>${game.mode === "ffa" ? `You placed #${place} of ${game.players.length}` : `${win ? "Your team takes the win" : "Your team fought hard"} · Blue ${Math.floor(game.teamScore[0])} : ${Math.floor(game.teamScore[1])} Red`}</p></div><div class="results-layout"><section class="panel"><div class="result-stats">${[
      ["Eliminations", s.kills],
      ["Deaths", s.deaths],
      ["Accuracy", s.shots ? Math.round((s.hits / s.shots) * 100) + "%" : "—"],
      ["Shots hit / fired", s.hits + " / " + s.shots],
      ["Bullets recovered", s.retrieved],
      ["Best streak", s.best],
    ]
      .map(
        ([t, n]) =>
          `<div class="stat"><strong>${n}</strong><span>${t}</span></div>`,
      )
      .join(
        "",
      )}</div><div class="reward-summary"><div><strong>+${lastReward.coins}</strong><span>COINS EARNED</span></div><div><strong>+${lastReward.xp}</strong><span>XP EARNED</span></div></div><div class="row between small muted"><span>LEVEL ${level()}</span><span>${xpProgress()} / 500 XP</span></div><div class="progress" style="margin-top:10px"><i style="width:${xpProgress() / 5}%"></i></div><p class="small muted" style="margin-top:16px">Daily missions updated. ${profile.missions.claimed.length}/${missions.length} rewards claimed.</p></section><section>${scoreTable(game)}<div class="form-actions">${btn(online && kind === "private" ? "RETURN TO LOBBY" : "PLAY AGAIN", "again", "primary flex")}${btn("MAIN MENU", "end-menu", "ghost")}</div></section></div>`,
    "THE FINAL SCORE",
  );
}
function render() {
  platform.gameplay(view === "game" && !paused);
  canvas.style.display = view === "game" ? "block" : "none";
  document.body.style.overflow = view === "game" ? "hidden" : "";
  const content = {
    menu,
    play: playMenu,
    bots: botMenu,
    friends: friendsMenu,
    lobby: lobbyMenu,
    loadout: cosmeticMenu,
    shop: cosmeticMenu,
    profile: profileMenu,
    missions: missionsMenu,
    daily: dailyMenu,
    settings: settingsMenu,
    leaderboard: leaderboardMenu,
    results: resultsMenu,
    connecting: () =>
      page(
        "Connecting to the arena",
        `<div class="matchmaking"><div class="scanner">${icon("globe")}</div><p>Opening a secure game connection…</p>${btn("CANCEL", "cancel-connect", "ghost")}</div>`,
      ),
    error: () =>
      page(
        "Connection lost",
        `<section class="panel connection-message">${icon("globe")}<h2>LET’S GET YOU BACK IN</h2><p>${escape(netState)}</p><div class="row">${btn("RECONNECT", "reconnect", "primary flex")}${btn("MAIN MENU", "disconnect-menu", "ghost flex")}</div></section>`,
      ),
  };
  if (view === "game") renderGame();
  else {
    app.innerHTML = (content[view] || menu)();
    paintPreviews();
  }
  document.title =
    view === "game"
      ? "ONE BULLET — In the arena"
      : "ONE BULLET — Every shot matters";
}
function navigate(next) {
  if (view === "game") return;
  view = next;
  shop = next === "shop";
  if (["shop", "loadout"].includes(next)) {
    selectedCategory = "Characters";
    selectedItem = profile.skin;
  }
  render();
  if (next === "leaderboard") loadBoard();
}
function feedbackText(t) {
  feedback = t;
  feedbackUntil = performance.now() + 1100;
}
function me() {
  return game?.players.find((p) => p.id === myId);
}
function renderGame() {
  platform.gameplay(view === "game" && !paused);
  const p = me();
  if (!p) return;
  const remaining = Math.max(
      0,
      Math.ceil(game.duration - Math.max(0, game.time - 3)),
    ),
    time = `${Math.floor(remaining / 60)
      .toString()
      .padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;
  const recent = game.events
    .filter((e) => e.type === "kill" && game.time - e.t < 6)
    .slice(-4);
  const tutorialIndex = Math.floor(Math.max(0, game.time - 3) / 6),
    tutorials = [
      [
        "YOU ONLY HAVE ONE BULLET",
        "Aim with your mouse. Left click to take the shot.",
      ],
      ["A HIT GIVES IT BACK", "Land a shot to instantly restore your bullet."],
      [
        "MISS? GO GET YOUR BULLET",
        "Follow the gold marker. Walk over it or press E nearby.",
      ],
      [
        "STAY ONE STEP AHEAD",
        "Space to dash. F to melee and create some room.",
      ],
    ];
  if (tutorialIndex >= 4 && !profile.tutorial) {
    profile.tutorial = true;
    save();
  }
  app.innerHTML = `<div class="game-ui"><div class="hud-top"><div class="health-panel"><div class="name">${escape(p.name)} <small class="cyan">${game.mode !== "ffa" ? (p.team === 0 ? "BLUE" : "RED") : "YOU"}</small></div><div class="hp-bar"><i style="width:${p.hp}%"></i></div><div class="hp-label"><span>${p.hp} / 100 HP</span><span>${p.stats.kills} K &nbsp; ${p.stats.deaths} D</span></div></div><div class="timer-panel">${game.mode !== "ffa" ? `<div class="team-score"><b>${Math.floor(game.teamScore[0])}</b><span class="timer ${remaining < 11 ? "urgent" : ""}">${time}</span><b>${Math.floor(game.teamScore[1])}</b></div>` : `<div class="timer ${remaining < 11 ? "urgent" : ""}">${time}</div>`}<small>${MODES[game.mode].toUpperCase()}</small></div><div class="hud-right">${btn(icon("pause"), "pause", "icon", 'aria-label="Pause"')}<div class="meta">${online ? `${ping} MS · ONLINE` : `${setup.difficulty.toUpperCase()} BOTS`} · ${MAPS[game.map].name}</div><div class="killfeed">${recent.map((e) => `<div><b>${escape(e.killer)}</b> &nbsp; ▸ &nbsp; ${escape(e.victim)}</div>`).join("")}</div></div></div><div class="ammo-hud ${p.ammo ? "" : "empty-ammo"}"><i class="bullet-glyph"></i><strong class="ammo-number">${p.ammo}</strong><div><div class="ammo-label">${p.ammo ? "MAKE IT COUNT" : "RECOVER YOUR BULLET"}</div><div class="ammo-sub">${p.ammo ? "LEFT CLICK TO SHOOT" : game.bullets.some((b) => b.owner === p.id) ? "SHOT IN FLIGHT" : "WALK OVER IT · E TO PICK UP"}</div></div></div><div class="dash-hud"><kbd>SPACE</kbd><div><small>${p.dash > 0 ? `DASH · ${p.dash.toFixed(1)}s` : "DASH READY"}</small><div class="progress"><i style="width:${(1 - p.dash / 3) * 100}%"></i></div></div></div><div class="game-controls"><kbd>W A S D</kbd> MOVE &nbsp; <kbd>F</kbd> MELEE<br><kbd>TAB</kbd> SCORE &nbsp; <kbd>G</kbd> EMOTE</div>${game.countdown > 0 ? `<div class="match-center"><div class="countdown">${Math.ceil(game.countdown)}</div><div class="countdown-label">MAKE YOUR SHOT COUNT</div></div>` : p.dead ? `<div class="match-center"><div class="countdown" style="font-size:65px">BACK IN ${Math.ceil(p.dead)}</div><div class="countdown-label">A FRESH BULLET. A FRESH CHANCE.</div></div>` : ""}${performance.now() < feedbackUntil ? `<div class="feedback">${feedback}</div>` : ""}${!profile.tutorial && tutorials[tutorialIndex] && !paused && !game.countdown ? `<div class="tutorial"><b>${tutorials[tutorialIndex][0]}</b><span>${tutorials[tutorialIndex][1]}</span>${btn("SKIP", "skip-tutorial")}</div>` : ""}${emoteUntil > performance.now() ? `<div class="emote-bubble">${escape(profile.emote)}</div>` : ""}${scoreboard ? `<div class="overlay"><div class="panel score-panel"><h3 style="margin-bottom:15px">SCOREBOARD</h3>${scoreTable(game)}<p class="muted small" style="margin-top:12px">Release TAB to return.</p></div></div>` : ""}${paused ? `<div class="overlay" role="dialog" aria-label="Pause menu"><div class="panel"><div class="eyebrow">${online ? "ONLINE MATCH CONTINUES" : "TAKE A BREATHER"}</div><h2 class="pause-title">${online ? "IN-MATCH MENU" : "PAUSED"}</h2><div class="stack">${btn("RESUME", "resume", "primary")}${btn(profile.settings.master ? "MUTE AUDIO" : "UNMUTE AUDIO", "mute", "ghost")}${btn(profile.settings.shake ? "SCREEN SHAKE: ON" : "SCREEN SHAKE: OFF", "toggle-shake", "ghost")}${btn("LEAVE MATCH", "leave-match", "danger ghost")}</div><div class="rule"></div>${controls()}</div></div>` : ""}</div>`;
}
function startBots() {
  kind = "bots";
  online = false;
  myId = "local";
  game = createGame(setup);
  addPlayer(game, {
    id: myId,
    name: profile.name,
    skin: profile.skin,
    pistol: profile.pistol,
    trail: profile.trail,
    emote: profile.emote,
    banner: profile.banner,
  });
  for (let i = 0; i < setup.bots; i++)
    addPlayer(game, {
      name: `${["Rex", "Nova", "Shadow", "Blaze", "Echo", "Ghost", "Pixel"][i]} · BOT`,
      bot: true,
      skin: Object.keys(SKINS)[i + 1],
    });
  beginGame();
}
function beginGame() {
  paused = false;
  scoreboard = false;
  keys.clear();
  Object.keys(actions).forEach((k) => (actions[k] = false));
  view = "game";
  renderer.reset();
  accumulator = 0;
  render();
  sound("start");
}
function finish() {
  if (view === "results") return;
  const p = me();
  if (!p) return;
  const win = won(game, p);
  lastReward = {
    coins: 100 + p.stats.kills * 15 + (win ? 100 : 0),
    xp: 150 + p.stats.kills * 20 + (win ? 150 : 0),
  };
  if (!profile.rewarded.includes(game.matchId)) {
    profile.rewarded.push(game.matchId);
    profile.rewarded = profile.rewarded.slice(-100);
    profile.coins += lastReward.coins;
    const before = level();
    profile.xp += lastReward.xp;
    if (level() > before) {
      profile.coins += 100 * (level() - before);
      toast(`Level ${level()}! +${100 * (level() - before)} bonus coins.`);
    }
    refreshMissions();
    for (const k of [
      "kills",
      "deaths",
      "shots",
      "hits",
      "retrieved",
      "dashes",
      "melees",
    ]) {
      profile.stats[k] += p.stats[k];
      profile.missions.values[k] =
        (profile.missions.values[k] || 0) + p.stats[k];
    }
    profile.stats.matches++;
    profile.stats.wins += Number(win);
    profile.stats.best = Math.max(profile.stats.best, p.stats.best);
    profile.stats.minutes += game.duration / 60;
    profile.missions.values.matches =
      (profile.missions.values.matches || 0) + 1;
    profile.missions.values.wins =
      (profile.missions.values.wins || 0) + Number(win);
    for (const [id, name, desc, key, goal] of achievements)
      if (profile.stats[key] >= goal && !profile.achievements.includes(id)) {
        profile.achievements.push(id);
        profile.coins += 100;
        toast(`${name} unlocked! +100 coins.`);
      }
    save();
  }
  view = "results";
  paused = false;
  keys.clear();
  render();
  sound(win ? "victory" : "defeat");
  if (win) platform.celebrate();
}
function connectionUrl() {
  const base = window.ONE_BULLET_SERVER || location.origin;
  return base.replace(/^http/, "ws").replace(/\/$/, "");
}
function networkSend(data) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
}
let intentionalClose = false;
function connect() {
  if (socket?.readyState === WebSocket.OPEN && myId !== "local")
    return Promise.resolve();
  if (connectPromise) return connectPromise;
  intentionalClose = false;
  connectPromise = new Promise((resolve, reject) => {
    let greeted = false;
    try {
      socket = new WebSocket(connectionUrl());
    } catch {
      reject(Error("The game server address is invalid."));
      return;
    }
    const ws = socket;
    const timeout = setTimeout(() => {
      reject(
        Error(
          "The game server is not responding. You can still play against bots.",
        ),
      );
      ws.close();
    }, 8000);
    ws.addEventListener("open", () =>
      networkSend({
        type: "hello",
        version: VERSION,
        token: profile.networkToken,
        name: profile.name,
        skin: profile.skin,
        pistol: profile.pistol,
        trail: profile.trail,
        emote: profile.emote,
        banner: profile.banner,
      }),
    );
    ws.addEventListener("message", (e) => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.type === "hello") {
        clearTimeout(timeout);
        greeted = true;
        myId = m.id;
        profile.networkToken = m.token;
        save();
        netState = "connected";
        resolve();
      }
      if (m.type === "lobby") {
        lobby = m.lobby;
        platform.room(lobby);
        if (lobby.kind === "private") {
          for (const p of lobby.players)
            if (p.id !== myId && !profile.friends.includes(p.id))
              profile.friends.push(p.id);
          save();
        }
        if (
          m.lobby.status === "lobby" &&
          ["lobby", "connecting", "results"].includes(view)
        ) {
          view = "lobby";
          render();
        } else if (view === "lobby") render();
      }
      if (m.type === "start") {
        if (lobby) {
          lobby.status = "playing";
          platform.room(lobby);
        }
        game = m.state;
        online = true;
        kind = m.kind;
        snapshotAt = performance.now();
        beginGame();
        if (game.ended) finish();
      }
      if (m.type === "state" && online) {
        game = m.state;
        snapshotAt = performance.now();
        if (game.ended) finish();
      }
      if (m.type === "left") {
        lobby = null;
        platform.room(null);
        if (kind !== "bots" && ["game", "lobby", "connecting"].includes(view)) {
          online = false;
          game = null;
          view = "play";
          render();
        }
      }
      if (m.type === "error") {
        toast(m.message);
        if (view === "connecting") {
          view = "friends";
          render();
        }
        if (!greeted) {
          clearTimeout(timeout);
          reject(Error(m.message));
        }
      }
      if (m.type === "pong") ping = Math.round(performance.now() - m.time);
    });
    ws.addEventListener("close", () => {
      clearTimeout(timeout);
      connectPromise = null;
      if (!greeted)
        reject(
          Error(
            "Could not reach the game server. Start the server or choose Play vs bots.",
          ),
        );
      if (
        !intentionalClose &&
        ["game", "lobby"].includes(view) &&
        kind !== "bots"
      ) {
        netState =
          "Your connection was interrupted. Reconnect within 30 seconds to rejoin your match.";
        view = "error";
        keys.clear();
        render();
      }
    });
    ws.addEventListener("error", () => {
      if (!greeted) {
        clearTimeout(timeout);
        reject(
          Error(
            "The online server is unavailable. Bot matches are available instantly.",
          ),
        );
      }
    });
  }).finally(() => (connectPromise = null));
  return connectPromise;
}
async function onlineAction(type, extra = {}) {
  view = "connecting";
  kind = type === "quick" ? "public" : "private";
  render();
  try {
    await connect();
    if (view !== "connecting") return;
    networkSend({
      type: "profile",
      name: profile.name,
      skin: profile.skin,
      pistol: profile.pistol,
      trail: profile.trail,
      emote: profile.emote,
      banner: profile.banner,
    });
    networkSend({ type, options: setup, ...extra });
  } catch (e) {
    netState = e.message;
    view = "error";
    render();
  }
}
async function loadBoard() {
  leaderLoading = true;
  leaderError = "";
  if (view === "leaderboard") render();
  try {
    const url =
      (window.ONE_BULLET_SERVER || "") +
      `/api/leaderboard?metric=${leaderMetric}&period=${leaderPeriod}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw Error();
    leaderRows = await response.json();
  } catch {
    leaderError =
      "The leaderboard server is unavailable. Your personal progress is saved.";
  }
  leaderLoading = false;
  if (view === "leaderboard") render();
}
function leaveMatch() {
  if (online) networkSend({ type: "leave" });
  online = false;
  game = null;
  paused = false;
  keys.clear();
  view = "menu";
  render();
}
async function action(a) {
  audioInit();
  sound("ui");
  if (a.startsWith("nav:")) {
    const target = a.slice(4);
    if (view === "lobby") {
      networkSend({ type: "leave" });
      lobby = null;
    }
    navigate(target);
    return;
  }
  if (a.startsWith("map:")) {
    const key = a.slice(4);
    if (view === "lobby") {
      networkSend({ type: "options", options: { ...lobby.options, map: key } });
    } else {
      setup.map = key;
      render();
    }
    return;
  }
  if (a.startsWith("category:")) {
    selectedCategory = a.slice(9);
    selectedItem = profile[fields[selectedCategory]];
    render();
    return;
  }
  if (a.startsWith("item:")) {
    selectedItem = a.slice(5);
    render();
    return;
  }
  if (a.startsWith("claim-mission:")) {
    const id = a.slice(14),
      m = missions.find((m) => m.id === id);
    refreshMissions();
    if (
      m &&
      (profile.missions.values[id] || 0) >= m.goal &&
      !profile.missions.claimed.includes(id)
    ) {
      profile.missions.claimed.push(id);
      profile.coins += m.reward;
      save();
      sound("reward");
      toast(`Mission complete! +${m.reward} coins.`);
      render();
    }
    return;
  }
  if (a.startsWith("leader-scope:")) {
    leaderScope = a.slice(13);
    render();
    return;
  }
  switch (a) {
    case "quick":
      onlineAction("quick");
      break;
    case "create-room":
      onlineAction("create");
      break;
    case "join-room": {
      const code = $("#room-input").value.trim().toUpperCase();
      if (!/^[A-Z0-9]{5}$/.test(code)) {
        toast("Enter a five-character room code.");
        return;
      }
      onlineAction("join", { code });
      break;
    }
    case "start-bots":
      if (socket?.readyState === 1) networkSend({ type: "leave" });
      startBots();
      break;
    case "start-room":
      networkSend({ type: "start" });
      break;
    case "ready":
      networkSend({ type: "ready" });
      break;
    case "leave-room":
      networkSend({ type: "leave" });
      view = "play";
      render();
      break;
    case "copy-code":
      try {
        await navigator.clipboard.writeText(lobby.code);
        toast("Room code copied. Invite your rivals.");
      } catch {
        toast(`Room code: ${lobby.code}`);
      }
      break;
    case "purchase": {
      const cost = price(selectedCategory, selectedItem);
      if (owns(selectedCategory, selectedItem) || profile.coins < cost) return;
      profile.coins -= cost;
      profile.owned.push(`${selectedCategory}:${selectedItem}`);
      profile[fields[selectedCategory]] = selectedItem;
      save();
      sound("reward");
      toast(`${selectedItem} unlocked and equipped.`);
      render();
      break;
    }
    case "equip":
      if (owns(selectedCategory, selectedItem)) {
        profile[fields[selectedCategory]] = selectedItem;
        save();
        render();
      }
      break;
    case "claim-daily": {
      if (profile.daily.last === today()) return;
      const reward = dailyRewards[profile.daily.day % 7];
      if (typeof reward === "number") profile.coins += reward;
      else if (!owns("Characters", reward))
        profile.owned.push(`Characters:${reward}`);
      else profile.coins += 500;
      profile.daily.day++;
      profile.daily.last = today();
      save();
      sound("reward");
      toast(
        typeof reward === "number"
          ? `+${reward} coins. See you tomorrow!`
          : "Galaxy reward claimed!",
      );
      render();
      break;
    }
    case "save-name":
      profile.name =
        $("#name-input")
          .value.replace(/[<>\x00-\x1f]/g, "")
          .trim()
          .slice(0, 18) || "PlayerOne";
      save();
      if (socket) {
        intentionalClose = true;
        socket.close();
      }
      toast("Player name saved.");
      render();
      break;
    case "fullscreen":
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch {
        toast("Fullscreen is unavailable in this browser view.");
      }
      break;
    case "pause":
      paused = true;
      keys.clear();
      renderGame();
      break;
    case "resume":
      paused = false;
      keys.clear();
      renderGame();
      break;
    case "leave-match":
      leaveMatch();
      break;
    case "mute":
      profile.settings.master = profile.settings.master ? 0 : 0.65;
      save();
      renderGame();
      break;
    case "toggle-shake":
      profile.settings.shake = !profile.settings.shake;
      save();
      renderGame();
      break;
    case "skip-tutorial":
      profile.tutorial = true;
      save();
      renderGame();
      break;
    case "again":
      if (online) {
        view = "lobby";
        networkSend({ type: "return" });
        render();
      } else startBots();
      break;
    case "end-menu":
      if (online) networkSend({ type: "leave" });
      game = null;
      online = false;
      view = "menu";
      render();
      break;
    case "reconnect":
      view = "connecting";
      render();
      try {
        await connect();
        if (view === "connecting") {
          view = lobby ? "lobby" : "play";
          render();
        }
      } catch (e) {
        netState = e.message;
        view = "error";
        render();
      }
      break;
    case "disconnect-menu":
    case "cancel-connect":
      intentionalClose = true;
      if (socket) socket.close();
      socket = null;
      lobby = null;
      online = false;
      game = null;
      view = "menu";
      render();
      break;
    case "refresh-board":
      loadBoard();
      break;
  }
}
app.addEventListener("click", (e) => {
  const button = e.target.closest("[data-action]");
  if (button && !button.disabled) action(button.dataset.action);
});
app.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.setting) {
    const key = t.dataset.setting,
      value = key === "bots" ? Number(t.value) : t.value;
    if (view === "lobby")
      networkSend({
        type: "options",
        options: { ...lobby.options, [key]: value },
      });
    else setup[key] = value;
  }
  if (t.dataset.leader) {
    if (t.dataset.leader === "metric") leaderMetric = t.value;
    else leaderPeriod = t.value;
    loadBoard();
  }
  if (t.dataset.pref) {
    profile.settings[t.dataset.pref] =
      t.type === "checkbox"
        ? t.checked
        : t.type === "range"
          ? Number(t.value)
          : t.value;
    save();
  }
});
app.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.pref && t.type === "range") {
    const k = t.dataset.pref;
    profile.settings[k] = Number(t.value);
    const label = $(`#value-${k}`);
    if (label)
      label.textContent =
        k === "sensitivity" ? t.value + "×" : Math.round(t.value * 100) + "%";
    save();
  }
});
window.addEventListener("pointermove", (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});
window.addEventListener("pointerdown", (e) => {
  if (view !== "game" || paused || e.button !== 0 || e.target.closest("button"))
    return;
  audioInit();
  if (me()?.ammo) actions.shoot = true;
  else {
    feedbackText("NO BULLET — GO GET IT");
    sound("empty");
  }
});
window.addEventListener("contextmenu", (e) => {
  if (view === "game") e.preventDefault();
});
window.addEventListener("keydown", (e) => {
  if (
    ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)
  ) {
    if (e.key === "Enter" && view === "friends") action("join-room");
    return;
  }
  if (view !== "game") return;
  if (
    [
      "Space",
      "Tab",
      "Escape",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(e.code)
  )
    e.preventDefault();
  if (e.code === "Escape" && !e.repeat) {
    paused = !paused;
    keys.clear();
    renderGame();
    return;
  }
  if (e.code === "Tab") {
    scoreboard = true;
    renderGame();
    return;
  }
  if (paused) return;
  keys.add(e.code);
  if (!e.repeat) {
    if (e.code === "Space") actions.dash = true;
    if (e.code === "KeyF") actions.melee = true;
    if (e.code === "KeyE") actions.pickup = true;
    if (e.code === "KeyG") {
      actions.emote = true;
      renderGame();
    }
  }
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "Tab") {
    scoreboard = false;
    if (view === "game") renderGame();
  }
});
window.addEventListener("blur", () => {
  keys.clear();
  Object.keys(actions).forEach((k) => (actions[k] = false));
  scoreboard = false;
  if (view === "game" && !online) {
    paused = true;
    renderGame();
  }
});
function input() {
  const p = me(),
    target = renderer.world(pointer.x, pointer.y),
    dx =
      (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
      (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
    dy =
      (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) -
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
  return {
    x: paused ? 0 : dx,
    y: paused ? 0 : dy,
    angle: p ? Math.atan2(target.y - p.y, target.x - p.x) : 0,
    ...(paused ? {} : actions),
  };
}
let audioCtx = null,
  musicStep = 0,
  nextMusic = 0,
  shotBuffer = null,
  shotLoading = null;
function loadShotSound() {
  if (!audioCtx || shotBuffer || shotLoading) return shotLoading;
  shotLoading = fetch("pistol-shot.mp3")
    .then((r) => {
      if (!r.ok) throw new Error("Unable to load pistol sound");
      return r.arrayBuffer();
    })
    .then((data) => audioCtx.decodeAudioData(data))
    .then((buffer) => {
      shotBuffer = buffer;
      return buffer;
    })
    .catch(() => null);
  return shotLoading;
}
function audioInit() {
  if (!audioCtx) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) audioCtx = new Audio();
  }
  audioCtx?.resume().catch(() => {});
  loadShotSound();
}
function playShotSound(pan = 0) {
  if (!audioCtx || audioCtx.state !== "running" || platform.muted || !shotBuffer)
    return false;
  const source = audioCtx.createBufferSource(),
    gain = audioCtx.createGain(),
    stereo = audioCtx.createStereoPanner();
  source.buffer = shotBuffer;
  gain.gain.value = Math.max(
    0,
    0.78 * profile.settings.master * profile.settings.sfx,
  );
  stereo.pan.value = clamp(pan, -1, 1);
  source.connect(gain);
  gain.connect(stereo);
  stereo.connect(audioCtx.destination);
  source.start();
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
    stereo.disconnect();
  };
  return true;
}
function tone(
  freq,
  length,
  type = "sine",
  volume = 0.2,
  slide = 0,
  pan = 0,
  music = false,
) {
  if (!audioCtx || audioCtx.state !== "running" || platform.muted) return;
  const gain = audioCtx.createGain(),
    osc = audioCtx.createOscillator(),
    now = audioCtx.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slide)
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(25, slide),
      now + length,
    );
  gain.gain.setValueAtTime(
    Math.max(
      0.0001,
      volume *
        profile.settings.master *
        (music ? profile.settings.music : profile.settings.sfx),
    ),
    now,
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
  const stereo = audioCtx.createStereoPanner();
  stereo.pan.value = clamp(pan, -1, 1);
  osc.connect(gain);
  gain.connect(stereo);
  stereo.connect(audioCtx.destination);
  osc.start();
  osc.stop(now + length);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
    stereo.disconnect();
  };
}
function sound(type, pan = 0) {
  if (type === "shot") {
    if (!playShotSound(pan)) {
      loadShotSound();
      tone(180, 0.085, "sawtooth", 0.13, 45, pan);
      tone(1600, 0.03, "square", 0.03, 250, pan);
    }
  }
  if (type === "hit") {
    tone(650, 0.08, "triangle", 0.24, 150, pan);
  }
  if (type === "kill") {
    tone(160, 0.25, "sawtooth", 0.1, 35, pan);
  }
  if (type === "pickup" || type === "restore") {
    tone(720, 0.08, "sine", 0.18, 1100, pan);
    setTimeout(() => tone(1200, 0.13, "sine", 0.12), 65);
  }
  if (type === "dash") tone(180, 0.12, "triangle", 0.1, 850, pan);
  if (type === "melee") tone(100, 0.09, "square", 0.07, 40, pan);
  if (type === "impact") tone(350, 0.04, "triangle", 0.06, 100, pan);
  if (type === "empty") tone(80, 0.06, "square", 0.07);
  if (type === "ui") tone(430, 0.05, "sine", 0.08, 620);
  if (type === "start" || type === "reward" || type === "victory") {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone(f, 0.25, "triangle", 0.12), i * 100),
    );
  }
  if (type === "defeat") {
    [392, 330, 262].forEach((f, i) =>
      setTimeout(() => tone(f, 0.3, "triangle", 0.09), i * 130),
    );
  }
}
function gameSound(e) {
  const p = me();
  if (!p) return;
  const d = Math.hypot(e.x - p.x, e.y - p.y);
  if (d < 900) sound(e.type, (e.x - p.x) / 700);
  if (e.p === myId) {
    if (e.type === "restore") feedbackText("HIT! BULLET RESTORED");
    if (e.type === "pickup") feedbackText("BULLET RECOVERED");
    if (e.type === "kill")
      feedbackText(`ELIMINATED ${escape(e.victim).toUpperCase()}`);
  }
}
let fpsAvg = 60,
  frameCount = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  fpsAvg = fpsAvg * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
  if (view === "game" && game) {
    const p = me();
    if (p) {
      const cmd = input();
      if (!online && !paused) {
        p.input = {
          ...cmd,
          shoot: cmd.shoot || p.input.shoot,
          dash: cmd.dash || p.input.dash,
          melee: cmd.melee || p.input.melee,
          pickup: cmd.pickup || p.input.pickup,
          emote: cmd.emote || p.input.emote,
        };
        accumulator += dt;
        while (accumulator >= 1 / 60) {
          step(game, 1 / 60);
          accumulator -= 1 / 60;
        }
      }
      if (online && now - lastInput >= 33) {
        networkSend({ type: "input", ...cmd });
        lastInput = now;
        Object.keys(actions).forEach((k) => (actions[k] = false));
      } else if (!online)
        Object.keys(actions).forEach((k) => (actions[k] = false));
      renderer.pointer = pointer;
      if (online) {
        renderer.predict(game, p, cmd, dt, (now - snapshotAt) / 1000);
        p.angle = cmd.angle;
      }
      renderer.effects(game, p, profile.settings, gameSound);
      renderer.draw(
        game,
        p,
        paused && !online ? 0 : dt,
        profile.settings,
        online,
        (now - snapshotAt) / 1000,
      );
      if (now - uiAt > 90 && !paused && !scoreboard) {
        uiAt = now;
        renderGame();
      }
      if (game.ended) finish();
      if (online && now - snapshotAt > 6000) {
        netState =
          "The server stopped responding. Reconnect to return to the arena.";
        view = "error";
        render();
      }
    }
  }
  if (socket?.readyState === 1 && now - lastPing > 2000) {
    networkSend({ type: "ping", time: now });
    lastPing = now;
  }
  if (audioCtx?.state === "running" && now > nextMusic) {
    nextMusic = now + 250;
    const notes = [110, 110, 165, 146.83, 110, 196, 165, 146.83];
    tone(
      notes[Math.floor(musicStep / 2) % 8],
      0.2,
      "triangle",
      view === "game" ? 0.025 : 0.05,
      0,
      0,
      true,
    );
    if (musicStep % 4 === 0) tone(55, 0.12, "sine", 0.1, 28, 0, true);
    musicStep++;
  }
  if (++frameCount % 30 === 0) {
    let el = $("#fps");
    if (profile.settings.fps) {
      if (!el) {
        el = document.createElement("div");
        el.id = "fps";
        el.className = "fps";
        document.body.append(el);
      }
      el.textContent = Math.round(fpsAvg) + " FPS";
    } else el?.remove();
  }
  requestAnimationFrame(frame);
}
platform.onInvite((params) => {
  if (view === "game") leaveMatch();
  onlineAction(
    params.roomCode ? "join" : "create",
    params.roomCode ? { code: params.roomCode } : {},
  );
});
platform.init();
render();
requestAnimationFrame(frame);
// Accessibility/agent integration: the same visible actions are available as structured tools.
if (navigator.modelContext?.registerTool) {
  navigator.modelContext.registerTool({
    name: "start_bot_match",
    description:
      "Start ONE BULLET against bots with the currently selected settings.",
    inputSchema: { type: "object", properties: {} },
    execute: async () => {
      if (view === "game")
        return { content: [{ type: "text", text: "Already in a match." }] };
      startBots();
      return { content: [{ type: "text", text: "Bot match started." }] };
    },
  });
}
