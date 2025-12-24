-- ============================================================================
-- APLICAR FUNÇÃO SIMPLIFICADA DE processar_tiny_order_para_venda
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Aplica versão simplificada que não usa colunas que podem causar
--            problemas nos triggers
-- ============================================================================

-- VERSÃO SIMPLIFICADA (SEM forma_pagamento E formas_pagamento_json)
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.processar_tiny_order_para_venda(
  p_tiny_order_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id UUID;
  v_pedido RECORD;
  v_qtd_pecas INTEGER;
  v_observacoes TEXT;
BEGIN
  -- Buscar dados do pedido (apenas campos essenciais)
  SELECT 
    id,
    store_id,
    colaboradora_id,
    data_pedido,
    valor_total,
    itens,
    observacoes,
    numero_pedido
  INTO v_pedido
  FROM sistemaretiradas.tiny_orders
  WHERE id = p_tiny_order_id;
  
  -- Verificar se pedido existe e tem dados válidos
  IF NOT FOUND THEN
    RAISE WARNING '[processar_tiny_order_para_venda] Pedido % não encontrado', p_tiny_order_id;
    RETURN NULL;
  END IF;
  
  -- Validações
  IF v_pedido.colaboradora_id IS NULL OR v_pedido.store_id IS NULL OR v_pedido.valor_total <= 0 THEN
    RAISE WARNING '[processar_tiny_order_para_venda] Pedido % não tem dados válidos (colaboradora: %, store: %, valor: %)', 
      p_tiny_order_id, v_pedido.colaboradora_id, v_pedido.store_id, v_pedido.valor_total;
    RETURN NULL;
  END IF;
  
  -- Verificar se já existe venda (por tiny_order_id primeiro, mais confiável)
  SELECT id INTO v_sale_id
  FROM sistemaretiradas.sales
  WHERE tiny_order_id = p_tiny_order_id
  LIMIT 1;
  
  -- Se não encontrou, verificar por external_order_id + order_source
  IF v_sale_id IS NULL THEN
    SELECT id INTO v_sale_id
    FROM sistemaretiradas.sales
    WHERE external_order_id = p_tiny_order_id::TEXT
      AND order_source = 'TINY'
    LIMIT 1;
  END IF;
  
  -- Calcular quantidade de peças
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
  
  -- Preparar observações
  v_observacoes := COALESCE(v_pedido.observacoes, '');
  IF v_pedido.numero_pedido IS NOT NULL THEN
    IF v_observacoes != '' THEN
      v_observacoes := v_observacoes || ' | ';
    END IF;
    v_observacoes := v_observacoes || 'Pedido Tiny: #' || v_pedido.numero_pedido;
  END IF;
  
  -- Criar ou atualizar venda
  IF v_sale_id IS NOT NULL THEN
    -- Atualizar venda existente (apenas campos essenciais)
    UPDATE sistemaretiradas.sales
    SET
      tiny_order_id = v_pedido.id,
      external_order_id = COALESCE(external_order_id, v_pedido.id::TEXT),
      order_source = COALESCE(order_source, 'TINY'),
      colaboradora_id = v_pedido.colaboradora_id,
      store_id = v_pedido.store_id,
      valor = v_pedido.valor_total,
      qtd_pecas = v_qtd_pecas,
      data_venda = v_pedido.data_pedido,
      observacoes = v_observacoes,
      updated_at = NOW()
    WHERE id = v_sale_id;
    
    RETURN v_sale_id;
  ELSE
    -- Criar nova venda (apenas campos essenciais, SEM forma_pagamento)
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
        NULL
      )
      RETURNING id INTO v_sale_id;
      
      RETURN v_sale_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[processar_tiny_order_para_venda] ❌ Erro ao criar venda: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
      RETURN NULL;
    END;
  END IF;
  
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.processar_tiny_order_para_venda IS 
'Processa um único pedido do Tiny ERP e cria/atualiza a venda correspondente.
VERSÃO SIMPLIFICADA: Usa apenas colunas essenciais, sem forma_pagamento para evitar problemas nos triggers.
Usado pelo trigger automático para processar pedidos em tempo real.';

-- TESTAR A FUNÇÃO
SELECT sistemaretiradas.processar_tiny_order_para_venda('0c31a164-5532-4a9e-8e15-5d521a357342'::UUID) as sale_id_criado;

-- VERIFICAR SE VENDA FOI CRIADA
SELECT 
    s.id as sale_id,
    s.tiny_order_id,
    s.external_order_id,
    s.valor,
    s.created_at
FROM sistemaretiradas.sales s
WHERE s.tiny_order_id = '0c31a164-5532-4a9e-8e15-5d521a357342'::UUID
   OR (s.external_order_id = '0c31a164-5532-4a9e-8e15-5d521a357342'::TEXT 
       AND s.order_source = 'TINY');

-- ============================================================================
-- ✅ FUNÇÃO SIMPLIFICADA APLICADA
-- ============================================================================

