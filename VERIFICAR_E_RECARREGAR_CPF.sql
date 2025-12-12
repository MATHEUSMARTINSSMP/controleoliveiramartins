-- ============================================================================
-- Script para verificar e garantir que a coluna CPF está disponível
-- Execute isso no Supabase SQL Editor após aplicar a migration
-- ============================================================================

-- 1. Verificar se a coluna cpf existe na tabela
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'crm_contacts'
  AND column_name = 'cpf';

-- 2. Se a coluna não existir, adicionar manualmente (isso não deve ser necessário se a migration foi aplicada)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
          AND table_name = 'crm_contacts' 
          AND column_name = 'cpf'
    ) THEN
        ALTER TABLE sistemaretiradas.crm_contacts
        ADD COLUMN cpf TEXT;
        
        -- Criar índices
        CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contacts_cpf_unique 
        ON sistemaretiradas.crm_contacts(cpf) 
        WHERE cpf IS NOT NULL;
        
        CREATE INDEX IF NOT EXISTS idx_crm_contacts_cpf 
        ON sistemaretiradas.crm_contacts(cpf);
        
        COMMENT ON COLUMN sistemaretiradas.crm_contacts.cpf IS 'CPF do cliente (identificador único, normalizado sem pontos e traços)';
        
        RAISE NOTICE 'Coluna cpf adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Coluna cpf já existe!';
    END IF;
END $$;

-- 3. Verificar a estrutura completa da tabela (resumo)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'crm_contacts'
ORDER BY ordinal_position;

-- 4. Verificar se os índices foram criados
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'crm_contacts'
  AND indexname LIKE '%cpf%';

-- 5. Recarregar o schema cache do PostgREST
-- NOTA: No Supabase Cloud, o PostgREST geralmente recarrega automaticamente após migrations
-- Mas se ainda houver problemas, você pode tentar:
-- - Reiniciar o projeto no dashboard do Supabase
-- - Ou aguardar alguns minutos para o cache expirar automaticamente

-- 6. Testar se a coluna está acessível via PostgREST
-- Execute este SELECT via API REST para verificar:
-- GET /rest/v1/crm_contacts?select=id,nome,cpf&limit=1
-- (usando Accept-Profile: sistemaretiradas header)

