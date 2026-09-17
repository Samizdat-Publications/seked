/**
 * One drawer. Every drawer's contents stay mounted whether or not it is the
 * one showing, which is what lets the tour keep its arrow keys while the
 * reader has the stage to themselves; the shut ones are taken out of the
 * layout, so nothing in them can be tabbed to or read aloud.
 */
import type { ReactNode } from 'react';
import { CloseIcon } from './Icons';
import { DRAWERS, useUi, type DrawerId } from './ui';

export function Drawer({ id, children }: { id: DrawerId; children: ReactNode }): React.JSX.Element {
  const open = useUi((s) => s.drawer === id);
  const close = useUi((s) => s.close);
  const meta = DRAWERS.find((d) => d.id === id) as (typeof DRAWERS)[number];

  return (
    <section className={`drawer${open ? ' is-open' : ''}`} aria-label={meta.label} aria-hidden={!open}>
      <header className="drawer-head">
        <h2>{meta.label}</h2>
        <button type="button" className="icon-button" onClick={close} aria-label="Close the drawer" title="Close (Escape)">
          <CloseIcon />
        </button>
      </header>
      <p className="drawer-hint">{meta.hint}</p>
      <div className="drawer-body">{children}</div>
    </section>
  );
}
