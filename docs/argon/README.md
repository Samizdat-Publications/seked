# Argon's cold audits

Gemini 4 Argon (Google, on Stewart's Gemini key, so outside the Claude quota) read the whole measurement database,
the claims, the evaluating packages with their tests and the dossier (518k tokens, `build/argon/bundle.txt`), and
audited them cold. Brief: `2026-10-21-brief.md`. Its two answers are kept as it wrote them. Its findings are
leads: each is checked against the files and the cited pages before anything changes, since its own first pitch
held confident errors.

## 21 October 2026

**Independent recomputation: every figure matches the dossier exactly** (2 pi, phi and the face-area ratio; the
seked's slope; 1:43,200 polar and equatorial; the belt's angle and Menkaure's offset at 10,450 BCE; the four shafts'
epochs). An outside confirmation of the engine's arithmetic.

| # | Finding | Severity | Status |
|---|---|---|---|
| 1.1 | B2's tolerance widened to 2.5 % so both distances pass under AND; B4, a contrast, graded as one fail | high | to fix: an `any` mode for alternative comparisons |
| 1.2 | A5 circular under `canonical` (0.5236 m is pi/6 rounded); free choices undercounted | high | to fix |
| 1.3 | `canonical` pairs Lehner's base and height inconsistent with his face angle; the preset is not a free choice | medium | to weigh |
| 3.1 | "a claim never cites the scenery" tests an empty set, and its id prefix cut is wrong | medium | **confirmed** |
| 3.2 | some sky tests compare the code's output with itself | low | to weigh |
| shafts | `docs/shafts.md` says all shaft angles are unverified; three are verified | low | **confirmed** |
| 6.1 | Petrie's G2/G3 offsets used unrotated from his meridian 5' west of north | high | to check against Petrie's section 92 |
| 6.2 | the Valley Temple's east wall DFC may be an east-west wall averaged into D4 | high | to check against Nell and Ruggles 2014 |
| 6.3 | `canonical` mixes Lehner and Petrie datums in G1 and G3 interiors | medium | to check |
| 6.4 | the Queen's Chamber east-west figures disagree with its length by 24 cm | high | to check against Petrie section 64 |
| 6.5 | the water table in metres above sea level, the frame on G1's base | high | to check |
| 6.6 | shaft angles and Valley Temple pillars typed twice | medium | to check |
| 6.7 | `khafre_valley_temple.hall.socket.pitch` scaled with the wrong m/px | medium | to check the plate scale |
| 6.8 | the Sphinx's coordinates rounded to the arcsecond dominate C6 | medium | to check |
| 6.9 | flat-earth bearings over 180 km in D3, about 0.5 deg | medium | to fix: great-circle bearings |
| 6.10 | WGS84's derived radii and circumferences stored as measurements | low | **confirmed** (`method: derived`) |
