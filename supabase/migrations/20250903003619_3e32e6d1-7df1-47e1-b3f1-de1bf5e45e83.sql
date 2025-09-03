-- Add foreign key constraint between discovered_offices and discovery_sessions
ALTER TABLE public.discovered_offices 
ADD CONSTRAINT fk_discovered_offices_discovery_session_id 
FOREIGN KEY (discovery_session_id) REFERENCES public.discovery_sessions(id) ON DELETE SET NULL;