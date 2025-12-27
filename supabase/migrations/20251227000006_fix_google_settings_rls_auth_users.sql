-- ============================================================================
-- Migration: Corrigir RLS policies de google_settings para não usar auth.users
-- Data: 2025-12-27
-- Descrição: Substituir SELECT email FROM auth.users por email da tabela profiles
-- ============================================================================

DROP POLICY IF EXISTS "ADMIN pode ver suas google_settings" ON sistemaretiradas.google_settings;
DROP POLICY IF EXISTS "ADMIN pode atualizar suas google_settings" ON sistemaretiradas.google_settings;
DROP POLICY IF EXISTS "ADMIN pode inserir suas google_settings" ON sistemaretiradas.google_settings;

-- Policy: ADMIN pode ver suas configurações
CREATE POLICY "ADMIN pode ver suas google_settings"
  ON sistemaretiradas.google_settings
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
          WHERE s.site_slug = google_settings.site_slug
          AND s.id IN (
            SELECT store_id FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
          )
        )
      )
    )
  );

-- Policy: ADMIN pode atualizar suas configurações
CREATE POLICY "ADMIN pode atualizar suas google_settings"
  ON sistemaretiradas.google_settings
  FOR UPDATE
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
          WHERE s.site_slug = google_settings.site_slug
          AND s.id IN (
            SELECT store_id FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
          )
        )
      )
    )
  );

-- Policy: ADMIN pode inserir suas configurações
CREATE POLICY "ADMIN pode inserir suas google_settings"
  ON sistemaretiradas.google_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND (
        customer_id = p.email
        OR
        EXISTS (
          SELECT 1 FROM sistemaretiradas.stores s
          WHERE s.site_slug = google_settings.site_slug
          AND s.id IN (
            SELECT store_id FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
          )
        )
      )
    )
  );

