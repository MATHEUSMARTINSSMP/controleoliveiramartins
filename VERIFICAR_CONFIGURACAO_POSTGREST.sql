-- Script para VERIFICAR se o PostgREST está configurado corretamente
-- Execute este script ANTES de executar FORCAR_SCHEMA_POSTGREST.sql

-- 1. Verificar se o schema existe
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'sacadaohboy-mrkitsch-loungerie';

-- 2. Verificar configuração atual do authenticator
SELECT 
  rolname as role_name,
  setconfig as current_config
FROM pg_roles r
LEFT JOIN pg_db_role_setting s ON r.oid = s.setrole
WHERE rolname = 'authenticator';

-- 3. Verificar se o schema está na lista de schemas expostos
-- (Isso verifica a configuração do pgrst.db_schemas)
SELECT 
  CASE 
    WHEN setconfig IS NULL THEN '❌ NÃO CONFIGURADO'
    WHEN array_to_string(setconfig, ', ') LIKE '%sacadaohboy-mrkitsch-loungerie%' THEN '✅ CONFIGURADO'
    ELSE '⚠️ CONFIGURADO MAS SEM O SCHEMA'
  END as status_configuracao,
  setconfig as schemas_configurados
FROM pg_db_role_setting
WHERE setrole = (SELECT oid FROM pg_roles WHERE rolname = 'authenticator');

-- 4. Verificar permissões do authenticator no schema
SELECT 
  nspname as schema_name,
  has_schema_privilege('authenticator', nspname, 'USAGE') as has_usage,
  has_schema_privilege('authenticator', nspname, 'CREATE') as has_create
FROM pg_namespace
WHERE nspname = 'sacadaohboy-mrkitsch-loungerie';

-- 5. Verificar se a tabela profiles existe no schema
SELECT 
  table_schema,
  table_name,
  has_table_privilege('authenticator', table_schema||'.'||table_name, 'SELECT') as can_select
FROM information_schema.tables
WHERE table_schema = 'sacadaohboy-mrkitsch-loungerie'
  AND table_name = 'profiles';

-- 6. Verificar se há dados na tabela
SELECT COUNT(*) as total_profiles
FROM "sacadaohboy-mrkitsch-loungerie".profiles;

-- 7. Verificar se o schema está na lista de schemas expostos do PostgREST
-- (Isso é verificado através da configuração do authenticator)
SELECT 
  'Para verificar se o schema está exposto, execute o script FORCAR_SCHEMA_POSTGREST.sql' as instrucao;

