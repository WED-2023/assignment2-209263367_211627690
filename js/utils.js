// utils.js

export function showScreen(id) {
  document
    .querySelectorAll('.screen')
    .forEach(div => div.hidden = (div.id !== id));
}

// Dummy sound playback using built-in Audio
export function playSound(name) {
  // You can add real sound files in /assets/sfx/ and match by name
  const sounds = {
    'player_shoot': 'assets/sfx/player_shoot.wav',
    'player_hit': 'assets/sfx/player_hit.wav',
    'enemy_hit': 'assets/sfx/enemy_hit.wav'
  };
  const src = sounds[name];
  if (src) new Audio(src).play();
}
