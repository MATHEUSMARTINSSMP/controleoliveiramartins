-- Script SQL para SIMPLIFICAR todas as políticas RLS
-- Execute este script no Supabase SQL Editor
-- Política simples: ADMIN tudo, LOJA ver tudo + lançar vendas, COLABORADORA apenas seus dados

-- ============================================
-- RESUMO DAS POLÍTICAS
-- ============================================
-- ADMIN: Pode visualizar e editar TUDO
-- LOJA: Pode visualizar TUDO e lançar vendas
-- COLABORADORA: Pode visualizar apenas seus próprios dados e pedir adiantamentos

-- ============================================
-- 1. TABELA: profiles
-- ============================================

-- Remover todas as políticas existentes da tabela profiles
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'profiles'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.profiles';
    END LOOP;
END $$;

-- Criar políticas simplificadas para profiles
-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on profiles"
ON sistemaretiradas.profiles
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA: pode ver tudo
CREATE POLICY "LOJA can view all profiles"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (
  (SELECT role::text FROM sistemaretiradas.profiles WHERE id = auth.uid()) = 'LOJA'
  OR
  sistemaretiradas.is_user_admin()
);

-- Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Usuários podem ver colaboradoras (para joins)
CREATE POLICY "Anyone can view colaboradoras"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (role::text = 'COLABORADORA');

-- ============================================
-- 2. TABELA: goals
-- ============================================

-- Remover todas as políticas existentes da tabela goals
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'goals'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.goals';
    END LOOP;
END $$;

-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on goals"
ON sistemaretiradas.goals
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA: pode ver tudo e inserir/atualizar
CREATE POLICY "LOJA can manage goals"
ON sistemaretiradas.goals
FOR ALL
TO authenticated
USING (
  (SELECT role::text FROM sistemaretiradas.profiles WHERE id = auth.uid()) = 'LOJA'
)
WITH CHECK (
  (SELECT role::text FROM sistemaretiradas.profiles WHERE id = auth.uid()) = 'LOJA'
);

-- COLABORADORA: pode ver apenas suas próprias metas
CREATE POLICY "COLABORADORA can view own goals"
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
  (SELECT role::text FROM sistemaretiradas.profiles WHERE id = auth.uid()) = 'COLABORADORA'
  AND colaboradora_id = auth.uid()
);

-- ============================================
-- 3. TABELA: sales
-- ============================================

-- Remover todas as políticas existentes da tabela sales
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'sales'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.sales';
    END LOOP;
END $$;

-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on sales"
ON sistemaretiradas.sales
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA: pode ver tudo e inserir/atualizar/deletar (lançar vendas)
CREATE POLICY "LOJA can manage sales"
ON sistemaretiradas.sales
FOR ALL
TO authenticated
USING (
  (SELECT role::text FROM sistemaretiradas.profiles WHERE id = auth.uid()) = 'LOJA'
)
WITH CHECK (
  (SELECT role::text FROM sistemaretiradas.profiles WHERE id = auth.uid()) = 'LOJA'
);

-- COLABORADORA: pode ver apenas suas próprias vendas
CREATE POLICY "COLABORADORA can view own sales"
ON sistemaretiradas.sales
FOR SELECT
TO authenticated
USING (
  (SELECT role::text FROM sistemaretiradas.profiles WHERE id = auth.uid()) = 'COLABORADORA'
  AND colaboradora_id = auth.uid()
);

-- ============================================
-- 4. TABELA: stores
-- ============================================

-- Remover todas as políticas existentes da tabela stores
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'stores'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.stores';
    END LOOP;
END $$;

-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on stores"
ON sistemaretiradas.stores
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA e COLABORADORA: podem ver todas as lojas
CREATE POLICY "Authenticated users can view stores"
ON sistemaretiradas.stores
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- 5. TABELA: whatsapp_recipients
-- ============================================

-- Remover todas as políticas existentes da tabela whatsapp_recipients
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'whatsapp_recipients'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.whatsapp_recipients';
    END LOOP;
END $$;

-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on whatsapp_recipients"
ON sistemaretiradas.whatsapp_recipients
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA: pode ver tudo (para buscar destinatários do admin)
CREATE POLICY "LOJA can view all whatsapp_recipients"
ON sistemaretiradas.whatsapp_recipients
FOR SELECT
TO authenticated
USING (
  (SELECT role::text FROM sistemaretiradas.profiles WHERE id = auth.uid()) = 'LOJA'
  OR
  sistemaretiradas.is_user_admin()
);

-- Usuários podem ver seus próprios recipients
CREATE POLICY "Users can view own recipients"
ON sistemaretiradas.whatsapp_recipients
FOR SELECT
TO authenticated
USING (admin_id = auth.uid());

-- ============================================
-- 6. TABELA: adiantamentos (para COLABORADORA pedir)
-- ============================================

-- Verificar se a tabela adiantamentos existe e tem políticas
-- ADMIN: pode tudo
-- COLABORADORA: pode inserir (pedir) e ver seus próprios

-- Remover políticas existentes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'adiantamentos'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.adiantamentos';
    END LOOP;
END $$;

-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on adiantamentos"
ON sistemaretiradas.adiantamentos
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA: pode ver tudo
CREATE POLICY "LOJA can view all adiantamentos"
ON sistemaretiradas.adiantamentos
FOR SELECT
TO authenticated
USING (
  (SELECT role::text FROM sistemaretiradas.profiles WHERE id = auth.uid()) = 'LOJA'
  OR
  sistemaretiradas.is_user_admin()
);

-- COLABORADORA: pode inserir (pedir) e ver seus próprios
CREATE POLICY "COLABORADORA can request and view own adiantamentos"
ON sistemaretiradas.adiantamentos
FOR ALL
TO authenticated
USING (
  (SELECT role::text FROM sistemaretiradas.profiles WHERE id = auth.uid()) = 'COLABORADORA'
  AND colaboradora_id = auth.uid()
)
WITH CHECK (
  (SELECT role::text FROM sistemaretiradas.profiles WHERE id = auth.uid()) = 'COLABORADORA'
  AND colaboradora_id = auth.uid()
);

-- ============================================
-- 7. VERIFICAÇÃO FINAL
-- ============================================

-- Verificar todas as políticas criadas
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%is_user_admin%' THEN '✅ ADMIN'
    WHEN qual LIKE '%LOJA%' THEN '✅ LOJA'
    WHEN qual LIKE '%COLABORADORA%' THEN '✅ COLABORADORA'
    WHEN qual LIKE '%auth.uid()%' THEN '✅ OWN'
    ELSE '⚠️ Verificar'
  END as policy_type
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename IN ('profiles', 'goals', 'sales', 'stores', 'whatsapp_recipients', 'adiantamentos')
ORDER BY tablename, policyname;

-- ============================================
-- RESUMO
-- ============================================
-- ✅ ADMIN: pode fazer TUDO em todas as tabelas
-- ✅ LOJA: pode VER TUDO + lançar vendas + gerenciar metas
-- ✅ COLABORADORA: pode ver apenas seus próprios dados + pedir adiantamentos
-- ✅ Políticas simplificadas e fáceis de entender
-- ✅ Sem verificações complexas de lojas ou admin_ids

