// ONE BULLET shared deterministic engine extracted from the supplied game client.
// The browser client and Deno server now run the same simulation rules.
export const engine = (() => {
// Shared deterministic rules. Online matches run this module exclusively on the server.
const W = 1600,
  H = 1000,
  R = 19,
  VERSION = 1;
const COLORS = [
  "#39baff",
  "#ff6473",
  "#a1e34b",
  "#b786ff",
  "#ffa647",
  "#3de1d3",
  "#fa7cd0",
  "#f8dd62",
];
const MAPS = {
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
// All paid weapons are sidegrades. Classic retains its original rules.
const WEAPONS = Object.fromEntries([
  ['Classic',0,'Balanced single shot.','The original ONE BULLET pistol. Hit to regain your bullet; recover it after a miss.','Reliable at every range.','No special ability.','#adc2d6',1050,1.25,4,85,0],
  ['Revolver',500,'Fast, powerful and accurate single shot.','A high-impact revolver for precise aim, with excellent projectile speed and slower recovery after firing.','Fast, precise 95-damage shot.','0.55-second firing recovery.','#ffcb4e',1400,.85,3,95,.55],
  ['Ricochet Pistol',750,'Bounce your bullet off walls.','Use walls to hit enemies around corners and perform trick shots.','Two wall bounces open creative angles.','Slower projectile; short total flight time.','#ffb52c',900,1.4,4,85,.18],
  ['Rail Pistol',1000,'Pierce one enemy or thin obstacle.','An extremely fast straight projectile for precise long-range attacks.','One penetration through a target or thin cover.','Narrow shot and 0.7-second recovery.','#40deff',1750,.85,2,75,.7],
  ['Scatter Gun',900,'One shot splits into three fragments.','After a short flight, your bullet splits into a tight fan of short-range fragments.','Multiple fragments cover close-range angles.','45 damage per fragment; limited reach.','#fa6355',900,.55,3,45,.5],
  ['Magnet Gun',1100,'Missed bullets slowly move toward you.','Recovering a miss is easier, but you still need to move around cover and collect the bullet.','Missed bullets drift toward their owner.','Lower speed and shorter reach.','#31ccff',850,1.1,4,80,.2],
  ['Boomerang Blaster',1250,'A missed shot returns and can hit enemies.','The projectile turns back after a miss. Catch it to regain your one bullet.','Attack on both outgoing and returning paths.','Slow travel and a limited return window.','#ff873e',740,.65,6,75,.35],
  ['Burst Core',1350,'Create a small pulse at the final position.','A brief energy pulse damages and pushes nearby enemies when the projectile stops.','A 64-unit pulse can clear a small space.','Direct damage 60; pulse 25, blocked by cover.','#ffbc37',780,.95,5,60,.55],
  ['Charge Pistol',1500,'Hold fire, then release to charge your shot.','Charging increases speed and damage while reducing movement. Release to fire.','Full charge: 1650 speed and 95 damage.','Slow movement while charging; weak tap shot.','#68e4ff',850,1,3,60,.4],
  ['Phantom Gun',1650,'A faint projectile at the start of flight.','The shot is harder to see during its first 0.22 seconds, then becomes clearly visible.','Subtle early-flight tracer.','70 damage and a small hit area.','#bf73ff',1000,1.05,3,70,.25],
  ['Bounce Cannon',1500,'Large projectile with several wall bounces.','A slow, large projectile can ricochet up to four times through narrow corridors.','Large hit area and four bounces.','Slow travel and a long firing recovery.','#ffb631',650,2,9,80,.65],
  ['Curve Shot',1750,'Steer your shot slightly with your aim.','Move your cursor after firing to bend the projectile gradually around obstacles.','Up to 0.9 radians of steering per second.','Slower shot and reduced damage.','#53e5ff',760,1.25,4,75,.3],
  ['Twin Path',1800,'One real shot and one visual decoy.','Two paths appear together, but only the real projectile can damage an enemy.','A harmless decoy creates uncertainty.','Real shot deals 75 damage; decoy cannot hit.','#fb675d',950,1.1,4,75,.3],
  ['Teleport Shot',2000,'Press fire again to dash toward your shot.','Reactivation spends your available Dash to move toward the projectile. Solid cover still blocks movement.','Reposition up to 180 units toward the shot.','Uses Dash cooldown; 70-damage projectile.','#b16cff',850,1.35,4,70,.4],
  ['Anchor Gun',1600,'Missed shots attach; press fire to recall.','A missed projectile stays at its impact point. After 0.6 seconds, press fire again to recall it safely.','A controlled, non-damaging recall.','Delay before recall and slower travel.','#ffac42',850,1.05,5,80,.35],
  ['Shock Pistol',1900,'A hit disables enemy Dash for 1.5 seconds.','Control enemy movement with a temporary Dash lock after a successful hit.','Useful for follow-up pressure.','Only 50 damage; does not extend an active dash.','#38baff',1000,1.1,4,50,.4],
  ['Sniper One',2250,'Extremely fast long-range shot.','A narrow, fast projectile rewards long-range precision. Move more slowly while holding a loaded shot.','1900 speed and long reach.','Narrow hit area; loaded movement is 72%.','#a0ed5b',1900,1.1,2,90,.8],
  ['Heavy Cannon',2000,'Large projectile with strong knockback.','A heavy round is easier to land nearby and pushes enemies away on impact.','Large hit area and 100-unit knockback.','Slow travel and 65 damage.','#fa6858',600,1.4,10,65,.7],
  ['Ghost Bullet',2500,'Pass through one thin wall.','Calculate an angle through one piece of thin cover to surprise a hidden enemy.','Cross one obstacle up to 80 units thick.','70 damage; no second penetration.','#c1d2e3',1050,1.15,3,70,.45],
  ['Chain Ricochet',2750,'Each wall bounce increases shot speed.','Plan a series of up to three ricochets. Each bounce increases speed by 22%, capped at 1450.','Build speed through planned bounces.','Starts slow and deals 75 damage.','#bb6aff',650,1.7,5,75,.45],
  ['Recall Gun',3000,'Press fire again to recall a live projectile.','Your returning bullet can hit enemies. Catch it to reload, or retrieve it if the return expires.','Manual return gives a second attack angle.','Slow 70-damage shot and a limited return window.','#43c8ff',850,1.3,4,70,.35],
].map(([name,price,ability,description,strength,weakness,color,speed,life,radius,damage,recovery])=>[name,{name,price,ability,description,strength,weakness,color,speed,life,radius,damage,recovery}]));

function weaponFire(g,p) {
  const w=WEAPONS[p.weapon];
  if(!w || p.weapon==='Classic') return false;
  if(g.ended || g.countdown>0 || p.dead) return false;
  if(!p.ammo) {
    const bullet=g.bullets.find(b=>b.owner===p.id && b.weapon && !b.fake);
    if(p.weapon==='Recall Gun' && bullet) { bullet.returning=true; return true; }
    if(p.weapon==='Teleport Shot' && bullet && !bullet.teleported && p.dash<=0 && !(p.dashLock>0)) {
      const a=Math.atan2(bullet.y-p.y,bullet.x-p.x),d=Math.min(180,dist(p,bullet));
      move(g,p,Math.cos(a)*d,Math.sin(a)*d); p.dash=3; p.stats.dashes++; bullet.teleported=true;
      event(g,'dash',{x:p.x,y:p.y,p:p.id,color:w.color}); return true;
    }
    const drop=g.drops.find(b=>b.owner===p.id && b.weapon==='Anchor Gun');
    if(drop && g.time-drop.created>=.6) {drop.recalling=true; return true;}
    return false;
  }
  if(p.weaponCooldown>0) return false;
  p.ammo=0; p.shield=0; p.flash=.12; p.stats.shots++; p.weaponCooldown=w.recovery;
  const id=++g.seed, charge=clamp(p.charge||0,0,1);
  p.charge=0;
  const b={id,token:id,owner:p.id,x:p.x,y:p.y,angle:p.angle,life:0,weapon:p.weapon,
    color:w.color,trail:p.trail,speed:w.speed,maxLife:w.life,radius:w.radius,damage:w.damage,
    bounces:0,pierced:0,targets:[],returnAge:0};
  if(p.weapon==='Charge Pistol') {b.speed=850+800*charge;b.damage=Math.round(60+35*charge);}
  (g.weaponShots ||= {})[id]={hit:false,x:p.x,y:p.y,owner:p.id,weapon:p.weapon};
  g.bullets.push(b);
  if(p.weapon==='Twin Path') g.bullets.push({...b,id:++g.seed,angle:b.angle+.19,fake:true});
  event(g,'shot',{x:p.x,y:p.y,p:p.id,angle:p.angle,color:w.color});return true;
}
function weaponMarkHit(g,b,owner) {
  const shot=g.weaponShots?.[b.token];
  if(shot && !shot.hit) {shot.hit=true;owner.stats.hits++;}
}
function weaponFinish(g,b,owner,caught=false) {
  g.bullets=g.bullets.filter(a=>a!==b && !(a.token===b.token && a.fake));
  if(g.bullets.some(a=>a.token===b.token && !a.fake)) return;
  const shot=g.weaponShots?.[b.token];
  if(!shot) return;
  delete g.weaponShots[b.token];
  if(owner.dead) return;
  if((shot.hit && !(["chamber","speed"].includes(g.mode)&&!b.modeTargetDead)) || caught) {
    owner.ammo=1;
    if(b.golden&&g.modeState?.golden)Object.assign(g.modeState.golden,{carrier:owner.id,flight:null});
    if(caught && !shot.hit)owner.stats.retrieved++;
    event(g,shot.hit?'restore':'pickup',{x:owner.x,y:owner.y,p:owner.id,color:owner.color});
  } else {
    if(!shot.hit)modeMiss(g,owner,b);
    const point=safePoint(b.x,b.y,g.map,R+2);
    g.drops=g.drops.filter(a=>a.owner!==owner.id);
    g.drops.push({...point,owner:owner.id,color:WEAPONS[b.weapon].color,id:b.token,weapon:b.weapon,created:g.time});
    event(g,'impact',{...point,p:owner.id,color:WEAPONS[b.weapon].color});
  }
}
function weaponPulse(g,b,owner) {
  event(g,'melee',{x:b.x,y:b.y,p:owner.id,angle:b.angle,color:WEAPONS[b.weapon].color});
  for(const q of g.players) if(!q.dead && enemy(g,owner,q) && dist(b,q)<64 && lineClear(g,b,q)) {
    if(damage(g,q,owner,25,b)){weaponMarkHit(g,b,owner);const a=Math.atan2(q.y-b.y,q.x-b.x);move(g,q,Math.cos(a)*45,Math.sin(a)*45);}
  }
}
function weaponStep(g,dt) {
  for(const b of [...g.bullets]) {
    if(!b.weapon || !g.bullets.includes(b))continue;
    const owner=g.players.find(p=>p.id===b.owner);
    if(!owner || owner.dead){g.bullets=g.bullets.filter(a=>a!==b);continue;}
    if(b.fake){b.life+=dt;b.x+=Math.cos(b.angle)*b.speed*dt;b.y+=Math.sin(b.angle)*b.speed*dt;
      if(b.life>b.maxLife || !valid(b.x,b.y,4,g.map))g.bullets=g.bullets.filter(a=>a!==b);continue;}
    if(b.returning){
      b.returnAge+=dt;b.angle=Math.atan2(owner.y-b.y,owner.x-b.x);
      if(dist(b,owner)<R+10){weaponFinish(g,b,owner,true);continue;}
      if(b.returnAge>1.8){weaponFinish(g,b,owner);continue;}
    } else if(b.weapon==='Curve Shot') {
      const diff=Math.atan2(Math.sin(owner.angle-b.angle),Math.cos(owner.angle-b.angle));
      b.angle+=clamp(diff,-.9*dt,.9*dt);
    }
    const n=Math.max(1,Math.ceil(b.speed*dt/6)); let done=false;
    for(let i=0;i<n && !done;i++) {
      const px=b.x,py=b.y;
      b.x+=Math.cos(b.angle)*b.speed*dt/n;b.y+=Math.sin(b.angle)*b.speed*dt/n;b.life+=dt/n;b.travel=(b.travel||0)+b.speed*dt/n;
      if(modeBallHit(g,b,owner)){weaponMarkHit(g,b,owner);weaponFinish(g,b,owner,true);done=true;continue;}
      if(b.returning && dist(b,owner)<R+10){weaponFinish(g,b,owner,true);done=true;break;}
      if(b.weapon==='Scatter Gun' && !b.fragment && b.life>=.16) {
        b.fragment=true;
        for(const da of [-.19,.19])g.bullets.push({...b,id:++g.seed,angle:b.angle+da,targets:[]});
      }
      const blocked=!valid(b.x,b.y,b.radius,g.map);
      if(blocked) {
        const cover=MAPS[g.map].cover.find(([x,y,w,h])=>b.x+b.radius>x && b.x-b.radius<x+w && b.y+b.radius>y && b.y-b.radius<y+h);
        const penetrating=['Rail Pistol','Ghost Bullet'].includes(b.weapon);
        if(penetrating && (b.insideCover || (!b.pierced && cover))) {
          if(!b.insideCover) {
            // Actual traversed thickness along the ray, including oblique shots.
            const [x,y,w,h]=cover,cx=Math.cos(b.angle),cy=Math.sin(b.angle);
            const tx=Math.abs(cx)<.0001?Infinity:((cx>0?x+w+b.radius:x-b.radius)-b.x)/cx;
            const ty=Math.abs(cy)<.0001?Infinity:((cy>0?y+h+b.radius:y-b.radius)-b.y)/cy;
            if(Math.min(tx,ty)<=80){b.pierced=1;b.insideCover=true;}
          }
          if(b.insideCover)continue;
        }
        b.x=px;b.y=py;
        const maxBounce=Math.max(bounceLimit(g),b.weapon==='Ricochet Pistol'?2:b.weapon==='Bounce Cannon'?4:b.weapon==='Chain Ricochet'?3:0);
        if(b.bounces<maxBounce && !b.returning) {
          const nx=px+Math.cos(b.angle)*b.speed*dt/n;
          b.angle=!valid(nx,py,b.radius,g.map)?Math.PI-b.angle:-b.angle;
          b.bounces++;if(b.weapon==='Chain Ricochet')b.speed=Math.min(1450,b.speed*1.22);
          event(g,'impact',{x:px,y:py,p:owner.id,color:WEAPONS[b.weapon].color});continue;
        }
        if(b.weapon==='Boomerang Blaster' && !b.returning){b.returning=true;done=true;continue;}
        if(b.weapon==='Burst Core')weaponPulse(g,b,owner);
        weaponFinish(g,b,owner);done=true;continue;
      }
      b.insideCover=false;
      const q=g.players.find(q=>!q.dead && q.shield<=0 && enemy(g,owner,q) && !b.targets.includes(q.id) && dist(b,q)<R+b.radius);
      if(q) {
        if(damage(g,q,owner,b.damage,b)) {
          b.targets.push(q.id);weaponMarkHit(g,b,owner);
          if(b.weapon==='Shock Pistol' && !q.dead)q.dashLock=1.5;
          if(b.weapon==='Heavy Cannon' && !q.dead)move(g,q,Math.cos(b.angle)*100,Math.sin(b.angle)*100);
          if(b.weapon==='Burst Core')weaponPulse(g,b,owner);
          if(b.weapon==='Rail Pistol' && !b.pierced){b.pierced=1;continue;}
          weaponFinish(g,b,owner);done=true;continue;
        }
      }
      if(b.life>=b.maxLife && !b.returning) {
        if(b.weapon==='Boomerang Blaster'){b.returning=true;done=true;continue;}
        if(b.weapon==='Burst Core')weaponPulse(g,b,owner);
        weaponFinish(g,b,owner);done=true;
      }
    }
  }
  for(const d of g.drops) if(d.weapon==='Magnet Gun' || d.recalling) {
    const p=g.players.find(p=>p.id===d.owner);if(!p || p.dead)continue;
    const a=Math.atan2(p.y-d.y,p.x-d.x),speed=d.recalling?600:85;
    const dx=Math.cos(a)*speed*dt,dy=Math.sin(a)*speed*dt;
    // Anchor recall is harmless; it may pass through cover. Magnet movement may not.
    if(d.recalling || valid(d.x+dx,d.y,4,g.map))d.x+=dx;
    if(d.recalling || valid(d.x,d.y+dy,4,g.map))d.y+=dy;
    collect(g,p);
  }
  for(const token of Object.keys(g.weaponShots||{}))
    if(!g.bullets.some(b=>String(b.token)===token))delete g.weaponShots[token];
}

const MODES = {
  ffa: "Free for all",
  tdm: "Team deathmatch",
  hill: "King of the hill",
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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
function valid(x, y, r, map) {
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
function safePoint(x, y, map, r = R) {
  if (valid(x, y, r, map)) return { x, y };
  for (let d = 12; d < 1800; d += 12)
    for (let a = 0; a < Math.PI * 2; a += 0.4) {
      const xx = clamp(x + Math.cos(a) * d, r + 36, W - r - 36),
        yy = clamp(y + Math.sin(a) * d, r + 36, H - r - 36);
      if (valid(xx, yy, r, map)) return { x: xx, y: yy };
    }
  return { x: 100, y: 100 };
}
function createGame(options = {}) {
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
function event(g, type, data = {}) {
  g.events.push({ id: ++g.eid, type, t: g.time, ...data });
  if (g.events.length > 48) g.events.shift();
}
function addPlayer(
  g,
  {
    id,
    name = "Player",
    bot = false,
    color,
    skin = "Default",
    pistol = "Classic",
    weapon = "Classic",
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
      weapon: WEAPONS[weapon] ? weapon : "Classic",
      weaponCooldown: 0, charge: 0, dashLock: 0,
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
function spawn(g, p) {
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
    weaponCooldown: 0, charge: 0, dashLock: 0,
  });
  g.bullets = g.bullets.filter((b) => b.owner !== p.id);
  g.drops = g.drops.filter((b) => b.owner !== p.id);
  event(g, "spawn", { x: p.x, y: p.y, p: p.id, color: p.color });
}
function removePlayer(g, id) {
  g.players = g.players.filter((p) => p.id !== id);
  g.bullets = g.bullets.filter((b) => b.owner !== id);
  g.drops = g.drops.filter((b) => b.owner !== id);
}
const enemy = (g, a, b) =>
  a.id !== b.id && (!teamMode(g) || a.team !== b.team);
function lineClear(g, a, b) {
  const d = dist(a, b),
    n = Math.ceil(d / 14);
  for (let i = 1; i < n; i++)
    if (
      !valid(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, 2, g.map)
    )
      return false;
  return true;
}
function move(g, p, dx, dy) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
  for (let i = 0; i < n; i++) {
    if (valid(p.x + dx / n, p.y, R, g.map)) p.x += dx / n;
    if (valid(p.x, p.y + dy / n, R, g.map)) p.y += dy / n;
  }
}
function fire(g, p) {
  if (p.weapon && p.weapon !== "Classic") return weaponFire(g,p);
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
function damage(g, target, source, amount) {
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
function melee(g, p) {
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
function dash(g, p, dx, dy) {
  if (p.dead || p.dash > 0 || g.countdown > 0 || g.ended) return;
  if (p.dashLock > 0) return;
  const len = Math.hypot(dx, dy);
  p.dashX = len ? dx / len : Math.cos(p.angle);
  p.dashY = len ? dy / len : Math.sin(p.angle);
  p.dash = 3;
  p.dashTime = 0.17;
  p.stats.dashes++;
  event(g, "dash", { x: p.x, y: p.y, p: p.id, color: p.color });
}
function collect(g, p, r = 34) {
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
function step(g, dt) {
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
    p.weaponCooldown = Math.max(0, (p.weaponCooldown || 0) - dt);
    p.dashLock = Math.max(0, (p.dashLock || 0) - dt);
    p.dash = Math.max(0, p.dash - dt * (p.rushUntil>g.time?2:1));
    p.melee = Math.max(0, p.melee - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.emoting = Math.max(0, (p.emoting || 0) - dt);
    p.emoteCooldown = Math.max(0, (p.emoteCooldown || 0) - dt);
    p.shield = Math.max(0, p.shield - dt);
    if (p.dead) {
      if(noRespawn(g))continue;
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
    if (p.weapon === "Charge Pistol") {
      if (input.charge && p.ammo) p.charge = Math.min(1, (p.charge || 0) + dt / 1.1);
      if (!input.charge && !input.shoot) p.charge = 0;
      if (p.bot && input.shoot) p.charge = .65;
    }
    if (input.shoot) fire(g, p);
    if (input.pickup) collect(g, p, 62);
    if (input.emote && !p.emoteCooldown) {
      p.emoting = 1.5;
      p.emoteCooldown = 4;
    }
    const speed = 235 * modeSpeed(g,p) * (p.weapon === "Sniper One" && p.ammo ? .72 : p.weapon === "Charge Pistol" && input.charge ? .55 : 1);
    if (p.dashTime > 0) {
      p.dashTime = Math.max(0, p.dashTime - dt);
      dx = p.dashX;
      dy = p.dashY;
    }
    const velocity = p.dashTime > 0 ? 900 * (g.mode === "speed" || modifier(g,"Super Dash") ? 1.35 : 1) : speed;
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
    if (!g.bullets.includes(b) || b.weapon) continue;
    const owner = g.players.find((p) => p.id === b.owner);
    if (!owner) {
      g.bullets = g.bullets.filter((a) => a !== b);
      continue;
    }
    const speed=b.speed||1050,n = Math.ceil((speed * dt) / 8);
    let done = false;
    for (let i = 0; i < n && !done; i++) {
      const px = b.x,
        py = b.y;
      b.x += (Math.cos(b.angle) * speed * dt) / n;
      b.y += (Math.sin(b.angle) * speed * dt) / n;
      b.life += dt / n; b.travel=(b.travel||0)+speed*dt/n;
      if(modeBallHit(g,b,owner)){done=true;continue;}
      const target = g.players.find(
        (q) =>
          !q.dead && q.shield <= 0 && enemy(g, owner, q) && dist(b, q) < R + (b.radius||4),
      );
      if (target) {
        damage(g, target, owner, 85,b);
        owner.stats.hits++;
        owner.ammo = 1;
        modeHitRestore(g,owner,target,b);
        event(g, "restore", { x: owner.x, y: owner.y, p: owner.id });
        done = true;
      } else if (!valid(b.x, b.y, b.radius||4, g.map) || b.life > (bounceLimit(g)?3.5:1.25)) {
        if(!valid(b.x,b.y,b.radius||4,g.map) && b.bounces<bounceLimit(g)){b.angle=!valid(b.x,py,b.radius||4,g.map)?Math.PI-b.angle:-b.angle;b.x=px;b.y=py;b.bounces++;continue;}
        modeMiss(g,owner,b);
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
  weaponStep(g,dt);
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
function snapshot(g) {
  return {
    weaponVersion: 1,
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
function ranking(g) {
  return [...g.players].sort(
    (a, b) =>
      b.stats.score - a.stats.score ||
      b.stats.kills - a.stats.kills ||
      a.stats.deaths - b.stats.deaths,
  );
}
function won(g, p) {
  return g.mode === "ffa"
    ? ranking(g)[0]?.id === p.id
    : g.teamScore[p.team] > g.teamScore[1 - p.team];
}

// Mode-specific rules layered onto the existing simulation and combat functions.
const MODE_RULES = {
  ffa:['Free for all','Most eliminations wins. Retrieve every missed bullet.'],
  chamber:['One Chamber','One life. Only an elimination restores your bullet.'],
  hot:['Hot Bullet','Pass the hot bullet with a hit before its 12-second fuse expires.'],
  tag:['Bullet Tag','Pass the mark by landing a hit. Least time marked wins.'],
  bank:['Bank Shot','Only ricochet eliminations score. Extra bounces earn more.'],
  ball:['Bullet Ball','4v4. Shoot the ball into the opposite goal. First to 5 goals.'],
  bounty:['Bounty Hunt','Eliminate your assigned target for 4 points. Other kills earn 1.'],
  zone:['King of the Zone','Hold the uncontested zone. It relocates every 25 seconds.'],
  last:['Last Bullet Standing','One life. Stay inside the shrinking safe area.'],
  rush:['Bullet Rush','Eliminations grant 4 seconds of speed and faster dash recharge.'],
  ricochet:['Ricochet Madness','Every bullet can bounce up to 5 times.'],
  ghost:['Ghost Shot','Faint initial trails reveal near enemies and after 0.28 seconds.'],
  speed:['Speed Chamber','One life, faster movement, bullets and dash. 45-second round.'],
  juggernaut:['Juggernaut','300 HP champion. Score as the champion; defeat them to take over.'],
  vip:['VIP','4v4. Protect your VIP. First team to win 3 rounds wins.'],
  elimination:['Team Elimination','4v4. One life per round. First to 3 rounds.'],
  core:['Capture the Core','Carry the core to your base. Carrier cannot shoot. First to 3.'],
  infection:['Infection','Humans survive the timer. Infected convert humans by elimination.'],
  hunter:['Hunter','The hunter gets radar pulses. Survive as hunter or eliminate them to score.'],
  golden:['Golden Bullet','Find the gold bullet. Golden eliminations earn 4 points.'],
  relay:['Bullet Relay','4v4. Each team shares one bullet, passed on hit or recovery.'],
  duel:['Duel Tournament','8-player bracket. Quarterfinals, semifinals and final; best of 3.'],
  perfect:['Perfect Shot','12 shots. Hits and difficult shots score; consecutive misses lose points.'],
  trick:['Trickshot','Long shots and repeated ricochets earn larger elimination bonuses.'],
  moving:['Moving Walls','Watch the striped warnings. Moving cover never crushes players.'],
  chaos:['Chaos Vote','Vote on one of three modifiers before each of 3 rounds.'],
};
for(const [key,[name]] of Object.entries(MODE_RULES)) MODES[key]=name;
const MODIFIERS=['Super Dash','Fast Bullets','Triple Ricochet','Tiny Arena','No Melee','Fast Players','Giant Bullet','Low Visibility','Moving Walls'];
const teamMode=g=>['tdm','hill','ball','vip','elimination','core','relay','infection'].includes(g.mode);
const noRespawn=g=>['chamber','hot','last','speed','vip','elimination','duel'].includes(g.mode);
const pick=a=>a.length?a[Math.floor(Math.random()*a.length)]:null;
const shuffled=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const modePlayer=(g,id)=>g.players.find(p=>p.id===id);
const living=g=>g.players.filter(p=>!p.dead);
const modifier=(g,m)=>g.modeState?.modifier===m;
const modeSpeed=(g,p)=> (g.mode==='speed'?1.35:modifier(g,'Fast Players')?1.3:1)*(p.rushUntil>g.time?1.2:1);
const bulletSpeed=g=>g.mode==='speed'||modifier(g,'Fast Bullets')?1.45:1;
const bounceLimit=g=>g.mode==='ricochet'?5:['bank','trick'].includes(g.mode)||modifier(g,'Triple Ricochet')?3:0;
function modeWinner(g,id=null,team=null){
  if(g.ended)return;
  g.modeState.winner=id;g.modeState.winnerTeam=team;g.modeState.decided=true;
  g.ended=true;event(g,'end');
}
function modePoints(g,p,n){p.stats.score+=n;if(teamMode(g))g.teamScore[p.team]+=n;}
function targetFor(g,p,exclude=null){const choices=g.players.filter(q=>q.id!==p.id&&q.id!==exclude);return pick(choices.length?choices:g.players.filter(q=>q.id!==p.id))?.id||null;}
function objectivePoint(g,x=W/2,y=H/2){return safePoint(x,y,g.map,30);}
function modeInit(g){
  if(g.modeState)return;
  const s=g.modeState={version:1,round:1,roundUntil:0,roundWins:[0,0],decided:false,winner:null,winnerTeam:null};
  if(['chamber','speed'].includes(g.mode))g.duration=g.mode==='speed'?45:90;
  if(['vip','elimination','chaos'].includes(g.mode))g.duration=600;
  if(g.mode==='duel')g.duration=900;
  const chosen=pick(g.players);
  if(['hot','tag','juggernaut','hunter'].includes(g.mode))s.carrier=chosen?.id;
  if(g.mode==='hot')s.fuse=12;
  if(g.mode==='tag')for(const p of g.players)p.markedTime=0;
  if(g.mode==='juggernaut'&&chosen){chosen.hp=300;chosen.maxHp=300;}
  if(g.mode==='hunter')s.radarAt=3;
  if(g.mode==='bounty')for(const p of g.players)p.bounty=targetFor(g,p);
  if(g.mode==='zone'){s.zone={...objectivePoint(g),r:115};s.zoneAt=28;}
  if(g.mode==='ball'){s.ball={...objectivePoint(g),vx:0,vy:0};s.bases=[objectivePoint(g,85,500),objectivePoint(g,1515,500)];}
  if(g.mode==='core'){s.core={...objectivePoint(g),carrier:null};s.bases=[objectivePoint(g,90,500),objectivePoint(g,1510,500)];}
  if(g.mode==='golden')s.golden={...objectivePoint(g),carrier:null};
  if(g.mode==='perfect')for(const p of g.players){p.opportunities=12;p.misses=0;}
  if(g.mode==='infection')for(const p of g.players)p.team=p===chosen?1:0;
  if(g.mode==='relay'){
    s.relay=[0,1].map(t=>g.players.find(p=>p.team===t)?.id||null);
    for(const p of g.players)p.ammo=Number(s.relay[p.team]===p.id);
  }
  if(['vip','elimination'].includes(g.mode)){s.roundUntil=g.time+60;chooseVIPs(g);}
  if(g.mode==='duel'){
    s.stage=1;s.queue=shuffled(g.players.map(p=>p.id));s.next=[];s.duelWins=[0,0];startDuel(g);
  }
  if(g.mode==='chaos')beginChaosVote(g);
}
function chooseVIPs(g){if(g.mode==='vip')g.modeState.vips=[0,1].map(t=>pick(g.players.filter(p=>p.team===t))?.id);}
function startDuel(g){
  const s=g.modeState;
  if(s.queue.length===0){s.queue=s.next;s.next=[];s.stage++;}
  if(s.queue.length===1&&s.next.length===0){modeWinner(g,s.queue[0]);return;}
  s.duel=s.queue.splice(0,2);s.duelWins=[0,0];resetDuel(g);
}
function resetDuel(g){
  const s=g.modeState;g.bullets=[];g.drops=[];g.weaponShots={};
  for(const p of g.players){p.dead=99999;p.hp=0;if(s.duel.includes(p.id))spawn(g,p);}
  s.roundUntil=g.time+28;g.countdown=3;
  if(s.duel.length===1){s.next.push(s.duel[0]);startDuel(g);}
}
function roundOver(g,team){
  const s=g.modeState;if(s.roundBreak)return;
  if(team!==null){s.roundWins[team]++;g.teamScore=[...s.roundWins];}
  if(s.roundWins.some(x=>x>=3)){modeWinner(g,null,team);return;}
  s.roundBreak=3;s.lastRoundTeam=team;
}
function beginChaosVote(g){
  const s=g.modeState;s.choices=shuffled(MODIFIERS).slice(0,3);s.votes={};s.voteUntil=g.time+10;s.modifier=null;
  for(const p of g.players)if(p.bot)s.votes[p.id]=pick(s.choices);
}
function modeVote(g,id,choice){const s=g.modeState;if(g.mode!=='chaos'||!s?.voteUntil||g.time>=s.voteUntil||!modePlayer(g,id)||!s.choices.includes(choice))return false;s.votes[id]=choice;return true;}
function modeTally(choices,votes){const counts=choices.map(x=>Object.values(votes).filter(v=>v===x).length),max=Math.max(...counts);return pick(choices.filter((x,i)=>counts[i]===max));}
function modeExpire(g){
  const s=g.modeState;
  if(g.mode==='infection'){modeWinner(g,null,living(g).some(p=>p.team===0)?0:1);return;}
  if(noRespawn(g)){const a=living(g);modeWinner(g,a.length===1?a[0].id:null);return;}
  g.ended=true;event(g,'end');
}
function modeKill(g,victim,source,shot){
  const s=g.modeState;if(!s)return;
  const b=shot||{},bounces=b.bounces||0,distance=b.travel||0;
  // Existing kills/deaths/streaks remain managed by damage(). Only mode scores differ.
  const noKillScore=['tag','hot','ball','zone','core','juggernaut','hunter','perfect','vip','elimination','duel','infection'];
  let score=noKillScore.includes(g.mode)?0:1;
  if(g.mode==='bank')score=bounces?1+Math.min(bounces,5):0;
  if(g.mode==='trick')score=1+(distance>550?2:0)+bounces*2;
  if(g.mode==='bounty'){score=source.bounty===victim.id?4:1;if(source.bounty===victim.id)source.bounty=targetFor(g,source,victim.id);}
  if(g.mode==='golden'&&b.golden)score=4;
  if(g.mode==='rush')source.rushUntil=g.time+4;
  if(g.mode==='juggernaut'||g.mode==='hunter'){
    if(s.carrier===source.id)score=g.mode==='hunter'?3:2;
    if(s.carrier===victim.id){score=g.mode==='hunter'?5:3;s.carrier=source.id;if(g.mode==='juggernaut'){source.hp=300;source.maxHp=300;victim.maxHp=100;}}
  }
  if(g.mode!=='hill')modePoints(g,source,score-1);
  if(g.mode==='infection'&&source.team===1&&victim.team===0){victim.team=1;victim.dead=1;}
  if(s.core?.carrier===victim.id)Object.assign(s.core,{x:victim.x,y:victim.y,carrier:null,lock:g.time+.5});
  if(s.golden?.carrier===victim.id)Object.assign(s.golden,{x:victim.x,y:victim.y,carrier:null,lock:g.time+.5});
  if(noRespawn(g))victim.dead=99999;
  if(['chamber','speed'].includes(g.mode)){source.ammo=1;g.drops=g.drops.filter(d=>d.owner!==source.id);}
  event(g,'highlight',{p:source.id,target:victim.id,value:score+bounces*2+(distance>550?3:0),label:g.mode==='duel'&&s.stage>=3?'Tournament Final Shot':b.golden?'Golden Bullet Kill':bounces>=3?'Triple Ricochet':bounces===2?'Double Ricochet':bounces?'Ricochet Kill':distance>550?'Long Shot':source.stats.streak>=2?'Multi Elimination':'Elimination'});
}
const baseModeFire=fire,baseModeDamage=damage,baseModeCollect=collect,baseModeDash=dash,baseModeMelee=melee,baseModeStep=step,baseModeBot=botInput,baseModeSnapshot=snapshot,baseModeRanking=ranking,baseModeWon=won;
fire=function(g,p){
  modeInit(g);const s=g.modeState;
  if(s.voteUntil||s.roundBreak||s.core?.carrier===p.id||(g.mode==='perfect'&&p.opportunities<=0))return false;
  if(['hot','tag'].includes(g.mode)&&s.carrier!==p.id)return false;
  if(g.mode==='relay'&&s.relay[p.team]!==p.id)return false;
  const old=g.seed,shots=p.stats.shots,result=baseModeFire(g,p);
  if(p.stats.shots>shots){
    if(g.mode==='perfect')p.opportunities--;
    for(const b of g.bullets.filter(b=>b.id>old)){
      b.travel=0;b.startX=p.x;b.startY=p.y;b.bounces ||=0;b.speed=(b.speed||1050)*bulletSpeed(g);
      if(modifier(g,'Giant Bullet'))b.radius=Math.max(10,b.radius||4);
      if(s.golden?.carrier===p.id){b.golden=true;s.golden.carrier=null;s.golden.flight=b.token||b.id;}
    }
  }
  return result;
};
damage=function(g,target,source,amount,shot=null){
  modeInit(g);const s=g.modeState;
  if(s.voteUntil||s.roundBreak)return false;
  if(['hot','tag'].includes(g.mode)){
    if(!shot||source.id!==s.carrier||target.dead||target.shield>0||g.time<(s.passLock||0))return false;
    s.carrier=target.id;s.passLock=g.time+.4;if(g.mode==='hot')s.fuse=12;
    event(g,'hit',{x:target.x,y:target.y,p:source.id,target:target.id,color:target.color});return true;
  }
  const alive=!target.dead,hit=baseModeDamage(g,target,source,amount);
  if(hit&&shot)shot.modeTargetDead=shot.modeTargetDead||!!target.dead;
  if(hit&&shot){
    if(g.mode==='perfect')modePoints(g,source,3+(shot.travel>550?2:0)+(shot.bounces||0)*2);
    source.misses=0;
  }
  if(hit&&alive&&target.dead)modeKill(g,target,source,shot);
  return hit;
};
dash=function(g,p,dx,dy){baseModeDash(g,p,dx,dy);if(p.dashTime>0&&(g.mode==='speed'||modifier(g,'Super Dash')))p.dash=Math.min(p.dash,1.5);};
melee=function(g,p){if(modifier(g,'No Melee')||['hot','tag'].includes(g.mode))return;baseModeMelee(g,p);};
collect=function(g,p,r=34){
  const s=g.modeState;
  if(g.mode==='relay'&&s&&!p.dead){const d=g.drops.find(d=>modePlayer(g,d.owner)?.team===p.team&&dist(d,p)<r);if(d){d.owner=p.id;s.relay[p.team]=p.id;}}
  const result=baseModeCollect(g,p,r);
  if(s?.golden&&!s.golden.carrier&&!s.golden.flight&&g.time>=(s.golden.lock||0)&&!p.dead&&dist(p,s.golden)<r){s.golden.carrier=p.id;p.golden=true;}
  return result;
};
function modeBallHit(g,b,owner){
  const ball=g.modeState?.ball;if(!ball||dist(ball,b)>28+(b.radius||4))return false;
  ball.vx+=Math.cos(b.angle)*600;ball.vy+=Math.sin(b.angle)*600;
  owner.ammo=1;if(!b.weapon)owner.stats.hits++;event(g,'hit',{x:ball.x,y:ball.y,p:owner.id,color:'#ffdc64'});return true;
}
function modeMiss(g,owner,b){
  if(g.mode==='perfect'){owner.misses=(owner.misses||0)+1;modePoints(g,owner,-Math.min(3,owner.misses));}
  const gold=g.modeState?.golden;
  if(b.golden&&gold){Object.assign(gold,{...safePoint(b.x,b.y,g.map,25),flight:null,carrier:null,lock:g.time+.4});}
}
function modeHitRestore(g,p,target,b){
  if(['chamber','speed'].includes(g.mode)&&!target.dead){
    p.ammo=0;const pos=safePoint(b.x,b.y,g.map,R+2);g.drops.push({...pos,owner:p.id,color:p.color,id:b.token||b.id});
  }
  if(b.golden&&g.modeState?.golden){Object.assign(g.modeState.golden,{carrier:p.id,flight:null});}
}
function modeWalls(g){
  const s=g.modeState,active=g.mode==='moving'||modifier(g,'Moving Walls');if(!active)return;
  const phase=g.time%14;s.wallWarning=phase<3;
  const shift=phase<3?0:Math.min(1,(phase-3)/5)*160;
  const reverse=Math.floor(g.time/14)%2;const x=reverse?160-shift:shift;
  const walls=[[470+x,410,28,150],[1100-x,410,28,150]];
  // Pause individual walls if their proposed rectangle intersects a living player.
  s.walls=walls.map((w,i)=>living(g).some(p=>p.x+R>w[0]&&p.x-R<w[0]+w[2]&&p.y+R>w[1]&&p.y-R<w[1]+w[3])?(s.walls?.[i]||[w[0],w[1],0,0]):w);
}
function modeUpdate(g,dt){
  const s=g.modeState,a=living(g);if(!s||g.ended)return;
  if(g.mode==='hot'){
    let p=modePlayer(g,s.carrier);if(!p||p.dead){p=pick(a);s.carrier=p?.id;s.fuse=12;}
    s.fuse-=dt;if(p&&s.fuse<=0){p.hp=0;p.dead=99999;p.stats.deaths++;p.stats.streak=0;s.carrier=pick(living(g))?.id;s.fuse=12;event(g,'kill',{p:null,target:p.id,killer:'HOT BULLET',victim:p.name,x:p.x,y:p.y});}
  }
  if(g.mode==='tag'){const p=modePlayer(g,s.carrier);if(p){p.markedTime+=dt;p.stats.score=-p.markedTime;}}
  if(['juggernaut','hunter'].includes(g.mode)){
    let p=modePlayer(g,s.carrier);if(!p||p.dead){p=pick(a);s.carrier=p?.id;if(p&&g.mode==='juggernaut')p.hp=p.maxHp=300;}
    if(p)modePoints(g,p,dt*(g.mode==='hunter'?1:.5));
    if(g.mode==='hunter'&&g.time>=s.radarAt){s.radarUntil=g.time+1.5;s.radarAt=g.time+8;}
  }
  if(g.mode==='bounty')for(const p of g.players)if(!modePlayer(g,p.bounty)||p.bounty===p.id)p.bounty=targetFor(g,p);
  if(g.mode==='zone'){
    if(g.time>=s.zoneAt){s.zone={...objectivePoint(g,180+Math.random()*1240,180+Math.random()*640),r:115};s.zoneAt=g.time+25;}
    const inside=a.filter(p=>dist(p,s.zone)<s.zone.r);s.zone.owner=inside.length===1?inside[0].id:null;s.zone.contested=inside.length>1;
    if(inside.length===1)modePoints(g,inside[0],dt);
  }
  if(g.mode==='last'||modifier(g,'Tiny Arena')){
    s.safe={x:800,y:500,r:g.mode==='last'?Math.max(70,920-(g.time-3)*6):360};
    for(const p of a)if(dist(p,s.safe)>s.safe.r){p.hp=Math.max(0,p.hp-dt*22);if(p.hp===0){p.dead=g.mode==='last'?99999:2.4;p.stats.deaths++;p.stats.streak=0;}}
  }
  if(['chamber','hot','last','speed'].includes(g.mode)&&g.players.length>=2){const alive=living(g);if(alive.length<=1)modeWinner(g,alive[0]?.id||null);}
  if(g.mode==='ball'){
    const b=s.ball,n=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/8));
    for(let i=0;i<n;i++){
      if(valid(b.x+b.vx*dt/n,b.y,24,g.map))b.x+=b.vx*dt/n;else b.vx*=-.7;
      if(valid(b.x,b.y+b.vy*dt/n,24,g.map))b.y+=b.vy*dt/n;else b.vy*=-.7;
    }
    b.vx*=Math.exp(-dt*1.2);b.vy*=Math.exp(-dt*1.2);
    const goal=s.bases.findIndex(base=>dist(base,b)<75);
    if(goal>=0){g.teamScore[1-goal]++;event(g,'goal',{team:1-goal});Object.assign(b,objectivePoint(g),{vx:0,vy:0});if(g.teamScore[1-goal]>=5)modeWinner(g,null,1-goal);}
  }
  if(g.mode==='core'){
    const core=s.core;let p=modePlayer(g,core.carrier);
    if(p?.dead||(!p&&core.carrier))core.carrier=null;
    if(!core.carrier&&g.time>=(core.lock||0)){p=a.find(p=>dist(p,core)<42);if(p)core.carrier=p.id;}
    if(core.carrier&&p){core.x=p.x;core.y=p.y;if(dist(p,s.bases[p.team])<65){g.teamScore[p.team]++;p.stats.score++;Object.assign(core,objectivePoint(g),{carrier:null,lock:g.time+1});if(g.teamScore[p.team]>=3)modeWinner(g,null,p.team);}}
  }
  if(g.mode==='infection'&&!a.some(p=>p.team===0))modeWinner(g,null,1);
  if(g.mode==='golden'&&s.golden.flight&&!g.bullets.some(b=>(b.token||b.id)===s.golden.flight)){s.golden.flight=null;s.golden.carrier=null;Object.assign(s.golden,objectivePoint(g));}
  if(g.mode==='relay')for(const t of [0,1]){
    const holder=modePlayer(g,s.relay[t]),members=a.filter(p=>p.team===t);
    if(!holder||holder.dead){s.relay[t]=members[0]?.id||null;for(const p of members)p.ammo=Number(p.id===s.relay[t]);}
    else for(const p of members)if(p!==holder)p.ammo=0;
  }
  if(['vip','elimination'].includes(g.mode)&&!s.roundBreak){
    const teams=[0,1].map(t=>g.mode==='vip'?a.some(p=>p.id===s.vips[t]):a.some(p=>p.team===t));
    if(!teams[0]||!teams[1])roundOver(g,teams[0]?0:teams[1]?1:null);
    else if(g.time>=s.roundUntil)roundOver(g,null);
  }
  if(g.mode==='duel'&&!s.roundBreak&&!g.ended){
    const alive=a.filter(p=>s.duel.includes(p.id));
    if(alive.length<2||g.time>=s.roundUntil){
      let winner=alive.length===1?alive[0]:null;
      if(!winner&&alive.length===2&&alive[0].hp!==alive[1].hp)winner=alive[0].hp>alive[1].hp?alive[0]:alive[1];
      if(winner)s.duelWins[s.duel.indexOf(winner.id)]++;
      s.roundBreak=2;s.duelWinner=s.duelWins.some(x=>x===2)?s.duel[s.duelWins.indexOf(2)]:null;
    }
  }
  if(g.mode==='perfect'&&g.players.every(p=>p.opportunities<=0)&&g.bullets.length===0){g.ended=true;event(g,'end');}
  if(g.mode==='chaos'&&!s.voteUntil&&g.time>=s.roundUntil){
    if(s.round>=3){g.ended=true;event(g,'end');}else{s.round++;beginChaosVote(g);g.bullets=[];g.drops=[];for(const p of g.players)spawn(g,p);}
  }
}
step=function(g,dt){
  if(g.ended)return;modeInit(g);dt=clamp(dt,0,.05);const s=g.modeState;
  if(s.voteUntil){g.time+=dt;if(g.time>=s.voteUntil){s.modifier=modeTally(s.choices,s.votes);s.voteUntil=0;s.roundUntil=g.time+48;g.countdown=3;}return;}
  if(s.roundBreak){g.time+=dt;s.roundBreak=Math.max(0,s.roundBreak-dt);if(!s.roundBreak){
    s.round++;if(g.mode==='duel'){if(s.duelWinner){s.next.push(s.duelWinner);startDuel(g);}else resetDuel(g);}
    else{g.bullets=[];g.drops=[];g.weaponShots={};for(const p of g.players)spawn(g,p);chooseVIPs(g);g.countdown=3;s.roundUntil=g.time+63;}
  }return;}
  if(g.time+dt>=g.duration+3){modeExpire(g);return;}
  const oldAmmo=new Map(g.players.map(p=>[p.id,p.ammo]));
  modeWalls(g);const cover=MAPS[g.map].cover;
  if(s.walls)MAPS[g.map].cover=cover.concat(s.walls);
  try{baseModeStep(g,dt);if(g.countdown<=0)modeUpdate(g,dt);}finally{MAPS[g.map].cover=cover;}
  if(g.mode==='relay')for(const t of [0,1]){
    const holder=modePlayer(g,s.relay[t]);if(holder&&!oldAmmo.get(holder.id)&&holder.ammo){
      const team=living(g).filter(p=>p.team===t),next=team[(team.indexOf(holder)+1)%team.length];
      if(next){for(const p of team)p.ammo=Number(p===next);s.relay[t]=next.id;}
    }
  }
};
botInput=function(g,p,dt){
  const input=baseModeBot(g,p,dt),s=g.modeState;if(!s)return input;
  let target=null,aim=null;
  const opponents=living(g).filter(q=>enemy(g,p,q)),nearest=opponents.sort((a,b)=>dist(p,a)-dist(p,b))[0];
  if(g.mode==='zone')target=s.zone;
  if(g.mode==='last'&&dist(p,s.safe||{x:800,y:500})>(s.safe?.r||900)-75)target=objectivePoint(g);
  if(g.mode==='ball'){
    const goal=s.bases[1-p.team],b=s.ball,d=Math.max(1,dist(goal,b));
    target=safePoint(b.x-(goal.x-b.x)/d*100,b.y-(goal.y-b.y)/d*100,g.map,R);aim=b;
  }
  if(g.mode==='core'){
    const carrier=modePlayer(g,s.core.carrier);
    target=carrier?(carrier===p?s.bases[p.team]:carrier):s.core;
    if(carrier===p)input.shoot=false;
  }
  if(g.mode==='vip'){
    const friendly=modePlayer(g,s.vips[p.team]),enemyVIP=modePlayer(g,s.vips[1-p.team]);
    target=p.id===friendly?.id?(nearest?safePoint(p.x+(p.x-nearest.x),p.y+(p.y-nearest.y),g.map):friendly):p.id.charCodeAt(p.id.length-1)%2?friendly:enemyVIP;
  }
  if(g.mode==='infection'&&p.team===0&&nearest)target=safePoint(p.x+(p.x-nearest.x)*2,p.y+(p.y-nearest.y)*2,g.map);
  if(['hot','tag'].includes(g.mode)&&s.carrier!==p.id){const carrier=modePlayer(g,s.carrier);if(carrier)target=safePoint(p.x+(p.x-carrier.x),p.y+(p.y-carrier.y),g.map);input.shoot=false;}
  if(g.mode==='bounty')target=modePlayer(g,p.bounty);
  if(g.mode==='golden'&&!s.golden.carrier&&!s.golden.flight)target=s.golden;
  const drop=g.drops.find(d=>(d.owner===p.id||(g.mode==='relay'&&modePlayer(g,d.owner)?.team===p.team)));
  if(!p.ammo&&drop)target=drop;
  if(target){
    if(p.brain.objectiveNav===undefined||p.brain.objectiveNav<=g.time){p.brain.objectiveNav=g.time+.5;p.brain.objectivePath=lineClear(g,p,target)?[]:pathTo(g,p,target);}
    const path=p.brain.objectivePath||[];while(path.length&&dist(p,path[0])<30)path.shift();const dest=path[0]||target;
    input.x=dest.x-p.x;input.y=dest.y-p.y;
  }
  if(aim&&p.ammo){input.angle=Math.atan2(aim.y-p.y,aim.x-p.x);input.shoot=dist(p,aim)<350&&lineClear(g,p,aim);}
  if(g.mode==='bank'&&nearest&&p.ammo){
    // Aim at a mirrored enemy position to bank off an arena boundary.
    const mirror=nearest.x<W/2?{x:70-nearest.x,y:nearest.y}:{x:2*(W-35)-nearest.x,y:nearest.y};
    input.angle=Math.atan2(mirror.y-p.y,mirror.x-p.x);input.shoot=input.shoot||p.brain.wait<=0;if(input.shoot)p.brain.wait=1.1;
  }
  return input;
};
snapshot=function(g){const out=baseModeSnapshot(g);if(g.modeState)out.modeState=JSON.parse(JSON.stringify(g.modeState));return out;};
ranking=function(g){
  if(g.modeState?.decided&&!teamMode(g)){return [...g.players].sort((a,b)=>Number(b.id===g.modeState.winner)-Number(a.id===g.modeState.winner)||Number(!b.dead)-Number(!a.dead)||b.stats.score-a.stats.score);}
  return baseModeRanking(g);
};
won=function(g,p){if(g.modeState?.decided)return teamMode(g)?g.modeState.winnerTeam===p.team:g.modeState.winner===p.id;return teamMode(g)?g.teamScore[p.team]>g.teamScore[1-p.team]:ranking(g)[0]?.id===p.id;};

return {MODE_RULES,MODIFIERS,teamMode,noRespawn,modeInit,modeVote,modeTally,modeSpeed,WEAPONS,W,H,R,VERSION,COLORS,MAPS,MODES,dist,clamp,valid,safePoint,createGame,event,addPlayer,spawn,removePlayer,enemy,lineClear,move,fire,damage,melee,dash,collect,step,snapshot,ranking,won};
})();
