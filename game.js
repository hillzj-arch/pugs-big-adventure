'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 800, H = 450;
const GRAVITY = 0.5;
const JUMP_FORCE = -13;
const SPEED = 3.5;
const GROUND_Y = 390;
const PLAT_H = 16;
const PW = 38, PH = 44;

let LEVEL_W = 3200;
let currentLevel = 1;

const keys = {}, pressed = {};
window.addEventListener('keydown', e => {
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (e.target.tagName !== 'INPUT' && ['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyZ','KeyX'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

let grounds, platforms, furniture, pictures;
let cats, ants, sausage, boss, tokens, player, cameraX, gameState, score, particles;
let nameEntered = false, deathFormShown = false, enteredName = '', newScoreRank = -1;
let playerName = '';

function makeCat(x, pl, pr, hp, spd, startY) {
  return {x, y: startY !== undefined ? startY : GROUND_Y - 40, w: 36, h: 40, vx: spd, vy: 0,
          patrol:{l:pl, r:pr}, health:hp, maxHealth:hp,
          hitTimer:0, dead:false, facing:1};
}

function makeAnt(x, pl, pr, spd, startY) {
  return {x, y: startY !== undefined ? startY : GROUND_Y - 16, w: 24, h: 16, vx: spd, vy: 0,
          patrol:{l:pl, r:pr}, health:1, maxHealth:1,
          hitTimer:0, dead:false, facing:1};
}

function makeBoss(x) {
  return {x, y: GROUND_Y - 64, w: 54, h: 64, vx: 2.5, vy: 0,
          patrol:{l:3340, r:3520}, health:6, maxHealth:6,
          hitTimer:0, dead:false, facing:1,
          pounceTimer:120, phase:1, onGround:false};
}

function loadScores() {
  try { return JSON.parse(localStorage.getItem('pugHighScores') || '[]'); } catch { return []; }
}
function saveScore(name, sc, lv) {
  const scores = loadScores();
  const entry = {name: name || 'Pug', score: sc, level: lv, _new: true};
  scores.push(entry);
  scores.sort((a,b) => b.score - a.score);
  newScoreRank = scores.findIndex(s => s._new);
  scores.forEach(s => delete s._new);
  if (scores.length > 10) scores.length = 10;
  localStorage.setItem('pugHighScores', JSON.stringify(scores));
}
function showStartScreen() {
  document.getElementById('name-entry-title').textContent = "PUG'S BIG ADVENTURE";
  document.getElementById('name-entry-title').style.color = '#ffcc00';
  document.getElementById('name-entry-subtitle').textContent = 'What is your pug\'s name? (max 20 characters)';
  const div = document.getElementById('name-entry');
  const input = document.getElementById('initials-input');
  div.style.display = 'flex';
  input.value = localStorage.getItem('pugPlayerName') || '';
  input.select();
  setTimeout(() => input.focus(), 50);
  function submit() {
    playerName = input.value.trim() || 'Pug';
    localStorage.setItem('pugPlayerName', playerName);
    div.style.display = 'none';
    for (const k in pressed) delete pressed[k];
    gameState = 'playing';
  }
  document.getElementById('initials-ok').onclick = submit;
  input.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
}

function buildPictures() {
  pictures = [];
  for (let x = 80; x < LEVEL_W - 100; x += 280)
    pictures.push({x, y: 70 + Math.floor(Math.abs(Math.sin(x * 0.02)) * 30), w: 58, h: 44});
}

function loadLevel(n) {
  currentLevel = n;
  if (n === 1) {
    LEVEL_W = 3200;
    grounds = [
      {x:0,    w:520}, {x:640,  w:380}, {x:1080, w:460},
      {x:1620, w:220}, {x:1920, w:520}, {x:2540, w:660},
    ];
    platforms = [
      {x:550, y:300, w:120}, {x:700,  y:270, w:100}, {x:1000, y:290, w:120},
      {x:1200,y:260, w:150}, {x:1400, y:280, w:100}, {x:1600, y:295, w:110},
      {x:1860,y:290, w:110}, {x:2000, y:265, w:140}, {x:2200, y:280, w:120},
      {x:2460,y:300, w:120}, {x:2700, y:270, w:140}, {x:2900, y:285, w:110},
    ];
    furniture = [
      {x:150, y:320,w:180,h:68,type:'couch'}, {x:700, y:330,w:140,h:58,type:'table'},
      {x:1150,y:298,w:80, h:92,type:'shelf'}, {x:1520,y:320,w:190,h:70,type:'couch'},
      {x:2020,y:305,w:80, h:85,type:'shelf'}, {x:2620,y:318,w:170,h:72,type:'couch'},
      {x:2920,y:298,w:80, h:92,type:'shelf'},
    ];
    cats = [
      makeCat(350, 200, 490, 1,1.2),
      makeCat(780, 660, 990, 1,1.4),
      makeCat(1200,1100,1520,2,1.5),
      makeCat(2050,1940,2420,2,1.8),
      makeCat(2710,2560,3170,2,2.2),
      makeCat( 560, 552, 632,1,1.1,260),
      makeCat(1210,1202,1312,1,1.3,220),
      makeCat(2010,2002,2102,2,1.7,225),
    ];
    boss = null; ants = [];
    sausage = {x:3080, y:GROUND_Y-28, w:56, h:24, collected:false};
    tokens = [
      [120,368],[240,368],[380,368],
      [575,278],[618,278],
      [720,248],[755,248],
      [820,368],
      [1022,268],[1058,268],
      [1160,368],[1310,368],
      [1222,238],[1268,238],
      [1680,368],[1780,368],
      [2060,368],[2200,368],
      [2722,248],[2762,248],
      [2870,368],[3025,368],
    ].map(([x,y]) => ({x, y, collected:false}));
  } else if (n === 2) {
    LEVEL_W = 3600;
    grounds = [
      {x:0,    w:380}, {x:500,  w:320}, {x:960,  w:280},
      {x:1380, w:240}, {x:1760, w:320}, {x:2220, w:280}, {x:2640, w:960},
    ];
    platforms = [
      {x:400, y:295,w:120}, {x:840, y:275,w:140}, {x:1260,y:290,w:140},
      {x:1640,y:280,w:140}, {x:2100,y:270,w:140}, {x:2520,y:285,w:140},
      {x:620, y:260,w:100}, {x:1100,y:265,w:100}, {x:1500,y:260,w:110},
      {x:1900,y:268,w:120}, {x:2300,y:273,w:110}, {x:2800,y:268,w:120},
      {x:3000,y:282,w:110}, {x:3200,y:272,w:120},
    ];
    furniture = [
      {x:80,  y:310,w:220,h:80,type:'couch'}, {x:560, y:330,w:140,h:58,type:'table'},
      {x:1010,y:298,w:80, h:92,type:'shelf'}, {x:1420,y:310,w:200,h:80,type:'couch'},
      {x:1810,y:305,w:80, h:85,type:'shelf'}, {x:2260,y:318,w:160,h:72,type:'couch'},
      {x:2680,y:298,w:80, h:92,type:'shelf'}, {x:3100,y:310,w:190,h:72,type:'couch'},
    ];
    cats = [
      makeCat( 150,  20, 360,1,1.6),
      makeCat( 700, 510, 800,2,1.8),
      makeCat(1020, 970,1220,2,2.0),
      makeCat(1820,1770,2060,2,2.2),
      makeCat(2300,2230,2490,2,2.3),
      makeCat(2760,2650,3100,2,2.5),
      makeCat( 420, 402, 482,1,1.3,255),
      makeCat(1280,1262,1362,2,1.7,250),
      makeCat(1660,1642,1742,2,1.9,240),
      makeCat(2540,2522,2622,2,2.0,245),
    ];
    boss = makeBoss(3430); ants = [];
    sausage = {x:3440, y:GROUND_Y-28, w:56, h:24, collected:true};
    tokens = [
      [100,368],[220,368],[320,368],
      [422,273],[458,273],
      [590,368],[710,368],
      [852,253],[892,253],
      [1040,368],
      [1272,268],[1312,268],
      [1460,368],
      [1652,258],[1698,258],
      [1860,368],[1960,368],
      [2112,248],[2158,248],
      [2360,368],
      [2532,263],[2576,263],
      [2760,368],[2910,368],
      [3110,368],[3260,368],
    ].map(([x,y]) => ({x, y, collected:false}));
  } else {
    // Level 3 — Backyard
    LEVEL_W = 4000;
    grounds = [
      {x:0,    w:460}, {x:560,  w:320}, {x:980,  w:300},
      {x:1390, w:280}, {x:1800, w:340}, {x:2270, w:300},
      {x:2700, w:280}, {x:3120, w:880},
    ];
    platforms = [
      {x:482,  y:310, w:100}, {x:902,  y:296, w:120}, {x:1312, y:288, w:110},
      {x:1722, y:300, w:110}, {x:2192, y:290, w:110}, {x:2622, y:298, w:100},
      {x:3044, y:288, w:120}, {x:3220, y:272, w:100}, {x:3420, y:282, w:110},
    ];
    furniture = [
      {x:80,   y:330, w:160, h:60,  type:'bush'},
      {x:620,  y:342, w:120, h:46,  type:'log'},
      {x:1060, y:325, w:80,  h:65,  type:'rock'},
      {x:1460, y:330, w:180, h:60,  type:'bush'},
      {x:1900, y:338, w:120, h:50,  type:'log'},
      {x:2360, y:325, w:80,  h:65,  type:'rock'},
      {x:2760, y:330, w:160, h:60,  type:'bush'},
      {x:3200, y:325, w:80,  h:65,  type:'rock'},
    ];
    boss = null;
    sausage = {x:3870, y:GROUND_Y-28, w:56, h:24, collected:false};
    cats = [];
    ants = [
      makeAnt( 220,  50, 440, 2.2),
      makeAnt( 340,  50, 440, 2.5),
      makeAnt( 660, 560, 860, 2.6),
      makeAnt( 770, 560, 860, 2.8),
      makeAnt(1060, 980,1270, 2.7),
      makeAnt(1160, 980,1270, 2.5),
      makeAnt(1480,1390,1660, 3.0),
      makeAnt(1570,1390,1660, 2.8),
      makeAnt(1960,1800,2160, 2.9),
      makeAnt(2060,1800,2160, 3.1),
      makeAnt(2400,2270,2570, 3.2),
      makeAnt(2470,2270,2570, 3.0),
      makeAnt(2820,2700,2980, 3.3),
      makeAnt(2900,2700,2980, 3.1),
      makeAnt(3250,3120,3600, 3.4),
      makeAnt(3380,3120,3600, 3.2),
      makeAnt(3520,3120,3600, 3.0),
      makeAnt( 494, 482, 574, 2.0, 294),
      makeAnt( 914, 902,1014, 2.2, 280),
      makeAnt(3232,3220,3312, 2.6, 256),
    ];
    tokens = [
      [150,368],[290,368],[410,368],
      [504,292],[542,292],
      [700,368],[840,368],
      [924,278],[962,278],
      [1120,368],[1270,368],
      [1734,282],[1774,282],
      [1920,368],[2070,368],
      [2204,272],[2244,272],
      [2520,368],[2660,368],
      [3056,270],[3096,270],
      [3232,254],[3272,254],
      [3620,368],[3760,368],
    ].map(([x,y]) => ({x, y, collected:false}));
  }
  buildPictures();
}

function resetGame() {
  loadLevel(1);
  player = {x:80, y:GROUND_Y-PH, vx:0, vy:0, onGround:false, facing:1,
            health:3, maxHealth:3, atkTimer:0, atkCool:0, iFrames:0,
            walkFrame:0, walkT:0, lastSafeX:80};
  particles = []; cameraX = 0; score = 0; gameState = 'playing';
  nameEntered = false; deathFormShown = false;
}

function startLevel2() {
  loadLevel(2);
  player.x = 80; player.y = GROUND_Y - PH;
  player.vx = 0; player.vy = 0; player.onGround = false; player.facing = 1;
  player.health = player.maxHealth;
  player.atkTimer = 0; player.atkCool = 0; player.iFrames = 0;
  player.walkFrame = 0; player.walkT = 0; player.lastSafeX = 80;
  particles = []; cameraX = 0; gameState = 'playing';
  nameEntered = false; deathFormShown = false;
}

function startLevel3() {
  loadLevel(3);
  player.x = 80; player.y = GROUND_Y - PH;
  player.vx = 0; player.vy = 0; player.onGround = false; player.facing = 1;
  player.health = player.maxHealth;
  player.atkTimer = 0; player.atkCool = 0; player.iFrames = 0;
  player.walkFrame = 0; player.walkT = 0; player.lastSafeX = 80;
  particles = []; cameraX = 0; gameState = 'playing';
  nameEntered = false; deathFormShown = false;
}

// ─── Physics ─────────────────────────────────────────────────────────────────
function rectsOverlap(ax,ay,aw,ah, bx,by,bw,bh) {
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}

function resolveGround(x, y, w, h, prevY, vy) {
  const bottom = y + h, prevBottom = prevY + h, cx = x + w/2;
  for (const g of grounds) {
    if (cx >= g.x && cx <= g.x + g.w) {
      if (bottom >= GROUND_Y && prevBottom <= GROUND_Y && vy >= 0)
        return {grounded:true, snapY: GROUND_Y - h};
      if (bottom > GROUND_Y && vy >= 0)
        return {grounded:true, snapY: GROUND_Y - h};
    }
  }
  for (const p of platforms) {
    if (x + w > p.x && x < p.x + p.w)
      if (bottom >= p.y && prevBottom <= p.y && vy >= 0)
        return {grounded:true, snapY: p.y - h};
  }
  return {grounded:false, snapY: y};
}

// ─── Particles ───────────────────────────────────────────────────────────────
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI*2*i/n) + Math.random()*0.4; // nosemgrep: semgrep.insecure-random
    const sp = 2 + Math.random()*3; // nosemgrep: semgrep.insecure-random
    particles.push({x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-2,
                    life:35+Math.random()*20, max:55, color, r:3+Math.random()*3}); // nosemgrep: semgrep.insecure-random
  }
}

// ─── Update ──────────────────────────────────────────────────────────────────
function updateBoss() {
  if (!boss || boss.dead) return;

  if (boss.health <= boss.maxHealth/2 && boss.phase === 1) {
    boss.phase = 2;
    boss.pounceTimer = 60;
    burst(boss.x + boss.w/2, boss.y + boss.h/2, '#ff4400', 14);
  }

  const baseSpd = boss.phase === 2 ? 3.2 : 2.5;

  if (boss.phase === 2 && boss.onGround) {
    boss.pounceTimer--;
    if (boss.pounceTimer <= 0) {
      boss.vy = JUMP_FORCE * 0.85;
      boss.vx = (player.x > boss.x ? 1 : -1) * 5.5;
      boss.pounceTimer = 80 + Math.floor(Math.random() * 60); // nosemgrep: semgrep.insecure-random
    }
  }

  boss.x += boss.vx;
  boss.facing = boss.vx > 0 ? 1 : -1;
  if (boss.onGround) {
    if (boss.vx > baseSpd)  boss.vx = Math.max(boss.vx - 0.4, baseSpd);
    if (boss.vx < -baseSpd) boss.vx = Math.min(boss.vx + 0.4, -baseSpd);
  }
  if (boss.x <= boss.patrol.l) { boss.x = boss.patrol.l; boss.vx =  baseSpd; }
  if (boss.x >= boss.patrol.r) { boss.x = boss.patrol.r; boss.vx = -baseSpd; }

  boss.vy += GRAVITY;
  if (boss.vy > 16) boss.vy = 16;
  const prevBY = boss.y;
  boss.y += boss.vy;
  const cr = resolveGround(boss.x, boss.y, boss.w, boss.h, prevBY, boss.vy);
  if (cr.grounded) { boss.y = cr.snapY; boss.vy = 0; boss.onGround = true; }
  else boss.onGround = false;

  if (boss.hitTimer > 0) boss.hitTimer--;

  if (player.atkTimer > 5) {
    const ax = player.facing === 1 ? player.x + PW - 4 : player.x - 54;
    if (rectsOverlap(ax, player.y+4, 54, PH-8, boss.x, boss.y, boss.w, boss.h) && boss.hitTimer === 0) {
      boss.health--;
      boss.hitTimer = 22;
      score += 20;
      burst(boss.x + boss.w/2, boss.y + boss.h/2, '#ff5544', 8);
      if (boss.health <= 0) {
        boss.dead = true;
        sausage.collected = false;
        burst(boss.x + boss.w/2, boss.y + boss.h/2, '#ffaa22', 30);
        burst(boss.x + boss.w/2, boss.y + boss.h/2, '#ff4400', 20);
        score += 150;
      }
    }
  }

  if (player.iFrames <= 0 && rectsOverlap(player.x, player.y, PW, PH, boss.x, boss.y, boss.w, boss.h)) {
    player.health--;
    player.iFrames = 80;
    burst(player.x + PW/2, player.y + PH/2, '#ff6666', 8);
    if (player.health <= 0) { player.health = 0; gameState = 'dead'; }
  }
}

function update() {
  if (gameState !== 'playing') {
    if (gameState === 'nameSetup') {
      for (const k in pressed) delete pressed[k];
      return;
    }
    if ((gameState === 'dead' || gameState === 'win') && !deathFormShown) {
      deathFormShown = true;
      saveScore(playerName, score, currentLevel);
      nameEntered = true;
    }
    if (pressed['Space'] || pressed['Enter']) {
      if (gameState === 'levelComplete') {
        if (currentLevel === 1) startLevel2(); else startLevel3();
      } else if (gameState === 'dead' && nameEntered) {
        if (currentLevel === 3) startLevel3();
        else if (currentLevel === 2) startLevel2();
        else resetGame();
      } else if (gameState === 'win' && nameEntered) resetGame();
    }
    for (const k in pressed) delete pressed[k];
    return;
  }

  let moving = false;
  if (keys['ArrowLeft'] || keys['KeyA'])       { player.vx = -SPEED; player.facing = -1; moving = true; }
  else if (keys['ArrowRight'] || keys['KeyD']) { player.vx =  SPEED; player.facing =  1; moving = true; }
  else { player.vx *= 0.6; if (Math.abs(player.vx) < 0.2) player.vx = 0; }

  if ((pressed['ArrowUp'] || pressed['Space'] || pressed['KeyW']) && player.onGround) {
    player.vy = JUMP_FORCE; player.onGround = false;
  }
  if ((pressed['KeyZ'] || pressed['KeyX']) && player.atkCool <= 0) {
    player.atkTimer = 20; player.atkCool = 28;
  }
  if (player.atkTimer > 0) player.atkTimer--;
  if (player.atkCool  > 0) player.atkCool--;
  if (player.iFrames  > 0) player.iFrames--;

  player.vy += GRAVITY;
  if (player.vy > 16) player.vy = 16;
  player.x = Math.max(0, Math.min(player.x + player.vx, LEVEL_W - PW));
  const prevY = player.y;
  player.y += player.vy;
  const res = resolveGround(player.x, player.y, PW, PH, prevY, player.vy);
  if (res.grounded) { player.y = res.snapY; player.vy = 0; player.onGround = true; }
  else player.onGround = false;

  if (player.onGround) player.lastSafeX = player.x;

  if (player.y > H + 80) {
    player.health--;
    if (player.health <= 0) { player.health = 0; gameState = 'dead'; }
    else {
      player.x = Math.max(0, player.lastSafeX - 40);
      player.y = GROUND_Y - PH;
      player.vx = 0; player.vy = 0;
      player.iFrames = 90;
      cameraX = Math.max(0, player.x - W/2);
    }
  }

  player.walkT++;
  if (moving && player.onGround && player.walkT % 8 === 0)
    player.walkFrame = (player.walkFrame + 1) % 4;
  if (!moving) player.walkFrame = 0;

  cameraX = Math.max(0, Math.min(player.x - W/2 + PW/2, LEVEL_W - W));

  for (const cat of cats) {
    if (cat.dead) continue;
    cat.x += cat.vx;
    cat.facing = cat.vx > 0 ? 1 : -1;
    if (cat.x <= cat.patrol.l) { cat.x = cat.patrol.l; cat.vx =  Math.abs(cat.vx); }
    if (cat.x >= cat.patrol.r) { cat.x = cat.patrol.r; cat.vx = -Math.abs(cat.vx); }
    cat.vy += GRAVITY;
    if (cat.vy > 16) cat.vy = 16;
    const prevCY = cat.y;
    cat.y += cat.vy;
    const cr = resolveGround(cat.x, cat.y, cat.w, cat.h, prevCY, cat.vy);
    if (cr.grounded) { cat.y = cr.snapY; cat.vy = 0; }
    if (cat.hitTimer > 0) cat.hitTimer--;

    if (player.atkTimer > 5) {
      const ax = player.facing === 1 ? player.x + PW - 4 : player.x - 54;
      if (rectsOverlap(ax, player.y+4, 54, PH-8, cat.x, cat.y, cat.w, cat.h) && cat.hitTimer === 0) {
        cat.health--; cat.hitTimer = 22; score += 10;
        burst(cat.x + cat.w/2, cat.y + cat.h/2, '#ff5544', 6);
        if (cat.health <= 0) {
          cat.dead = true;
          burst(cat.x + cat.w/2, cat.y + cat.h/2, '#ffaa22', 14);
          score += 25;
        }
      }
    }
    if (player.iFrames <= 0 && rectsOverlap(player.x, player.y, PW, PH, cat.x, cat.y, cat.w, cat.h)) {
      player.health--; player.iFrames = 80;
      burst(player.x + PW/2, player.y + PH/2, '#ff6666', 8);
      if (player.health <= 0) { player.health = 0; gameState = 'dead'; }
    }
  }

  updateBoss();

  for (const ant of ants) {
    if (ant.dead) continue;
    ant.x += ant.vx;
    ant.facing = ant.vx > 0 ? 1 : -1;
    if (ant.x <= ant.patrol.l) { ant.x = ant.patrol.l; ant.vx =  Math.abs(ant.vx); }
    if (ant.x >= ant.patrol.r) { ant.x = ant.patrol.r; ant.vx = -Math.abs(ant.vx); }
    ant.vy += GRAVITY;
    if (ant.vy > 16) ant.vy = 16;
    const prevAY = ant.y;
    ant.y += ant.vy;
    const ar = resolveGround(ant.x, ant.y, ant.w, ant.h, prevAY, ant.vy);
    if (ar.grounded) { ant.y = ar.snapY; ant.vy = 0; }
    if (ant.hitTimer > 0) ant.hitTimer--;
    if (player.atkTimer > 5) {
      const ax = player.facing === 1 ? player.x + PW - 4 : player.x - 54;
      if (rectsOverlap(ax, player.y+4, 54, PH-8, ant.x, ant.y, ant.w, ant.h) && ant.hitTimer === 0) {
        ant.health--; ant.hitTimer = 22; score += 5;
        burst(ant.x + ant.w/2, ant.y + ant.h/2, '#663300', 4);
        if (ant.health <= 0) {
          ant.dead = true;
          burst(ant.x + ant.w/2, ant.y + ant.h/2, '#996622', 8);
          score += 10;
        }
      }
    }
    if (player.iFrames <= 0 && rectsOverlap(player.x, player.y, PW, PH, ant.x, ant.y, ant.w, ant.h)) {
      player.health--; player.iFrames = 80;
      burst(player.x + PW/2, player.y + PH/2, '#ff6666', 8);
      if (player.health <= 0) { player.health = 0; gameState = 'dead'; }
    }
  }

  for (const tok of tokens) {
    if (!tok.collected && rectsOverlap(player.x, player.y, PW, PH, tok.x-9, tok.y-9, 18, 18)) {
      tok.collected = true;
      score += 2;
      burst(tok.x, tok.y, '#ffcc00', 5);
    }
  }

  if (!sausage.collected && rectsOverlap(player.x, player.y, PW, PH, sausage.x, sausage.y, sausage.w, sausage.h)) {
    sausage.collected = true;
    burst(sausage.x + sausage.w/2, sausage.y + sausage.h/2, '#ffdd00', 22);
    score += 100;
    gameState = currentLevel < 3 ? 'levelComplete' : 'win';
  }

  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.94; p.life--; }
  particles = particles.filter(p => p.life > 0);
  for (const k in pressed) delete pressed[k];
}

// ─── Drawing ─────────────────────────────────────────────────────────────────
function drawBG() {
  const lv2 = currentLevel === 2;
  const lv3 = currentLevel === 3;
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  if (lv3) {
    g.addColorStop(0, '#4488dd'); g.addColorStop(0.7, '#88ccff'); g.addColorStop(1, '#aaddcc');
  } else {
    g.addColorStop(0, lv2 ? '#dce8f5' : '#f0e8d5');
    g.addColorStop(1, lv2 ? '#c8d8ea' : '#e0d0b5');
  }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  if (lv3) {
    // Clouds (parallax at 0.3x)
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    const co = -(cameraX * 0.3) % 260;
    for (let cx = co - 260; cx < W + 260; cx += 260) {
      const cy = 55 + (Math.abs(cx * 0.007) % 40);
      ctx.beginPath(); ctx.ellipse(cx,     cy,    44, 20, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx+34,  cy-10, 32, 15, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx-28,  cy-5,  28, 13, 0, 0, Math.PI*2); ctx.fill();
    }
    // Distant fence (parallax 0.5x)
    const fo = -(cameraX * 0.5) % 56;
    ctx.fillStyle = '#c89050';
    for (let fx = fo - 56; fx < W + 56; fx += 56)
      ctx.fillRect(fx, 290, 7, 70);
    ctx.fillStyle = '#d4a060';
    ctx.fillRect(0, 294, W, 7); ctx.fillRect(0, 330, W, 7);
  } else {
    const sw = 44, off = -(cameraX % (sw*2));
    for (let x = off; x < W; x += sw*2) {
      ctx.fillStyle = lv2 ? 'rgba(80,110,160,0.10)' : 'rgba(160,120,70,0.10)';
      ctx.fillRect(x, 0, sw, GROUND_Y);
    }
    ctx.fillStyle = lv2 ? 'rgba(70,100,180,0.18)' : 'rgba(160,110,60,0.18)';
    for (let wx = -(cameraX % 88); wx < W+88; wx += 88)
      for (let wy = 50; wy < GROUND_Y - 60; wy += 88) {
        ctx.beginPath();
        ctx.moveTo(wx+44,wy); ctx.lineTo(wx+54,wy+10);
        ctx.lineTo(wx+44,wy+20); ctx.lineTo(wx+34,wy+10);
        ctx.closePath(); ctx.fill();
      }
    ctx.fillStyle = lv2 ? '#8898c8' : '#c8a878'; ctx.fillRect(0,0,W,10);
    ctx.fillStyle = lv2 ? '#9aaad8' : '#d4b888'; ctx.fillRect(0,10,W,5);
  }

  for (const pic of pictures) {
    const sx = pic.x - cameraX;
    if (sx < -80 || sx > W+80) continue;
    if (lv3) {
      // Background trees — trunk anchored to ground
      const tx = sx + pic.w / 2;
      const trunkH = 60 + (pic.x % 28);
      const r1 = 24 + (pic.x % 10);
      ctx.fillStyle = '#5c3a10';
      ctx.fillRect(tx - 5, GROUND_Y - trunkH, 10, trunkH);
      ctx.fillStyle = '#227730';
      ctx.beginPath(); ctx.arc(tx, GROUND_Y - trunkH - r1 * 0.55, r1, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#33aa44';
      ctx.beginPath(); ctx.arc(tx - 7, GROUND_Y - trunkH - r1 * 1.05, r1 * 0.62, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle = lv2 ? '#3a5070' : '#7a5c28'; ctx.fillRect(sx-4, pic.y-4, pic.w+8, pic.h+8);
      ctx.fillStyle = lv2 ? '#dce8f8' : '#e8d4a0'; ctx.fillRect(sx, pic.y, pic.w, pic.h);
      ctx.fillStyle = lv2 ? '#4060a0' : '#70a050'; ctx.fillRect(sx+4, pic.y+4, pic.w-8, pic.h-8);
      ctx.fillStyle = lv2 ? '#2040a8' : '#408028';
      ctx.beginPath(); ctx.arc(sx+pic.w/2, pic.y+pic.h/2, pic.h/3, 0, Math.PI*2); ctx.fill();
    }
  }
  for (const f of furniture) {
    const sx = f.x - cameraX;
    if (sx < -260 || sx > W+260) continue;
    drawFurniture(sx, f.y, f.w, f.h, f.type);
  }
}

function drawFurniture(x, y, w, h, type) {
  const lv2 = currentLevel === 2;
  if (type === 'couch') {
    ctx.fillStyle = lv2 ? '#446688' : '#8b6844'; ctx.fillRect(x, y+h*0.3, w, h*0.7);
    ctx.fillStyle = lv2 ? '#335577' : '#7a5834';
    ctx.fillRect(x, y, w*0.14, h); ctx.fillRect(x+w-w*0.14, y, w*0.14, h);
    ctx.fillRect(x+w*0.14, y, w*0.72, h*0.45);
    ctx.fillStyle = lv2 ? '#224466' : '#5a3818';
    ctx.fillRect(x+w*0.06, y+h*0.86, w*0.14, h*0.14);
    ctx.fillRect(x+w*0.80, y+h*0.86, w*0.14, h*0.14);
  } else if (type === 'table') {
    ctx.fillStyle = lv2 ? '#335570' : '#7a5c28'; ctx.fillRect(x, y, w, h*0.14);
    ctx.fillStyle = lv2 ? '#224460' : '#6a4c18';
    ctx.fillRect(x+w*0.08, y+h*0.14, w*0.12, h*0.86);
    ctx.fillRect(x+w*0.80, y+h*0.14, w*0.12, h*0.86);
  } else if (type === 'bush') {
    ctx.fillStyle = '#1e6614';
    ctx.beginPath(); ctx.ellipse(x+w*0.28, y+h*0.6,  w*0.30, h*0.50, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+w*0.68, y+h*0.65, w*0.28, h*0.46, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2e8820';
    ctx.beginPath(); ctx.ellipse(x+w*0.50, y+h*0.42, w*0.34, h*0.44, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#3eaa2c';
    ctx.beginPath(); ctx.ellipse(x+w*0.46, y+h*0.26, w*0.22, h*0.28, 0, 0, Math.PI*2); ctx.fill();
  } else if (type === 'log') {
    ctx.fillStyle = '#6a3c10';
    ctx.beginPath(); ctx.roundRect(x, y+h*0.22, w, h*0.52, 5); ctx.fill();
    ctx.fillStyle = '#8a5828';
    ctx.beginPath(); ctx.ellipse(x+9,   y+h*0.48, 9,   h*0.27, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+w-9, y+h*0.48, 9,   h*0.27, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#4a2808'; ctx.lineWidth = 1.5;
    for (let ly = y+h*0.28; ly < y+h*0.68; ly += 8) {
      ctx.beginPath(); ctx.moveTo(x+18, ly); ctx.lineTo(x+w-18, ly); ctx.stroke();
    }
    ctx.fillStyle = '#3a8018';
    ctx.beginPath(); ctx.ellipse(x+w*0.5, y+h*0.22, w*0.38, 7, 0, 0, Math.PI*2); ctx.fill();
  } else if (type === 'rock') {
    ctx.fillStyle = '#7a7a72';
    ctx.beginPath(); ctx.ellipse(x+w*0.5, y+h*0.62, w*0.44, h*0.44, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#a0a098';
    ctx.beginPath(); ctx.ellipse(x+w*0.38, y+h*0.45, w*0.28, h*0.28, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#909088';
    ctx.beginPath(); ctx.ellipse(x+w*0.66, y+h*0.52, w*0.18, h*0.20, 0.2, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#606058'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x+w*0.44, y+h*0.38); ctx.lineTo(x+w*0.54, y+h*0.66); ctx.stroke();
  } else {
    ctx.fillStyle = lv2 ? '#335578' : '#6a4c18'; ctx.fillRect(x, y, w, h);
    const colors = ['#e44','#e84','#4a8','#48e','#a4e','#ea4','#e48'];
    let bx = x+4;
    for (let i = 0; i < 14; i++) {
      const bw = 6+(i%3)*2, bh = 12+(i%4)*3;
      ctx.fillStyle = colors[i%colors.length];
      ctx.fillRect(bx, y + h*(Math.floor(i/5)+1)*0.28 - bh, bw, bh);
      bx += bw+1; if (bx > x+w-12) bx = x+4;
    }
    for (let s = 1; s <= 2; s++) {
      ctx.fillStyle = lv2 ? '#223355' : '#4a3008'; ctx.fillRect(x, y+h*s*0.3, w, 3);
    }
  }
}

function drawGround() {
  const lv2 = currentLevel === 2;
  const lv3 = currentLevel === 3;
  const fg = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  if (lv3) {
    fg.addColorStop(0, '#5a9e28'); fg.addColorStop(0.18, '#3a7010'); fg.addColorStop(1, '#1a3a08');
  } else {
    fg.addColorStop(0,   lv2 ? '#607080' : '#9a7420');
    fg.addColorStop(0.3, lv2 ? '#485868' : '#7a5810');
    fg.addColorStop(1,   lv2 ? '#283848' : '#4a3408');
  }
  for (const g of grounds) {
    const sx = g.x - cameraX;
    if (sx + g.w < 0 || sx > W) continue;
    ctx.fillStyle = fg; ctx.fillRect(sx, GROUND_Y, g.w, H - GROUND_Y);
    if (lv3) {
      ctx.fillStyle = '#6ab830'; ctx.fillRect(sx, GROUND_Y-8, g.w, 8);
      ctx.fillStyle = '#7acc40'; ctx.fillRect(sx, GROUND_Y-10, g.w, 2);
      ctx.fillStyle = '#4a9018'; ctx.lineWidth = 1;
      for (let px = 4; px < g.w; px += 10) {
        const psx = g.x + px - cameraX;
        ctx.fillRect(psx, GROUND_Y-14, 2, 6);
      }
    } else {
      ctx.strokeStyle = lv2 ? '#485868' : '#6a4c0c'; ctx.lineWidth = 1;
      for (let px = 0; px < g.w; px += 80) {
        const psx = g.x + px - cameraX;
        ctx.strokeRect(psx, GROUND_Y+2,  Math.min(80,g.w-px), 18);
        ctx.strokeRect(psx, GROUND_Y+22, Math.min(80,g.w-px), 16);
      }
      ctx.fillStyle = lv2 ? '#8898b8' : '#c8a050'; ctx.fillRect(sx, GROUND_Y-7, g.w, 7);
      ctx.fillStyle = lv2 ? '#9aaac8' : '#d8b060'; ctx.fillRect(sx, GROUND_Y-9, g.w, 2);
    }
  }
}

function drawPlatforms() {
  const lv2 = currentLevel === 2;
  const lv3 = currentLevel === 3;
  for (const p of platforms) {
    const sx = p.x - cameraX;
    if (sx + p.w < 0 || sx > W) continue;
    if (lv3) {
      ctx.fillStyle = '#7a8060'; ctx.fillRect(sx, p.y, p.w, PLAT_H);
      ctx.fillStyle = '#5a8828'; ctx.fillRect(sx, p.y, p.w, 5);
      ctx.fillStyle = '#626850'; ctx.fillRect(sx + p.w*0.28, p.y+5, p.w*0.44, PLAT_H-5);
      ctx.fillStyle = '#9aaa70'; ctx.fillRect(sx, p.y, p.w, 2);
    } else {
      ctx.fillStyle = lv2 ? '#4a6888' : '#8b6920'; ctx.fillRect(sx, p.y, p.w, PLAT_H);
      ctx.fillStyle = lv2 ? '#8898c8' : '#c8a050'; ctx.fillRect(sx, p.y, p.w, 4);
      ctx.fillStyle = lv2 ? '#223348' : '#5a3c08';
      ctx.fillRect(sx, p.y+PLAT_H-2, p.w, 2);
      ctx.fillRect(sx+6, p.y+PLAT_H, 5, 10);
      ctx.fillRect(sx+p.w-11, p.y+PLAT_H, 5, 10);
    }
  }
}

function drawTokens() {
  const t = Date.now() / 400;
  tokens.forEach((tok, i) => {
    if (tok.collected) return;
    const sx = tok.x - cameraX;
    if (sx < -20 || sx > W+20) return;
    const sy = tok.y + Math.sin(t + i) * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(sx, sy+11, 7, 2.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffee66';
    ctx.beginPath(); ctx.arc(sx-2.5, sy-2.5, 4.5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#bb8800'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = '#7a4400'; ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center'; ctx.fillText('P', sx, sy+3); ctx.textAlign = 'left';
  });
}

function drawSausage() {
  if (sausage.collected) return;
  const sx = sausage.x - cameraX;
  if (sx < -80 || sx > W+80) return;
  const bob = Math.sin(Date.now()/280)*3;
  const sy = sausage.y + bob;
  ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 14;
  ctx.fillStyle = '#8b3a10';
  ctx.beginPath(); ctx.ellipse(sx+sausage.w/2, sy+sausage.h/2, sausage.w/2, sausage.h/2, 0.25, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#c05520';
  ctx.beginPath(); ctx.ellipse(sx+sausage.w/2-6, sy+sausage.h/2-5, sausage.w/3.5, sausage.h/3.5, 0.25, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#7a2a08';
  ctx.beginPath(); ctx.arc(sx+9, sy+sausage.h/2, 8, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx+sausage.w-7, sy+sausage.h/2, 7, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffdd00'; ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center'; ctx.fillText('SAUSAGE!', sx+sausage.w/2, sy-6); ctx.textAlign = 'left';
}

function drawPug() {
  const p = player, sx = p.x - cameraX;
  if (p.iFrames > 0 && Math.floor(p.iFrames/4)%2===1) return;
  ctx.save();
  ctx.translate(sx + PW/2, p.y + PH);
  if (p.facing === -1) ctx.scale(-1, 1);
  const leg = (p.onGround && p.walkFrame%2===0) ? 2 : 0;
  ctx.fillStyle = '#c0986a'; ctx.fillRect(3, -10, 8, 10+leg);
  ctx.fillStyle = '#d4aa7e'; ctx.beginPath(); ctx.roundRect(-14,-30,28,22,5); ctx.fill();
  ctx.strokeStyle = '#d4aa7e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-16,-20,9,Math.PI*0.85,Math.PI*0.1,true); ctx.stroke();
  ctx.fillStyle = '#c0986a'; ctx.fillRect(-11,-10,8,10-leg);
  ctx.fillStyle = '#c8a06e'; ctx.beginPath(); ctx.roundRect(-13,-52,26,24,4); ctx.fill();
  ctx.fillStyle = '#5c3820';
  ctx.beginPath(); ctx.roundRect(-16,-56,10,13,3); ctx.fill();
  ctx.beginPath(); ctx.roundRect(6,-56,10,13,3); ctx.fill();
  ctx.fillStyle = '#b8906a'; ctx.fillRect(-10,-52,20,5);
  ctx.fillStyle = '#fff8f0';
  ctx.beginPath(); ctx.ellipse(-6,-42,4.5,4.5,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 6,-42,4.5,4.5,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#180800';
  ctx.beginPath(); ctx.ellipse(-5.5,-42,3.5,3.5,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 6.5,-42,3.5,3.5,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(-7,-44,2,2); ctx.fillRect(5,-44,2,2);
  ctx.fillStyle = '#e0c090'; ctx.beginPath(); ctx.roundRect(-9,-36,18,9,4); ctx.fill();
  ctx.fillStyle = '#281808'; ctx.beginPath(); ctx.roundRect(-6,-36,12,6,2); ctx.fill();
  ctx.fillStyle = '#382818'; ctx.fillRect(-5,-35,3,2); ctx.fillRect(2,-35,3,2);
  // Collar band
  ctx.fillStyle = '#dd1144';
  ctx.beginPath(); ctx.roundRect(-13,-32,26,5,2); ctx.fill();
  // Buckle
  ctx.fillStyle = '#ffcc00'; ctx.fillRect(-2,-34,4,9);
  ctx.strokeStyle = '#aa7700'; ctx.lineWidth = 0.8; ctx.strokeRect(-2,-34,4,9);
  // Chain to tag
  ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,-27); ctx.lineTo(0,-23); ctx.stroke();
  // Tag
  const tagText = playerName.length > 8 ? playerName.slice(0,7) + '.' : playerName;
  const tagW = Math.max(20, tagText.length * 5 + 8);
  ctx.fillStyle = '#ffee88';
  ctx.beginPath(); ctx.roundRect(-tagW/2,-23,tagW,10,3); ctx.fill();
  ctx.strokeStyle = '#cc9900'; ctx.lineWidth = 1; ctx.stroke();
  ctx.save();
  if (p.facing === -1) ctx.scale(-1,1);
  ctx.fillStyle = '#664400'; ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center'; ctx.fillText(tagText, 0,-16); ctx.textAlign = 'left';
  ctx.restore();
  if (p.atkTimer > 5) {
    ctx.strokeStyle = 'rgba(255,255,160,0.92)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(15,-26+i*8); ctx.lineTo(36+(i===1?5:0),-33+i*8); ctx.stroke();
    }
    ctx.fillStyle = '#c0986a'; ctx.fillRect(13,-28,10,10);
  }
  ctx.restore();
}

function drawAnt(ant) {
  if (ant.dead) return;
  const sx = ant.x - cameraX;
  if (sx < -40 || sx > W+40) return;
  const {w, h} = ant;
  ctx.save(); ctx.translate(sx + w/2, ant.y);
  if (ant.facing === -1) ctx.scale(-1,1);
  if (ant.hitTimer > 0 && Math.floor(ant.hitTimer/3)%2===1) {
    ctx.fillStyle = 'rgba(255,80,40,0.85)'; ctx.fillRect(-w/2,0,w,h);
    ctx.restore(); return;
  }
  // Abdomen
  ctx.fillStyle = '#1a0e00';
  ctx.beginPath(); ctx.ellipse(w*0.22, h*0.52, 7, 5.5, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#2a1800';
  ctx.beginPath(); ctx.ellipse(w*0.22, h*0.38, 5, 4, 0, 0, Math.PI*2); ctx.fill();
  // Thorax
  ctx.fillStyle = '#221000';
  ctx.beginPath(); ctx.ellipse(-1, h*0.5, 3.5, 3, 0, 0, Math.PI*2); ctx.fill();
  // Head
  ctx.fillStyle = '#1a0a00';
  ctx.beginPath(); ctx.ellipse(-w*0.30, h*0.44, 4.5, 3.8, 0, 0, Math.PI*2); ctx.fill();
  // Eye
  ctx.fillStyle = '#cc1a00';
  ctx.beginPath(); ctx.arc(-w*0.36, h*0.3, 1.8, 0, Math.PI*2); ctx.fill();
  // Antennae
  ctx.strokeStyle = '#1a0a00'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-w*0.3, h*0.22);
  ctx.quadraticCurveTo(-w*0.52, h*0.0, -w*0.58, -h*0.08); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-w*0.28, h*0.20);
  ctx.quadraticCurveTo(-w*0.20, -h*0.08, -w*0.14, -h*0.14); ctx.stroke();
  // Legs
  ctx.lineWidth = 0.8;
  for (const [lx, ly] of [[-3, h*0.44], [0, h*0.5], [4, h*0.56]]) {
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - 7, h+2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 7, h+2); ctx.stroke();
  }
  ctx.restore();
}

function drawCat(cat) {
  if (cat.dead) return;
  const sx = cat.x - cameraX;
  if (sx < -60 || sx > W+60) return;
  const {w, h} = cat;
  ctx.save(); ctx.translate(sx + w/2, cat.y);
  if (cat.facing === -1) ctx.scale(-1,1);
  if (cat.hitTimer > 0 && Math.floor(cat.hitTimer/3)%2===1) {
    ctx.fillStyle = 'rgba(255,100,80,0.85)'; ctx.fillRect(-w/2,0,w,h);
    ctx.restore(); return;
  }
  const base = cat.maxHealth >= 2 ? '#bb7700' : '#aaa';
  const dark = cat.maxHealth >= 2 ? '#886600' : '#888';
  ctx.fillStyle = dark; ctx.fillRect(-w/2+2,h-10,8,10); ctx.fillRect(w/2-10,h-10,8,10);
  ctx.fillStyle = base; ctx.fillRect(-w/2,h*0.35,w,h*0.58);
  ctx.fillStyle = cat.maxHealth >= 2 ? '#ddaa44' : '#ccc'; ctx.fillRect(-w/2+5,h*0.45,w-10,h*0.35);
  ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-w/2+2,h*0.55); ctx.quadraticCurveTo(-w/2-12,h*0.25,-w/2-4,h*0.05); ctx.stroke();
  ctx.fillStyle = cat.maxHealth >= 2 ? '#cc8800' : '#aaa'; ctx.fillRect(-w/2+3,2,w-6,h*0.40);
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.moveTo(-w/2+3,2); ctx.lineTo(-w/2-5,-13); ctx.lineTo(-w/2+13,2); ctx.fill();
  ctx.beginPath(); ctx.moveTo( w/2-3,2); ctx.lineTo( w/2+5,-13); ctx.lineTo( w/2-13,2); ctx.fill();
  ctx.fillStyle = '#e899aa';
  ctx.beginPath(); ctx.moveTo(-w/2+5,2); ctx.lineTo(-w/2-1,-7); ctx.lineTo(-w/2+10,2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.fillRect(-w/2+5,8,8,7); ctx.fillRect(w/2-13,8,8,7);
  ctx.fillStyle = cat.maxHealth >= 2 ? '#ffaa00' : '#44ff44';
  ctx.fillRect(-w/2+6,9,6,5); ctx.fillRect(w/2-12,9,6,5);
  ctx.fillStyle = '#000'; ctx.fillRect(-w/2+8,9,2,5); ctx.fillRect(w/2-10,9,2,5);
  ctx.fillStyle = '#cc8899'; ctx.fillRect(-3,19,6,4);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-2,21); ctx.lineTo(-w/2-6,18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-2,22); ctx.lineTo(-w/2-5,25); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 2,21); ctx.lineTo( w/2+6,18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 2,22); ctx.lineTo( w/2+5,25); ctx.stroke();
  if (cat.health < cat.maxHealth) {
    const bw = w+8;
    ctx.fillStyle = '#400'; ctx.fillRect(-bw/2-1,-19,bw+2,7);
    ctx.fillStyle = '#f44'; ctx.fillRect(-bw/2,-18,bw*cat.health/cat.maxHealth,5);
  }
  ctx.restore();
}

function drawBoss() {
  if (!boss || boss.dead) return;
  const sx = boss.x - cameraX;
  if (sx < -80 || sx > W+80) return;
  const {w, h} = boss;
  ctx.save(); ctx.translate(sx + w/2, boss.y);
  if (boss.facing === -1) ctx.scale(-1,1);
  if (boss.hitTimer > 0 && Math.floor(boss.hitTimer/3)%2===1) {
    ctx.fillStyle = 'rgba(255,100,80,0.85)'; ctx.fillRect(-w/2,0,w,h);
    ctx.restore(); return;
  }
  const ph2 = boss.phase === 2;
  const base = ph2 ? '#8b1a00' : '#aa3300';
  const dark = ph2 ? '#5a0800' : '#771800';

  ctx.fillStyle = dark; ctx.fillRect(-w/2+3,h-14,11,14); ctx.fillRect(w/2-14,h-14,11,14);
  ctx.fillStyle = base; ctx.fillRect(-w/2,h*0.35,w,h*0.58);
  ctx.fillStyle = ph2 ? '#cc3300' : '#dd5522'; ctx.fillRect(-w/2+7,h*0.45,w-14,h*0.35);
  ctx.strokeStyle = dark; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-w/2+3,h*0.55); ctx.quadraticCurveTo(-w/2-18,h*0.25,-w/2-6,h*0.05); ctx.stroke();
  ctx.fillStyle = ph2 ? '#9b2200' : '#bb4400'; ctx.fillRect(-w/2+4,3,w-8,h*0.40);
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.moveTo(-w/2+4,3); ctx.lineTo(-w/2-7,-18); ctx.lineTo(-w/2+18,3); ctx.fill();
  ctx.beginPath(); ctx.moveTo( w/2-4,3); ctx.lineTo( w/2+7,-18); ctx.lineTo( w/2-18,3); ctx.fill();
  ctx.fillStyle = '#e888aa';
  ctx.beginPath(); ctx.moveTo(-w/2+8,3); ctx.lineTo(-w/2-1,-10); ctx.lineTo(-w/2+14,3); ctx.fill();
  ctx.fillStyle = '#ffcc00'; ctx.fillRect(-w/2+4,-20,w-8,9);
  for (const px of [-w/2+9, -w/2+w*0.35, w/2-w*0.35, w/2-9]) {
    ctx.beginPath(); ctx.moveTo(px-5,-20); ctx.lineTo(px,-34); ctx.lineTo(px+5,-20); ctx.fill();
  }
  ctx.fillStyle = '#ff2200'; ctx.beginPath(); ctx.arc(0,-27,4,0,Math.PI*2); ctx.fill();
  const glow = ph2 ? '#ff2200' : '#ff6600';
  ctx.fillStyle = '#300'; ctx.fillRect(-w/2+8,10,12,10); ctx.fillRect(w/2-20,10,12,10);
  ctx.fillStyle = glow; ctx.shadowColor = glow; ctx.shadowBlur = 10;
  ctx.fillRect(-w/2+9,11,10,8); ctx.fillRect(w/2-19,11,10,8);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#000'; ctx.fillRect(-w/2+12,11,4,8); ctx.fillRect(w/2-16,11,4,8);
  ctx.fillStyle = '#cc5566'; ctx.fillRect(-5,28,10,5);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-4,31); ctx.lineTo(-w/2-12,27); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4,33); ctx.lineTo(-w/2-10,38); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 4,31); ctx.lineTo( w/2+12,27); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 4,33); ctx.lineTo( w/2+10,38); ctx.stroke();
  const bw = w+24;
  ctx.fillStyle = '#400'; ctx.fillRect(-bw/2-1,-52,bw+2,13);
  ctx.fillStyle = ph2 ? '#ff2200' : '#ff6600';
  ctx.fillRect(-bw/2,-51,bw*boss.health/boss.maxHealth,11);
  ctx.fillStyle = '#ffdd00'; ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center'; ctx.fillText('BOSS CAT', 0,-41); ctx.textAlign = 'left';
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life/p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x - cameraX, p.y, p.r*(p.life/p.max), 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHeart(x, y, size, filled) {
  ctx.save(); ctx.translate(x+size/2, y+size/2);
  const s = size/20;
  ctx.beginPath();
  ctx.moveTo(0,s*5);
  ctx.bezierCurveTo(s*8,-s*2,s*16,s*6,0,s*16);
  ctx.bezierCurveTo(-s*16,s*6,-s*8,-s*2,0,s*5);
  ctx.fillStyle = filled ? '#ee2244' : 'rgba(255,255,255,0.18)'; ctx.fill();
  ctx.strokeStyle = filled ? '#cc1133' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  for (let i = 0; i < player.maxHealth; i++) drawHeart(10+i*28, 10, 24, i < player.health);
  ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left'; ctx.fillText(playerName, 12, 55);
  ctx.fillStyle = '#fff8e7'; ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center'; ctx.fillText('LVL ' + currentLevel, W/2, 26);
  ctx.textAlign = 'right';  ctx.fillText('Score: ' + score, W-10, 26);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(10, H-18, W-20, 8);
  ctx.fillStyle = currentLevel === 2 ? '#8898c8' : '#c8a050';
  ctx.fillRect(10, H-18, (player.x/LEVEL_W)*(W-20), 8);
  if (!sausage.collected) {
    ctx.fillStyle = '#ffdd00';
    ctx.fillRect(10+(sausage.x/LEVEL_W)*(W-20)-2, H-20, 4, 12);
  }
  if (boss && !boss.dead) {
    ctx.fillStyle = '#ff3300';
    ctx.fillRect(10+(boss.x/LEVEL_W)*(W-20)-3, H-21, 6, 14);
  }
}

function drawHighScores(title, titleColor) {
  const scores = loadScores();
  ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = titleColor; ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center'; ctx.fillText(title, W/2, 68);
  ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 17px monospace';
  ctx.fillText('HIGH SCORES', W/2, 104);
  ctx.fillStyle = '#c8a050'; ctx.fillRect(W/2-195, 113, 390, 2);
  const shown = scores.slice(0, 8);
  shown.forEach((s, i) => {
    const y = 140 + i*27;
    const hi = i === newScoreRank;
    ctx.fillStyle = hi ? '#ffdd00' : (i%2===0 ? '#fff8e7' : '#bba888');
    ctx.font = (hi ? 'bold ' : '') + '13px monospace';
    const displayName = s.name.length > 16 ? s.name.slice(0,15) + '.' : s.name;
    ctx.textAlign = 'left';  ctx.fillText(`${i+1}. ${displayName}`, W/2-190, y);
    ctx.textAlign = 'center'; ctx.fillText(`LVL${s.level}`, W/2+60, y);
    ctx.textAlign = 'right'; ctx.fillText(String(s.score).padStart(5), W/2+190, y);
  });
  ctx.fillStyle = '#888'; ctx.font = '13px monospace';
  ctx.textAlign = 'center'; ctx.fillText('Press SPACE to try again', W/2, H-18);
  ctx.textAlign = 'left';
}

function drawOverlay(title, sub1, sub2, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.58)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = color; ctx.font = 'bold 50px monospace';
  ctx.textAlign = 'center'; ctx.fillText(title, W/2, H/2-28);
  ctx.fillStyle = '#fff8e7'; ctx.font = '22px monospace'; ctx.fillText(sub1, W/2, H/2+14);
  ctx.fillStyle = '#aaa';    ctx.font = '14px monospace'; ctx.fillText(sub2, W/2, H/2+48);
  ctx.textAlign = 'left';
}

function draw() {
  ctx.clearRect(0,0,W,H);
  drawBG(); drawGround(); drawPlatforms(); drawTokens(); drawSausage();
  for (const cat of cats) drawCat(cat);
  for (const ant of ants) drawAnt(ant);
  drawBoss(); drawPug(); drawParticles(); drawHUD();
  if (gameState === 'dead' && nameEntered) drawHighScores('WOOF!', '#ff4444');
  if (gameState === 'win'  && nameEntered) drawHighScores('SAUSAGE GET!', '#ffcc00');
  if (gameState === 'levelComplete') {
    const nxt = currentLevel === 1 ? 'Level 2' : 'Level 3';
    drawOverlay(`LEVEL ${currentLevel} CLEAR!`, 'Score: ' + score, `Press SPACE for ${nxt}!`, '#ffcc00');
  }
}

// ─── Loop ────────────────────────────────────────────────────────────────────
resetGame();
gameState = 'nameSetup';
showStartScreen();
(function loop() { update(); draw(); requestAnimationFrame(loop); })();
