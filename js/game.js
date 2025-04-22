// js/game.js
import { showScreen, playSound } from './utils.js';

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const HUD    = {
  scoreEl: document.getElementById('score'),
  livesEl: document.getElementById('lives'),
  timeEl : document.getElementById('time')
};

let W = canvas.width, H = canvas.height;
// Re‑sync the drawing buffer to the CSS size
function resizeCanvas() {
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  // only when it actually has space
  if (cw > 0 && ch > 0 && (canvas.width !== cw || canvas.height !== ch)) {
    canvas.width  = cw;
    canvas.height = ch;
    W = cw;
    H = ch;
  }
}

// call once now, and again whenever the window resizes
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Grid and movement
const ROWS = 4, COLS = 5;
const ENEMY_GAP_X  = 80, ENEMY_GAP_Y  = 60;
const ENEMY_WIDTH  = 40, ENEMY_HEIGHT = 30;
const START_Y      = 60;

// Player constants
const PLAYER_AREA        = 0.4;
const PLAYER_SPEED       = 300;
const BULLET_SPEED       = 450;
const ENEMY_BULLET_SPEED = 260;

// Fleet movement
let fleetOffset = 0;
let fleetDir    = 1;
const FLEET_SPEED = 60; // pixels/sec
const DROP_Y      = 20; // pixels when edge hit

let player, enemies, playerShots, enemyShots;
let score, lives, timeLeft;
let lastFrame = 0, shootKey = 'Space';
let gameTimerID;

export function startGame(conf) {
  resizeCanvas();
  shootKey = conf.shootKey || 'Space';
  timeLeft = conf.time   || 120;
  score    = 0;
  lives    = 3;

  player = { x: W/2 - 25, y: H*(1-PLAYER_AREA) + 10, w: 50, h: 30 };
  playerShots = [];
  enemyShots  = [];
  initEnemies();

  HUD.scoreEl.textContent = `Score: ${score}`;
  HUD.livesEl.textContent = `Lives: ${lives}`;
  HUD.timeEl.textContent   = formatTime(timeLeft);

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

// js/game.js

function initEnemies() {
  enemies = [];

  // dynamic spacing: COLS ships evenly across the width
  const gapX   = W / (COLS + 1);
  // put the top row at 10% down from the top, and space rows at 8% of height
  const startY = H * 0.10;
  const gapY   = H * 0.08;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = gapX * (c + 1);           // 1×gapX, 2×gapX, …, COLS×gapX
      const y = startY + r * gapY;        // startY, startY+gapY, …
      enemies.push({
        baseX: x,
        x,
        y,
        row: r,
        alive: true
      });
    }
  }
}


function loop(timestamp) {
  const dt = (timestamp - lastFrame) / 1000;
  lastFrame = timestamp;
  update(dt);
  render();
  if (lives > 0 && enemies.some(e => e.alive) && timeLeft > 0) {
    requestAnimationFrame(loop);
  }
}

function update(dt) {
  // Player control
  if (keys.ArrowLeft)  player.x -= PLAYER_SPEED * dt;
  if (keys.ArrowRight) player.x += PLAYER_SPEED * dt;
  if (keys.ArrowUp)    player.y -= PLAYER_SPEED * dt;
  if (keys.ArrowDown)  player.y += PLAYER_SPEED * dt;
  const minY = H * (1 - PLAYER_AREA);
  player.x = Math.max(0, Math.min(W - player.w, player.x));
  player.y = Math.max(minY, Math.min(H - player.h, player.y));

  // Fleet movement
  fleetOffset += fleetDir * FLEET_SPEED * dt;
  const aliveEnemies = enemies.filter(e => e.alive);
  const positions = aliveEnemies.map(e => e.baseX + fleetOffset);
  const minPos = Math.min(...positions);
  const maxPos = Math.max(...positions) + ENEMY_WIDTH;
  if (maxPos > W) {
    fleetDir = -1;
    fleetOffset -= (maxPos - W);
    enemies.forEach(e => e.y += DROP_Y);
  } else if (minPos < 0) {
    fleetDir = 1;
    fleetOffset += -minPos;
    enemies.forEach(e => e.y += DROP_Y);
  }

  // Bullets
  playerShots.forEach(b => b.y -= BULLET_SPEED * dt);
  enemyShots.forEach(b  => b.y += ENEMY_BULLET_SPEED * dt);
  playerShots = playerShots.filter(b => b.y > -10);
  enemyShots  = enemyShots.filter(b => b.y < H + 10);

  maybeShootEnemy();
  checkCollisions();
}

function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000012';
  ctx.fillRect(0, 0, W, H);
  // Player
  ctx.fillStyle = 'lime';
  ctx.fillRect(player.x, player.y, player.w, player.h);
  // Enemies
  enemies.forEach(e => {
    if (!e.alive) return;
    const x = e.baseX + fleetOffset;
    const colors = ['red','orange','yellow','cyan'];
    ctx.fillStyle = colors[e.row];
    ctx.fillRect(x, e.y, ENEMY_WIDTH, ENEMY_HEIGHT);
  });
  // Bullets
  ctx.fillStyle = 'white';
  playerShots.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
  ctx.fillStyle = 'red';
  enemyShots.forEach(b  => ctx.fillRect(b.x, b.y, b.w, b.h));
}

// Controls & shooting
const keys = {};
function handleKey(e) {
  keys[e.key] = e.type === 'keydown';
  if (e.type === 'keydown' && e.code === 'Space') shoot();
}
function shoot() {
  playerShots.push({ x: player.x + player.w/2 - 2, y: player.y, w:4, h:10 });
  playSound('player_shoot');
}

// Enemy fire
let lastEnemyShot = 0;
function maybeShootEnemy() {
  if (enemyShots.length && enemyShots[enemyShots.length - 1].y < H * 0.25) return;
  const alive = enemies.filter(e => e.alive);
  if (!alive.length) return;
  const now = performance.now();
  if (now - lastEnemyShot < 600) return;
  lastEnemyShot = now;
  const shooter = alive[Math.floor(Math.random() * alive.length)];
  const x = shooter.baseX + fleetOffset + ENEMY_WIDTH/2 - 2;
  enemyShots.push({ x, y: shooter.y + ENEMY_HEIGHT, w:4, h:10, vy:ENEMY_BULLET_SPEED });
}

// Collisions
function checkCollisions() {
  enemyShots.forEach(b => {
    if (rectsOverlap(player, b)) {
      playSound('player_hit');
      lives--;
      HUD.livesEl.textContent = `Lives: ${lives}`;
      b.y = H + 100;
      if (lives === 0) endGame('lives');
    }
  });
  playerShots.forEach(b => {
    enemies.forEach(e => {
      if (!e.alive) return;
      const ex = e.baseX + fleetOffset;
      if (rectsOverlap({ x: ex, y: e.y, w:ENEMY_WIDTH, h:ENEMY_HEIGHT }, b)) {
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
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

function formatTime(sec) {
  return sec < 60 ? `0:${sec.toString().padStart(2,'0')}` : `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`;
}

function endGame(reason) {
  clearInterval(gameTimerID);
  let msg = reason === 'lives' ? 'You Lost!' : reason === 'time' ? (score < 100 ? 'You can do better' : 'Winner!') : 'Champion!';
  alert(`${msg}\nScore: ${score}`);
  saveScore(score);
  showScreen('config');
}

function saveScore(score) {
  const user = localStorage.getItem('gi_current_user');
  if (!user) return;
  const key = `gi_score_${user}`;
  const best = parseInt(localStorage.getItem(key) || '0');
  if (score > best) {
    localStorage.setItem(key, score);
    alert('New High Score!');
  }
}