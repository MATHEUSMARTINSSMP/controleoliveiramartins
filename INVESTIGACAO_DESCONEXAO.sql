-- =====================================================
-- INVESTIGAÇÃO: Motivo da Desconexão do Mr. Kitsch
-- =====================================================
-- Este arquivo investiga por que o Mr. Kitsch ficou como
-- "disconnected" no Supabase quando estava "connected" no UazAPI
-- =====================================================

-- =====================================================
-- 1. COMPARAR HISTÓRICO DE ATUALIZAÇÕES
-- =====================================================
-- Ver quando cada loja foi atualizada pela última vez
SELECT 
    '📅 Histórico de Atualizações' as analise,
    wc.site_slug as loja,
    wc.uazapi_status as status_atual,
    wc.uazapi_phone_number as numero_atual,
    wc.uazapi_instance_id as instance_id_atual,
    wc.updated_at as ultima_atualizacao,
    ROUND(EXTRACT(EPOCH FROM (NOW() - wc.updated_at))/60, 0) as minutos_atras,
    wc.created_at as criado_em,
    CASE 
        WHEN wc.updated_at < wc.created_at + INTERVAL '1 hour' THEN '⚠️ Poucas atualizações'
        WHEN wc.updated_at > NOW() - INTERVAL '1 hour' THEN '✅ Atualizado recentemente'
        ELSE '⚠️ Desatualizado'
    END as analise_atualizacao
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug IN ('mrkitsch', 'sacadaohboy', 'loungerie')
ORDER BY wc.updated_at DESC;

-- =====================================================
-- 2. VERIFICAR DIFERENÇAS ENTRE LOJAS FUNCIONAIS E PROBLEMÁTICA
-- =====================================================
-- Comparar configurações entre lojas conectadas e desconectadas
SELECT 
    '🔍 Comparação de Configurações' as analise,
    wc.site_slug,
    wc.uazapi_status,
    CASE 
        WHEN wc.uazapi_phone_number IS NULL THEN '❌ NULL'
        ELSE '✅ Tem número'
    END as tem_numero,
    CASE 
        WHEN wc.uazapi_instance_id LIKE 'mr_%' OR wc.uazapi_instance_id LIKE 'r%' THEN '✅ Formato esperado'
        ELSE '⚠️ Formato diferente'
    END as formato_instance_id,
    CASE 
        WHEN wc.uazapi_token IS NOT NULL THEN '✅ Tem token'
        ELSE '❌ Sem token'
    END as tem_token,
    wc.admin_id IS NOT NULL as tem_admin_id,
    wc.customer_id IS NOT NULL AND wc.customer_id != '' as tem_customer_id,
    wc.is_global as is_global
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug IN ('mrkitsch', 'sacadaohboy', 'loungerie')
ORDER BY 
    CASE wc.uazapi_status 
        WHEN 'connected' THEN 1 
        WHEN 'disconnected' THEN 2 
        ELSE 3 
    END;

-- =====================================================
-- 3. VERIFICAR SE HÁ PADRÃO NO INSTANCE_ID
-- =====================================================
-- Analisar se há diferença no formato dos instance_ids
SELECT 
    '🔍 Análise de Instance IDs' as analise,
    wc.site_slug,
    wc.uazapi_instance_id,
    CASE 
        WHEN wc.uazapi_instance_id LIKE 'mr_%' THEN 'Formato antigo (mr_..._matheusmartinss_icloud_com)'
        WHEN wc.uazapi_instance_id LIKE 'r%' AND LENGTH(wc.uazapi_instance_id) < 20 THEN 'Formato novo (r + alfanumérico curto)'
        WHEN wc.uazapi_instance_id LIKE 'sacada_%' THEN 'Formato antigo Sacada'
        ELSE 'Formato desconhecido'
    END as tipo_formato,
    LENGTH(wc.uazapi_instance_id) as tamanho,
    wc.uazapi_status,
    wc.uazapi_phone_number IS NOT NULL as tem_numero
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug IN ('mrkitsch', 'sacadaohboy', 'loungerie')
ORDER BY wc.site_slug;

-- =====================================================
-- 4. VERIFICAR SE O PROBLEMA É COM A SINCRONIZAÇÃO
-- =====================================================
-- Verificar se há diferença entre o que está no Supabase
-- e o que deveria estar baseado no padrão das outras lojas
SELECT 
    '🔍 Análise de Sincronização' as analise,
    'Mr. Kitsch' as loja_problema,
    wc_mr.uazapi_status as status_supabase,
    'connected' as status_uazapi_esperado,
    CASE 
        WHEN wc_mr.uazapi_status != 'connected' THEN 
            '❌ DESSINCRONIZADO: Supabase tem "' || wc_mr.uazapi_status || '" mas UazAPI mostra "connected"'
        ELSE '✅ Sincronizado'
    END as status_sincronizacao,
    wc_mr.uazapi_phone_number as numero_supabase,
    '559699741090' as numero_uazapi_esperado,
    CASE 
        WHEN wc_mr.uazapi_phone_number IS NULL THEN 
            '❌ DESSINCRONIZADO: Número NULL no Supabase'
        WHEN wc_mr.uazapi_phone_number != '559699741090' THEN 
            '⚠️ DESSINCRONIZADO: Número diferente'
        ELSE '✅ Número sincronizado'
    END as numero_sincronizacao,
    wc_mr.uazapi_instance_id as instance_id_supabase,
    'mr_kitsch_matheusmartinss_icloud_com' as instance_id_uazapi_esperado,
    CASE 
        WHEN wc_mr.uazapi_instance_id != 'mr_kitsch_matheusmartinss_icloud_com' THEN 
            '❌ DESSINCRONIZADO: Instance ID diferente'
        ELSE '✅ Instance ID sincronizado'
    END as instance_id_sincronizacao,
    wc_mr.updated_at as ultima_atualizacao,
    ROUND(EXTRACT(EPOCH FROM (NOW() - wc_mr.updated_at))/60, 0) as minutos_sem_atualizar
FROM sistemaretiradas.whatsapp_credentials wc_mr
WHERE wc_mr.site_slug = 'mrkitsch';

-- =====================================================
-- 5. VERIFICAR SE HÁ RELAÇÃO COM O REGISTRO INVÁLIDO
-- =====================================================
-- O registro inválido tem instance_id "sacada_oh_boy_matheusmartinss_icloud_com"
-- Verificar se há relação com problemas de sincronização
SELECT 
    '🔍 Análise do Registro Inválido' as analise,
    wc_invalid.*,
    CASE 
        WHEN wc_invalid.uazapi_instance_id = 'sacada_oh_boy_matheusmartinss_icloud_com' THEN 
            'Este instance_id parece ser da Sacada, mas está sem customer_id e site_slug'
        ELSE 'Instance ID desconhecido'
    END as observacao,
    'Possível causa: Migração ou atualização que corrompeu o registro' as hipotese
FROM sistemaretiradas.whatsapp_credentials wc_invalid
WHERE (wc_invalid.customer_id IS NULL OR wc_invalid.customer_id = '')
   OR (wc_invalid.site_slug IS NULL OR wc_invalid.site_slug = '');

-- =====================================================
-- 6. VERIFICAR POSSÍVEIS CAUSAS TÉCNICAS
-- =====================================================
SELECT 
    '🔍 Possíveis Causas Técnicas' as analise,
    '1. Prevenção de Downgrade Funcionou Incorretamente' as causa_1,
    '   - O código previne downgrade de connected para disconnected' as descricao_1,
    '   - Mas pode ter permitido um update que setou disconnected quando já estava connected' as hipotese_1,
    '' as separador_1,
    '2. N8N Retornou Status Incorreto' as causa_2,
    '   - N8N pode ter retornado "disconnected" quando estava "connected" no UazAPI' as descricao_2,
    '   - O sistema aceitou essa resposta e atualizou o banco' as hipotese_2,
    '' as separador_2,
    '3. Instance ID Mudou no UazAPI' as causa_3,
    '   - O instance_id pode ter mudado de "mr_kitsch_..." para "ra7ae85a994cbda"' as descricao_3,
    '   - O sistema atualizou mas não conseguiu manter o status "connected"' as hipotese_3,
    '' as separador_3,
    '4. Falha na Sincronização' as causa_4,
    '   - A última atualização (12:32:59) pode ter sido um erro' as descricao_4,
    '   - O sistema pode ter setado disconnected por algum motivo (timeout, erro, etc)' as hipotese_4;

-- =====================================================
-- 7. VERIFICAR SE OUTRAS LOJAS TÊM O MESMO PROBLEMA
-- =====================================================
-- Verificar se há outras lojas com instance_id no formato antigo mas status diferente
SELECT 
    '🔍 Verificação de Padrão' as analise,
    wc.site_slug,
    wc.uazapi_status,
    wc.uazapi_instance_id,
    CASE 
        WHEN wc.uazapi_instance_id LIKE 'mr_%' AND wc.uazapi_status != 'connected' THEN 
            '⚠️ Instance ID formato antigo mas status não é connected'
        WHEN wc.uazapi_instance_id LIKE 'r%' AND LENGTH(wc.uazapi_instance_id) < 20 AND wc.uazapi_status = 'connected' THEN 
            '✅ Formato novo e conectado (padrão atual)'
        ELSE 'ℹ️ Outro padrão'
    END as analise_padrao
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug IN ('mrkitsch', 'sacadaohboy', 'loungerie')
ORDER BY wc.site_slug;

-- =====================================================
-- 8. CONCLUSÃO E RECOMENDAÇÕES
-- =====================================================
SELECT 
    '📋 CONCLUSÃO DA INVESTIGAÇÃO' as conclusao,
    'PROBLEMA IDENTIFICADO:' as problema,
    'Mr. Kitsch estava "connected" no UazAPI mas "disconnected" no Supabase' as descricao_problema,
    '' as espaco_1,
    'POSSÍVEIS CAUSAS:' as causas,
    '1. N8N retornou status incorreto e o sistema atualizou sem prevenção de downgrade' as causa_1,
    '2. Instance ID mudou e a atualização setou status incorreto' as causa_2,
    '3. Falha na sincronização durante última atualização (12:32:59)' as causa_3,
    '' as espaco_2,
    'RECOMENDAÇÕES:' as recomendacoes,
    '1. ✅ JÁ CORRIGIDO: Status, número e instance_id atualizados manualmente' as rec_1,
    '2. 🔍 INVESTIGAR: Por que o código de prevenção de downgrade não funcionou' as rec_2,
    '3. 🔧 MELHORAR: Adicionar logs para rastrear mudanças de status' as rec_3,
    '4. 🛡️ PREVENIR: Validar resposta do N8N antes de atualizar status' as rec_4,
    '5. 🧹 LIMPAR: Remover registro inválido após análise' as rec_5;

