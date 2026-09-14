import { useMemo } from 'react';
import type { LoadedBundle } from './load';
import { buildModel } from './model';
import { Claims } from './panels/Claims';
import { CubitSlider, LayerToggles, PresetPicker } from './panels/Controls';
import { Scene } from './scene/Scene';
import { useView } from './store';

export function App({ loaded }: { loaded: LoadedBundle }): React.JSX.Element {
  const { bundle, heights } = loaded;
  const preset = useView((s) => s.preset);
  const cubit = useView((s) => s.cubit);
  const layers = useView((s) => s.layers);

  const model = useMemo(() => buildModel(bundle, preset, cubit), [bundle, preset, cubit]);
  const header = bundle.terrain.header;
  const datum = bundle.sites.find((s) => s.id === header.site)?.origin.elevation ?? 0;
  const terrain = useMemo(() => ({ header, heights, datum }), [header, heights, datum]);

  return (
    <div className="app">
      <main className="stage">
        <Scene model={model} terrain={terrain} layers={layers} />
      </main>
      <aside className="panel">
        <header className="masthead">
          <h1>Seked</h1>
          <p>Giza as the measurement database has it, with the claims evaluated live against it.</p>
        </header>
        <PresetPicker presets={bundle.presets} />
        <CubitSlider model={model} />
        <LayerToggles />
        <Claims claims={bundle.claims} model={model} />
      </aside>
    </div>
  );
}
