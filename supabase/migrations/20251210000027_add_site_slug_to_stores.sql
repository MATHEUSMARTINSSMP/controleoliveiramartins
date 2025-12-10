-- =====================================================
-- ADICIONAR CAMPO site_slug NA TABELA stores
-- =====================================================
-- Campo único para identificar a loja na URL (ex: /loja/minha-loja)

ALTER TABLE sistemaretiradas.stores
ADD COLUMN IF NOT EXISTS site_slug VARCHAR(255) UNIQUE;

-- Criar índice para busca rápida por slug
CREATE INDEX IF NOT EXISTS idx_stores_site_slug ON sistemaretiradas.stores(site_slug);

-- Comentário
COMMENT ON COLUMN sistemaretiradas.stores.site_slug IS 'Slug único para identificação da loja na URL (ex: minha-loja)';

