// === utils.js ===

export function showScreen(id) {
  document
    .querySelectorAll('.screen')
    .forEach(div => div.hidden = (div.id !== id));
}

export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, val]) => el.setAttribute(key, val));
  children.forEach(child => el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child));
  return el;
}

