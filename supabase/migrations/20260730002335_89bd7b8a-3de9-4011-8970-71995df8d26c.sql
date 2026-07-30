REVOKE ALL ON FUNCTION public.__dump_schema_ddl() FROM anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.__dump_schema_ddl();