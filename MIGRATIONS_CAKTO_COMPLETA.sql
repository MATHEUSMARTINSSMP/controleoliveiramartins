-- ============================================================================
-- MIGRAÇÕES NECESSÁRIAS PARA INTEGRAÇÃO CAKTO
-- ============================================================================
-- Execute estas migrations no Supabase SQL Editor na ordem apresentada
-- Todas são idempotentes (podem ser executadas várias vezes sem problema)
--
-- ORDEM DE EXECUÇÃO:
-- 1. Esta migration completa (consolida as 3 migrations necessárias)
-- ============================================================================

-- ============================================================================
-- PARTE 1: SISTEMA DE BILLING GENÉRICO (20251210000025)
-- ============================================================================
-- Adiciona campos de billing na tabela admin_subscriptions e cria tabelas necessárias

-- 1.1. ADICIONAR CAMPOS DE BILLING NA TABELA admin_subscriptions
ALTER TABLE sistemaretiradas.admin_subscriptions
ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'MANUAL' CHECK (payment_gateway IN ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'CUSTOM')),
ADD COLUMN IF NOT EXISTS external_customer_id TEXT,
ADD COLUMN IF NOT EXISTS external_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS external_price_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('PAID', 'UNPAID', 'PAST_DUE', 'CANCELED', 'TRIAL', 'PENDING')),
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS billing_email TEXT,
ADD COLUMN IF NOT EXISTS billing_name TEXT,
ADD COLUMN IF NOT EXISTS billing_document TEXT,
ADD COLUMN IF NOT EXISTS gateway_metadata JSONB;

-- Constraints para garantir unicidade por gateway
-- Nota: UNIQUE com WHERE precisa ser criado via índice único parcial
DO $$
BEGIN
  -- Primeiro, criar índice único parcial (que funciona como constraint)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'sistemaretiradas' 
    AND tablename = 'admin_subscriptions'
    AND indexname = 'admin_subscriptions_external_unique'
  ) THEN
    CREATE UNIQUE INDEX admin_subscriptions_external_unique 
    ON sistemaretiradas.admin_subscriptions(payment_gateway, external_subscription_id) 
    WHERE external_subscription_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_payment_gateway ON sistemaretiradas.admin_subscriptions(payment_gateway);
CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_external_customer ON sistemaretiradas.admin_subscriptions(external_customer_id);
CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_external_subscription ON sistemaretiradas.admin_subscriptions(external_subscription_id);
CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_payment_status ON sistemaretiradas.admin_subscriptions(payment_status);

COMMENT ON COLUMN sistemaretiradas.admin_subscriptions.payment_gateway IS 'Gateway de pagamento: MANUAL, STRIPE, MERCADO_PAGO, PAGSEGURO, ASAAS, CUSTOM';
COMMENT ON COLUMN sistemaretiradas.admin_subscriptions.external_customer_id IS 'ID do cliente no gateway externo';
COMMENT ON COLUMN sistemaretiradas.admin_subscriptions.external_subscription_id IS 'ID da subscription no gateway externo';
COMMENT ON COLUMN sistemaretiradas.admin_subscriptions.payment_status IS 'Status do pagamento: PAID, UNPAID, PAST_DUE, CANCELED, TRIAL, PENDING';
COMMENT ON COLUMN sistemaretiradas.admin_subscriptions.gateway_metadata IS 'Metadados específicos do gateway (armazena dados customizados)';

-- 1.2. GARANTIR QUE TABELA billing_events EXISTE E TEM AS COLUNAS NECESSÁRIAS
CREATE TABLE IF NOT EXISTS sistemaretiradas.billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_gateway TEXT NOT NULL DEFAULT 'MANUAL' CHECK (payment_gateway IN ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'CUSTOM')),
    external_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    subscription_id UUID REFERENCES sistemaretiradas.admin_subscriptions(id) ON DELETE SET NULL,
    admin_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE SET NULL,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar colunas se a tabela já existir mas não tiver as colunas
DO $$
BEGIN
  -- Adicionar payment_gateway se não existir
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'billing_events' 
    AND column_name = 'payment_gateway'
  ) THEN
    ALTER TABLE sistemaretiradas.billing_events
    ADD COLUMN payment_gateway TEXT NOT NULL DEFAULT 'MANUAL';
  END IF;
  
  -- Adicionar external_event_id se não existir
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'billing_events' 
    AND column_name = 'external_event_id'
  ) THEN
    ALTER TABLE sistemaretiradas.billing_events
    ADD COLUMN external_event_id TEXT;
  END IF;
END $$;

-- Criar índices e comentários APENAS se as colunas existirem
DO $$
BEGIN
  -- Criar índices para payment_gateway e external_event_id apenas se existirem
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'billing_events' 
    AND column_name = 'payment_gateway'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_billing_events_payment_gateway ON sistemaretiradas.billing_events(payment_gateway);
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'billing_events' 
    AND column_name = 'external_event_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_billing_events_external_event ON sistemaretiradas.billing_events(external_event_id);
  END IF;
END $$;

-- Índices que sempre devem existir (se a tabela existir)
CREATE INDEX IF NOT EXISTS idx_billing_events_event_type ON sistemaretiradas.billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_processed ON sistemaretiradas.billing_events(processed);
CREATE INDEX IF NOT EXISTS idx_billing_events_subscription ON sistemaretiradas.billing_events(subscription_id);

COMMENT ON TABLE sistemaretiradas.billing_events IS 'Log de todos os eventos recebidos dos gateways de pagamento (multi-gateway)';

-- Comentários apenas se as colunas existirem
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'billing_events' 
    AND column_name = 'payment_gateway'
  ) THEN
    COMMENT ON COLUMN sistemaretiradas.billing_events.payment_gateway IS 'Gateway que enviou o evento';
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'billing_events' 
    AND column_name = 'external_event_id'
  ) THEN
    COMMENT ON COLUMN sistemaretiradas.billing_events.external_event_id IS 'ID do evento no gateway externo';
  END IF;
END $$;


-- ============================================================================
-- PARTE 2: ADICIONAR CAKTO NAS CONSTRAINTS (20251210000030)
-- ============================================================================

-- 2.1. Atualizar constraint em admin_subscriptions para incluir CAKTO
ALTER TABLE sistemaretiradas.admin_subscriptions
DROP CONSTRAINT IF EXISTS admin_subscriptions_payment_gateway_check;

ALTER TABLE sistemaretiradas.admin_subscriptions
ADD CONSTRAINT admin_subscriptions_payment_gateway_check 
CHECK (payment_gateway IN ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'CAKTO', 'CUSTOM'));

-- 2.2. Atualizar constraint em billing_events para incluir CAKTO (só se a coluna existir)
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
    CHECK (payment_gateway IN ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'CAKTO', 'CUSTOM'));
  END IF;
END $$;

-- 2.3. Atualizar comentários
COMMENT ON COLUMN sistemaretiradas.admin_subscriptions.payment_gateway IS 'Gateway de pagamento: MANUAL, STRIPE, MERCADO_PAGO, PAGSEGURO, ASAAS, CAKTO, CUSTOM';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'billing_events' 
    AND column_name = 'payment_gateway'
  ) THEN
    COMMENT ON COLUMN sistemaretiradas.billing_events.payment_gateway IS 'Gateway que enviou o evento: MANUAL, STRIPE, MERCADO_PAGO, PAGSEGURO, ASAAS, CAKTO, CUSTOM';
  END IF;
END $$;

-- ============================================================================
-- PARTE 3: FIX FINAL PARA CAKTO (20251219000001)
-- ============================================================================
-- Garante que tudo está correto e funciona

-- 3.1. Garantir que external_event_id existe e constraint UNIQUE está ok
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'billing_events'
  ) THEN
    
    -- Garantir que a coluna external_event_id existe
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'sistemaretiradas' 
      AND table_name = 'billing_events' 
      AND column_name = 'external_event_id'
    ) THEN
      ALTER TABLE sistemaretiradas.billing_events
      ADD COLUMN external_event_id TEXT;
      
      COMMENT ON COLUMN sistemaretiradas.billing_events.external_event_id IS 'ID do evento no gateway externo';
    END IF;
    
    -- Garantir que as colunas existem antes de criar índices e constraints
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'sistemaretiradas' 
      AND table_name = 'billing_events' 
      AND column_name = 'payment_gateway'
    ) THEN
      -- Garantir que o índice existe
      CREATE INDEX IF NOT EXISTS idx_billing_events_external_event 
      ON sistemaretiradas.billing_events(external_event_id);
      
      -- Verificar se constraint UNIQUE existe (pode ser constraint ou índice único)
      IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'billing_events_external_unique'
        AND conrelid = 'sistemaretiradas.billing_events'::regclass
      ) AND NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'billing_events'
        AND indexname = 'billing_events_external_unique'
      ) THEN
        IF EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_schema = 'sistemaretiradas' 
          AND table_name = 'billing_events' 
          AND column_name = 'external_event_id'
        ) THEN
          -- Criar constraint UNIQUE simples (sem WHERE)
          ALTER TABLE sistemaretiradas.billing_events
          ADD CONSTRAINT billing_events_external_unique 
          UNIQUE (payment_gateway, external_event_id);
        END IF;
      END IF;
    END IF;
    
    COMMENT ON TABLE sistemaretiradas.billing_events IS 'Log de todos os eventos recebidos dos gateways de pagamento (multi-gateway, incluindo CAKTO)';
  END IF;
END $$;

-- ============================================================================
-- PARTE 4: REMOVER COLUNA stripe_event_id (legado do Stripe)
-- ============================================================================
-- A coluna stripe_event_id não deveria existir - usamos external_event_id genérico
-- Removemos ela se existir, pois causa erro ao inserir eventos do CAKTO
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'billing_events' 
    AND column_name = 'stripe_event_id'
  ) THEN
    -- Remover constraint se existir
    ALTER TABLE sistemaretiradas.billing_events
    DROP CONSTRAINT IF EXISTS billing_events_stripe_event_id_key;
    
    -- Remover a coluna
    ALTER TABLE sistemaretiradas.billing_events
    DROP COLUMN stripe_event_id;
    
    RAISE NOTICE 'Coluna stripe_event_id removida (substituída por external_event_id)';
  END IF;
END $$;

-- ============================================================================
-- PARTE 5: CORRIGIR FUNÇÃO create_trial_subscription (remove updated_at)
-- ============================================================================
-- A função create_trial_subscription tenta inserir updated_at que não existe
-- Isso causa erro ao criar profile ADMIN (trigger dispara função)
CREATE OR REPLACE FUNCTION sistemaretiradas.create_trial_subscription(p_admin_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_trial_plan_id UUID;
    v_subscription_id UUID;
    v_trial_end_date TIMESTAMPTZ;
BEGIN
    -- Buscar ID do plano TRIAL
    SELECT id INTO v_trial_plan_id
    FROM sistemaretiradas.subscription_plans
    WHERE name = 'TRIAL' AND is_active = true
    LIMIT 1;

    IF v_trial_plan_id IS NULL THEN
        RAISE EXCEPTION 'Plano TRIAL não encontrado ou inativo';
    END IF;

    -- Calcular data de fim do trial (14 dias a partir de agora)
    v_trial_end_date := NOW() + INTERVAL '14 days';

    -- Criar subscription com status TRIAL (SEM updated_at)
    INSERT INTO sistemaretiradas.admin_subscriptions (
        admin_id,
        plan_id,
        status,
        payment_status,
        billing_cycle,
        payment_gateway,
        trial_end_date,
        current_period_end,
        created_at
    ) VALUES (
        p_admin_id,
        v_trial_plan_id,
        'ACTIVE',
        'TRIAL',
        'MONTHLY',
        'TRIAL',
        v_trial_end_date,
        v_trial_end_date,
        NOW()
    )
    ON CONFLICT (admin_id) DO NOTHING
    RETURNING id INTO v_subscription_id;

    RETURN v_subscription_id;
END;
$$;

-- ============================================================================
-- FIM DAS MIGRAÇÕES
-- ============================================================================
-- Execute esta migration completa no Supabase SQL Editor
-- Todas as alterações são idempotentes e seguras
-- ============================================================================

