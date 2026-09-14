/**
 * Tour mode: a narrated sequence of views, as data.
 *
 * A step is a view and a paragraph and nothing else. It names the claim to
 * open, the layers it needs, where the camera stands and, for the sky steps,
 * the epoch and the sidereal time; `applyStep` plays it through the store's
 * own actions, so the tour does nothing a reader could not do by hand and the
 * address bar keeps mirroring the view the whole way.
 *
 * A step never restates what the panel already says. The detail pane carries
 * each claim's summary, its comparisons and its free choices, so the text
 * here says what to look at and what the number on screen means.
 */
import type { ViewStore } from './store';
import type { CameraView, LayerId, Section, Vec3 } from './view';

export interface TourStep {
  id: string;
  title: string;
  text: string;
  /** The claim to open, or null for a step that opens none. */
  claim: string | null;
  /** The layers the step depends on. Any the step does not name are left alone. */
  layers: Partial<Record<LayerId, boolean>>;
  camera: CameraView;
  /** The epoch to hold the sky at, or absent to follow whichever claim is open. */
  epoch?: number;
  /** Local apparent sidereal time in degrees, for a step that wants a star placed. */
  lst?: number;
  /** The cut, or absent for a step with no cut. */
  section?: Partial<Section>;
}

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

/**
 * The points the steps look at, in the world frame. These are framings and
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
/** The Sphinx's box. */
const SPHINX: Vec3 = [350, 10, 430];
/** The middle of Legon's rectangle, which lies on the ground. */
const RECTANGLE: Vec3 = [-260, 0, 340];

/** The opening and closing view: the whole plateau from the south-east. */
const PLATEAU = cameraFrom(GAP, 135, 25, 1600);

/**
 * The north-south plane through the passages, 7.29 m east of the base centre.
 * That is `entrance.floor.begin.east` rounded to the centimetre, the same
 * plane the section block's own button cuts; the button reads the record, so
 * a resurvey moves it and this framing stays where it is.
 */
const PASSAGE_PLANE: Partial<Section> = { on: true, axis: 'ns', at: 7.29, ground: false };

/**
 * Alnitak's right ascension of date at 2450 BCE, which is the sidereal time
 * it crosses the meridian at. It is the value the Alnitak button in the sky
 * block sets; the test checks the two agree, so the step cannot drift away
 * from the button it stands in for.
 */
const ALNITAK_TRANSIT_LST = 31.09;

export const TOUR: TourStep[] = [
  {
    id: 'plateau',
    title: 'The plateau',
    text:
      'Everything here is placed from the measurement database: a base side, a height, a centre offset and an orientation, each with a ' +
      'cited source. Nothing derived is stored, so the perimeters and face angles the claims are about are computed from those numbers ' +
      'as the page loads. The Sphinx is a box at a cited position rather than a sculpt, and the panel says so.',
    claim: null,
    layers: { pyramids: true, ground: true, terrain: true, north: true, sky: false },
    camera: PLATEAU,
  },
  {
    id: 'presets',
    title: 'Presets and the cubit',
    text:
      'The preset picker below is a preference order over sources, so choosing one changes which survey each number is read from. The ' +
      'royal cubit under it is a measurement like any other, and the slider overrides it. Move either and everything downstream ' +
      're-resolves: the geometry, the overlays and every residual in the panel.',
    claim: null,
    layers: { pyramids: true, ground: true, terrain: true, north: true, sky: false },
    camera: cameraFrom(G1, 135, 25, 700),
  },
  {
    id: 'A1',
    title: 'The ghost profile',
    text:
      'The ghost is the slope the claimed ratio asks for, drawn over the slope the survey measures. What to watch is the gap between ' +
      'the two outlines and the residual the pane below states for it. A ratio is the same in any unit, so this one is bought with no ' +
      'free choice.',
    claim: 'A1',
    layers: { pyramids: true, overlay: true, sky: false },
    camera: cameraFrom(G1, 90, 12, 700),
  },
  {
    id: 'A3',
    title: 'Three ghosts, one error band',
    text:
      'Three ghosts now, one for each slope that has been proposed for the same face, inside a band the width of the survey. Watch how ' +
      'much of the band they share: where several targets sit inside it the monument cannot discriminate between them, whatever the ' +
      'residuals are. Which of them a builder would have set out is a question for the sources rather than for the stone.',
    claim: 'A3',
    layers: { pyramids: true, overlay: true, sky: false },
    camera: cameraFrom(G1, 90, 12, 700),
  },
  {
    id: 'inside',
    title: 'Inside the Great Pyramid',
    text:
      'The north-south plane is cut through the passages, which is the plane Petrie draws Plate I on, and the room in the middle of the ' +
      "frame is the King's Chamber. Its measured length, width and height are the three numbers the comparisons below are built from. " +
      "The cubit that turns those metres into the claimed whole numbers is this claim's one free choice, and the slider moves it.",
    claim: 'A4',
    layers: { pyramids: true, interior: true, today: false, overlay: true, sky: false },
    camera: cameraFrom(KINGS_CHAMBER, 90, 8, 240),
    section: PASSAGE_PLANE,
  },
  {
    id: 'C2',
    title: 'The shafts and their stars',
    text:
      "Each shaft is drawn as a ray out of the chamber it leaves, and the sky is at 2450 BCE with Alnitak on the meridian. A shaft's " +
      "measured angle and its star's altitude at transit are the two numbers every comparison holds, so a ray that misses is a residual " +
      'in degrees. The epoch and the star assigned to each shaft are both free choices: drag the epoch slider and watch which ' +
      'assignments survive the move.',
    claim: 'C2',
    layers: { pyramids: true, interior: true, overlay: true, sky: true },
    camera: cameraFrom(G1, 225, 20, 900),
    epoch: -2449,
    lst: ALNITAK_TRANSIT_LST,
  },
  {
    id: 'C4',
    title: 'The belt laid on the plateau',
    text:
      'The belt is projected down onto the ground from high enough to read both at once, at the epoch the claim is stated at. The ' +
      'comparisons are about angle and spacing and not about a picture: one residual for the belt against the diagonal from Khufu to ' +
      "Menkaure, one for Menkaure's offset from it. Krupp's objection is the north-south inversion toggle in the pane below; turn it " +
      'and watch both residuals.',
    claim: 'C4',
    layers: { pyramids: true, overlay: true, sky: true },
    camera: cameraFrom(THREE, 135, 55, 1800),
  },
  {
    id: 'C5',
    title: 'Behind the Sphinx',
    text:
      'The view is from behind the Sphinx, looking the way it looks. The overlay marks where Regulus rose and where the equinox sun ' +
      'rose at the claimed epoch, and the two residuals are how far the first is from due east and how far apart the two are in ' +
      'sidereal time. Three free choices carry this one, and the epoch is the first of them.',
    claim: 'C5',
    layers: { pyramids: true, overlay: true, sky: true },
    camera: cameraFrom(SPHINX, 270, 8, 300),
  },
  {
    id: 'C6',
    title: 'The gap and the solstice',
    text:
      'Looking west-north-west from above the Sphinx at the gap between the two large pyramids. The bearing drawn is the summer ' +
      'solstice sunset azimuth computed from the obliquity of date, and the residual is its distance in degrees from the middle of ' +
      'that gap. The gap is computed from the two base corners rather than chosen, which is why the claim is stated with no free choices.',
    claim: 'C6',
    layers: { pyramids: true, overlay: true, sky: false },
    camera: cameraFrom(GAP, 116, 25, 640),
  },
  {
    id: 'D2',
    title: 'The rectangle on the ground',
    text:
      "The rectangle runs from the Great Pyramid's north-east corner to Menkaure's south-west one, seen from high enough to hold all " +
      'three. Its two extents are divided by the royal cubit to reach the claimed round numbers, so the cubit is the free choice. Move ' +
      'the cubit slider and watch both residuals move together, which is what a free choice looks like from outside.',
    claim: 'D2',
    layers: { pyramids: true, overlay: true, sky: false },
    camera: cameraFrom(RECTANGLE, 135, 60, 1600),
  },
  {
    id: 'B1',
    title: 'The ghost Earth',
    text:
      'The ghost is the northern hemisphere drawn at the claimed scale, laid against the pyramid it is claimed to model. Two ' +
      'comparisons carry it: the height times the factor against the polar radius, the perimeter times the factor against the ' +
      'equatorial circumference. The factor, and which radius and which circumference it is measured against, are the free choices the ' +
      'pane lists.',
    claim: 'B1',
    layers: { pyramids: true, overlay: true, sky: false },
    camera: cameraFrom(G1, 90, 10, 600),
  },
  {
    id: 'dossier',
    title: 'Where the rest of it is',
    text:
      'That is the tour. Every claim in the panel is regenerated into docs/dossier.md, which states the same numbers without the model, ' +
      'and the reasoning behind all of it is in docs/plan.html beside it. The address bar has been keeping up the whole way, so ' +
      'whatever is on screen now is already a link.',
    claim: null,
    layers: { pyramids: true, ground: true, terrain: true, north: true, sky: false },
    camera: PLATEAU,
  },
];

/**
 * Play one step through the store.
 *
 * Two of the store's actions toggle rather than set, so both are called only
 * when the value is actually changing; the state handed in is what that is
 * decided from, so hand it a fresh one. The order matters in one place:
 * `setClaim` gives the epoch back to the claims, so the step's own epoch goes
 * on after it. A step with no section of its own is a step with no cut, and a
 * step with no epoch follows whichever claim it opens.
 */
export function applyStep(step: TourStep, store: ViewStore): void {
  if (store.claim !== step.claim) store.setClaim(step.claim);
  for (const [id, on] of Object.entries(step.layers) as [LayerId, boolean][]) {
    if (store.layers[id] !== on) store.toggleLayer(id);
  }
  store.setSection({ on: false, ...step.section });
  store.setEpoch(step.epoch ?? null);
  if (step.lst !== undefined) store.setLst(step.lst);
  store.showCamera(step.camera);
  store.setMode('orbit');
}
