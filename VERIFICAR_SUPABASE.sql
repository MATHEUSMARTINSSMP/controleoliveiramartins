-- Script para verificar dados no Supabase
-- Schema: sistemaretiradas

-- 1. Verificar todas as lojas (ativas e inativas)
SELECT 
    id,
    name,
    active,
    sistema_erp,
    created_at,
    updated_at
FROM sistemaretiradas.stores
ORDER BY name;

-- 2. Verificar todas as integrações ERP
SELECT 
    ei.id,
    ei.store_id,
    s.name as store_name,
    ei.sistema_erp,
    ei.sync_status,
    ei.client_id,
    LEFT(ei.client_secret, 10) || '...' as client_secret_preview,
    ei.last_sync_at,
    ei.error_message,
    ei.active,
    ei.created_at,
    ei.updated_at
FROM sistemaretiradas.erp_integrations ei
LEFT JOIN sistemaretiradas.stores s ON s.id = ei.store_id
ORDER BY s.name;

-- 3. Verificar quantas lojas têm integração configurada
SELECT 
    COUNT(DISTINCT store_id) as total_lojas_com_integracao,
    COUNT(*) as total_integracoes,
    COUNT(*) FILTER (WHERE sync_status = 'CONNECTED') as conectadas,
    COUNT(*) FILTER (WHERE sync_status = 'DISCONNECTED') as desconectadas,
    COUNT(*) FILTER (WHERE sync_status = 'ERROR') as com_erro
FROM sistemaretiradas.erp_integrations
WHERE active = true;

-- 4. Verificar lojas sem integração
SELECT 
    s.id,
    s.name,
    s.active,
    s.sistema_erp
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.erp_integrations ei ON ei.store_id = s.id AND ei.active = true
WHERE ei.id IS NULL
ORDER BY s.name;

-- 5. Verificar estrutura da tabela erp_integrations
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas' 
  AND table_name = 'erp_integrations'
ORDER BY ordinal_position;

-- 6. Verificar estrutura da tabela stores
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas' 
  AND table_name = 'stores'
ORDER BY ordinal_position;

