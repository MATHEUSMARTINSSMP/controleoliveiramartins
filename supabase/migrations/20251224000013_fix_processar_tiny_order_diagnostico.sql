-- ============================================================================
-- DIAGNÓSTICO E CORREÇÃO: FUNÇÃO processar_tiny_order_para_venda RETORNANDO NULL
-- ============================================================================
-- Data: 2025-12-24
-- Problema: Função está retornando NULL para todos os pedidos válidos
-- Solução: Criar versão com logs detalhados e corrigir problemas
-- ============================================================================

-- 1. VERIFICAR SE EXISTEM VENDAS JÁ CRIADAS COM EXTERNAL_ORDER_ID
-- ============================================================================
SELECT 
    COUNT(*) as total_vendas_com_external_order_id,
    COUNT(DISTINCT external_order_id) as external_order_ids_unicos
FROM sistemaretiradas.sales
WHERE external_order_id IS NOT NULL
    AND order_source = 'TINY';

-- 2. VERIFICAR ESTRUTURA DA TABELA SALES (COLUNAS DISPONÍVEIS)
-- ============================================================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
    AND table_name = 'sales'
    AND column_name IN ('tiny_order_id', 'external_order_id', 'order_source', 'forma_pagamento', 'formas_pagamento_json')
ORDER BY column_name;

-- 3. TESTAR PROCESSAMENTO DE UM PEDIDO ESPECÍFICO COM LOGS DETALHADOS
-- ============================================================================
-- Versão temporária da função com logs para diagnóstico
CREATE OR REPLACE FUNCTION sistemaretiradas.processar_tiny_order_para_venda_debug(
  p_tiny_order_id UUID
)
RETURNS TABLE(
    step TEXT,
    message TEXT,
    result UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id UUID;
  v_pedido RECORD;
  v_qtd_pecas INTEGER;
  v_observacoes TEXT;
  v_result UUID;
BEGIN
  -- Step 1: Buscar pedido
  SELECT 
    id,
    store_id,
    colaboradora_id,
    data_pedido,
    valor_total,
    itens,
    observacoes,
    numero_pedido,
    forma_pagamento,
    formas_pagamento_json
  INTO v_pedido
  FROM sistemaretiradas.tiny_orders
  WHERE id = p_tiny_order_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ERRO'::TEXT, 'Pedido não encontrado'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 'STEP1'::TEXT, 'Pedido encontrado: ' || v_pedido.numero_pedido, NULL::UUID;
  
  -- Step 2: Validações
  IF v_pedido.colaboradora_id IS NULL OR v_pedido.store_id IS NULL OR v_pedido.valor_total <= 0 THEN
    RETURN QUERY SELECT 'ERRO'::TEXT, 
      'Dados inválidos - colaboradora: ' || COALESCE(v_pedido.colaboradora_id::TEXT, 'NULL') || 
      ', store: ' || COALESCE(v_pedido.store_id::TEXT, 'NULL') || 
      ', valor: ' || COALESCE(v_pedido.valor_total::TEXT, 'NULL'),
      NULL::UUID;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 'STEP2'::TEXT, 'Validações OK', NULL::UUID;
  
  -- Step 3: Verificar se já existe venda
  SELECT id INTO v_sale_id
  FROM sistemaretiradas.sales
  WHERE tiny_order_id = p_tiny_order_id
  LIMIT 1;
  
  IF v_sale_id IS NOT NULL THEN
    RETURN QUERY SELECT 'STEP3'::TEXT, 'Venda já existe: ' || v_sale_id::TEXT, v_sale_id;
    RETURN;
  END IF;
  
  -- Verificar por external_order_id também
  SELECT id INTO v_sale_id
  FROM sistemaretiradas.sales
  WHERE external_order_id = p_tiny_order_id::TEXT
    AND order_source = 'TINY'
  LIMIT 1;
  
  IF v_sale_id IS NOT NULL THEN
    RETURN QUERY SELECT 'STEP3B'::TEXT, 'Venda já existe (external): ' || v_sale_id::TEXT, v_sale_id;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 'STEP3'::TEXT, 'Nenhuma venda existente encontrada', NULL::UUID;
  
  -- Step 4: Calcular quantidade de peças
  v_qtd_pecas := 0;
  IF v_pedido.itens IS NOT NULL AND jsonb_typeof(v_pedido.itens) = 'array' THEN
    SELECT COALESCE(SUM((item->>'quantidade')::INTEGER), 0)
    INTO v_qtd_pecas
    FROM jsonb_array_elements(v_pedido.itens) AS item
    WHERE (item->>'quantidade') IS NOT NULL;
  END IF;
  IF v_qtd_pecas = 0 THEN
    v_qtd_pecas := 1;
  END IF;
  
  RETURN QUERY SELECT 'STEP4'::TEXT, 'Qtd peças: ' || v_qtd_pecas::TEXT, NULL::UUID;
  
  -- Step 5: Preparar observações
  v_observacoes := COALESCE(v_pedido.observacoes, '');
  IF v_pedido.numero_pedido IS NOT NULL THEN
    IF v_observacoes != '' THEN
      v_observacoes := v_observacoes || ' | ';
    END IF;
    v_observacoes := v_observacoes || 'Pedido Tiny: #' || v_pedido.numero_pedido;
  END IF;
  
  RETURN QUERY SELECT 'STEP5'::TEXT, 'Observações preparadas', NULL::UUID;
  
  -- Step 6: Criar venda (tentar INSERT direto primeiro)
  BEGIN
    INSERT INTO sistemaretiradas.sales (
      tiny_order_id,
      external_order_id,
      order_source,
      colaboradora_id,
      store_id,
      valor,
      qtd_pecas,
      data_venda,
      observacoes,
      forma_pagamento,
      formas_pagamento_json,
      lancado_por_id
    ) VALUES (
      v_pedido.id,
      v_pedido.id::TEXT,
      'TINY',
      v_pedido.colaboradora_id,
      v_pedido.store_id,
      v_pedido.valor_total,
      v_qtd_pecas,
      v_pedido.data_pedido,
      v_observacoes,
      v_pedido.forma_pagamento,
      v_pedido.formas_pagamento_json,
      NULL
    )
    RETURNING id INTO v_result;
    
    RETURN QUERY SELECT 'SUCCESS'::TEXT, 'Venda criada: ' || v_result::TEXT, v_result;
    
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'ERRO'::TEXT, 'Erro ao criar venda: ' || SQLERRM, NULL::UUID;
    RETURN;
  END;
  
END;
$$;

-- 4. TESTAR UM PEDIDO ESPECÍFICO
-- ============================================================================
SELECT * FROM sistemaretiradas.processar_tiny_order_para_venda_debug('0c31a164-5532-4a9e-8e15-5d521a357342'::UUID);

