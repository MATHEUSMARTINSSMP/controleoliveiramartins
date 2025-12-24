-- ============================================================================
-- DIAGNÓSTICO: VENDAS DO ERP NÃO ESTÃO SENDO PROCESSADAS PARA SALES
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Verificar por que vendas do ERP (tiny_orders) não estão gerando sales
-- ============================================================================

-- 1. VERIFICAR SE O TRIGGER ESTÁ ATIVO
-- ============================================================================
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled,
    tgisinternal as is_internal
FROM pg_trigger
WHERE tgname = 'trigger_auto_processar_tiny_order'
    AND tgrelid = 'sistemaretiradas.tiny_orders'::regclass;

-- 2. LISTAR PEDIDOS DO TINY_ORDERS QUE NÃO TÊM SALES CORRESPONDENTES (LOUNGERIE)
-- ============================================================================
-- Estes são os pedidos que deveriam ter gerado vendas mas não geraram
SELECT 
    to.id as tiny_order_id,
    to.numero_pedido,
    to.data_pedido,
    to.valor_total,
    to.vendedor_nome,
    to.colaboradora_id,
    c.name as colaboradora_nome,
    to.store_id,
    st.name as store_name,
    to.created_at,
    to.updated_at,
    CASE 
        WHEN to.colaboradora_id IS NULL THEN '❌ SEM COLABORADORA_ID'
        WHEN to.store_id IS NULL THEN '❌ SEM STORE_ID'
        WHEN to.valor_total <= 0 THEN '❌ VALOR ZERO OU NEGATIVO'
        ELSE '✅ DADOS VÁLIDOS'
    END as status_validacao,
    s.id as sale_id_existente
FROM sistemaretiradas.tiny_orders to
LEFT JOIN sistemaretiradas.profiles c ON c.id = to.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = to.store_id
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = to.id
WHERE to.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b' -- Loungerie
    AND s.id IS NULL -- Não tem sale correspondente
    AND (
        to.created_at >= NOW() - INTERVAL '7 days'
        OR to.updated_at >= NOW() - INTERVAL '7 days'
    )
ORDER BY GREATEST(to.created_at, to.updated_at) DESC;

-- 3. TENTAR PROCESSAR MANUALMENTE OS PEDIDOS QUE DEVERIAM TER SIDO PROCESSADOS
-- ============================================================================
-- Esta função tenta processar todos os pedidos válidos que não têm sales
DO $$
DECLARE
    v_pedido RECORD;
    v_sale_id UUID;
    v_processados INTEGER := 0;
    v_erros INTEGER := 0;
    v_resultado TEXT;
BEGIN
    RAISE NOTICE '=== INICIANDO PROCESSAMENTO MANUAL DE PEDIDOS PENDENTES ===';
    
    FOR v_pedido IN
        SELECT to.id
        FROM sistemaretiradas.tiny_orders to
        LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = to.id
        WHERE to.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b' -- Loungerie
            AND s.id IS NULL -- Não tem sale correspondente
            AND to.colaboradora_id IS NOT NULL
            AND to.store_id IS NOT NULL
            AND to.valor_total > 0
            AND (
                to.created_at >= NOW() - INTERVAL '7 days'
                OR to.updated_at >= NOW() - INTERVAL '7 days'
            )
    LOOP
        BEGIN
            v_sale_id := sistemaretiradas.processar_tiny_order_para_venda(v_pedido.id);
            
            IF v_sale_id IS NOT NULL THEN
                v_processados := v_processados + 1;
                RAISE NOTICE '✅ Pedido % processado com sucesso -> Sale ID: %', v_pedido.id, v_sale_id;
            ELSE
                v_erros := v_erros + 1;
                RAISE WARNING '❌ Pedido % não pôde ser processado', v_pedido.id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_erros := v_erros + 1;
            RAISE WARNING '❌ ERRO ao processar pedido %: %', v_pedido.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '=== PROCESSAMENTO CONCLUÍDO ===';
    RAISE NOTICE 'Processados: %, Erros: %', v_processados, v_erros;
END $$;

-- 4. VERIFICAR SE HÁ PEDIDOS COM COLABORADORA_ID NULL (PRINCIPAL MOTIVO DE FALHA)
-- ============================================================================
SELECT 
    COUNT(*) as total_pedidos_sem_colaboradora,
    COUNT(DISTINCT numero_pedido) as pedidos_unicos_sem_colaboradora,
    MIN(created_at) as primeiro_pedido,
    MAX(created_at) as ultimo_pedido
FROM sistemaretiradas.tiny_orders
WHERE store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b' -- Loungerie
    AND colaboradora_id IS NULL
    AND (
        created_at >= NOW() - INTERVAL '7 days'
        OR updated_at >= NOW() - INTERVAL '7 days'
    );

-- 5. LISTAR PEDIDOS SEM COLABORADORA_ID COM DETALHES DO VENDEDOR
-- ============================================================================
-- Para ajudar no mapeamento manual
SELECT 
    to.id,
    to.numero_pedido,
    to.data_pedido,
    to.valor_total,
    to.vendedor_nome,
    to.vendedor_tiny_id,
    to.created_at,
    CASE 
        WHEN to.vendedor_nome IS NOT NULL THEN 'Tem nome do vendedor'
        WHEN to.vendedor_tiny_id IS NOT NULL THEN 'Tem ID do vendedor no Tiny'
        ELSE 'Sem informações do vendedor'
    END as info_vendedor
FROM sistemaretiradas.tiny_orders to
WHERE to.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b' -- Loungerie
    AND to.colaboradora_id IS NULL
    AND (
        to.created_at >= NOW() - INTERVAL '7 days'
        OR to.updated_at >= NOW() - INTERVAL '7 days'
    )
ORDER BY to.created_at DESC
LIMIT 20;

-- 6. VERIFICAR SE HÁ VENDAS RECÉM-CRIADAS APÓS O PROCESSAMENTO MANUAL
-- ============================================================================
SELECT 
    s.id,
    s.valor,
    s.data_venda,
    s.created_at,
    s.tiny_order_id,
    to.numero_pedido,
    c.name as colaboradora_nome
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.tiny_orders to ON to.id = s.tiny_order_id
LEFT JOIN sistemaretiradas.profiles c ON c.id = s.colaboradora_id
WHERE s.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b' -- Loungerie
    AND s.created_at >= NOW() - INTERVAL '1 hour' -- Última hora
ORDER BY s.created_at DESC;

-- 7. VERIFICAR A FUNÇÃO processar_tiny_order_para_venda (SE ESTÁ FUNCIONANDO)
-- ============================================================================
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'sistemaretiradas'
    AND p.proname = 'processar_tiny_order_para_venda';

-- 8. TESTAR A FUNÇÃO COM UM PEDIDO ESPECÍFICO (SE HOUVER)
-- ============================================================================
-- Descomente e substitua o UUID pelo ID de um pedido específico para testar
/*
SELECT sistemaretiradas.processar_tiny_order_para_venda('UUID-DO-PEDIDO-AQUI');
*/

