// js/game.js
import { showScreen, playSound } from './utils.js';

const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
const HUD     = {
  scoreEl: document.getElementById('score'),
  livesEl: document.getElementById('lives'),
  timeEl : document.getElementById('time')
};

let W = canvas.width, H = canvas.height;


const ROWS = 4, COLS = 5;
const PLAYER_AREA = 0.4;           
const ENEMY_GAP_X = 80, ENEMY_GAP_Y = 60;
const ENEMY_START_Y = 60;
const PLAYER_SPEED  = 300;       
const BULLET_SPEED  = 450;
const ENEMY_BULLET_SPEED = 260;
const ACCEL_INTERVAL = 5000;    
const MAX_ACCEL_STEPS = 4;


let player, enemies, playerShots, enemyShots;
let score, lives, timeLeft, enemyDir, enemySpeed, accelSteps;
let lastFrame = 0, shootKey = 'Space';
let gameTimerID, accelID;


export function startGame(conf) {
  shootKey = conf.shootKey || 'Space';
  timeLeft = conf.time   || 120;
  score    = 0;
  lives    = 3;
  enemyDir = 1;         
  enemySpeed = 60;       
  accelSteps = 0;

  player = { x: W/2, y: H*(1-PLAYER_AREA) + 40, w: 50, h: 30 };
  playerShots = [];
  enemyShots  = [];
  initEnemies();


  HUD.scoreEl.textContent = 'Score: 0';
  HUD.livesEl.textContent = 'Lives: 3';
  HUD.timeEl .textContent = formatTime(timeLeft);


  clearInterval(gameTimerID);
  clearInterval(accelID);
  gameTimerID = setInterval(() => {
    if (--timeLeft <= 0) endGame('time');
    HUD.timeEl.textContent = formatTime(timeLeft);
  }, 1000);

  accelID = setInterval(() => {
    if (++accelSteps <= MAX_ACCEL_STEPS) {
      enemySpeed  *= 1.25;
      enemyShots.forEach(b => b.vy *= 1.25);
    }
  }, ACCEL_INTERVAL);


  window.onkeydown = handleKey;
  requestAnimationFrame(loop);
  showScreen('game');
}


function initEnemies() {
  enemies = [];
  const startX = (W - (COLS-1)*ENEMY_GAP_X)/2;
  for (let r=0; r<ROWS; r++) {
    for (let c=0; c<COLS; c++) {
      enemies.push({
        x: startX + c*ENEMY_GAP_X,
        y: ENEMY_START_Y + r*ENEMY_GAP_Y,
        row: r,
        alive: true
      });
    }
  }
}


function loop(tStamp) {
  const dt = (tStamp - lastFrame)/1000;
  lastFrame = tStamp;
  update(dt);
  render();
  if (lives > 0 && enemies.some(e => e.alive) && timeLeft > 0) {
    requestAnimationFrame(loop);
  }
}


function update(dt) {

  if (keys.ArrowLeft)  player.x -= PLAYER_SPEED * dt;
  if (keys.ArrowRight) player.x += PLAYER_SPEED * dt;
  if (keys.ArrowUp)    player.y -= PLAYER_SPEED * dt;
  if (keys.ArrowDown)  player.y += PLAYER_SPEED * dt;


  const minY = H*(1-PLAYER_AREA);
  player.x = Math.max(0, Math.min(W-player.w, player.x));
  player.y = Math.max(minY, Math.min(H-player.h, player.y));


  let hitEdge = false;
  enemies.forEach(e => {
    if (!e.alive) return;
    e.x += enemyDir * enemySpeed * dt;
    if (e.x < 0 || e.x > W-40) hitEdge = true;
  });
  if (hitEdge) {
    enemyDir *= -1;
    enemies.forEach(e => e.y += 20); 
  }


  maybeShootEnemy();

 
  playerShots.forEach(b => b.y -= BULLET_SPEED*dt);
  enemyShots .forEach(b => b.y += ENEMY_BULLET_SPEED*dt);


  playerShots = playerShots.filter(b => b.y > -10);
  enemyShots  = enemyShots.filter (b => b.y < H+10);


  checkCollisions();
}


function checkCollisions() {


  enemyShots.forEach(b => {
    if (rectsOverlap(player, b)) {
      playSound('player_hit');
      lives--;
      HUD.livesEl.textContent = `Lives: ${lives}`;
      b.y = H+100;                      // נפסל
      if (lives === 0) endGame('lives');
    }
  });


  playerShots.forEach(b => {
    enemies.forEach(e => {
      if (e.alive && rectsOverlap(e, b)) {
        playSound('enemy_hit');
        e.alive = false;
        b.y = -100;
        score += (ROWS-e.row) * 5;   
        HUD.scoreEl.textContent = `Score: ${score}`;
  
        if (!enemies.some(en => en.alive)) endGame('win');
      }
    });
  });
}

/* -------------------------------------------------- */
function render() {
  ctx.clearRect(0,0,W,H);


  ctx.fillStyle = '#000012';
  ctx.fillRect(0,0,W,H);

  ctx.fillStyle = 'lime';
  ctx.fillRect(player.x, player.y, player.w, player.h);


  enemies.forEach(e => {
    if (!e.alive) return;
    const colors = ['red','orange','yellow','cyan'];
    ctx.fillStyle = colors[e.row];
    ctx.fillRect(e.x, e.y, 40, 30);
  });


  ctx.fillStyle = 'white';
  playerShots.forEach(b => ctx.fillRect(b.x, b.y, 4, 10));
  ctx.fillStyle = 'red';
  enemyShots .forEach(b => ctx.fillRect(b.x, b.y, 4, 10));
}


const keys = {};
function handleKey(e) {
  if (e.type === 'keydown') keys[e.key] = true;
  if (e.type === 'keyup')   keys[e.key] = false;


  if (e.type === 'keydown' && e.key === shootKey) shoot();
}
window.addEventListener('keydown', handleKey);
window.addEventListener('keyup',   handleKey);

function shoot() {

  if (playerShots.length > 0) return;
  playerShots.push({ x: player.x + player.w/2, y: player.y });
  playSound('player_shoot');
}


let lastEnemyShot = 0;
function maybeShootEnemy() {
  if (enemyShots.length && enemyShots[enemyShots.length-1].y < H*0.25) return;
  const alive = enemies.filter(e => e.alive);
  if (!alive.length) return;

  const now = performance.now();
  if (now - lastEnemyShot < 600) return;   
  lastEnemyShot = now;

  const shooter = alive[Math.random()*alive.length|0];
  enemyShots.push({ x: shooter.x+20, y: shooter.y+30, w:4, h:10, vy:ENEMY_BULLET_SPEED });
}


function rectsOverlap(a, b) {
  return !(a.x+a.w < b.x || b.x+b.w < a.x ||
           a.y+a.h < b.y || b.y+b.h < a.y);
}
function formatTime(sec) {
  return sec < 60 ? `0:${sec.toString().padStart(2,'0')}` :
         `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`;
}
function endGame(reason) {
  clearInterval(gameTimerID);
  clearInterval(accelID);

  let msg = '';
  if (reason === 'lives') msg = 'You Lost!';
  else if (reason === 'time')
    msg = score < 100 ? 'You can do better' : 'Winner!';
  else msg = 'Champion!';

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

/* -------------------------------------------------- */
