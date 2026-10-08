import { afterEach, describe, expect, it } from 'vitest';
import { clearLayers, escapeTop, layerCount, openLayer, removeLayer, topLayer, zoneHeld } from '../layers';

/* a panel as the page wires it: closing takes its ticket back */
function panel(zone: 'left' | 'right' | 'centre', log: string[], name: string, modal = false) {
  let id = 0;
  const close = () => {
    log.push(name);
    removeLayer(id);
  };
  id = openLayer(zone, close, modal);
  return id;
}

afterEach(() => clearLayers());

describe('the spike of panels', () => {
  it('lets Escape close the last panel and that one only', () => {
    const log: string[] = [];
    panel('centre', log, 'rules');
    panel('centre', log, 'card');
    expect(escapeTop()).toBe(true);
    expect(log).toEqual(['card']);
    expect(layerCount()).toBe(1);
    expect(escapeTop()).toBe(true);
    expect(log).toEqual(['card', 'rules']);
  });

  it('leaves Escape to the board when no panel is up', () => {
    expect(escapeTop()).toBe(false);
  });

  it('sends away what held an edge when a second panel takes it', () => {
    const log: string[] = [];
    panel('left', log, 'mat');
    panel('right', log, 'ledger');
    panel('left', log, 'settings');
    expect(log).toEqual(['mat']);
    expect(zoneHeld('left')).toBe(true);
    expect(topLayer()?.zone).toBe('left');
    expect(layerCount()).toBe(2);
  });

  it('lets panels in the middle stack', () => {
    const log: string[] = [];
    panel('centre', log, 'a');
    panel('centre', log, 'b');
    expect(log).toEqual([]);
    expect(layerCount()).toBe(2);
  });

  it('keeps a sheet that will not be dismissed on top', () => {
    const id = openLayer('centre', () => undefined, true);
    expect(escapeTop()).toBe(true);
    expect(topLayer()?.id).toBe(id);
    expect(topLayer()?.modal).toBe(true);
  });
});
