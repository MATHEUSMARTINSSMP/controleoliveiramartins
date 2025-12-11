-- =====================================================
-- CORRIGIR RLS DA TABELA time_clock_hours_balance
-- =====================================================
-- A tabela já existe mas está sem políticas RLS adequadas (UNRESTRICTED)
-- Esta migração adiciona as políticas corretas

-- Habilitar RLS (se não estiver habilitado)
ALTER TABLE sistemaretiradas.time_clock_hours_balance ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "time_clock_hours_balance_admin_read" ON sistemaretiradas.time_clock_hours_balance;
DROP POLICY IF EXISTS "time_clock_hours_balance_admin_write" ON sistemaretiradas.time_clock_hours_balance;
DROP POLICY IF EXISTS "time_clock_hours_balance_loja_read" ON sistemaretiradas.time_clock_hours_balance;
DROP POLICY IF EXISTS "time_clock_hours_balance_colaboradora_read" ON sistemaretiradas.time_clock_hours_balance;

-- Política: Admin vê saldos da sua loja
CREATE POLICY "time_clock_hours_balance_admin_read"
ON sistemaretiradas.time_clock_hours_balance
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'ADMIN'
          AND is_active = true
          AND id IN (
              SELECT admin_id FROM sistemaretiradas.stores WHERE id = time_clock_hours_balance.store_id
          )
    )
);

-- Política: Admin pode inserir/atualizar saldos da sua loja
CREATE POLICY "time_clock_hours_balance_admin_write"
ON sistemaretiradas.time_clock_hours_balance
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'ADMIN'
          AND is_active = true
          AND id IN (
              SELECT admin_id FROM sistemaretiradas.stores WHERE id = time_clock_hours_balance.store_id
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'ADMIN'
          AND is_active = true
          AND id IN (
              SELECT admin_id FROM sistemaretiradas.stores WHERE id = time_clock_hours_balance.store_id
          )
    )
);

-- Política: Colaboradora vê seu próprio saldo
CREATE POLICY "time_clock_hours_balance_colaboradora_read"
ON sistemaretiradas.time_clock_hours_balance
FOR SELECT
TO authenticated
USING (
    -- Colaboradora pode ver seu próprio saldo
    (colaboradora_id = auth.uid() AND EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'COLABORADORA'
          AND is_active = true
    ))
    OR
    -- LOJA pode ver saldos das colaboradoras da sua loja
    (EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p_loja
        WHERE p_loja.id = auth.uid()
          AND p_loja.role = 'LOJA'
          AND p_loja.is_active = true
          AND time_clock_hours_balance.store_id = p_loja.store_id
    ))
    OR
    -- Admin pode ver saldos da sua loja
    (EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'ADMIN'
          AND is_active = true
          AND id IN (
              SELECT admin_id FROM sistemaretiradas.stores WHERE id = time_clock_hours_balance.store_id
          )
    ))
);

-- Comentário
COMMENT ON TABLE sistemaretiradas.time_clock_hours_balance IS 'Saldo consolidado de banco de horas por colaboradora/loja';

