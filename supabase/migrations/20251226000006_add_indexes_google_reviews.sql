-- ============================================================================
-- Migration: Adicionar Índices Compostos para Performance
-- Data: 2025-12-26
-- Descrição: Índices compostos para otimizar queries de filtros e busca
-- ============================================================================

-- Índice composto para filtros comuns (is_read, review_date)
CREATE INDEX IF NOT EXISTS idx_google_reviews_customer_site_read_date 
  ON elevea.google_reviews(customer_id, site_slug, is_read, review_date DESC)
  WHERE is_read = false; -- Índice parcial para reviews não lidas

-- Índice composto para filtros por rating e data
CREATE INDEX IF NOT EXISTS idx_google_reviews_customer_site_rating_date 
  ON elevea.google_reviews(customer_id, site_slug, rating, review_date DESC);

-- Índice composto para filtros por account e location
CREATE INDEX IF NOT EXISTS idx_google_reviews_customer_site_account_location 
  ON elevea.google_reviews(customer_id, site_slug, account_id, location_id)
  WHERE account_id IS NOT NULL AND location_id IS NOT NULL;

-- Índice composto para reviews com resposta (para filtrar respondidas/não respondidas)
CREATE INDEX IF NOT EXISTS idx_google_reviews_customer_site_reply 
  ON elevea.google_reviews(customer_id, site_slug, (CASE WHEN reply IS NULL OR reply = '' THEN false ELSE true END), review_date DESC);

-- Índice para busca de texto (usando GIN para full-text search se necessário no futuro)
-- Por enquanto, apenas índice básico para comentários não-nulos
CREATE INDEX IF NOT EXISTS idx_google_reviews_comment_text 
  ON elevea.google_reviews(customer_id, site_slug)
  WHERE comment IS NOT NULL AND comment != '';

-- Comentários
COMMENT ON INDEX elevea.idx_google_reviews_customer_site_read_date IS 
'Índice para queries de reviews não lidas ordenadas por data (filtros comuns)';

COMMENT ON INDEX elevea.idx_google_reviews_customer_site_rating_date IS 
'Índice para queries filtradas por rating e ordenadas por data';

COMMENT ON INDEX elevea.idx_google_reviews_customer_site_account_location IS 
'Índice para queries filtradas por account e location específicos';

COMMENT ON INDEX elevea.idx_google_reviews_customer_site_reply IS 
'Índice para queries filtradas por reviews respondidas/não respondidas';

COMMENT ON INDEX elevea.idx_google_reviews_comment_text IS 
'Índice para queries de busca de texto em comentários';


