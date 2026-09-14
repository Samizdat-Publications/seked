import { useMemo } from 'react';
import type { LoadedBundle } from './load';
import { buildModel } from './model';
import { ghostProfileSpec } from './overlays';
import { Claims } from './panels/Claims';
import { CubitSlider, LayerToggles, PresetPicker, SectionControls } from './panels/Controls';
import { Scene } from './scene/Scene';
import { useView } from './store';

export function App({ loaded }: { loaded: LoadedBundle }): React.JSX.Element {
  const { bundle, heights } = loaded;
  const preset = useView((s) => s.preset);
  const cubit = useView((s) => s.cubit);
  const layers = useView((s) => s.layers);
  const selected = useView((s) => s.claim);

  const model = useMemo(() => buildModel(bundle, preset, cubit), [bundle, preset, cubit]);
  const header = bundle.terrain.header;
  const datum = bundle.sites.find((s) => s.id === header.site)?.origin.elevation ?? 0;
  // The ground grid is flattened under whatever pyramids the preset places, so
  // it is rebuilt when the preset moves one of them.
  const terrain = useMemo(
    () => ({ header, heights, datum, pyramids: model.pyramids }),
    [header, heights, datum, model.pyramids],
  );

  const claim = bundle.claims.find((c) => c.id === selected);
  const ghosts = useMemo(() => (claim ? ghostProfileSpec(claim, model.env) : undefined), [claim, model.env]);

  return (
    <div className="app">
      <main className="stage">
        <Scene model={model} terrain={terrain} layers={layers} ghosts={ghosts} />
      </main>
      <aside className="panel">
        <header className="masthead">
          <h1>Seked</h1>
          <p>Giza as the measurement database has it, with the claims evaluated live against it.</p>
        </header>
        <PresetPicker presets={bundle.presets} />
        <CubitSlider model={model} />
        <LayerToggles />
        <SectionControls model={model} />
        <Claims claims={bundle.claims} model={model} />
      </aside>
    </div>
  );
}
