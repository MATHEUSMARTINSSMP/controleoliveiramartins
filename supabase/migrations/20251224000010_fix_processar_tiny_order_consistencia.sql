-- ============================================================================
-- CORREÇÃO CRÍTICA: GARANTIR CONSISTÊNCIA NA FUNÇÃO processar_tiny_order_para_venda
-- ============================================================================
-- Data: 2025-12-24
-- Problema: A função pode estar verificando vendas existentes de forma inconsistente
-- Solução: Garantir que a função verifica E cria vendas usando a mesma lógica
-- ============================================================================

-- ATUALIZAR FUNÇÃO processar_tiny_order_para_venda PARA GARANTIR CONSISTÊNCIA
-- ============================================================================
-- A função deve verificar se já existe venda usando tiny_order_id (compatibilidade)
-- E também deve criar com tiny_order_id (como está fazendo atualmente)
-- Mas TAMBÉM deve verificar se há venda usando external_order_id + order_source
-- para garantir que não crie duplicatas

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
  -- Buscar dados do pedido (incluindo formas de pagamento)
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
  
  -- Verificar se pedido existe e tem dados válidos
  IF NOT FOUND THEN
    RAISE WARNING '[processar_tiny_order_para_venda] Pedido % não encontrado', p_tiny_order_id;
    RETURN NULL;
  END IF;
  
  -- Validações
  IF v_pedido.colaboradora_id IS NULL OR v_pedido.store_id IS NULL OR v_pedido.valor_total <= 0 THEN
    RAISE WARNING '[processar_tiny_order_para_venda] Pedido % não tem dados válidos para criar venda (colaboradora: %, store: %, valor: %)', 
      p_tiny_order_id, v_pedido.colaboradora_id, v_pedido.store_id, v_pedido.valor_total;
    RETURN NULL;
  END IF;
  
  -- ✅ VERIFICAR SE JÁ EXISTE VENDA (MÚLTIPLAS FORMAS PARA GARANTIR)
  -- Primeiro: verificar por tiny_order_id (método principal)
  SELECT id INTO v_sale_id
  FROM sistemaretiradas.sales
  WHERE tiny_order_id = p_tiny_order_id
  LIMIT 1;
  
  -- Se não encontrou, verificar por external_order_id + order_source (backup)
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
  
  -- Criar ou atualizar venda (com formas de pagamento)
  IF v_sale_id IS NOT NULL THEN
    -- ✅ ATUALIZAR VENDA EXISTENTE
    UPDATE sistemaretiradas.sales
    SET
      tiny_order_id = v_pedido.id, -- Garantir que está preenchido
      external_order_id = COALESCE(external_order_id, v_pedido.id::TEXT), -- Preencher se não tiver
      order_source = COALESCE(order_source, 'TINY'), -- Preencher se não tiver
      colaboradora_id = v_pedido.colaboradora_id,
      store_id = v_pedido.store_id,
      valor = v_pedido.valor_total,
      qtd_pecas = v_qtd_pecas,
      data_venda = v_pedido.data_pedido,
      observacoes = v_observacoes,
      forma_pagamento = v_pedido.forma_pagamento,
      formas_pagamento_json = v_pedido.formas_pagamento_json,
      updated_at = NOW()
    WHERE id = v_sale_id;
    
    RAISE NOTICE '[processar_tiny_order_para_venda] ✅ Venda atualizada: sale_id=%, tiny_order_id=%', v_sale_id, p_tiny_order_id;
  ELSE
    -- ✅ CRIAR NOVA VENDA (com todas as colunas necessárias)
    BEGIN
      INSERT INTO sistemaretiradas.sales (
        tiny_order_id, -- Coluna principal (compatibilidade)
        external_order_id, -- Nova coluna (suporte multi-ERP)
        order_source, -- Nova coluna (suporte multi-ERP)
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
        v_pedido.id, -- tiny_order_id
        v_pedido.id::TEXT, -- external_order_id (mesmo valor como texto)
        'TINY', -- order_source
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
      RETURNING id INTO v_sale_id;
      
      RAISE NOTICE '[processar_tiny_order_para_venda] ✅ Nova venda criada: sale_id=%, tiny_order_id=%', v_sale_id, p_tiny_order_id;
    EXCEPTION WHEN OTHERS THEN
      -- Se deu erro de constraint única (external_order_id + order_source), tentar encontrar venda existente
      IF SQLSTATE = '23505' THEN -- unique_violation
        RAISE WARNING '[processar_tiny_order_para_venda] ⚠️ Tentativa de criar venda duplicada para tiny_order_id=%. Buscando venda existente...', p_tiny_order_id;
        
        -- Buscar venda que já existe
        SELECT id INTO v_sale_id
        FROM sistemaretiradas.sales
        WHERE external_order_id = v_pedido.id::TEXT
          AND order_source = 'TINY'
        LIMIT 1;
        
        IF v_sale_id IS NOT NULL THEN
          -- Atualizar a venda existente
          UPDATE sistemaretiradas.sales
          SET
            tiny_order_id = v_pedido.id,
            colaboradora_id = v_pedido.colaboradora_id,
            store_id = v_pedido.store_id,
            valor = v_pedido.valor_total,
            qtd_pecas = v_qtd_pecas,
            data_venda = v_pedido.data_pedido,
            observacoes = v_observacoes,
            forma_pagamento = v_pedido.forma_pagamento,
            formas_pagamento_json = v_pedido.formas_pagamento_json,
            updated_at = NOW()
          WHERE id = v_sale_id;
          
          RAISE NOTICE '[processar_tiny_order_para_venda] ✅ Venda existente atualizada após erro de constraint: sale_id=%', v_sale_id;
        ELSE
          RAISE WARNING '[processar_tiny_order_para_venda] ❌ Erro ao criar venda e não encontrou venda existente: %', SQLERRM;
          RETURN NULL;
        END IF;
      ELSE
        RAISE WARNING '[processar_tiny_order_para_venda] ❌ Erro inesperado ao criar venda: %', SQLERRM;
        RETURN NULL;
      END IF;
    END;
  END IF;
  
  RETURN v_sale_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[processar_tiny_order_para_venda] ❌ Erro geral ao processar pedido % para venda: %', p_tiny_order_id, SQLERRM;
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.processar_tiny_order_para_venda IS 
'Processa um único pedido do Tiny ERP e cria/atualiza a venda correspondente.
Usado pelo trigger automático para processar pedidos em tempo real.
CORRIGIDO: Agora verifica vendas existentes usando tanto tiny_order_id quanto external_order_id + order_source
para garantir consistência e evitar duplicatas.';

-- ============================================================================
-- VERIFICAR SE HÁ PEDIDOS PENDENTES QUE PODEM SER PROCESSADOS
-- ============================================================================
-- Esta query ajuda a identificar quantos pedidos válidos não têm vendas
SELECT 
    COUNT(*) as pedidos_pendentes,
    COUNT(DISTINCT to.store_id) as lojas_afetadas,
    MIN(to.created_at) as pedido_mais_antigo,
    MAX(to.created_at) as pedido_mais_recente
FROM sistemaretiradas.tiny_orders to
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = to.id
WHERE s.id IS NULL
    AND to.colaboradora_id IS NOT NULL
    AND to.store_id IS NOT NULL
    AND to.valor_total > 0
    AND to.created_at >= NOW() - INTERVAL '30 days';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

