-- ============================================
-- CONCEDER PERMISSÕES AO SCHEMA
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- URL: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/sql/new
-- ============================================

-- 1. Conceder permissão de USAGE no schema
GRANT USAGE ON SCHEMA "sacadaohboy-mrkitsch-loungerie" TO anon, authenticated, service_role;

-- 2. Conceder permissões em TODAS as tabelas existentes
GRANT ALL ON ALL TABLES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO anon, authenticated, service_role;

-- 3. Conceder permissões em TODAS as funções/rotinas
GRANT ALL ON ALL ROUTINES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO anon, authenticated, service_role;

-- 4. Conceder permissões em TODAS as sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO anon, authenticated, service_role;

-- 5. Configurar permissões padrão para tabelas FUTURAS
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "sacadaohboy-mrkitsch-loungerie" 
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- 6. Configurar permissões padrão para funções FUTURAS
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "sacadaohboy-mrkitsch-loungerie" 
  GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 7. Configurar permissões padrão para sequences FUTURAS
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "sacadaohboy-mrkitsch-loungerie" 
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ============================================
-- VERIFICAR SE FUNCIONOU
-- ============================================

-- Teste: Verificar permissões
SELECT 
  table_schema,
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'sacadaohboy-mrkitsch-loungerie'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee;

