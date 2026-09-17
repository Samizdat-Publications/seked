/**
 * The About drawer: what the viewer is, the rules that keep it honest, where
 * its surfaces come from, and where the written work is.
 *
 * The attributions are not written here. They are read at runtime from the
 * manifests the fetch scripts write beside the textures and the models, so a
 * surface that arrives in the build says so itself, and one that has not been
 * fetched on this machine simply is not listed. Nothing here is a number any
 * claim depends on.
 */
import { useEffect, useState } from 'react';

/** One texture set, as `scripts/web-textures.py` writes it. */
interface TextureEntry {
  file?: string;
  url?: string;
  license?: string;
  attribution?: string;
}

/** One stand-in, as the model manifest carries it. */
interface ModelEntry {
  id?: string;
  label?: string;
  attribution?: string;
  license?: string;
  evidence?: string;
  url?: string;
}

/** A credit, however the manifest it came from happens to spell one. */
interface Credit {
  key: string;
  text: string;
  url?: string;
}

const asset = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

/**
 * A manifest that may not be there. Every one of these is generated and
 * gitignored, so a checkout that has not run the fetch scripts has none of
 * them, and the drawer says so rather than failing.
 */
function useManifest<T>(path: string): { data: T | undefined; missing: boolean } {
  const [state, setState] = useState<{ data: T | undefined; missing: boolean }>({ data: undefined, missing: false });
  useEffect(() => {
    let live = true;
    fetch(asset(path))
      .then((res) => (res.ok ? (res.json() as Promise<T>) : Promise.reject(new Error(String(res.status)))))
      .then(
        (data) => {
          if (live) setState({ data, missing: false });
        },
        () => {
          if (live) setState({ data: undefined, missing: true });
        },
      );
    return () => {
      live = false;
    };
  }, [path]);
  return state;
}

/** Whatever shape a manifest takes, as a list of entries with their keys. */
function entriesOf<T>(data: unknown): Array<[string, T]> {
  if (Array.isArray(data)) return data.map((entry, i) => [String(i), entry as T]);
  if (data !== null && typeof data === 'object') return Object.entries(data as Record<string, T>);
  return [];
}

function textureCredits(data: unknown): Credit[] {
  return entriesOf<TextureEntry>(data).map(([key, entry]) => ({
    key,
    text: entry.attribution ?? [key, entry.license].filter(Boolean).join(', '),
    url: entry.url,
  }));
}

function modelCredits(data: unknown): Credit[] {
  const models = entriesOf<ModelEntry>(data);
  // A manifest may wrap its list under a key of its own rather than being one.
  const list = models.length === 1 && Array.isArray((models[0] as [string, unknown])[1]) ? entriesOf<ModelEntry>((models[0] as [string, unknown])[1]) : models;
  return list
    .filter(([, entry]) => entry !== null && typeof entry === 'object')
    .map(([key, entry]) => {
      const name = entry.label ?? entry.id ?? key;
      const said = entry.attribution ?? [name, entry.license].filter(Boolean).join(', ');
      return { key, text: entry.evidence === undefined ? said : `${said}. Stand-in, ${entry.evidence}.`, url: entry.url };
    });
}

export function About(): React.JSX.Element {
  const textures = useManifest<Record<string, TextureEntry>>('textures/index.json');
  const models = useManifest<unknown>('models/manifest.json');
  const stone = textureCredits(textures.data);
  const standins = modelCredits(models.data);

  return (
    <>
      <section className="block">
        <p className="lede">
          A survey-accurate 3D model of the Giza necropolis in which every claim of encoded mathematics is a live overlay, computed from the
          measurement database rather than quoted at you.
        </p>
      </section>

      <section className="block">
        <h2>What keeps it honest</h2>
        <ol className="rules">
          <li>Nothing is typed twice. Every number is a record with a source, and anything derived from one is computed, never stored.</li>
          <li>Metres and degrees underneath. Cubits and pyramid inches are ways of saying a number, never ways of keeping one.</li>
          <li>Unverified until checked. A record counts as verified only once someone has read it off the cited page.</li>
          <li>Stand-ins are labelled. A model borrowed for a structure keeps its source and its licence and is called a stand-in.</li>
          <li>Tiers are never promoted. A claim may reach for any kind of evidence; no claim moves what kind it is.</li>
        </ol>
        <p className="note">
          Every view says which of three things it is. The survey is what is measured and cited. A reconstruction is what the evidence
          supports but no one has measured. A claim is somebody's reading, drawn so it can be argued with. The caption in the corner ends on
          whichever it is.
        </p>
      </section>

      <section className="block">
        <h2>Surfaces</h2>
        <Credits
          what="Stone"
          credits={stone}
          missing={textures.missing}
          absent="No texture sets in this build, so the stone is drawn in flat colour."
        />
        <Credits
          what="Stand-ins"
          credits={standins}
          missing={models.missing}
          absent="No stand-in models in this build. Everything on the plateau is built from the database."
        />
      </section>

      <section className="block">
        <h2>The written work</h2>
        <ul className="plain">
          <li>
            <a href={asset('docs/dossier.md')}>The claims dossier</a>, generated from the same data the overlays read.
          </li>
          <li>
            <a href={asset('docs/plan.html')}>The plan</a>, which says what this is for and what is still missing.
          </li>
          <li>
            <a href={asset('progress/')}>Progress</a>, every milestone render and screenshot, oldest first.
          </li>
        </ul>
      </section>
    </>
  );
}

function Credits({
  what,
  credits,
  missing,
  absent,
}: {
  what: string;
  credits: Credit[];
  /** The manifest was looked for and is not in this build. */
  missing: boolean;
  absent: string;
}): React.JSX.Element {
  return (
    <>
      <h3 className="subhead">{what}</h3>
      {credits.length === 0 ? (
        <p className="note">{missing ? absent : 'Reading the manifest.'}</p>
      ) : (
        <ul className="plain credits">
          {credits.map((credit) => (
            <li key={credit.key}>
              {credit.url === undefined ? credit.text : <a href={credit.url}>{credit.text}</a>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
