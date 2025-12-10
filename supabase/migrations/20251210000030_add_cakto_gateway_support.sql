-- =====================================================
-- ADICIONAR SUPORTE AO GATEWAY CAKTO
-- =====================================================
-- Adiciona CAKTO como opção válida em todas as tabelas de billing

-- 1. Atualizar constraint em admin_subscriptions
ALTER TABLE sistemaretiradas.admin_subscriptions
DROP CONSTRAINT IF EXISTS admin_subscriptions_payment_gateway_check;

ALTER TABLE sistemaretiradas.admin_subscriptions
ADD CONSTRAINT admin_subscriptions_payment_gateway_check 
CHECK (payment_gateway IN ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'CAKTO', 'CUSTOM'));

-- 2. Atualizar constraint em payment_history
ALTER TABLE sistemaretiradas.payment_history
DROP CONSTRAINT IF EXISTS payment_history_payment_gateway_check;

ALTER TABLE sistemaretiradas.payment_history
ADD CONSTRAINT payment_history_payment_gateway_check 
CHECK (payment_gateway IN ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'CAKTO', 'CUSTOM'));

-- 3. Atualizar constraint em billing_events
ALTER TABLE sistemaretiradas.billing_events
DROP CONSTRAINT IF EXISTS billing_events_payment_gateway_check;

ALTER TABLE sistemaretiradas.billing_events
ADD CONSTRAINT billing_events_payment_gateway_check 
CHECK (payment_gateway IN ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'CAKTO', 'CUSTOM'));

-- 4. Atualizar comentários
COMMENT ON COLUMN sistemaretiradas.admin_subscriptions.payment_gateway IS 'Gateway de pagamento: MANUAL, STRIPE, MERCADO_PAGO, PAGSEGURO, ASAAS, CAKTO, CUSTOM';
COMMENT ON COLUMN sistemaretiradas.payment_history.payment_gateway IS 'Gateway usado para o pagamento: MANUAL, STRIPE, MERCADO_PAGO, PAGSEGURO, ASAAS, CAKTO, CUSTOM';
COMMENT ON COLUMN sistemaretiradas.billing_events.payment_gateway IS 'Gateway que enviou o evento: MANUAL, STRIPE, MERCADO_PAGO, PAGSEGURO, ASAAS, CAKTO, CUSTOM';

