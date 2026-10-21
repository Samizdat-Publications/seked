### 4. Data

#### 4.1 Unit conversion and arithmetic errors in measurement records

* **Severity: Medium**
  * **File and key:** `data/measurements/khafre-valley-temple.json`, key `khafre_valley_temple.hall.socket.pitch`
  * **What is wrong:** The record uses the wrong scale factor for an internal plate measurement, contradicting its own note.
  * **Evidence:** The note states: "scaled off Blatt XVII with the same bar and shrinkage as `khafre_valley_temple.pillar.across`: the seven socket centres ... span 765 px in six intervals, 127.5 px each at 0.0189118 m per pixel." However, `pillar.across` (and `entrance.north.width`) explicitly state that internal lengths on Blatt XVII must use the plate's scale bar (`0.0193299` m/px), whereas `0.0189118` m/px is the OSM footprint similarity-registration scale (which shrinks the plate by 2.21% to fit the traced outline). At the scale bar's `0.0193299` m/px, `127.5` px is `2.465` m, not `2.411` m.
  * **How to confirm:** Compare the note on `khafre_valley_temple.hall.socket.pitch` with the note on `khafre_valley_temple.entrance.north.width` in the same file, and multiply `127.5 * 0.0193299`.

* **Severity: Low**
  * **File and key:** `data/measurements/g3-vyse-appendix.json`, key `g3.chamber.second.pilaster.projection`
  * **What is wrong:** The note's arithmetic disagrees with the stored value and with the Imperial figure it quotes.
  * **Evidence:** The note reads: `"Projection of pilasters, 1 ft 0 1/4 in" = 0.3175 m, against Petrie's 0.31496 m: not quite four millimetres`. `1 ft 0.25 in` is `12.25 in`. `12.25 * 0.0254 = 0.31115` m, which is the stored `value`. `0.3175` m in the note is `12.5 in` (`1 ft 0.5 in`), and the difference between `0.31115` m and `0.31496` m is `3.81` mm ("not quite four millimetres"). The `0.3175 m` in the note is a calculation error in the prose.
  * **How to confirm:** Multiply `12.25 * 0.0254` (`= 0.31115`) and `12.5 * 0.0254` (`= 0.3175`).

* **Severity: Low**
  * **File and key:** `data/measurements/g1.json`, keys `g1.base.socket.north`, `.east`, `.south`, `.west`, `.mean`
  * **What is wrong:** The inch-to-metre conversions are rounded to 3 decimal places (`0.1` mm), whereas Petrie's casing sides in the same file are stored to 4 decimal places.
  * **Evidence:** `9129.8 * 0.0254 = 231.89692` (stored `231.897`); `9130.8 * 0.0254 = 231.92232` (stored `231.922`); `9123.9 * 0.0254 = 231.74706` (stored `231.747`); `9119.2 * 0.0254 = 231.62768` (stored `231.628`); `9125.9 * 0.0254 = 231.79786` (stored `231.798`). Furthermore, the exact mean of the four inch figures is `9125.925` in (`231.798495` m).
  * **How to confirm:** Multiply Petrie's inch values in §20 by `0.0254`.

* **Severity: Low**
  * **File and key:** `data/measurements/g1-shafts.json`, keys `kc.shaft.south.width`, `kc.shaft.south.height`, `kc.shaft.north.height`, `qc.shaft.north.height`
  * **What is wrong:** Several Petrie inch conversions are rounded to 4 decimal places instead of the exact 5 or 6 decimal places (`0.0254` is exact).
  * **Evidence:** `kc.shaft.south.height`: `8.8 * 0.0254 = 0.22352` m (stored `0.2235`); `kc.shaft.north.height`: `8.73 * 0.0254 = 0.221742` m (stored `0.2218`, which corresponds to `8.732` in); `qc.shaft.north.height`: `8.6 * 0.0254 = 0.21844` m (stored `0.2184`).
  * **How to confirm:** Multiply the inch figures in the notes by `0.0254`.

#### 4.2 Disagreements with published figures and internal contradictions

* **Severity: High**
  * **File and key:** `data/measurements/temples.json`, key `khafre_valley_temple.wall.east.dfc` (and `.wall.east.foundation.dfc`), and `data/claims/D4.yaml`
  * **What is wrong:** A north-south wall's azimuth is recorded in the note as `89°37.0′` (an east-west azimuth), and its deviation from cardinality (DFC) is averaged with the west wall's DFC in claim D4 as if both were deviations from the meridian.
  * **Evidence:** In `data/measurements/temples.json`, `sphinx_temple.wall.east.dfc` has note: "the main wall on the east side of the Sphinx temple ... at azimuth 359°58.8′", which is a north-south wall (`0° - 0°01.2′`). Similarly, `khafre_valley_temple.wall.west.dfc` (`+0.55°`) has note: "the main wall on the west side ... at azimuth 0°33′", and `wall.west.outer.dfc` (`-0.483333°`) has "at azimuth 359°31′". Both are north-south walls. Yet `khafre_valley_temple.wall.east.dfc` (`-0.383333°`) has note: "the main wall on the east side of Khafre's valley temple ... at azimuth 89°37.0′", and `wall.east.foundation.dfc` (`-0.2°`) has "at azimuth 89°48′". An east wall of a roughly square temple runs north-south (azimuth near `0°`/`180°`), not `90°`. Either the note transcribed `89°37.0′` where Nell & Ruggles Table 4a has `359°37.0′` (or `179°37.0′`), or the feature in Table 4a is an east-west wall (such as an entrance passage wall on the east side) whose DFC is relative to `90°`, in which case averaging it with the west wall (`0°33′`) in `D4.yaml` (`(khafre_valley_temple.wall.east.dfc + khafre_valley_temple.wall.west.dfc) / 2`) averages a deviation from east with a deviation from north.
  * **How to confirm:** Check Nell & Ruggles (2014), Table 4a and Table 4b, for the azimuth and cardinal reference direction of the east wall of Khafre's Valley Temple.

* **Severity: High**
  * **File and key:** `data/measurements/g1.json` (`kc.wall.east.from_axis` vs `kc.wall.east.east`), `data/measurements/g1-interior.json` (`qc.corner.ne.east`, `qc.roof.mid_west.east`), and `data/measurements/g1-shafts.json` (`kc.shaft.south.inlet.from_east_wall`)
  * **What is wrong:** Petrie's east coordinates for the Queen's Chamber (`+308` in and `+72` in) in `g1-interior.json` are incompatible with the passage axis (`+287` in), with the chamber's own length (`226.47` in), and with Gantenbrink's `7.84` m east wall offset.
  * **Evidence:** As the note on `qc.corner.ne.east` (`7.8232` m = `308` in) admits, `308 - 72 = 236` in (`5.994` m), which contradicts `qc.length` (`226.47` in = `5.7523` m) by `9.53` in (`24.2` cm). More importantly, the passage into the Queen's Chamber runs at `east = 286.6` to `287.0` in (`7.28` to `7.29` m), and in the actual pyramid the passage enters near the east wall of the Queen's Chamber. Putting `qc.corner.ne.east` at `308` in (`7.8232` m, almost flush with the King's Chamber's east wall at `305.0` in = `7.747` m) shifts the entire Queen's Chamber east by roughly half a metre relative to its passage, which also shifts the Queen's Chamber shaft inlets (`qc.shaft.north.inlet` and `qc.shaft.south.inlet`, which reference `qc.corner.ne.east` in `packages/geometry/src/interiors.ts` line 258). Meanwhile, Gantenbrink (`kc.wall.east.from_axis` = `7.84` m) states "The distance between the central North-South axis and the eastern Chamber walls is 7.84 m" for both chambers.
  * **How to confirm:** Check Petrie (1883) §40, §41, and §64 against Maragioglio & Rinaldi Parte IV Tav. 3 and Tav. 6 for the east-west offset of the Queen's Chamber east wall from the passage axis and from the King's Chamber east wall.

* **Severity: Medium**
  * **File and key:** `data/measurements/g1-interior.json` (`kc.floor.elevation` = `42.99077` m) vs `data/measurements/g1.json` (`kc.floor.elevation` = `42.9` m)
  * **What is wrong:** Because `canonical` ranks `lehner-1997` ahead of `petrie-1883`, `kc.floor.elevation` resolves to Lehner's rounded `42.9` m while `kc.ceiling.up` resolves to Petrie's `48.83531` m. This makes the built King's Chamber `9.1` cm taller than Petrie's measured height and corrupts the solving of the five relieving chambers above it.
  * **Evidence:** In `packages/geometry/src/interiors.ts` (lines 207-214 and 390-416), the King's Chamber solid and the `constructionStack` solver both use `kc.floor.elevation` and `kc.ceiling.up`. Under `canonical`, `kc.ceiling.up - kc.floor.elevation = 48.83531 - 42.9 = 5.93531` m, whereas `kc.height` (Petrie) is `5.8443` m (`48.83531 - 42.99077 = 5.84454` m). In `packages/data/src/interiors.test.ts` (line 75), the test had to widen its tolerance to `2%` (`expect(Math.abs(got - want) / want).toBeLessThan(0.02)`) specifically because `5.93531 / 5.8443 = 1.0156` (+1.56% error). Worse, `constructionStack` subtracts `(kcCeiling - kcFloor)` from Vyse's total stack height (`21.1074` m), stealing `9.1` cm from the five granite floor slabs (`1.8` cm per slab).
  * **How to confirm:** Evaluate `env['kc.ceiling.up'] - env['kc.floor.elevation']` under the `canonical` preset and compare with `env['kc.height']`.

* **Severity: Medium**
  * **File and key:** `data/measurements/g1.json` (`gg.length` = `46.7` m from `lehner-1997`) vs `data/measurements/g1-interior.json` (`gg.length` = `47.84344` m from `petrie-1883`)
  * **What is wrong:** The two sources are measuring different geometrical lines under the same key (`46.7` m vs `47.84` m, a `1.14` m discrepancy).
  * **Evidence:** Petrie's `1883.6` in (`47.84344` m, §45) is the sloping length from the north wall to the south wall along the floor line produced through the Great Step (`1688.9` in horizontal). In §46 Petrie gives the sloping roof length as `1838.6` in (`46.699` m), which is what Lehner's `46.7` m tabulates. Recording both under `gg.length` conflates floor length with roof length.
  * **How to confirm:** Check Petrie (1883) §45 (`1883.6` in floor) and §46 (`1838.6` in = `46.70` m roof).

* **Severity: Medium**
  * **File and key:** `data/measurements/g2-g3-sphinx.json`, key `g3.face.angle` (`petrie-1883`: `51°` vs `lehner-1997`: `51.3403°` = `51°20′25″`) and `g3.base.side.mean` (`petrie-1883`: `105.50144` m vs `lehner-1997`: `103.4` m)
  * **What is wrong:** In `canonical`, Lehner's `103.4` m base is combined with Petrie's `52.80406` m entrance offset from the east side (`g3.entrance.floor.begin.from_east_side`), shifting Menkaure's entire interior system `1.10` m west of the pyramid's centre line.
  * **Evidence:** Petrie (`g3-interior.json`) measured the entrance at `2078.9` in (`52.80406` m) from the east side of his `4153.6` in (`105.50144` m) base, which puts the entrance `0.05` m west of the centre line (`105.50144 / 2 - 52.80406 = -0.053` m). Under `canonical`, `g3.base.side.mean` resolves to Lehner's `103.4` m (`half = 51.7` m), so `coordinate()` in `packages/geometry/src/interiors.ts` (line 554) computes `east = 51.7 - 52.80406 = -1.10406` m. Every passage and chamber in G3 is routed from this entrance and is therefore displaced `1.1` m west in the canonical model.
  * **How to confirm:** Check `packages/data/src/interiors.test.ts` line 183 (`expect(bx).toBeCloseTo(half - env['g3.entrance.floor.begin.from_east_side'], 9)`), which evaluates to `-1.104` m under `canonical`.

* **Severity: Low**
  * **File and key:** `data/measurements/units-and-constants.json`, key `earth.circumference.meridional` (`40007862.917` m) and `earth.radius.polar` (`6356752.314` m)
  * **What is wrong:** Both are stored with `source: "wgs84"`, `method: "derived"` (or `"defined"`), violating the project's "no derived quantities in `data/`" rule, and `earth.radius.polar` is derived in WGS84 (from `a` and `1/f`), not defined.
  * **Evidence:** In NIMA TR8350.2 (`data/sources.json` id `wgs84`), the defining parameters are `a = 6378137` m and `1/f = 298.257223563`. The polar semi-axis `b = a(1 - f) = 6356752.314245` m, `earth.radius.mean = (2a + b)/3`, `earth.circumference.equatorial = 2 * pi * a`, and `earth.circumference.meridional` are all derived from `a` and `f` (whereas for Helmert 1906 in the same file, `a` and `inverse_flattening` are stored and `f` is computed in code).
  * **How to confirm:** Inspect `data/measurements/units-and-constants.json` lines 5-9 and `packages/geometry/src/datum.ts` lines 107-111 (which reverse-engineers `f = 1 - b / a` from the stored `b`).

#### 4.3 Duplicated quantities across keys and files

* **Severity: Medium**
  * **File and key:** `data/measurements/g1.json` vs `data/measurements/g1-shafts.json`
  * **What is wrong:** Four shaft angles are stored twice in the database under different keys and with different source years (`gantenbrink-1993` vs `gantenbrink-1999`), violating the "nothing typed twice" rule.
  * **Evidence:**
    1. `kc.shaft.south.angle` (`45.0°`, `sigma: 0.05`, `gantenbrink-1993` in `g1.json`) duplicates `kc.shaft.south.segment.4.angle` (`45.0°`, `sigma: 0.05`, `gantenbrink-1999` in `g1-shafts.json`).
    2. `kc.shaft.north.angle` (`32.6°`, `sigma: 0.1`, `gantenbrink-1993` in `g1.json`) duplicates `kc.shaft.north.segment.3.angle` (`32.6°`, `sigma: 0.1`, `gantenbrink-1999` in `g1-shafts.json`).
    3. `qc.shaft.south.angle` (`39.6078°`, `sigma: 0.05`, `gantenbrink-1993` in `g1.json`) duplicates `qc.shaft.south.segment.2.angle` (`39.6078°`, `sigma: 0.05`, `gantenbrink-1999` in `g1-shafts.json`).
    4. `qc.shaft.north.angle` (`39.1167°`, `sigma: 3.4`, `gantenbrink-1993` in `g1.json`) duplicates `qc.shaft.north.segment.2.angle` (`39.1167°`, `sigma: 3.0`, `gantenbrink-1993` in `g1-shafts.json`), and `.segment.3.angle` and `.segment.4.angle` repeat `39.1167°` again.
  * **How to confirm:** Compare `data/measurements/g1.json` lines 390-452 with `data/measurements/g1-shafts.json` lines 129, 250, 342, 412, 436, 460.

* **Severity: Medium**
  * **File and key:** `data/measurements/giza-temples.json` (`khafre.valley.*`) vs `data/measurements/khafre-valley-temple.json` (`khafre_valley_temple.*`)
  * **What is wrong:** The same physical dimensions of Khafre's Valley Temple (pillar side, pillar pitch/span) are entered under two incompatible key prefixes (`khafre.valley.*` from Petrie Pl. VI and §96, and `khafre_valley_temple.*` scaled from Hölscher Blatt XVII), so presets cannot resolve between them.
  * **Evidence:**
    1. `khafre.valley.pillar.side` (`1.0414` m = `41` in, `petrie-1883`, verified) vs `khafre_valley_temple.pillar.across` (`1.01` m ± `0.19` m, `hoelscher-1912`, unverified, scaled from plate).
    2. `khafre.valley.span.double` (`3.2512` m = `128` in, `petrie-1883`, verified) vs `khafre_valley_temple.pillar.pitch.east` (`3.233` m ± `0.2` m, `hoelscher-1912`, unverified, scaled from plate).
    3. `khafre.valley.span.single` (`3.683` m = `145` in, `petrie-1883`, verified) vs `khafre_valley_temple.pillar.pitch.north` (`3.663` m ± `0.2` m, `hoelscher-1912`, unverified, scaled from plate).
    Because `packages/geometry/src/temple.ts` (line 260) looks up `khafre_valley_temple.*`, it ignores Petrie's verified direct measurements in `giza-temples.json` and builds the temple from the unverified pixel-scaled values in `khafre-valley-temple.json`.
  * **How to confirm:** Compare `data/measurements/giza-temples.json` lines 228-297 with `data/measurements/khafre-valley-temple.json` lines 24-75 and `packages/geometry/src/temple.ts` lines 259-275.

* **Severity: Low**
  * **File and key:** `data/measurements/g3-interior.json` (`g3.passage.granite.floor.begin.from_east_wall`) vs `data/measurements/g3-vyse-appendix.json` (`g3.passage.granite.entrance.from_east_wall`)
  * **What is wrong:** The same dimension (distance from the east wall of the large apartment to the entrance of the descending passage to the granite sepulchral chamber) is stored under two different keys, so presets cannot choose between Vyse (`5.1816` m), Petrie (`5.16128` m), and Maragioglio & Rinaldi (`5.18` m).
  * **Evidence:** `g3-interior.json` has `g3.passage.granite.floor.begin.from_east_wall` for both `petrie-1883` (`5.16128` m) and `maragioglio-rinaldi-1967` (`5.18` m). `g3-vyse-appendix.json` enters Vyse's `17 ft 0 in` (`5.1816` m) as `g3.passage.granite.entrance.from_east_wall`, which `interiors.ts` never reads.
  * **How to confirm:** Search `packages/geometry/src/interiors.ts` for `from_east_wall`; only `floor.begin.from_east_wall` is read (line 759).

* **Severity: Low**
  * **File and key:** `data/measurements/g1-interior.json` (`gg.floor.width` = `1.04394` m and `gg.roof.width` = `1.04394` m)
  * **What is wrong:** Both keys store the exact same measurement (`40.9` in at N. and `41.3` in at S., mean `41.1` in) from Petrie §46.
  * **Evidence:** The notes on both keys state that Petrie measured `40.9` at N. and `41.3` at S. for the top of the gallery, and stated in prose that the floor width between the ramps equals the top width.

* **Severity: Low**
  * **File and key:** `data/measurements/g3-vyse-appendix.json` (`g3.chamber.second.west_end.height` = `4.064` m and `g3.chamber.second.west_space.present.height.max` = `4.064` m)
  * **What is wrong:** Both keys record the same `13 ft 4 in` figure from Vyse's table, as the note on `.max` admits ("this is the greater, and it is the height at the west end over again").

#### 4.4 Sources cited that do not contain the record as attributed

* **Severity: Low**
  * **File and key:** `data/measurements/g1.json` and `data/measurements/g1-shafts.json`, key `qc.shaft.north.angle` (and `.segment.2.angle`)
  * **What is wrong:** Attributed to `gantenbrink-1993` with value `39.1167°` (`39°07′`), which Gantenbrink's report does not contain.
  * **Evidence:** The note on `qc.shaft.north.angle` explicitly states that the Upuaut report does not print `39°07′` (it prints `33.3°` to `40.1°`), and that `39°07′` comes from Bauval's statement of claim C2 (`bauval-gilbert-1994`). It is appropriately marked `verified: false`, but the `source` field names `gantenbrink-1993`.

---

### 5. Frames and Datums

#### 5.1 Unrotated Petrie inter-pyramid offsets mixed with true-north frame

* **Severity: High**
  * **File and key:** `data/measurements/g2-g3-sphinx.json`, keys `g2.centre.offset.south` (`353.86` m), `g2.centre.offset.west` (`334.41` m), `g3.centre.offset.south` (`739.19` m), `g3.centre.offset.west` (`574.45` m); used in `data/claims/C4.yaml`, `C6.yaml`, `C7.yaml`, `D1.yaml`, `D2.yaml`, and `packages/geometry/src/pyramidion.ts` (`structurePlacement`).
  * **What is wrong:** Petrie's triangulation table (§92) is in a frame rotated `−5′` (west of true north), whereas the project frame is true-north ENU (`data/sites.json`). The offsets are stored unrotated and used directly as true-north coordinates without a rotation transform.
  * **Evidence:** The notes on all four keys state: "His parallels are inclined −5′ to true north, the mean azimuth of the First and Second Pyramids, whereas this repo's frame is east-north-up on true north; at this distance 5′ is a cross-track shift of 1.08 m [for G3 south] / 0.84 m [for G3 west]. Petrie's figure is kept unrotated, and he states no error for these distances, so sigma is that shift rounded up."
  Because a rotation of axes by `θ = -5′` (`-0.0014544` rad) transforms `(W_petrie, S_petrie)` into true-north `(W_true, S_true)`:
  * `W_true = W_petrie * cos(5′) - S_petrie * sin(5′)`
  * `S_true = S_petrie * cos(5′) + W_petrie * sin(5′)`
  For G3 (`W_petrie = 574.45` m, `S_petrie = 739.19` m):
  * `W_true = 574.45 - 739.19 * 0.0014544 = 573.375` m (`1.075` m less west)
  * `S_true = 739.19 + 574.45 * 0.0014544 = 740.025` m (`0.835` m more south)
  Leaving the rotation unapplied introduces a systematic `5′` (`0.0833°`) bias into the G1-G3 diagonal angle in C4 and C7 (`37°51′07″` unrotated vs `37°46′07″` on true north) and into the SE corner diagonal bearing in D1 (`43°21′05″` unrotated vs `43°16′05″` on true north), and shifts G3's extents in D2 (`Legon's rectangle`, where `1.08` m is `2.05` cubits, or `0.15%` of the `1414.2`-cubit target, exceeding the `0.11%` residual reported in the dossier). Inflating `sigma` does not fix the evaluations, because `evaluateClaim` does not use `sigma`.
  * **How to confirm:** Read the notes on `g2.centre.offset.*` and `g3.centre.offset.*` in `data/measurements/g2-g3-sphinx.json` and check `packages/geometry/src/environment.ts` and `data/claims/D1.yaml`, `D2.yaml`, `C4.yaml` to see that no `5′` rotation is applied.

#### 5.2 Vertical datum mixing: Orthometric (EGM2008 MSL) vs LocalG1 Base Datum

* **Severity: High**
  * **File and key:** `data/sites.json` (`giza.origin.elevation: 60`), `packages/data/src/terrain.test.ts`, `data/measurements/groundwater.json` (`giza.watertable.elevation: 15.0`), `data/measurements/g2-g3-sphinx.json` (`g2.base.elevation.relative: 10.0`), and `data/footprints/giza.json` (`base` values).
  * **What is wrong:** At least three incompatible vertical datums are mixed across the Giza site model:
    1. **True G1 base pavement elevation (~60 m AMSL):** `data/sites.json` sets `origin.elevation = 60` with note "Elevation is approximate."
    2. **Unedited Copernicus GLO-30 DEM surface at G1 (~94 m EGM2008):** Because GLO-30 is a surface model that includes the smoothed mound of the Great Pyramid (`data/sources.json` id `copernicus-glo30` note: "the Great Pyramid comes through as a mound peaking near 94 m"), any script that subtracts `terrain.sample(0, 0)` (or uses the DEM surface at the origin as datum) sets `Z = 0` near `94` m AMSL instead of `60` m AMSL.
    3. **Orthometric height above mean sea level (+15 m AMSL):** `giza.watertable.elevation` (`data/measurements/groundwater.json`) is stored as `15.0` m with note "Above mean sea level", whereas the Giza project frame (`data/sites.json`) has `+Z` relative to the Great Pyramid's base centre (`~60` m AMSL), in which the water table is at `Z ≈ -45` m, not `+15` m.
  * **Evidence:**
    * In `packages/data/src/footprints.test.ts` (line 53), `sphinx.body` has `base < -30` (specifically `-38.65` m in `trench.test.ts` line 14, and `khafre.valley_temple` has `base = -42.18` m in `water.test.ts` line 18). In reality, the Sphinx enclosure floor and Khafre's Valley Temple floor are at `~20` m AMSL (`data/sources.json` id `ysi-2009-sphinx` note: "printed elevations 20.492, 20.480, 20.505, 20.193"), which is `~40` m below G1's base (`60 - 20 = 40` m). However, `khafre_valley_temple.hall.floor.below_g2_base` (`data/measurements/khafre-valley-temple.json`) is `52.67` m below G2's base (`+10` m relative to G1), which puts the Valley Temple floor at `10 - 52.67 = -42.67` m relative to G1 (`~17.3` m AMSL).
    * Meanwhile, `giza.watertable.elevation` is stored as `+15.0` m (`quantity: "elevation"`) without subtracting the site origin elevation (`60` m), while `g2.base.elevation.relative` is stored as `+10.0` m (`quantity: "elevation"`) relative to G1's base. Two records in the same site (`giza`) with `quantity: "elevation"` use datums `60` m apart.
  * **How to confirm:** Compare `data/measurements/groundwater.json` (`value: 15.0`, "Above mean sea level") with `data/measurements/g2-g3-sphinx.json` (`g2.base.elevation.relative`, `value: 10.0`, "higher than Khufu's") and `data/sites.json` (`elevation: 60`).

#### 5.3 Interior coordinates not rotated by pyramid orientation when placed in the site frame

* **Severity: Medium**
  * **File and key:** `data/measurements/g1-interior.json`, `data/measurements/g2-interior.json`, `data/measurements/g3-interior.json`, and `packages/geometry/src/interiors.ts`
  * **What is wrong:** Petrie's interior coordinates for G1 (§64) are measured relative to the pyramid's own base sides and mid-planes (which are oriented at `g1.orientation` = `-3′43″` to `-3′54″` west of true north), while at the same time `passage.descending` and `passage.ascending` East offsets in §36 and §37 include azimuth terms. Similarly, in `g3-interior.json`, `g3.passage.descending.orientation` (`+13′16″` east of north) is recorded, but `packages/geometry/src/interiors.ts` (`DUE_SOUTH = 180`, line 535) routes G3's descending passage and upper chambers strictly along `180°` in the structure's frame.
  * **Evidence:** In `packages/geometry/src/interiors.ts` (line 13), the comment states: "The frame is the structure's own frame ... Placing an interior beside its pyramid is the caller's job and uses the same centre offsets, base elevation and orientation the pyramid object uses." For G3, `g3.orientation` is `+0.234167°` (`+14′03″`, Petrie §80), which is only in `petrie-1883` and not in `lehner-1997`, so under `canonical` `g3.orientation` resolves to `0.234167°`, whereas for G2 `g2.orientation` resolves to `-0.090556°` (`-5′26″`). Inside `interiors.ts`, however, `g3.chamber.loculus.direction` (`25°`, `g3-vyse-appendix.json`) is given by Vyse as "25° east of north" (true or magnetic north, not relative to G3's `+14′` casing), and is applied in `interiors.ts` inside G3's local frame.
  * **How to confirm:** Check `packages/geometry/src/interiors.ts` lines 13-17 and 806-835, and `data/measurements/g3-interior.json` key `g3.passage.descending.orientation`.

#### 5.4 Flat-Earth equirectangular projection over 180 km in Claim D3

* **Severity: Medium**
  * **File and key:** `packages/geometry/src/environment.ts` (`deriveCentreOffsets`, lines 34-49) and `data/claims/D3.yaml`
  * **What is wrong:** `deriveCentreOffsets` projects geodetic `(lat, lon)` to `(east, north)` using a spherical equirectangular approximation with `cos(lat0)` evaluated at Giza (`29.979°` N) and the mean spherical radius `earth.radius.mean`. In `D3.yaml`, `atan2(east, north)` is then used to compute bearings over `180` km to Alexandria (`31.2°` N) and Port Said (`31.25°` N).
  * **Evidence:** Over `1.27°` of latitude and `1.2°` of longitude, the equirectangular chord bearing differs from the true geodesic initial azimuth by `0.48°` (`29′`), and the ellipsoidal transverse vs meridional radius of curvature adds another `~0.14°` (`8′`). While the note on `D3.yaml` candidly documents the `0.48°` spherical-vs-flat error, the value printed in `docs/dossier.md` (`38°28′19″` and `40°49′16″`, to the arcsecond) is the flat-Earth approximation, not the true geodesic bearing.
  * **How to confirm:** Compare `atan2(delta.east.centre.offset.east, delta.east.centre.offset.north)` (`38.472°`) with the spherical great-circle initial bearing `atan2(sin(dLon)*cos(lat2), cos(lat1)*sin(lat2) - sin(lat1)*cos(lat2)*cos(dLon))` (`37.991°`).

#### 5.5 Horizontal datum ambiguity in placeholder coordinates

* **Severity: Low**
  * **File and key:** `data/measurements/g1.json` (`g1.center.latitude`, `g1.center.longitude`), `data/measurements/g2-g3-sphinx.json` (`sphinx.center.*`), `data/measurements/site-landmarks.json` (`heliopolis.obelisk.center.*`), `data/measurements/delta.json` (`delta.*`)
  * **What is wrong:** All geodetic coordinates in the database are unverified "commonly cited" values whose actual underlying datum (WGS84 vs Old Egyptian 1907 vs Google Earth imagery) is unknown, as their notes acknowledge. In particular, `sphinx.center.latitude` (`29°58′31″` N) and `longitude` (`31°08′16″` E) are rounded to the nearest arcsecond (`~30` m resolution), which introduces a `~3.5°` quantization uncertainty into the bearing from the Sphinx to the G1-G2 gap in claim C6 (`distance ≈ 450` m).
  * **How to confirm:** Change `sphinx.center.latitude` or `longitude` by `0.5″` (`0.00014°`, half the rounding unit of the cited DMS coordinate) and observe a `~1.5°` shift in C6's target bearing.

---

### 6. The Ten Most Important Problems Overall, Ranked

1. **Unrotated Petrie triangulation frame in G2 and G3 centre offsets (High)**
   * **Where:** `data/measurements/g2-g3-sphinx.json` (`g2.centre.offset.*`, `g3.centre.offset.*`) and `packages/geometry/src/environment.ts`.
   * **Problem:** Petrie's §92 offsets are referenced to a meridian inclined `5′` west of true north, but are used unrotated in the true-north ENU frame across claims C4, C6, C7, D1, and D2. This shifts G3 by `1.08` m east and `0.84` m south of its true-north position and biases the inter-pyramid bearings by `5′`.
   * **Fix:** Store Petrie's raw distances along his survey axes and his stated axis azimuth (`-5′`) as measurements, and apply the `5′` rotation in `buildEnvironment` (`packages/geometry/src/environment.ts`) to derive the true-north `.centre.offset.west` and `.south` keys.

2. **Possible 90° azimuth reference error in Khafre's Valley Temple east wall DFC (High)**
   * **Where:** `data/measurements/temples.json` (`khafre_valley_temple.wall.east.dfc` and `.foundation.dfc`) and `data/claims/D4.yaml`.
   * **Problem:** The note records the east wall's azimuth as `89°37.0′` (an east-west line) with DFC `-0°23.0′`, whereas the west wall is at `0°33′` (a north-south line) with DFC `+0°33′`. Claim D4 averages the two as if both measured the temple's north-south axis.
   * **Fix:** Re-check Nell & Ruggles (2014) Table 4a/4b. If the east wall azimuth is `359°37.0′` (or `179°37.0′`), fix the note. If the surveyed feature is tatsächlich an east-west wall (`89°37.0′`), do not average it with the north-south west wall in `D4.yaml`.

3. **Preset mixing of Lehner and Petrie corrupts G1 King's Chamber height and G3 entrance axis (Medium)**
   * **Where:** `data/presets.json` (`canonical`), `data/measurements/g1.json` (`kc.floor.elevation`, `gg.length`), `data/measurements/g2-g3-sphinx.json` (`g3.base.side.mean`), and `packages/geometry/src/interiors.ts`.
   * **Problem:** Because `canonical` ranks `lehner-1997` above `petrie-1883`, `kc.floor.elevation` resolves to Lehner's rounded `42.9` m while `kc.ceiling.up` comes from Petrie (`48.83531` m), inflating the King's Chamber height by `9.1` cm and shrinking the five relieving chamber floor slabs above it. In G3, Lehner's `103.4` m mean base is paired with Petrie's `52.80406` m entrance offset (measured from Petrie's `105.50` m base), shifting the entire G3 interior `1.10` m west of centre. In G1, `gg.length` conflates Lehner's `46.7` m roof length with Petrie's `47.84` m floor length.
   * **Fix:** Separate `gg.roof.length` from `gg.floor.length`; in `interiors.ts`, compute `kc` vertical extent from `kc.floor.elevation` and `kc.height` (or keep interior elevation keys on a single survey's datum); and for G3's entrance, store Petrie's explicit statement that the entrance is on the north-south centre line (`east = 0`) rather than subtracting his east-side distance from a different survey's half-base.

4. **Queen's Chamber east-west coordinates in `g1-interior.json` contradict passage axis and chamber length (High)**
   * **Where:** `data/measurements/g1-interior.json` (`qc.corner.ne.east` = `7.8232` m, `qc.roof.mid_west.east` = `1.8288` m).
   * **Problem:** Petrie's §64 summary figures (`308` in and `72` in) differ by `236` in (`5.994` m) instead of his measured chamber length `226.47` in (`5.752` m), and place the Queen's Chamber east wall `53` cm east of the passage centre line (`287` in = `7.29` m), shifting the Queen's Chamber and its two star-shaft inlets half a metre east.
   * **Fix:** Check Maragioglio & Rinaldi Parte IV Tav. 3 and Tav. 6 (where the passage enters flush with the east wall of the Queen's Chamber, putting the east wall at `287 + 20.8 = 307.8` in only if the passage's *west* wall or centre is referenced, or check whether `308` in is the east wall and `72` in is a misprint in Petrie §64 for `308 - 226.5 = 81.5` in) and add the M&R measurement record.

5. **Vertical datum mismatch between `giza.watertable.elevation` (+15 m AMSL) and the Giza ENU frame (Z = 0 at G1 base ~60 m AMSL) (High)**
   * **Where:** `data/measurements/groundwater.json` (`giza.watertable.elevation`) and `data/sites.json`.
   * **Problem:** `giza.watertable.elevation` is `+15.0` m above mean sea level, while every other Giza elevation is relative to G1's base (`~60` m AMSL) or the GLO-30 surface at G1 (`~94` m AMSL).
   * **Fix:** Either store orthometric sea-level elevations with a distinct quantity/datum field (e.g. `elevation_amsl`) and store G1's surveyed base elevation above sea level (Lehner & Hawass 2017 give `~60` m AMSL) so the frame transform is explicit, or reference all Giza elevations to the G1 base datum.

6. **Duplicated shaft angle records and Khafre Valley Temple records across files and key namespaces (Medium)**
   * **Where:** `data/measurements/g1.json` vs `data/measurements/g1-shafts.json`, and `data/measurements/giza-temples.json` vs `data/measurements/khafre-valley-temple.json`.
   * **Problem:** The four G1 shaft angles are typed in twice under different keys and source IDs (`gantenbrink-1993` vs `gantenbrink-1999`), and Khafre's Valley Temple pillar dimensions are typed in under both `khafre.valley.*` (Petrie, verified) and `khafre_valley_temple.*` (Hölscher, unverified plate scaling), with `temple.ts` hardcoding the unverified `khafre_valley_temple.*` prefix.
   * **Fix:** Unify the Khafre Valley Temple keys under `khafre_valley_temple.*` so presets resolve Petrie vs Hölscher normally, and derive or alias the top-level `<chamber>.shaft.<side>.angle` in `buildEnvironment` from the final segment's angle in `g1-shafts.json` (or vice versa) so each angle exists once in `data/measurements/`.

7. **Wrong scale factor (`0.0189118` vs `0.0193299` m/px) in `khafre_valley_temple.hall.socket.pitch` (Medium)**
   * **Where:** `data/measurements/khafre-valley-temple.json`, key `khafre_valley_temple.hall.socket.pitch`.
   * **Problem:** The record multiplies `127.5` px by the OSM footprint registration scale (`0.0189118` m/px) instead of the plate's own scale bar (`0.0193299` m/px) that its note claims to use, understating the pitch by `5.4` cm (`2.411` m vs `2.465` m).
   * **Fix:** Recompute `127.5 * 0.0193299 = 2.465` m and update `value` and `note`.

8. **Sphinx placeholder coordinate rounding (`1″` = `30` m) dominates Claim C6's target bearing (Medium)**
   * **Where:** `data/measurements/g2-g3-sphinx.json` (`sphinx.center.latitude`, `sphinx.center.longitude`) and `data/claims/C6.yaml`.
   * **Problem:** C6 computes the bearing from the Sphinx to the G1-G2 gap (`~450` m away) using gazetteer coordinates rounded to the arcsecond (`±15` m in each axis, `sigma: 0.0005°` ≈ `55` m) instead of the registered OSM footprint centroid or a GPMP survey tie.
   * **Fix:** Derive the Sphinx's East and North offsets from the GPMP/ARCE survey grid (or from the registered `sphinx.body` footprint in `data/footprints/giza.json`, which is already tied to Petrie's G1-G2-G3 frame to within `1.5` m) and replace `coords-sphinx-cited`.

9. **Equirectangular bearing distortion in Claim D3 (`0.48°` error over `180` km) (Medium)**
   * **Where:** `packages/geometry/src/environment.ts` (`deriveCentreOffsets`) and `data/claims/D3.yaml`.
   * **Problem:** Using flat-Earth `(dlon * cos(lat0), dlat)` offsets to compute bearings to Alexandria and Port Said introduces a `0.48°` (`29′`) projection error into the numbers printed in `docs/dossier.md`.
   * **Fix:** Either compute geodesic/great-circle bearings for distant landmarks or add a spherical/ellipsoidal bearing function to `packages/claims/src/expr.ts` (or `deriveCentreOffsets`) when the distance exceeds a few kilometres.

10. **Derived WGS84 constants stored in `data/measurements/units-and-constants.json` (Low)**
    * **Where:** `data/measurements/units-and-constants.json` (`earth.radius.polar`, `earth.radius.mean`, `earth.circumference.equatorial`, `earth.circumference.meridional`).
    * **Problem:** Storing derived ellipsoid quantities alongside `earth.radius.equatorial` violates the rule that `data/measurements/` holds only primary inputs and never derived values, and hides the defining WGS84 inverse flattening `1/f = 298.257223563`.
    * **Fix:** Store `earth.radius.equatorial` (`6378137` m) and `earth.inverse_flattening` (`298.257223563`) in `units-and-constants.json` (matching how Helmert 1906 is stored in the same file) and compute `earth.radius.polar`, `earth.radius.mean`, `earth.circumference.equatorial`, and `earth.circumference.meridional` in `buildEnvironment` (`packages/geometry/src/environment.ts`).