-- ============================================
-- TESTE ESPECÍFICO: Permissões na tabela PROFILES
-- ============================================
-- Esta query verifica se o service_role tem acesso à tabela profiles
-- ============================================

-- Verificar permissões do service_role na tabela profiles
SELECT 
  table_schema,
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'sacadaohboy-mrkitsch-loungerie'
  AND table_name = 'profiles'
  AND grantee = 'service_role'
ORDER BY privilege_type;

-- ============================================
-- RESULTADO ESPERADO:
-- ============================================
-- Deve retornar pelo menos estas permissões:
-- - SELECT (para buscar usuário)
-- - UPDATE (para atualizar senha, se necessário)
-- - INSERT (se necessário)
-- - DELETE (se necessário)
-- ============================================

-- Se não retornar resultados, execute:
-- GRANT ALL ON TABLE "sacadaohboy-mrkitsch-loungerie".profiles TO service_role;

