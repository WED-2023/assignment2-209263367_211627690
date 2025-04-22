// js/game.js
import { showScreen, playSound } from './utils.js';

// preload the egg sprite
const eggImg = new Image();
eggImg.src = 'assets/img/egg.png';

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const HUD    = {
  scoreEl: document.getElementById('score'),
  livesEl: document.getElementById('lives'),
  timeEl : document.getElementById('time')
};

// screen size
let W = canvas.width, H = canvas.height;
function resizeCanvas() {
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  if (cw > 0 && ch > 0 && (canvas.width !== cw || canvas.height !== ch)) {
    canvas.width  = cw;
    canvas.height = ch;
    W = cw; H = ch;
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// grid
const ROWS = 4, COLS = 5;
const ENEMY_WIDTH  = 40, ENEMY_HEIGHT = 30;

// player constants
const PLAYER_AREA  = 0.4;
const PLAYER_SPEED = 300;
const BULLET_SPEED = 450;

// enemy bullet speed
let eggSpeed    = 260;

// fleet movement & acceleration
let fleetOffset = 0;
let fleetDir    = 1;
let vDir        = 1;
let speedX      = 60;
let speedY      = 20;
const ACCEL_INTERVAL   = 5000;
const MAX_ACCEL_STEPS  = 4;
const ACCEL_FACTOR     = 1.2;
let accelSteps   = 0;
let accelTimerID = null;

// enemy vertical bounds
let initialMinEnemyY = 0;

let player, enemies, playerShots, enemyShots;
let score, lives, timeLeft;
let shootKey = 'Space';       // comes from config
let lastFrame = 0, gameTimerID;

// Start a new game with the provided config
export function startGame(conf) {
  resizeCanvas();
  // load configured shoot key
  shootKey = conf.shootKey || 'Space';
  timeLeft = conf.time   || 120;
  score    = 0;
  lives    = 3;

  // initialize player at a random position within the bottom 40%
  const pw = 50, ph = 30;
  const areaTop = H * (1 - PLAYER_AREA);
  const areaHeight = PLAYER_AREA * H - ph;
  player = {
    w: pw,
    h: ph,
    x: Math.random() * (W - pw),
    y: areaTop + Math.random() * areaHeight
  };

  playerShots = [];
  enemyShots  = [];
  initEnemies();

  HUD.scoreEl.textContent = `Score: ${score}`;
  HUD.livesEl.textContent = `Lives: ${lives}`;
  HUD.timeEl.textContent  = formatTime(timeLeft);

  // reset acceleration
  clearInterval(accelTimerID);
  accelSteps = 0;
  speedX = 60; speedY = 20; eggSpeed = 260; vDir = 1;
  accelTimerID = setInterval(() => {
    if (accelSteps < MAX_ACCEL_STEPS) {
      accelSteps++;
      speedX *= ACCEL_FACTOR;
      speedY *= ACCEL_FACTOR;
      eggSpeed *= ACCEL_FACTOR;
      enemyShots.forEach(b => b.vy *= ACCEL_FACTOR);
    }
  }, ACCEL_INTERVAL);

  // game timer
  clearInterval(gameTimerID);
  gameTimerID = setInterval(() => {
    if (--timeLeft <= 0) endGame('time');
    HUD.timeEl.textContent = formatTime(timeLeft);
  }, 1000);

  window.addEventListener('keydown', handleKey);
  window.addEventListener('keyup',   handleKey);

  lastFrame = performance.now();
  requestAnimationFrame(loop);
  showScreen('game');
}

function initEnemies() {
  enemies = [];
  const gapX   = W / (COLS + 1);
  const startY = H * 0.10;
  const gapY   = H * 0.08;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = gapX * (c + 1);
      const y = startY + r * gapY;
      enemies.push({ baseX: x, y, row: r, alive: true });
    }
  }
  initialMinEnemyY = Math.min(...enemies.map(e => e.y));
}

function loop(ts) {
  const dt = (ts - lastFrame) / 1000;
  lastFrame = ts;
  update(dt);
  render();
  if (lives > 0 && enemies.some(e => e.alive) && timeLeft > 0) {
    requestAnimationFrame(loop);
  }
}

function update(dt) {
  // player movement
  if (keys.ArrowLeft)  player.x -= PLAYER_SPEED * dt;
  if (keys.ArrowRight) player.x += PLAYER_SPEED * dt;
  if (keys.ArrowUp)    player.y -= PLAYER_SPEED * dt;
  if (keys.ArrowDown)  player.y += PLAYER_SPEED * dt;
  const minPY = H * (1 - PLAYER_AREA);
  player.x = Math.max(0, Math.min(W - player.w, player.x));
  player.y = Math.max(minPY, Math.min(H - player.h, player.y));

  // move player bullets
  playerShots.forEach(b => b.y -= BULLET_SPEED * dt);

  // move enemy eggs
  enemyShots.forEach(b => {
    b.y += b.vy * dt;
    b.rotation += dt * 5;
  });

  // fleet drift
  fleetOffset += fleetDir * speedX * dt;
  enemies.forEach(e => { if (e.alive) e.y += speedY * dt * vDir; });

  // horizontal bounce
  const alive = enemies.filter(e => e.alive);
  if (alive.length) {
    const xs = alive.map(e => e.baseX + fleetOffset);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + ENEMY_WIDTH;
    if (maxX > W) { fleetDir = -1; fleetOffset -= (maxX - W); }
    else if (minX < 0) { fleetDir = 1; fleetOffset += -minX; }
  }

  // vertical bounce at 60% height
  const bottomL = H * (1 - PLAYER_AREA);
  if (vDir > 0 && alive.some(e => e.y >= bottomL)) vDir = -1;
  else if (vDir < 0 && alive.some(e => e.y <= initialMinEnemyY)) vDir = 1;

  // cull off-screen shots
  playerShots = playerShots.filter(b => b.y > -10);
  enemyShots  = enemyShots.filter(b => b.y < H + 10);

  maybeShootEnemy();
  checkCollisions();
}

function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000012';
  ctx.fillRect(0, 0, W, H);

  // draw player
  ctx.fillStyle = 'lime';
  ctx.fillRect(player.x, player.y, player.w, player.h);

  // draw enemies
  enemies.forEach(e => {
    if (!e.alive) return;
    const x = e.baseX + fleetOffset;
    const cols = ['red','orange','yellow','cyan'];
    ctx.fillStyle = cols[e.row];
    ctx.fillRect(x, e.y, ENEMY_WIDTH, ENEMY_HEIGHT);
  });

  // draw player bullets
  ctx.fillStyle = 'white';
  playerShots.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

  // draw rotating eggs
  enemyShots.forEach(b => {
    ctx.save();
    ctx.translate(b.x + b.w/2, b.y + b.h/2);
    ctx.rotate(b.rotation);
    ctx.drawImage(eggImg, -b.w/2, -b.h/2, b.w, b.h);
    ctx.restore();
  });
}

// keep track of pressed keys
const keys = {};

function handleKey(e) {
  // normalize single-character to uppercase, but map Space via code
  let k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (e.code === 'Space') k = 'Space';

  // prevent default on arrows or the shootKey
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) || k === shootKey) {
    e.preventDefault();
  }

  // track down/up
  keys[e.key] = (e.type === 'keydown');

  // fire when the configured key is pressed
  if (e.type === 'keydown' && k === shootKey) {
    shoot();
  }
}

function shoot() {
  playerShots.push({
    x: player.x + player.w/2 - 2,
    y: player.y,
    w: 4, h: 10
  });
  playSound('player_shoot');
}

let lastEgg = 0;
function maybeShootEnemy() {
  const now = performance.now();
  if (now - lastEgg < 800) return;
  lastEgg = now;
  const alive = enemies.filter(e => e.alive);
  if (!alive.length) return;
  const s = alive[Math.floor(Math.random() * alive.length)];
  enemyShots.push({
    x: s.baseX + fleetOffset + ENEMY_WIDTH/2 - 10,
    y: s.y + ENEMY_HEIGHT,
    w: 20, h: 28,
    vy: eggSpeed,
    rotation: 0
  });
}

function checkCollisions() {
  // eggs vs player
  for (let i = 0; i < enemyShots.length; i++) {
    const b = enemyShots[i];
    if (rectsOverlap(player, b)) {
      playSound('player_hit');
      enemyShots.splice(i--, 1);
      lives--;
      HUD.livesEl.textContent = `Lives: ${lives}`;
      if (lives <= 0) {
        endGame('lives');
        return;
      }
    }
  }
  // bullets vs enemies
  playerShots.forEach(b => {
    enemies.forEach(e => {
      if (!e.alive) return;
      const ex = e.baseX + fleetOffset;
      if (rectsOverlap({ x: ex, y: e.y, w: ENEMY_WIDTH, h: ENEMY_HEIGHT }, b)) {
        playSound('enemy_hit');
        e.alive = false;
        b.y = -100;
        score += (ROWS - e.row) * 5;
        HUD.scoreEl.textContent = `Score: ${score}`;
        if (!enemies.some(en => en.alive)) endGame('win');
      }
    });
  });
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

function formatTime(sec) {
  return sec < 60
    ? `0:${sec.toString().padStart(2,'0')}`
    : `${Math.floor(sec/60)}:${(sec % 60).toString().padStart(2,'0')}`;
}

function endGame(reason) {
  clearInterval(gameTimerID);
  clearInterval(accelTimerID);
  let msg;
  if (reason === 'lives') msg = 'You Lost!';
  else if (reason === 'time') msg = score < 100 ? 'You can do better' : 'Winner!';
  else msg = 'Champion!';
  alert(`${msg}\nScore: ${score}`);
  showScreen('config');
}
