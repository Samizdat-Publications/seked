/**
 * The rail: one button a drawer, down the right edge, and at phone width the
 * same buttons laid along the bottom. It is the only way into the drawers,
 * so it stays on screen whatever else is open.
 */
import { useView } from '../store';
import { ICONS } from './Icons';
import { DRAWERS, useUi, type DrawerId } from './ui';

export function Rail(): React.JSX.Element {
  const drawer = useUi((s) => s.drawer);
  const toggle = useUi((s) => s.toggle);
  const tour = useView((s) => s.tour);

  return (
    <nav className="rail" aria-label="Instruments">
      <ul>
        {DRAWERS.map((d) => (
          <li key={d.id}>
            <RailButton id={d.id} label={d.label} hint={d.hint} open={drawer === d.id} running={d.id === 'tour' && tour !== null} onClick={() => toggle(d.id)} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function RailButton({
  id,
  label,
  hint,
  open,
  running,
  onClick,
}: {
  id: DrawerId;
  label: string;
  hint: string;
  open: boolean;
  /** The tour is stepping, so the rail says so even with the drawer shut. */
  running: boolean;
  onClick: () => void;
}): React.JSX.Element {
  const Icon = ICONS[id];
  return (
    <button
      type="button"
      className={`rail-button${open ? ' is-open' : ''}${running ? ' is-running' : ''}`}
      onClick={onClick}
      aria-expanded={open}
      aria-label={label}
      title={`${label}. ${hint}`}
    >
      <Icon />
      <span className="rail-label">{label}</span>
    </button>
  );
}
