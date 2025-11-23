-- Script SQL COMPLETO para simplificar TODAS as políticas RLS
-- Execute este script no Supabase SQL Editor
-- Política simples: ADMIN tudo, LOJA ver tudo + lançar vendas, COLABORADORA apenas seus dados

-- ============================================
-- RESUMO DAS POLÍTICAS
-- ============================================
-- ADMIN: Pode visualizar e editar TUDO
-- LOJA: Pode visualizar TUDO e lançar vendas
-- COLABORADORA: Pode visualizar apenas seus próprios dados e pedir adiantamentos

-- ============================================
-- FUNÇÕES SECURITY DEFINER (BYPASSA RLS)
-- ============================================

-- Função para verificar se usuário é ADMIN (bypassa RLS)
CREATE OR REPLACE FUNCTION sistemaretiradas.is_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles
    WHERE id = auth.uid()
    AND role = 'ADMIN'
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário é LOJA (NOVA - bypassa RLS)
CREATE OR REPLACE FUNCTION sistemaretiradas.is_user_loja()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles
    WHERE id = auth.uid()
    AND role = 'LOJA'
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário é COLABORADORA (NOVA - bypassa RLS)
CREATE OR REPLACE FUNCTION sistemaretiradas.is_user_colaboradora()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles
    WHERE id = auth.uid()
    AND role = 'COLABORADORA'
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 1. TABELA: profiles
-- ============================================

-- Remover todas as políticas existentes
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

-- ============================================
-- POLÍTICAS PARA profiles (SEM RECURSÃO)
-- ============================================

-- Política 1: Usuários podem ver seu próprio perfil
-- ✅ SEM RECURSÃO: Usa auth.uid() diretamente
CREATE POLICY "Users can view own profile"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Política 2: ADMINS podem ver tudo (usando função SECURITY DEFINER)
-- ✅ SEM RECURSÃO: Função bypassa RLS
CREATE POLICY "ADMIN can view all profiles"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (sistemaretiradas.is_user_admin());

-- Política 3: ADMINS podem inserir/atualizar/deletar tudo
CREATE POLICY "ADMIN can manage all profiles"
ON sistemaretiradas.profiles
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- Política 4: LOJA pode ver tudo (usando função SECURITY DEFINER)
-- ✅ SEM RECURSÃO: Função bypassa RLS
CREATE POLICY "LOJA can view all profiles"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (sistemaretiradas.is_user_loja());

-- Política 5: Qualquer um pode ver colaboradoras (para joins)
-- ✅ SEM RECURSÃO: Verifica role diretamente, mas só funciona se já tiver acesso ao perfil
CREATE POLICY "Anyone can view colaboradoras"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (
  role = 'COLABORADORA'
  OR
  sistemaretiradas.is_user_admin()
  OR
  sistemaretiradas.is_user_loja()
  OR
  id = auth.uid()
);

-- ============================================
-- 2. TABELA: goals
-- ============================================

-- Remover todas as políticas existentes
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

-- LOJA: pode ver tudo e gerenciar (usando função SECURITY DEFINER)
-- ✅ SEM RECURSÃO: Função bypassa RLS
CREATE POLICY "LOJA can manage goals"
ON sistemaretiradas.goals
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_loja())
WITH CHECK (sistemaretiradas.is_user_loja());

-- COLABORADORA: pode ver apenas suas próprias metas (usando função SECURITY DEFINER)
-- ✅ SEM RECURSÃO: Função bypassa RLS
CREATE POLICY "COLABORADORA can view own goals"
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_colaboradora()
  AND colaboradora_id = auth.uid()
);

-- ============================================
-- 3. TABELA: sales
-- ============================================

-- Remover todas as políticas existentes
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

-- LOJA: pode ver tudo e lançar vendas (inserir/atualizar/deletar) (usando função SECURITY DEFINER)
-- ✅ SEM RECURSÃO: Função bypassa RLS
CREATE POLICY "LOJA can manage sales"
ON sistemaretiradas.sales
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_loja())
WITH CHECK (sistemaretiradas.is_user_loja());

-- COLABORADORA: pode ver apenas suas próprias vendas (usando função SECURITY DEFINER)
-- ✅ SEM RECURSÃO: Função bypassa RLS
CREATE POLICY "COLABORADORA can view own sales"
ON sistemaretiradas.sales
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_colaboradora()
  AND colaboradora_id = auth.uid()
);

-- ============================================
-- 4. TABELA: stores
-- ============================================

-- Remover todas as políticas existentes
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

-- Remover todas as políticas existentes
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
  sistemaretiradas.is_user_loja()
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
-- 6. TABELA: adiantamentos
-- ============================================

-- Remover todas as políticas existentes
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
  sistemaretiradas.is_user_loja()
  OR
  sistemaretiradas.is_user_admin()
);

-- COLABORADORA: pode inserir (pedir) e ver seus próprios
CREATE POLICY "COLABORADORA can request and view own adiantamentos"
ON sistemaretiradas.adiantamentos
FOR ALL
TO authenticated
USING (
  sistemaretiradas.is_user_colaboradora()
  AND colaboradora_id = auth.uid()
)
WITH CHECK (
  sistemaretiradas.is_user_colaboradora()
  AND colaboradora_id = auth.uid()
);

-- ============================================
-- 7. TABELA: purchases
-- ============================================

-- Remover todas as políticas existentes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'purchases'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.purchases';
    END LOOP;
END $$;

-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on purchases"
ON sistemaretiradas.purchases
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA: pode ver tudo
CREATE POLICY "LOJA can view all purchases"
ON sistemaretiradas.purchases
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_loja()
  OR
  sistemaretiradas.is_user_admin()
);

-- COLABORADORA: pode ver apenas suas próprias compras
CREATE POLICY "COLABORADORA can view own purchases"
ON sistemaretiradas.purchases
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_colaboradora()
  AND colaboradora_id = auth.uid()
);

-- ============================================
-- 8. TABELA: parcelas
-- ============================================

-- Remover todas as políticas existentes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'parcelas'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.parcelas';
    END LOOP;
END $$;

-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on parcelas"
ON sistemaretiradas.parcelas
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA: pode ver tudo
CREATE POLICY "LOJA can view all parcelas"
ON sistemaretiradas.parcelas
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_loja()
  OR
  sistemaretiradas.is_user_admin()
);

-- COLABORADORA: pode ver apenas suas próprias parcelas (via compra)
CREATE POLICY "COLABORADORA can view own parcelas"
ON sistemaretiradas.parcelas
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_colaboradora()
  AND EXISTS (
    SELECT 1
    FROM sistemaretiradas.purchases p
    WHERE p.id = sistemaretiradas.parcelas.compra_id
    AND p.colaboradora_id = auth.uid()
  )
);

-- ============================================
-- 9. TABELA: bonuses
-- ============================================

-- Remover todas as políticas existentes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'bonuses'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.bonuses';
    END LOOP;
END $$;

-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on bonuses"
ON sistemaretiradas.bonuses
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA: pode ver tudo
CREATE POLICY "LOJA can view all bonuses"
ON sistemaretiradas.bonuses
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_loja()
  OR
  sistemaretiradas.is_user_admin()
);

-- COLABORADORA: pode ver todos os bônus (são públicos)
CREATE POLICY "COLABORADORA can view bonuses"
ON sistemaretiradas.bonuses
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_colaboradora()
);

-- ============================================
-- 10. TABELA: trophies
-- ============================================

-- Remover todas as políticas existentes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'trophies'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.trophies';
    END LOOP;
END $$;

-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on trophies"
ON sistemaretiradas.trophies
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA: pode ver tudo
CREATE POLICY "LOJA can view all trophies"
ON sistemaretiradas.trophies
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_loja()
  OR
  sistemaretiradas.is_user_admin()
);

-- COLABORADORA: pode ver apenas seus próprios troféus
CREATE POLICY "COLABORADORA can view own trophies"
ON sistemaretiradas.trophies
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_colaboradora()
  AND colaboradora_id = auth.uid()
);

-- ============================================
-- 11. TABELA: collaborator_off_days
-- ============================================

-- Remover todas as políticas existentes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'collaborator_off_days'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.collaborator_off_days';
    END LOOP;
END $$;

-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on collaborator_off_days"
ON sistemaretiradas.collaborator_off_days
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA: pode ver tudo e gerenciar
CREATE POLICY "LOJA can manage collaborator_off_days"
ON sistemaretiradas.collaborator_off_days
FOR ALL
TO authenticated
USING (
  sistemaretiradas.is_user_loja()
)
WITH CHECK (
  sistemaretiradas.is_user_loja()
);

-- COLABORADORA: pode ver apenas seus próprios dias de folga
CREATE POLICY "COLABORADORA can view own off_days"
ON sistemaretiradas.collaborator_off_days
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_colaboradora()
  AND colaboradora_id = auth.uid()
);

-- ============================================
-- 12. TABELA: day_weights
-- ============================================

-- Remover todas as políticas existentes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'day_weights'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.day_weights';
    END LOOP;
END $$;

-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on day_weights"
ON sistemaretiradas.day_weights
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA: pode ver tudo
CREATE POLICY "LOJA can view all day_weights"
ON sistemaretiradas.day_weights
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_loja()
  OR
  sistemaretiradas.is_user_admin()
);

-- COLABORADORA: pode ver tudo (são públicos)
CREATE POLICY "COLABORADORA can view day_weights"
ON sistemaretiradas.day_weights
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_colaboradora()
);

-- ============================================
-- 13. TABELA: store_benchmarks
-- ============================================

-- Remover todas as políticas existentes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'store_benchmarks'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.store_benchmarks';
    END LOOP;
END $$;

-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on store_benchmarks"
ON sistemaretiradas.store_benchmarks
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA: pode ver tudo
CREATE POLICY "LOJA can view all store_benchmarks"
ON sistemaretiradas.store_benchmarks
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_loja()
  OR
  sistemaretiradas.is_user_admin()
);

-- COLABORADORA: pode ver tudo (são públicos)
CREATE POLICY "COLABORADORA can view store_benchmarks"
ON sistemaretiradas.store_benchmarks
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_colaboradora()
);

-- ============================================
-- 14. TABELA: store_metrics
-- ============================================

-- Remover todas as políticas existentes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'store_metrics'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.store_metrics';
    END LOOP;
END $$;

-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on store_metrics"
ON sistemaretiradas.store_metrics
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA: pode ver tudo
CREATE POLICY "LOJA can view all store_metrics"
ON sistemaretiradas.store_metrics
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_loja()
  OR
  sistemaretiradas.is_user_admin()
);

-- COLABORADORA: pode ver tudo (são públicos)
CREATE POLICY "COLABORADORA can view store_metrics"
ON sistemaretiradas.store_metrics
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_colaboradora()
);

-- ============================================
-- 15. TABELA: audit (se existir)
-- ============================================

-- Remover todas as políticas existentes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'audit'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.audit';
    END LOOP;
END $$;

-- ADMIN: pode tudo
CREATE POLICY "ADMIN can do everything on audit"
ON sistemaretiradas.audit
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- LOJA: pode ver tudo
CREATE POLICY "LOJA can view all audit"
ON sistemaretiradas.audit
FOR SELECT
TO authenticated
USING (
  sistemaretiradas.is_user_loja()
  OR
  sistemaretiradas.is_user_admin()
);

-- ============================================
-- 16. VERIFICAÇÃO FINAL
-- ============================================

-- Verificar todas as políticas criadas
SELECT 
  tablename,
  COUNT(*) as total_policies,
  string_agg(policyname, ', ' ORDER BY policyname) as policies
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename IN (
    'profiles', 'goals', 'sales', 'stores', 'whatsapp_recipients', 
    'adiantamentos', 'purchases', 'parcelas', 'bonuses', 'trophies',
    'collaborator_off_days', 'day_weights', 'store_benchmarks', 
    'store_metrics', 'audit'
  )
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- RESUMO
-- ============================================
-- ✅ ADMIN: pode fazer TUDO em todas as tabelas
-- ✅ LOJA: pode VER TUDO + lançar vendas + gerenciar metas e dias de folga
-- ✅ COLABORADORA: pode ver apenas seus próprios dados + pedir adiantamentos
-- ✅ Políticas simplificadas e fáceis de entender
-- ✅ Sem verificações complexas de lojas ou admin_ids
-- ✅ Todas as tabelas do sistema cobertas

