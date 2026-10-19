/* InfuMedz website - session and auth state.
 *
 * Mirrors lib/core/session/user_session.dart, with one deliberate change.
 *
 * The app decides "is this person an admin?" purely client-side:
 *
 *     static const String adminEmail = "chandrasekharsuragani532@gmail.com";
 *
 * On a website that check is worth nothing - the comparison ships to every
 * visitor as readable JavaScript, and anyone can edit it in DevTools. So the
 * website never trusts a client-side admin flag for anything that matters.
 * It calls admin/login/, gets back a signed token, and sends that token on
 * every admin request. The backend decides. The flag below is only used to
 * decide what to *draw*, never what is *allowed*.
 */

import { api } from './api.js';

const USER_KEY  = 'infumedz.user';
const ADMIN_KEY = 'infumedz.admin';   // sessionStorage: dies with the tab

/* localStorage/sessionStorage throw in private mode and when site data is
   blocked, so every access is guarded. A visitor with storage disabled gets
   a working, logged-out site rather than a blank page. */
function readJSON(store, key) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function writeJSON(store, key, value) {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

export const session = {

  /* ── Customer session ─────────────────────────────── */

  get user() {
    return readJSON(localStorage, USER_KEY);
  },

  get userId() {
    const u = this.user;
    return u ? u.user_id : null;
  },

  get isLoggedIn() {
    return !!this.userId;
  },

  async login(identifier, password) {
    const r = await api.login(identifier, password);
    writeJSON(localStorage, USER_KEY, {
      user_id: r.user_id,
      name: r.name,
      email: r.email,
    });
    return r;
  },

  /** Google Sign-In. The backend verifies the id_token itself and returns
      the same {user_id, name, email} shape as a password login, plus
      profile_pic, so the stored session is identical either way. */
  async googleLogin(idToken) {
    const r = await api.google(idToken);
    writeJSON(localStorage, USER_KEY, {
      user_id: r.user_id,
      name: r.name,
      email: r.email,
      profile_pic: r.profile_pic || null,
    });
    return r;
  },

  async signup(data) {
    const r = await api.signup(data);
    // signup responses vary; only persist if the backend actually returned
    // an id, otherwise send the person to the login form instead of leaving
    // a half-built session behind.
    if (r && r.user_id) {
      writeJSON(localStorage, USER_KEY, {
        user_id: r.user_id,
        name: r.name || data.name,
        email: r.email || data.email,
      });
    }
    return r;
  },

  logout() {
    writeJSON(localStorage, USER_KEY, null);
    writeJSON(sessionStorage, ADMIN_KEY, null);
  },

  /** Send the person to login, remembering where they were going. */
  requireLogin(returnTo) {
    if (this.isLoggedIn) return true;
    const target = returnTo || (location.pathname + location.search);
    location.href = 'login.html?next=' + encodeURIComponent(target);
    return false;
  },

  /* ── Admin session ────────────────────────────────── */

  get admin() {
    const a = readJSON(sessionStorage, ADMIN_KEY);
    if (!a) return null;
    // Drop a token the backend would reject anyway, so the UI shows the
    // login form instead of a dashboard full of failed requests.
    if (a.expires_at && Date.now() / 1000 > a.expires_at) {
      writeJSON(sessionStorage, ADMIN_KEY, null);
      return null;
    }
    return a;
  },

  get isAdmin() {
    return !!this.admin;
  },

  /** Headers for an admin call. Spread into any api.admin.* request. */
  get adminHeaders() {
    const a = this.admin;
    return a ? { 'X-Admin-Token': a.token } : {};
  },

  async adminLogin(email, password) {
    const r = await api.admin.login(email, password);
    writeJSON(sessionStorage, ADMIN_KEY, {
      token: r.token,
      email: r.email,
      name: r.name || '',
      expires_at: r.expires_at || null,
    });
    return r;
  },

  adminLogout() {
    writeJSON(sessionStorage, ADMIN_KEY, null);
  },

  /** Guard for admin pages. Returns false and shows the login gate if out. */
  requireAdmin() {
    return this.isAdmin;
  },
};
