-- ============================================
-- ADICIONAR COLUNA CATEGORY EM WHATSAPP_CAMPAIGNS
-- ============================================
-- Esta coluna permite categorizar campanhas para analytics
-- ============================================

-- Adicionar coluna category se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'whatsapp_campaigns' 
    AND column_name = 'category'
  ) THEN
    ALTER TABLE sistemaretiradas.whatsapp_campaigns
    ADD COLUMN category TEXT;
    
    -- Adicionar comentário
    COMMENT ON COLUMN sistemaretiradas.whatsapp_campaigns.category IS 
      'Categoria da campanha para analytics (DESCONTO, PROMOCAO, CASHBACK, SAUDACAO, REATIVACAO, etc)';
    
    -- Criar índice para melhor performance em queries de analytics
    CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_category 
    ON sistemaretiradas.whatsapp_campaigns(category);
    
    -- Criar índice composto para queries por loja e categoria
    CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_store_category 
    ON sistemaretiradas.whatsapp_campaigns(store_id, category) 
    WHERE category IS NOT NULL;
  END IF;
END $$;

-- Criar CHECK constraint para valores válidos de categoria
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'whatsapp_campaigns_category_check'
  ) THEN
    ALTER TABLE sistemaretiradas.whatsapp_campaigns
    ADD CONSTRAINT whatsapp_campaigns_category_check 
    CHECK (
      category IS NULL OR category IN (
        'DESCONTO',
        'PROMOCAO',
        'CASHBACK',
        'SAUDACAO',
        'REATIVACAO',
        'NOVIDADES',
        'DATAS_COMEMORATIVAS',
        'ANIVERSARIO',
        'ABANDONO_CARRINHO',
        'FIDELIDADE',
        'PESQUISA',
        'LEMBRETE',
        'EDUCACIONAL',
        'SURVEY',
        'VIP',
        'SEGMENTACAO',
        'SAZONAL',
        'LANCAMENTO',
        'ESGOTANDO',
        'OUTROS'
      )
    );
  END IF;
END $$;

