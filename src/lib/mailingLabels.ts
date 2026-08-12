/**
 * Address parsing and row hygiene for mailing labels.
 *
 * Office addresses arrive as a single free-text string (Google Places format for
 * discovered offices, hand-typed for partners), so everything printed on a label
 * has to be recovered from that one field.
 */

export interface ParsedAddress {
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
}

export interface LabelRow extends ParsedAddress {
  /** Stable across filter changes: `${source}:${officeId}`. Edits and selection key off this. */
  id: string;
  source: 'partner' | 'discovered';
  officeName: string;
  contactName: string;
}

const EMPTY: ParsedAddress = { address1: '', address2: '', city: '', state: '', zip: '' };

const SUITE_PATTERN = /^(.*?)[,\s]+(Suite|Unit|Apt|Ste|Building|Bldg|Floor|Fl|#)\s*(.+)$/i;

/** Normalise "Suite 100" / "STE 100" / "#100" into one consistent form. */
function formatSuite(type: string, value: string): string {
  const cleaned = value.trim().replace(/,$/, '');
  if (type === '#') return `#${cleaned}`;
  const word = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  return `${word} ${cleaned}`;
}

function splitStreetAndSuite(street: string): { address1: string; address2: string } {
  const match = street.match(SUITE_PATTERN);
  if (!match) return { address1: street.trim().replace(/,$/, ''), address2: '' };
  return {
    address1: match[1].trim().replace(/,$/, ''),
    address2: formatSuite(match[2].trim(), match[3]),
  };
}

export function parseAddress(address: string | null | undefined): ParsedAddress {
  if (!address) return { ...EMPTY };

  // Google Places appends the country; it never belongs on a domestic label.
  const cleanAddress = address.trim().replace(/,?\s*(United States|USA|US)\s*$/i, '');
  const parts = cleanAddress.split(',').map(p => p.trim()).filter(Boolean);

  if (parts.length < 2) {
    return { ...EMPTY, ...splitStreetAndSuite(cleanAddress) };
  }

  const lastPart = parts[parts.length - 1];
  const stateZipMatch = lastPart.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);

  if (stateZipMatch) {
    const street = parts.slice(0, parts.length - 2).join(', ').trim();
    return {
      ...splitStreetAndSuite(street),
      city: parts[parts.length - 2] ?? '',
      state: stateZipMatch[1].toUpperCase(),
      zip: stateZipMatch[2],
    };
  }

  // Fallback: find a state/ZIP pair anywhere in the string.
  const anywhere = cleanAddress.match(/([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
  if (!anywhere) {
    return { ...EMPTY, ...splitStreetAndSuite(cleanAddress) };
  }

  const cityMatch = cleanAddress.match(/,?\s*([^,]+?)\s*,?\s*[A-Z]{2}\s+\d{5}/);
  const city = cityMatch ? cityMatch[1].trim() : '';
  const street = city ? cleanAddress.split(city)[0] : '';

  return {
    ...splitStreetAndSuite(street),
    city,
    state: anywhere[1].toUpperCase(),
    zip: anywhere[2],
  };
}

/**
 * Words that show up in practice names but never in a person's name. Used to stop
 * "Dr. Jane Doe Orthodontics" from being addressed to "Dr. Jane Doe Orthodontics".
 */
const BUSINESS_WORDS = new Set([
  'orthodontics', 'orthodontic', 'orthodontist', 'orthodontists',
  'dental', 'dentistry', 'dentist', 'dentists',
  'endodontics', 'periodontics', 'prosthodontics', 'oral', 'maxillofacial', 'surgery',
  'pediatric', 'pediatrics', 'family', 'cosmetic', 'aesthetics', 'implants',
  'smiles', 'smile', 'care', 'health', 'medical', 'clinic', 'practice', 'office',
  'group', 'center', 'centre', 'associates', 'partners', 'specialists', 'institute',
  'studio', 'plaza', 'suite', 'pc', 'llc', 'inc', 'pa', 'dds', 'dmd',
]);

/** Drop trailing practice words, keeping at least a first and last name. */
function trimBusinessWords(name: string): string {
  const words = name.trim().split(/\s+/);
  while (words.length > 2 && BUSINESS_WORDS.has(words[words.length - 1].toLowerCase().replace(/[.,]/g, ''))) {
    words.pop();
  }
  return words.join(' ');
}

/**
 * Recover a doctor's name from an office name so labels can be addressed to a
 * person. Falls back to the office name when there is no name to find — a wrong
 * "Dr." on a group practice looks worse than no personalisation at all.
 */
export function extractContactName(officeName: string): string {
  if (!officeName) return '';

  const titled: RegExp[] = [
    // "Bright Smiles: Dr. Jane Doe" / "Bright Smiles - Dr. Jane Doe"
    /[:–-]\s*Dr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)+)/i,
    // "Dr. Jane Doe Orthodontics"
    /^Dr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)+)/i,
    // "Jane Doe, DDS"
    /([A-Z][a-z]+\s+[A-Z][a-z'-]+)\s*,?\s*(?:DDS|DMD|MD|PhD|D\.D\.S\.|D\.M\.D\.)/i,
  ];

  for (const pattern of titled) {
    const match = officeName.match(pattern);
    if (match) return `Dr. ${trimBusinessWords(match[1])}`;
  }

  // The whole office name is a person: exactly "First Last", no practice words.
  const bare = officeName.trim().match(/^([A-Z][a-z]+)\s+([A-Z][a-z'-]+)$/);
  if (bare && ![bare[1], bare[2]].some(word => BUSINESS_WORDS.has(word.toLowerCase()))) {
    return `Dr. ${bare[1]} ${bare[2]}`;
  }

  return officeName;
}

/** A row that would print an undeliverable label. */
export function isIncomplete(row: ParsedAddress): boolean {
  return !row.address1 || !row.city || !row.state || !row.zip;
}

/** Which fields are missing, for the row-level tooltip. */
export function missingFields(row: ParsedAddress): string[] {
  const missing: string[] = [];
  if (!row.address1) missing.push('street address');
  if (!row.city) missing.push('city');
  if (!row.state) missing.push('state');
  if (!row.zip) missing.push('ZIP');
  return missing;
}

/**
 * Key for detecting the same physical office arriving from both the partner list
 * and the discovery list — printing both wastes a label and annoys the recipient.
 */
export function duplicateKey(row: Pick<LabelRow, 'officeName' | 'address1' | 'zip'>): string {
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${normalise(row.officeName)}|${normalise(row.address1)}|${normalise(row.zip)}`;
}

/**
 * Flag every occurrence after the first. Partner rows are built before discovered
 * rows, so the partner record is the one that survives.
 */
export function markDuplicates<T extends Pick<LabelRow, 'officeName' | 'address1' | 'zip'>>(
  rows: T[],
): Array<T & { isDuplicate: boolean }> {
  const seen = new Set<string>();
  return rows.map(row => {
    const key = duplicateKey(row);
    const isDuplicate = seen.has(key);
    seen.add(key);
    return { ...row, isDuplicate };
  });
}
