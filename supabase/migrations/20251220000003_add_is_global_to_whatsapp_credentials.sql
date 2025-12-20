-- =====================================================
-- ADICIONAR is_global EM WHATSAPP_CREDENTIALS
-- =====================================================
-- Adiciona coluna is_global para distinguir credenciais globais
-- de credenciais específicas de loja
-- =====================================================

-- Adicionar coluna is_global
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_credentials' 
        AND column_name = 'is_global'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_credentials
        ADD COLUMN is_global BOOLEAN NOT NULL DEFAULT false;
        
        -- Todos os registros existentes são de lojas específicas (não globais)
        -- O DEFAULT já garante false, mas por segurança atualizamos
    END IF;
END $$;

-- Adicionar comentário para documentação
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.is_global IS 
'Indica se é credencial global (true) ou específica de loja (false). Credenciais globais são usadas como fallback quando a loja não tem credencial própria.';

-- Índice para queries de filtragem
CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_is_global 
    ON sistemaretiradas.whatsapp_credentials(is_global) 
    WHERE is_global = true;

