-- ============================================================================
-- MÓDULO DE MARKETING PARA REDES SOCIAIS
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Cria estrutura completa para módulo de marketing com geração
--            de conteúdo para Instagram e TikTok
-- ============================================================================

-- ============================================================================
-- 1. TABELA: marketing_campaigns (Campanhas de Marketing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'archived')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_by UUID REFERENCES sistemaretiradas.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_store_id ON sistemaretiradas.marketing_campaigns(store_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON sistemaretiradas.marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_dates ON sistemaretiradas.marketing_campaigns(start_date, end_date);

-- Comentários
COMMENT ON TABLE sistemaretiradas.marketing_campaigns IS 'Campanhas de marketing para redes sociais';
COMMENT ON COLUMN sistemaretiradas.marketing_campaigns.status IS 'Status: draft, scheduled, active, paused, completed, archived';

-- ============================================================================
-- 2. TABELA: marketing_templates (Templates de Posts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.marketing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'carousel')),
  category TEXT CHECK (category IN ('promocao', 'produto', 'lancamento', 'educativo', 'testimonial', 'behind_scenes', 'outro')),
  config JSONB NOT NULL DEFAULT '{}'::JSONB, -- Layout, cores, fontes, posições, assets
  preview_url TEXT, -- URL da imagem de preview
  thumbnail_url TEXT, -- URL do thumbnail
  is_public BOOLEAN DEFAULT false, -- Templates públicos podem ser usados por outras lojas
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0, -- Quantas vezes foi usado
  created_by UUID REFERENCES sistemaretiradas.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_marketing_templates_store_id ON sistemaretiradas.marketing_templates(store_id);
CREATE INDEX IF NOT EXISTS idx_marketing_templates_type ON sistemaretiradas.marketing_templates(type);
CREATE INDEX IF NOT EXISTS idx_marketing_templates_category ON sistemaretiradas.marketing_templates(category);
CREATE INDEX IF NOT EXISTS idx_marketing_templates_public ON sistemaretiradas.marketing_templates(is_public) WHERE is_public = true;

-- Comentários
COMMENT ON TABLE sistemaretiradas.marketing_templates IS 'Templates reutilizáveis para criação de posts';
COMMENT ON COLUMN sistemaretiradas.marketing_templates.config IS 'JSONB com configuração do template: layout, cores, fontes, posições de elementos';
COMMENT ON COLUMN sistemaretiradas.marketing_templates.is_public IS 'Templates públicos podem ser usados por outras lojas';

-- ============================================================================
-- 3. TABELA: marketing_assets (Assets: Imagens, Vídeos, Áudios)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.marketing_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'audio', 'font', 'other')),
  url TEXT NOT NULL, -- URL no Supabase Storage ou externa
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  width INTEGER, -- Para imagens/vídeos
  height INTEGER, -- Para imagens/vídeos
  duration_seconds NUMERIC, -- Para vídeos/áudios
  metadata JSONB DEFAULT '{}'::JSONB, -- Metadados adicionais
  tags TEXT[], -- Tags para busca
  created_by UUID REFERENCES sistemaretiradas.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_marketing_assets_store_id ON sistemaretiradas.marketing_assets(store_id);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_type ON sistemaretiradas.marketing_assets(type);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_tags ON sistemaretiradas.marketing_assets USING GIN(tags);

-- Comentários
COMMENT ON TABLE sistemaretiradas.marketing_assets IS 'Biblioteca de assets (imagens, vídeos, áudios, fontes) para uso em posts';
COMMENT ON COLUMN sistemaretiradas.marketing_assets.metadata IS 'Metadados adicionais: EXIF para imagens, codec para vídeos, etc';

-- ============================================================================
-- 4. TABELA: marketing_posts (Posts/Creatives)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.marketing_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES sistemaretiradas.marketing_campaigns(id) ON DELETE SET NULL,
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  template_id UUID REFERENCES sistemaretiradas.marketing_templates(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'carousel', 'reels', 'story')),
  platforms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], -- ['instagram', 'tiktok']
  content JSONB NOT NULL DEFAULT '{}'::JSONB, -- Configuração completa do post: texto, assets, layout
  media_url TEXT, -- URL do arquivo final gerado (imagem ou vídeo)
  thumbnail_url TEXT, -- URL do thumbnail
  caption TEXT, -- Legenda do post
  hashtags TEXT[], -- Hashtags
  mentions TEXT[], -- @mentions
  location_name TEXT, -- Localização (Instagram)
  scheduled_at TIMESTAMPTZ, -- Quando deve ser publicado
  published_at TIMESTAMPTZ, -- Quando foi publicado
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed', 'deleted')),
  instagram_post_id TEXT, -- ID do post no Instagram (se publicado)
  tiktok_post_id TEXT, -- ID do post no TikTok (se publicado)
  instagram_media_id TEXT, -- Media ID do Instagram (para Stories/Reels)
  error_message TEXT, -- Mensagem de erro se falhou
  metrics JSONB DEFAULT '{}'::JSONB, -- Métricas: likes, views, comments, shares, saves
  last_metrics_sync_at TIMESTAMPTZ, -- Última vez que métricas foram sincronizadas
  created_by UUID REFERENCES sistemaretiradas.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_marketing_posts_campaign_id ON sistemaretiradas.marketing_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_store_id ON sistemaretiradas.marketing_posts(store_id);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_template_id ON sistemaretiradas.marketing_posts(template_id);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_status ON sistemaretiradas.marketing_posts(status);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_scheduled_at ON sistemaretiradas.marketing_posts(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_posts_platforms ON sistemaretiradas.marketing_posts USING GIN(platforms);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_hashtags ON sistemaretiradas.marketing_posts USING GIN(hashtags);

-- Comentários
COMMENT ON TABLE sistemaretiradas.marketing_posts IS 'Posts criados para redes sociais';
COMMENT ON COLUMN sistemaretiradas.marketing_posts.content IS 'JSONB com configuração completa: texto, assets usados, layout, animações';
COMMENT ON COLUMN sistemaretiradas.marketing_posts.metrics IS 'JSONB com métricas: {instagram: {likes, comments, shares, saves, reach}, tiktok: {views, likes, comments, shares}}';

-- ============================================================================
-- 5. TABELA: marketing_post_assets (Relacionamento Post <-> Assets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.marketing_post_assets (
  post_id UUID NOT NULL REFERENCES sistemaretiradas.marketing_posts(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES sistemaretiradas.marketing_assets(id) ON DELETE CASCADE,
  position INTEGER, -- Ordem no carousel
  transform JSONB, -- Transformações aplicadas: crop, scale, position, filters
  PRIMARY KEY (post_id, asset_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_marketing_post_assets_post_id ON sistemaretiradas.marketing_post_assets(post_id);
CREATE INDEX IF NOT EXISTS idx_marketing_post_assets_asset_id ON sistemaretiradas.marketing_post_assets(asset_id);

-- ============================================================================
-- 6. RLS (Row Level Security)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE sistemaretiradas.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.marketing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.marketing_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.marketing_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.marketing_post_assets ENABLE ROW LEVEL SECURITY;

-- Políticas: Usuários só veem dados da sua loja
CREATE POLICY "Users can view marketing campaigns from their store"
  ON sistemaretiradas.marketing_campaigns FOR SELECT
  USING (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert marketing campaigns for their store"
  ON sistemaretiradas.marketing_campaigns FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update marketing campaigns from their store"
  ON sistemaretiradas.marketing_campaigns FOR UPDATE
  USING (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete marketing campaigns from their store"
  ON sistemaretiradas.marketing_campaigns FOR DELETE
  USING (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

-- Políticas para templates (incluindo públicos)
CREATE POLICY "Users can view marketing templates"
  ON sistemaretiradas.marketing_templates FOR SELECT
  USING (
    is_public = true
    OR store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert marketing templates for their store"
  ON sistemaretiradas.marketing_templates FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update marketing templates from their store"
  ON sistemaretiradas.marketing_templates FOR UPDATE
  USING (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

-- Políticas para assets
CREATE POLICY "Users can view marketing assets from their store"
  ON sistemaretiradas.marketing_assets FOR SELECT
  USING (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert marketing assets for their store"
  ON sistemaretiradas.marketing_assets FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update marketing assets from their store"
  ON sistemaretiradas.marketing_assets FOR UPDATE
  USING (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete marketing assets from their store"
  ON sistemaretiradas.marketing_assets FOR DELETE
  USING (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

-- Políticas para posts
CREATE POLICY "Users can view marketing posts from their store"
  ON sistemaretiradas.marketing_posts FOR SELECT
  USING (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert marketing posts for their store"
  ON sistemaretiradas.marketing_posts FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update marketing posts from their store"
  ON sistemaretiradas.marketing_posts FOR UPDATE
  USING (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete marketing posts from their store"
  ON sistemaretiradas.marketing_posts FOR DELETE
  USING (
    store_id IN (
      SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    )
  );

-- Políticas para post_assets
CREATE POLICY "Users can manage marketing post assets"
  ON sistemaretiradas.marketing_post_assets
  FOR ALL
  USING (
    post_id IN (
      SELECT id FROM sistemaretiradas.marketing_posts
      WHERE store_id IN (
        SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 7. TRIGGERS: updated_at automático
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.update_marketing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketing_campaigns_updated_at
  BEFORE UPDATE ON sistemaretiradas.marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_marketing_updated_at();

CREATE TRIGGER update_marketing_templates_updated_at
  BEFORE UPDATE ON sistemaretiradas.marketing_templates
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_marketing_updated_at();

CREATE TRIGGER update_marketing_posts_updated_at
  BEFORE UPDATE ON sistemaretiradas.marketing_posts
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_marketing_updated_at();

-- ============================================================================
-- 8. FUNÇÃO: Incrementar usage_count do template
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.template_id IS NOT NULL THEN
    UPDATE sistemaretiradas.marketing_templates
    SET usage_count = usage_count + 1
    WHERE id = NEW.template_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER increment_template_usage_on_post_create
  AFTER INSERT ON sistemaretiradas.marketing_posts
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.increment_template_usage();

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

