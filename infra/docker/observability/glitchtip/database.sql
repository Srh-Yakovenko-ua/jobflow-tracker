SELECT 'CREATE ROLE glitchtip LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'glitchtip')\gexec

ALTER ROLE glitchtip WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'password';

SELECT 'CREATE DATABASE glitchtip OWNER glitchtip'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'glitchtip')\gexec

ALTER DATABASE glitchtip OWNER TO glitchtip;

\c glitchtip

DO $$
DECLARE
  relation record;
  routine record;
BEGIN
  FOR relation IN
    SELECT c.relname,
      CASE c.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'TABLE' END AS kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm')
      AND c.relowner <> 'glitchtip'::regrole
  LOOP
    EXECUTE format('ALTER %s public.%I OWNER TO glitchtip', relation.kind, relation.relname);
  END LOOP;

  FOR relation IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
      AND c.relowner <> 'glitchtip'::regrole
  LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO glitchtip', relation.relname);
  END LOOP;

  FOR routine IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proowner <> 'glitchtip'::regrole
      AND NOT EXISTS (
        SELECT FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('ALTER ROUTINE %s OWNER TO glitchtip', routine.signature);
  END LOOP;
END
$$;
