-- ============================================================================
-- Migration: Criar tabela para armazenar accounts e locations do Google My Business
-- Data: 2025-12-26
-- Descrição: Armazena informações de accounts e locations após autenticação OAuth
-- Schema: sistemaretiradas
-- ============================================================================

-- ============================================================================
-- Tabela: google_business_accounts
-- Armazena accounts e locations do Google My Business por customer e site
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.google_business_accounts (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL,
  site_slug VARCHAR(255) NOT NULL,
  account_id VARCHAR(255) NOT NULL, -- ex: "accounts/123456789"
  account_name VARCHAR(255),
  account_type VARCHAR(50), -- "PERSONAL", "ORGANIZATION"
  location_id VARCHAR(255), -- ex: "locations/987654321"
  location_name VARCHAR(255),
  location_address TEXT,
  location_phone VARCHAR(50),
  location_website TEXT,
  location_category VARCHAR(255),
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  location_primary_phone VARCHAR(50),
  location_primary_category VARCHAR(255),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (customer_id, site_slug, account_id, location_id)
);

-- Comentários
COMMENT ON TABLE sistemaretiradas.google_business_accounts IS 'Accounts e locations do Google My Business por customer e site';
COMMENT ON COLUMN sistemaretiradas.google_business_accounts.account_id IS 'ID da account do Google (formato: accounts/123456789)';
COMMENT ON COLUMN sistemaretiradas.google_business_accounts.location_id IS 'ID da location do Google (formato: locations/987654321)';
COMMENT ON COLUMN sistemaretiradas.google_business_accounts.is_primary IS 'Indica se é a location padrão para este customer/site';

-- Índices
CREATE INDEX IF NOT EXISTS idx_google_business_accounts_customer_site 
  ON sistemaretiradas.google_business_accounts(customer_id, site_slug);
CREATE INDEX IF NOT EXISTS idx_google_business_accounts_account 
  ON sistemaretiradas.google_business_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_google_business_accounts_location 
  ON sistemaretiradas.google_business_accounts(location_id);
CREATE INDEX IF NOT EXISTS idx_google_business_accounts_primary 
  ON sistemaretiradas.google_business_accounts(customer_id, site_slug, is_primary) 
  WHERE is_primary = true;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Habilitar RLS
ALTER TABLE sistemaretiradas.google_business_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: ADMIN pode ver accounts/locations de suas lojas
CREATE POLICY "ADMIN pode ver google_business_accounts de suas lojas"
  ON sistemaretiradas.google_business_accounts
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
          WHERE s.site_slug = google_business_accounts.site_slug
          AND s.id IN (
            SELECT store_id FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
          )
        )
      )
    )
  );

-- Policy: ADMIN pode inserir/atualizar accounts/locations
CREATE POLICY "ADMIN pode gerenciar google_business_accounts"
  ON sistemaretiradas.google_business_accounts
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
-- Trigger para updated_at
-- ============================================================================

CREATE TRIGGER update_google_business_accounts_updated_at
  BEFORE UPDATE ON sistemaretiradas.google_business_accounts
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_updated_at_column();

-- ============================================================================
-- Atualizar tabela google_reviews para incluir location_id e account_id
-- ============================================================================

-- Adicionar colunas se não existirem
DO $$ 
BEGIN
  -- Adicionar account_id se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'google_reviews' 
    AND column_name = 'account_id'
  ) THEN
    ALTER TABLE sistemaretiradas.google_reviews
    ADD COLUMN account_id VARCHAR(255);
  END IF;

  -- Adicionar location_id se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'google_reviews' 
    AND column_name = 'location_id'
  ) THEN
    ALTER TABLE sistemaretiradas.google_reviews
    ADD COLUMN location_id VARCHAR(255);
  END IF;

  -- Adicionar is_read se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'google_reviews' 
    AND column_name = 'is_read'
  ) THEN
    ALTER TABLE sistemaretiradas.google_reviews
    ADD COLUMN is_read BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Comentários
COMMENT ON COLUMN sistemaretiradas.google_reviews.account_id IS 'ID da account do Google (formato: accounts/123456789)';
COMMENT ON COLUMN sistemaretiradas.google_reviews.location_id IS 'ID da location do Google (formato: locations/987654321)';
COMMENT ON COLUMN sistemaretiradas.google_reviews.is_read IS 'Indica se o review foi lido pelo usuário';

-- Índices adicionais
CREATE INDEX IF NOT EXISTS idx_google_reviews_account_location 
  ON sistemaretiradas.google_reviews(account_id, location_id);
CREATE INDEX IF NOT EXISTS idx_google_reviews_is_read 
  ON sistemaretiradas.google_reviews(is_read) 
  WHERE is_read = false;

