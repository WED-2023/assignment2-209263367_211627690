// js/game.js
import { showScreen } from './utils.js';
//import { conf } from './config.js';

// — preload assets —
const eggImg   = new Image(); eggImg.src   = 'assets/img/egg.png';
const enemyImg = new Image(); enemyImg.src = 'assets/img/enemy.png';
let playerImg = new Image();
let themeAudio = null;

// — canvas & HUD —
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const HUD    = {
  scoreEl: document.getElementById('score'),
  livesEl: document.getElementById('lives'),
  timeEl : document.getElementById('time')
};

// — keep canvas size in sync with CSS —
let W = 0, H = 0;
function resizeCanvas() {
  const r = canvas.getBoundingClientRect();
  canvas.width  = r.width;
  canvas.height = r.height;
  W = r.width; H = r.height;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// — game constants —
const ROWS           = 4;
const COLS           = 5;
const ENEMY_W        = 40;
const ENEMY_H        = 30;
const ENEMY_GAP_X    = 20;
const ENEMY_GAP_Y    = 20;
const ENEMY_START_Y  = 60;
const PLAYER_AREA    = 0.4;
const PLAYER_SPEED   = 300;
const BULLET_SPEED   = 450;
const ACCEL_INTERVAL = 5000;
const MAX_ACCEL_STEPS= 4;
const ACCEL_FACTOR   = 1.2;

// — state —
let player, enemies, playerShots, enemyShots;
let fleetOffset, fleetDir, speedX, eggSpeed;
let accelSteps, accelTimerID, gameTimerID;
let shootKey = 'Space', score, lives, timeLeft, lastFrame;
const keys = {};

// — start a new game —
export function startGame(conf) {
  resizeCanvas();
  playerImg = new Image();
  playerImg.src = `assets/img/${conf.spaceshipImg || 'spaceship_blue.png'}`;

  // config
  shootKey = conf.shootKey || 'Space';
  timeLeft = conf.time   || 120;
  score    = 0;
  lives    = 3;

  // init player in bottom 40%
  const pw = 50, ph = 30;
  const minPY = H * (1 - PLAYER_AREA);
  player = {
    w: pw, h: ph,
    x: (W - pw)/2,
    y: minPY + (H - minPY - ph)/2
  };

  playerShots = [];
  enemyShots  = [];
  initEnemies();

  HUD.scoreEl.textContent = `Score: ${score}`;
  HUD.livesEl.textContent = `Lives: ${lives}`;
  HUD.timeEl    .textContent = formatTime(timeLeft);

  // fleet movement
  fleetOffset = 0;
  fleetDir    = 1;
  speedX      = 60;
  eggSpeed    = 260;

  // acceleration (speeds up horizontally & egg speed)
  clearInterval(accelTimerID);
  accelSteps = 0;
  accelTimerID = setInterval(() => {
    if (accelSteps < MAX_ACCEL_STEPS) {
      accelSteps++;
      speedX   *= ACCEL_FACTOR;
      eggSpeed *= ACCEL_FACTOR;
      enemyShots.forEach(b => b.vy *= ACCEL_FACTOR);
    }
  }, ACCEL_INTERVAL);

  // countdown timer
  clearInterval(gameTimerID);
  gameTimerID = setInterval(() => {
    if (--timeLeft <= 0) endGame('time');
    HUD.timeEl.textContent = formatTime(timeLeft);
  }, 1000);

  // input
  window.addEventListener('keydown', handleKey);
  window.addEventListener('keyup',   handleKey);

  lastFrame = performance.now();
  requestAnimationFrame(loop);
  showScreen('game');

  // play theme
  if (themeAudio) {
    themeAudio.pause();
    themeAudio.currentTime = 0;
  }
  themeAudio = new Audio('assets/img/theme.mp3');
  themeAudio.loop = true;
  themeAudio.play();
}

// — lay out 5×4 grid of enemies, centered —
function initEnemies() {
  enemies = [];
  const totalW = COLS * ENEMY_W + (COLS - 1) * ENEMY_GAP_X;
  const startX = (W - totalW) / 2;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = startX + c * (ENEMY_W + ENEMY_GAP_X);
      const y = ENEMY_START_Y + r * (ENEMY_H + ENEMY_GAP_Y);
      enemies.push({ baseX: x, y, row: r, alive: true });
    }
  }
}

// — main game loop —
function loop(ts) {
  resizeCanvas();
  const dt = (ts - lastFrame) / 1000;
  lastFrame = ts;
  update(dt);
  render();
  if (lives > 0 && enemies.some(e => e.alive) && timeLeft > 0) {
    requestAnimationFrame(loop);
  }
}

// — update positions & handle logic —
function update(dt) {
  // player movement
  if (keys.ArrowLeft)  player.x -= PLAYER_SPEED * dt;
  if (keys.ArrowRight) player.x += PLAYER_SPEED * dt;
  if (keys.ArrowUp)    player.y -= PLAYER_SPEED * dt;
  if (keys.ArrowDown)  player.y += PLAYER_SPEED * dt;

  // clamp player
  const minPY = H * (1 - PLAYER_AREA);
  player.x = Math.max(0, Math.min(W - player.w, player.x));
  player.y = Math.max(minPY, Math.min(H - player.h, player.y));

  // move shots
  playerShots.forEach(b => b.y -= BULLET_SPEED * dt);
  enemyShots.forEach(b => b.y += b.vy * dt);

  // move fleet horizontally
  fleetOffset += fleetDir * speedX * dt;

  // on edge, reverse & drop one row
  const alive = enemies.filter(e => e.alive);
  if (alive.length) {
    const xs   = alive.map(e => e.baseX + fleetOffset);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + ENEMY_W;
    if (maxX > W) {
      fleetOffset -= (maxX - W);
      fleetDir = -1;
      enemies.forEach(e => e.y += ENEMY_H);
    } else if (minX < 0) {
      fleetOffset += -minX;
      fleetDir = 1;
      enemies.forEach(e => e.y += ENEMY_H);
    }
  }

  // remove off-screen
  playerShots = playerShots.filter(b => b.y > -10);
  enemyShots  = enemyShots.filter(b => b.y < H + 10);

  maybeShootEnemy();
  checkCollisions();
}

// — draw everything —
function render() {
  ctx.clearRect(0, 0, W, H);

  // draw player as spaceship image
  ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);

  // enemies as transparent PNG
  enemies.forEach(e => {
    if (!e.alive) return;
    const x = e.baseX + fleetOffset;
    ctx.drawImage(enemyImg, x, e.y, ENEMY_W, ENEMY_H);
  });

  // player bullets
  ctx.fillStyle = 'white';
  playerShots.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

  // eggs
  enemyShots.forEach(b => {
    ctx.save();
    ctx.translate(b.x + b.w/2, b.y + b.h/2);
    ctx.rotate(b.rotation);
    ctx.drawImage(eggImg, -b.w/2, -b.h/2, b.w, b.h);
    ctx.restore();
  });
}

// — keyboard handling —
function handleKey(e) {
  const raw = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  const k   = (e.code === 'Space') ? 'Space' : raw;

  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) || k === shootKey) {
    e.preventDefault();
  }
  keys[e.key] = (e.type === 'keydown');
  if (e.type === 'keydown' && k === shootKey) shoot();
}

// — fire player shot —
function shoot() {
  playerShots.push({
    x: player.x + player.w/2 - 2,
    y: player.y,
    w: 4, h: 10
  });
  new Audio('assets/img/shooting.mp3').play();
}

// — enemies drop eggs occasionally —
let lastEgg = 0;
function maybeShootEnemy() {
  const now = performance.now();
  if (now - lastEgg < 800) return;
  lastEgg = now;
  const alive = enemies.filter(e => e.alive);
  if (!alive.length) return;
  const s = alive[Math.floor(Math.random() * alive.length)];
  enemyShots.push({
    x: s.baseX + fleetOffset + ENEMY_W/2 - 10,
    y: s.y + ENEMY_H,
    w: 20, h: 28,
    vy: eggSpeed,
    rotation: 0
  });
}

// — collision detection —
function checkCollisions() {
  // eggs hit player
  for (let i = 0; i < enemyShots.length; i++) {
    const b = enemyShots[i];
    if (rectsOverlap(player, b)) {
      new Audio('assets/img/chickenDeath.mp3').play();
      enemyShots.splice(i--, 1);
      lives--;
      HUD.livesEl.textContent = `Lives: ${lives}`;
      if (lives <= 0) {
        endGame('lives');
        return;
      }
    }
  }
  // bullets hit enemies
  playerShots.forEach(b => {
    enemies.forEach(e => {
      if (!e.alive) return;
      const ex = e.baseX + fleetOffset;
      if (rectsOverlap({ x: ex, y: e.y, w: ENEMY_W, h: ENEMY_H }, b)) {
        new Audio('assets/img/chickenDeath.mp3').play();
        e.alive = false;
        b.y = -100;
        score += (ROWS - e.row) * 5;
        HUD.scoreEl.textContent = `Score: ${score}`;
        if (!enemies.some(en => en.alive)) endGame('win');
      }
    });
  });
}

// — AABB overlap test —
function rectsOverlap(a, b) {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

// — format time mm:ss —
function formatTime(sec) {
  return sec < 60
    ? `0:${sec.toString().padStart(2,'0')}`
    : `${Math.floor(sec/60)}:${(sec % 60).toString().padStart(2,'0')}`;
}

// — end game —
function endGame(reason) {
  clearInterval(gameTimerID);
  clearInterval(accelTimerID);

  if (themeAudio) {
    themeAudio.pause();
    themeAudio.currentTime = 0;
  }

  let msg;
  if (reason === 'lives') msg = 'You Lost!';
  else if (reason === 'time') msg = score < 100 ? 'You can do better' : 'Winner!';
  else msg = 'Champion!';

  alert(`${msg}\nScore: ${score}`);
  showScreen('config');
}
