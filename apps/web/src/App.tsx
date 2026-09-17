import { useEffect, useMemo, useRef } from 'react';
import { brightStarsOf } from './bundle';
import type { LoadedBundle } from './load';
import { buildModel } from './model';
import { overlaySpec, type OverlayContext } from './overlays';
import { Claims } from './panels/Claims';
import { CubitSlider, LayerToggles, PresetPicker, SectionControls } from './panels/Controls';
import { SkyControls } from './panels/Sky';
import { Tour } from './panels/Tour';
import { Scene } from './scene/Scene';
import { domeBuffers, namedOnDome } from './sky';
import { useView } from './store';
import { About } from './ui/About';
import { Caption } from './ui/Caption';
import { Drawer } from './ui/Drawer';
import { Rail } from './ui/Rail';
import { SunDial } from './ui/SunDial';
import { Timeline } from './ui/Timeline';
import { useUi } from './ui/ui';
import { Views } from './ui/Views';
import { STATES, sceneEpoch, stateById } from './view';

/**
 * The stage. The scene fills the window and every control stands over it on
 * dark glass: the caption top left, the rail of drawers down the right edge,
 * the instruments along the bottom. Only one drawer shows at a time, and all
 * of them stay mounted, so the tour keeps its keys with the stage clear.
 */
export function App({ loaded }: { loaded: LoadedBundle }): React.JSX.Element {
  const { bundle, heights } = loaded;
  const preset = useView((s) => s.preset);
  const cubit = useView((s) => s.cubit);
  const epochOverride = useView((s) => s.epoch);
  const lst = useView((s) => s.lst);
  const krupp = useView((s) => s.krupp);
  const layers = useView((s) => s.layers);
  const selected = useView((s) => s.claim);
  const tour = useView((s) => s.tour);
  const state = useView((s) => s.state);

  /**
   * A tour index in the address bar opens the tour at that step, once, now
   * that the bundle is in. The rest of the URL was decoded before the first
   * render, so a link that carries a camera of its own keeps it: the step is
   * applied and the decoded camera is then put back over the step's. A
   * hand-written link with no camera at all has already taken the step's own,
   * which is what `decodeView` falls back to.
   */
  useEffect(() => {
    const { tour: step, camera, goToStep, showCamera } = useView.getState();
    if (step === null) return;
    goToStep(step);
    showCamera(camera);
  }, []);

  /**
   * Starting the tour opens its drawer, because a tour with its narration in
   * a shut cupboard is a slideshow. Stepping on from there leaves the drawer
   * wherever the reader has put it.
   */
  const wasRunning = useRef(false);
  const openDrawer = useUi((s) => s.open);
  useEffect(() => {
    const running = tour !== null;
    if (running && !wasRunning.current) openDrawer('tour');
    wasRunning.current = running;
  }, [tour, openDrawer]);

  useShellKeys();

  const model = useMemo(() => buildModel(bundle, preset, cubit, epochOverride), [bundle, preset, cubit, epochOverride]);
  const header = bundle.terrain.header;
  const datum = bundle.sites.find((s) => s.id === header.site)?.origin.elevation ?? 0;
  // The ground grid is flattened under whatever pyramids the preset places, so
  // it is rebuilt when the preset moves one of them.
  const terrain = useMemo(
    () => ({ header, heights, datum, pyramids: model.pyramids }),
    [header, heights, datum, model.pyramids],
  );

  const claim = bundle.claims.find((c) => c.id === selected);
  // With nothing overridden the scene follows the open claim, so choosing a
  // sky claim puts the sky at the epoch that claim is stated at.
  const epoch = sceneEpoch(epochOverride, claim?.epoch, stateById(state).epoch);

  // The catalogue is expanded once; the dome is rebuilt when the epoch moves
  // and only then, because sidereal time turns it rather than moving its
  // stars. The handful the claims name is cheap enough to keep even with the
  // layer off, since the transit buttons in the panel read their right
  // ascensions.
  const catalogue = useMemo(() => brightStarsOf(bundle), [bundle]);
  const named = useMemo(() => namedOnDome(bundle.stars, epoch), [bundle.stars, epoch]);
  // The dome is built for every epoch, sky layer or not, because the stars
  // come up on their own once the sun is down; the layer only shows the
  // horizon ring and the labels.
  const buffers = useMemo(() => domeBuffers(catalogue, epoch), [catalogue, epoch]);
  const sky = { buffers, named, latitudeDeg: model.latitudeDeg, lstDeg: lst };

  const overlayContext = useMemo<OverlayContext>(
    () => ({
      env: model.env,
      pyramids: model.pyramids,
      interiors: model.interiors,
      stars: bundle.stars,
      epoch,
      lstDeg: lst,
      latitudeDeg: model.latitudeDeg,
      krupp,
      elevationM: datum,
    }),
    [model, bundle.stars, epoch, lst, krupp, datum],
  );
  const overlay = useMemo(() => overlaySpec(claim, overlayContext), [claim, overlayContext]);

  return (
    <div className="shell">
      <main className="stage">
        <Scene model={model} terrain={terrain} layers={layers} overlay={overlay} sky={sky} epoch={epoch} />
      </main>

      <Caption epoch={epoch} claimId={selected} />

      <div className="instruments">
        <Timeline />
        <SunDial />
      </div>

      <div className="drawers">
        <Drawer id="views">
          <Views />
        </Drawer>
        <Drawer id="layers">
          <LayerToggles />
        </Drawer>
        {/*
          The preset and the cubit are not claims, but every residual below
          them moves when either does, so they stand at the head of this
          drawer under a word saying what they are.
        */}
        <Drawer id="claims">
          <h3 className="drawer-section">The basis</h3>
          <PresetPicker presets={bundle.presets} />
          <CubitSlider model={model} />
          <Claims claims={bundle.claims} model={model} context={overlayContext} />
        </Drawer>
        <Drawer id="section">
          <SectionControls model={model} />
        </Drawer>
        <Drawer id="sky">
          <SkyControls
            epoch={epoch}
            named={named}
            claim={claim}
            latitudeDeg={model.latitudeDeg}
            longitudeDeg={model.env['g1.center.longitude'] ?? 0}
          />
        </Drawer>
        <Drawer id="tour">
          <Tour />
        </Drawer>
        <Drawer id="about">
          <About />
        </Drawer>
      </div>

      <Rail />
    </div>
  );
}

/** Whether a keystroke was meant for something the reader is typing in. */
function typing(target: EventTarget | null): boolean {
  const from = target as HTMLElement | null;
  return Boolean(from?.isContentEditable) || ['INPUT', 'SELECT', 'TEXTAREA'].includes(from?.tagName ?? '');
}

/**
 * The shell's two keys. Escape shuts the drawer, which is what Escape does
 * everywhere; the digits move the timeline, because four states want four
 * keys. The tour keeps its own arrows, and a slider under the reader's finger
 * keeps whatever it is given, so neither is touched here.
 */
function useShellKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
      if (e.key === 'Escape') {
        if (useUi.getState().drawer === null) return;
        useUi.getState().close();
        e.preventDefault();
        return;
      }
      const stop = STATES[Number(e.key) - 1];
      if (stop === undefined) return;
      useView.getState().setState(stop.id);
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
