/**
 * Five things a proponent says, ready to be put to the model. These are the
 * viewer's example buttons and the CLI's `--example` list, and they are the
 * fastest way to see what the runner does with a claim whose filed answer is
 * already in the register to compare against.
 *
 * Every one of them is a paraphrase written for this file, in the kind of
 * words the claim is usually made in, and none of them is a quotation from
 * anybody. What each is near, and what the runner ought to make of it, is said
 * beside it, so a reader can tell a good proposal from a plausible one without
 * going and reading the filed claim first.
 */
export interface RunnerExample {
  /** A short name, for the button and for anything that has to say which one this is. */
  id: string;
  title: string;
  /** The claim in the proponent's own kind of words. A paraphrase, never a quotation. */
  prose: string;
  /** The filed claim this stands nearest, so a proposal can be read against it. */
  near: string;
  /** What the runner ought to make of it, and where it might go wrong. */
  expect: string;
}

export const EXAMPLES: readonly RunnerExample[] = [
  {
    id: 'shafts',
    title: 'The shafts and Orion\'s belt',
    prose:
      'The shafts of the Great Pyramid are not air vents, they are sightlines. Around 2450 BCE, when the chambers were cut, the southern shaft of the King\'s Chamber pointed straight at Alnitak, the lowest star of Orion\'s belt, as it crossed the meridian, and the northern one at Thuban, the pole star of that age. The Queen\'s Chamber shafts did the same for Sirius and for Kochab. Four shafts, four stars, all in the one epoch.',
    near: 'C2',
    expect:
      'A sky claim at epoch -2449 with four comparisons, each a shaft angle against a star transit altitude in degrees, and at least the epoch and the assignment of a star to a shaft as free choices. Watch that it declares the epoch: without one the star keys do not exist and the runner will send it back.',
  },
  {
    id: 'leo',
    title: 'The lion and Leo in 10,500 BCE',
    prose:
      'The Sphinx is a lion and it stares due east, and there was one age when that made sense of itself: 10,500 BCE. On the morning of the spring equinox in that era Leo rose in the east just before the sun, so the lion on the ground was watching the lion in the sky come up ahead of the dawn. The monument is a clock set to its own First Time.',
    near: 'C5',
    expect:
      'A sky claim at an epoch near -10499 comparing Regulus\'s rising azimuth with due east, and its rising against the equinox sun\'s, both in degrees with an absolute tolerance rather than a percentage, because a target of zero or of ninety degrees is not a percentage question. The free choices should include the epoch, Regulus standing for the whole of Leo, and due east standing for a gaze the survey database does not carry.',
  },
  {
    id: 'hemisphere',
    title: 'A scale model of the northern hemisphere',
    prose:
      'The Great Pyramid is the northern hemisphere drawn at one to forty-three thousand two hundred. Take its height and multiply by 43,200 and you have the polar radius of the Earth. Take the perimeter of its base and multiply by the same number and you have the circumference at the equator. And 43,200 is not a number out of the air: it is 600 times 72, and 72 years is one degree of precession.',
    near: 'B1',
    expect:
      'An earth-scale claim with two comparisons in metres, height times 43,200 against `earth.radius.polar` and perimeter times 43,200 against `earth.circumference.equatorial`, with the scale factor and the choice of which of the Earth\'s radii to use listed as free choices. The runner must not do the multiplication: both sides stay as formulas.',
  },
  {
    id: 'orion',
    title: 'The site plan as Orion\'s belt',
    prose:
      'Look down on Giza and you are looking at Orion\'s belt. The three pyramids stand in the belt\'s pattern, and the smallest of them, Menkaure\'s, is set off the line of the other two exactly as Mintaka is set off the line of Alnitak and Alnilam. Run the sky back and the angle the belt makes with the meridian matches the angle of the pyramids\' diagonal in 10,450 BCE, and nowhere near it since.',
    near: 'C4',
    expect:
      'A sky claim at epoch -10449 with the belt\'s geometry on one side and the pyramids\' centre offsets on the other, in degrees and as a ratio. Right ascensions have to be differenced through `atan2(sin, cos)` to stay inside plus or minus 180 degrees. Expect the epoch, the north-south orientation of the sky map and the matching rule as free choices, and expect a looser tolerance than a proportion claim gets.',
  },
  {
    id: 'equinox',
    title: 'The equinox sun in the Sphinx\'s eyes',
    prose:
      'Whoever cut the Sphinx set it looking at the sunrise of the equinox. Twice a year, in March and September, the sun comes up out of the desert due east and the monument is looking straight into it. That is not an accident of the bedrock; it is what the thing was carved to do.',
    near: 'C5',
    expect:
      'A dated sky claim with one comparison, `sun.equinox.rise.azimuth` against 90 degrees, with an absolute tolerance in degrees rather than a percentage. The Sphinx\'s gaze is a free choice, because the database carries the Sphinx\'s position and not its axis, and the runner should say so in the notes rather than reach for a key that is nearly what it wanted.',
  },
];

/** The example the CLI's `--example N` names, counted from one as a person would. */
export function exampleAt(n: number): RunnerExample {
  const example = EXAMPLES[n - 1];
  if (!example) throw new Error(`there is no example ${n}; there are ${EXAMPLES.length}, numbered 1 to ${EXAMPLES.length}`);
  return example;
}
