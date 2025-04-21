// utils.js
export function showScreen(id) {
    document
      .querySelectorAll('.screen')
      .forEach(div => div.hidden = (div.id !== id));
  }
  