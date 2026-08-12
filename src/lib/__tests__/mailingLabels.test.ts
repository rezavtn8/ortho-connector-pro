import { describe, it, expect } from 'vitest';
import {
  parseAddress,
  extractContactName,
  isIncomplete,
  missingFields,
  markDuplicates,
} from '../mailingLabels';

describe('parseAddress', () => {
  it('splits a standard Google Places address', () => {
    expect(parseAddress('16100 Sand Canyon Ave, Irvine, CA 92618, United States')).toEqual({
      address1: '16100 Sand Canyon Ave',
      address2: '',
      city: 'Irvine',
      state: 'CA',
      zip: '92618',
    });
  });

  it('pulls a suite out of the street line', () => {
    expect(parseAddress('16100 Sand Canyon Ave Suite 230, Irvine, CA 92618')).toMatchObject({
      address1: '16100 Sand Canyon Ave',
      address2: 'Suite 230',
    });
  });

  it('normalises the # form and STE casing', () => {
    expect(parseAddress('123 Main St #170-B, Tustin, CA 92780').address2).toBe('#170-B');
    expect(parseAddress('123 Main St STE 300, Tustin, CA 92780').address2).toBe('Ste 300');
  });

  it('keeps ZIP+4 intact', () => {
    expect(parseAddress('1 Elm St, Boston, MA 02108-1234').zip).toBe('02108-1234');
  });

  it('strips the country in either spelling', () => {
    expect(parseAddress('1 Elm St, Boston, MA 02108, USA').state).toBe('MA');
    expect(parseAddress('1 Elm St, Boston, MA 02108, United States').state).toBe('MA');
  });

  it('returns empty parts for a blank address rather than throwing', () => {
    expect(parseAddress(null)).toEqual({
      address1: '',
      address2: '',
      city: '',
      state: '',
      zip: '',
    });
  });

  it('falls back to the whole string when there is no state/ZIP to find', () => {
    expect(parseAddress('Somewhere in the office park')).toMatchObject({
      address1: 'Somewhere in the office park',
      city: '',
      state: '',
      zip: '',
    });
  });
});

describe('extractContactName', () => {
  it('finds a doctor after a separator', () => {
    expect(extractContactName('Bright Smiles: Dr. Jane Doe')).toBe('Dr. Jane Doe');
  });

  it('finds a doctor at the start', () => {
    expect(extractContactName('Dr. Jane Doe Orthodontics')).toBe('Dr. Jane Doe');
  });

  it('finds a name carrying a degree', () => {
    expect(extractContactName('Jane Doe, DDS')).toBe('Dr. Jane Doe');
  });

  it('drops the practice name trailing the doctor', () => {
    expect(extractContactName('Dr. Jane Doe Family Dentistry')).toBe('Dr. Jane Doe');
  });

  it('falls back to the office name when there is no person in it', () => {
    expect(extractContactName('Sunrise Dental Group')).toBe('Sunrise Dental Group');
    expect(extractContactName('Harbor Orthodontics')).toBe('Harbor Orthodontics');
  });

  it('treats a bare two-word personal name as a doctor', () => {
    expect(extractContactName('Jane Doe')).toBe('Dr. Jane Doe');
  });
});

describe('completeness', () => {
  const complete = { address1: '1 Elm St', address2: '', city: 'Boston', state: 'MA', zip: '02108' };

  it('accepts a full address', () => {
    expect(isIncomplete(complete)).toBe(false);
    expect(missingFields(complete)).toEqual([]);
  });

  it('names each missing part', () => {
    expect(missingFields({ ...complete, city: '', zip: '' })).toEqual(['city', 'ZIP']);
  });
});

describe('markDuplicates', () => {
  const row = (officeName: string, address1: string, zip: string) => ({
    officeName,
    address1,
    zip,
  });

  it('flags only the later occurrence', () => {
    const result = markDuplicates([
      row('Bright Smiles', '1 Elm St', '02108'),
      row('bright  smiles', '1 elm st.', '02108'),
      row('Other Office', '2 Oak St', '02109'),
    ]);

    expect(result.map(r => r.isDuplicate)).toEqual([false, true, false]);
  });

  it('treats the same name at a different address as distinct', () => {
    const result = markDuplicates([
      row('Bright Smiles', '1 Elm St', '02108'),
      row('Bright Smiles', '99 Oak St', '02110'),
    ]);

    expect(result.map(r => r.isDuplicate)).toEqual([false, false]);
  });
});
