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
import { ditchPlanSvg } from './figures';
import { Panel } from './panel';
import { Player } from './player';
import type { Moment } from './sky';
import { SkyFigure } from './skyfigure';
import type { HeadsManifest, ObjectView } from './objectview';
import { DEG } from './projection';
import { Stage } from './stage';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** The walkthrough's files, where the site keeps them beside the exhibit. */
const WALK = new URL('../walk/', location.href);
const LEAVES = readLeaves(leavesJson);
const RENDER = renderStations as unknown as RenderStations;
/** Each object a leaf can hold (`interact: object:<id>`) and the file render/export_heads.py writes for it. */
const OBJECT_FILES: Record<string, string> = { head: 'heads.json' };

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
  // an object in the hand: three.js loads only when a leaf asks for one, and only once its export exists
  let objects: Promise<{ view: ObjectView; heads: HeadsManifest } | null> | null = null;
  const objectFor = (L: Leaf) => {
    const file = OBJECT_FILES[L.interact.replace(/^object:/, '')];
    if (!L.interact.startsWith('object:') || !file) { void objects?.then((o) => o?.view.hide()); return; }
    objects ??= (async () => {
      const r = await fetch(new URL(`objects/${file}`, location.href)).catch(() => null);
      if (!r?.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null;
      const heads = (await r.json()) as HeadsManifest;
      const { ObjectView: View } = await import('./objectview');
      return { view: new View($('stage'), new URL('objects/', location.href)), heads };
    })();
    void objects.then((o) => { if (o && player.leaf === L) void o.view.show(o.heads).catch((e) => { console.error(e); o.view.hide(); }); });
  };
  player.onLeaf = (L) => { panel.show(L); sky.show(L, player.playing); objectFor(L); };
  const figure = $('figure');
  player.onFigure = (id) => {
    if (id === 'ditch-plan') {
      const flank = manifest.byId['sphinx-flank'];
      const here: [number, number] = flank ? [flank.camera[0], flank.camera[1]] : [330, -449];
      figure.innerHTML = `${ditchPlanSvg(sphinxPlan, here)}<figcaption>The ditch in plan. Both margins are scaled from ARCE's drawing d-gen-008 and not yet checked against it; only the two the drawing gives are drawn.</figcaption>`;
    }
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
