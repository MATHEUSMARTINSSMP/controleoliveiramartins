-- =====================================================
-- MIGRAR whatsapp_credentials PARA USAR admin_id
-- =====================================================
-- Adiciona coluna admin_id e migra dados existentes
-- Mantém customer_id por compatibilidade (será deprecado)

-- 1. Adicionar coluna admin_id
ALTER TABLE sistemaretiradas.whatsapp_credentials
ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE;

-- 2. Criar índice para admin_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_admin_id 
  ON sistemaretiradas.whatsapp_credentials(admin_id);

-- 3. Migrar dados existentes: customer_id (email) -> admin_id (profile.id)
-- Busca o profile.id baseado no email do customer_id
UPDATE sistemaretiradas.whatsapp_credentials wc
SET admin_id = p.id
FROM auth.users u
JOIN sistemaretiradas.profiles p ON p.id = u.id
WHERE wc.customer_id = u.email
  AND wc.admin_id IS NULL;

-- 4. Criar constraint única para (admin_id, site_slug)
-- Isso permite usar admin_id como chave única junto com site_slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_credentials_admin_site_unique 
  ON sistemaretiradas.whatsapp_credentials(admin_id, site_slug) 
  WHERE admin_id IS NOT NULL;

-- 5. Atualizar comentário
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.admin_id IS 'ID do admin (profile.id) - usar este campo ao invés de customer_id';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.customer_id IS 'DEPRECADO: Use admin_id. Mantido apenas para compatibilidade.';

