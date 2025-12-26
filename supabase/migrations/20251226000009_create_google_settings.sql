-- ============================================================================
-- Migration: Criar tabela de configurações do Google My Business
-- Data: 2025-12-26
-- Descrição: Tabela para armazenar preferências de notificações e alertas
-- Schema: sistemaretiradas
-- ============================================================================

-- Criar tabela google_settings
CREATE TABLE IF NOT EXISTS sistemaretiradas.google_settings (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL,
  site_slug VARCHAR(255) NOT NULL,
  notify_new_reviews BOOLEAN DEFAULT true,
  notify_negative_reviews BOOLEAN DEFAULT true,
  alert_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (customer_id, site_slug)
);

-- Comentários
COMMENT ON TABLE sistemaretiradas.google_settings IS 'Configurações de notificações e alertas do Google My Business';
COMMENT ON COLUMN sistemaretiradas.google_settings.notify_new_reviews IS 'Notificar quando receber novos reviews';
COMMENT ON COLUMN sistemaretiradas.google_settings.notify_negative_reviews IS 'Alertar sobre reviews negativos (<= 2 estrelas)';
COMMENT ON COLUMN sistemaretiradas.google_settings.alert_email IS 'Email para receber alertas (opcional)';

-- RLS Policies
ALTER TABLE sistemaretiradas.google_settings ENABLE ROW LEVEL SECURITY;

-- Policy: ADMIN pode ver suas configurações
CREATE POLICY "ADMIN pode ver suas google_settings"
  ON sistemaretiradas.google_settings
  FOR SELECT
  TO authenticated
  USING (
    customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM sistemaretiradas.stores s
      WHERE s.slug = google_settings.site_slug
      AND s.id IN (
        SELECT store_id FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Policy: ADMIN pode atualizar suas configurações
CREATE POLICY "ADMIN pode atualizar suas google_settings"
  ON sistemaretiradas.google_settings
  FOR UPDATE
  TO authenticated
  USING (
    customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM sistemaretiradas.stores s
      WHERE s.slug = google_settings.site_slug
      AND s.id IN (
        SELECT store_id FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Policy: ADMIN pode inserir suas configurações
CREATE POLICY "ADMIN pode inserir suas google_settings"
  ON sistemaretiradas.google_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM sistemaretiradas.stores s
      WHERE s.slug = google_settings.site_slug
      AND s.id IN (
        SELECT store_id FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
      )
    )
  );
