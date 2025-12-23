-- =====================================================
-- ELEVEAONE SITES - Tabela Completa para Supabase
-- Sistema de geração de sites institucionais one-page
-- =====================================================

-- Criar tabela de sites no schema sistemaretiradas
CREATE TABLE IF NOT EXISTS sistemaretiradas.eleveaone_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  
  -- Tipo de negócio e segmento
  business_type VARCHAR(20) NOT NULL DEFAULT 'fisico' CHECK (business_type IN ('fisico', 'digital')),
  segment_id VARCHAR(100) NOT NULL,
  segment_name VARCHAR(255) NOT NULL,
  area_id VARCHAR(100),
  area_name VARCHAR(255),
  custom_area VARCHAR(255),
  content_type VARCHAR(20) NOT NULL DEFAULT 'misto' CHECK (content_type IN ('servicos', 'produtos', 'misto')),
  voice_tone VARCHAR(30) NOT NULL DEFAULT 'profissional',
  
  -- Informações da empresa
  company_name VARCHAR(255) NOT NULL,
  company_description TEXT,
  company_history TEXT,
  mission TEXT,
  vision TEXT,
  company_values TEXT,
  services_description TEXT,
  products_description TEXT,
  differentials TEXT,
  slogan VARCHAR(255),
  tagline VARCHAR(255),
  founding_year INTEGER,
  team_size VARCHAR(50),
  awards TEXT,
  certifications TEXT,
  
  -- Contato
  whatsapp VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  instagram VARCHAR(100),
  facebook VARCHAR(255),
  tiktok VARCHAR(100),
  youtube VARCHAR(255),
  linkedin VARCHAR(255),
  website VARCHAR(255),
  
  -- Endereço (para negócios físicos)
  address_street VARCHAR(255),
  address_number VARCHAR(20),
  address_complement VARCHAR(100),
  address_neighborhood VARCHAR(100),
  address_city VARCHAR(100),
  address_state VARCHAR(2),
  address_zip VARCHAR(10),
  address_full TEXT,
  google_maps_url TEXT,
  google_maps_embed TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Horário de funcionamento
  business_hours JSONB DEFAULT '{
    "monday": {"open": "08:00", "close": "18:00"},
    "tuesday": {"open": "08:00", "close": "18:00"},
    "wednesday": {"open": "08:00", "close": "18:00"},
    "thursday": {"open": "08:00", "close": "18:00"},
    "friday": {"open": "08:00", "close": "18:00"},
    "saturday": {"open": "08:00", "close": "12:00"},
    "sunday": {"open": "00:00", "close": "00:00", "closed": true}
  }'::jsonb,
  
  -- Visual e branding
  logo_url TEXT,
  favicon_url TEXT,
  color_primary VARCHAR(9) DEFAULT '#8B5CF6',
  color_secondary VARCHAR(9) DEFAULT '#1F2937',
  color_accent VARCHAR(9) DEFAULT '#10B981',
  color_background VARCHAR(9) DEFAULT '#FFFFFF',
  font_primary VARCHAR(100) DEFAULT 'Inter',
  font_secondary VARCHAR(100) DEFAULT 'Inter',
  visual_style VARCHAR(50) DEFAULT 'modern',
  
  -- Imagens
  hero_image_url TEXT,
  about_image_url TEXT,
  gallery_images TEXT[] DEFAULT '{}',
  product_images TEXT[] DEFAULT '{}',
  ambient_images TEXT[] DEFAULT '{}',
  
  -- GitHub integration
  github_repo_id BIGINT,
  github_full_name VARCHAR(255),
  github_url TEXT,
  github_branch VARCHAR(100) DEFAULT 'main',
  
  -- Netlify integration
  netlify_site_id VARCHAR(100),
  netlify_site_name VARCHAR(100),
  netlify_url TEXT,
  netlify_admin_url TEXT,
  netlify_deploy_hook TEXT,
  
  -- Status e versão
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'published', 'error', 'archived')),
  current_version INTEGER DEFAULT 1,
  last_published_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  tenant_id UUID,
  last_reset_at TIMESTAMPTZ,
  
  -- SEO
  seo_title VARCHAR(70),
  seo_description VARCHAR(160),
  seo_keywords TEXT[],
  og_image_url TEXT,
  
  -- Produtos/Serviços em destaque (JSONB)
  featured_products JSONB DEFAULT '[]'::jsonb,
  featured_services JSONB DEFAULT '[]'::jsonb,
  special_offers JSONB DEFAULT '[]'::jsonb,
  testimonials JSONB DEFAULT '[]'::jsonb,
  
  -- CTA
  cta_whatsapp_message TEXT,
  cta_button_text VARCHAR(50) DEFAULT 'Fale Conosco',
  
  -- Conteúdo gerado pela IA
  generated_content JSONB DEFAULT NULL,
  
  -- HTML gerado (para cache/backup)
  generated_html TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_eleveaone_sites_tenant_id ON sistemaretiradas.eleveaone_sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eleveaone_sites_status ON sistemaretiradas.eleveaone_sites(status);
CREATE INDEX IF NOT EXISTS idx_eleveaone_sites_slug ON sistemaretiradas.eleveaone_sites(slug);
CREATE INDEX IF NOT EXISTS idx_eleveaone_sites_created_by ON sistemaretiradas.eleveaone_sites(created_by);
CREATE INDEX IF NOT EXISTS idx_eleveaone_sites_segment ON sistemaretiradas.eleveaone_sites(segment_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION sistemaretiradas.update_eleveaone_sites_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_eleveaone_sites_timestamp ON sistemaretiradas.eleveaone_sites;
CREATE TRIGGER trigger_update_eleveaone_sites_timestamp
  BEFORE UPDATE ON sistemaretiradas.eleveaone_sites
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_eleveaone_sites_timestamp();

-- RLS Policies
ALTER TABLE sistemaretiradas.eleveaone_sites ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários autenticados podem ver sites do seu tenant
CREATE POLICY "Users can view their tenant sites"
  ON sistemaretiradas.eleveaone_sites
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM sistemaretiradas.colaboradores WHERE user_id = auth.uid() LIMIT 1)
    OR created_by = auth.uid()
  );

-- Policy: Usuários autenticados podem criar sites
CREATE POLICY "Users can create sites"
  ON sistemaretiradas.eleveaone_sites
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Usuários podem atualizar seus próprios sites ou do tenant
CREATE POLICY "Users can update their sites"
  ON sistemaretiradas.eleveaone_sites
  FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM sistemaretiradas.colaboradores WHERE user_id = auth.uid() LIMIT 1)
    OR created_by = auth.uid()
  );

-- Policy: Usuários podem deletar seus próprios sites
CREATE POLICY "Users can delete their sites"
  ON sistemaretiradas.eleveaone_sites
  FOR DELETE
  USING (created_by = auth.uid());

-- =====================================================
-- STORAGE BUCKET PARA IMAGENS (opcional)
-- Execute no Supabase Dashboard > Storage
-- =====================================================
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('site-images', 'site-images', true);

-- =====================================================
-- COMENTÁRIOS
-- =====================================================
COMMENT ON TABLE sistemaretiradas.eleveaone_sites IS 'Tabela de sites institucionais one-page gerados pelo EleveaOne Sites';
COMMENT ON COLUMN sistemaretiradas.eleveaone_sites.slug IS 'Identificador único para URL (ex: minha-empresa.eleveaone.com.br)';
COMMENT ON COLUMN sistemaretiradas.eleveaone_sites.business_type IS 'Tipo: fisico (com endereço) ou digital (sem endereço físico)';
COMMENT ON COLUMN sistemaretiradas.eleveaone_sites.status IS 'draft=rascunho, generating=IA gerando, published=publicado, error=erro, archived=arquivado';
COMMENT ON COLUMN sistemaretiradas.eleveaone_sites.generated_content IS 'Conteúdo textual gerado pela IA (títulos, descrições, etc)';
COMMENT ON COLUMN sistemaretiradas.eleveaone_sites.generated_html IS 'HTML completo do site gerado (para cache/backup)';
