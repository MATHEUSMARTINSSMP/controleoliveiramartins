-- ============================================
-- SISTEMA DE SITES - SCHEMA SISTEMARETIRADAS
-- Versão simplificada (sem dependências de users/tenants)
-- ============================================

-- Criar schema se não existir
CREATE SCHEMA IF NOT EXISTS sistemaretiradas;

-- Tabela principal de sites
CREATE TABLE IF NOT EXISTS sistemaretiradas.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  
  -- Tipo e Segmento
  business_type VARCHAR(20) NOT NULL CHECK (business_type IN ('fisico', 'digital')),
  segment_id VARCHAR(50) NOT NULL,
  segment_name VARCHAR(100) NOT NULL,
  area_id VARCHAR(50),
  area_name VARCHAR(100),
  custom_area VARCHAR(255),
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('produtos', 'servicos', 'misto')),
  voice_tone VARCHAR(20) NOT NULL CHECK (voice_tone IN ('elegante', 'profissional', 'popular', 'tecnico', 'acolhedor', 'dinamico')),
  
  -- Dados da Empresa
  company_name VARCHAR(255) NOT NULL,
  company_description TEXT,
  company_history TEXT,
  mission TEXT,
  vision TEXT,
  company_values TEXT,
  services_description TEXT,
  products_description TEXT,
  differentials TEXT,
  
  -- Contato
  whatsapp VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  instagram VARCHAR(100),
  facebook VARCHAR(100),
  tiktok VARCHAR(100),
  youtube VARCHAR(100),
  linkedin VARCHAR(100),
  website VARCHAR(255),
  
  -- Endereço
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
  
  -- Horário de Funcionamento
  business_hours JSONB DEFAULT '{}',
  
  -- Visual
  logo_url TEXT,
  favicon_url TEXT,
  color_primary VARCHAR(7) DEFAULT '#8B5CF6',
  color_secondary VARCHAR(7) DEFAULT '#1F2937',
  color_accent VARCHAR(7) DEFAULT '#10B981',
  color_background VARCHAR(7) DEFAULT '#FFFFFF',
  font_primary VARCHAR(50) DEFAULT 'Inter',
  font_secondary VARCHAR(50) DEFAULT 'Inter',
  visual_style VARCHAR(50) DEFAULT 'moderno',
  
  -- Imagens
  hero_image_url TEXT,
  about_image_url TEXT,
  gallery_images JSONB DEFAULT '[]',
  product_images JSONB DEFAULT '[]',
  ambient_images JSONB DEFAULT '[]',
  
  -- GitHub
  github_repo_id BIGINT,
  github_full_name VARCHAR(255),
  github_url TEXT,
  github_branch VARCHAR(50) DEFAULT 'main',
  
  -- Netlify
  netlify_site_id VARCHAR(100),
  netlify_site_name VARCHAR(100),
  netlify_url TEXT,
  netlify_admin_url TEXT,
  netlify_deploy_hook TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'published', 'error', 'archived')),
  current_version INTEGER DEFAULT 0,
  last_published_at TIMESTAMPTZ,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  
  -- SEO
  seo_title VARCHAR(70),
  seo_description VARCHAR(160),
  seo_keywords TEXT[],
  og_image_url TEXT
);

-- Tabela de versões do site
CREATE TABLE IF NOT EXISTS sistemaretiradas.site_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sistemaretiradas.sites(id) ON DELETE CASCADE,
  
  version INTEGER NOT NULL,
  html_content TEXT NOT NULL,
  
  -- Dados do commit
  github_commit_sha VARCHAR(50),
  commit_message TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'published', 'failed', 'archived')),
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  created_by UUID,
  
  -- Prevenir versões duplicadas
  UNIQUE(site_id, version)
);

-- Tabela de arquivos enviados
CREATE TABLE IF NOT EXISTS sistemaretiradas.site_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sistemaretiradas.sites(id) ON DELETE CASCADE,
  
  -- Tipo de arquivo
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('logo', 'favicon', 'hero', 'about', 'product', 'ambient', 'gallery', 'other')),
  
  -- Dados do arquivo
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  
  -- URLs
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- Metadados
  alt_text VARCHAR(255),
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Tabela de logs de deploy
CREATE TABLE IF NOT EXISTS sistemaretiradas.site_deploys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sistemaretiradas.sites(id) ON DELETE CASCADE,
  version_id UUID REFERENCES sistemaretiradas.site_versions(id),
  
  -- Dados do deploy
  netlify_deploy_id VARCHAR(100),
  deploy_url TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'ready', 'error', 'cancelled')),
  error_message TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  deploy_time_seconds INTEGER,
  
  -- Trigger
  trigger_type VARCHAR(20) CHECK (trigger_type IN ('manual', 'auto', 'webhook', 'api'))
);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sites_slug ON sistemaretiradas.sites(slug);
CREATE INDEX IF NOT EXISTS idx_sites_status ON sistemaretiradas.sites(status);
CREATE INDEX IF NOT EXISTS idx_sites_segment ON sistemaretiradas.sites(segment_id);

CREATE INDEX IF NOT EXISTS idx_site_versions_site ON sistemaretiradas.site_versions(site_id);
CREATE INDEX IF NOT EXISTS idx_site_versions_status ON sistemaretiradas.site_versions(status);

CREATE INDEX IF NOT EXISTS idx_site_files_site ON sistemaretiradas.site_files(site_id);
CREATE INDEX IF NOT EXISTS idx_site_files_type ON sistemaretiradas.site_files(file_type);

CREATE INDEX IF NOT EXISTS idx_site_deploys_site ON sistemaretiradas.site_deploys(site_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION sistemaretiradas.update_sites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sites_updated_at ON sistemaretiradas.sites;
CREATE TRIGGER sites_updated_at
  BEFORE UPDATE ON sistemaretiradas.sites
  FOR EACH ROW EXECUTE FUNCTION sistemaretiradas.update_sites_updated_at();

-- ============================================
-- FUNÇÕES AUXILIARES
-- ============================================

-- Função para gerar slug único
CREATE OR REPLACE FUNCTION sistemaretiradas.generate_unique_site_slug(base_slug TEXT)
RETURNS TEXT AS $$
DECLARE
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  final_slug := LOWER(REGEXP_REPLACE(base_slug, '[^a-zA-Z0-9-]', '-', 'g'));
  final_slug := REGEXP_REPLACE(final_slug, '-+', '-', 'g');
  final_slug := TRIM(BOTH '-' FROM final_slug);
  
  WHILE EXISTS (SELECT 1 FROM sistemaretiradas.sites WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := LOWER(REGEXP_REPLACE(base_slug, '[^a-zA-Z0-9-]', '-', 'g')) || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Função para obter próxima versão
CREATE OR REPLACE FUNCTION sistemaretiradas.get_next_site_version(p_site_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM sistemaretiradas.site_versions
  WHERE site_id = p_site_id;
  
  RETURN next_version;
END;
$$ LANGUAGE plpgsql;
