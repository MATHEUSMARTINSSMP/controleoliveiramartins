-- ============================================================================
-- ADICIONAR CAMPOS PARA TEMPLATES DE PROMPTS
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Adiciona campos necessários para salvar templates de prompts
--            na tabela marketing_templates
-- ============================================================================

-- Adicionar campos se não existirem
ALTER TABLE sistemaretiradas.marketing_templates
ADD COLUMN IF NOT EXISTS prompt TEXT,
ADD COLUMN IF NOT EXISTS provider TEXT CHECK (provider IN ('gemini', 'openai')),
ADD COLUMN IF NOT EXISTS model TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES sistemaretiradas.profiles(id);

-- Adicionar índice para favoritos
CREATE INDEX IF NOT EXISTS idx_marketing_templates_favorite 
ON sistemaretiradas.marketing_templates(store_id, is_favorite) 
WHERE is_favorite = true;

-- Adicionar índice para busca por tags
CREATE INDEX IF NOT EXISTS idx_marketing_templates_tags 
ON sistemaretiradas.marketing_templates USING GIN(tags) 
WHERE tags IS NOT NULL;

-- Comentários
COMMENT ON COLUMN sistemaretiradas.marketing_templates.prompt IS 'Prompt de texto para geração com IA';
COMMENT ON COLUMN sistemaretiradas.marketing_templates.provider IS 'Provider de IA (gemini ou openai)';
COMMENT ON COLUMN sistemaretiradas.marketing_templates.model IS 'Modelo específico do provider';
COMMENT ON COLUMN sistemaretiradas.marketing_templates.tags IS 'Tags para categorização e busca';
COMMENT ON COLUMN sistemaretiradas.marketing_templates.is_favorite IS 'Se o template está marcado como favorito';
COMMENT ON COLUMN sistemaretiradas.marketing_templates.usage_count IS 'Contador de quantas vezes o template foi usado';

