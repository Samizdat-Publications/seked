/**
 * The Views drawer: the five hero cameras the Blender renders were framed
 * from, each with the moment it was rendered at. Taking one moves the camera
 * and the sun and nothing else, so the state, the layers and any open claim
 * stay exactly as the reader left them.
 */
import { useView } from '../store';
import { LOOKS } from '../looks';
import { clock, dateWords } from './moment';

export function Views(): React.JSX.Element {
  const showCamera = useView((s) => s.showCamera);
  const setMoment = useView((s) => s.setMoment);
  const setMode = useView((s) => s.setMode);

  return (
    <section className="block">
      <ul className="looks">
        {LOOKS.map((look) => (
          <li key={look.id}>
            <button
              type="button"
              className="look"
              onClick={() => {
                // A framing is worth nothing in fly mode, where the next
                // keystroke walks off it, so a look lands the reader in orbit.
                setMode('orbit');
                showCamera(look.camera);
                setMoment(look.moment);
              }}
            >
              <span className="look-label">{look.label}</span>
              <span className="look-moment num">
                {dateWords(look.moment.day)}, {clock(look.moment.hour)}
              </span>
              <span className="look-note">{look.note}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="note">
        Each is a station and an aim out of <code>blender/render.py</code>, turned into the viewer's frame, and the moment that view is
        rendered at. They are compositions and not measurements: nothing downstream reads them and no claim depends on one.
      </p>
    </section>
  );
}
