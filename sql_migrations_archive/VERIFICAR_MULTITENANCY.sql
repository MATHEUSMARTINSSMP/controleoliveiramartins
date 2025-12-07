-- ============================================================================
-- VERIFICAÇÃO COMPLETA DE MULTI-TENANCY
-- ============================================================================
-- Verifica se o sistema está 100% pronto para multi-tenancy:
-- 1. Admin tem acesso a todas as suas lojas
-- 2. Lojas têm acesso a todas as suas colaboradoras
-- 3. Colaboradoras têm acesso apenas aos seus dados
-- 4. Usuários podem ter várias lojas vinculadas
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR ESTRUTURA DA TABELA STORES
-- ============================================================================
SELECT 
    '1. ESTRUTURA STORES' as secao,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'stores'
ORDER BY ordinal_position;

-- Verificar se admin_id existe e tem valores
SELECT 
    '1.1. STORES COM ADMIN_ID' as secao,
    COUNT(*) as total_stores,
    COUNT(admin_id) as stores_com_admin_id,
    COUNT(DISTINCT admin_id) as admins_diferentes,
    COUNT(*) - COUNT(admin_id) as stores_sem_admin_id
FROM sistemaretiradas.stores
WHERE active = true;

-- Listar exemplos de stores e seus admins
SELECT 
    '1.2. EXEMPLOS STORES-ADMIN' as secao,
    s.id as store_id,
    s.name as store_name,
    s.admin_id,
    p.name as admin_name,
    p.email as admin_email
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.profiles p ON p.id = s.admin_id
WHERE s.active = true
LIMIT 10;

-- ============================================================================
-- 2. VERIFICAR ESTRUTURA DA TABELA PROFILES
-- ============================================================================
SELECT 
    '2. ESTRUTURA PROFILES' as secao,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'profiles'
  AND column_name IN ('store_id', 'store_default', 'role')
ORDER BY ordinal_position;

-- Verificar distribuição de roles
SELECT 
    '2.1. DISTRIBUIÇÃO DE ROLES' as secao,
    role,
    COUNT(*) as total,
    COUNT(store_id) as com_store_id,
    COUNT(store_default) as com_store_default
FROM sistemaretiradas.profiles
WHERE active = true
GROUP BY role;

-- ============================================================================
-- 3. VERIFICAR RELACIONAMENTOS ADMIN-LOJA-COLABORADORA
-- ============================================================================
-- Admin e suas lojas
SELECT 
    '3.1. ADMINS E SUAS LOJAS' as secao,
    p.id as admin_id,
    p.name as admin_name,
    p.email as admin_email,
    COUNT(DISTINCT s.id) as total_lojas,
    STRING_AGG(s.name, ', ' ORDER BY s.name) as nomes_lojas
FROM sistemaretiradas.profiles p
LEFT JOIN sistemaretiradas.stores s ON s.admin_id = p.id AND s.active = true
WHERE p.role = 'ADMIN' AND p.active = true
GROUP BY p.id, p.name, p.email
ORDER BY total_lojas DESC;

-- Lojas e suas colaboradoras
SELECT 
    '3.2. LOJAS E SUAS COLABORADORAS' as secao,
    s.id as store_id,
    s.name as store_name,
    s.admin_id,
    COUNT(DISTINCT p.id) as total_colaboradoras,
    STRING_AGG(p.name, ', ' ORDER BY p.name) as nomes_colaboradoras
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.profiles p ON p.store_id = s.id 
    AND p.role = 'COLABORADORA' 
    AND p.active = true
WHERE s.active = true
GROUP BY s.id, s.name, s.admin_id
ORDER BY total_colaboradoras DESC
LIMIT 10;

-- ============================================================================
-- 4. VERIFICAR RLS (ROW LEVEL SECURITY)
-- ============================================================================
-- Verificar se RLS está habilitado nas tabelas principais
SELECT 
    '4.1. STATUS RLS' as secao,
    tablename,
    rowsecurity as rls_habilitado
FROM pg_tables
WHERE schemaname = 'sistemaretiradas'
  AND tablename IN (
    'stores', 'profiles', 'sales', 'goals', 
    'cashback_transactions', 'cashback_balance',
    'tiny_orders', 'tiny_contacts', 'adiantamentos', 'compras'
  )
ORDER BY tablename;

-- Verificar políticas RLS existentes
SELECT 
    '4.2. POLÍTICAS RLS' as secao,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as operacao,
    qual as condicao_using,
    with_check as condicao_with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename IN (
    'stores', 'profiles', 'sales', 'goals', 
    'cashback_transactions', 'cashback_balance',
    'tiny_orders', 'tiny_contacts', 'adiantamentos', 'compras'
  )
ORDER BY tablename, policyname;

-- ============================================================================
-- 5. VERIFICAR CAMPOS DE MULTI-TENANCY NAS TABELAS PRINCIPAIS
-- ============================================================================
-- Verificar se tabelas têm campos store_id/admin_id/colaboradora_id
SELECT 
    '5. CAMPOS MULTI-TENANCY' as secao,
    t.table_name,
    STRING_AGG(c.column_name, ', ' ORDER BY c.column_name) as campos_multitenancy
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON 
    c.table_schema = t.table_schema 
    AND c.table_name = t.table_name
    AND c.column_name IN ('store_id', 'admin_id', 'colaboradora_id', 'loja_id')
WHERE t.table_schema = 'sistemaretiradas'
  AND t.table_name IN (
    'stores', 'profiles', 'sales', 'goals', 
    'cashback_transactions', 'cashback_balance',
    'tiny_orders', 'tiny_contacts', 'adiantamentos', 'compras'
  )
GROUP BY t.table_name
ORDER BY t.table_name;

-- ============================================================================
-- 6. VERIFICAR POLÍTICAS RLS QUE USAM ADMIN_ID
-- ============================================================================
SELECT 
    '6. POLÍTICAS COM ADMIN_ID' as secao,
    tablename,
    policyname,
    qual as condicao
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND (
    qual::text LIKE '%admin_id%' 
    OR with_check::text LIKE '%admin_id%'
  )
ORDER BY tablename, policyname;

-- ============================================================================
-- 7. VERIFICAR POLÍTICAS RLS QUE USAM STORE_ID
-- ============================================================================
SELECT 
    '7. POLÍTICAS COM STORE_ID' as secao,
    tablename,
    policyname,
    qual as condicao
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND (
    qual::text LIKE '%store_id%' 
    OR with_check::text LIKE '%store_id%'
  )
ORDER BY tablename, policyname;

-- ============================================================================
-- 8. VERIFICAR SE HÁ DADOS SEM VINCULAÇÃO (PROBLEMAS DE MULTI-TENANCY)
-- ============================================================================
-- Stores sem admin_id
SELECT 
    '8.1. STORES SEM ADMIN_ID' as secao,
    COUNT(*) as total
FROM sistemaretiradas.stores
WHERE active = true AND admin_id IS NULL;

-- Sales sem store_id
SELECT 
    '8.2. SALES SEM STORE_ID' as secao,
    COUNT(*) as total
FROM sistemaretiradas.sales
WHERE store_id IS NULL;

-- Goals sem store_id
SELECT 
    '8.3. GOALS SEM STORE_ID' as secao,
    COUNT(*) as total
FROM sistemaretiradas.goals
WHERE store_id IS NULL;

-- Cashback sem store_id
SELECT 
    '8.4. CASHBACK SEM STORE_ID' as secao,
    COUNT(*) as total_transactions,
    (SELECT COUNT(*) FROM sistemaretiradas.cashback_balance WHERE store_id IS NULL) as total_balances
FROM sistemaretiradas.cashback_transactions
WHERE store_id IS NULL;

-- ============================================================================
-- 9. RESUMO DE VERIFICAÇÃO
-- ============================================================================
SELECT 
    '9. RESUMO' as secao,
    'Total de Admins' as metrica,
    COUNT(*)::text as valor
FROM sistemaretiradas.profiles
WHERE role = 'ADMIN' AND active = true

UNION ALL

SELECT 
    '9. RESUMO' as secao,
    'Total de Lojas' as metrica,
    COUNT(*)::text as valor
FROM sistemaretiradas.stores
WHERE active = true

UNION ALL

SELECT 
    '9. RESUMO' as secao,
    'Lojas com Admin' as metrica,
    COUNT(*)::text as valor
FROM sistemaretiradas.stores
WHERE active = true AND admin_id IS NOT NULL

UNION ALL

SELECT 
    '9. RESUMO' as secao,
    'Total de Colaboradoras' as metrica,
    COUNT(*)::text as valor
FROM sistemaretiradas.profiles
WHERE role = 'COLABORADORA' AND active = true

UNION ALL

SELECT 
    '9. RESUMO' as secao,
    'Colaboradoras com Store' as metrica,
    COUNT(*)::text as valor
FROM sistemaretiradas.profiles
WHERE role = 'COLABORADORA' AND active = true AND store_id IS NOT NULL;

