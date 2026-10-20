# Adds the four-member team section to about.html.
#
# The list at the top of the injected script is the bit the user edits -
# name, role, credentials, a short bio and an optional photo per person.
# A missing photo falls back to initials rather than a broken image.

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, "about.html")
s = open(p, encoding="utf-8").read()

if "data-team" in s:
    print("about.html already has the team section - no change")
    raise SystemExit(0)

# Anchor on the comment's stable prefix; the box-drawing run length varies.
m = re.search(r"^<!-- ── Specialities .*$", s, re.M)
assert m, "specialities anchor not found"
anchor = m.group(0)

TEAM_HTML = """<!-- ---- Team ---- -->
<section class="border-t border-line bg-white">
  <div class="shell py-14">
    <div class="mx-auto max-w-2xl text-center">
      <p class="eyebrow">Our team</p>
      <h2 class="mt-1.5 text-2xl sm:text-3xl">The people behind InfuMedz</h2>
      <p class="prose-brand mt-3">
        Practising clinicians and educators who write, review and teach the material themselves.
      </p>
    </div>
    <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-team></div>
  </div>
</section>

"""

s = s.replace(anchor, TEAM_HTML + anchor, 1)

TEAM_JS = """/* =========================================================
   TEAM - THIS IS THE LIST YOU EDIT

   Four members. For each one:
     name   - as it should appear publicly
     role   - position / title
     creds  - degrees or qualifications (optional)
     bio    - one or two sentences (optional)
     photo  - a file you drop in assets/img/, e.g. 'assets/img/akif.jpg'.
              Leave it as '' and the card shows their initials instead, so a
              missing photo never produces a broken image.

   The first entry is pre-filled from the author page of ADULT CARDIOLOGY
   Volume 1 purely to show the shape - correct anything that is wrong, and
   replace members 3 and 4 with the real people.
   ========================================================= */

const TEAM = [
  {
    name:  'Dr. Akif Ahamad Baig',
    role:  'Founder & Consultant Interventional Cardiologist',
    creds: 'MBBS, DNB (General Medicine), DM (Cardiology)',
    bio:   'Founder of Infusion Medical Education Zone. Practising at Aster Ramesh Hospital, Guntur, specialising in complex coronary interventions, pacemaker implantation and IVC filter placement.',
    photo: '',
  },
  {
    name:  'M. A. Sameena Farheen',
    role:  'Co-author & Academic Lead',
    creds: '',
    bio:   '',
    photo: '',
  },
  {
    name:  'Team member 3',
    role:  'Role',
    creds: '',
    bio:   '',
    photo: '',
  },
  {
    name:  'Team member 4',
    role:  'Role',
    creds: '',
    bio:   '',
    photo: '',
  },
];

function teamInitials(name) {
  const words = String(name || '?').trim().split(/\\s+/)
    .filter(function (w) { return /^[A-Za-z]/.test(w); });
  const pick = words.slice(-2);
  return pick.map(function (w) { return w[0]; }).join('').toUpperCase() || '?';
}

function teamCard(m) {
  const initials = teamInitials(m.name);

  // A photo that fails to load is swapped for the initials, so the ring and
  // layout stay intact instead of showing a broken-image glyph.
  const avatar = m.photo
    ? '<img src="' + fmt.esc(m.photo) + '" alt="" class="h-full w-full object-cover" ' +
      'data-initials="' + fmt.esc(initials) + '" onerror="this.outerHTML=' +
      '&quot;<span class=\\'text-xl font-black text-white\\'>&quot;+this.dataset.initials+&quot;</span>&quot;">'
    : '<span class="text-xl font-black text-white">' + fmt.esc(initials) + '</span>';

  return '' +
    '<div class="card-hover group p-6 text-center">' +
      '<span class="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-brand-grad ring-4 ring-chip">' +
        avatar +
      '</span>' +
      '<h3 class="mt-4 text-base leading-snug">' + fmt.esc(m.name) + '</h3>' +
      '<p class="mt-1 text-sm font-semibold text-primary">' + fmt.esc(m.role) + '</p>' +
      (m.creds ? '<p class="mt-1 text-xs text-ink-muted">' + fmt.esc(m.creds) + '</p>' : '') +
      (m.bio ? '<p class="prose-brand mt-3 text-sm">' + fmt.esc(m.bio) + '</p>' : '') +
    '</div>';
}

document.querySelector('[data-team]').innerHTML = TEAM.map(teamCard).join('');

async function load() {"""

old_js = "async function load() {"
assert old_js in s, "load() not found"
s = s.replace(old_js, TEAM_JS, 1)

open(p, "w", encoding="utf-8", newline="\n").write(s)
print("about.html: team section added (4 editable slots)")
