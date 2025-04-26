// === config.js ===

import { showScreen } from './utils.js';
import { startGame } from './game.js';

const CURRENT_USER_KEY = 'gi_current_user';

const cfgSec = document.getElementById('config');
cfgSec.innerHTML = `
  <h2>Game Configuration</h2>
  <form id="configForm">
    <label>Shoot key:
      <select id="shootKey">
        <option value="Space">Space</option>
        ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </label>

    <label>Game duration (seconds, min 120):
      <input type="number" id="duration" min="120" value="120" required>
    </label>

    <label>Choose your spaceship:
      <select id="spaceship">
        <option value="spaceship_blue.png">Blue</option>
        <option value="spaceship_red.png">Red</option>
        <option value="spaceship_orange.png">Orange</option>
      </select>
    </label>

    <button id="startBtn">Start Game</button>
  </form>`;


document.getElementById('configForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!isLoggedIn()) {
    alert('Please log in first');
    showScreen('login');
    return;
  }

  const conf = {
    shootKey: document.getElementById('shootKey').value,
    time: Math.max(120, parseInt(document.getElementById('duration').value, 10)),
    spaceshipImg: document.getElementById('spaceship').value
  };

  startGame(conf);
  showScreen('game');

  // scroll to game screen
  setTimeout(() => {
    document.getElementById('game')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
});

function isLoggedIn() {
  return !!localStorage.getItem(CURRENT_USER_KEY);
}

document.getElementById('newGameBtn').addEventListener('click', () => {
  showScreen('config');
});