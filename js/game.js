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
  if (cw>0 && ch>0 && (canvas.width!==cw || canvas.height!==ch)) {
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

// player
const PLAYER_AREA  = 0.4;
const PLAYER_SPEED = 300;
const BULLET_SPEED = 450;

// enemy bullets
const EGG_SPEED    = 260;

// fleet movement & acceleration
let fleetOffset = 0;     // horizontal offset
let fleetDir    = 1;     // +1 right, -1 left
let vDir        = 1;     // vertical drift +1 down, -1 up
let speedX      = 60;    // horizontal px/sec
let speedY      = 20;    // vertical px/sec
const ACCEL_INTERVAL   = 5000;
const MAX_ACCEL_STEPS  = 4;
const ACCEL_FACTOR     = 1.2;
let accelSteps   = 0;
let accelTimerID = null;

// enemy spawn / vertical bounds
let initialMinEnemyY = 0;

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

  player = {
    x: W/2 - 25,
    y: H*(1-PLAYER_AREA),
    w: 50, h: 30
  };
  playerShots = [];
  enemyShots  = [];
  initEnemies();

  HUD.scoreEl.textContent = `Score: ${score}`;
  HUD.livesEl.textContent = `Lives: ${lives}`;
  HUD.timeEl.textContent  = formatTime(timeLeft);

  clearInterval(accelTimerID);
  accelSteps = 0;
  speedX = 60; speedY = 20;
  vDir = 1;
  accelTimerID = setInterval(() => {
    if (accelSteps < MAX_ACCEL_STEPS) {
      accelSteps++;
      speedX *= ACCEL_FACTOR;
      speedY *= ACCEL_FACTOR;
    }
  }, ACCEL_INTERVAL);

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

  for (let r=0; r<ROWS; r++) {
    for (let c=0; c<COLS; c++) {
      const x = gapX * (c + 1);
      const y = startY + r * gapY;
      enemies.push({ baseX:x, y, row:r, alive:true });
    }
  }
  // remember their topmost spawn point
  initialMinEnemyY = Math.min(...enemies.map(e => e.y));
}

function loop(ts) {
  const dt = (ts - lastFrame)/1000;
  lastFrame = ts;
  update(dt);
  render();
  if (lives>0 && enemies.some(e=>e.alive) && timeLeft>0) {
    requestAnimationFrame(loop);
  }
}

function update(dt) {
  // —— PLAYER MOVEMENT (bottom 40%) —— 
  if (keys.ArrowLeft)  player.x -= PLAYER_SPEED * dt;
  if (keys.ArrowRight) player.x += PLAYER_SPEED * dt;
  if (keys.ArrowUp)    player.y -= PLAYER_SPEED * dt;
  if (keys.ArrowDown)  player.y += PLAYER_SPEED * dt;
  const minPlayerY = H * (1 - PLAYER_AREA);
  player.x = Math.max(0, Math.min(W - player.w, player.x));
  player.y = Math.max(minPlayerY, Math.min(H - player.h, player.y));

  // —— PLAYER SHOTS —— 
  playerShots.forEach(b => b.y -= BULLET_SPEED * dt);

  // —— ENEMY EGGS —— 
  enemyShots.forEach(b => {
    b.y += b.vy * dt;
    b.rotation += dt * 5;
  });

  // —— FLEET DRIFT (diagonal) —— 
  fleetOffset += fleetDir * speedX * dt;
  enemies.forEach(e => {
    if (e.alive) e.y += speedY * dt * vDir;
  });

  // horizontal bounce
  const alive = enemies.filter(e => e.alive);
  if (alive.length) {
    const positions = alive.map(e => e.baseX + fleetOffset);
    const minX = Math.min(...positions);
    const maxX = Math.max(...positions) + ENEMY_WIDTH;
    if (maxX > W) {
      fleetDir = -1;
      fleetOffset -= (maxX - W);
    } else if (minX < 0) {
      fleetDir = 1;
      fleetOffset += -minX;
    }
  }

  // vertical bounce at 60% height
  const bottomLimit = H * (1 - PLAYER_AREA);
  if (vDir > 0 && alive.some(e => e.y >= bottomLimit)) {
    vDir = -1;
  } else if (vDir < 0 && alive.some(e => e.y <= initialMinEnemyY)) {
    vDir = 1;
  }

  // cull offscreen shots
  playerShots = playerShots.filter(b => b.y > -10);
  enemyShots  = enemyShots.filter(b => b.y < H + 10);

  maybeShootEnemy();
  checkCollisions();
}

function render() {
  ctx.clearRect(0,0,W,H);

  // background
  ctx.fillStyle = '#000012';
  ctx.fillRect(0,0,W,H);

  // player
  ctx.fillStyle = 'lime';
  ctx.fillRect(player.x, player.y, player.w, player.h);

  // enemies
  enemies.forEach(e => {
    if (!e.alive) return;
    const x = e.baseX + fleetOffset;
    const colors = ['red','orange','yellow','cyan'];
    ctx.fillStyle = colors[e.row];
    ctx.fillRect(x, e.y, ENEMY_WIDTH, ENEMY_HEIGHT);
  });

  // player lasers
  ctx.fillStyle = 'white';
  playerShots.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

  // rotating eggs
  enemyShots.forEach(b => {
    ctx.save();
    ctx.translate(b.x + b.w/2, b.y + b.h/2);
    ctx.rotate(b.rotation);
    ctx.drawImage(eggImg, -b.w/2, -b.h/2, b.w, b.h);
    ctx.restore();
  });
}

const keys = {};
function handleKey(e) {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) || e.code==='Space') {
    e.preventDefault();
  }
  keys[e.key] = e.type==='keydown';
  if (e.type==='keydown' && e.code==='Space') shoot();
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
  const alive = enemies.filter(e=>e.alive);
  if (!alive.length) return;
  const shooter = alive[Math.floor(Math.random()*alive.length)];
  enemyShots.push({
    x: shooter.baseX + fleetOffset + ENEMY_WIDTH/2 - 10,
    y: shooter.y + ENEMY_HEIGHT,
    w: 20, h: 28,
    vy: EGG_SPEED,
    rotation: 0
  });
}

function checkCollisions() {
  playerShots.forEach(b => {
    enemies.forEach(e => {
      if (!e.alive) return;
      const ex = e.baseX + fleetOffset;
      if (rectsOverlap({ x:ex, y:e.y, w:ENEMY_WIDTH, h:ENEMY_HEIGHT }, b)) {
        playSound('enemy_hit');
        e.alive = false;
        b.y = -100;
        score += (ROWS - e.row)*5;
        HUD.scoreEl.textContent = `Score: ${score}`;
        if (!enemies.some(en=>en.alive)) endGame('win');
      }
    });
  });
}

function rectsOverlap(a,b) {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

function formatTime(s) {
  return s < 60
    ? `0:${s.toString().padStart(2,'0')}`
    : `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
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
