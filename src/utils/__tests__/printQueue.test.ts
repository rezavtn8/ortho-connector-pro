import { describe, it, expect } from 'vitest';
import { buildPrintQueue, type LabelData } from '../pdfLabelGenerator';

const label = (contact: string): LabelData => ({
  contact,
  address1: '1 Elm St',
  address2: '',
  city: 'Boston',
  state: 'MA',
  zip: '02108',
});

describe('buildPrintQueue', () => {
  it('returns the labels untouched by default', () => {
    const queue = buildPrintQueue([label('A'), label('B')]);
    expect(queue.map(l => l.contact)).toEqual(['A', 'B']);
  });

  it('pads skipped slots so a partly used sheet lines up', () => {
    const queue = buildPrintQueue([label('A')], { startOffset: 3 });
    expect(queue).toHaveLength(4);
    expect(queue.slice(0, 3).every(l => l.blank)).toBe(true);
    expect(queue[3].contact).toBe('A');
  });

  it('repeats each label consecutively when copies > 1', () => {
    const queue = buildPrintQueue([label('A'), label('B')], { copies: 3 });
    expect(queue.map(l => l.contact)).toEqual(['A', 'A', 'A', 'B', 'B', 'B']);
  });

  it('applies the offset once, before any copies', () => {
    const queue = buildPrintQueue([label('A')], { copies: 2, startOffset: 2 });
    expect(queue.map(l => l.blank ?? false)).toEqual([true, true, false, false]);
  });
});
