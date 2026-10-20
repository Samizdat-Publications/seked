/**
 * The exhibit's page: the stage full screen and a quiet caption band. Until the leaves exist (E2) the address
 * picks what is shown: `?station=sphinx-flank&era=today&yaw=285&pitch=10&fov=70&overlay=g1-proportions`.
 */
import './style.css';
import { pickEra, readManifest, readOverlays } from './manifest';
import { DEG } from './projection';
import { Stage } from './stage';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** The walkthrough's files, where the site keeps them beside the exhibit. */
const WALK = new URL('../walk/', location.href);
const OPENING = 'sphinx-flank';

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
  const st = manifest.byId[q.get('station') ?? OPENING] ?? manifest.byId[OPENING] ?? manifest.stations[0];
  if (!st) { status.textContent = 'There are no stations to show.'; status.hidden = false; return; }
  const era = pickEra(manifest, st, q.get('era'));
  if (!era) { status.textContent = `${st.name} has no panoramas yet.`; status.hidden = false; return; }
  const deg = (k: string) => { const v = q.get(k); return v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) * DEG : undefined; };

  const state = manifest.stateById[era];
  const pill = $('pill');
  pill.textContent = honestyWord(state?.honesty ?? '');
  pill.className = `pill ${state?.honesty ?? ''}`;
  pill.hidden = !pill.textContent;
  $('place').textContent = st.name;
  $('when').textContent = state ? `${state.title}, ${state.label}` : era;
  $('caption').textContent = st.where;
  document.title = `${st.name}: Seked`;

  stage.onStatus = (s) => {
    status.hidden = s === 'ready';
    status.textContent = s === 'loading' ? 'Loading the panorama' : s === 'missing' ? 'This view has not been rendered yet.' : s === 'error' ? 'The panorama did not load. Reload to try again.' : '';
  };
  stage.show({ station: st, era, yaw: deg('yaw'), pitch: deg('pitch'), fov: deg('fov'), overlay: q.get('overlay') });
}

void start();
