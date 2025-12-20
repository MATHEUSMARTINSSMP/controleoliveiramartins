-- =====================================================
-- DIAGNÓSTICO COMPLETO - PROBLEMAS WHATSAPP IDENTIFICADOS
-- =====================================================
-- Execute esta query para obter um diagnóstico completo
-- dos problemas encontrados no sistema WhatsApp
-- =====================================================

-- =====================================================
-- PROBLEMA 1: Mr. Kitsch está desconectado no Supabase mas conectado no UazAPI
-- =====================================================
SELECT 
    '❌ PROBLEMA CRÍTICO: Mr. Kitsch' as categoria,
    'Status inconsistente entre Supabase e UazAPI' as problema,
    'Supabase: ' || wc.uazapi_status || ' | UazAPI: connected' as detalhes,
    'O número está conectado no UazAPI mas aparece como disconnected no Supabase' as descricao,
    'Solução: Executar "Verificar Status" no sistema ou atualizar manualmente abaixo' as solucao
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug = 'mrkitsch'
AND wc.uazapi_status != 'connected'

UNION ALL

-- =====================================================
-- PROBLEMA 2: Número de telefone NULL para Mr. Kitsch
-- =====================================================
SELECT 
    '⚠️ PROBLEMA: Mr. Kitsch' as categoria,
    'Número de telefone está NULL' as problema,
    'Deveria ser: 559699741090' as detalhes,
    'O número não está sendo salvo quando o status é atualizado' as descricao,
    'Solução: Atualizar manualmente (veja query de correção abaixo)' as solucao
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug = 'mrkitsch'
AND wc.uazapi_phone_number IS NULL

UNION ALL

-- =====================================================
-- PROBLEMA 3: Instance ID diferente
-- =====================================================
SELECT 
    '⚠️ PROBLEMA: Mr. Kitsch' as categoria,
    'Instance ID diferente do esperado' as problema,
    'Supabase: ' || COALESCE(wc.uazapi_instance_id, 'NULL') || ' | Esperado: mr_kitsch_matheusmartinss_icloud_com' as detalhes,
    'O instance_id não corresponde ao esperado do UazAPI' as descricao,
    'Solução: Atualizar instance_id (veja query de correção abaixo)' as solucao
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug = 'mrkitsch'
AND wc.uazapi_instance_id != 'mr_kitsch_matheusmartinss_icloud_com'

UNION ALL

-- =====================================================
-- PROBLEMA 4: Registro inválido (customer_id e site_slug vazios)
-- =====================================================
SELECT 
    '❌ PROBLEMA CRÍTICO: Dados Inválidos' as categoria,
    'Registro com customer_id e site_slug vazios' as problema,
    'Instance ID: ' || COALESCE(wc.uazapi_instance_id, 'NULL') || ' | Token: ' || LEFT(wc.uazapi_token, 20) || '...' as detalhes,
    'Este registro está corrompido e deve ser removido ou corrigido' as descricao,
    'Solução: Verificar origem e remover se não for necessário (veja query de limpeza abaixo)' as solucao
FROM sistemaretiradas.whatsapp_credentials wc
WHERE (wc.customer_id IS NULL OR wc.customer_id = '')
   OR (wc.site_slug IS NULL OR wc.site_slug = '')

UNION ALL

-- =====================================================
-- PROBLEMA 5: Números reserva precisam de conexão
-- =====================================================
SELECT 
    '⚠️ ATENÇÃO: Números Reserva' as categoria,
    'Números reserva aguardando QR Code' as problema,
    'Loungerie: Backup 1 | Mr. Kitsch: Backup 1' as detalhes,
    'Os números reserva estão configurados mas aguardando escaneamento do QR Code' as descricao,
    'Solução: Conectar os números reserva na página de Envio em Massa' as solucao
FROM sistemaretiradas.whatsapp_accounts wa
WHERE wa.uazapi_status = 'qr_required'
LIMIT 1

UNION ALL

-- =====================================================
-- PROBLEMA 6: Status desatualizado (mais de 30 minutos)
-- =====================================================
SELECT 
    '⚠️ ATENÇÃO: Status Desatualizado' as categoria,
    'Status não atualizado há mais de 30 minutos' as problema,
    'Mr. Kitsch: ' || ROUND(EXTRACT(EPOCH FROM (NOW() - wc.updated_at))/60, 0) || ' minutos atrás' as detalhes,
    'O status pode estar desatualizado' as descricao,
    'Solução: Executar verificação de status no sistema' as solucao
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug = 'mrkitsch'
AND wc.updated_at < NOW() - INTERVAL '30 minutes';

-- =====================================================
-- RESUMO DO DIAGNÓSTICO
-- =====================================================
SELECT 
    '📊 RESUMO DO DIAGNÓSTICO' as resumo,
    COUNT(*) FILTER (WHERE wc.uazapi_status = 'connected') as lojas_conectadas,
    COUNT(*) FILTER (WHERE wc.uazapi_status = 'disconnected') as lojas_desconectadas,
    COUNT(*) FILTER (WHERE wc.uazapi_status IS NULL) as lojas_sem_status,
    COUNT(*) FILTER (WHERE wc.uazapi_phone_number IS NULL AND wc.uazapi_status = 'connected') as conectadas_sem_numero,
    COUNT(*) FILTER (WHERE (wc.customer_id IS NULL OR wc.customer_id = '') OR (wc.site_slug IS NULL OR wc.site_slug = '')) as registros_invalidos,
    (SELECT COUNT(*) FROM sistemaretiradas.whatsapp_accounts WHERE uazapi_status = 'qr_required') as numeros_reserva_aguardando_qr
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug IN ('mrkitsch', 'sacadaohboy', 'loungerie');

-- =====================================================
-- QUERIES DE CORREÇÃO (DESCOMENTAR E EXECUTAR SE NECESSÁRIO)
-- =====================================================

-- =====================================================
-- CORREÇÃO 1: Atualizar Mr. Kitsch para "connected" com dados corretos
-- =====================================================
/*
UPDATE sistemaretiradas.whatsapp_credentials
SET 
    uazapi_status = 'connected',
    uazapi_phone_number = '559699741090',
    uazapi_instance_id = 'mr_kitsch_matheusmartinss_icloud_com',
    updated_at = NOW()
WHERE site_slug = 'mrkitsch'
AND customer_id = 'matheusmartinss@icloud.com'
RETURNING 
    site_slug, 
    uazapi_status, 
    uazapi_phone_number, 
    uazapi_instance_id,
    updated_at;
*/

-- =====================================================
-- CORREÇÃO 2: Remover registro inválido (CUIDADO: Verificar antes!)
-- =====================================================
/*
-- PRIMEIRO: Verificar o registro inválido
SELECT * FROM sistemaretiradas.whatsapp_credentials
WHERE (customer_id IS NULL OR customer_id = '')
   OR (site_slug IS NULL OR site_slug = '');

-- DEPOIS: Se confirmar que não é necessário, remover:
-- DELETE FROM sistemaretiradas.whatsapp_credentials
-- WHERE (customer_id IS NULL OR customer_id = '')
--    OR (site_slug IS NULL OR site_slug = '');
*/

-- =====================================================
-- VERIFICAÇÃO PÓS-CORREÇÃO
-- =====================================================
SELECT 
    '✅ VERIFICAÇÃO: Mr. Kitsch após correção' as verificacao,
    wc.site_slug,
    wc.uazapi_status,
    wc.uazapi_phone_number,
    wc.uazapi_instance_id,
    CASE 
        WHEN wc.uazapi_status = 'connected' AND wc.uazapi_phone_number = '559699741090' AND wc.uazapi_instance_id = 'mr_kitsch_matheusmartinss_icloud_com' 
        THEN '✅ Tudo correto!'
        ELSE '⚠️ Ainda há problemas'
    END as status_verificacao
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug = 'mrkitsch';

