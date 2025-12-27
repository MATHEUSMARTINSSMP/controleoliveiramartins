-- ============================================================================
-- Migration: Criar tabela de histórico de respostas de reviews
-- Data: 2025-12-26
-- Descrição: Tabela para armazenar histórico de edições de respostas
-- Schema: sistemaretiradas
-- ============================================================================

-- Criar tabela google_reply_history
CREATE TABLE IF NOT EXISTS sistemaretiradas.google_reply_history (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES sistemaretiradas.google_reviews(review_id) ON DELETE CASCADE,
  reply_content TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentários
COMMENT ON TABLE sistemaretiradas.google_reply_history IS 'Histórico de respostas de reviews do Google';
COMMENT ON COLUMN sistemaretiradas.google_reply_history.review_id IS 'ID interno do review';
COMMENT ON COLUMN sistemaretiradas.google_reply_history.reply_content IS 'Conteúdo da resposta';
COMMENT ON COLUMN sistemaretiradas.google_reply_history.user_id IS 'Usuário que enviou a resposta';

-- Índices
CREATE INDEX IF NOT EXISTS idx_google_reply_history_review_id 
  ON sistemaretiradas.google_reply_history(review_id);

-- RLS Policies
ALTER TABLE sistemaretiradas.google_reply_history ENABLE ROW LEVEL SECURITY;

-- Policy: ADMIN pode ver histórico de suas lojas
CREATE POLICY "ADMIN pode ver google_reply_history de suas lojas"
  ON sistemaretiradas.google_reply_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.google_reviews r
      WHERE r.review_id = google_reply_history.review_id
      AND (
        -- Se o customer_id é o email do admin
        r.customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR
        -- Ou se o admin tem acesso à loja através do site_slug
        EXISTS (
          SELECT 1 FROM sistemaretiradas.stores s
          WHERE s.site_slug = r.site_slug
          AND s.id IN (
            SELECT store_id FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
          )
        )
      )
    )
  );

-- Policy: ADMIN pode inserir histórico
CREATE POLICY "ADMIN pode inserir google_reply_history"
  ON sistemaretiradas.google_reply_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.google_reviews r
      WHERE r.review_id = google_reply_history.review_id
      AND (
        r.customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR
        EXISTS (
          SELECT 1 FROM sistemaretiradas.stores s
          WHERE s.site_slug = r.site_slug
          AND s.id IN (
            SELECT store_id FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
          )
        )
      )
    )
  );
