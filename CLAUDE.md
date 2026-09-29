# Tack Sharp: build spec

You're building Tack Sharp, a depth-of-field and "tack sharp" focus solver. It is installed as a PWA
from GitHub Pages on a Samsung Galaxy S25 Ultra (Android, Chrome) and must also work in desktop Chrome. Primary camera: Sony a7R VI.

Repo: `github.com/complexempty/tack-sharp`. Published at `complexempty.github.io/tack-sharp/`.

## Working rules
- Start in plan mode. Read this whole spec, then return a build plan, the open decisions below, and anything in this spec you think is wrong, risky, or has a better alternative. Write no code until I approve the plan.
- If a method I propose is flawed, say so directly with the reason. Once I decide, drop it.
- On the first commit, save this spec as CLAUDE.md in the repo root. Update it whenever a decision changes.
- Code must contain zero comments of any kind: JS, CSS, HTML and tests. Names carry the meaning.
- Use vanilla HTML, CSS and JavaScript ES modules. No framework, no build step, no runtime dependencies, no CDN scripts. There are no external requests at all: fonts are self-hosted.
- Everything runs on the device. No servers, analytics or uploads.
- Build in the phases below. Commit after each phase, and leave the app deployable after each one.
- Test everything as described under Testing. A phase isn't done until its tests pass.
- Keep chat replies concise: lead with the answer, no filler.

## Decisions (settled 2026-09-29)

1. **Distance model — fully consistent.** Entered distances are sensor-plane (the ⦵ mark). Convert to thin-lens object distance on input, solve in object-distance space, convert back for display. Diffraction uses the effective f-number. See section A.
2. **Lens profiles — calibration only, with stubs.** No preset aberration data from lab charts. Empty profiles are seeded for the two owned lenses (section H).
3. **Frame positions — three zones.** Center / edge / corner by normalized image height (section H).
4. **Fonts self-hosted.** Barlow and Barlow Semi Condensed latin woff2 subsets live in `fonts/`. No Google Fonts request.

## Phases
1. Core solver app and PWA (sections A–G)
2. Lens profiles in the solver (section H)
3. Calibration from test photos (section I)
4. Real-photo sharpness check (section J)

## A. Optics model
- Internal lengths are in mm. Distances the user enters and reads are measured from the sensor plane (the ⦵ mark). Internally everything is solved in thin-lens object distance measured from the lens.
- **Distance conversion.** For a sensor-plane distance D and focal length f, the object distance x satisfies x² = D(x − f), so x = (D + √(D² − 4Df)) / 2, and D = x² / (x − f). Infinity maps to infinity. This requires D ≥ 4f, which is exactly the "too close for the focal length" error. It assumes a symmetric thin lens that extends to focus; real internally-focusing lenses sit between this and no correction at all. Say so in How it works.
- Magnification m = f / (s − f), where s is the object-space focus distance.
- Blur is an equivalent blur-disc diameter on the sensor:
  - Defocus at object distance x, focus s, focal length f, f-number N: b = f²·|1/x − 1/s| / (N·(1 − f/s)). Treat 1/∞ as 0. Note 1/(1 − f/s) = 1 + m, so this term already carries the bellows factor.
  - Diffraction: the Airy pattern at λ = 550 nm matched to an equal-variance blur disc, at the effective f-number N·(1 + m). d = k·N·(1 + m), with k = 1.68·λ = 0.000924 mm. The Airy Gaussian has σ = 0.42·λ·N, and a uniform disc of diameter d has per-axis σ = d/4.
  - Lens aberration a: added in phase 2. It is zero for "Perfect lens."
  - Total = √(b² + (kN(1+m))² + a²). Sharp means total ≤ c, the blur limit.
- Diffraction can be switched off in settings, which sets k = 0.
- Derived quantities, all in object space, with k' = k·(1 + m):
  - c_eff(N) = √(c² − k'²N² − a²). If this is ≤ 0, nothing is sharp at that aperture.
  - J = f²/(N·c_eff). Hyperfocal H = J + f.
  - 1/near = 1/s + (1 − f/s)/J. 1/far = 1/s − (1 − f/s)/J. Far is ∞ when that value is ≤ 0.
  - Best focus for targets n to r is their harmonic mean, 1/s = (1/n + 1/r)/2, which splits blur evenly. This is the exact minimax, since both edge blurs share the (1 − f/s) denominator.
  - G = max(|1/n − 1/s|, |1/r − 1/s|) and A = f²·G/(1 − f/s). Defocus at the worst edge = A/N.
- Closed form for a = 0, at fixed m:
  - Both edges are sharp for N in [N1, N2], where N1² = 2A²/(c² + q), N2² = (c² + q)/(2k'²), and q = √(c⁴ − 4k'²A²).
  - This is feasible only if 2Ak' ≤ c².
  - Sharpest aperture N_opt = √(A/k'), with best blur √(2Ak').
  - With k = 0, N1 = A/c and there is no upper bound.
- With a lens profile, a depends on N, so the closed form no longer applies. Scan the marked stops inside the lens's aperture range and evaluate each directly. Use bisection wherever an exact inverse is needed.
- The distance conversion makes s depend on f, so solving for focal length is implicit. Bisect it rather than using the quadratic.
- Aperture stops are the exact third stops N = 2^(i/6), i = 0…30 (f/1 to f/32), plus f/0.95. Use exact values in the math and nominal labels in the UI: 1, 1.1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22, 25, 29, 32.

## B. Cameras and sharpness standards
Pixel pitch p = √(sensor area / pixel count).

Cameras (sensor width × height in mm, then pixels):
- Sony a7R VI (default): 35.9 × 24.0, 9984 × 6656. Verified from Sony's spec page: 3.60 µm pitch.
- Sony a7R V: 35.7 × 23.8, 9504 × 6336
- Sony a1 II: 35.9 × 24.0, 8640 × 5760
- Sony a7 V: 35.9 × 23.9, 7008 × 4672
- Sony a7 IV: 35.9 × 23.9, 7008 × 4672
- Sony a7C R: 35.7 × 23.8, 9504 × 6336
- Sony a7C II: 35.9 × 23.9, 7008 × 4672
- Sony a9 III: 35.6 × 23.8, 6000 × 4000
- Sony a7S III: 35.6 × 23.8, 4240 × 2832
- Custom: user enters width, height, pixels wide and pixels high.

Blur-limit tiers:
- Pixel-level: 2 pixels (a7R VI: 7.20 µm). Sharp at 100% zoom.
- Critical (default): half of Standard (a7R VI: 15.0 µm). Large prints and heavy crops.
- Standard: 0.030 mm × sensor diagonal / 43.27 (a7R VI: 29.9 µm). The whole image on a screen or a small print.
- Custom: entered in µm.

## C. Subject mode (main tab)
Subject presets. All dimensions are editable, and each preset remembers its own distance.
- Portrait:
  - Input: "Distance to eyes" (default 2.0 m).
  - Framing sets how far in front of and behind the eyes must be sharp: Both eyes 15/15 mm; Nose to ears 30/90; Head and shoulders 30/200; Full body 100/250.
  - Editing those numbers switches the framing to custom.
- Group:
  - Input: "Distance to front row" (default 4.5 m).
  - Rows 1–8 (default 3). Row spacing defaults to 600 mm.
  - Each row's face needs 30 mm in front of and 90 mm behind the eyes. Targets run from the front row's nose to the back row's ears.
- Car:
  - Input: "Distance to nearest point" (default 7.0 m).
  - Length 4900 mm, width 1900 mm.
  - Angle 0–180°, with quick views: Front 0, 3/4 front 40, Side 90, 3/4 rear 140, Rear 180.
  - Depth = L·|cos θ| + W·|sin θ|.
- Landscape:
  - Input: "Nearest point that must be sharp" (default 2.0 m). The far target is ∞.
- Range:
  - Input: near edge (default 3.0 m), plus a depth or ∞.

Solve for:
- Aperture:
  - "Widest that works" (default): the smallest marked stop ≥ N1 that is inside the lens range and ≤ N2.
  - "Sharpest": the aperture with the least blur at the worst edge.
  - If nothing works, set the sharpest aperture and report the best achievable blur.
- Focal length: the longest focal length that still works at the set aperture, found by bisection, rounded down to a whole mm. When a lens is selected, constrain the result to its zoom range.
- Distance: the minimum camera distance that works at the set focal length and aperture. Solve by bisection, since blur falls monotonically with distance, and round up for display.
- Just check: evaluate the settings as entered.
- Editing a solved field switches Solve for to Just check.

Focus point:
- Options: Best point (harmonic mean), On eyes (portrait) or Front row (group), or Manual.
- Editing the focus field switches to Manual.
- Solving for Distance switches Manual to Best point.

Verdict, three states:
- Pass: "<subject> will be tack sharp", with the tier limit and the worst-edge blur.
- Marginal: best blur within 10% of the limit either side. Say it is borderline and inside the model's own uncertainty, then show the same options as a fail.
- Fail: a headline, the best achievable blur and its multiple of the limit, then these options:
  - Apertures that would work, if the one set doesn't.
  - Step back to X at a given aperture. Use the set aperture if it's feasible, otherwise the stack aperture. Note that the subject gets smaller in the frame.
  - A looser tier that works, and at which aperture.
  - Focus stack, for car, landscape and range only (not portraits or groups):
    - Aperture: the one that maximizes N·c_eff(N), snapped to a marked stop in the lens range. With a = 0 and negligible magnification that's c/(k√2): f/5.6 at Pixel-level and f/11 at Critical on the a7R VI.
    - Step frames through 1/x space from near to far with 10% overlap.
    - List each frame's focus distance from nearest to farthest, capped at 99 frames.
- Errors, each with a plain fix: too close for the focal length (D < 4f); focus closer than the lens's minimum focus distance; diffraction alone over the limit; lens aberration alone over the limit; no focal length works.
- When a lens profile is selected and the tier is Pixel-level, most real lenses cannot reach it at any aperture. Attribute that to the lens, not to the settings.

Details list:
- Where to focus, for example "1.2 in behind the eyes", "Between rows 1 and 2, 2.3 ft behind the front row" or "4.1 ft past the nearest point"
- Sharp zone and depth of field
- In front of and behind focus, with the percentage split
- Blur at the near and far edges
- Diffraction blur (µm and px)
- Apertures that work
- Sharpest aperture and its blur
- Hyperfocal at the set aperture
- Blur limit (µm and px)
- If no sharp zone exists, show: "Sharp zone: none, diffraction alone is over the limit."

## D. Free calculator tab
- Five fields: focal length, aperture, focus distance, near limit and far limit. Far limit has an ∞ button.
- Exactly three fields are locked at all times, and the other two fill in.
- Typing in or stepping a field locks it and releases the oldest lock.
- Never allow {focus, near, far} as the locked set, because it is degenerate. Release the second-oldest lock instead.
- Tapping a locked field's lock icon shows a hint instead of unlocking it.
- Solve all nine valid combinations, using the relations in section A. All nine are closed form in object space; the distance conversion makes the ones that solve for focal length implicit, so those bisect.
- When aperture is solved, use the wider root and show "Set the camera to f/X", where X is the next marked stop up.
- Errors:
  - Near must be closer than focus and far.
  - Far must be farther than focus.
  - A limit is beyond what the lens can reach, for example "The farthest the near limit gets is X, focused at infinity."
  - No aperture holds the depth at this tier; show the sharpest possible result.

## E. Diagram (sticky at the top, collapsible)
Drawn on a single devicePixelRatio-scaled canvas. Two views:
- Close-up: a true-scale top-down plan view with the camera off to the left.
  - Subject silhouettes: a head with nose, eyes and ears; shoulders; staggered group rows; a rotated car with glass, roof and mirrors; a block for Range.
  - Fill them with a horizontal sharpness gradient sampled from the blur model. The sharp color runs up to the limit, blends quickly to the warn color just past it, goes from warn to soft by 2.5× the limit, then the soft color fades out.
  - A faint gradient across the whole panel shows the sharp slab.
  - Face framings zoom in on the head.
- Whole scene: a compressed distance axis, x = d/(d + K), where K is the focus distance and ∞ sits at the right edge.
  - Camera icon at the left and a target bar; landscape shows a tree and mountains.
  - Landscape and infinite ranges always use this view.

Below the picture:
- A blur-ratio curve (total blur ÷ limit, clamped at 3) with the limit line, the lens-plus-diffraction floor, and a distance axis with round-number ticks.
- Vertical Near, Focus and Far lines. Labels move to a second row instead of overlapping, and have a halo so the curve never hides them.
- Tap or drag anywhere to read distance, blur (µm) and sharp or × limit.

Under the diagram: summary cells for Aperture, Focus at and Focal length, plus Stand at when solving distance. Solved values use the accent color.

## F. Units, formatting and persistence
- ft/m toggle.
- Distances: 2 decimals under 10, 1 decimal under 100, whole numbers above.
- Lengths under 2 ft or 1 m display in inches or cm. Small offsets use inches or cm.
- µm values show 1 decimal.
- Steppers:
  - Focal length steps through common focal lengths from 8 to 1000 mm.
  - Aperture steps by third stops.
  - Distances step by about 3%, rounded to 1/2/5 increments.
- Typed values are accepted. The f/ prefix is optional, and "inf" or ∞ works for far.
- Persist all settings in localStorage, with ∞ serialized as a string and every access wrapped in try/catch.

## G. Design and PWA
Layout:
- Mobile-first at 412 px width. Max content width 600 px, 16 px side gutters, controls at least 38 px tall.

Themes:
- Dark graphite-blue by default, plus a light theme, with an Auto (system) / Light / Dark setting.
- Dark tokens: bg #151a1f, surface #1c232a, surface-2 #242d36, stage #10151a, line #2c3640, strong line #55626e, text #e3e7eb, muted #8d99a5, accent #8cb4de, sharp #4dd19a, warn #e0b443, soft #e2654c.
- Light tokens: bg #eef1f3, surface #ffffff, surface-2 #e3e8ec, stage #dde3e8, line #cfd6dd, strong line #8e9aa6, text #17202a, muted #56626e, accent #2a64a0, sharp #178f60, warn #b07c05, soft #bf4630.

Type:
- Barlow (400/500/600) and Barlow Semi Condensed (500/600), self-hosted latin woff2 in `fonts/`, with system fallbacks.
- Tabular numerals in readouts. Sentence-case labels.

Section order:
1. Header: app name, camera chip, units
2. Mode tabs
3. Sticky diagram
4. Verdict
5. Sharpness standard
6. Subject and solve controls, or the free calculator
7. Details
8. Focus stack
9. Camera and lens settings: camera, custom sensor, diffraction switch, lens or aperture range, theme
10. How it works

PWA:
- Manifest: name and short_name "Tack Sharp"; id, start_url and scope "./"; standalone; portrait; theme and background colors from the dark tokens; icons at 192, 512, and maskable 512.
- Icon: three rounded vertical bars on graphite, inside the maskable safe zone: a short warn bar, a tall sharp bar and a short soft bar.
- Service worker:
  - Precache every app file under a versioned cache name.
  - Cache-first for the app shell, so a page is never served a mix of old and new ES modules. Stale-while-revalidate for everything else.
  - Delete old caches on activate. Use skipWaiting and clients.claim, and post a message that triggers one reload when the controlling version changes.
  - Register it when `isSecureContext` is true, which covers https and localhost.
- Keep all paths relative so the app works under /tack-sharp/ on GitHub Pages.

How it works: explain the blur model, the tiers, best-point focus, sensor-plane distances and the symmetric-thin-lens assumption behind the conversion. List what isn't modeled: motion blur, missed focus, heat shimmer, focus shift and field curvature.

## H. Lens profiles (phase 2)
- Lens selector in Camera and lens:
  - "Perfect lens": a = 0, with manual widest and smallest aperture selects.
  - Calibrated profiles.
  - Custom entry.
- A profile holds:
  - Name and lens model string (for EXIF matching)
  - Prime or zoom, focal range and aperture range
  - Maximum aperture as a function of focal length, as interpolated breakpoints, so a variable-aperture zoom is represented honestly
  - Minimum focus distance, also by focal length
  - Aberration blur a (µm) by aperture, frame position and focal length (for zooms)
- Seeded stubs, with no aberration data until calibrated:
  - Sony FE 200-600mm F5.6-6.3 G OSS. Zoom 200–600 mm. Maximum aperture f/5.6 at 200 mm to f/6.3 by roughly 400 mm. Minimum aperture f/32 at 200 mm to f/36 at 600 mm. MFD 2.4 m.
  - Sigma 24-70mm F2.8 DG DN Art II. Zoom 24–70 mm. Maximum aperture f/2.8 throughout, minimum f/22. MFD 0.17 m at 24 mm to 0.34 m at 70 mm.
  - EXIF match strings are seeded as best guesses and replaced with the literal string read from the file the first time that lens is calibrated.
- Selecting a lens sets the aperture range and focal range.
  - Primes fix the focal length, which disables Solve for Focal length.
  - Zooms constrain focal-length results to their range, and report when a focal-length result costs maximum aperture.
- Frame position selector next to the subject controls: Center / Edge / Corner. Default: Center. Zones by normalized image height ρ = radius / half-diagonal: center ρ ≤ 0.3, edge 0.3 < ρ ≤ 0.8, corner ρ > 0.8.
- Interpolate a in log N between measured stops, and hold the end values outside the measured range. For zooms, interpolate between measured focal lengths.
- In the diagram, the floor becomes lens plus diffraction. "Sharpest" becomes the real peak for that lens and frame position.

## I. Calibration from test photos (phase 3)
Purpose: measure my own copy of each lens and build its profile. Photos are processed locally and never stored or uploaded.

Targets:
- The app generates a printable target page: black squares rotated about 5° on white, sized for letter paper, with instructions.
- Black tape on white foam board is an accepted alternative.

In-app shooting guide:
- Targets at the center, edge and corner of the frame
- Tripod, square to the wall
- 2-second timer, low ISO, AF on each shot
- Every third stop (or every full stop) from wide open to f/16, with 2–3 frames per aperture
- Distance about 25–50× the focal length
- For zooms, repeat at each focal length I care about
- Above roughly 300 mm, warn about heat shimmer and wind, advise a cold overcast day with the target low and close to the ground, and ask for more frames per aperture so the best-frame rule can reject contaminated ones

Input:
- JPEG or PNG. Accept multiple files at once.
- Sony ARW can't be decoded in a browser. Tell me to either:
  - export from Lightroom as JPEG at quality 100 with sharpening 0, noise reduction off and metadata included; or
  - shoot camera JPEG with sharpening and noise reduction at minimum.
- Read EXIF from JPEGs with a small in-house parser: FNumber, FocalLength, LensModel, Model and Orientation. PNGs or missing EXIF fall back to manual entry.

Performance:
- Handle 9984 × 6656 images on the phone. A full-resolution ImageData is about 266 MB, so never build one.
- Prefer WebCodecs `ImageDecoder` to pull sub-rects; fall back to `createImageBitmap(blob, sx, sy, sw, sh)`.
- Build the tap preview with `createImageBitmap(blob, {resizeWidth: 1024})`.
- Run the analysis in a Web Worker on OffscreenCanvas and show progress.

Finding targets:
- I tap each target on a preview, and the app refines the edge region automatically.
- Automatic detection of the printed targets is a stretch goal.

Measurement: slanted-edge SFR, per the ISO 12233 e-SFR method.
1. Convert sRGB to linear light and use luminance.
2. Fit the edge line from per-row centroids.
3. Project pixels onto the edge normal and bin a 4× oversampled ESF.
4. Differentiate to get the LSF and apply a Hamming window.
5. Take the DFT and normalize at zero frequency.
6. Divide out the transfer function of the differentiating filter itself, sinc(2νΔ) for the [−0.5, 0, 0.5] kernel at bin width Δ. Without this the result reads about 3% low at the sharp end, which is the whole test tolerance.
7. Report MTF50 in cycles per pixel.
- Measure one near-vertical and one near-horizontal edge per target. Store both, and use the worse one for the profile.

Conversion to lens blur:
- σ = 0.1874 / MTF50 (Gaussian equivalence, in pixels), and blur disc = 4σ·p.
- Remove the pixel-aperture blur (1.155·p) and diffraction (k·N) in quadrature. The remainder is a, clamped at 0.
- This leaves demosaic softness inside a, which errs conservative. Say so in How it works.
- Assign frame position from the target's normalized distance from the image center, using the zone thresholds in section H.
- Keep the best frame for each aperture and position.

Warnings:
- Sharpening halos: ESF overshoot beyond about 5% of edge contrast
- Tilt: left and right, or top and bottom, corners differing by more than about 25% at the same aperture. Corner measurements are tagged with which corner they came from so this check works.
- Low-contrast or clipped edges
- Noisy edges
- Edge angle outside 2–10°

Results and storage:
- A results screen with a table and curve per position, an editable name, and Save.
- Store profiles in IndexedDB.
- Export and import profiles as JSON, so a reinstall or new phone doesn't lose them.

## J. Real-photo sharpness check (phase 4)
- Load any JPEG and tap a clean, straight, high-contrast edge. The app measures the blur there.
- Using the EXIF aperture and the selected lens profile, compare the result with what the lens should deliver at that aperture and frame position.
- Report either "consistent with the lens" or "softer than the lens explains", which points to missed focus or motion.
- State plainly that it needs a clean edge and can't tell focus error from motion.

## Testing
Node unit tests for the math:
- a7R VI pixel pitch 3.6008 µm, and Pixel-level limit 7.2015 µm.
- All nine free-calculator lock combinations round-trip exactly.
- Hyperfocal, near and far match the formulas. Hyperfocal at 24 mm f/8 Critical is 5.587 m sensor-plane, with a near limit of 2.806 m.
- Minimum sensor distance 4f is 96 / 340 / 800 mm at 24 / 85 / 200 mm.
- Stack aperture is f/5.6 at Pixel-level and f/11 at Critical, at negligible magnification.
- a7R VI, perfect lens, diffraction on, under the locked distance model:

  | Case | Tier | Widest that works | Best blur |
  |---|---|---|---|
  | 85 mm, eyes 2.0 m, Nose to ears | Critical (14.97 µm) | none | 15.28 µm at f/11 |
  | 85 mm, eyes 2.0 m, Nose to ears | Standard (29.94 µm) | f/4.5 | 15.28 µm at f/11 |
  | 85 mm, eyes 2.0 m, Both eyes | Critical | f/2.2 | 7.76 µm at f/5.6 |
  | 85 mm, eyes 2.0 m, Head and shoulders | Critical | none | 20.62 µm at f/14 |
  | 24 mm, landscape 2.0 m to ∞ | Critical | none | 16.52 µm at f/13 |
  | 85 mm, car 7.0 m, 3/4 front | Critical | none | 20.33 µm at f/16 |

SFR tests on synthetic slanted edges with known Gaussian blur:
- The synthetic edge is point-sampled from the analytic Gaussian-blurred step, not integrated over the pixel footprint, so the target is a pure Gaussian MTF50.
- Recovered MTF50 is within 3% of the analytic value.
- The sharpening-halo and tilt warnings fire on synthetic cases.

Playwright tests at 412 × 915, in both dark and light themes:
- Sweep every preset, solve mode, focus mode, tier and view with zero console errors.
- Screenshot key states and review them.
- Verify persistence across reloads.
- Verify offline launch through the service worker on localhost.
- Load a full-size 9984 × 6656 JPEG through the calibration flow without crashing.

## Deployment
- GitHub Pages serves the main branch root.
- After the first deploy, remind me to set Settings → Pages → Deploy from a branch → main / (root).
- Phone install: open the URL in Chrome → ⋮ → Add to home screen → Install. Open it once online, then relaunch to finish caching.
