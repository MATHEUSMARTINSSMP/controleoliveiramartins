-- ============================================================================
-- FIX: Adicionar 'TRIAL' nas constraints de payment_gateway
-- Data: 2025-12-19
-- 
-- Problema: A migration do Cakto removeu 'TRIAL' das opções válidas,
-- causando erro 23514 ao criar novos admins (trigger de trial automático).
-- ============================================================================

-- 1. Atualizar constraint em admin_subscriptions
ALTER TABLE sistemaretiradas.admin_subscriptions
DROP CONSTRAINT IF EXISTS admin_subscriptions_payment_gateway_check;

ALTER TABLE sistemaretiradas.admin_subscriptions
ADD CONSTRAINT admin_subscriptions_payment_gateway_check 
CHECK (payment_gateway IN ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'CAKTO', 'TRIAL', 'CUSTOM'));

-- 2. Atualizar constraint em billing_events (se a coluna existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'billing_events' 
    AND column_name = 'payment_gateway'
  ) THEN
    ALTER TABLE sistemaretiradas.billing_events
    DROP CONSTRAINT IF EXISTS billing_events_payment_gateway_check;

    ALTER TABLE sistemaretiradas.billing_events
    ADD CONSTRAINT billing_events_payment_gateway_check 
    CHECK (payment_gateway IN ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'CAKTO', 'TRIAL', 'CUSTOM'));
  END IF;
END $$;

-- 3. Garantir que payment_history tem a coluna payment_gateway e atualizar constraint
DO $$
BEGIN
  -- Verificar se a tabela existe
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'payment_history'
  ) THEN
    -- Adicionar coluna payment_gateway se não existir
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'sistemaretiradas' 
      AND table_name = 'payment_history'
      AND column_name = 'payment_gateway'
    ) THEN
      ALTER TABLE sistemaretiradas.payment_history
      ADD COLUMN payment_gateway TEXT NOT NULL DEFAULT 'MANUAL';
    END IF;
    
    -- Atualizar constraint
    ALTER TABLE sistemaretiradas.payment_history
    DROP CONSTRAINT IF EXISTS payment_history_payment_gateway_check;

    ALTER TABLE sistemaretiradas.payment_history
    ADD CONSTRAINT payment_history_payment_gateway_check 
    CHECK (payment_gateway IN ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'CAKTO', 'TRIAL', 'CUSTOM'));
  END IF;
END $$;

-- 4. Garantir que a coluna updated_at existe em admin_subscriptions
ALTER TABLE sistemaretiradas.admin_subscriptions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 5. Criar/Atualizar trigger para updated_at
CREATE OR REPLACE FUNCTION sistemaretiradas.update_admin_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_admin_subscriptions_updated_at ON sistemaretiradas.admin_subscriptions;

CREATE TRIGGER trigger_update_admin_subscriptions_updated_at
    BEFORE UPDATE ON sistemaretiradas.admin_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_admin_subscriptions_updated_at();

-- 6. Atualizar comentários
COMMENT ON COLUMN sistemaretiradas.admin_subscriptions.payment_gateway IS 'Gateway de pagamento: MANUAL, STRIPE, MERCADO_PAGO, PAGSEGURO, ASAAS, CAKTO, TRIAL, CUSTOM';
