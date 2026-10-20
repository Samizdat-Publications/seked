/**
 * The exhibit's page: the stage full screen, a quiet caption band and the play controls. `?leaf=ch1-carved`
 * opens on a leaf (the first when none is named). A shot can still be picked by hand, outside the leaves:
 * `?station=sphinx-flank&era=today&yaw=285&pitch=10&fov=70&overlay=g1-proportions`.
 */
import './style.css';
import leavesJson from '../leaves.json';
import renderStations from '../../../render/stations.json';
import script from '../../../docs/script.md?raw';
import { type Leaf, type RenderStations, leafPanorama, readLeaves } from './leaves';
import { type Manifest, pickEra, readManifest, readOverlays } from './manifest';
import { leafFromSearch, scriptChapters } from './play';
import { Panel } from './panel';
import { Player } from './player';
import { DEG } from './projection';
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

async function start(): Promise<void> {
  const status = $('status');
  const fail = (msg: string) => { status.textContent = msg; status.hidden = false; };
  let manifest: Manifest, overlays;
  try {
    [manifest, overlays] = await Promise.all([json('stations.json').then(readManifest), json('overlays.json').then(readOverlays, () => ({}))]);
  } catch (e) {
    console.error(e);
    return fail('The exhibit could not load its stations. Reload to try again.');
  }
  const stage = new Stage($('stage'), $<HTMLCanvasElement>('view'), $<HTMLCanvasElement>('ink'), $('flat'), manifest, overlays, WALK);
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

  const missing = LEAVES.find((L) => !manifest.byId[L.station]);
  if (missing) return fail(`The leaf ${missing.id} stands at ${missing.station}, which the walkthrough does not have.`);
  const player = new Player(stage, manifest, LEAVES, scriptChapters(script), {
    caption: $('caption'), place: $('place'), when: $('when'), pill: $('pill'),
    play: $<HTMLButtonElement>('play'), prev: $<HTMLButtonElement>('prev'), next: $<HTMLButtonElement>('next'),
    chapterBtn: $<HTMLButtonElement>('chapter'), chapterList: $('chapter-list'), count: $('count'), flight: $<HTMLVideoElement>('flight'),
  }, panoramasFor(manifest));
  const panel = new Panel($('stage'), script);
  player.onLeaf = (L) => panel.show(L);
  panel.onOpen = () => { if (player.playing) player.pause(); };
  $('controls').hidden = false;
  player.go(leafFromSearch(location.search, LEAVES));
}

void start();
