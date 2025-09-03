/**
 * Calculate distance between two points using the Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in miles
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export const DISTANCE_OPTIONS = [
  { label: 'Walking Distance', value: 1, description: '1 mile' },
  { label: 'Very Nearby', value: 3, description: '3 miles' },
  { label: 'Local', value: 5, description: '5 miles' },
  { label: 'Extended Area', value: 10, description: '10 miles' },
  { label: 'Wider Network', value: 25, description: '25 miles' },
] as const;

export type DistanceOption = typeof DISTANCE_OPTIONS[number]['value'];