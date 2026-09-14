import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadBundle } from './load';
import { mirrorUrl, readUrl } from './store';
import './styles.css';

const root = createRoot(document.getElementById('root') as HTMLElement);

loadBundle().then(
  (loaded) => {
    readUrl(loaded.bundle.presets.map((p) => p.id));
    mirrorUrl();
    root.render(
      <StrictMode>
        <App loaded={loaded} />
      </StrictMode>,
    );
  },
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    root.render(
      <div className="failure">
        <h1>Seked could not load its data</h1>
        <p>{message}</p>
        <p>
          The viewer reads <code>public/seked.json</code>, which <code>pnpm bundle</code> writes from <code>data/</code>.
        </p>
      </div>,
    );
  },
);
