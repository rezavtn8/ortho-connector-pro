export interface Clinic {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  specialty: string;
  phone: string;
  email?: string;
  website?: string;
  rating?: number;
  description?: string;
}

export const CLINIC_SPECIALTIES = [
  'All Specialties',
  'Primary Care',
  'Cardiology',
  'Dermatology', 
  'Pediatrics',
  'Orthopedics',
  'Neurology',
  'Gastroenterology',
  'Endocrinology',
  'Oncology',
  'Pulmonology',
  'Rheumatology',
  'Urgent Care'
];

export const sampleClinics: Clinic[] = [
  {
    id: '1',
    name: 'Manhattan Primary Care Associates',
    address: '123 E 42nd St, New York, NY 10017',
    latitude: 40.7516,
    longitude: -73.9755,
    specialty: 'Primary Care',
    phone: '(212) 555-0123',
    email: 'info@manhattanprimary.com',
    website: 'https://manhattanprimary.com',
    rating: 4.8,
    description: 'Comprehensive primary care services for adults and families.'
  },
  {
    id: '2',
    name: 'NYC Heart & Vascular Center',
    address: '456 Park Ave, New York, NY 10022',
    latitude: 40.7589,
    longitude: -73.9711,
    specialty: 'Cardiology',
    phone: '(212) 555-0456',
    email: 'appointments@nycheart.com',
    website: 'https://nycheart.com',
    rating: 4.9,
    description: 'Leading cardiology practice specializing in heart disease prevention and treatment.'
  },
  {
    id: '3',
    name: 'Central Park Dermatology',
    address: '789 Central Park West, New York, NY 10025',
    latitude: 40.7831,
    longitude: -73.9712,
    specialty: 'Dermatology',
    phone: '(212) 555-0789',
    email: 'contact@cpdermatology.com',
    rating: 4.7,
    description: 'Expert dermatological care including medical and cosmetic services.'
  },
  {
    id: '4',
    name: 'Brooklyn Children\'s Medical Group',
    address: '321 Court St, Brooklyn, NY 11201',
    latitude: 40.6892,
    longitude: -73.9900,
    specialty: 'Pediatrics',
    phone: '(718) 555-0321',
    email: 'info@brooklynchildren.com',
    rating: 4.6,
    description: 'Dedicated pediatric care from infancy through adolescence.'
  },
  {
    id: '5',
    name: 'Upper East Side Orthopedics',
    address: '987 Lexington Ave, New York, NY 10075',
    latitude: 40.7736,
    longitude: -73.9566,
    specialty: 'Orthopedics',
    phone: '(212) 555-0987',
    email: 'schedule@uesorthopedics.com',
    rating: 4.8,
    description: 'Comprehensive orthopedic surgery and sports medicine.'
  },
  {
    id: '6',
    name: 'Queens Neurological Associates',
    address: '654 Northern Blvd, Flushing, NY 11354',
    latitude: 40.7648,
    longitude: -73.8370,
    specialty: 'Neurology',
    phone: '(718) 555-0654',
    email: 'info@queensneuro.com',
    rating: 4.5,
    description: 'Specialized neurological care and treatment.'
  },
  {
    id: '7',
    name: 'Downtown Digestive Health',
    address: '159 William St, New York, NY 10038',
    latitude: 40.7092,
    longitude: -74.0055,
    specialty: 'Gastroenterology',
    phone: '(212) 555-0159',
    email: 'appointments@downtowndigestive.com',
    rating: 4.7,
    description: 'Expert gastroenterological care and endoscopic procedures.'
  },
  {
    id: '8',
    name: 'Midtown Diabetes & Endocrine Center',
    address: '753 3rd Ave, New York, NY 10017',
    latitude: 40.7505,
    longitude: -73.9733,
    specialty: 'Endocrinology',
    phone: '(212) 555-0753',
    email: 'info@midtownendocrine.com',
    rating: 4.6,
    description: 'Comprehensive diabetes care and endocrine disorder treatment.'
  },
  {
    id: '9',
    name: 'Memorial Cancer Treatment Center',
    address: '851 1st Ave, New York, NY 10065',
    latitude: 40.7614,
    longitude: -73.9598,
    specialty: 'Oncology',
    phone: '(212) 555-0851',
    email: 'oncology@memorialcancer.com',
    rating: 4.9,
    description: 'Advanced cancer treatment and oncology care.'
  },
  {
    id: '10',
    name: 'Bronx Pulmonary Associates',
    address: '486 E 149th St, Bronx, NY 10455',
    latitude: 40.8176,
    longitude: -73.9182,
    specialty: 'Pulmonology',
    phone: '(718) 555-0486',
    email: 'lung@bronxpulmonary.com',
    rating: 4.4,
    description: 'Respiratory care and lung disease treatment.'
  },
  {
    id: '11',
    name: 'Staten Island Rheumatology',
    address: '2678 Richmond Ave, Staten Island, NY 10314',
    latitude: 40.5795,
    longitude: -74.1502,
    specialty: 'Rheumatology',
    phone: '(718) 555-2678',
    email: 'care@statenrheumatology.com',
    rating: 4.5,
    description: 'Arthritis and autoimmune disease specialist care.'
  },
  {
    id: '12',
    name: 'Fast Track Urgent Care',
    address: '357 Broadway, New York, NY 10013',
    latitude: 40.7195,
    longitude: -74.0047,
    specialty: 'Urgent Care',
    phone: '(212) 555-0357',
    email: 'urgent@fasttrackcare.com',
    rating: 4.3,
    description: 'Walk-in urgent care for non-emergency medical needs.'
  },
  {
    id: '13',
    name: 'Family Health Partners',
    address: '1248 Grand Concourse, Bronx, NY 10456',
    latitude: 40.8361,
    longitude: -73.9106,
    specialty: 'Primary Care',
    phone: '(718) 555-1248',
    email: 'info@familyhealthpartners.com',
    rating: 4.6,
    description: 'Family medicine and preventive care services.'
  },
  {
    id: '14',
    name: 'Brooklyn Heart Institute',
    address: '579 Ocean Pkwy, Brooklyn, NY 11218',
    latitude: 40.6398,
    longitude: -73.9691,
    specialty: 'Cardiology',
    phone: '(718) 555-0579',
    email: 'heart@brooklynheart.com',
    rating: 4.8,
    description: 'Advanced cardiac care and intervention procedures.'
  },
  {
    id: '15',
    name: 'West Side Skin Clinic',
    address: '924 Amsterdam Ave, New York, NY 10025',
    latitude: 40.7956,
    longitude: -73.9707,
    specialty: 'Dermatology',
    phone: '(212) 555-0924',
    email: 'skin@westsideclinic.com',
    rating: 4.7,
    description: 'Dermatology and aesthetic medicine practice.'
  },
  {
    id: '16',
    name: 'Little Angels Pediatrics',
    address: '1357 Flatbush Ave, Brooklyn, NY 11210',
    latitude: 40.6259,
    longitude: -73.9476,
    specialty: 'Pediatrics',
    phone: '(718) 555-1357',
    email: 'kids@littleangels.com',
    rating: 4.9,
    description: 'Compassionate pediatric care in a child-friendly environment.'
  },
  {
    id: '17',
    name: 'Sports Medicine & Orthopedic Care',
    address: '2468 86th St, Brooklyn, NY 11214',
    latitude: 40.5942,
    longitude: -73.9967,
    specialty: 'Orthopedics',
    phone: '(718) 555-2468',
    email: 'sports@orthopediccare.com',
    rating: 4.6,
    description: 'Sports injuries and orthopedic surgery specialists.'
  },
  {
    id: '18',
    name: 'Nassau Neurological Center',
    address: '802 Hempstead Tpke, Franklin Square, NY 11010',
    latitude: 40.7053,
    longitude: -73.6765,
    specialty: 'Neurology',
    phone: '(516) 555-0802',
    email: 'neuro@nassauneurological.com',
    rating: 4.7,
    description: 'Comprehensive neurological evaluation and treatment.'
  },
  {
    id: '19',
    name: 'Digestive Care Specialists',
    address: '147 Atlantic Ave, Brooklyn, NY 11201',
    latitude: 40.6906,
    longitude: -73.9950,
    specialty: 'Gastroenterology',
    phone: '(718) 555-0147',
    email: 'gi@digestivecare.com',
    rating: 4.5,
    description: 'GI disorders and colonoscopy screening services.'
  },
  {
    id: '20',
    name: 'Express Urgent Care',
    address: '963 Northern Blvd, Great Neck, NY 11021',
    latitude: 40.7923,
    longitude: -73.7265,
    specialty: 'Urgent Care',
    phone: '(516) 555-0963',
    email: 'walk-in@expressurgent.com',
    rating: 4.4,
    description: 'Fast, convenient urgent care with extended hours.'
  }
];

// Utility function to calculate distance between two points
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Filter clinics by distance and specialty
export function filterClinics(
  clinics: Clinic[],
  userLat: number,
  userLng: number,
  radiusMiles: number,
  specialty: string
): (Clinic & { distance: number })[] {
  return clinics
    .map(clinic => ({
      ...clinic,
      distance: calculateDistance(userLat, userLng, clinic.latitude, clinic.longitude)
    }))
    .filter(clinic => {
      const withinRadius = clinic.distance <= radiusMiles;
      const matchesSpecialty = specialty === 'All Specialties' || clinic.specialty === specialty;
      return withinRadius && matchesSpecialty;
    })
    .sort((a, b) => a.distance - b.distance);
}