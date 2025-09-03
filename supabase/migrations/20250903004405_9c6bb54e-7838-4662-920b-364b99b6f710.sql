-- Clean up existing discovered_offices data and ensure proper constraints
-- Update any offices with null discovery_session_id or missing search parameters

-- First, let's update offices that have null search parameters but are linked to sessions
UPDATE public.discovered_offices 
SET 
  search_distance = ds.search_distance,
  search_location_lat = ds.search_lat,
  search_location_lng = ds.search_lng
FROM public.discovery_sessions ds
WHERE public.discovered_offices.discovery_session_id = ds.id
  AND (public.discovered_offices.search_distance IS NULL 
       OR public.discovered_offices.search_location_lat IS NULL 
       OR public.discovered_offices.search_location_lng IS NULL);

-- For offices without session links but with clinic_id, try to link them to appropriate sessions
UPDATE public.discovered_offices 
SET discovery_session_id = (
  SELECT ds.id 
  FROM public.discovery_sessions ds 
  WHERE ds.clinic_id = discovered_offices.clinic_id 
    AND ds.user_id = discovered_offices.discovered_by
    AND ABS(ds.search_distance - COALESCE(discovered_offices.search_distance, 5)) <= 1
    AND (discovered_offices.search_location_lat IS NULL OR 
         (ABS(ds.search_lat - discovered_offices.search_location_lat) < 0.01 AND 
          ABS(ds.search_lng - discovered_offices.search_location_lng) < 0.01))
  ORDER BY ds.created_at DESC 
  LIMIT 1
)
WHERE discovery_session_id IS NULL 
  AND clinic_id IS NOT NULL;

-- Set default search parameters for any remaining orphaned offices
UPDATE public.discovered_offices 
SET 
  search_distance = COALESCE(search_distance, 5),
  search_location_lat = COALESCE(search_location_lat, lat),
  search_location_lng = COALESCE(search_location_lng, lng)
WHERE search_distance IS NULL 
   OR search_location_lat IS NULL 
   OR search_location_lng IS NULL;