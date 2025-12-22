-- ============================================
-- ADICIONAR CAMPOS tenant_id e last_reset_at NA TABELA SITES
-- ============================================

ALTER TABLE sistemaretiradas.sites 
ADD COLUMN IF NOT EXISTS tenant_id UUID,
ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sites_tenant ON sistemaretiradas.sites(tenant_id);

COMMENT ON COLUMN sistemaretiradas.sites.tenant_id IS 'ID da loja (store) que possui o site';
COMMENT ON COLUMN sistemaretiradas.sites.last_reset_at IS 'Data do último reset do site (limite de 1 reset a cada 30 dias)';
