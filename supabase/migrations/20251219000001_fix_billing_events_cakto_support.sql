-- ============================================================================
-- FIX: Garantir suporte ao CAKTO na tabela billing_events
-- Data: 2025-12-19
-- 
-- Problema: 
-- - Erro ao salvar eventos do CAKTO: coluna external_event_id não encontrada
-- - Constraint pode não incluir CAKTO
-- 
-- Solução:
-- 1. Verificar e atualizar constraint CHECK para incluir CAKTO (se necessário)
-- 2. Garantir que a coluna external_event_id existe
-- ============================================================================

-- Verificar se a tabela existe antes de fazer qualquer alteração
DO $$
BEGIN
  -- Verificar se a tabela existe
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'billing_events'
  ) THEN
    
    -- Verificar se a coluna payment_gateway existe
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'sistemaretiradas' 
      AND table_name = 'billing_events' 
      AND column_name = 'payment_gateway'
    ) THEN
      
      -- Dropar constraint antiga se existir (pode ter nomes diferentes)
      ALTER TABLE sistemaretiradas.billing_events
      DROP CONSTRAINT IF EXISTS billing_events_payment_gateway_check;
      
      -- Adicionar nova constraint com CAKTO incluído
      ALTER TABLE sistemaretiradas.billing_events
      ADD CONSTRAINT billing_events_payment_gateway_check 
      CHECK (payment_gateway IN ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'CUSTOM', 'CAKTO'));
      
      RAISE NOTICE 'Constraint payment_gateway atualizada com sucesso para incluir CAKTO';
    ELSE
      RAISE NOTICE 'Coluna payment_gateway não existe na tabela billing_events';
    END IF;
    
    -- Verificar se a coluna external_event_id existe
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
      
      RAISE NOTICE 'Coluna external_event_id adicionada';
    ELSE
      RAISE NOTICE 'Coluna external_event_id já existe';
    END IF;
    
    -- Garantir que o índice existe
    CREATE INDEX IF NOT EXISTS idx_billing_events_external_event 
    ON sistemaretiradas.billing_events(external_event_id);
    
    -- Atualizar constraint UNIQUE se necessário
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_constraint 
      WHERE conname = 'billing_events_external_unique'
      AND conrelid = 'sistemaretiradas.billing_events'::regclass
    ) THEN
      IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'billing_events' 
        AND column_name = 'external_event_id'
      ) AND EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'billing_events' 
        AND column_name = 'payment_gateway'
      ) THEN
        ALTER TABLE sistemaretiradas.billing_events
        ADD CONSTRAINT billing_events_external_unique 
        UNIQUE (payment_gateway, external_event_id);
        
        RAISE NOTICE 'Constraint UNIQUE billing_events_external_unique criada';
      END IF;
    ELSE
      RAISE NOTICE 'Constraint UNIQUE billing_events_external_unique já existe';
    END IF;
    
  ELSE
    RAISE NOTICE 'Tabela billing_events não existe - nada a fazer';
  END IF;
END $$;

-- Comentário na tabela (só se a tabela existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'billing_events'
  ) THEN
    COMMENT ON TABLE sistemaretiradas.billing_events IS 'Log de todos os eventos recebidos dos gateways de pagamento (multi-gateway, incluindo CAKTO)';
    RAISE NOTICE 'Comentário da tabela atualizado';
  END IF;
END $$;
