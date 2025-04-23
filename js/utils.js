// utils.js

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


// #game {
//   display: flex;
//   flex-direction: column;
//   align-items: center;
//   justify-content: center;
// }
//
// #gameWrapper {
//   position: relative;
//   width: 96vmin;                /* slightly larger */
//   max-width: 1080px;            /* increased max width */
//   aspect-ratio: 3 / 2;
//   overflow: hidden;
//   border: 2px solid #444;
//   border-radius: 10px;
// }
//
//
// #gameBgVideo {
//   position: absolute;
//   width: 100%;
//   height: 100%;
//   object-fit: cover;
//   z-index: 0;
// }
//
// #gameCanvas {
//   position: relative;
//   z-index: 1;
//   width: 100%;
//   height: 100%;
//   background: transparent !important;
// }
//
//
// /* Responsive canvas */
// #gameCanvas {
//   border: 2px solid #444;
//   background: #000;
//   width: 90vmin;               /* 90% of the smaller viewport dimension */
//   height: auto;                /* aspect-ratio will preserve height */
//   max-width: 900px;
//   max-height: 600px;
//   aspect-ratio: 900 / 600;     /* preserve original 3:2 ratio */