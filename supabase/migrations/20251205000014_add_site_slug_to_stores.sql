-- ============================================================================
-- Migration: Adicionar coluna site_slug na tabela stores
-- Data: 2025-12-05
-- Descrição: Adiciona coluna site_slug para facilitar identificação da loja
--            e compatibilidade com workflows que usam slug
-- ============================================================================

-- Adicionar coluna site_slug na tabela stores
ALTER TABLE sistemaretiradas.stores 
  ADD COLUMN IF NOT EXISTS site_slug VARCHAR(255);

-- Comentário para documentação
COMMENT ON COLUMN sistemaretiradas.stores.site_slug IS 'Slug único da loja (usado para identificação em workflows e APIs)';

-- Criar índice único para garantir que site_slug seja único
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_site_slug_unique 
  ON sistemaretiradas.stores(site_slug) 
  WHERE site_slug IS NOT NULL;

-- Índice para busca rápida por site_slug
CREATE INDEX IF NOT EXISTS idx_stores_site_slug 
  ON sistemaretiradas.stores(site_slug) 
  WHERE site_slug IS NOT NULL;

-- ============================================================================
-- Função para gerar site_slug automaticamente a partir do nome da loja
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.generate_site_slug(store_name TEXT)
RETURNS TEXT AS $$
DECLARE
  slug TEXT;
BEGIN
  -- Converter para minúsculas e substituir espaços e caracteres especiais
  slug := LOWER(store_name);
  slug := REGEXP_REPLACE(slug, '[^a-z0-9]', '', 'g');
  slug := REGEXP_REPLACE(slug, '\s+', '', 'g');
  
  -- Se o slug estiver vazio, usar um padrão
  IF slug = '' OR slug IS NULL THEN
    slug := 'loja-' || EXTRACT(EPOCH FROM NOW())::TEXT;
  END IF;
  
  RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Atualizar site_slug existentes baseado no nome da loja
-- ============================================================================
UPDATE sistemaretiradas.stores
SET site_slug = sistemaretiradas.generate_site_slug(name)
WHERE site_slug IS NULL OR site_slug = '';

-- ============================================================================
-- Trigger para atualizar site_slug automaticamente quando o nome muda
-- (opcional - pode ser desabilitado se preferir controle manual)
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.update_store_site_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Só atualizar se site_slug estiver vazio ou se o nome mudou significativamente
  IF NEW.site_slug IS NULL OR NEW.site_slug = '' THEN
    NEW.site_slug := sistemaretiradas.generate_site_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_store_site_slug ON sistemaretiradas.stores;
CREATE TRIGGER trigger_update_store_site_slug
  BEFORE INSERT OR UPDATE ON sistemaretiradas.stores
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_store_site_slug();

-- ============================================================================
-- Verificação
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'stores'
    AND column_name = 'site_slug'
  ) THEN
    RAISE NOTICE '✅ Coluna site_slug adicionada com sucesso na tabela stores';
  ELSE
    RAISE EXCEPTION '❌ Falha ao adicionar coluna site_slug na tabela stores';
  END IF;
END $$;

