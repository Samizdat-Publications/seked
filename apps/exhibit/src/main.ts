/**
 * The exhibit's page: the stage full screen, a quiet caption band and the play controls. `?leaf=ch1-carved`
 * opens on a leaf (the first when none is named). A shot can still be picked by hand, outside the leaves:
 * `?station=sphinx-flank&era=today&yaw=285&pitch=10&fov=70&overlay=g1-proportions`.
 */
import './style.css';
import leavesJson from '../leaves.json';
import renderStations from '../../../render/stations.json';
import script from '../../../docs/script.md?raw';
import { type Leaf, type RenderStations, leafPanorama, readLeaves, withStandIns } from './leaves';
import { type Manifest, patchesByPanorama, pickEra, readManifest, readOverlays } from './manifest';
import { leafFromSearch, scriptChapters } from './play';
import sphinxPlan from 'virtual:sphinx-plan';
import skyData from 'virtual:sky';
import allanRank from 'virtual:allan-rank';
import luminescence from 'virtual:luminescence';
import { allanRankSvg, beltPlan, beltPlanSvg, ditchPlanSvg, earthScale, earthScaleSvg, luminescenceSvg, shortCite, northSquare, northSquareSvg, phiTriangle, phiTriangleSvg, piCircle, piCircleSvg, rankLine } from './figures';
import { Panel, loadBundle } from './panel';
import { groundEnvironment, leafReceipts } from './receipts';
import { Player } from './player';
import { type Moment, comparisonsAt, epochOf, skyEnv, yearLabel } from './sky';
import { type Claim, formatResidual, formatValue } from '@seked/claims/browser';
import { SkyFigure } from './skyfigure';
import type { HeadsManifest, ObjectView } from './objectview';
import { DEG } from './projection';
import { pyramidObject } from './pyramidobject';
import { Stage } from './stage';

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
  let manifest: Manifest, overlays, leafPatches: unknown;
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
    // a figure drawn from the monuments before they loaded is drawn again with them
    if (shownFigure === 'belt-plan') figure.innerHTML = beltPlanFigure(ground);
    if (shownFigure === 'pi-circle') figure.innerHTML = piCircleFigure(ground);
    if (shownFigure === 'north-square') figure.innerHTML = northSquareFigure(ground);
    if (shownFigure === 'phi-triangle') figure.innerHTML = phiTriangleFigure(ground);
    if (shownFigure === 'earth-scale') figure.innerHTML = earthScaleFigure(bundle, ground);
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
  player.onLeaf = (L) => { panel.show(L); sky.show(L, player.playing); objectFor(L); };
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
    if (id === 'luminescence') figure.innerHTML = luminescenceFigure();
    if (id === 'allan-rank') figure.innerHTML = allanRankFigure();
    figure.classList.toggle('beside-sky', !!player.leaf.sky);
    shownFigure = id;
    figure.hidden = !id;
  };
  panel.onOpen = () => { if (player.playing) player.pause(); };
  player.onPlay = () => { panel.quiet(); sky.show(player.leaf, true); };
  // for capture and test scripts, as the story page had
  (window as unknown as { seked: unknown }).seked = { player, stage, sky };
  $('controls').hidden = false;
  player.go(leafFromSearch(location.search, leaves));
}

void start();
