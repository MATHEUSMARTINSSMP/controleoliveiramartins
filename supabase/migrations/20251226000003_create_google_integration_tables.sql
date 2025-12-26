-- ============================================================================
-- Migration: Criar tabelas para integração Google My Business
-- Data: 2025-12-26
-- Descrição: Tabelas para armazenar credenciais OAuth e reviews do Google
-- Schema: elevea (conforme esperado pelo n8n)
-- ============================================================================

-- Criar schema elevea se não existir
CREATE SCHEMA IF NOT EXISTS elevea;

-- ============================================================================
-- Tabela: google_credentials
-- Armazena tokens OAuth do Google por customer_id e site_slug
-- ============================================================================
CREATE TABLE IF NOT EXISTS elevea.google_credentials (
  customer_id VARCHAR(255) NOT NULL,
  site_slug VARCHAR(255) NOT NULL,
  scopes TEXT,
  status VARCHAR(50) DEFAULT 'active',
  access_token TEXT,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (customer_id, site_slug)
);

-- Comentários
COMMENT ON TABLE elevea.google_credentials IS 'Credenciais OAuth do Google por customer e site';
COMMENT ON COLUMN elevea.google_credentials.customer_id IS 'ID do cliente (email)';
COMMENT ON COLUMN elevea.google_credentials.site_slug IS 'Slug do site';
COMMENT ON COLUMN elevea.google_credentials.scopes IS 'Escopos OAuth autorizados';
COMMENT ON COLUMN elevea.google_credentials.status IS 'Status: active, expired, revoked';
COMMENT ON COLUMN elevea.google_credentials.access_token IS 'Access token OAuth';
COMMENT ON COLUMN elevea.google_credentials.refresh_token IS 'Refresh token OAuth';
COMMENT ON COLUMN elevea.google_credentials.expires_at IS 'Data de expiração do access_token';

-- Índices
CREATE INDEX IF NOT EXISTS idx_google_credentials_status 
  ON elevea.google_credentials(status);
CREATE INDEX IF NOT EXISTS idx_google_credentials_expires_at 
  ON elevea.google_credentials(expires_at);

-- ============================================================================
-- Tabela: google_reviews
-- Armazena reviews do Google My Business
-- ============================================================================
CREATE TABLE IF NOT EXISTS elevea.google_reviews (
  review_id SERIAL PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL,
  site_slug VARCHAR(255) NOT NULL,
  review_id_external VARCHAR(255) NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  author_name VARCHAR(200),
  review_date TIMESTAMPTZ,
  reply TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (customer_id, site_slug, review_id_external)
);

-- Comentários
COMMENT ON TABLE elevea.google_reviews IS 'Reviews do Google My Business';
COMMENT ON COLUMN elevea.google_reviews.review_id_external IS 'ID externo do review (do Google)';
COMMENT ON COLUMN elevea.google_reviews.rating IS 'Avaliação de 1 a 5 estrelas';
COMMENT ON COLUMN elevea.google_reviews.reply IS 'Resposta ao review';

-- Índices
CREATE INDEX IF NOT EXISTS idx_google_reviews_customer_site 
  ON elevea.google_reviews(customer_id, site_slug);
CREATE INDEX IF NOT EXISTS idx_google_reviews_review_date 
  ON elevea.google_reviews(review_date DESC);
CREATE INDEX IF NOT EXISTS idx_google_reviews_rating 
  ON elevea.google_reviews(rating);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Habilitar RLS
ALTER TABLE elevea.google_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE elevea.google_reviews ENABLE ROW LEVEL SECURITY;

-- Policy: ADMIN pode ver todas as credenciais de suas lojas
CREATE POLICY "ADMIN pode ver google_credentials de suas lojas"
  ON elevea.google_credentials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND (
        -- Se o customer_id é o email do admin
        customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR
        -- Ou se o admin tem acesso à loja através do site_slug
        EXISTS (
          SELECT 1 FROM sistemaretiradas.stores s
          WHERE s.slug = google_credentials.site_slug
          AND s.id IN (
            SELECT store_id FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
          )
        )
      )
    )
  );

-- Policy: ADMIN pode inserir/atualizar credenciais
CREATE POLICY "ADMIN pode gerenciar google_credentials"
  ON elevea.google_credentials
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Policy: ADMIN pode ver reviews de suas lojas
CREATE POLICY "ADMIN pode ver google_reviews de suas lojas"
  ON elevea.google_reviews
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND (
        customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR
        EXISTS (
          SELECT 1 FROM sistemaretiradas.stores s
          WHERE s.slug = google_reviews.site_slug
          AND s.id IN (
            SELECT store_id FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
          )
        )
      )
    )
  );

-- Policy: ADMIN pode inserir/atualizar reviews
CREATE POLICY "ADMIN pode gerenciar google_reviews"
  ON elevea.google_reviews
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ============================================================================
-- Triggers para updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION elevea.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_google_credentials_updated_at
  BEFORE UPDATE ON elevea.google_credentials
  FOR EACH ROW
  EXECUTE FUNCTION elevea.update_updated_at_column();

CREATE TRIGGER update_google_reviews_updated_at
  BEFORE UPDATE ON elevea.google_reviews
  FOR EACH ROW
  EXECUTE FUNCTION elevea.update_updated_at_column();

