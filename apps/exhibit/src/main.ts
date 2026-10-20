/**
 * The exhibit's page: the stage full screen and a quiet caption band. `?leaf=ch1-carved` shows a leaf (the
 * first when none is named); until play exists (E3) the address can also pick a shot by hand:
 * `?station=sphinx-flank&era=today&yaw=285&pitch=10&fov=70&overlay=g1-proportions`.
 */
import './style.css';
import leavesJson from '../leaves.json';
import renderStations from '../../../render/stations.json';
import { type RenderStations, leafPanorama, readLeaves } from './leaves';
import { pickEra, readManifest, readOverlays } from './manifest';
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

function honestyWord(h: string): string {
  return h === 'claim' ? 'Theorized' : h === 'reconstruction' ? 'Reconstruction' : h === 'survey' ? 'Survey' : '';
}

async function start(): Promise<void> {
  const status = $('status');
  let manifest, overlays;
  try {
    [manifest, overlays] = await Promise.all([json('stations.json').then(readManifest), json('overlays.json').then(readOverlays, () => ({}))]);
  } catch (e) {
    status.textContent = 'The exhibit could not load its stations. Reload to try again.';
    status.hidden = false;
    console.error(e);
    return;
  }
  const stage = new Stage($('stage'), $<HTMLCanvasElement>('view'), $<HTMLCanvasElement>('ink'), $('flat'), manifest, overlays, WALK);

  const q = new URLSearchParams(location.search);
  const deg = (k: string) => { const v = q.get(k); return v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) * DEG : undefined; };
  const leaf = q.has('station') ? null : LEAVES.find((L) => L.id === q.get('leaf')) ?? LEAVES[0]!;
  const st = leaf ? manifest.byId[leaf.station] : manifest.byId[q.get('station') ?? ''];
  if (!st) { status.textContent = 'There is no such station.'; status.hidden = false; return; }
  const era = leaf ? leaf.era : pickEra(manifest, st, q.get('era'));
  if (!era) { status.textContent = `${st.name} has no panoramas yet.`; status.hidden = false; return; }

  const state = manifest.stateById[era];
  const pill = $('pill');
  pill.textContent = honestyWord(state?.honesty ?? '');
  pill.className = `pill ${state?.honesty ?? ''}`;
  pill.hidden = !pill.textContent;
  $('place').textContent = st.name;
  $('when').textContent = state ? `${state.title}, ${state.label}` : era;
  $('caption').textContent = leaf ? leaf.say : st.where;
  document.title = `${st.name}: Seked`;

  stage.onStatus = (s) => {
    status.hidden = s === 'ready';
    status.textContent = s === 'loading' ? 'Loading the panorama' : s === 'missing' ? 'This view has not been rendered yet.' : s === 'error' ? 'The panorama did not load. Reload to try again.' : '';
  };
  if (leaf) {
    // the leaf's own panorama, else the walkthrough's for the era until the laptop renders it (E6 queues it)
    const own = st.panoramas[era];
    const want = leafPanorama(leaf, RENDER);
    stage.show({
      station: st, era, yaw: leaf.view.yaw * DEG, pitch: leaf.view.pitch * DEG, fov: leaf.view.fov * DEG, overlay: leaf.draw[0] ?? null,
      panoramas: own && own !== want ? [want, own] : [want],
    });
  } else {
    stage.show({ station: st, era, yaw: deg('yaw'), pitch: deg('pitch'), fov: deg('fov'), overlay: q.get('overlay') });
  }
}

void start();
