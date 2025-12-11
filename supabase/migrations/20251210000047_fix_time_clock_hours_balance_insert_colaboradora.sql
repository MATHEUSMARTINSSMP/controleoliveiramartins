-- =====================================================
-- CORRIGIR RLS DE time_clock_hours_balance PARA COLABORADORAS PODEREM INSERIR
-- =====================================================
-- Colaboradoras precisam poder criar seu registro inicial de banco de horas
-- quando não existe ainda

-- Habilitar RLS (se não estiver habilitado)
ALTER TABLE sistemaretiradas.time_clock_hours_balance ENABLE ROW LEVEL SECURITY;

-- Remover política antiga de INSERT se existir
DROP POLICY IF EXISTS "time_clock_hours_balance_colaboradora_insert" ON sistemaretiradas.time_clock_hours_balance;

-- Política: Colaboradora pode criar seu próprio registro inicial de banco de horas
CREATE POLICY "time_clock_hours_balance_colaboradora_insert" 
ON sistemaretiradas.time_clock_hours_balance
FOR INSERT
TO authenticated
WITH CHECK (
    -- Verificar que o colaboradora_id corresponde ao usuário autenticado
    colaboradora_id = auth.uid()
);

-- Comentário
COMMENT ON POLICY "time_clock_hours_balance_colaboradora_insert" ON sistemaretiradas.time_clock_hours_balance IS 
'Permite que colaboradora crie seu próprio registro inicial de banco de horas';

