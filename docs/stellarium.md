# The Stellarium check

`packages/sky` computes where a star stood over Giza in the third millennium
BCE. The rest of its tests check it against itself and against the reference
numbers ERFA publishes for the Vondrák matrices, which settles whether the
coefficient tables were typed in correctly and nothing more. This is the check
against a second program: Stellarium 26.2, which reads the same paper,
Vondrák, Capitaine and Wallace (2011), A&A 534, A22, and shares no line of code
with this one.

The plan's Phase 3 is finished when Alnitak's transit altitude matches
Stellarium at 2500 BCE and 10,500 BCE to within an arcminute. It does, by a
factor of five: 10.7 arcseconds at the first and 12.3 at the second. Three
other things came out of the comparison and are set down here because they are
the sort of thing a project like this exists to be honest about. The two
programs' right ascensions part company by an arcminute and a half at 10,500
BCE. The two star catalogues do not carry the same proper motions. And for
Sirius that second disagreement is enormous: twelve arcminutes of declination
in the third millennium BCE and forty at 10,500 BCE.

## How the run was made

`scripts/stellarium/transit.ssc` is a Stellarium script and
`scripts/stellarium/run.ts` drives it:

```
npx tsx scripts/stellarium/run.ts
```

`STELLARIUM_EXE` and `STELLARIUM_USER_DIR` override where it looks for the
program and its user directory. On the machine this was run on, Stellarium 26.2
had been installed per user, at
`%LOCALAPPDATA%\Programs\Stellarium\stellarium.exe`. The runner composes a
generated header of inputs with the script, writes the two into Stellarium's
own scripts directory, launches Stellarium with `--startup-script`, reads back
the one line of JSON the script wrote, and adds the provenance. It kills the
process if the run has not finished in five minutes, and the script ends in
`core.quitStellarium()`, so no run leaves a window open.

Nothing is typed twice anywhere along that path. The observer is
`g1.center.latitude` and `g1.center.longitude` under the `canonical` preset and
`giza.origin.elevation` from `data/sites.json`. The Julian Days are
`julianEpochToJd` from `packages/sky/src/calendar.ts`. The stars are named to
Stellarium by the Hipparcos numbers in `data/stars/hyg-bright.json`, which are
the rows the package itself precesses, so both programs are certainly talking
about the same objects. The version string is read out of the header of the log
Stellarium wrote on the run. The only numbers in `data/validation/stellarium.json`
that Stellarium did not produce are the ones that say how it was asked, and
`packages/sky/src/stellarium.test.ts` checks those against the database rather
than trusting them.

Stellarium was asked for the mean place, to match a package that computes mean
places, by switching off nutation (`StelCore.flagUseNutation`), annual
aberration (`flagUseAberration`), diurnal parallax
(`flagUseTopocentricCoordinates`) and the atmosphere, and by reading
`altitude-geometric` rather than `altitude`. The recorded file carries all four
flags as Stellarium reported them back. Left on, nutation would have been worth
about 9 arcseconds and aberration about 20, which at the size of the real
differences below would have been noise in the way.

The transit altitude was not taken from 90 degrees less the distance from the
declination to the latitude. The script steps the clock until the star's hour
angle is under a hundred-thousandth of a degree and reads the geometric
altitude there. It then agrees with that formula, evaluated on Stellarium's own
declination, to under a thousandth of an arcsecond at every star and epoch,
which is the last test in the file. The agreement is worth having: it means the
recorded altitudes test the whole horizon path and not a formula this package
would otherwise have supplied to both sides of its own comparison.

### Two things that will bite the next person to run it

The Stellarium scripting API reports values that are recomputed once per drawn
frame. A `getObjectInfo` issued immediately after a `setJDay` answers with the
previous date's precession matrix and the previous date's horizon, silently and
to full precision. The first working version of this script had Alnitak at
10,500 BCE within seven arcseconds of its place at 2450 BCE, which is what a
stale precession matrix and a live proper motion look like together. Every
change of time or place in the script is now followed by a `core.wait`, which
yields to the event loop.

Stellarium also asks the network where it is, and the answer arrives at some
unpredictable moment in the first seconds of a run and replaces whatever the
script has set. One run of this script was quietly conducted from Stark County,
Ohio, and reported perfectly plausible altitudes for it. The script now sets
the observer, reads it back, and will not proceed until three readings in a row
agree; the runner refuses to write a file whose observer is not the one it
asked for; and the test refuses to trust a file whose observer is not the
database's.

### The epochs and the stars

The plan writes 2500 BCE and 10,500 BCE. The claims are computed at the Julian
epochs −2449 and −10499, which are those two round dates in astronomical year
numbering; −2499 is recorded as well, because it is the epoch several of the
claims are argued at. Stellarium's own dates for the three Julian Days are 2500
December 18, 2450 December 19 and 10500 December 18, all BCE and all proleptic
Julian: a Julian epoch is 365.25 days to the second and a calendar year is not,
so the two ways of labelling the same instant drift a fortnight apart.

Four stars are there because claim C2 hangs the four shafts of the Great
Pyramid on them: Alnitak, Thuban, Sirius and Kochab. Alnilam and Mintaka are
there because claim C4 lays Orion's belt on the three pyramids at 10,450 BCE
and reads differences of right ascension to do it, which is exactly where and
exactly what the two precessions disagree about most.

## Where the differences come from

Five things stand between the two answers, and they are of very different
sizes.

**The clock.** Stellarium precesses to JD plus ΔT and this package to the
Julian epoch the Julian Day stands for. Stellarium's own ΔT at the three epochs
is 15 hours, 15 hours and 5.3 days. Precession moves a star by about 50
arcseconds a year, so five days of it is under an arcsecond; the test measures
the shift directly rather than arguing it, and finds it under one arcsecond in
declination everywhere.

**The observer.** Stellarium keeps a location in single-precision floats, so it
observed from latitude 29.979167938 where the database says 29.979167. That is
three thousandths of an arcsecond, and it reaches the transit altitude at the
same size.

**The precession.** Both programs cite the same paper and they do not agree.
The paper offers more than one set of expressions for the same underlying
long-term solution, and the two programs are evidently not using the same one:
this package follows ERFA, which builds the rotation from the series for the
ecliptic and equator poles, as `packages/sky/src/vondrak.ts` records. The
obliquity of date shows the disagreement most cleanly, because no star is
involved in it at all. Stellarium's figures here are recorded as
`obliquityProbe`:

| epoch | `obliquityOfDate` | Stellarium 26.2 | difference |
|---:|---:|---:|---:|
| J2000 | 23.439279445° | 23.439279444° | 0.000″ |
| J1000 | 23.568822153° | 23.568822314° | −0.001″ |
| J−500 | 23.755702085° | 23.755844680° | −0.51″ |
| J−1500 | 23.870380809° | 23.870894888° | −1.85″ |
| J−2449 | 23.968416912° | 23.969628414° | −4.36″ |
| J−5000 | 24.161110193° | 24.166000248° | −17.60″ |
| J−7500 | 24.224885385° | 24.233375996° | −30.57″ |
| J−10499 | 24.116790098° | 24.125460272° | −31.21″ |

The two are the same number within a thousand years of J2000 and grow steadily
apart going back, which is what two fits to one solution do and not what a
periodic term does. Neither program is wrong about the obliquity in any sense
that can be settled from here: the model itself is a fit, and this is how well
it is determined that far back.

Where that difference lands matters more than its size. It is almost all along
the equator. In declination it never exceeds 22 arcseconds at any star or epoch
recorded here, so the transit altitude, which is a declination and a latitude
and nothing else, keeps well inside the plan's arcminute. In right ascension it
reaches 76 arcseconds at 10,500 BCE. And because it carries every star nearly
the same way, it very largely cancels out of a difference between two stars
near each other: Orion's belt spans three degrees, the three stars' right
ascensions each disagree by about 85 arcseconds at 10,500 BCE, and the
differences between them disagree by at most 11.

**The star catalogue.** `data/stars/named.json` carries HYG 4.2's proper
motions; Stellarium's own catalogue does not carry the same numbers. Measured
from Stellarium's output at J1000 and J3000, which is recorded in the file as
`properMotionProbe`, in milliarcseconds per year:

| star | HYG μα·cos δ | HYG μδ | Stellarium μα·cos δ | Stellarium μδ | difference in μδ |
|---|---:|---:|---:|---:|---:|
| Alnitak | 3.99 | 2.54 | 3.19 | 2.03 | 0.51 |
| Thuban | −56.52 | 17.19 | −56.35 | 12.33 | 4.86 |
| Sirius | −546.01 | −1223.08 | −505.51 | −1077.99 | −145.09 |
| Kochab | −32.29 | 11.91 | −32.61 | 11.42 | 0.49 |
| Alnilam | 1.49 | −1.06 | 1.44 | −0.78 | −0.28 |
| Mintaka | 1.67 | 0.56 | 0.64 | −0.69 | 1.25 |

`data/sources.json` describes HYG 4.2 as a merge of Hipparcos with the Yale
Bright Star and Gliese catalogues; Stellarium ships a catalogue of its own and
this comparison does not establish which reduction either figure comes from.
Five of the six differences are worth under two arcminutes even across twelve
and a half thousand years. Sirius's is worth half a degree.

There is a second, smaller difference in how the motion is applied.
`positionAtEpoch` moves a star along a straight line in right ascension and
declination at a constant rate, which its own comment already calls inadequate
for Sirius. Stellarium's motion is not a straight line: the rate it implies
over 12,499 years is measurably not the rate it implies over 4,499. For the
five slow stars this is worth a fraction of an arcsecond. For Sirius it is the
difference between the 1,814 arcseconds that the rate difference alone predicts
at 10,500 BCE and the 2,483 arcseconds actually seen.

## The differences

Everything below is `positionAtEpoch` and `transitAltitude` from this package
against `data/validation/stellarium.json`, in arcseconds, positive where this
package gives the larger value. Right ascension is given as a great-circle
distance, that is multiplied by the cosine of the declination.

| star | epoch | Δα·cos δ | Δδ | Δ transit altitude |
|---|---:|---:|---:|---:|
| Alnitak | −2499 | −15.7 | −10.7 | −10.7 |
| Alnitak | −2449 | −15.1 | −10.4 | −10.4 |
| Alnitak | −10499 | −85.8 | 12.2 | 12.3 |
| Thuban | −2499 | −14.3 | −12.7 | 12.7 |
| Thuban | −2449 | −13.9 | −12.9 | 12.9 |
| Thuban | −10499 | 58.3 | 1.5 | −1.5 |
| Sirius | −2499 | −103.8 | 745.0 | 745.0 |
| Sirius | −2449 | −99.3 | 736.4 | 736.4 |
| Sirius | −10499 | −253.3 | 2482.8 | 2482.8 |
| Kochab | −2499 | 5.0 | 1.9 | −1.9 |
| Kochab | −2449 | 4.8 | 2.0 | −2.0 |
| Kochab | −10499 | 9.0 | −0.3 | 0.3 |
| Alnilam | −2499 | −13.8 | −6.2 | −6.2 |
| Alnilam | −2449 | −13.4 | −5.9 | −5.9 |
| Alnilam | −10499 | −76.0 | 23.4 | 23.4 |
| Mintaka | −2499 | −15.6 | −14.1 | −14.1 |
| Mintaka | −2449 | −15.0 | −13.8 | −13.8 |
| Mintaka | −10499 | −89.1 | 6.3 | 6.3 |

The transit altitude changes sign against the declination for Thuban and
Kochab because both of them culminate north of the zenith from Giza.

And the same comparison with the two star catalogues taken out of it, which is
this package's precession applied to Stellarium's own place on the J2000 axes.
What is left is the precession, the clock and the rounded latitude:

| star | epoch | Δα·cos δ | Δδ | Δ transit altitude |
|---|---:|---:|---:|---:|
| Alnitak | −2499 | −13.1 | −7.3 | −7.3 |
| Alnitak | −2449 | −12.6 | −7.0 | −7.0 |
| Alnitak | −10499 | −75.8 | 18.4 | 18.4 |
| Thuban | −2499 | −4.0 | 6.4 | −6.4 |
| Thuban | −2449 | −3.9 | 6.1 | −6.1 |
| Thuban | −10499 | 1.4 | −13.6 | 13.6 |
| Sirius | −2499 | −11.8 | −7.0 | −7.0 |
| Sirius | −2449 | −11.3 | −6.7 | −6.7 |
| Sirius | −10499 | −74.6 | −12.0 | −12.0 |
| Kochab | −2499 | 5.0 | −0.5 | 0.5 |
| Kochab | −2449 | 4.8 | −0.3 | 0.3 |
| Kochab | −10499 | 2.9 | 1.6 | −1.6 |
| Alnilam | −2499 | −13.2 | −7.3 | −7.3 |
| Alnilam | −2449 | −12.7 | −7.0 | −7.0 |
| Alnilam | −10499 | −75.5 | 19.8 | 19.8 |
| Mintaka | −2499 | −13.2 | −7.3 | −7.3 |
| Mintaka | −2449 | −12.7 | −7.0 | −7.0 |
| Mintaka | −10499 | −75.3 | 21.1 | 21.1 |

Sirius moves from 2,483 arcseconds to 12. Whatever else is true, the
disagreement about Sirius is not about precession.

And Orion's belt, which is what claim C4 is built on, as differences between
the three stars rather than as three positions. Right ascension first, then
declination, both as this package less Stellarium in arcseconds of great
circle:

| pair | J−2499 | J−2449 | J−10499 |
|---|---:|---:|---:|
| Mintaka to Alnitak, Δα·cos δ | 0.1″ | 0.2″ | −0.1″ |
| Mintaka to Alnilam, Δα·cos δ | −1.7″ | −1.6″ | −11.3″ |
| Alnitak to Alnilam, Δα·cos δ | −1.8″ | −1.8″ | −11.2″ |
| Mintaka to Alnitak, Δδ | −3.5″ | −3.4″ | −6.0″ |
| Mintaka to Alnilam, Δδ | −8.0″ | −7.8″ | −17.1″ |
| Alnitak to Alnilam, Δδ | −4.5″ | −4.4″ | −11.1″ |

Eighty-nine arcseconds of disagreement about where Mintaka is becomes eleven
about where it is relative to Alnilam. What survives is mostly not the
precession at all but the two catalogues' proper motion for Mintaka, which is
why the declination differences are the larger of the two.

## What the test asserts, and why

`packages/sky/src/stellarium.test.ts`:

- **Alnitak's transit altitude is within an arcminute at every epoch.** This is
  the plan's criterion. The worst of the three is 12.3 arcseconds.
- **The other five stars, Sirius excepted, are within an arcminute in
  declination and in transit altitude.** Worst 23.4 arcseconds, which is Alnilam at 10,500 BCE.
- **Sirius's declination is not within an arcminute at any epoch.** The test
  asserts that it differs by more than ten arcminutes, rather than allowing for
  it, so that nobody can read a passing suite as agreement about Sirius. If
  `data/stars/named.json` is ever updated, or `positionAtEpoch` is given
  rigorous space motion, this test will fail and ask for the record to be made
  again.
- **The obliquity of date agrees to a twentieth of an arcsecond within a
  thousand years of J2000, has parted by more than four arcseconds by 2450 BCE
  and more than thirty by 7500 BCE, never reaches an arcminute, and grows
  monotonically backwards.** Asserted from both sides, so that neither program
  can change its precession without this saying so.
- **Right ascension is within half an arcminute in the third millennium BCE,
  Sirius excepted, and has grown past one arcminute but not two by 10,500
  BCE.** Half an arcminute covers the 15.7 arcseconds observed with a factor of
  two; the deep epoch is asserted from both sides for the same reason as the
  obliquity.
- **The right ascension and declination differences across Orion's belt agree
  to half an arcminute at every epoch**, which is the assertion that claim C4
  is not exposed to the precession disagreement even though its stars'
  absolute right ascensions are. What C4 is exposed to instead is the section
  below.
- **With the star catalogues out of the comparison, the two precessions agree
  in declination, and so in transit altitude, to half an arcminute at every
  star and epoch.** Observed worst 21.1 arcseconds. This is the assertion that
  the Vondrák implementation is right; the arcminute above is what the
  implementation plus the catalogue is worth together.
- **The ΔT between the two clocks is worth under an arcsecond**, measured
  rather than argued.
- **The proper motions differ by single-digit milliarcseconds a year for five
  stars and by 145 for Sirius**, and that rate difference accounts for at least
  two thirds of what is seen at every epoch.
- **Stellarium's recorded observer is the database's, its Julian Days are
  `julianEpochToJd`'s, its apparent-place corrections were all off, and every
  star was on the meridian when its altitude was read**, so a record made from
  the wrong place, the wrong date or the wrong settings cannot be quietly
  compared against.

## What this leaves open

Sirius is the only star among the six whose place this package cannot claim to
better than an arcminute at these epochs, and claim C2's Queen's Chamber south
shaft is the claim that depends on it. `docs/shafts.md` reports that shaft's
solved epoch moving 5.6 years per arcminute of shaft angle, so twelve
arcminutes of declination at 2500 BCE is worth something like seventy years in
the solved date: not enough to overturn the claim, and far too much to quote
the date to a decade.

The right ascension disagreement at 10,500 BCE is a property of the model and
not of either program, and the honest way to carry it is as an uncertainty on
anything that reads a right ascension that far back. Claim C4 is the only thing
in `data/claims/` that reads one at a deep epoch, and it reads differences
across three degrees of sky rather than positions, which is what saves it: 89
arcseconds apiece becomes 11 between them.

Claim C4 is nonetheless the claim this check leaves in the least comfortable
place, and not for the reason expected. Evaluating its two comparisons on
Stellarium's stars instead of this package's, at the deep epoch:

| C4's comparison | on our stars | on Stellarium's | difference |
|---|---:|---:|---:|
| belt angle from the meridian | 50.41491° | 50.38772° | 1.63′, or 0.05 % |
| Mintaka off the Alnitak to Alnilam line | 0.148184 | 0.155434 | 4.66 % |

The belt angle is safe by two orders of magnitude. The offset ratio is not: it
is a small residual of large cancelling terms, so eleven and seventeen
arcseconds in the inputs come out as four and two thirds per cent in the
answer, against C4's own `tolerance_pct: 5`. At 2500 BCE the same figure is
1.9 per cent. Nothing here says which of the two star models is right, and
neither of them is the reason C4 is a marginal claim; but a comparison that
changes by nearly its whole tolerance when the star catalogue changes should be
read with that in mind, and it is a reason to want the proper motions settled.

Two things would settle them, and neither belongs to this task: adopting proper
motions from a modern reduction, and replacing the straight line in
`properMotionAtEpoch` with rigorous space motion, which needs the parallax
`data/stars/hyg-bright.json` already carries and a radial velocity it does not.
