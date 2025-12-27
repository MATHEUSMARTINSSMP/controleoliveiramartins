-- ============================================================================
-- Migration: Corrigir RLS policies de google_reviews para não usar auth.users
-- Data: 2025-12-27
-- Descrição: Substituir SELECT email FROM auth.users por email da tabela profiles
-- ============================================================================

DROP POLICY IF EXISTS "ADMIN pode ver google_reviews de suas lojas" ON sistemaretiradas.google_reviews;
DROP POLICY IF EXISTS "ADMIN pode gerenciar google_reviews" ON sistemaretiradas.google_reviews;

-- Policy: ADMIN pode ver reviews de suas lojas
CREATE POLICY "ADMIN pode ver google_reviews de suas lojas"
  ON sistemaretiradas.google_reviews
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND (
        customer_id = p.email
        OR
        EXISTS (
          SELECT 1 FROM sistemaretiradas.stores s
          WHERE s.site_slug = google_reviews.site_slug
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
  ON sistemaretiradas.google_reviews
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND customer_id = p.email
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND customer_id = p.email
    )
  );

