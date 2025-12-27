-- ============================================================================
-- Migration: Corrigir RLS policies de google_reply_history para não usar auth.users
-- Data: 2025-12-27
-- Descrição: Substituir SELECT email FROM auth.users por email da tabela profiles
-- ============================================================================

DROP POLICY IF EXISTS "ADMIN pode ver google_reply_history de suas lojas" ON sistemaretiradas.google_reply_history;
DROP POLICY IF EXISTS "ADMIN pode inserir google_reply_history" ON sistemaretiradas.google_reply_history;

-- Policy: ADMIN pode ver histórico de suas lojas
CREATE POLICY "ADMIN pode ver google_reply_history de suas lojas"
  ON sistemaretiradas.google_reply_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.google_reviews r
      JOIN sistemaretiradas.profiles p ON p.id = auth.uid()
      WHERE r.review_id = google_reply_history.review_id
      AND p.role = 'ADMIN'
      AND (
        r.customer_id = p.email
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

-- Policy: ADMIN pode inserir histórico
CREATE POLICY "ADMIN pode inserir google_reply_history"
  ON sistemaretiradas.google_reply_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.google_reviews r
      JOIN sistemaretiradas.profiles p ON p.id = auth.uid()
      WHERE r.review_id = google_reply_history.review_id
      AND p.role = 'ADMIN'
      AND (
        r.customer_id = p.email
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

