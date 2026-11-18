/* "Verify it's you" before an account is created (backend signup_otp.py).
 *
 *   e-mail  our server e-mails a 6-digit code
 *   SMS     Firebase Phone Auth sends and checks the code; our server checks
 *           Firebase's token. Offered only when FIREBASE_WEB is filled in
 *           (Firebase console > Project settings > Your apps > Web app), and
 *           infusionmedz.com is listed under Authentication > Settings >
 *           Authorised domains.
 *
 * verifySignup({email, phone}) resolves to the server's verification token,
 * or null if the person closes the dialog.
 */
import { api } from './api.js';
import { fmt } from './ui.js';

/* Paste the Firebase web app config here to turn on SMS codes on the website. */
export const FIREBASE_WEB = null;
// e.g. { apiKey: '...', authDomain: 'infusionmedzapp.firebaseapp.com', projectId: 'infusionmedzapp', appId: '1:300753188941:web:...' }

const FB = 'https://www.gstatic.com/firebasejs/10.12.5/';
let fbAuth = null;

async function firebaseAuth() {
  if (fbAuth) return fbAuth;
  const app = await import(FB + 'firebase-app.js');
  const auth = await import(FB + 'firebase-auth.js');
  const a = auth.getAuth(app.initializeApp(FIREBASE_WEB, 'signup-otp'));
  fbAuth = { a, auth };
  return fbAuth;
}

const e164 = (p) => {
  const d = String(p || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d;
  const x = d.replace(/^0+/, '');
  return x.length === 10 ? '+91' + x : '+' + x;
};

export function verifySignup({ email, phone }) {
  return new Promise((resolve) => {
    const smsOn = !!FIREBASE_WEB;
    const dlg = document.createElement('dialog');
    dlg.className = 'w-[min(26rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-lift backdrop:bg-navy/40';
    document.body.appendChild(dlg);
    let channel = null, challenge = null, confirmation = null, recaptcha = null, timer = null, left = 0, done = false;

    const finish = (v) => { if (done) return; done = true; clearInterval(timer); try { recaptcha && recaptcha.clear(); } catch (_) {} dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });

    const option = (ch, title, to) => '<button type="button" class="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-primary" data-ch="' + ch + '">' +
      '<span class="grid h-9 w-9 place-items-center rounded-lg bg-chip text-primary">' + (ch === 'sms' ? '💬' : '✉️') + '</span>' +
      '<span class="min-w-0 flex-1"><span class="block font-semibold text-navy">' + title + '</span><span class="block truncate text-xs text-ink-muted">' + fmt.esc(to) + '</span></span><span class="text-ink-muted">›</span></button>';

    function paint(error, busy) {
      const sent = !!channel && (challenge || confirmation);
      dlg.innerHTML = '<div class="p-6">' +
        '<div class="flex items-start justify-between gap-3"><h2 class="text-xl">Verify it\'s you</h2><button type="button" class="rounded-lg px-2 text-xl text-ink-muted hover:text-navy" data-close aria-label="Close">×</button></div>' +
        '<p class="mt-1 text-sm text-ink-muted">' + (sent
          ? (channel === 'sms' ? 'Enter the 6-digit code sent by SMS to ' + fmt.esc(e164(phone)) + '.' : 'Enter the 6-digit code sent to ' + fmt.esc(email) + '. Check spam if it isn\'t in your inbox.')
          : 'We\'ll send a one-time code to confirm your account' + (smsOn ? '. Choose one:' : ' to your e-mail.')) + '</p>' +
        (sent
          ? '<input class="field mt-4 text-center text-2xl font-bold tracking-[0.5em]" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" data-code>' +
            '<button type="button" class="btn-primary mt-3 w-full" data-verify' + (busy ? ' disabled' : '') + '>' + (busy ? 'Checking…' : 'Verify & create account') + '</button>' +
            '<div class="mt-2 flex justify-between text-sm"><button type="button" class="font-semibold text-primary disabled:text-ink-muted" data-resend' + (left || busy ? ' disabled' : '') + '>' + (left ? 'Resend in ' + left + 's' : 'Resend code') + '</button>' +
              (smsOn ? '<button type="button" class="font-semibold text-primary" data-switch>' + (channel === 'sms' ? 'Use e-mail instead' : 'Use SMS instead') + '</button>' : '') + '</div>'
          : '<div class="mt-4 space-y-2">' + (smsOn ? option('sms', 'Text a code to my mobile', e164(phone)) : '') + option('email', 'E-mail a code', email) + '</div>' +
            (busy ? '<p class="mt-3 text-sm text-ink-muted">Sending…</p>' : '')) +
        (error ? '<p class="mt-3 text-sm font-medium text-bad">' + fmt.esc(error) + '</p>' : '') +
        '<div id="signup-recaptcha"></div>' +
      '</div>';
      dlg.querySelector('[data-close]').onclick = () => finish(null);
      dlg.querySelectorAll('[data-ch]').forEach((b) => { b.onclick = () => send(b.dataset.ch); });
      const code = dlg.querySelector('[data-code]');
      if (code) {
        code.focus();
        code.oninput = () => { code.value = code.value.replace(/\D/g, '').slice(0, 6); if (code.value.length === 6) verify(code.value); };
        code.onkeydown = (e) => { if (e.key === 'Enter') verify(code.value); };
        dlg.querySelector('[data-verify]').onclick = () => verify(code.value);
        dlg.querySelector('[data-resend]').onclick = () => send(channel);
        const sw = dlg.querySelector('[data-switch]');
        if (sw) sw.onclick = () => send(channel === 'sms' ? 'email' : 'sms');
      }
    }

    function countdown(n) {
      clearInterval(timer);
      left = n;
      timer = setInterval(() => { left = Math.max(0, left - 1); const r = dlg.querySelector('[data-resend]'); if (r) { r.disabled = left > 0; r.textContent = left ? 'Resend in ' + left + 's' : 'Resend code'; } if (!left) clearInterval(timer); }, 1000);
    }

    async function send(ch) {
      channel = ch; challenge = null; confirmation = null;
      paint('', true);
      try {
        if (ch === 'email') {
          const r = await api.signupOtpEmailSend(email);
          challenge = r.challenge;
          countdown(r.resend_in || 45);
        } else {
          const { a, auth } = await firebaseAuth();
          try { recaptcha && recaptcha.clear(); } catch (_) {}
          recaptcha = new auth.RecaptchaVerifier(a, 'signup-recaptcha', { size: 'invisible' });
          confirmation = await auth.signInWithPhoneNumber(a, e164(phone), recaptcha);
          countdown(45);
        }
        paint('');
      } catch (e) {
        channel = null;
        paint(friendly(e));
      }
    }

    async function verify(code) {
      code = String(code || '').trim();
      if (!/^\d{6}$/.test(code)) return paint('Enter the 6-digit code.');
      paint('', true);
      try {
        let r;
        if (channel === 'email') r = await api.signupOtpEmailVerify(challenge, code);
        else {
          const cred = await confirmation.confirm(code);
          const token = await cred.user.getIdToken();
          try { await (await firebaseAuth()).auth.signOut((await firebaseAuth()).a); } catch (_) {}
          r = await api.signupOtpPhoneVerify(token);
        }
        finish(r.verification);
      } catch (e) {
        paint(friendly(e));
      }
    }

    function friendly(e) {
      const c = (e && e.code) || '';
      if (c === 'auth/invalid-verification-code') return 'That code isn\'t right.';
      if (c === 'auth/code-expired') return 'The code expired. Ask for a new one.';
      if (c === 'auth/too-many-requests' || c === 'auth/quota-exceeded') return 'SMS is unavailable right now. Please use e-mail.';
      if (c === 'auth/invalid-phone-number') return 'That mobile number doesn\'t look right.';
      return (e && e.message) || 'Something went wrong. Please try again.';
    }

    paint('');
    dlg.showModal();
    if (!smsOn) send('email');
  });
}
