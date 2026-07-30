CREATE OR REPLACE FUNCTION public.__dump_schema_ddl()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  out text := '';
  r record;
  cols text;
BEGIN
  out := out || E'-- Baseline schema dump of the production public schema\n';
  out := out || E'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;\n\n';

  out := out || E'-- ============ ENUM TYPES ============\n';
  FOR r IN
    SELECT t.typname,
           (SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder)
            FROM pg_enum e WHERE e.enumtypid = t.oid) AS labels
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
    ORDER BY t.typname
  LOOP
    out := out || format(E'DO $$ BEGIN\n  CREATE TYPE public.%I AS ENUM (%s);\nEXCEPTION WHEN duplicate_object THEN NULL; END $$;\n', r.typname, r.labels);
  END LOOP;

  out := out || E'\n-- ============ TABLES ============\n';
  FOR r IN
    SELECT c.oid, c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    SELECT string_agg(format('  %I %s%s%s', a.attname, format_type(a.atttypid, a.atttypmod),
             CASE WHEN ad.adbin IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid) ELSE '' END,
             CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END), E',\n' ORDER BY a.attnum)
      INTO cols
    FROM pg_attribute a
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped;
    out := out || format(E'CREATE TABLE IF NOT EXISTS public.%I (\n%s\n);\n', r.relname, cols);
  END LOOP;

  out := out || E'\n-- ============ COLUMNS (for pre-existing tables) ============\n';
  FOR r IN
    SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod) AS typ
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname, a.attnum
  LOOP
    out := out || format(E'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s;\n', r.relname, r.attname, r.typ);
  END LOOP;

  out := out || E'\n-- ============ CONSTRAINTS ============\n';
  FOR r IN
    SELECT c.relname AS tbl, con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY CASE con.contype WHEN 'p' THEN 1 WHEN 'u' THEN 2 WHEN 'c' THEN 3 ELSE 4 END, c.relname, con.conname
  LOOP
    out := out || format(E'DO $$ BEGIN\n  ALTER TABLE public.%I ADD CONSTRAINT %I %s;\nEXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;\n', r.tbl, r.conname, r.def);
  END LOOP;

  out := out || E'\n-- ============ INDEXES ============\n';
  FOR r IN
    SELECT i.indexrelid::regclass::text AS iname, pg_get_indexdef(i.indexrelid) AS def
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conindid = i.indexrelid)
    ORDER BY 1
  LOOP
    out := out || replace(replace(r.def, 'CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS '), 'CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ') || E';\n';
  END LOOP;

  out := out || E'\n-- ============ FUNCTIONS ============\n';
  FOR r IN
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind IN ('f','p') AND p.proname <> '__dump_schema_ddl'
    ORDER BY p.proname
  LOOP
    out := out || r.def || E';\n\n';
  END LOOP;

  out := out || E'\n-- ============ VIEWS ============\n';
  FOR r IN
    SELECT c.relname, pg_get_viewdef(c.oid, true) AS def
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('v','m')
    ORDER BY c.relname
  LOOP
    out := out || format(E'CREATE OR REPLACE VIEW public.%I AS\n%s\n\n', r.relname, r.def);
  END LOOP;

  out := out || E'\n-- ============ TRIGGERS ============\n';
  FOR r IN
    SELECT t.tgname, c.relname, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname
  LOOP
    out := out || format(E'DROP TRIGGER IF EXISTS %I ON public.%I;\n%s;\n', r.tgname, r.relname, r.def);
  END LOOP;

  out := out || E'\n-- ============ GRANTS ============\n';
  FOR r IN
    SELECT table_name, grantee, string_agg(DISTINCT privilege_type, ', ') AS privs
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee IN ('anon','authenticated','service_role')
    GROUP BY table_name, grantee
    ORDER BY table_name, grantee
  LOOP
    out := out || format(E'GRANT %s ON public.%I TO %I;\n', r.privs, r.table_name, r.grantee);
  END LOOP;

  out := out || E'\n-- ============ ROW LEVEL SECURITY ============\n';
  FOR r IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    ORDER BY c.relname
  LOOP
    out := out || format(E'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;\n', r.relname);
  END LOOP;

  out := out || E'\n-- ============ POLICIES ============\n';
  FOR r IN
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  LOOP
    out := out || format(E'DROP POLICY IF EXISTS %I ON public.%I;\n', r.policyname, r.tablename);
    out := out || format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
      r.policyname, r.tablename, r.permissive, r.cmd, array_to_string(r.roles, ', '));
    IF r.qual IS NOT NULL THEN out := out || format(E'\n  USING (%s)', r.qual); END IF;
    IF r.with_check IS NOT NULL THEN out := out || format(E'\n  WITH CHECK (%s)', r.with_check); END IF;
    out := out || E';\n';
  END LOOP;

  RETURN out;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.__dump_schema_ddl() TO anon, authenticated, service_role;