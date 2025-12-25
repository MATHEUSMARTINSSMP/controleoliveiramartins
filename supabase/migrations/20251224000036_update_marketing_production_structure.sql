-- ============================================================================
-- ATUALIZAR ESTRUTURA DE MARKETING PARA PRODUÇÃO
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Atualiza tabelas de marketing para suportar geração com IA
--            Adiciona marketing_jobs, atualiza marketing_assets
-- ============================================================================

-- ============================================================================
-- 1. ATUALIZAR marketing_assets (estrutura de produção)
-- ============================================================================

-- Adicionar campos necessários para produção
ALTER TABLE sistemaretiradas.marketing_assets
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES sistemaretiradas.profiles(id),
ADD COLUMN IF NOT EXISTS provider TEXT CHECK (provider IN ('gemini', 'openai')),
ADD COLUMN IF NOT EXISTS provider_model TEXT,
ADD COLUMN IF NOT EXISTS prompt TEXT,
ADD COLUMN IF NOT EXISTS prompt_hash TEXT,
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS public_url TEXT,
ADD COLUMN IF NOT EXISTS signed_url TEXT,
ADD COLUMN IF NOT EXISTS signed_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS job_id UUID; -- Será FK para marketing_jobs

-- Renomear/mover campos existentes para padrão
-- url -> public_url (mantém compatibilidade)
UPDATE sistemaretiradas.marketing_assets 
SET public_url = url 
WHERE public_url IS NULL AND url IS NOT NULL;

-- Adicionar meta como JSONB se não existir (renomear metadata)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'marketing_assets' 
    AND column_name = 'metadata'
  ) THEN
    -- Se metadata existe, criar meta se não existir e copiar dados
    ALTER TABLE sistemaretiradas.marketing_assets
    ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::JSONB;
    
    UPDATE sistemaretiradas.marketing_assets
    SET meta = metadata
    WHERE meta = '{}'::JSONB AND metadata IS NOT NULL;
  ELSE
    -- Se metadata não existe, criar meta
    ALTER TABLE sistemaretiradas.marketing_assets
    ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::JSONB;
  END IF;
END $$;

-- Adicionar updated_at se não existir
ALTER TABLE sistemaretiradas.marketing_assets
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Índices adicionais
CREATE INDEX IF NOT EXISTS idx_marketing_assets_user_id ON sistemaretiradas.marketing_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_provider ON sistemaretiradas.marketing_assets(provider) WHERE provider IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_assets_job_id ON sistemaretiradas.marketing_assets(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_assets_type_provider ON sistemaretiradas.marketing_assets(type, provider);

-- ============================================================================
-- 2. CRIAR marketing_jobs (processos assíncronos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.marketing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id),
  
  -- Tipo e provider
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'carousel', 'batch')),
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'openai')),
  provider_model TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed', 'canceled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Input/Output
  input JSONB NOT NULL DEFAULT '{}'::JSONB, -- {prompt, output: {aspectRatio, size, seconds}, brand: {...}, input_images: []}
  prompt_original TEXT, -- Prompt original fornecido pelo usuário
  prompt_final TEXT, -- Prompt final usado (após expansão/seleção)
  provider_ref TEXT, -- operation_name (Veo) ou video_id (Sora) para polling
  result JSONB, -- {assetId, mediaUrl, thumbnailUrl, meta}
  
  -- Erros
  error_message TEXT,
  error_code TEXT, -- RATE_LIMIT, PROVIDER_ERROR, VALIDATION_ERROR
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_marketing_jobs_store_user ON sistemaretiradas.marketing_jobs(store_id, user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_jobs_status ON sistemaretiradas.marketing_jobs(status) WHERE status IN ('queued', 'processing');
CREATE INDEX IF NOT EXISTS idx_marketing_jobs_created ON sistemaretiradas.marketing_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_jobs_provider_ref ON sistemaretiradas.marketing_jobs(provider_ref) WHERE provider_ref IS NOT NULL;

-- Comentários
COMMENT ON TABLE sistemaretiradas.marketing_jobs IS 'Jobs assíncronos para geração de mídia com IA';
COMMENT ON COLUMN sistemaretiradas.marketing_jobs.input IS 'JSONB: {prompt, output: {aspectRatio, size, seconds}, brand: {apply, storeId}, input_images: [base64...], mask: base64}';
COMMENT ON COLUMN sistemaretiradas.marketing_jobs.result IS 'JSONB: {assetId, mediaUrl, thumbnailUrl, meta: {width, height, duration}}';

-- ============================================================================
-- 3. ADICIONAR FK job_id em marketing_assets
-- ============================================================================

ALTER TABLE sistemaretiradas.marketing_assets
ADD CONSTRAINT fk_marketing_assets_job 
FOREIGN KEY (job_id) 
REFERENCES sistemaretiradas.marketing_jobs(id) 
ON DELETE SET NULL;

-- ============================================================================
-- 4. ADICIONAR CAMPOS DE IDENTIDADE VISUAL EM stores
-- ============================================================================

ALTER TABLE sistemaretiradas.stores
ADD COLUMN IF NOT EXISTS brand_colors JSONB DEFAULT '{}'::JSONB,
ADD COLUMN IF NOT EXISTS brand_fonts JSONB DEFAULT '{}'::JSONB,
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Comentários
COMMENT ON COLUMN sistemaretiradas.stores.brand_colors IS 'JSONB: {primary: "#hex", secondary: "#hex", accent: "#hex", background: "#hex"}';
COMMENT ON COLUMN sistemaretiradas.stores.brand_fonts IS 'JSONB: {heading: "font-name", body: "font-name"}';
COMMENT ON COLUMN sistemaretiradas.stores.logo_url IS 'URL da logo da loja no Supabase Storage';

-- ============================================================================
-- 5. CRIAR TABELA marketing_usage (rastreamento de uso/cotas)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.marketing_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'monthly')),
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'total')),
  count INTEGER DEFAULT 0,
  cost_estimate NUMERIC(10, 4) DEFAULT 0, -- Custo estimado em USD
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, period_start, period_type, type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_marketing_usage_store_period ON sistemaretiradas.marketing_usage(store_id, period_start, period_type);
CREATE INDEX IF NOT EXISTS idx_marketing_usage_period_type ON sistemaretiradas.marketing_usage(period_type, period_start);

-- Comentários
COMMENT ON TABLE sistemaretiradas.marketing_usage IS 'Rastreamento de uso de geração de mídia para quotas e billing';

-- ============================================================================
-- 6. RLS PARA marketing_jobs E marketing_usage
-- ============================================================================

ALTER TABLE sistemaretiradas.marketing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.marketing_usage ENABLE ROW LEVEL SECURITY;

-- Políticas para marketing_jobs
CREATE POLICY "Users can view marketing jobs from their store"
  ON sistemaretiradas.marketing_jobs FOR SELECT
  USING (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert marketing jobs for their store"
  ON sistemaretiradas.marketing_jobs FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update marketing jobs from their store"
  ON sistemaretiradas.marketing_jobs FOR UPDATE
  USING (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

-- Políticas para marketing_usage (apenas leitura para usuários)
CREATE POLICY "Users can view marketing usage from their store"
  ON sistemaretiradas.marketing_usage FOR SELECT
  USING (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- 7. TRIGGERS: updated_at automático
-- ============================================================================

CREATE TRIGGER update_marketing_jobs_updated_at
  BEFORE UPDATE ON sistemaretiradas.marketing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_marketing_updated_at();

CREATE TRIGGER update_marketing_assets_updated_at
  BEFORE UPDATE ON sistemaretiradas.marketing_assets
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_marketing_updated_at();

CREATE TRIGGER update_marketing_usage_updated_at
  BEFORE UPDATE ON sistemaretiradas.marketing_usage
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_marketing_updated_at();

-- ============================================================================
-- 8. FUNÇÃO: Incrementar uso (para quotas)
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.increment_marketing_usage(
  p_store_id UUID,
  p_type TEXT,
  p_cost_estimate NUMERIC DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_month_start TIMESTAMPTZ;
BEGIN
  v_today_start := DATE_TRUNC('day', NOW());
  v_month_start := DATE_TRUNC('month', NOW());
  
  -- Incrementar uso diário
  INSERT INTO sistemaretiradas.marketing_usage (
    store_id, period_start, period_type, type, count, cost_estimate
  ) VALUES (
    p_store_id, v_today_start, 'daily', p_type, 1, p_cost_estimate
  )
  ON CONFLICT (store_id, period_start, period_type, type)
  DO UPDATE SET 
    count = marketing_usage.count + 1,
    cost_estimate = marketing_usage.cost_estimate + p_cost_estimate,
    updated_at = NOW();
  
  -- Incrementar uso mensal
  INSERT INTO sistemaretiradas.marketing_usage (
    store_id, period_start, period_type, type, count, cost_estimate
  ) VALUES (
    p_store_id, v_month_start, 'monthly', p_type, 1, p_cost_estimate
  )
  ON CONFLICT (store_id, period_start, period_type, type)
  DO UPDATE SET 
    count = marketing_usage.count + 1,
    cost_estimate = marketing_usage.cost_estimate + p_cost_estimate,
    updated_at = NOW();
  
  -- Incrementar total diário
  INSERT INTO sistemaretiradas.marketing_usage (
    store_id, period_start, period_type, type, count, cost_estimate
  ) VALUES (
    p_store_id, v_today_start, 'daily', 'total', 1, p_cost_estimate
  )
  ON CONFLICT (store_id, period_start, period_type, type)
  DO UPDATE SET 
    count = marketing_usage.count + 1,
    cost_estimate = marketing_usage.cost_estimate + p_cost_estimate,
    updated_at = NOW();
  
  -- Incrementar total mensal
  INSERT INTO sistemaretiradas.marketing_usage (
    store_id, period_start, period_type, type, count, cost_estimate
  ) VALUES (
    p_store_id, v_month_start, 'monthly', 'total', 1, p_cost_estimate
  )
  ON CONFLICT (store_id, period_start, period_type, type)
  DO UPDATE SET 
    count = marketing_usage.count + 1,
    cost_estimate = marketing_usage.cost_estimate + p_cost_estimate,
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.increment_marketing_usage IS 
'Incrementa contador de uso de geração de mídia para controle de quotas. 
Atualiza contadores diários e mensais automaticamente.';

-- ============================================================================
-- 9. FUNÇÃO: Verificar quota (retorna true se dentro do limite)
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.check_marketing_quota(
  p_store_id UUID,
  p_type TEXT DEFAULT 'total',
  p_period_type TEXT DEFAULT 'monthly'
)
RETURNS TABLE (
  within_limit BOOLEAN,
  current_count INTEGER,
  limit_count INTEGER,
  remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_current_count INTEGER := 0;
  v_limit_count INTEGER := 1000; -- TODO: Buscar do plano da loja
BEGIN
  IF p_period_type = 'daily' THEN
    v_period_start := DATE_TRUNC('day', NOW());
  ELSE
    v_period_start := DATE_TRUNC('month', NOW());
  END IF;
  
  -- Buscar uso atual
  SELECT COALESCE(count, 0) INTO v_current_count
  FROM sistemaretiradas.marketing_usage
  WHERE store_id = p_store_id
    AND period_start = v_period_start
    AND period_type = p_period_type
    AND type = p_type;
  
  -- TODO: Buscar limite do plano da loja
  -- Por enquanto, usar limite padrão
  v_limit_count := 1000;
  
  RETURN QUERY SELECT 
    (v_current_count < v_limit_count) as within_limit,
    v_current_count as current_count,
    v_limit_count as limit_count,
    GREATEST(0, v_limit_count - v_current_count) as remaining;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.check_marketing_quota IS 
'Verifica se a loja está dentro do limite de quota (diário ou mensal).
Retorna: within_limit, current_count, limit_count, remaining.';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

