-- ============================================================================
-- Migration: Adicionar location_id opcional em google_credentials
-- Data: 2025-12-27
-- Descrição: Permite mapear uma location específica do Google para uma loja
--            Suporta: 1 conta Google → múltiplas lojas (cada location → uma loja)
-- ============================================================================

-- Adicionar coluna location_id (opcional)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'google_credentials' 
    AND column_name = 'location_id'
  ) THEN
    ALTER TABLE sistemaretiradas.google_credentials
    ADD COLUMN location_id VARCHAR(255);
    
    COMMENT ON COLUMN sistemaretiradas.google_credentials.location_id IS 'ID da location do Google (opcional). Quando definido, apenas esta location será usada para esta loja. Permite mapear 1 conta Google com múltiplas locations para múltiplas lojas.';
  END IF;
END $$;

-- Criar índice composto para melhor performance em queries
CREATE INDEX IF NOT EXISTS idx_google_credentials_location 
  ON sistemaretiradas.google_credentials(customer_id, site_slug, location_id)
  WHERE location_id IS NOT NULL;

-- Criar índice para buscar credenciais por location_id
CREATE INDEX IF NOT EXISTS idx_google_credentials_location_id 
  ON sistemaretiradas.google_credentials(location_id)
  WHERE location_id IS NOT NULL;

-- Comentário adicional na tabela
COMMENT ON TABLE sistemaretiradas.google_credentials IS 'Credenciais OAuth do Google por customer e site. Pode incluir location_id opcional para mapear uma location específica de uma conta Google para uma loja específica.';

