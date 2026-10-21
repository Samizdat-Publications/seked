### 1. Claims Honesty Audit

#### Finding 1.1: `evaluateClaim` grades multi-comparison claims by AND (`every`), making `B2` and `B4` behave inconsistently when alternative hypotheses are listed
* **Severity:** High
* **File and key/line:** `packages/claims/src/evaluate.ts` (line 80: `comparisons.every((c) => c.within)`), `data/claims/B2.yaml`, `data/claims/B4.yaml`, `data/claims/C5.yaml`, `data/claims/D3.yaml`
* **What is wrong:** `evaluateClaim` sets `fits: true` only if *every* comparison in `comparisons` passes. However, the claim files use `comparisons` for two incompatible logical structures:
  1. **Conjunctive (AND):** Claims where all parts must hold simultaneously (e.g., `C2` four shafts, `C4` angle and offset, `C5` azimuth and timing, `D3` meridian and diagonals).
  2. **Disjunctive (OR / contrast):** `B2` ("the mean distance or the perihelion distance, whichever fits") and `B4` (comparing the casing base vs. the socket base to show that Smyth's claim only works on the socket base).
  In `B4`, the socket base passes (`-0.16 %` vs `±0.5 %`), but because the casing base fails (`-0.79 %`), `B4` is marked `fits: false` (`Within tolerance: no` in `docs/dossier.md`). Conversely, in `B2`, the astronomical unit misses by `-2.01 %` while perihelion misses by `-0.34 %`. To make `B2` pass under `.every()`, `tolerance_pct` was inflated to `2.5 %`—five times the default `0.5 %`—so that *both* the mean distance and the perihelion distance pass simultaneously, contradicting the free choice text ("whichever fits").
* **Evidence:**
  * `data/claims/B2.yaml`: `tolerance_pct: 2.5`, `free_choices: - the mean distance or the perihelion distance, whichever fits`.
  * `data/claims/B4.yaml`: `comparisons` tests both `g1.base.side.mean` and `g1.base.socket.mean`. `packages/claims/src/claims.test.ts` (lines 68–73): `expect(casing!.within).toBe(false); expect(socket!.within).toBe(true); expect(r.fits).toBe(false);`.
* **How to confirm:** Inspect `evaluateClaim` in `packages/claims/src/evaluate.ts` and compare the summary table in `docs/dossier.md` for `B2` and `B4`.

#### Finding 1.2: `A5` ("The cubit itself") uses a circular, post-hoc input in the `canonical` preset and undercounts free choices
* **Severity:** High
* **File and key/line:** `data/claims/A5.yaml`, `data/measurements/units-and-constants.json` (`key: "cubit.royal"`, `source: "lehner-1997"`)
* **What is wrong:** `A5` tests whether `cubit.royal` equals $\pi/6 \approx 0.5235988\text{ m}$ and $\phi^2/5 \approx 0.5236068\text{ m}$. Under the `canonical` preset, `cubit.royal` resolves to `lehner-1997`, which is `0.5236 m` ("52.36 cm, the conventional Egyptological value", `verified: false`). Because `0.5236` is simply the 4-significant-figure rounding of both $\pi/6$ and $\phi^2/5$, testing `0.5236` against $\pi/6$ yields a residual of `+1 µm (+0.000 %)`. This is testing a modern rounded textbook convention against the exact irrational numbers that happen to round to it. When evaluated against Petrie's actual surveyed weighted mean (`petrie-1883`: `0.523748 ± 0.000127 m`), the residual is `+149 µm` ($1.17\sigma$). Furthermore, `free_choices` only counts `the metre, defined in 1793, as the unit of comparison` (1 choice), omitting the choice of the integers `6` and `5` in the denominators and the exponent `2` on $\phi$.
* **Evidence:** `docs/dossier.md` under `A5` shows `+1 µm (+0.000 %)` for `canonical` and `+149 µm (+0.03 %)` for `petrie-1883`.
* **How to confirm:** Compute $0.5236 - \pi/6 = +1.22 \times 10^{-6}\text{ m}$ and $0.523748 - \pi/6 = +1.492 \times 10^{-4}\text{ m}$.

#### Finding 1.3: `A1`, `A2`, `B1`, `B2`, and `B5` rely on an inconsistent pair of rounded measurements in the `canonical` preset
* **Severity:** Medium
* **File and key/line:** `data/measurements/g1.json` (`lehner-1997` entries for `g1.base.side.mean`, `g1.height.original`, `g1.face.angle`), `packages/geometry/src/environment.ts` (lines 60–75)
* **What is wrong:** In `data/measurements/g1.json`, `lehner-1997` gives `g1.base.side.mean = 230.33 m`, `g1.height.original = 146.59 m`, and `g1.face.angle = 51.8444 deg` ($51^\circ 50' 40''$). However, a square pyramid with base $230.33\text{ m}$ and face angle $51^\circ 50' 40''$ has height $115.165 \times \tan(51.84444^\circ) = 146.605\text{ m}$, whereas $146.59\text{ m}$ gives a face angle of $51^\circ 50' 45''$ (`g1.face.angle.derived = 51.84579 deg`). Because `buildEnvironment` derives `apothem`, `perimeter`, and `face.area` from `base` and `height` while `A3` reads `g1.face.angle` directly, the `canonical` preset flatters `A1` and `A2` relative to the primary surveys (`petrie-1883` and `cole-1925`). Moreover, none of the claims count "choice of survey preset / reconstructed original height" as a free choice, even though `g1.height.original` is a projected value (since the apex is missing) and switching from `canonical` to `petrie-1883` flips the sign of `A1` (`+0.03 %` to `-0.05 %`) and more than doubles the error of `A2` (`-0.09 %` to `-0.20 %`).
* **Evidence:** `packages/geometry/src/geometry.test.ts` (line 13): `expect(formatDms(p.faceAngleDeg)).toBe('51°50′45″'); // Lehner tabulates 51°50′40″ from the unrounded survey`.
* **How to confirm:** Check `docs/dossier.md` preset tables for `A1`, `A2`, and `A3`.

#### Finding 1.4: `C4` and `C7` use an asymmetric formula for the third-star offset ratio that does not divide by the perpendicular projection
* **Severity:** Medium
* **File and key/line:** `data/claims/C4.yaml` (lines 16–21), `data/claims/C7.yaml` (lines 17–22)
* **What is wrong:** The notes in `C4.yaml` state: *"Menkaure's offset is his perpendicular distance from the G1 to G2 line divided by the length of that line"*.
  Let $\vec{u} = \text{G2} - \text{G1}$ and $\vec{v} = \text{G3} - \text{G1}$. The perpendicular distance from G3 to the G1–G2 line is $|\vec{u} \times \vec{v}| / |\vec{u}|$, so dividing by $|\vec{u}|$ gives $|\vec{u} \times \vec{v}| / |\vec{u}|^2$. That matches the `formula` for the ground:
  `abs(g2.centre.offset.west * g3.centre.offset.south - g2.centre.offset.south * g3.centre.offset.west) / (g2.centre.offset.west^2 + g2.centre.offset.south^2)`.
  However, in the `target` formula for the stars, the vectors are centered on the *middle* star (`alnilam` in `C4`, `sadr` in `C7`): $\vec{a} = \text{star}_1 - \text{star}_2$ and $\vec{b} = \text{star}_3 - \text{star}_2$. By translational invariance of the cross product, $|\vec{a} \times \vec{b}| = |(\text{star}_2 - \text{star}_1) \times (\text{star}_3 - \text{star}_1)|$, so the numerator is identical. This means the ratio being computed is the perpendicular distance of the 3rd object from the 1st–2nd line divided by the 1st–2nd segment length. While mathematically consistent between `formula` and `target`, it is sensitive to the 1st–2nd segment length rather than the total 1st–3rd baseline length, and in `C7` (as `C7.yaml`'s own notes admit) the flat equirectangular approximation $\Delta\alpha \cos\delta_{\text{mid}}$ over a $16.2^\circ$ span introduces a $1.03^\circ$ projection error into the target.
* **Evidence:** `data/claims/C4.yaml` lines 16–21 and `data/claims/C7.yaml` lines 35–42.
* **How to confirm:** Compare the vector algebra of `formula` (origin at G1) and `target` (origin at Alnilam/Sadr).

#### Finding 1.5: `C8` ("The Vulture Stone as a date") omits the sun's refraction/limb and sunset hour-angle from the ecliptic longitude comparison, and under-describes why its date differs from Sweatman & Tsikritsis
* **Severity:** Low
* **File and key/line:** `data/claims/C8.yaml` (lines 15–20)
* **What is wrong:** `C8` tests whether the ecliptic longitude of date of $\gamma$ Sagittarii (`star.alnasl`) equals $90^\circ$ (the summer solstice sun) at epoch `-10949` (10,950 BCE), with `tolerance_abs: 3.5` deg ($\pm 250$ years). It finds $+4^\circ 10' 16''$ and marks the claim `within: false`. While the notes explain that Vondrák 2011 precession puts the exact $\lambda = 90^\circ$ crossing ~300 years earlier than Sweatman & Tsikritsis's Stellarium visual estimate, the claim's summary notes that the authors placed the sun *"just above the teapot's spout"* at sunset. The formula tests $\lambda_{\text{Alnasl}} - 90^\circ = 0$ (exact conjunction in longitude), without accounting for any offset between the spout star ($\gamma$ Sgr) and the solar disc center in the authors' visual diagram.
* **Evidence:** `data/claims/C8.yaml` lines 16–20 and `docs/dossier.md` summary table (`C8`: `4°10′16″`, `Within tolerance: no`).
* **How to confirm:** Evaluate `atan2(sin(star.alnasl.ra) * cos(sun.obliquity) + tan(star.alnasl.dec) * sin(sun.obliquity), cos(star.alnasl.ra))` at `epoch: -10949`.

#### Summary of Other Claims
* **`A3` (Seked $5\frac{1}{2}$), `A4` (KC 3-4-5), `A7` (Khafre 3-4-5):** Formulas, targets, tolerances, and free choices are accurate and fair. (`A4` rightly notes that the $20 \times 10$ floor is circular if Petrie's cubit is used, though under `canonical` it uses `0.5236 m`).
* **`B1` ($1:43,200$), `B3` (Speed of light), `B5` (Half arc-minute):** Formulas and free choices are well-documented and honest. `B3` properly lists the 3 critical free choices (unit conflation, datum, and footprint point).
* **`C1` (True north), `C2` (Shafts), `C3` (Descending passage), `C5` (Sphinx & Leo), `C6` (Solstice akhet):** Formulas accurately reflect the claims. `C2` rightly uses a $1\%$ ($\sim 24'$) tolerance and flags the unverified $39^\circ 07'$ QC north shaft angle and its $\pm 3.4^\circ$ spread. `C6` uses an $8^\circ$ tolerance that matches the half-width of the $16.5^\circ$ physical gap between the pyramids.
* **`D1` (Heliopolis diagonal), `D2` (Legon's rectangle), `D3` (Delta quadrant), `D4` (Temple axes):** Formulas and tolerances are fair and accurately represent the geometric claims.

---

### 2. Independent Recomputation

All recomputations below use the exact database values from `data/measurements/*.json` resolved under the `canonical` preset (`data/presets.json`), Vondrák 2011 precession (`packages/sky/src/vondrak.ts`), and linear proper motion (`packages/sky/src/stars.ts`).

#### 2.1 Great Pyramid Proportions & Earth Scale (`A1`, `A2`, `A3`, `B1`)
From `data/measurements/g1.json` (`lehner-1997`) and `units-and-constants.json` (`wgs84`):
* $b = \text{g1.base.side.mean} = 230.33\text{ m}$
* $h = \text{g1.height.original} = 146.59\text{ m}$
* $\theta_{\text{measured}} = \text{g1.face.angle} = 51.8444^\circ$ ($51^\circ 50' 40''$)
* $R_{\text{polar}} = 6,356,752.314\text{ m}$, $C_{\text{eq}} = 40,075,016.686\text{ m}$

1. **Perimeter over height against $2\pi$ (`A1`):**
   * $P = 4b = 921.32\text{ m}$
   * $P / h = 921.32 / 146.59 = 6.28501262\dots$
   * Target: $2\pi = 6.28318531\dots$
   * Residual: $(6.28501262 - 6.28318531) / (2\pi) = +0.02908\%$ (**Dossier:** `6.28501`, target `6.28319`, residual `+0.03 %` — **Exact match**).

2. **Apothem over half-base against $\phi$ (`A2`):**
   * $b/2 = 115.165\text{ m}$
   * $s = \sqrt{115.165^2 + 146.59^2} = \sqrt{13262.977225 + 21488.6281} = 186.4178246\text{ m}$
   * $s / (b/2) = 186.4178246 / 115.165 = 1.61870199\dots$
   * Target: $\phi = (1+\sqrt{5})/2 = 1.61803399\dots$
   * Residual: $+0.04128\%$ (**Dossier:** `1.6187`, target `1.61803`, residual `+0.04 %` — **Exact match**).
   * Face area over $h^2$: $\frac{1}{2} b s / h^2 = 21468.80877 / 21488.6281 = 0.99907768$, residual $-0.0922\%$ (**Dossier:** `0.999078`, residual `−0.09 %` — **Exact match**).

3. **Seked $5\frac{1}{2}$ palms and slope (`A3`):**
   * 1 royal cubit = 7 palms. Slope $\tan\theta = 7 / 5.5 = 14 / 11 = 1.\overline{27}$.
   * $\theta_{\text{seked}} = \arctan(14/11) = 51.8427734^\circ = 51^\circ 50' 33.98''$.
   * Against $\theta_{\text{measured}} = 51.8444^\circ$: difference is $+0.0016266^\circ = +5.86''$, or $+0.00314\%$ (**Dossier:** `51°50′34″`, residual `5.9″ (+0.003 %)` — **Exact match**).

4. **$1:43,200$ Earth scale (`B1`):**
   * Polar radius: $43,200 \times h = 43,200 \times 146.59 = 6,332,688\text{ m} = 6,332.688\text{ km}$.
   * Difference from $R_{\text{polar}}$: $6,332,688 - 6,356,752.314 = -24,064.314\text{ m} = -24.06\text{ km}$ ($-0.3786\%$). (**Dossier:** `6,332.7 km`, residual `−24.1 km (−0.38 %)` — **Exact match**).
   * Equatorial circumference: $43,200 \times P = 43,200 \times 921.32 = 39,801,024\text{ m} = 39,801.024\text{ km}$.
   * Difference from $C_{\text{eq}}$: $39,801,024 - 40,075,016.686 = -273,992.686\text{ m} = -274.0\text{ km}$ ($-0.6837\%$). (**Dossier:** `39,801 km`, residual `−274.0 km (−0.68 %)` — **Exact match**).

#### 2.2 Orion's Belt Angle, Pyramid Diagonal, and Minimum Meridian Altitude Epoch (`C4`)
1. **G1 to G3 Diagonal (`data/measurements/g2-g3-sphinx.json`, `petrie-1883`):**
   * `g3.centre.offset.west` $= 574.45\text{ m}$, `g3.centre.offset.south` $= 739.19\text{ m}$.
   * Angle from meridian: $\arctan(574.45 / 739.19) = 37.85189^\circ = 37^\circ 51' 06.8''$. (**Dossier:** `37°51′07″` — **Exact match**).
   * Menkaure offset ratio from G1–G2 line (`g2.centre.offset.west` $= 334.41\text{ m}$, `g2.centre.offset.south` $= 353.86\text{ m}$):
     $$\frac{|334.41 \times 739.19 - 353.86 \times 574.45|}{334.41^2 + 353.86^2} = \frac{|247192.528 - 203275.877|}{237046.944} = \frac{43916.651}{237046.944} = 0.1852656$$
     (**Dossier:** `0.18527` — **Exact match**).

2. **Orion's Belt at `epoch: -10449` (10,450 BCE):**
   * Precessing the J2000 coordinates of Alnitak ($\alpha = 85.18970^\circ, \delta = -1.94257^\circ$), Alnilam ($\alpha = 84.05336^\circ, \delta = -1.20192^\circ$), and Mintaka ($\alpha = 83.00167^\circ, \delta = -0.29909^\circ$) with Vondrák `ltpb(-10449)` gives:
     * $\Delta\alpha \cos\delta_{\text{Alnilam}}$ and $\Delta\delta$ yield a tangent-plane belt angle from the meridian of $50.8611^\circ = 50^\circ 51' 40''$.
     * Residual against $37^\circ 51' 07''$: $+13^\circ 00' 33''$ ($+34.368\%$). (**Dossier:** `50°51′40″`, residual `13°00′33″ (+34.368 %)` — **Exact match**).
     * Mintaka offset ratio: $0.148248$, residual $+24.97\%$. (**Dossier:** `0.148248`, residual `+24.97 %` — **Exact match**).

3. **Date of the belt's lowest meridian altitude at Giza:**
   * Because the ecliptic pole has period $\sim 25,770\text{ yr}$ (main XYPER term $256.75\text{ centuries}$), Orion's belt reaches its minimum declination (and thus lowest meridian transit altitude at Giza, $\approx 11^\circ$) when its right ascension of date is near $270^\circ$ ($18\text{h}$). Under Vondrák 2011, the minimum declination of Alnilam occurs around **10,200–10,400 BCE** (within the general epoch Bauval selected for the nadir of Orion's meridian transit), while the $37^\circ 51'$ belt angle is not reached until roughly **11,600–12,000 BCE** (as noted in `data/sources.json` under `fairall-1999` and `allan-2026`).

#### 2.3 Shaft Star Alignment Epochs (`C2` and `docs/shafts.md`)
Observer latitude $\phi = 29.979167^\circ$. Upper culmination altitude is $h = 90^\circ - |\phi - \delta|$.
* **King's Chamber South (Alnitak, $h = 45.0^\circ$, south of zenith):**
  * Target declination: $\delta = \phi - (90^\circ - 45^\circ) = -15.020833^\circ$.
  * At `epoch = -2449` (2450 BCE): $\delta = -14.8174^\circ \implies h = 45^\circ 12' 12''$ (residual $-12.2'$).
  * Solving $\delta(t) = -15.020833^\circ$ yields $t \approx -2491$ (**2492 BCE**), with rate $\approx 3.4\text{ yr/arcmin}$. (**Matches `docs/shafts.md` and `docs/dossier.md`**).
* **King's Chamber North (Thuban, $h = 32.6^\circ$, north of zenith):**
  * Target declination: $\delta = 90^\circ - 32.6^\circ + \phi = 87.379167^\circ$.
  * At `epoch = -2449` (2450 BCE): $\delta = 88.0372^\circ \implies h = 31^\circ 56' 31''$ (residual $+39.5'$).
  * Because Thuban reaches its closest approach to the pole ($\delta_{\max} \approx 89^\circ 32'$) near 2800 BCE, $\delta = 87.379^\circ$ is crossed twice: at **3261 BCE** and **2333 BCE**, at $\approx 3.0\text{ yr/arcmin}$. (**Matches `docs/shafts.md` and `docs/dossier.md`**).
* **Queen's Chamber South (Sirius, $h = 39.6078^\circ$, south of zenith):**
  * Target declination: $\delta = \phi - (90^\circ - 39.6078^\circ) = -20.413033^\circ$.
  * At `epoch = -2449` (2450 BCE): $\delta = -20.6621^\circ \implies h = 39^\circ 21' 32''$ (residual $+14.9'$).
  * Solving $\delta(t) = -20.413033^\circ$ with HYG proper motion yields **2368 BCE** at $\approx 5.6\text{ yr/arcmin}$. (**Matches `docs/shafts.md` and `docs/dossier.md`**).
* **Queen's Chamber North (Kochab, $h = 39.1167^\circ$, north of zenith):**
  * Target declination: $\delta = 90^\circ - 39.1167^\circ + \phi = 80.862467^\circ$.
  * At `epoch = -2449` (2450 BCE): $\delta = 80.6239^\circ \implies h = 39^\circ 21' 19''$ (residual $-14.3'$).
  * Solving $\delta(t) = 80.862467^\circ$ yields **2380 BCE** at $\approx 4.9\text{ yr/arcmin}$. (**Matches `docs/shafts.md` and `docs/dossier.md`**).

*Note on `docs/shafts.md` header text:* Line 3 of `docs/shafts.md` states *"Shaft angles are unverified Gantenbrink values; see data/measurements/g1.json."* In `data/measurements/g1.json`, three of the four shaft angles (`kc.shaft.south.angle`, `kc.shaft.north.angle`, `qc.shaft.south.angle`) are actually marked `"verified": true`, and only `qc.shaft.north.angle` is `"verified": false`. This is a minor documentation staleness in the script that generates `docs/shafts.md`.

---

### 3. Tests Audit

#### Finding 3.1: Tautological test — `a claim never cites the scenery` tests against an empty set
* **Severity:** Medium
* **File and key/line:** `packages/claims/src/claims.test.ts` (lines 257–269)
* **What is wrong:** The test filters `db.structures` for `isContext`:
  ```ts
  const context = new Set(db.structures.filter(isContext).map((s) => s.id));
  ```
  As the comment on line 260 admits (`// Nothing is context yet`), *zero* structures in `data/structures.json` have `context: true` (confirmed by `packages/data/src/data.test.ts` line 117: `for (const s of db.structures) expect(isContext(s), s.id).toBe(false)`). Thus `context` is an empty `Set`, and `expect(context.has(...)).toBe(false)` is guaranteed to pass for every identifier in every claim. Furthermore, `id.slice(0, id.indexOf('.'))` only extracts the first segment before the first dot, whereas structure IDs in `data/structures.json` frequently contain dots (e.g., `g2.sar-shafts`, `heliopolis.obelisk`, `delta.apex`).
* **Evidence:** `packages/claims/src/claims.test.ts` lines 259–265.
* **How to confirm:** Check `db.structures.filter(isContext).length` (it is `0`), or test `id.slice(0, id.indexOf('.'))` on `"heliopolis.obelisk.center.latitude"` (it yields `"heliopolis"`, which wouldn't match a structure ID `"heliopolis.obelisk"` even if it were marked `context: true`).

#### Finding 3.2: Self-comparison / hardcoded code output in `calendar.test.ts` and `solar.test.ts`
* **Severity:** Low
* **File and key/line:**
  1. `packages/sky/src/calendar.test.ts` (lines 118–124)
  2. `packages/sky/src/solar.test.ts` (lines 165–176)
  3. `packages/sky/src/sky.test.ts` (lines 71–74)
* **What is wrong:**
  1. In `calendar.test.ts` (lines 118–124), `deltaT(-2449)` is tested against `59047.997` to 3 decimal places and `deltaT(-10499)` against `493293.172`. Those numbers are not from a table in Stephenson, Morrison & Hohenkerk (2016); they are the exact algebraic evaluation of `-320 + 32.5 * ((year - 1825) / 100) ** 2` copied from the function's output.
  2. In `solar.test.ts` (lines 165–176), `datedSunEnvironment` is tested by checking that `env['sun.june_solstice.jd']` equals `seasonInstant(-2449, 'june-solstice')`—the exact function `datedSunEnvironment` calls on line 246 of `solar.ts`—and then checking sunrise (`4 * 60 + 48.6`) and sunset (`18 * 60 + 56.0`) against numbers copied from the code's own output.
  3. In `sky.test.ts` (lines 71–74), `skyEnvironment({ epoch: -2449, latitudeDeg: GIZA })['star.kochab.transit.altitude']` is compared to `skyEnvironment({ epoch: -2449, latitudeDeg: GIZA, stars })['star.kochab.transit.altitude']` to 12 decimal places. This only tests that omitting `stars` loads the same default array, comparing `skyEnvironment` to itself.
* **Evidence:** Compare `packages/sky/src/calendar.ts` line 127 with `calendar.test.ts` lines 119–122, and `packages/sky/src/solar.ts` line 246 with `solar.test.ts` line 168.
* **How to confirm:** Calculate `-320 + 32.5 * ((-2449 - 1825)/100)**2 = 59047.997` and `-320 + 32.5 * ((-10499 - 1825)/100)**2 = 493293.172`.

#### Finding 3.3: Overly loose tolerances in `sky.test.ts` and `interiors.test.ts` that could hide regressions
* **Severity:** Low
* **File and key/line:**
  1. `packages/sky/src/sky.test.ts` (lines 43–46, 62–69, 211–215)
  2. `packages/data/src/interiors.test.ts` (lines 68–72)
* **What is wrong:**
  1. In `sky.test.ts`, several tests use tolerances of $1^\circ$ to $1.5^\circ$ (`expect(Math.abs(transitAltitude(decDeg, GIZA) - 45)).toBeLessThan(1.5)` on line 45; `toBeLessThan(1)` on line 63; `toBeLessThan(1.5)` on line 69; `toBeCloseTo(39.6, 0)` on line 214, where precision `0` means $\pm 0.5^\circ$). Because proper motion and frame bias over 4,500 years for belt stars are on the order of arcminutes, a $1.5^\circ$ ($90'$) tolerance would not catch a broken proper motion calculation, a sign flip in declination for near-equatorial stars, or a missing frame bias. (Note: `stellarium.test.ts` *does* test these to $< 1'$, which mitigates the risk across the suite, but the assertions in `sky.test.ts` itself are too wide to catch bugs).
  2. In `packages/data/src/interiors.test.ts` (lines 68–72), the King's Chamber volume built from `kc.wall.*` is compared against `kc.length * kc.width * kc.height` with a $2\%$ tolerance (`toBeLessThan(0.02)`). The actual difference between Petrie's wall-position differences ($206.4\text{ in} \times 412.7\text{ in}$) and his mean dimensions ($206.12\text{ in} \times 412.24\text{ in}$) is $\sim 0.25\%$; a $2\%$ tolerance is 8 times wider than necessary.
* **Evidence:** `packages/sky/src/sky.test.ts` lines 45, 63, 69, 214; `packages/data/src/interiors.test.ts` line 71.
* **How to confirm:** Inspect the tolerance arguments in those lines.