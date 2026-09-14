import { useMemo } from 'react';
import { brightStarsOf } from './bundle';
import type { LoadedBundle } from './load';
import { buildModel } from './model';
import { overlaySpec, type OverlayContext } from './overlays';
import { Claims } from './panels/Claims';
import { CubitSlider, LayerToggles, PresetPicker, SectionControls } from './panels/Controls';
import { SkyControls } from './panels/Sky';
import { Scene } from './scene/Scene';
import { domeBuffers, namedOnDome } from './sky';
import { useView } from './store';
import { sceneEpoch } from './view';

export function App({ loaded }: { loaded: LoadedBundle }): React.JSX.Element {
  const { bundle, heights } = loaded;
  const preset = useView((s) => s.preset);
  const cubit = useView((s) => s.cubit);
  const epochOverride = useView((s) => s.epoch);
  const lst = useView((s) => s.lst);
  const krupp = useView((s) => s.krupp);
  const layers = useView((s) => s.layers);
  const selected = useView((s) => s.claim);

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
  const epoch = sceneEpoch(epochOverride, claim?.epoch);

  // The catalogue is expanded once; the dome is rebuilt when the epoch moves
  // and only then, because sidereal time turns it rather than moving its
  // stars. The named ten are cheap enough to keep even with the layer off,
  // since the transit buttons in the panel read their right ascensions.
  const catalogue = useMemo(() => brightStarsOf(bundle), [bundle]);
  const named = useMemo(() => namedOnDome(bundle.stars, epoch), [bundle.stars, epoch]);
  const buffers = useMemo(() => (layers.sky ? domeBuffers(catalogue, epoch) : undefined), [layers.sky, catalogue, epoch]);
  const sky = buffers ? { buffers, named, latitudeDeg: model.latitudeDeg, lstDeg: lst } : undefined;

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
    }),
    [model, bundle.stars, epoch, lst, krupp],
  );
  const overlay = useMemo(() => overlaySpec(claim, overlayContext), [claim, overlayContext]);

  return (
    <div className="app">
      <main className="stage">
        <Scene model={model} terrain={terrain} layers={layers} overlay={overlay} sky={sky} />
      </main>
      <aside className="panel">
        <header className="masthead">
          <h1>Seked</h1>
          <p>Giza as the measurement database has it, with the claims evaluated live against it.</p>
        </header>
        <PresetPicker presets={bundle.presets} />
        <CubitSlider model={model} />
        <SkyControls epoch={epoch} named={named} claim={claim} latitudeDeg={model.latitudeDeg} longitudeDeg={model.env['g1.center.longitude'] ?? 0} />
        <LayerToggles />
        <SectionControls model={model} />
        <Claims claims={bundle.claims} model={model} context={overlayContext} />
      </aside>
    </div>
  );
}
