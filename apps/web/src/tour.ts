/**
 * The tour: one narrated sequence of shots, as data.
 *
 * A shot is a stretch of time with a camera in it and a paragraph beside it.
 * It names the claim to open, the layers it needs, where the camera starts
 * and where it arrives, and, for the shots that move the sky, the moment, the
 * epoch and the star held on the meridian. The motion player plays it through
 * the view store's own actions, so the tour does nothing a reader could not do
 * by hand and the address bar keeps mirroring the view the whole way.
 *
 * The order is the eras: the plateau as it stands, the casing going back on
 * for the geometry, the inside, the sky rolling back to the First Time behind
 * the Sphinx, and the stripping that brings it home again. What a shot says is
 * what to look at and what the number on screen means; the detail pane carries
 * each claim's summary, its comparisons and its free choices, and a shot never
 * restates them.
 *
 * Every camera here is a composition and not a measurement: the framings are
 * rounded to ten metres and nothing downstream reads one. Every epoch is a
 * claim's own or a timeline stop's own, read off `view.ts` rather than typed,
 * and the tests check the claims in the bundle agree.
 */
import { LOOKS, type Look } from './looks';
import type { Sequence, Shot } from './motion/types';
import { MOMENTS, stateById, type CameraView, type Moment, type Section, type Vec3 } from './view';

const D2R = Math.PI / 180;

/**
 * A camera standing off a point on a compass bearing. Azimuth is degrees east
 * of north and elevation is degrees above the horizontal, which is how a view
 * is described in words; the arithmetic turns that into three's world frame,
 * where +X is east, +Y is up and +Z is south, so north is -Z.
 */
export function cameraFrom(target: Vec3, azimuthDeg: number, elevationDeg: number, distanceM: number): CameraView {
  const az = azimuthDeg * D2R;
  const el = elevationDeg * D2R;
  const horizontal = distanceM * Math.cos(el);
  return {
    position: [
      target[0] + horizontal * Math.sin(az),
      target[1] + distanceM * Math.sin(el),
      target[2] - horizontal * Math.cos(az),
    ],
    target,
  };
}

/** One of `view.ts`'s named moments, by id, so no day or hour is typed twice here. */
export function momentOf(id: string): Moment {
  const named = MOMENTS.find((m) => m.id === id);
  if (!named) throw new Error(`tour: no moment "${id}" in view.ts`);
  return named.moment;
}

/** One of the hero stands from `looks.ts`, by id, for the shots that go to one. */
function look(id: Look['id']): Look {
  const found = LOOKS.find((l) => l.id === id);
  if (!found) throw new Error(`tour: no look "${id}" in looks.ts`);
  return found;
}

/**
 * The points the shots look at, in the world frame. These are framings and
 * not measurements: each is rounded to ten metres and none of them is a
 * quantity any claim reads, so nothing the database holds is restated here.
 * The heights are chosen to put the mass of the thing in the middle of the
 * frame rather than to stand for anything.
 */

/** The midpoint of the Great Pyramid's south-west corner and Khafre's north-east one. */
const GAP: Vec3 = [-170, 40, 180];
/** The Great Pyramid's base centre, which is the origin of the whole frame. */
const G1: Vec3 = [0, 70, 0];
/** The King's Chamber, whose floor the database puts at 42.9 m above that base. */
const KINGS_CHAMBER: Vec3 = [7, 43, 11];
/** The three pyramids together. */
const THREE: Vec3 = [-300, 30, 360];
/**
 * The Sphinx's body, in its hollow. This was the box's middle, ten metres over
 * the datum plane, until the footprint import stood the Sphinx on the ground
 * it is cut into, some thirty-eight metres below Khufu's base.
 */
const SPHINX: Vec3 = [330, -30, 430];
/** The middle of Legon's rectangle, which lies on the ground. */
const RECTANGLE: Vec3 = [-260, 0, 340];

/** The opening and closing stand: the whole plateau from the south-east. */
const PLATEAU = cameraFrom(GAP, 135, 25, 1600);
/** The east face of the Great Pyramid, where the profile claims are read. */
const EAST_FACE = cameraFrom(G1, 90, 12, 700);
/** Inside, level with the King's Chamber, looking west along the cut. */
const CHAMBER = cameraFrom(KINGS_CHAMBER, 90, 8, 240);
/** South-west and high, where the shafts leave the mass with the sky behind them. */
const SHAFTS = cameraFrom(G1, 225, 20, 900);
/** High enough over the three to read the belt laid beside them. */
const BELT = cameraFrom(THREE, 135, 55, 1800);
/** Behind the Sphinx, looking the way it looks. */
const BEHIND_SPHINX = cameraFrom(SPHINX, 270, 8, 300);
/** High over Legon's rectangle, which needs all three pyramids in frame. */
const OVER_RECTANGLE = cameraFrom(RECTANGLE, 135, 60, 1600);
/** The east face again, further back, where the ghost Earth fits beside it. */
const GHOST_EARTH = cameraFrom(G1, 90, 10, 600);
/** C6's own stand, in front of the Sphinx, aimed through the gap. */
const AKHET = look('akhet');

/**
 * The north-south plane through the passages, 7.29 m east of the base centre.
 * That is `entrance.floor.begin.east` rounded to the centimetre, the same
 * plane the section block's own button cuts; the button reads the record, so
 * a resurvey moves it and this framing stays where it is.
 */
const PASSAGE_PLANE: Partial<Section> = { on: true, axis: 'ns', at: 7.29, ground: false };

/**
 * The two epochs the shots roll between, read off the timeline rather than
 * typed. `built` stands at 2450 BCE, which is the epoch C2 is stated at;
 * `ancient` stands at 10,500 BCE, which is the epoch C5 is stated at, Hancock
 * and Bauval's. The tests check the bundle's claims agree with both.
 */
const BUILT_EPOCH = stateById('built').epoch;
const ANCIENT_EPOCH = stateById('ancient').epoch;

/** The dawn the tour opens on, and the midnight the sky shots need. */
const DAWN = momentOf('equinox-dawn');
const MIDNIGHT = momentOf('midnight');

/**
 * How long each move between two stands takes. Six to ten seconds is the
 * band: under six a move across the plateau reads as a lurch, over ten the
 * reader is waiting. These are look choices and nothing reads them but the
 * shots below.
 */
const TRAVEL = 8;
/** The slower moves: in through the stone, and down to the Sphinx. */
const SLOW = 9;
/** The rollback behind the Sphinx, which wants the ages to turn visibly. */
const ROLLBACK = 10;

/** How many words a shot's narration is, for the seconds it needs. */
export const wordCount = (text: string | undefined): number => (text ? text.trim().split(/\s+/).length : 0);

/**
 * A shot's length is its travel plus its reading: three words a second, which
 * is an unhurried reading pace, so a shot holds its stand long enough for its
 * own paragraph and no longer. Computing it here rather than typing it means
 * editing a sentence cannot leave the tour running off the end of its words.
 */
export function shotOf(draft: Omit<Shot, 'seconds'>): Shot {
  const travel = draft.camera[draft.camera.length - 1]?.at ?? 0;
  return { ...draft, seconds: Math.round((travel + wordCount(draft.text) / 3) * 10) / 10 };
}

export const TOUR: Sequence = {
  id: 'tour',
  label: 'The tour',
  note: 'Eleven shots through the eras, from what the model is built from to where the dossier is.',
  shots: [
    shotOf({
      id: 'plateau',
      title: 'The plateau',
      text:
        'Everything here is placed from the measurement database: a base side, a height, a centre offset and an orientation, each with a ' +
        'cited source. Nothing derived is stored, so the perimeters and face angles the claims are about are computed from those numbers ' +
        'as the page loads. The lesser monuments and the mastaba fields are OpenStreetMap outlines fitted onto the three surveyed ' +
        'pyramids to within a metre, and their heights are estimates, which the panel says. The preset picker in the Claims drawer is a ' +
        'preference order over sources, so choosing one changes which survey every number below is read from.',
      claim: null,
      layers: { pyramids: true, ground: true, terrain: false, north: true, sky: false },
      state: { to: 'today', at: 0 },
      moment: [{ at: 0, value: DAWN }],
      camera: [{ at: 0, value: PLATEAU }],
    }),
    shotOf({
      id: 'A1',
      title: 'The ghost profile',
      text:
        'The casing goes back on as the camera arrives, because a claim about a face angle is a claim about the face that was built ' +
        'rather than the one the quarrying left. The ghost is the slope the claimed ratio asks for, drawn over the slope the survey ' +
        'measures. What to watch is the gap between the two outlines and the residual the pane below states for it. A ratio is the same ' +
        'in any unit, so this one is bought with no free choice.',
      claim: 'A1',
      layers: { pyramids: true, overlay: true, sky: false },
      // The state arrives two thirds of the way in, so the dissolve lands
      // while the pyramid is still growing in the frame rather than on a cut.
      state: { to: 'built', at: (TRAVEL * 2) / 3 },
      camera: [
        { at: 0, value: PLATEAU },
        { at: TRAVEL, value: EAST_FACE },
      ],
    }),
    shotOf({
      id: 'A3',
      title: 'Three ghosts, one error band',
      text:
        'Three ghosts now, one for each slope that has been proposed for the same face, inside a band the width of the survey. Watch how ' +
        'much of the band they share: where several targets sit inside it the monument cannot discriminate between them, whatever the ' +
        'residuals are. Which of them a builder would have set out is a question for the sources rather than for the stone.',
      claim: 'A3',
      layers: { pyramids: true, overlay: true, sky: false },
      camera: [{ at: 0, value: EAST_FACE }],
    }),
    shotOf({
      id: 'inside',
      title: 'Inside the Great Pyramid',
      text:
        'The north-south plane opens through the passages, which is the plane Petrie draws Plate I on, and the camera goes in along it ' +
        "to the King's Chamber. Its measured length, width and height are the three numbers the comparisons below are built from. The " +
        "cubit that turns those metres into the claimed whole numbers is this claim's one free choice, and the slider moves it.",
      claim: 'A4',
      layers: { pyramids: true, interior: true, overlay: true, sky: false },
      // The chambers read best inside a whole pyramid, so the shot stands the
      // timeline at "as built" as the section block's own button does. It is
      // already there from the shot before; naming it lets the drawer's list
      // jump straight here.
      state: { to: 'built', at: 0 },
      section: PASSAGE_PLANE,
      camera: [
        { at: 0, value: EAST_FACE },
        // No arc: the move runs down the cut plane, and lifting it would take
        // the camera out through the masonry the cut is holding open.
        { at: SLOW, value: CHAMBER, lift: 0 },
      ],
    }),
    shotOf({
      id: 'C2',
      title: 'The shafts and their stars',
      text:
        'The camera pulls out to the south-west and the day runs to midnight, so the stars of the epoch come up. Each shaft is drawn as ' +
        "a ray out of the chamber it leaves, and the sky is at 2450 BCE with Alnitak on the meridian. A shaft's measured angle and its " +
        "star's altitude at transit are the two numbers every comparison holds, so a ray that misses is a residual in degrees. The epoch " +
        'and the star assigned to each shaft are both free choices: drag the epoch slider and watch which assignments survive the move.',
      claim: 'C2',
      layers: { pyramids: true, interior: true, overlay: true, sky: true },
      // C2 is stated at the epoch the "as built" stop stands at, so the sky
      // holds where the timeline already has it while the shafts are read.
      epoch: [{ at: 0, value: BUILT_EPOCH }],
      // Alnitak on the meridian, which is what the sky block's own button
      // does; the engine computes the sidereal time from the epoch above.
      lst: { meridian: 'alnitak' },
      moment: [
        { at: 0, value: DAWN },
        { at: SLOW, value: MIDNIGHT },
      ],
      camera: [
        { at: 0, value: CHAMBER },
        { at: SLOW, value: SHAFTS },
      ],
    }),
    shotOf({
      id: 'C4',
      title: 'The belt laid on the plateau',
      text:
        'The belt is projected down onto the ground from high enough to read both at once, at the epoch the claim is stated at, which ' +
        'the sky takes as the claim opens. The comparisons are about angle and spacing and not about a picture: one residual for the ' +
        "belt against the diagonal from Khufu to Menkaure, one for Menkaure's offset from the line from Khufu to Khafre. Krupp's " +
        'objection is the north-south inversion toggle in the pane below; turn it and watch both residuals.',
      claim: 'C4',
      layers: { pyramids: true, overlay: true, sky: true },
      camera: [
        { at: 0, value: SHAFTS },
        { at: TRAVEL, value: BELT },
      ],
    }),
    shotOf({
      id: 'C6',
      title: 'The gap and the solstice',
      text:
        'Down to the stand in front of the Sphinx, looking west-north-west at the gap between the two large pyramids, with the sun ' +
        'coming down through the shot so the bearing and the light arrive together. The bearing drawn is the summer solstice sunset ' +
        'azimuth computed from the obliquity of date, and the residual is its distance in degrees from the middle of that gap. The gap ' +
        'is computed from the two base corners rather than chosen, which is why the claim is stated with no free choices.',
      claim: 'C6',
      layers: { pyramids: true, overlay: true, sky: false },
      // The day is the akhet look's own, the June solstice; the two hours are
      // a look choice bracketing the hour that look is rendered at, so the sun
      // is still up as the camera lands and is going into the gap by the end.
      moment: [
        { at: 0, value: { day: AKHET.moment.day, hour: 17.5 } },
        { at: SLOW, value: { day: AKHET.moment.day, hour: 19 + 10 / 60 } },
      ],
      camera: [
        { at: 0, value: BELT },
        { at: SLOW, value: AKHET.camera },
      ],
    }),
    shotOf({
      id: 'C5',
      title: 'Behind the Sphinx',
      text:
        'The plateau greens as the camera comes round behind the Sphinx, which is the First Time, the state this claim is about, and ' +
        'the Sphinx takes the lion form the claim gives it. The epoch rolls back eight thousand years over the move. The overlay marks ' +
        'where Regulus rose and where the equinox sun rose at the claimed epoch, and the two residuals are how far the first is from ' +
        'due east and how far apart the two are in sidereal time. Three free choices carry this one, and the epoch is the first of them.',
      claim: 'C5',
      layers: { pyramids: true, overlay: true, sky: true },
      state: { to: 'ancient', at: 0 },
      sphinx: 'lion',
      // From the epoch the monument is dated to, back to the epoch C5 is
      // stated at, which is the First Time stop's own: Hancock and Bauval's.
      epoch: [
        { at: 0, value: BUILT_EPOCH },
        { at: ROLLBACK, value: ANCIENT_EPOCH },
      ],
      camera: [
        { at: 0, value: AKHET.camera },
        { at: SLOW, value: BEHIND_SPHINX },
      ],
    }),
    shotOf({
      id: 'D2',
      title: 'The rectangle on the ground',
      text:
        "Back to as built, and high enough to hold all three. The rectangle runs from the Great Pyramid's north-east corner to " +
        "Menkaure's south-west one. Its two extents are divided by the royal cubit to reach the claimed round numbers, so the cubit is " +
        'the free choice. Move the cubit slider and watch both residuals move together, which is what a free choice looks like from ' +
        'outside.',
      claim: 'D2',
      layers: { pyramids: true, overlay: true, sky: false },
      state: { to: 'built', at: 0 },
      sphinx: null,
      camera: [
        { at: 0, value: BEHIND_SPHINX },
        { at: SLOW, value: OVER_RECTANGLE },
      ],
    }),
    shotOf({
      id: 'B1',
      title: 'The ghost Earth',
      text:
        'The ghost is the northern hemisphere drawn at the claimed scale, laid against the pyramid it is claimed to model. Two ' +
        'comparisons carry it: the height times the factor against the polar radius, the perimeter times the factor against the ' +
        'equatorial circumference. The factor, and which radius and which circumference it is measured against, are the free choices the ' +
        'pane lists.',
      claim: 'B1',
      layers: { pyramids: true, overlay: true, sky: false },
      camera: [
        { at: 0, value: OVER_RECTANGLE },
        { at: TRAVEL, value: GHOST_EARTH },
      ],
    }),
    shotOf({
      id: 'dossier',
      title: 'Where the rest of it is',
      text:
        'The casing goes, the sand comes, and the plateau returns to what the survey actually found, which is where the tour started. ' +
        'Every claim in the panel is regenerated into docs/dossier.md, which states the same numbers without the model, and the ' +
        'reasoning behind all of it is in docs/plan.html beside it. The address bar has been keeping up the whole way, so whatever is ' +
        'on screen now is already a link.',
      claim: null,
      layers: { pyramids: true, ground: true, terrain: false, north: true, sky: false },
      // Two dissolves inside one stand: the casing is robbed at three
      // seconds, the rest of the ages pass as the camera settles, and the
      // tour closes on the survey it opened on.
      state: { to: 'stripped', at: 3 },
      states: [{ to: 'today', at: TRAVEL }],
      camera: [
        { at: 0, value: GHOST_EARTH },
        { at: TRAVEL, value: PLATEAU },
      ],
    }),
  ],
};

/** The tour's shots, for `view.ts`'s `?tour=N` and the drawer's list. */
export const TOUR_STEPS = TOUR.shots;
