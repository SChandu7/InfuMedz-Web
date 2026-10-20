# InfuMedz website

Static website for **infumedz.chandus7.in**, built for GitHub Pages. Talks to the
existing Django backend at `api.chandus7.in` — the **same database and the same
APIs as the mobile app**. Nothing here has its own backend.

## Stack

| | |
|---|---|
| Markup | Hand-written HTML, one file per page (multi-page, not an SPA — course pages need to rank in Google) |
| Styling | Tailwind CSS 3.4, **compiled** to `assets/css/app.css` (23 KB) — not the CDN build, which is 400 KB and not for production |
| Scripting | Native ES modules. No framework, no bundler, no runtime dependency |
| Fonts | Inter, from Google Fonts |

Three shared modules do the work:

- `assets/js/api.js` — every endpoint, mirroring `lib/core/api/api_endpoints.dart`
- `assets/js/session.js` — customer session + admin token
- `assets/js/ui.js` — header, footer, cards, toasts, formatting

## Design

The palette is lifted **verbatim** from the app's `lib/app/theme/app_colors.dart`
into `tailwind.config.js` — brand blue `#0E5FD8`, navy `#1F3C68`, the
indigo→cyan hero gradient, `#F6F7FB` canvas. Not one colour is new.

The *layout* is deliberately web-shaped, not an enlarged phone screen: sticky
desktop header, filter rail, multi-column grids, hover lift, breadcrumbs, and a
real four-column footer. No bottom tab bar.

## Build

```bash
npm install          # once
npm run build        # compile assets/css/app.css
npm run dev          # same, with --watch while editing
```

**`assets/css/app.css` must be committed.** GitHub Pages runs no build step, so
the compiled file is the artifact. Re-run `npm run build` after touching
`tailwind.config.js`, `src/input.css`, or after adding a class that was not
previously used anywhere — Tailwind only emits classes it can see in `content`.

## Local preview

ES modules and `fetch` do not work over `file://`, so use a server:

```bash
npx http-server . -p 4173 -c-1
```

Then open <http://localhost:4173>.

## Deploy to GitHub Pages

1. Push this folder to a repo (contents at the repo root, not nested).
2. **Settings → Pages →** Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. Custom domain: `infumedz.chandus7.in`. `CNAME` is already in the repo.
4. At your DNS provider, point the apex at GitHub Pages:
   - `A` records → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - or `ALIAS`/`ANAME` → `<username>.github.io`
   - `CNAME` for `www` → `<username>.github.io`
5. Tick **Enforce HTTPS** once the certificate is issued (can take ~15 minutes).

`.nojekyll` is present so Jekyll does not strip anything.

### If the repo is public

It serves every file as readable text. That is fine — **there is no secret in
this project.** The admin token is obtained at runtime via `admin/login/`; it is
never embedded. Keep it that way: never paste a key, token or password into any
file here.

## Pages

| file | route | notes |
|---|---|---|
| `index.html` | `/` | Admin's banner carousel (3s auto-advance), admin-picked popular courses/books, live stats, real testimonials |
| `courses.html` | `/courses.html` | Filter by speciality and price, search, sort |
| `course.html` | `/course.html?id=…` | Dark hero, inline player, tabbed curriculum/reviews/about, sticky purchase rail, Razorpay checkout |
| `books.html` / `book.html` | | Same layout; PDFs open in a **read-only** inline reader |
| `library.html` | | Signed-in only; purchases |
| `profile.html` | | Account details, notifications, delete account |
| `support.html` | | Chat assistant, FAQ accordion, ticket form, contact rail |
| `services.html` | | Thesis & publication assistance |
| `about.html` | | Story, live numbers, programmes, contact |
| `login.html` | | Sign in / create account + Google Sign-In |
| `admin/index.html` | **`/admin/`** | Token-gated console |

### Free preview

First **2** lectures per course and **2** PDFs per book are free for everyone;
the rest unlock once `check-access/` confirms the purchase. This mirrors the
app exactly — `course_detail_screen.dart:525`, `flatIndex >= 2 && _isLocked`.
The constant is `FREE_PREVIEW` at the top of `course.html`; change it there
and re-run `python src/make_book_page.py` so the book page follows.

### PDFs are read-only

The reader embeds the PDF with `#toolbar=0&navpanes=0`, which hides the
browser viewer's download and print buttons, and there is no download link
anywhere on the page.

**Be clear about what that is:** it removes the download *affordance*. It is
not access control — the file URL is still reachable from DevTools. Signed,
expiring media URLs are the real fix and were deliberately deferred.

### Logo

`logo.jpeg` goes beside `index.html`. If it is missing the gradient
lettermark shows instead, so a missing file never produces a broken image.
Referenced through `rel()` in `ui.js`, which adds `../` inside `/admin/`.

`books.html` and `book.html` are **generated** from their course counterparts by
`src/make_book_page.py`, so the two never drift apart. Edit the course page, then:

```bash
python src/make_book_page.py
```

## Backend work this website needs

### 1. Admin authentication — required

The admin endpoints currently accept **any** request from **anyone**. Verified
with no credentials:

```
200  GET /api/infumedz/admin/users/   -> full customer list
200  GET /api/infumedz/dashboard/     -> revenue
```

The app hides the admin buttons client-side, which protects nothing. A website
makes it worse: the endpoints ship as readable JavaScript.

`backend_v2/admin_auth.py` fixes this — a signed, expiring token, no new table,
no migration. Its header has the full install steps. In short:

1. Copy to `firstdemoapp2/infumedz/admin_auth.py`
2. `settings.py`: `INFUMEDZ_ADMIN_EMAILS`, `ADMIN_AUTH_ENFORCED = False`
3. `views.py`: append `from .admin_auth import admin_login, admin_required`
4. `urls.py`: add `admin/login/`, wrap the admin routes with `admin_required(...)`
5. `manage.py check`, then **`systemctl restart gunicorn`** (`start` does nothing
   to a running service — that caught us once already)

Leave `ADMIN_AUTH_ENFORCED = False` until the Flutter app sends the token too,
otherwise the shipped app's admin screens break. Grace mode logs every
unauthenticated call so you can see the volume before switching it on.

### 2. Razorpay — currently broken

`create-course-order/` returns **500**. The key and secret in `settings.py` do
not authenticate as a pair. The website's checkout is complete and will work the
moment the backend does; it shows a readable message instead of "500" until then.

### 3. Known follow-ups

- **Media is world-readable by URL.** Any signed-in buyer can copy a video URL
  from DevTools and share it. Agreed to ship as-is and add signed expiring URLs
  in a later pass — the same HMAC approach as the upload tokens.
- **CORS is `*`.** Fine while the admin API is token-protected; worth narrowing
  to `infumedz.chandus7.in` once enforcement is on.
- **`privacy.html`, `terms.html`, `refund.html` do not exist yet** and the
  footer links to them. Privacy and Terms are also outstanding for the Play
  Store listing. Terms still need the refund window and jurisdiction city
  confirmed before they can be written.
- **Google Sign-In needs one console step**: add `https://infumedz.chandus7.in`
  to *Authorised JavaScript origins* on the OAuth client in Google Cloud
  Console. If that client is an Android type, a Web client ID is needed and
  the backend must accept both audiences.
