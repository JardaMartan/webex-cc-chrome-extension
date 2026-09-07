import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { getWidgetUi, setWidgetUi } from '../../shared/storage.js';

// Call-Associated-Data / Desktop flow variables (see serializeTask() in
// sdk/webexSdkClient.js) — foldable, remembering the last fold state across
// calls/reloads the same way the widget's dragged position is remembered.
export default function CadPanel() {
  const activeTask = useSelector((s) => s.call.activeTask);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    getWidgetUi().then((ui) => setCollapsed(!!ui.cadCollapsed));
  }, []);

  const entries = activeTask?.cadEntries || [];
  if (entries.length === 0) return null;

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    setWidgetUi({ cadCollapsed: next });
  }

  return (
    <div className="ccc-panel__section ccc-cad">
      <button className="ccc-cad__toggle" onClick={toggle} aria-expanded={!collapsed}>
        <span>Call details</span>
        <span className={`ccc-cad__chevron${collapsed ? ' ccc-cad__chevron--collapsed' : ''}`}>▾</span>
      </button>
      {!collapsed && (
        <dl className="ccc-cad__list">
          {entries.map((e) => (
            <React.Fragment key={e.name}>
              <dt>{e.displayName}</dt>
              <dd>{e.value || '—'}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}
