-- ============================================================================
-- MIGRATION: Correção de RLS para Goals (Permitir ADMIN criar metas)
-- Data: 2025-12-01
-- Descrição: Adiciona políticas RLS para permitir que ADMIN crie, edite e 
--            delete metas (MENSAL e INDIVIDUAL) para suas lojas
-- ============================================================================

-- 1. Verificar se RLS está habilitado (deve estar)
ALTER TABLE sistemaretiradas.goals ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Admin pode ver metas de suas lojas" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "Admin pode criar metas para suas lojas" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "Admin pode atualizar metas de suas lojas" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "Admin pode deletar metas de suas lojas" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "Loja pode ver metas da sua loja" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "Colaboradora pode ver suas metas" ON sistemaretiradas.goals;

-- 3. Criar políticas RLS para SELECT (visualização)
CREATE POLICY "Admin pode ver metas de suas lojas"
ON sistemaretiradas.goals
FOR SELECT
USING (
  -- Admin vê metas de lojas que pertencem a ele
  EXISTS (
    SELECT 1 FROM sistemaretiradas.stores s
    WHERE s.id = goals.store_id
    AND s.admin_id = auth.uid()
  )
);

CREATE POLICY "Loja pode ver metas da sua loja"
ON sistemaretiradas.goals
FOR SELECT
USING (
  -- Usuário LOJA vê metas da loja dele
  EXISTS (
    SELECT 1 FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'LOJA'
    AND p.store_id = goals.store_id
  )
);

CREATE POLICY "Colaboradora pode ver suas metas"
ON sistemaretiradas.goals
FOR SELECT
USING (
  -- Colaboradora vê apenas suas próprias metas INDIVIDUAL
  EXISTS (
    SELECT 1 FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'COLABORADORA'
    AND (
      -- Pode ver meta INDIVIDUAL dela
      (goals.tipo = 'INDIVIDUAL' AND goals.colaboradora_id = p.id)
      OR
      -- Pode ver meta MENSAL da loja dela
      (goals.tipo = 'MENSAL' AND goals.store_id = p.store_id)
      OR
      -- Pode ver meta SEMANAL da loja dela
      (goals.tipo = 'SEMANAL' AND goals.store_id = p.store_id)
    )
  )
);

-- 4. Criar políticas RLS para INSERT (criação)
CREATE POLICY "Admin pode criar metas para suas lojas"
ON sistemaretiradas.goals
FOR INSERT
WITH CHECK (
  -- Admin pode criar metas para lojas que pertencem a ele
  EXISTS (
    SELECT 1 FROM sistemaretiradas.stores s
    WHERE s.id = goals.store_id
    AND s.admin_id = auth.uid()
  )
);

-- 5. Criar políticas RLS para UPDATE (atualização)
CREATE POLICY "Admin pode atualizar metas de suas lojas"
ON sistemaretiradas.goals
FOR UPDATE
USING (
  -- Admin pode atualizar metas de lojas que pertencem a ele
  EXISTS (
    SELECT 1 FROM sistemaretiradas.stores s
    WHERE s.id = goals.store_id
    AND s.admin_id = auth.uid()
  )
)
WITH CHECK (
  -- Garantir que a meta continua pertencendo a uma loja do admin
  EXISTS (
    SELECT 1 FROM sistemaretiradas.stores s
    WHERE s.id = goals.store_id
    AND s.admin_id = auth.uid()
  )
);

-- 6. Criar políticas RLS para DELETE (exclusão)
CREATE POLICY "Admin pode deletar metas de suas lojas"
ON sistemaretiradas.goals
FOR DELETE
USING (
  -- Admin pode deletar metas de lojas que pertencem a ele
  EXISTS (
    SELECT 1 FROM sistemaretiradas.stores s
    WHERE s.id = goals.store_id
    AND s.admin_id = auth.uid()
  )
);

-- 7. Comentários para documentação
COMMENT ON POLICY "Admin pode ver metas de suas lojas" ON sistemaretiradas.goals IS 
'Permite que ADMIN visualize todas as metas (MENSAL, INDIVIDUAL, SEMANAL) de lojas vinculadas a ele';

COMMENT ON POLICY "Admin pode criar metas para suas lojas" ON sistemaretiradas.goals IS 
'Permite que ADMIN crie metas para lojas vinculadas a ele. Resolve o problema de metas MENSAL não sendo criadas.';

COMMENT ON POLICY "Loja pode ver metas da sua loja" ON sistemaretiradas.goals IS 
'Permite que usuário LOJA visualize metas da loja dele';

COMMENT ON POLICY "Colaboradora pode ver suas metas" ON sistemaretiradas.goals IS 
'Permite que COLABORADORA visualize suas metas INDIVIDUAL e as metas MENSAL/SEMANAL da loja';

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
