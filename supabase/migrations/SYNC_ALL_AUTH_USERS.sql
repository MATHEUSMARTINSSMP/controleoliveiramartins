-- ============================================================================
-- CRIAR USUÁRIOS AUTH PARA TODOS OS PROFILES EXISTENTES
-- ============================================================================
-- IMPORTANTE: Este SQL não pode criar usuários Auth diretamente
-- O Supabase Auth requer uso da Admin API
-- 
-- SOLUÇÃO: Execute o script Node.js abaixo
-- ============================================================================

-- PASSO 1: Execute este comando no terminal do projeto:
-- node scripts/sync-all-auth-users.mjs

-- O script irá:
-- 1. Buscar todos os profiles de COLABORADORAS ativas
-- 2. Verificar quais NÃO têm usuário Auth correspondente
-- 3. Criar usuário Auth para cada profile sem usuário
-- 4. Atualizar o ID do profile para corresponder ao ID do Auth
-- 5. Exibir relatório completo de sucesso/falhas

-- ============================================================================
-- VERIFICAÇÃO: Após executar o script, verifique se todos têm Auth
-- ============================================================================

-- 1. Listar profiles SEM usuário Auth correspondente
SELECT 
    p.id,
    p.name,
    p.email,
    p.role,
    p.store_default,
    p.is_active,
    'SEM AUTH USER' as status
FROM sistemaretiradas.profiles p
WHERE p.role = 'COLABORADORA'
  AND p.is_active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM auth.users u 
    WHERE u.id = p.id
  )
ORDER BY p.name;

-- 2. Listar profiles COM usuário Auth correspondente
SELECT 
    p.id,
    p.name,
    p.email,
    p.role,
    p.store_default,
    p.is_active,
    u.email_confirmed_at,
    u.last_sign_in_at,
    'COM AUTH USER' as status
FROM sistemaretiradas.profiles p
INNER JOIN auth.users u ON u.id = p.id
WHERE p.role = 'COLABORADORA'
  AND p.is_active = true
ORDER BY p.name;

-- 3. Contar totais
SELECT 
    COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)) as com_auth,
    COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)) as sem_auth,
    COUNT(*) as total
FROM sistemaretiradas.profiles p
WHERE p.role = 'COLABORADORA'
  AND p.is_active = true;

-- ============================================================================
-- GARANTIA FUTURA: Trigger para prevenir criação de profile sem Auth
-- ============================================================================
-- NOTA: Não é possível criar um trigger que force a criação de Auth user
-- A solução é garantir que a função create-colaboradora SEMPRE crie ambos
-- 
-- A função create-colaboradora JÁ FAZ ISSO CORRETAMENTE (linha 78-86)
-- O problema foi com profiles criados antes da função ser corrigida
-- ============================================================================
