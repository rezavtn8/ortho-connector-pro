import { describe, it, expect } from 'vitest';
import { computeDeltaFlows } from '../deltaFlows';
import type { Flow } from '../types';

const flow = (sourceId: string, count: number, hubId = 'hub'): Flow => ({
  sourceId,
  hubId,
  count,
});

describe('computeDeltaFlows', () => {
  it('subtracts the baseline month from the current one', () => {
    const { flows } = computeDeltaFlows([flow('a', 9)], [flow('a', 4)]);
    expect(flows).toEqual([{ sourceId: 'a', hubId: 'hub', delta: 5 }]);
  });

  it('keeps an office that only appears in the current month', () => {
    // A relationship that started. Dropping it would hide a real gain.
    const { flows, gained } = computeDeltaFlows([flow('new', 6)], []);
    expect(flows).toEqual([{ sourceId: 'new', hubId: 'hub', delta: 6 }]);
    expect(gained).toBe(6);
  });

  it('keeps an office that only appears in the baseline month', () => {
    // A relationship that stopped — the single most important arc on the map.
    const { flows, lost } = computeDeltaFlows([], [flow('gone', 7)]);
    expect(flows).toEqual([{ sourceId: 'gone', hubId: 'hub', delta: -7 }]);
    expect(lost).toBe(7);
  });

  it('draws nothing for an office that did not change', () => {
    const { flows } = computeDeltaFlows([flow('same', 5)], [flow('same', 5)]);
    expect(flows).toEqual([]);
  });

  it('totals gains and losses separately', () => {
    const summary = computeDeltaFlows(
      [flow('up', 10), flow('down', 1)],
      [flow('up', 4), flow('down', 9)],
    );
    expect(summary.gained).toBe(6);
    expect(summary.lost).toBe(8);
  });

  it('reports the largest absolute change for width scaling', () => {
    const summary = computeDeltaFlows(
      [flow('a', 1), flow('b', 20)],
      [flow('a', 9), flow('b', 1)],
    );
    expect(summary.maxDelta).toBe(19);
  });

  it('never reports a zero max, which would divide by zero downstream', () => {
    expect(computeDeltaFlows([], []).maxDelta).toBe(1);
    expect(computeDeltaFlows([flow('a', 3)], [flow('a', 3)]).maxDelta).toBe(1);
  });

  it('orders smallest change first so the biggest movers draw on top', () => {
    const { flows } = computeDeltaFlows(
      [flow('small', 2), flow('big', 30)],
      [flow('small', 1), flow('big', 2)],
    );
    expect(flows.map((f) => f.sourceId)).toEqual(['small', 'big']);
  });

  it('diffs each hub leg separately', () => {
    const summary = computeDeltaFlows(
      [flow('a', 5, 'north'), flow('a', 1, 'south')],
      [flow('a', 2, 'north'), flow('a', 4, 'south')],
    );
    expect(summary.flows).toHaveLength(2);
    expect(summary.flows.find((f) => f.hubId === 'north')!.delta).toBe(3);
    expect(summary.flows.find((f) => f.hubId === 'south')!.delta).toBe(-3);
  });

  it('applies the visibility filter to both months', () => {
    // A filtered-out office must not leak in through the baseline side.
    const { flows } = computeDeltaFlows(
      [flow('keep', 5), flow('drop', 5)],
      [flow('keep', 1), flow('drop', 1)],
      (id) => id === 'keep',
    );
    expect(flows.map((f) => f.sourceId)).toEqual(['keep']);
  });
});
