import { describe, expect, it } from 'vitest';

import {
  chooseTileRadius,
  haversineMiles,
  subdivideTile,
  tileCircle,
} from '../../../supabase/functions/discover-nearby-offices/geo.ts';
import {
  inferOfficeType,
  isDentalPractice,
  normalizeName,
} from '../../../supabase/functions/discover-nearby-offices/classify.ts';

const SANTA_ANA = { lat: 33.7455, lng: -117.8677 };

/** Uniformly random points inside a disc, for coverage checks. */
function samplePointsInDisc(center: typeof SANTA_ANA, radiusMiles: number, count: number) {
  const points: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < count; i++) {
    // sqrt keeps the sample uniform by area rather than clustered at the middle.
    const r = radiusMiles * Math.sqrt((i + 0.5) / count);
    const theta = i * 2.39996; // golden angle, so the ring positions do not line up
    const north = r * Math.cos(theta);
    const east = r * Math.sin(theta);
    points.push({
      lat: center.lat + north / 69,
      lng: center.lng + east / (69.172 * Math.cos((center.lat * Math.PI) / 180)),
    });
  }
  return points;
}

describe('haversineMiles', () => {
  it('measures a known distance', () => {
    // Santa Ana to Irvine civic center, ~7 miles.
    const irvine = { lat: 33.6846, lng: -117.8265 };
    expect(haversineMiles(SANTA_ANA, irvine)).toBeGreaterThan(4);
    expect(haversineMiles(SANTA_ANA, irvine)).toBeLessThan(6);
  });

  it('is zero for the same point', () => {
    expect(haversineMiles(SANTA_ANA, SANTA_ANA)).toBe(0);
  });
});

describe('tileCircle', () => {
  // The whole point of tiling is that no part of the requested radius goes
  // unsearched. A gap here is an office the user is never shown.
  it.each([1, 3, 5, 10, 15, 25, 50])('leaves no gap at %i miles', (radius) => {
    const tileRadius = chooseTileRadius(radius, 24);
    const tiles = tileCircle(SANTA_ANA, radius, tileRadius);

    for (const point of samplePointsInDisc(SANTA_ANA, radius, 400)) {
      const covered = tiles.some((tile) => haversineMiles(tile, point) <= tileRadius);
      expect(covered).toBe(true);
    }
  });

  it('stays near the tile budget', () => {
    for (const radius of [5, 10, 25, 50]) {
      const tiles = tileCircle(SANTA_ANA, radius, chooseTileRadius(radius, 24));
      expect(tiles.length).toBeLessThanOrEqual(40);
    }
  });

  it('uses a single tile when one covers the whole radius', () => {
    expect(tileCircle(SANTA_ANA, 2, 5)).toHaveLength(1);
  });
});

describe('subdivideTile', () => {
  it('covers the parent tile with its children', () => {
    const parentRadius = 4;
    const children = subdivideTile(SANTA_ANA, parentRadius);

    for (const point of samplePointsInDisc(SANTA_ANA, parentRadius, 200)) {
      const covered = children.some((c) => haversineMiles(c, point) <= parentRadius / 2);
      expect(covered).toBe(true);
    }
  });
});

describe('isDentalPractice', () => {
  const place = (name: string, types: string[] = [], primaryType: string | null = null) => ({
    name,
    types,
    primaryType,
  });

  it('accepts practices Google typed as dental', () => {
    expect(isDentalPractice(place('Harbor Family Care', ['dentist']))).toBe(true);
    expect(isDentalPractice(place('Newport Ortho', [], 'orthodontist'))).toBe(true);
  });

  it('accepts practices identified by name alone', () => {
    expect(isDentalPractice(place('Bright Smile Dentistry', ['point_of_interest']))).toBe(true);
  });

  it('rejects the businesses keyword search drags in', () => {
    expect(isDentalPractice(place('Precision Dental Laboratory', ['store']))).toBe(false);
    expect(isDentalPractice(place('Henry Schein Dental Supply', ['store']))).toBe(false);
    expect(isDentalPractice(place('Delta Dental Insurance', ['insurance_agency']))).toBe(false);
    expect(isDentalPractice(place('USC School of Dentistry', ['university']))).toBe(false);
  });

  it('rejects unrelated physicians', () => {
    // The old filter admitted anything typed `doctor`, so a dermatologist
    // three doors down became a referral prospect.
    expect(isDentalPractice(place('Coastal Dermatology', ['doctor', 'health']))).toBe(false);
  });
});

describe('inferOfficeType', () => {
  const place = (name: string, types: string[] = [], primaryType: string | null = null) => ({
    name,
    types,
    primaryType,
  });

  it('trusts the Google type over the name', () => {
    expect(inferOfficeType(place('Aspen Family Dental', ['orthodontist']))).toBe('Orthodontics');
  });

  it('prefers the specialty when a name carries both', () => {
    expect(inferOfficeType(place('Pediatric Orthodontics of Tustin'))).toBe('Orthodontics');
  });

  it('does not read "gum" inside an unrelated word as periodontics', () => {
    expect(inferOfficeType(place('Gumbo Family Dental'))).toBe('General Dentist');
    expect(inferOfficeType(place('Gum Disease Center'))).toBe('Periodontics');
  });

  it('classifies the common specialties', () => {
    expect(inferOfficeType(place('Orange County Oral Surgery'))).toBe('Oral Surgery');
    expect(inferOfficeType(place('Endodontic Associates'))).toBe('Endodontics');
    expect(inferOfficeType(place("Children's Dental Group"))).toBe('Pediatric');
    expect(inferOfficeType(place('Smile Dental Care'))).toBe('General Dentist');
  });
});

describe('normalizeName', () => {
  it('ignores punctuation and practice suffixes when matching', () => {
    expect(normalizeName('Smith Family Dental, P.C.')).toBe(normalizeName('Smith Family Dental PC'));
    expect(normalizeName('John Doe DDS')).toBe('john doe');
  });
});
