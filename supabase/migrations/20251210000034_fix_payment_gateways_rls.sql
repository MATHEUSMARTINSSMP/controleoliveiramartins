-- =====================================================
-- GARANTIR RLS DA TABELA payment_gateways
-- =====================================================
-- Apenas Super Admin (is_super_admin = TRUE) ou service_role pode acessar
-- Esta migração garante que a política está correta

-- Remover políticas antigas
DROP POLICY IF EXISTS "Dev can manage payment gateways" ON sistemaretiradas.payment_gateways;
DROP POLICY IF EXISTS "Admins can manage payment gateways" ON sistemaretiradas.payment_gateways;

-- Política restrita: Apenas Super Admin ou service_role
CREATE POLICY "Dev can manage payment gateways" ON sistemaretiradas.payment_gateways
    FOR ALL USING (
        auth.role() = 'service_role'
        OR
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND is_super_admin = TRUE
        )
    );

COMMENT ON POLICY "Dev can manage payment gateways" ON sistemaretiradas.payment_gateways IS 'Apenas Super Admin (is_super_admin = TRUE) ou service_role pode gerenciar gateways de pagamento';

