/**
 * The exhibit's page: the stage full screen, a quiet caption band and the play controls. `?leaf=ch1-carved`
 * opens on a leaf (the first when none is named). A shot can still be picked by hand, outside the leaves:
 * `?station=sphinx-flank&era=today&yaw=285&pitch=10&fov=70&overlay=g1-proportions`.
 */
import './style.css';
import leavesJson from '../leaves.json';
import renderStations from '../../../render/stations.json';
import script from '../../../docs/script.md?raw';
import { type Leaf, type RenderStations, drawCue, leafPanorama, readLeaves, readReplyShots, withStandIns } from './leaves';
import { type Manifest, type Overlay, patchesByPanorama, pickEra, readManifest, readOverlays } from './manifest';
import { khafreWells } from './wells';
import { leafFromSearch, scriptChapters } from './play';
import sphinxPlan from 'virtual:sphinx-plan';
import skyData from 'virtual:sky';
import allanRank from 'virtual:allan-rank';
import luminescence from 'virtual:luminescence';
import radiocarbon from 'virtual:radiocarbon';
import texts from 'virtual:texts';
import { bce, kingListsSvg, rhind56, rhind56Svg } from './texts';
import { vultureChart, vultureChartSvg } from './vulturesky';
import heritage from '../../../data/places/world-heritage.json';
import { bestCircle } from './greatcircle';
import { ALISON, era, poolReply, poolSvg, strip, stripSvg } from './worldsites';
import { degreesToSeked } from '@seked/units';
import corridor from 'virtual:corridor';
import { allanRankSvg, relightSeismic, seismicSection, seismicSectionSvg, beltPlan, beltPlanSvg, ditchPlanSvg, earthScale, earthScaleSvg, jointClaimSvg, luminescenceSvg, radiocarbonSvg, corridorSvg, hawaraDepths, hawaraDepthsSvg, lookedDepths, lookedSvg, sekedRule, sekedRuleSvg, northDrift, northDriftSvg, driftExaggeration, claimSort, claimSortSvg, khafreDepths, khafreDepthsSvg, shortCite, northSquare, northSquareSvg, phiTriangle, phiTriangleSvg, piCircle, piCircleSvg, rankLine } from './figures';
import { Panel, loadBundle } from './panel';
import { TIER_WORDS, groundEnvironment, leafReceipts } from './receipts';
import { Ambient, bedFor } from './ambient';
import { Player } from './player';
import { poleStars, poleStarsSvg } from './polestars';
import { type Moment, comparisonsAt, epochOf, skyEnv, yearLabel } from './sky';
import { type Claim, formatResidual, formatValue } from '@seked/claims/browser';
import { SkyFigure } from './skyfigure';
import type { HeadsManifest, ObjectView } from './objectview';
import { DEG } from './projection';
import { pyramidObject } from './pyramidobject';
import { Stage } from './stage';
import { Explore, type ExploreBundle } from './explore';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** The walkthrough's files, where the site keeps them beside the exhibit. */
const WALK = new URL('../walk/', location.href);
const LEAVES = readLeaves(leavesJson);
const RENDER = renderStations as unknown as RenderStations;

async function json(name: string): Promise<unknown> {
  const r = await fetch(new URL(name, WALK), { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  return r.json();
}

/** A leaf's panorama, then the walkthrough's for its station and era until the laptop renders the leaf's own. */
const panoramasFor = (manifest: Manifest) => (L: Leaf): string[] => {
  const want = leafPanorama(L, RENDER);
  const own = manifest.byId[L.station]?.panoramas[L.era];
  return own && own !== want ? [want, own] : [want];
};

/** The belt over the pyramids at C4's epoch, its caption's numbers C4's own; without the bundle, a note saying so. */
function beltPlanFigure(ground: Record<string, number> | null): string {
  const epoch = epochOf('C4', skyData);
  const env = skyEnv(skyData, epoch);
  const at = (id: string) => ({ ra: env[`star.${id}.ra`] ?? NaN, dec: env[`star.${id}.dec`] ?? NaN });
  const plan = ground && beltPlan(ground, { alnitak: at('alnitak'), alnilam: at('alnilam'), mintaka: at('mintaka') });
  if (!plan) return '<figcaption>The plan of the pyramids is drawn from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  const [angle, offset] = comparisonsAt(skyData, 'C4', epoch, ground ?? {});
  const v = (c: typeof angle, k: 'value' | 'target') => (c && c[k] !== null ? formatValue(c[k]!, c.unit) : '?');
  return `${beltPlanSvg(plan)}<figcaption>The pyramids' centres from Petrie's offsets, and Orion's belt in ${yearLabel(epoch)} laid over
    them as seen looking south, Alnitak on Khufu, scaled so Mintaka falls as far off as Menkaure, and not turned. The belt
    stands ${v(angle, 'value')} from the meridian, the pyramids' diagonal ${v(angle, 'target')}. Menkaure sits ${v(offset, 'value')} of
    the Khufu to Khafre line off it, Mintaka ${v(offset, 'target')}. C4's comparisons; the north and south of the sky are
    swapped to lay it down, a free choice the claim records.</figcaption>`;
}

/** A1 drawn, its numbers the bundle's; without the bundle, a note saying so. */
function piCircleFigure(ground: Record<string, number> | null): string {
  const c = ground && piCircle(ground);
  if (!c) return '<figcaption>The pyramid is drawn from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  const m = (v: number) => formatValue(v, 'm');
  return `${piCircleSvg(c)}<figcaption>The Great Pyramid's base, ${m(c.perimeter)} round, and a circle whose radius is its
    original height, ${m(c.height)}: that circle is ${m(c.circle)} round. Perimeter over height is
    ${formatValue(c.perimeter / c.height, 'ratio')}, against 2π, ${formatValue(2 * Math.PI, 'ratio')} (A1).</figcaption>`;
}

/** C1 drawn, its orientation the bundle's and its exaggeration the claim's overlay's. */
function northSquareFigure(ground: Record<string, number> | null): string {
  const n = ground && northSquare(ground);
  const x = skyData.claims.C1?.exaggeration;
  if (!n || !x) return '<figcaption>The base is drawn from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  return `${northSquareSvg(n, x)}<figcaption>The base's sides run ${formatValue(Math.abs(n.orientation), 'deg')} ${n.orientation < 0 ? 'west' : 'east'} of
    true north (the grey square), here drawn ${x} times larger so it can be seen at all. On a side of ${formatValue(n.side, 'm')}, the far
    end strays ${formatValue(n.stray, 'm')} (C1).</figcaption>`;
}

/** North as a method: the three Giza pyramids' turns in building order, from their records, at C1's exaggeration. */
function northDriftFigure(ground: Record<string, number> | null): string {
  const n = ground && northDrift(ground);
  const x = skyData.claims.C1?.exaggeration;
  if (!n || !x) return '<figcaption>The needles are drawn from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  const k = driftExaggeration(n, x), steep = n.reduce((a, b) => (Math.abs(b.orientation) > Math.abs(a.orientation) ? b : a));
  return `${northDriftSvg(n, k)}<figcaption>No compass, but a method: each pyramid's sides against true north, in the order they were
    built, drawn ${k} times larger${k === x ? '' : ` (the north claim draws Khufu's ${x} times, which would tip ${steep.king}'s
    ${Math.round(Math.abs(steep.orientation) * x)} degrees)`}. Sneferu's
    three, Meidum, the Bent and the Red, close in on north; Khufu's is the smallest; after him it grows and swings east.
    Spence (2000) read that drift as the builders lining up two stars that circle the pole, one above the other: the stars
    slowly moved, so the error dates each pyramid. The first three are as Dash (2017) tabulates them from Petrie and Dorner,
    not yet checked against their pages; the Red Pyramid's is its east side alone.</figcaption>`;
}

/** Spence's two stars computed: the plumb line's stray by year, each pyramid's turn as a year, the radiocarbon beside. */
function poleStarsFigure(ground: Record<string, number> | null): string {
  // Giza's three only: Sneferu's would crowd the plot, and the caption reads Khufu first
  const n = ground && northDrift(ground)?.filter((x) => x.site === 'giza');
  const star = (id: string) => skyData.named.find((s) => s.id === id);
  const mizar = star('mizar'), kochab = star('kochab');
  const p = n && mizar && kochab && poleStars(mizar, kochab, skyData.latitudeDeg, n, radiocarbon.reigns);
  if (!p) return '<figcaption>The pyramids\' turns are drawn from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  const y = (v: number | null) => (v === null ? 'never' : yearLabel(v));
  const khufu = p.readings[0]!, r = p.reigns.find((k) => k.king === khufu.king);
  // how far the radiocarbon range sits before the stars' two years for the same king, nearest and furthest
  const read = [khufu.upper, khufu.lower].filter((v): v is number => v !== null);
  const gap = r && read.length ? [Math.min(...read) - r.latest, Math.max(...read) - r.earliest].map((v) => Math.round(v / 10) * 10) : null;
  const apart = gap && gap[0]! > 0 ? ` Radiocarbon puts ${r!.king}'s accession at ${yearLabel(r!.earliest)} to ${yearLabel(r!.latest)},
    ${gap[0]} to ${gap[1]} years earlier: the method and the dating do not yet agree.` : r ? ` Radiocarbon puts ${r.king}'s accession
    at ${yearLabel(r.earliest)} to ${yearLabel(r.latest)}.` : '';
  return `${poleStarsSvg(p)}<figcaption>Spence (2000): hang a plumb line so Mizar and Kochab sit on it, one above the pole and one
    below, and call it north. Computed here from the star catalogue, the line is true north only in ${yearLabel(p.aligned)}; before
    and after, it strays (solid with Mizar above, dashed with Kochab above). Read each pyramid's turn off it and the stars date
    ${khufu.king} to ${y(khufu.upper)} or ${y(khufu.lower)}, by which star was above, a free choice of the reading.${apart}</figcaption>`;
}

/** A2 drawn, with A3's point that one slope serves π, φ and the seked alike. */
function phiTriangleFigure(ground: Record<string, number> | null): string {
  const t = ground && phiTriangle(ground);
  if (!t) return '<figcaption>The pyramid is drawn from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  const phi = (1 + Math.sqrt(5)) / 2;
  return `${phiTriangleSvg(t)}<figcaption>Inside the Great Pyramid: half the base ${formatValue(t.half, 'm')}, the height
    ${formatValue(t.height, 'm')}, the apothem down the face ${formatValue(t.apothem, 'm')}. Apothem over half the base is
    ${formatValue(t.apothem / t.half, 'ratio')}, against φ, ${formatValue(phi, 'ratio')} (A2). The face rises at
    ${formatValue(t.angle, 'deg')}, and the slopes a seked of 5½, π and φ each give all lie within about a minute of arc of
    it, so the survey cannot tell them apart (A3).</figcaption>`;
}

/** B1 drawn: its scale factor and free choices the claim's, its two comparisons evaluated as the receipts are. */
function earthScaleFigure(b: Bundle | null, ground: Record<string, number> | null): string {
  const claim = b?.claims.find((c) => c.id === 'B1');
  const e = ground && claim && earthScale(ground, Number(claim.overlay?.params?.scale));
  const result = b && e ? leafReceipts(b, b.claims, ['B1'])[0] : undefined;
  if (!claim || !e || !result) return '<figcaption>The Earth is drawn from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  const km = (m: number) => `${(m / 1000).toLocaleString('en-GB', { maximumFractionDigits: 0 })} km`;
  const [height, perimeter] = result.comparisons;
  const line = (c: typeof height, what: string, against: string) => c
    ? `${what} ${km(c.value)} against ${against}, ${km(c.targetValue)}: off by ${formatResidual(c)}` : '';
  return `${earthScaleSvg(e)}<figcaption>The Great Pyramid ${e.scale.toLocaleString('en-GB')} times larger, its apex at the pole.
    ${line(height, 'Its height becomes', 'the polar radius')}; ${line(perimeter, 'its perimeter', 'the equator')}. B1's free
    choices: ${claim.free_choices.join('; ')}.</figcaption>`;
}

/** What the pyramid in the hand shows, its numbers A1's and A2's from the bundle. */
function pyramidCaption(ground: Record<string, number>): string {
  const c = piCircle(ground), t = phiTriangle(ground);
  if (!c || !t) return '';
  return `The Great Pyramid from the survey's base and height, to turn in the hand. On the ground, a circle whose radius is
    its height: ${formatValue(c.circle, 'm')} round, against the base's ${formatValue(c.perimeter, 'm')} (A1). Cut through its south
    face, half the base, the height and the apothem, ${formatValue(t.apothem / t.half, 'ratio')} times half the base (A2). The grey line
    is true north.`;
}

/** The temples' luminescence dates, from their records. */
function luminescenceFigure(): string {
  const d = luminescence;
  const unchecked = d.dates.some((x) => !x.verified);
  return `${luminescenceSvg(d)}<figcaption>Surface luminescence dates: when each stone's face last saw daylight, by
    the method of ${shortCite(d.citation)}.${unchecked ? " Not yet checked against the paper's table." : ''}</figcaption>`;
}

/** The first king's accession and four later ones, from their records: the reply's dates, which need no text. */
function radiocarbonFigure(): string {
  const d = radiocarbon;
  const unchecked = d.reigns.some((r) => !r.verified);
  const cites = Object.values(d.citations).map(shortCite).join(' and ');
  return `${radiocarbonSvg(d)}<figcaption>When five kings came to the throne, by radiocarbon: 95 per cent ranges from ${cites}.
    The first is Aha, Egypt's first king; the dot is the median. Khufu's, Khafre's and Unas's are placed by the model from
    reign lengths, not dated directly.${unchecked ? " Not yet checked against the papers' tables." : ''}</figcaption>`;
}

/**
 * Where the answer is: the Great Pyramid as an x-ray with its known rooms, the 2017 Big Void's band and the 2023
 * corridor in gold (render/khufu_section.py; scripts/exhibit_section.py writes the labelled picture into objects/).
 */
function khufuSectionFigure(): string {
  return `<span class="tier instrumented">Instrumented: ${TIER_WORDS.instrumented}</span><img class="wide" src="objects/khufu-section.jpg" alt="The Great Pyramid drawn see-through from the west: its passages and chambers, a pale blue band for the Big Void above the Grand Gallery, and a small gold box behind the north face for the corridor">
    <figcaption>Drawn see-through: the rooms as Petrie surveyed them; in gold the corridor, 20 m up behind the chevron
    stones (Procureur and others 2023); in blue the band the Big Void lies in, its shape unknown (Morishima and others
    2017). How far across the pyramid the corridor sits is our drawing choice.</figcaption>`;
}

/** The model answer: the north-face corridor as its paper measured it, every figure with its error bar. */
function corridorFigure(): string {
  const d = corridor;
  return `${corridorSvg(d)}<figcaption>The corridor behind the Great Pyramid's north face, found by muon imaging and
    seen through an endoscope; ${d.across.value.toFixed(2)} &#177; ${d.across.sigma.toFixed(2)} m across, east to west.
    ${shortCite(d.citation)}, ${d.verified ? 'checked against the paper' : 'not yet checked'}. The Sphinx's claimed cavity
    has no comparable figures at all.</figcaption>`;
}

/** Chapter 1's floor: the weathered layer Schoch reads under the ditch, deeper in front than behind, from the records. */
function seismicSectionFigure(ground: Record<string, number> | null, lit: 'front' | 'rear' | null = null): string {
  const d = ground && seismicSection(ground);
  if (!d) return '<figcaption>The depths are drawn from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  return `${seismicSectionSvg(d, 640, lit)}<figcaption>Under the ditch floor, by seismic refraction (Dobecki and Schoch, 1992): the rock
    weathered ${d.front[0]} to ${d.front[1]} m deep in front and along the sides, about ${d.rear} m behind the rump, depths as
    Schoch reported them and Reader repeats them, not yet checked against the paper. Depths to scale; the statue is not.</figcaption>`;
}

/** Chapter 8's depths: the pyramid, its rooms and the claimed wells to one scale, from the claims' environment. */
function khafreDepthsFigure(ground: Record<string, number> | null, structures?: StructureNote[]): string {
  const d = ground && khafreDepths(ground);
  if (!d) return '<figcaption>The depths are drawn from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  return `${khafreDepthsSvg(d)}<figcaption>To one scale: Khafre's pyramid, its rooms ${-d.rooms} m under the base, and, dashed,
    one of the two rows of wells and the two chambers ${formatValue(d.cube, 'm')} on a side, as the Khafre Project describes
    them (a claim, not yet checked against its publication). Where they stand under the base is a look choice. ${-d.bottom} m
    is ${(-d.bottom / d.height).toFixed(2)} times the pyramid's original height.${d.osiris !== undefined && d.paw !== undefined ? ` Beside
    them, from their own ground by the Sphinx: the Osiris Shaft, dug, about ${d.osiris} m, and the cavity Dobecki and Schoch read
    under the paws, never dug, about ${d.paw} m; neither figure yet checked against its page.` : ''} ${ifItHeld(structures, ['g2.sar-shafts'])}</figcaption>`;
}

/**
 * The claim sawn open, as rendered (render/underground.py --style solid; scripts/exhibit_cutaway.py writes the two
 * pictures into objects/), and beside it the retraction of the method's only peer-reviewed paper. The figures in the
 * words come from the records, so a changed record changes the caption, never a picture alone.
 */
function khafreCutawayFigure(ground: Record<string, number> | null, structures?: StructureNote[]): string {
  const d = ground && khafreDepths(ground);
  const claim = d
    ? `${d.wells} wells in ${d.rows} rows, wound by spirals, falling ${-d.bottom} m, ${(-d.bottom / d.height).toFixed(2)} times the
      pyramid's height (the white triangles), to ${d.cubes} chambers ${formatValue(d.cube, 'm')} on a side`
    : 'Eight wells wound by spirals, falling to two great chambers';
  return `<div class="cutaway">
    <img class="cutaway-main" src="objects/khafre-cutaway.jpg" alt="The plateau under Khafre's pyramid sawn open: the claimed wells and a chamber as hollows in the rock, outlined in orange">
    <div class="cutaway-side">
      <img src="objects/khafre-cutaway-top.jpg" alt="Close under the pyramid: four half-wells, each wound by a spiral groove">
      <aside class="retracted"><strong>Retracted</strong>The method's only peer-reviewed paper (Biondi and Malanga 2022,
        <i>Remote Sensing</i>, on Khufu's pyramid) was retracted on 10 August 2026 for "serious methodological flaws and
        statistical errors". The authors disagree. The Khafre wells were never in a paper: they come from the team's
        conference abstract of March 2025.</aside>
    </div>
  </div><figcaption>The claim, sawn open to scale: ${claim}, as the Khafre Project describes them. The cut runs through
    one row; every claimed hollow is outlined in orange. Where the wells stand and how the spirals wind are our look
    choices, after the team's own rendering. ${ifItHeld(structures, ['g2.sar-shafts'])}</figcaption>`;
}

/**
 * The finale's pictures, in order: the exhibit's strongest shots from the Sphinx today, back through its eras and out
 * to the other sites, and home to the Sphinx. Detail patches are the walkthrough's (pano/patch/), cards the exhibit's
 * own objects/. A look choice, after "the ending is kind of abrupt" (Stewart, 28 October).
 */
const FINALE: [string, string][] = [
  ['patch:sphinx-today-equinox-dawn-ch0-t01.jpg', 'The Sphinx today'],
  ['patch:sphinx-flank-lion-equinox-dawn-ch0-t02.jpg', 'Worn, as Schoch reads it, by rain'],
  ['patch:sphinx-face-first-time-equinox-dawn-ch7-schoch.jpg', 'A lion first, as Hancock tells it'],
  ['patch:panorama-first-time-summer-evening-ch7-cold.jpg', 'The First Time, c. 10,500 BCE'],
  ['patch:south-built-golden-south-ch6-measure.jpg', 'Khufu cased, c. 2560 BCE'],
  ['patch:valley-temple-built-temple-morning-ch0-t04.jpg', 'The Valley Temple'],
  ['objects:hawara-labyrinth.jpg', 'The Labyrinth, as Herodotus told it'],
  ['objects:gobekli-today.jpg', 'Göbekli Tepe'],
  ['objects:khufu-section.jpg', 'The corridor: an answer'],
  ['patch:sphinx-quarter-today-equinox-dawn-ch2-nemes.jpg', 'The ditch floor: where to look'],
];
const FINALE_EACH_MS = 3200;

/** After the last leaf and its reply: the strongest shots in turn, then the title and the ways on. */
function finale(again: () => void, explore: () => void): void {
  const root = $('finale'), pics = $('finale-pics');
  const src = (ref: string) => {
    const [where, file] = ref.split(':') as [string, string];
    return where === 'patch' ? new URL(`pano/patch/${file}`, WALK).href : `objects/${file}`;
  };
  pics.innerHTML = FINALE.map(([ref, words]) => `<figure><img src="${src(ref)}" alt=""><figcaption>${words}</figcaption></figure>`).join('');
  const frames = [...pics.querySelectorAll('figure')];
  root.classList.remove('done');
  root.hidden = false;
  let k = 0, timer = 0;
  const step = () => {
    frames.forEach((f, i) => f.classList.toggle('on', i === k));
    if (k < frames.length - 1) { k++; timer = window.setTimeout(step, FINALE_EACH_MS); }
    else timer = window.setTimeout(() => root.classList.add('done'), FINALE_EACH_MS * 0.6);
  };
  step();
  const close = () => { clearTimeout(timer); root.hidden = true; document.removeEventListener('keydown', onKey); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  $('finale-again').onclick = () => { close(); again(); };
  $('finale-explore').onclick = () => { close(); explore(); };
}

/**
 * The Labyrinth at Hawara as one reconstruction draws it (render/hawara_labyrinth.py; scripts/exhibit_labyrinth.py
 * writes the pictures into objects/), labelled with its tier: legendary, told and never found. `lower` shows the pit
 * dug through its eastern courts to the underground half, ghosted.
 */
function hawaraLabyrinthFigure(lower: boolean): string {
  const tier = `<span class="tier legendary">Legendary: ${TIER_WORDS.legendary}</span>`;
  return lower
    ? `${tier}<img class="wide" src="objects/hawara-labyrinth-under.jpg" alt="The reconstructed Labyrinth with a pit cut through its eastern courts, a pale ghost of its lower storey standing in it">
      <figcaption>The underground half, ghosted: Herodotus's 1,500 rooms below the ground, which he was not shown and
      reports from hearsay. They are drawn on the upper storey's plan at 8 to 12 m down, the depths the 2008 expedition's
      organiser gives for walls it reports and has not published. The pit is a device to show them.</figcaption>`
    : `${tier}<img class="wide" src="objects/hawara-labyrinth.jpg" alt="A reconstruction of the Labyrinth at Hawara from the air: twelve courts of rooms and columns inside a maze-walled enclosure, the pyramid beyond">
      <figcaption>A reconstruction, not a find: Herodotus's twelve courts, six either side of an avenue, inside one wall
      with a maze-like corridor, drawn after Luigi Canina's restored plan of 1839-44, the plan on the 2008 expedition's
      report, and laid on the footprint Petrie measured, 1000 by 800 feet of quarried chips south of
      Amenemhat III's pyramid. Heights are our choice; the roofs, which Herodotus says were stone, are left off so the
      plan shows.</figcaption>`;
}

/**
 * Göbekli Tepe in chapter 7 (render/gobekli.py; scripts/exhibit_gobekli.py writes the pictures into objects/): the
 * excavation today as its photogrammetry scan, and Enclosure D about 9500 BCE as built from its plan, the ring, Pillar
 * 43 and the central pair. Excavated, so dug and dated; the pictures are reconstructions and say which parts are ours.
 */
function gobekliFigure(id: string, ground: Record<string, number> | null): string {
  const tier = `<span class="tier excavated">Excavated: ${TIER_WORDS.excavated}</span>`;
  const h = ground?.['gobekli.enclosure_d.pillars.central.height'];
  const cards: Record<string, [string, string]> = {
    'gobekli-today': ['A hill with a long excavation in it, the pillars of the enclosures showing in the trench',
      `Göbekli Tepe today, from the air: the main excavation as a photogrammetry scan (rmark, CC BY 4.0), set on its
      hill. The scan's form is a visual stand-in, not a survey; the land round it is ours.`],
    'gobekli-scan': ['An excavated enclosure of T-shaped stone pillars in a dug-out trench, two braced with timber in the middle, a dry plain beyond',
      `Enclosure D as it stands today, from the rim to its south: the photogrammetry scan of the excavation (rmark, CC BY
      4.0), its central pair braced with timber, the ring of pillars round them in their stone wall. The scan's form is a
      visual stand-in, not a survey; the land round it is ours.`],
    'gobekli-ring': ['A ring of T-shaped stone pillars set in a curving stone wall, two taller pillars in the middle, on a green hillside',
      `Enclosure D about 9500 BCE, built here from its excavated plan (Haklay and Gopher 2020): eleven pillars set in a
      stone wall round a central pair. Where the pillars stand is the plan's; the wall pillars' height, the stone, the
      carving and the land are our choices.`],
    'gobekli-p43': ['A T-shaped pillar carved with a vulture, a disc above its wing and other animals, set into a stone wall',
      `Pillar 43, the "Vulture Stone", carved from the excavators' drawing: a vulture with a disc above its wing, birds, a
      scorpion, on the pillar's western broad side. Part of the face runs into the wall, as the excavators describe it.
      How deep the carving stands is our choice.`],
    'gobekli-pair': ['Two tall T-shaped pillars seen from between them, carved with arms and belts, the ring wall behind',
      `The central pair, Pillars 18 and 31, ${h ? `${formatValue(h, 'm')} tall` : 'over five metres tall'} on their
      bedrock pedestals, carved with arms, hands and belts: figures, the excavators say, not posts. The carving is
      after the excavators' drawings; its depth is ours.`],
  };
  const [alt, caption] = cards[id]!;
  return `${tier}<img class="wide" src="objects/${id}.jpg" alt="${alt}"><figcaption>${caption}</figcaption>`;
}

/**
 * Karahan Tepe in chapter 7 (render/karahan.py renders the two scans in blender/models.json): the site and Structure
 * AB. Excavated; the scans are other people's, credited, and their form is a stand-in, not a survey.
 */
function karahanFigure(id: string): string {
  const tier = `<span class="tier excavated">Excavated: ${TIER_WORDS.excavated}</span>`;
  const cards: Record<string, [string, string]> = {
    'karahan-site': ['An excavated hilltop seen from the air: a round sunken enclosure, trenches and a rock-cut room beside it',
      `Karahan Tepe today, 37 km from Göbekli Tepe: the excavation as a scan made from drone video (333DDD, CC BY 4.0).
      The scan's form is a visual stand-in, not a survey.`],
    'karahan-ab': ['A room cut down into the bedrock, a dozen stone pillars rising from its floor and a carved head jutting from its wall',
      `Structure AB, cut into the bedrock: pillars left standing from the rock of its floor, and a head looking out of
      its wall, about the same age as Göbekli Tepe's enclosures (Karul 2021). A photogrammetry scan (Megalithomania,
      CC BY-NC-SA 4.0); its form is a stand-in, not a survey.`],
  };
  const [alt, caption] = cards[id]!;
  return `${tier}<img class="wide" src="objects/${id}.jpg" alt="${alt}"><figcaption>${caption}</figcaption>`;
}

type StructureNote = { id: string; evidence?: string; if_it_held?: string };

/** What reported structures would change if they held, from data/structures.json, as one sentence each. */
function ifItHeld(structures: StructureNote[] | undefined, ids: string[]): string {
  return ids.map((id) => structures?.find((s) => s.id === id)?.if_it_held).filter(Boolean).join(' ');
}

/** How a figure draws each tier, in the plain words of the tone rule, for the tiers it shows. */
function tierKey(tiers: string[]): string {
  const look: Record<string, string> = { excavated: 'stone', instrumented: 'blue', claimed: 'dashed', legendary: 'ghosted' };
  return [...new Set(tiers)].filter((t): t is keyof typeof TIER_WORDS => t in TIER_WORDS)
    .map((t) => `${look[t]}, ${TIER_WORDS[t]}`).join('; ');
}

/** Hawara's depths to one scale, each by its structure's tier, from the claims' environment. */
function hawaraDepthsFigure(ground: Record<string, number> | null, structures: StructureNote[] | undefined): string {
  const rows = ground && structures && hawaraDepths(ground, structures);
  if (!rows) return '<figcaption>The depths are drawn from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  return `${hawaraDepthsSvg(rows)}<figcaption>Under Hawara, in metres below the ground: the bed of chips Petrie dug at the
    south foot, the two closures a resistivity survey found, and the walls the 2008 expedition reported, never dug. Drawn
    by tier, from the records: ${tierKey(rows.map((r) => r.tier))}. ${ifItHeld(structures, ['hawara.mataha-walls'])}</figcaption>`;
}

/** How deep anyone has looked beside each claimed depth, from the records; with `tests`, chapter 9's test for each. */
function lookedFigure(ground: Record<string, number> | null, structures: StructureNote[] | undefined, tests: boolean): string {
  const rows = ground && structures && lookedDepths(ground, structures);
  if (!rows) return '<figcaption>The depths are drawn from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  return `${lookedSvg(rows, tests)}<figcaption>How deep has anyone looked? Each claim, dashed, beside the deepest anyone has dug
    or drilled there, on a scale that grows tenfold at each mark. The 2008 boreholes stand beside the cavity, not in it, and their logs are unpublished; the 1978
    holes into the Sphinx's anomalies left no depth on record. The claims, dashed: ${[...new Set(rows.map((r) => TIER_WORDS[r.tier as keyof typeof TIER_WORDS] ?? r.tier))].join('; ')}. ${tests ? 'Below each, the test chapter 9 names. ' : ''}From the
    records, none yet checked against its page.${tests ? ` The paw cavity: ${ifItHeld(structures, ['sphinx.paw-cavity']).replace(/^If/, 'if')}` : ''}</figcaption>`;
}

/** The builders' rule, A3's seked at the Great Pyramid's size, with A3's three comparisons live from the bundle. */
function sekedRuleFigure(b: Bundle | null, ground: Record<string, number> | null): string {
  const result = b && ground ? leafReceipts(b, b.claims, ['A3'])[0] : undefined;
  const r = result && ground && sekedRule(ground, result.comparisons[0]!.targetValue);
  if (!result || !r) return '<figcaption>The rule is drawn from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  const line = (c: (typeof result.comparisons)[number]) => `${c.label.replace('measured angle against ', '')}, ${formatValue(c.targetValue, 'deg')}: off by ${formatResidual(c)}`;
  return `${sekedRuleSvg(r)}<figcaption>The builders' rule: a slope given as palms of run for a cubit of rise. The measured face,
    ${formatValue(result.comparisons[0]!.value, 'deg')}, against three slopes (A3): ${result.comparisons.map(line).join('; ')}.
    ${result.comparisons.every((c) => c.within) ? 'All three hold' : 'Not all hold'}, with ${result.freeChoices} free choices, so the survey cannot tell
    them apart; only the seked is attested in Egyptian mathematics. But the papyri that teach it are centuries younger than
    the pyramid: no mathematical papyrus survives from the pyramid age itself.</figcaption>`;
}

/** The king lists' years before the first king, counted back from his radiocarbon accession: chapter 4's beat. */
function kingListsFigure(): string {
  const d = texts.kingLists;
  const [turin, summed, manetho] = d.spans;
  const unchecked = d.spans.some((s) => !s.verified) || !d.anchor.verified;
  return `${kingListsSvg(d)}<figcaption>The years the king lists give before the first king, counted back from Aha's accession
    (the radiocarbon median, ${shortCite(d.citations[d.anchor.source]!)}). The Turin papyrus, ${turin!.locus.split(' (')[0]}: ${turin!.years.toLocaleString('en-GB')} + x
    years; added to the next line's total, as Schwaller de Lubicz adds them (dashed: the sum is not on the papyrus),
    ${summed!.years.toLocaleString('en-GB')} + x. Manetho, as Eusebius preserves him: ${d.lunar.toLocaleString('en-GB')} "lunar years", which
    Eusebius himself makes ${manetho!.years.toLocaleString('en-GB')}. "+ x" marks a damaged total, read as at least that. None lands on the line at
    ${bce(d.epoch)}.${unchecked ? ' Read from the transcriptions, not yet checked against the editions.' : ''}</figcaption>`;
}

/** Rhind problem 56 in the scribe's steps, beside the Great Pyramid's seked from A3's target. */
function rhindFigure(b: Bundle | null): string {
  const result = b ? leafReceipts(b, b.claims, ['A3'])[0] : undefined;
  if (!result) return '<figcaption>The problem is set beside A3, from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  const r = rhind56(texts.rhind, degreesToSeked(result.comparisons[0]!.targetValue));
  return `${rhind56Svg(r)}<figcaption>A schoolroom problem, as the papyrus sets it: find the seked of a pyramid from its base
    and height. The scribe halves the base, divides by the height, and writes the answer in unit fractions, as Egyptians
    wrote every fraction. Khufu's builders worked to a seked of ${r.khufuSeked.toFixed(1).replace('.5', '½')} palms. The papyrus is a copy made centuries
    after the pyramids. Its figures after ${shortCite(texts.rhindCitation)}'s summary of Chace's edition${r.verified ? '' : ', not yet checked against the edition'}.</figcaption>`;
}

/** C8: Pillar 43's animals as Sweatman and Tsikritsis read them, on the sky of their date, with the miss computed. */
function vultureFigure(): string {
  const v = vultureChart(skyData);
  if (!v) return '';
  const pairs = v.figures.map((f) => `${f.animal} as ${f.name}`).join(', ');
  return `${vultureChartSvg(v)}<figcaption>Pillar 43 read as a sky, as Sweatman and Tsikritsis read it in 2017: ${pairs}, and the
    disc above the vulture's wing as the sun at the summer solstice, which they date to ${bce(v.epoch)} by the sun standing just
    above the teapot's spout. Computed here from the catalogue and the precession of that year, the solstice sun stands
    ${Math.abs(v.residual).toFixed(1)}&#176; of longitude ${v.residual > 0 ? 'west' : 'east'} of the spout; the receipt weighs that against the paper's own 250 years. The pairings are the
    claim's own choices; the excavators read the animals as Göbekli Tepe's own world. The relief itself is not drawn yet.</figcaption>`;
}

/** E26: Hancock's circle of world wonders as Jim Alison draws it, and the reply from the World Heritage List. */
function greatCircleFigure(ground: Record<string, number> | null): string {
  const radius = ground?.['earth.radius.mean'];
  if (radius === undefined) return '<figcaption>The circle is measured in kilometres from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  const km = (radius * DEG) / 1000, s = strip(ALISON.sites);
  const pool = heritage.properties.map(([, , lat, lon]) => ({ lat: lat as number, lon: lon as number }));
  const r = poolReply(s.fit.pole, pool, 0.25, 2000);
  const far = s.fit.offsets.reduce((m, o, i) => (Math.abs(o) > Math.abs(s.fit.offsets[m]!) ? i : m), 0);
  const own = bestCircle(ALISON.sites.map((x) => x.own));
  const years = ALISON.sites.flatMap((x) => [x.years.from, x.years.to]).filter((y): y is number => y !== null);
  return `${stripSvg(s, km)}${poolSvg(r)}<figcaption>Hancock's circle of world wonders, after Jim Alison: his ${ALISON.sites.length} sites
    off the circle that fits them best, ${ALISON.sites[far]!.name} the farthest at ${Math.round(Math.abs(s.fit.offsets[far]!) * km)} km, and when each was made, from
    ${era(Math.min(...years))} to ${era(Math.max(...years))}. The reply: of the World Heritage List's ${pool.length} cultural sites, his circle
    passes within a quarter of a degree of ${r.claim}; a random circle passes about ${Math.round(r.mean)}, and ${Math.round(r.share * 100)} in a hundred
    pass as many. His coordinates; on each site's own (from encyclopedias) the sites lie ${Math.round(own.rms * km)} km off their circle
    on average, not ${Math.round(s.fit.rms * km)}. None yet checked against its page; the List's points from Wikidata.</figcaption>`;
}

/** Chapter 6's claims as the engine sorts them, from the bundle: the receipts of every one the chapter names. */
function claimSortFigure(b: Bundle | null): string {
  if (!b) return '<figcaption>The claims are sorted from the bundled database (pnpm bundle), which this copy of the site lacks.</figcaption>';
  const ids = [...new Set(LEAVES.filter((L) => L.chapter === 6).flatMap((L) => L.receipts))];
  const s = claimSort(leafReceipts(b, b.claims, ids));
  return `${claimSortSvg(s)}<figcaption>Every claim in this chapter, as the engine sorts it from the survey. A number beside a claim
    counts what had to be chosen first (a unit, a factor, an epoch) before it held. The more there are, the less a match
    says.</figcaption>`;
}

/** The 2026 study's shape test, cited from its records, quietly. */
function allanRankFigure(): string {
  const d = allanRank;
  const journal = /\)\. [^.]+\. ([^.]+)\./.exec(d.citation)?.[1] ?? d.citation;
  return `${allanRankSvg(d)}<figcaption>${rankLine(d)}. ${journal}.${d.verified ? '' : " Not yet checked against the paper's table."}</figcaption>`;
}

type Bundle = Parameters<typeof groundEnvironment>[0] & { claims: Claim[] };

async function start(): Promise<void> {
  const status = $('status');
  const fail = (msg: string) => { status.textContent = msg; status.hidden = false; };
  let manifest: Manifest, overlays: Record<string, Overlay>, leafPatches: unknown;
  try {
    // the exhibit's own detail patches are published once the laptop renders them; until then there are none
    [manifest, overlays, leafPatches] = await Promise.all([json('stations.json').then(readManifest), json('overlays.json').then(readOverlays, () => ({})),
      json('exhibit-patches.json').catch(() => null)]);
  } catch (e) {
    console.error(e);
    return fail('The exhibit could not load its stations. Reload to try again.');
  }
  const stage = new Stage($('stage'), $<HTMLCanvasElement>('view'), $<HTMLCanvasElement>('ink'), $('flat'), manifest, overlays, WALK);
  stage.setPatches(patchesByPanorama(manifest, leafPatches));
  stage.onStatus = (s) => {
    status.hidden = s === 'ready';
    status.textContent = s === 'loading' ? 'Loading the panorama' : s === 'missing' ? 'This view has not been rendered yet.' : s === 'error' ? 'The panorama did not load. Reload to try again.' : '';
  };

  const q = new URLSearchParams(location.search);
  if (q.has('station')) {
    const st = manifest.byId[q.get('station')!];
    if (!st) return fail('There is no such station.');
    const era = pickEra(manifest, st, q.get('era'));
    if (!era) return fail(`${st.name} has no panoramas yet.`);
    const deg = (k: string) => { const v = q.get(k); return v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) * DEG : undefined; };
    const state = manifest.stateById[era];
    $('place').textContent = st.name;
    $('when').textContent = state ? `${state.title}, ${state.label}` : era;
    $('caption').textContent = st.where;
    stage.show({ station: st, era, yaw: deg('yaw'), pitch: deg('pitch'), fov: deg('fov'), overlay: q.get('overlay') });
    return;
  }

  const leaves = withStandIns(LEAVES, (id) => !!manifest.byId[id]);
  leaves.forEach((L, i) => { if (L.station !== LEAVES[i]!.station) console.info(`${L.id}: ${LEAVES[i]!.station} is not rendered yet; ${L.station} stands in`); });
  const missing = leaves.find((L) => !manifest.byId[L.station]);
  if (missing) return fail(`The leaf ${missing.id} stands at ${missing.station}, which the walkthrough does not have.`);
  const player = new Player(stage, manifest, leaves, scriptChapters(script), {
    caption: $('caption'), place: $('place'), when: $('when'), pill: $('pill'),
    play: $<HTMLButtonElement>('play'), prev: $<HTMLButtonElement>('prev'), next: $<HTMLButtonElement>('next'),
    chapterBtn: $<HTMLButtonElement>('chapter'), chapterList: $('chapter-list'), count: $('count'), flight: $<HTMLVideoElement>('flight'),
  }, panoramasFor(manifest));
  player.replyShots = readReplyShots(leavesJson);
  const panel = new Panel($('stage'), script);
  const sky = new SkyFigure(stage, skyData, (RENDER as unknown as { moments: Record<string, Moment> }).moments, $('skybar'));
  sky.onHandsOn = () => { if (player.playing) player.pause(); };
  // a sky claim's lines and targets that read the monuments wait for the bundled database
  let ground: Record<string, number> | null = null;
  let bundle: Bundle | null = null;
  let shownFigure: string | null = null;
  void loadBundle().then((b) => {
    if (!b) return;
    ground = groundEnvironment(b);
    bundle = b as Bundle;
    sky.setGround(ground);
    // lines in the scene drawn from the records, beside the renders' own; a leaf already showing one is shown again
    const wells = khafreWells(ground);
    if (wells) {
      overlays['khafre-wells'] = wells;
      if (player.leaf.draw[0] && drawCue(player.leaf.draw[0]).overlay === 'khafre-wells' && !player.playing) stage.show(player.shot(player.leaf));
    }
    // a figure drawn from the monuments before they loaded is drawn again with them
    if (shownFigure === 'belt-plan') figure.innerHTML = beltPlanFigure(ground);
    if (shownFigure === 'seismic-section') figure.innerHTML = seismicSectionFigure(ground);
    if (shownFigure === 'great-circle') figure.innerHTML = greatCircleFigure(ground);
    if (shownFigure === 'pi-circle') figure.innerHTML = piCircleFigure(ground);
    if (shownFigure === 'north-square') figure.innerHTML = northSquareFigure(ground);
    if (shownFigure === 'phi-triangle') figure.innerHTML = phiTriangleFigure(ground);
    if (shownFigure === 'earth-scale') figure.innerHTML = earthScaleFigure(bundle, ground);
    if (shownFigure === 'khafre-depths') figure.innerHTML = khafreDepthsFigure(ground, bundle?.structures);
    if (shownFigure === 'khafre-cutaway') figure.innerHTML = khafreCutawayFigure(ground, bundle?.structures);
    if (shownFigure === 'seked-rule') figure.innerHTML = sekedRuleFigure(bundle, ground);
    if (shownFigure === 'rhind-56') figure.innerHTML = rhindFigure(bundle);
    if (shownFigure === 'north-drift') figure.innerHTML = northDriftFigure(ground);
    if (shownFigure === 'pole-stars') figure.innerHTML = poleStarsFigure(ground);
    if (shownFigure === 'claim-sort') figure.innerHTML = claimSortFigure(bundle);
    if (shownFigure === 'hawara-depths') figure.innerHTML = hawaraDepthsFigure(ground, bundle?.structures);
    if (shownFigure === 'looked' || shownFigure === 'looked-tests') figure.innerHTML = lookedFigure(ground, bundle?.structures, shownFigure === 'looked-tests');
    if (player.leaf.interact === 'object:pyramid') objectFor(player.leaf);
  });
  // an object in the hand: three.js loads only when a leaf asks for one, and only once what it shows exists (the
  // heads' export from the laptop, the pyramid's monuments from the bundle); until then the leaf is its panorama
  let view: Promise<ObjectView> | null = null;
  const objectView = () => (view ??= import('./objectview').then(({ ObjectView: View }) => new View($('stage'), new URL('objects/', location.href))));
  const hideObject = () => { void view?.then((v) => v.hide()); };
  let heads: Promise<HeadsManifest | null> | null = null;
  const loadHeads = () => (heads ??= (async () => {
    const r = await fetch(new URL('objects/heads.json', location.href)).catch(() => null);
    return r?.ok && (r.headers.get('content-type') ?? '').includes('json') ? ((await r.json()) as HeadsManifest) : null;
  })());
  const objectFor = (L: Leaf) => {
    const id = L.interact.startsWith('object:') ? L.interact.slice('object:'.length) : null;
    if (id === 'head') {
      void loadHeads().then(async (h) => {
        if (!h) return hideObject();
        const v = await objectView();
        if (player.leaf === L) void v.show(h).catch((e) => { console.error(e); v.hide(); });
      });
    } else if (id === 'pyramid' && ground && pyramidObject(ground)) {
      const g = ground;
      void objectView().then((v) => { if (player.leaf === L) v.showPyramid(pyramidObject(g)!, pyramidCaption(g)); });
    } else hideObject();
  };
  // a leaf's rendered cards are fetched as it starts, so each picture is there when its word comes (a card came up
  // with its caption and no picture the first time through)
  const cardPictures: Record<string, string[]> = {
    'hawara-labyrinth': ['hawara-labyrinth'], 'hawara-lower': ['hawara-labyrinth-under'],
    'khafre-cutaway': ['khafre-cutaway', 'khafre-cutaway-top'], 'khufu-section': ['khufu-section'],
  };
  const preloadCards = (L: { draw: readonly string[] }) => {
    for (const entry of L.draw) {
      const id = entry.split('@')[0]!;
      for (const name of cardPictures[id] ?? (id.startsWith('gobekli-') || id.startsWith('karahan-') ? [id] : [])) new Image().src = `objects/${name}.jpg`;
    }
  };
  const ambient = new Ambient();
  player.onLeaf = (L) => {
    // this leaf's pictures and the next one's, so a card that opens a leaf is loaded before the leaf arrives
    const next = leaves[leaves.indexOf(L) + 1];
    panel.show(L); sky.show(L, player.playing); objectFor(L); preloadCards(L); if (next) preloadCards(next);
    sky.setMask(maskFor(L));
    if (player.playing) ambient.play(bedFor(L));
  };
  const figure = $('figure');
  player.onFigure = (id) => {
    if (id === 'ditch-plan') {
      const flank = manifest.byId['sphinx-flank'];
      const here: [number, number] = flank ? [flank.camera[0], flank.camera[1]] : [330, -449];
      figure.innerHTML = `${ditchPlanSvg(sphinxPlan, here)}<figcaption>The ditch in plan. Both margins are scaled from ARCE's drawing d-gen-008 and not yet checked against it; only the two the drawing gives are drawn.</figcaption>`;
    }
    if (id === 'belt-plan') figure.innerHTML = beltPlanFigure(ground);
    if (id === 'pi-circle') figure.innerHTML = piCircleFigure(ground);
    if (id === 'north-square') figure.innerHTML = northSquareFigure(ground);
    if (id === 'phi-triangle') figure.innerHTML = phiTriangleFigure(ground);
    if (id === 'earth-scale') figure.innerHTML = earthScaleFigure(bundle, ground);
    // one drawing with its zones lit in turn: when the card already shows it, the light moves within it
    const seismic = { 'seismic-section': null, 'seismic-front': 'front', 'seismic-rear': 'rear' } as const;
    if (id && id in seismic) {
      const lit = seismic[id as keyof typeof seismic];
      const svg = shownFigure && shownFigure in seismic && !figure.hidden ? figure.querySelector('svg') : null;
      if (svg) relightSeismic(svg, lit);
      else figure.innerHTML = seismicSectionFigure(ground, lit);
    }
    if (id === 'joint-claim') figure.innerHTML = `${jointClaimSvg()}<figcaption>The claim as West and Schoch describe it, not a survey:
      no measured section through an original joint has been published, by either side.</figcaption>`;
    if (id === 'luminescence') figure.innerHTML = luminescenceFigure();
    if (id === 'radiocarbon') figure.innerHTML = radiocarbonFigure();
    if (id === 'corridor') figure.innerHTML = corridorFigure();
    if (id === 'khufu-section') figure.innerHTML = khufuSectionFigure();
    if (id === 'khafre-depths') figure.innerHTML = khafreDepthsFigure(ground, bundle?.structures);
    if (id === 'khafre-cutaway') figure.innerHTML = khafreCutawayFigure(ground, bundle?.structures);
    if (id === 'hawara-labyrinth' || id === 'hawara-lower') figure.innerHTML = hawaraLabyrinthFigure(id === 'hawara-lower');
    if (id?.startsWith('gobekli-')) figure.innerHTML = gobekliFigure(id, ground);
    if (id?.startsWith('karahan-')) figure.innerHTML = karahanFigure(id);
    if (id === 'seked-rule') figure.innerHTML = sekedRuleFigure(bundle, ground);
    if (id === 'north-drift') figure.innerHTML = northDriftFigure(ground);
    if (id === 'pole-stars') figure.innerHTML = poleStarsFigure(ground);
    if (id === 'claim-sort') figure.innerHTML = claimSortFigure(bundle);
    if (id === 'hawara-depths') figure.innerHTML = hawaraDepthsFigure(ground, bundle?.structures);
    if (id === 'looked' || id === 'looked-tests') figure.innerHTML = lookedFigure(ground, bundle?.structures, id === 'looked-tests');
    if (id === 'allan-rank') figure.innerHTML = allanRankFigure();
    if (id === 'king-lists') figure.innerHTML = kingListsFigure();
    if (id === 'rhind-56') figure.innerHTML = rhindFigure(bundle);
    if (id === 'vulture-sky') figure.innerHTML = vultureFigure();
    if (id === 'great-circle') figure.innerHTML = greatCircleFigure(ground);
    figure.classList.toggle('beside-sky', !!player.leaf.sky);
    // a card that is one picture (Göbekli, Karahan, the Labyrinth) fills the stage instead of floating as a panel
    // (the critic on chapters 3 to 9, 26 October: "trapped inside floating popup cards")
    figure.classList.toggle('photo', !!figure.querySelector(':scope > img.wide'));
    shownFigure = id;
    figure.hidden = !id;
    fitFigure();
    stage.request();   // the scene's labels step off the panel, or back
  };
  // the card ends above the band's place line, however many lines the narration takes (a long caption ran under it)
  const where = document.querySelector('.band .where') as HTMLElement;
  function fitFigure(): void {
    if (figure.hidden) return;
    figure.style.removeProperty('--room');
    const room = where.getBoundingClientRect().top - figure.getBoundingClientRect().top - 14;
    figure.style.setProperty('--room', `${Math.max(160, Math.floor(room))}px`);
  }
  new ResizeObserver(fitFigure).observe(document.querySelector('.band') as HTMLElement);
  addEventListener('resize', fitFigure);
  stage.keepOut = () => {
    if (figure.hidden) return [];
    const f = figure.getBoundingClientRect(), s = $('stage').getBoundingClientRect();
    return [{ x: f.left - s.left, y: f.top - s.top, w: f.width, h: f.height }];
  };
  panel.onOpen = () => { if (player.playing) player.pause(); };
  player.onPlay = () => { panel.quiet(); sky.show(player.leaf, true); ambient.play(bedFor(player.leaf)); };
  player.onPause = () => ambient.stop();
  const maskFor = (L: Leaf) => (L.sky ? new URL(leafPanorama(L, RENDER).replace(/^pano\//, 'pano/mask/').replace(/\.jpg$/, '.png'), WALK).href : null);
  const explore = new Explore({
    stage, manifest, sky, leaves, walk: WALK, panoramas: panoramasFor(manifest), mask: maskFor,
    bundle: () => bundle as ExploreBundle | null,
    back: () => { explore.hide(); player.go(leaves.indexOf(player.leaf)); },
  });
  const openExplore = () => { if (player.playing) player.pause(); explore.show(); };
  player.onEnd = () => finale(() => { player.go(0); player.play(); }, openExplore);

  // for capture and test scripts, as the story page had
  (window as unknown as { seked: unknown }).seked = { player, stage, sky };
  $('controls').hidden = false;
  player.go(leafFromSearch(location.search, leaves));
  // after the first leaf, which would otherwise take the stage back
  const qs = new URLSearchParams(location.search);
  if (qs.has('finale')) player.onEnd();   // ?finale: straight to the end
  if (qs.has('explore')) openExplore();   // ?explore: straight to Explore
}

void start();
