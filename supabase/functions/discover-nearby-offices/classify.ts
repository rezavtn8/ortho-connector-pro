/**
 * Deciding what counts as a referral-worthy dental practice, and what kind.
 *
 * Text search is a keyword match, not a category filter: querying
 * "dental implants" cheerfully returns dental labs, supply distributors,
 * insurance brokers and hygiene schools. None of those refer patients, so they
 * are filtered out here rather than shipped to the user as noise.
 */

/** Google place types that are unambiguously a practice we care about. */
const DENTAL_TYPES = new Set([
  "dentist",
  "dental_clinic",
  "orthodontist",
  "oral_surgeon",
  "endodontist",
  "periodontist",
  "prosthodontist",
  "pediatric_dentist",
  "dental_hygienist",
]);

/** Reads as dental but does not treat patients. */
const NON_PRACTICE_PATTERNS = [
  /\bdental (lab|laboratory|labs|supply|supplies|depot|equipment)\b/i,
  /\b(laboratory|labs)\b/i,
  /\b(insurance|benefits|billing|collections|staffing|recruit)\w*\b/i,
  /\b(school|college|university|academy|institute of technology)\b/i,
  /\b(society|association|board of dent)\w*\b/i,
  /\b(museum|library)\b/i,
  /\bdental (marketing|consulting|consultants|software|management group)\b/i,
];

/** Reads as dental in a name, ordered so specific wins over generic. */
const DENTAL_NAME_PATTERN =
  /\b(dental|dentist|dentistry|orthodont\w*|endodont\w*|periodont\w*|prosthodont\w*|oral surge\w*|maxillofacial|smile|denture\w*|invisalign)\b/i;

export interface PlaceLike {
  name: string;
  types: string[];
  primaryType: string | null;
}

/**
 * True when the place is a practice a referral network would actually contact.
 *
 * A matching Google type is trusted outright. Everything else has to earn it
 * with a dental name AND survive the non-practice patterns — that combination
 * is what keeps "Bright Smile Dental Laboratory" and every general physician
 * that text search drags in out of the results.
 */
export function isDentalPractice(place: PlaceLike): boolean {
  const types = place.types ?? [];
  const hasDentalType =
    types.some((t) => DENTAL_TYPES.has(t)) ||
    (place.primaryType != null && DENTAL_TYPES.has(place.primaryType));

  if (NON_PRACTICE_PATTERNS.some((p) => p.test(place.name))) {
    // A real clinic named "... Dental Group Laboratory" is vanishingly rare
    // next to the labs this catches, but an explicit dentist type still wins.
    return hasDentalType && !/\b(lab|laboratory|labs|supply|supplies)\b/i.test(place.name);
  }

  if (hasDentalType) return true;

  return DENTAL_NAME_PATTERN.test(place.name);
}

/**
 * Specialty label for the practice.
 *
 * Google's own type is checked first because it is curated; name keywords are
 * the fallback. Order matters — "Pediatric Orthodontics" is an orthodontic
 * practice, and the old implementation labelled it Pediatric because it tested
 * that first. Substring matching is out entirely: it labelled anything with
 * "gum" in the name as Periodontics.
 */
export function inferOfficeType(place: PlaceLike): string {
  const types = place.types ?? [];
  const name = place.name;

  const byType: Record<string, string> = {
    orthodontist: "Orthodontics",
    oral_surgeon: "Oral Surgery",
    endodontist: "Endodontics",
    periodontist: "Periodontics",
    prosthodontist: "Multi-specialty",
    pediatric_dentist: "Pediatric",
  };

  if (place.primaryType && byType[place.primaryType]) return byType[place.primaryType];
  for (const t of types) {
    if (byType[t]) return byType[t];
  }

  if (/\b(oral (and maxillofacial )?surg\w*|maxillofacial)\b/i.test(name)) return "Oral Surgery";
  if (/\borthodont\w*\b/i.test(name)) return "Orthodontics";
  if (/\bendodont\w*|\broot canal\b/i.test(name)) return "Endodontics";
  if (/\bperiodont\w*|\bgum (disease|specialist|care)\b/i.test(name)) return "Periodontics";
  if (/\b(pediatric|paediatric|children'?s|kids|childrens)\b/i.test(name)) return "Pediatric";
  if (/\b(prosthodont\w*|implant\w*|cosmetic)\b/i.test(name)) return "Multi-specialty";

  return "General Dentist";
}

/** Specialty labels, i.e. everything a general-dentist filter should exclude. */
export const SPECIALTY_TYPES = new Set([
  "Orthodontics",
  "Oral Surgery",
  "Endodontics",
  "Periodontics",
  "Multi-specialty",
]);

/**
 * Comparison key for a practice name.
 *
 * Two Google listings for one office routinely differ only in punctuation,
 * "DDS"/"DMD" suffixes or an "Inc"/"PC" tail, so those are stripped before
 * names are matched against the existing network.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    // Periods are dropped rather than turned into spaces, so "P.C." collapses
    // to "pc" and the suffix list below can actually match it.
    .replace(/\./g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(dds|dmd|md|pc|pllc|llc|inc|ltd|pa|corp)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
