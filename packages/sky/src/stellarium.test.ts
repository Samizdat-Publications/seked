/**
 * The package against Stellarium 26.2, which computes the same sky from the
 * same paper and shares no line of code with it.
 *
 * The rest of the suite checks this package against itself and against ERFA's
 * published numbers, which settles whether the Vondrák matrices were typed in
 * correctly but not whether the thing built on top of them is the sky. This
 * file closes that gap: data/validation/stellarium.json holds what Stellarium
 * said when it was put at Giza on three dates and asked where six stars were,
 * and every assertion below is the package's answer against that record. How
 * the record was made, and what each tolerance is paying for, is docs/stellarium.md.
 *
 * Two of the numbers here are deliberately loud. Sirius disagrees by twelve
 * arcminutes in the third millennium BCE and by forty at 10,500 BCE, and the
 * tests say so rather than widening a tolerance until it passes; the cause is
 * that the two programs carry different proper motions for it. And the two
 * precessions, which are the same paper, disagree by tens of arcseconds before
 * about 3000 BCE; the obliquity block measures that with no star involved at
 * all, and the blocks around it show where it does and does not land.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_DIR, loadDatabase, resolve } from '@seked/data';
import { julianEpochToJd } from './calendar';
import { loadNamedStars } from './catalogue';
import { transitAltitude } from './frames';
import { normalizeDeg } from './horizon';
import { positionAtEpoch, properMotionAtEpoch, starById } from './stars';
import { obliquityOfDate } from './sun';
import { precessIcrsToDate } from './vondrak';

const ARCMINUTE = 60;

interface StarRecord {
  raOfDateDeg: number;
  decOfDateDeg: number;
  raJ2000Deg: number;
  decJ2000Deg: number;
  transitAltitudeDeg: number;
  transitHourAngleDeg: number;
  /** The declination read at the transit instant, which is the one the altitude belongs to. */
  transitDecOfDateDeg: number;
}
interface EpochRecord {
  epoch: number;
  jd: number;
  deltaTSeconds: number;
  stars: Record<string, StarRecord>;
}
interface ProbeRecord {
  epoch: number;
  jd: number;
  stars: Record<string, { raJ2000Deg: number; decJ2000Deg: number }>;
}
interface ObliquityRecord {
  epoch: number;
  jd: number;
  obliquityDeg: number;
}
interface Record_ {
  version: string;
  observer: { latitudeDeg: number; longitudeDeg: number; elevationM: number };
  observerAsSet: { latitudeDeg: number; longitudeDeg: number; planet: string };
  settings: { nutation: boolean; aberration: boolean; topocentric: boolean; atmosphere: boolean };
  stars: { id: string; designation: string }[];
  epochs: EpochRecord[];
  properMotionProbe: ProbeRecord[];
  obliquityProbe: ObliquityRecord[];
}

const record = JSON.parse(readFileSync(join(DATA_DIR, 'validation', 'stellarium.json'), 'utf8')) as Record_;
const stars = loadNamedStars();
const latitude = record.observer.latitudeDeg;

/** Every star at every epoch, so a test can be one loop and name what failed. */
const rows = record.epochs.flatMap((epoch) =>
  record.stars.map(({ id }) => ({ id, epoch: epoch.epoch, at: epoch.stars[id] as StarRecord, jd: epoch.jd, deltaTSeconds: epoch.deltaTSeconds })),
);
const where = (id: string, epoch: number) => `${id} at J${epoch}`;

/** The shortest angle between two right ascensions, in arcseconds of great circle at that declination. */
const raSeconds = (ours: number, theirs: number, decDeg: number) => {
  const difference = normalizeDeg(ours - theirs);
  return (difference > 180 ? difference - 360 : difference) * 3600 * Math.cos((decDeg * Math.PI) / 180);
};

describe('the record is of the run it claims to be', () => {
  it('was made from the coordinates the measurement database holds, not from anywhere Stellarium chose', () => {
    const { values } = resolve(loadDatabase(), 'canonical');
    expect(record.observer.latitudeDeg).toBe(values['g1.center.latitude']);
    expect(record.observer.longitudeDeg).toBe(values['g1.center.longitude']);
    // Stellarium keeps a location in single-precision floats, so what it read
    // back is the request rounded, not the request.
    expect(record.observerAsSet.planet).toBe('Earth');
    expect(Math.abs(record.observerAsSet.latitudeDeg - record.observer.latitudeDeg)).toBeLessThan(1e-5);
    expect(Math.abs(record.observerAsSet.longitudeDeg - record.observer.longitudeDeg)).toBeLessThan(1e-5);
  });

  it('holds every star at every epoch, so that an emptied record cannot pass by having nothing to check', () => {
    expect(record.stars).toHaveLength(6);
    expect(record.epochs).toHaveLength(3);
    expect(rows).toHaveLength(18);
    for (const row of rows) expect(row.at, where(row.id, row.epoch)).toBeDefined();
  });

  it('was made at the Julian Days julianEpochToJd gives for the epochs, and nowhere else', () => {
    for (const epoch of record.epochs) expect(epoch.jd, `J${epoch.epoch}`).toBe(julianEpochToJd(epoch.epoch));
    for (const probe of record.obliquityProbe) expect(probe.jd, `J${probe.epoch}`).toBe(julianEpochToJd(probe.epoch));
    for (const probe of record.properMotionProbe) expect(probe.jd, `J${probe.epoch}`).toBe(julianEpochToJd(probe.epoch));
    expect(record.properMotionProbe.map((p) => p.epoch)).toEqual([1000, 3000]);
  });

  it('was made with nutation, aberration, diurnal parallax and refraction all switched off', () => {
    expect(record.settings).toEqual({ nutation: false, aberration: false, topocentric: false, atmosphere: false, deltaTAlgorithm: expect.any(String) });
  });

  it('put every star on the meridian to a twentieth of an arcsecond before reading its altitude', () => {
    // The script steps the clock until the hour angle is under 1e-5 degrees,
    // and an altitude read that close to the meridian is flat to far more
    // decimal places than anything here reads.
    for (const { id, epoch, at } of rows) {
      expect(Math.abs(at.transitHourAngleDeg) * 3600, where(id, epoch)).toBeLessThan(0.05);
    }
  });
});

describe("Alnitak's transit altitude, which is what Phase 3 of the plan is finished by", () => {
  it('is within an arcminute of Stellarium at every epoch, 2500 BCE and 10,500 BCE included', () => {
    for (const { epoch, at } of rows.filter((r) => r.id === 'alnitak')) {
      const ours = transitAltitude(positionAtEpoch(starById(stars, 'alnitak'), epoch).decDeg, latitude);
      const seconds = (ours - at.transitAltitudeDeg) * 3600;
      expect(Math.abs(seconds), `J${epoch} differs by ${seconds.toFixed(1)} arcsec`).toBeLessThan(ARCMINUTE);
    }
  });
});

describe('the other five stars', () => {
  // Thuban and Kochab for the two northern shafts, Alnilam and Mintaka
  // because claim C4 lays the belt on the three pyramids. The worst of the
  // four is Alnilam at 10,500 BCE, 23.4 arcseconds.
  it('puts every one of them but Sirius within an arcminute in declination and in transit altitude', () => {
    for (const { id, epoch, at } of rows.filter((r) => r.id !== 'sirius' && r.id !== 'alnitak')) {
      const ours = positionAtEpoch(starById(stars, id), epoch);
      const declination = (ours.decDeg - at.decOfDateDeg) * 3600;
      const altitude = (transitAltitude(ours.decDeg, latitude) - at.transitAltitudeDeg) * 3600;
      expect(Math.abs(declination), `${where(id, epoch)} declination differs by ${declination.toFixed(1)} arcsec`).toBeLessThan(ARCMINUTE);
      expect(Math.abs(altitude), `${where(id, epoch)} altitude differs by ${altitude.toFixed(1)} arcsec`).toBeLessThan(ARCMINUTE);
    }
  });

  it('does not put Sirius within an arcminute, and says so rather than allowing for it', () => {
    for (const { epoch, at } of rows.filter((r) => r.id === 'sirius')) {
      const ours = positionAtEpoch(starById(stars, 'sirius'), epoch);
      const declination = (ours.decDeg - at.decOfDateDeg) * 3600;
      expect(Math.abs(declination), `J${epoch} differs by ${declination.toFixed(1)} arcsec`).toBeGreaterThan(10 * ARCMINUTE);
      // Which is what a package that moves a star 4.5 degrees on a straight
      // line, from proper motions another catalogue disagrees with, is worth
      // at these epochs. It is a statement about the star, not about the sky:
      // the block below puts Sirius back inside the arcminute the moment
      // Stellarium's own proper motion is used instead.
    }
  });
});

describe('the obliquity of date, which is the two precessions compared with no star in the way', () => {
  const probe = record.obliquityProbe;
  const at = (epoch: number) => probe.find((p) => p.epoch === epoch) as ObliquityRecord;
  const seconds = (epoch: number) => (obliquityOfDate(epoch) - at(epoch).obliquityDeg) * 3600;

  it('agrees to a twentieth of an arcsecond within a thousand years of J2000', () => {
    for (const epoch of [2000, 1000]) {
      expect(Math.abs(seconds(epoch)), `J${epoch} differs by ${seconds(epoch).toFixed(4)} arcsec`).toBeLessThan(0.05);
    }
  });

  it('has parted by arcseconds by 2450 BCE and by tens of them before 5000 BCE', () => {
    expect(Math.abs(seconds(-2449)), `J-2449 differs by ${seconds(-2449).toFixed(2)} arcsec`).toBeGreaterThan(4);
    expect(Math.abs(seconds(-5000)), `J-5000 differs by ${seconds(-5000).toFixed(2)} arcsec`).toBeGreaterThan(17);
    expect(Math.abs(seconds(-10499)), `J-10499 differs by ${seconds(-10499).toFixed(2)} arcsec`).toBeGreaterThan(30);
  });

  it('never parts by as much as an arcminute over the whole range probed', () => {
    for (const p of probe) {
      expect(Math.abs(seconds(p.epoch)), `J${p.epoch} differs by ${seconds(p.epoch).toFixed(2)} arcsec`).toBeLessThan(ARCMINUTE);
    }
  });

  it('grows monotonically backwards, which is two fits drifting apart and not a periodic term', () => {
    const backwards = [...probe].sort((a, b) => b.epoch - a.epoch);
    for (let i = 1; i < backwards.length; i++) {
      const before = backwards[i - 1] as ObliquityRecord;
      const after = backwards[i] as ObliquityRecord;
      expect(Math.abs(seconds(after.epoch)), `J${after.epoch} against J${before.epoch}`).toBeGreaterThan(Math.abs(seconds(before.epoch)));
    }
  });
});

describe('right ascension, which is where the two precessions part company', () => {
  it('agrees to half an arcminute in the third millennium BCE for every star but Sirius', () => {
    for (const { id, epoch, at } of rows.filter((r) => r.epoch > -3000 && r.id !== 'sirius')) {
      const ours = positionAtEpoch(starById(stars, id), epoch);
      const seconds = raSeconds(ours.raDeg, at.raOfDateDeg, ours.decDeg);
      expect(Math.abs(seconds), `${where(id, epoch)} differs by ${seconds.toFixed(1)} arcsec`).toBeLessThan(ARCMINUTE / 2);
    }
  });

  it('has drifted to as much as an arcminute and a half by 10,500 BCE, still short of two', () => {
    const deep = rows.filter((r) => r.epoch === -10499 && r.id !== 'sirius');
    const worst = Math.max(
      ...deep.map(({ id, epoch, at }) => Math.abs(raSeconds(positionAtEpoch(starById(stars, id), epoch).raDeg, at.raOfDateDeg, at.decOfDateDeg))),
    );
    expect(worst).toBeGreaterThan(ARCMINUTE);
    expect(worst, `worst right ascension difference is ${worst.toFixed(1)} arcsec`).toBeLessThan(2 * ARCMINUTE);
  });

  it('cancels almost entirely out of a difference between two stars near each other, which is what claim C4 reads', () => {
    // C4 measures Orion's belt: its slope against the pyramids' diagonal, and
    // its middle star's offset from its own end-to-end line. Both are built
    // from differences across three degrees of sky. A precession that is out
    // by a rotation carries all three stars the same way, so the difference
    // survives what the position does not: 89 arcseconds apiece at 10,500 BCE
    // becomes 11 between them. What is left there is mostly the two
    // catalogues' proper motion for Mintaka, which is also why the declination
    // differences, checked here as well, are no smaller than the right
    // ascension ones. docs/stellarium.md works out what that is worth to C4.
    const belt: [string, string][] = [
      ['mintaka', 'alnitak'],
      ['mintaka', 'alnilam'],
      ['alnitak', 'alnilam'],
    ];
    for (const epoch of record.epochs) {
      for (const [first, second] of belt) {
        const theirFirst = epoch.stars[first] as StarRecord;
        const theirSecond = epoch.stars[second] as StarRecord;
        const ourFirst = positionAtEpoch(starById(stars, first), epoch.epoch);
        const ourSecond = positionAtEpoch(starById(stars, second), epoch.epoch);
        const middle = (epoch.stars['alnilam'] as StarRecord).decOfDateDeg;
        const rightAscension = raSeconds(ourFirst.raDeg, ourSecond.raDeg, middle) - raSeconds(theirFirst.raOfDateDeg, theirSecond.raOfDateDeg, middle);
        const declination = (ourFirst.decDeg - ourSecond.decDeg - (theirFirst.decOfDateDeg - theirSecond.decOfDateDeg)) * 3600;
        const at = `${first} to ${second} at J${epoch.epoch}`;
        expect(Math.abs(rightAscension), `${at}: right ascension differs by ${rightAscension.toFixed(1)} arcsec`).toBeLessThan(ARCMINUTE / 2);
        expect(Math.abs(declination), `${at}: declination differs by ${declination.toFixed(1)} arcsec`).toBeLessThan(ARCMINUTE / 2);
      }
    }
  });
});

describe('the precession on its own, with the two star catalogues taken out of the comparison', () => {
  // Stellarium reports each star's place on the J2000 axes as well as its
  // place of date, and the first is the second with the precession undone. Our
  // precession applied to their J2000 place is therefore the two models
  // compared directly, with proper motion no longer able to confuse the two.
  const ourPrecessionOfTheirStar = ({ at, epoch }: { at: StarRecord; epoch: number }) => precessIcrsToDate(at.raJ2000Deg, at.decJ2000Deg, epoch);

  it('agrees in declination, and so in transit altitude, to half an arcminute for every star and epoch', () => {
    for (const row of rows) {
      const ours = ourPrecessionOfTheirStar(row);
      const declination = (ours.decDeg - row.at.decOfDateDeg) * 3600;
      const altitude = (transitAltitude(ours.decDeg, latitude) - row.at.transitAltitudeDeg) * 3600;
      expect(Math.abs(declination), `${where(row.id, row.epoch)} declination differs by ${declination.toFixed(1)} arcsec`).toBeLessThan(ARCMINUTE / 2);
      expect(Math.abs(altitude), `${where(row.id, row.epoch)} altitude differs by ${altitude.toFixed(1)} arcsec`).toBeLessThan(ARCMINUTE / 2);
    }
  });

  it('agrees in right ascension to a few arcseconds in the third millennium BCE', () => {
    for (const row of rows.filter((r) => r.epoch > -3000)) {
      const ours = ourPrecessionOfTheirStar(row);
      const seconds = raSeconds(ours.raDeg, row.at.raOfDateDeg, ours.decDeg);
      expect(Math.abs(seconds), `${where(row.id, row.epoch)} differs by ${seconds.toFixed(1)} arcsec`).toBeLessThan(ARCMINUTE / 4);
    }
  });

  it('is the whole of the disagreement about right ascension at 10,500 BCE, bar Sirius', () => {
    for (const row of rows.filter((r) => r.epoch === -10499 && r.id !== 'sirius')) {
      const ours = ourPrecessionOfTheirStar(row);
      const seconds = raSeconds(ours.raDeg, row.at.raOfDateDeg, ours.decDeg);
      expect(Math.abs(seconds), `${where(row.id, row.epoch)} differs by ${seconds.toFixed(1)} arcsec`).toBeLessThan(1.5 * ARCMINUTE);
    }
  });

  it('carries no error worth reading from the ΔT that separates the two clocks', () => {
    // Stellarium precesses to JD + ΔT and this package to the Julian epoch the
    // Julian Day stands for. At 2450 BCE that is fifteen hours and at 10,500
    // BCE five days, which is worth a fraction of an arcsecond of precession.
    for (const { id, epoch, at, deltaTSeconds } of rows) {
      const shifted = epoch + deltaTSeconds / 86400 / 365.25;
      const a = precessIcrsToDate(at.raJ2000Deg, at.decJ2000Deg, epoch);
      const b = precessIcrsToDate(at.raJ2000Deg, at.decJ2000Deg, shifted);
      expect(Math.abs(b.decDeg - a.decDeg) * 3600, where(id, epoch)).toBeLessThan(1);
      expect(Math.abs(raSeconds(b.raDeg, a.raDeg, a.decDeg)), where(id, epoch)).toBeLessThan(2);
    }
  });
});

describe('where the rest of the disagreement comes from: the two catalogues do not carry the same proper motion', () => {
  const [early, late] = record.properMotionProbe as [ProbeRecord, ProbeRecord];
  const span = late.epoch - early.epoch;

  /** The declination rate Stellarium's own catalogue implies, in mas per year. */
  const theirDeclinationRate = (id: string) =>
    (((late.stars[id] as { decJ2000Deg: number }).decJ2000Deg - (early.stars[id] as { decJ2000Deg: number }).decJ2000Deg) / span) * 3.6e6;

  it('differs by single-digit milliarcseconds a year for five of the six stars, and by 145 for Sirius', () => {
    for (const { id } of record.stars.filter((s) => s.id !== 'sirius')) {
      const difference = starById(stars, id).pmDecMasYr - theirDeclinationRate(id);
      expect(Math.abs(difference), `${id} declination rate differs by ${difference.toFixed(2)} mas/yr`).toBeLessThan(10);
    }
    // Sirius moves south in both catalogues, and faster in this one: 1223.08
    // milliarcseconds a year against Stellarium's 1078.
    const sirius = starById(stars, 'sirius').pmDecMasYr - theirDeclinationRate('sirius');
    expect(Math.abs(sirius), `Sirius declination rate differs by ${sirius.toFixed(2)} mas/yr`).toBeGreaterThan(140);
    expect(Math.abs(sirius)).toBeLessThan(150);
  });

  it("accounts for most of Sirius's disagreement, the rest being that Stellarium's motion is not a straight line", () => {
    const rate = theirDeclinationRate('sirius');
    for (const { epoch, at } of rows.filter((r) => r.id === 'sirius')) {
      const fromTheRate = ((starById(stars, 'sirius').pmDecMasYr - rate) * (epoch - 2000)) / 1000;
      const seen = (positionAtEpoch(starById(stars, 'sirius'), epoch).decDeg - at.decOfDateDeg) * 3600;
      expect(fromTheRate / seen, `J${epoch} explains ${((100 * fromTheRate) / seen).toFixed(0)} per cent`).toBeGreaterThan(2 / 3);
    }
  });

  it('moves the other five stars apart by at most a couple of arcminutes over twelve millennia, and Sirius by forty', () => {
    for (const { id, epoch, at } of rows) {
      const ours = properMotionAtEpoch(starById(stars, id), epoch);
      const declination = Math.abs(ours.decDeg - at.decJ2000Deg) * 3600;
      const message = `${where(id, epoch)} differs by ${declination.toFixed(1)} arcsec`;
      if (id === 'sirius') expect(declination, message).toBeGreaterThan(10 * ARCMINUTE);
      else expect(declination, message).toBeLessThan(2 * ARCMINUTE);
    }
  });
});

describe('the record agrees with itself', () => {
  it('reports a transit altitude that is 90 degrees less the distance from the pole to the zenith', () => {
    // Stellarium was driven to the meridian and asked for its geometric
    // altitude, rather than being asked to evaluate 90 - |lat - dec|. That the
    // two agree is what makes the recorded altitudes worth comparing at all.
    //
    // The declination has to be the one read at the transit instant and not
    // the one read at the epoch instant: the two are up to half a day apart,
    // which is worth a few hundredths of an arcsecond of precession and would
    // swamp what this is measuring. Against the transit declination the two
    // routes to the altitude agree to a ten-thousandth of an arcsecond.
    for (const { id, epoch, at } of rows) {
      const fromDeclination = transitAltitude(at.transitDecOfDateDeg, record.observerAsSet.latitudeDeg);
      const seconds = (fromDeclination - at.transitAltitudeDeg) * 3600;
      expect(Math.abs(seconds), `${where(id, epoch)} differs by ${seconds.toExponential(2)} arcsec`).toBeLessThan(1e-3);
    }
  });
});
