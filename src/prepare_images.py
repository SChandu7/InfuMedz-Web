# Normalises the logo and team photos into assets/img/.
#
# The files arrived in two places (project root and assets/img/) with the
# logo named logo2.jpeg while ui.js looked for logo.jpeg - which is why the
# header fell back to the lettermark and the browser logged a 404.
#
# This script:
#   - collects whichever copy it can find of each image
#   - downscales and re-encodes them (team1.jpeg was 2732x2272 / 1.4 MB,
#     which is a wasteful download for an 80px avatar)
#   - writes them all to assets/img/ under predictable names
#   - removes the duplicates left in the project root
#
# Avatars are square-cropped from the centre so a portrait photo does not
# end up with the subject's head cut off by the circular mask.

import os
import shutil

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")
os.makedirs(IMG, exist_ok=True)

# (output name, candidate source names, target box, square?)
JOBS = [
    ("logo.jpeg",  ["logo.jpeg", "logo2.jpeg"],   (512, 512), True),
    ("team1.jpeg", ["team1.jpeg"],                (640, 640), True),
    ("team2.jpeg", ["team2.jpeg"],                (640, 640), True),
    ("team3.jpeg", ["team3.jpeg"],                (640, 640), True),
    ("team4.jpeg", ["team4.jpeg"],                (640, 640), True),
]

SEARCH = [ROOT, IMG]


def find(names):
    for d in SEARCH:
        for n in names:
            p = os.path.join(d, n)
            if os.path.isfile(p):
                return p
    return None


done, skipped = [], []

for out_name, candidates, box, square in JOBS:
    src = find(candidates)
    if not src:
        skipped.append(out_name + " (no source found: " + ", ".join(candidates) + ")")
        continue

    before = os.path.getsize(src)
    with Image.open(src) as im:
        # Honour EXIF rotation - phone photos are often stored sideways.
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGB")

        if square:
            # Centre-crop to a square first, then resize, so the circular
            # avatar mask never slices off part of the face.
            im = ImageOps.fit(im, box, method=Image.LANCZOS, centering=(0.5, 0.42))
        else:
            im.thumbnail(box, Image.LANCZOS)

        dst = os.path.join(IMG, out_name)
        im.save(dst, "JPEG", quality=86, optimize=True, progressive=True)

    after = os.path.getsize(dst)
    done.append((out_name, os.path.relpath(src, ROOT), before, after))

# Clear the stray copies from the project root so there is one source of truth.
removed = []
for stray in ["logo.jpeg", "logo2.jpeg", "team1.jpeg", "team2.jpeg", "team3.jpeg", "team4.jpeg"]:
    p = os.path.join(ROOT, stray)
    if os.path.isfile(p):
        os.remove(p)
        removed.append(stray)

# logo2.jpeg in assets/img is superseded by logo.jpeg.
old_logo = os.path.join(IMG, "logo2.jpeg")
if os.path.isfile(old_logo) and os.path.isfile(os.path.join(IMG, "logo.jpeg")):
    os.remove(old_logo)
    removed.append("assets/img/logo2.jpeg")

print("written to assets/img/:")
for name, src, b, a in done:
    print("   %-12s from %-22s %6d KB -> %5d KB" % (name, src, b // 1024, a // 1024))
if skipped:
    print("skipped:")
    for s in skipped:
        print("   " + s)
if removed:
    print("removed duplicates: " + ", ".join(removed))
