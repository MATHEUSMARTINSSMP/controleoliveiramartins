-- ============================================================================
-- MIGRATION: Adicionar políticas RLS para INSERT/UPDATE/DELETE em cashback
-- Data: 2025-01-28
-- Descrição: Permite que ADMIN e LOJA insiram, atualizem e deletem transações e saldos de cashback
-- ============================================================================

-- ============================================================================
-- 1. POLÍTICAS PARA cashback_transactions
-- ============================================================================

-- INSERT: ADMIN e LOJA podem inserir transações
DROP POLICY IF EXISTS "Admin e Loja podem inserir transações de cashback" ON sistemaretiradas.cashback_transactions;
CREATE POLICY "Admin e Loja podem inserir transações de cashback"
    ON sistemaretiradas.cashback_transactions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'LOJA')
        )
    );

-- UPDATE: ADMIN e LOJA podem atualizar transações
DROP POLICY IF EXISTS "Admin e Loja podem atualizar transações de cashback" ON sistemaretiradas.cashback_transactions;
CREATE POLICY "Admin e Loja podem atualizar transações de cashback"
    ON sistemaretiradas.cashback_transactions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'LOJA')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'LOJA')
        )
    );

-- DELETE: Apenas ADMIN pode deletar transações
DROP POLICY IF EXISTS "Apenas ADMIN pode deletar transações de cashback" ON sistemaretiradas.cashback_transactions;
CREATE POLICY "Apenas ADMIN pode deletar transações de cashback"
    ON sistemaretiradas.cashback_transactions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role = 'ADMIN'
        )
    );

-- ============================================================================
-- 2. POLÍTICAS PARA cashback_balance
-- ============================================================================

-- INSERT: ADMIN e LOJA podem inserir saldos (geralmente via trigger, mas permitir manual)
DROP POLICY IF EXISTS "Admin e Loja podem inserir saldos de cashback" ON sistemaretiradas.cashback_balance;
CREATE POLICY "Admin e Loja podem inserir saldos de cashback"
    ON sistemaretiradas.cashback_balance
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'LOJA')
        )
    );

-- UPDATE: ADMIN e LOJA podem atualizar saldos (geralmente via trigger, mas permitir manual)
DROP POLICY IF EXISTS "Admin e Loja podem atualizar saldos de cashback" ON sistemaretiradas.cashback_balance;
CREATE POLICY "Admin e Loja podem atualizar saldos de cashback"
    ON sistemaretiradas.cashback_balance
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'LOJA')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'LOJA')
        )
    );

-- DELETE: Apenas ADMIN pode deletar saldos
DROP POLICY IF EXISTS "Apenas ADMIN pode deletar saldos de cashback" ON sistemaretiradas.cashback_balance;
CREATE POLICY "Apenas ADMIN pode deletar saldos de cashback"
    ON sistemaretiradas.cashback_balance
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role = 'ADMIN'
        )
    );

