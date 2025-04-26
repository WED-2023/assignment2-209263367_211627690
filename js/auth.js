// js/auth.js – Registration, Login & Nav‑Toggle logic

import { showScreen } from './utils.js';
import { stopGameAudio, clearPlayerHistory } from './game.js'; 

const USERS_KEY        = 'gi_users';
const CURRENT_USER_KEY = 'gi_current_user';

// Nav buttons
const navLogin    = document.getElementById('navLogin');
const navRegister = document.getElementById('navRegister');
const navPlay     = document.getElementById('navPlay');
const navLogout   = document.getElementById('navLogout');

/** Show/hide Login, Register, Play and Logout based on login state */
function updateNav() {
  const loggedIn = !!localStorage.getItem(CURRENT_USER_KEY);
  navLogin.hidden    = loggedIn;
  navRegister.hidden = loggedIn;
  navPlay.hidden     = !loggedIn;  // Show Play only when logged in
  navLogout.hidden   = !loggedIn;
}

// Initial setup
updateNav();
showScreen('welcome');

// Helpers – load / save users
function loadUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveUsers(arr) {
  localStorage.setItem(USERS_KEY, JSON.stringify(arr));
}

// Ensure demo user exists (username: p, password: testuser)
(function ensureDefaultUser() {
  const users = loadUsers();
  if (!users.some(u => u.username === 'p')) {
    users.push({
      username: 'p',
      password: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      dob: '2000-01-01'
    });
    saveUsers(users);
  }
})();

// Inject Register & Login markup
const registerSec = document.getElementById('register');
registerSec.innerHTML = `
  <h2>Register</h2>
  <form id="registerForm">
    <input name="username"  placeholder="Username" required>
    <input type="password" name="password" placeholder="Password" required>
    <input type="password" name="confirm"  placeholder="Confirm Password" required>
    <input name="firstName" placeholder="First Name" required>
    <input name="lastName"  placeholder="Last Name" required>
    <input type="email" name="email" placeholder="Email" required>
    <input type="date"  name="dob" required>
    <button>Sign Up</button>
  </form>
  <p id="regError" class="error"></p>
`;

const loginSec = document.getElementById('login');
loginSec.innerHTML = `
  <h2>Login</h2>
  <form id="loginForm">
    <input name="username" placeholder="Username" required>
    <input type="password" name="password" placeholder="Password" required>
    <button>Login</button>
  </form>
  <p id="loginError" class="error"></p>
`;

// Form event listeners
document.getElementById('registerForm').addEventListener('submit', handleRegister);
document.getElementById('loginForm').addEventListener('submit',    handleLogin);

function handleRegister(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const err  = document.getElementById('regError');
  err.textContent = '';

  // Validations
  const users = loadUsers();
  if (users.some(u => u.username === data.username)) {
    err.textContent = 'Username already exists';
    return;
  }
  const pwdRe = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
  if (!pwdRe.test(data.password)) {
    err.textContent = 'Password must be ≥8 chars and include letters & numbers';
    return;
  }
  if (data.password !== data.confirm) {
    err.textContent = 'Passwords do not match';
    return;
  }
  const nameRe = /^[A-Za-zא-ת]+$/;
  if (!nameRe.test(data.firstName) || !nameRe.test(data.lastName)) {
    err.textContent = 'Names must contain letters only';
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(data.email)) {
    err.textContent = 'Invalid email';
    return;
  }

  // Save new user
  users.push({
    username: data.username,
    password: data.password,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    dob: data.dob
  });
  saveUsers(users);

  alert('Registration successful! Please log in.');
  showScreen('login');
  e.target.reset();
}

function handleLogin(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const err  = document.getElementById('loginError');
  err.textContent = '';

  const user = loadUsers().find(u => u.username === data.username && u.password === data.password);
  if (!user) {
    err.textContent = 'Invalid username or password';
    return;
  }

  // Mark user as logged in
  localStorage.setItem(CURRENT_USER_KEY, user.username);
  updateNav();
  showScreen('config');
  e.target.reset();
}

// Wire up nav buttons and About dialog
document.querySelectorAll('nav button[data-screen]').forEach(btn => {
  btn.addEventListener('click', () => {
    stopGameAudio();
    if (btn.dataset.screen === 'about') {
      document.getElementById('aboutDialog').showModal();
    } else {
      showScreen(btn.dataset.screen);
    }
  });
});


// Close About dialog
const aboutDlg = document.getElementById('aboutDialog');
document.getElementById('closeAbout').addEventListener('click', () => aboutDlg.close());
aboutDlg.addEventListener('click', e => { if (e.target === aboutDlg) aboutDlg.close(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') aboutDlg.close(); });

// Initial UI
updateNav();


navLogout.addEventListener('click', () => {
  stopGameAudio();
  const CURRENT_USER_KEY = 'gi_current_user';
  const user = localStorage.getItem(CURRENT_USER_KEY);

  if (user) {
    clearPlayerHistory(user);
    localStorage.removeItem(CURRENT_USER_KEY);
  }

  updateNav();
  showScreen('welcome');
});
