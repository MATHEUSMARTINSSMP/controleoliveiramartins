-- ============================================================================
-- CORREÇÃO: Forma de Pagamento e Vendas não aparecem corretamente
-- Data: 2025-12-07
-- ============================================================================

-- ============================================================================
-- PASSO 1: Verificar se a tabela sales tem campo forma_pagamento
-- ============================================================================
DO $$
BEGIN
  -- Adicionar coluna forma_pagamento se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'sales' 
    AND column_name = 'forma_pagamento'
  ) THEN
    ALTER TABLE sistemaretiradas.sales 
    ADD COLUMN forma_pagamento TEXT NULL;
    
    RAISE NOTICE 'Coluna forma_pagamento adicionada à tabela sales';
  ELSE
    RAISE NOTICE 'Coluna forma_pagamento já existe na tabela sales';
  END IF;
  
  -- Adicionar coluna formas_pagamento_json se não existir (para múltiplas formas)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'sales' 
    AND column_name = 'formas_pagamento_json'
  ) THEN
    ALTER TABLE sistemaretiradas.sales 
    ADD COLUMN formas_pagamento_json JSONB NULL;
    
    RAISE NOTICE 'Coluna formas_pagamento_json adicionada à tabela sales';
  ELSE
    RAISE NOTICE 'Coluna formas_pagamento_json já existe na tabela sales';
  END IF;
END $$;

-- ============================================================================
-- PASSO 2: Atualizar função criar_vendas_de_tiny_orders para copiar forma_pagamento
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.criar_vendas_de_tiny_orders(
  p_store_id UUID DEFAULT NULL,
  p_data_inicio TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  vendas_criadas INTEGER,
  vendas_atualizadas INTEGER,
  erros INTEGER,
  detalhes JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendas_criadas INTEGER := 0;
  v_vendas_atualizadas INTEGER := 0;
  v_erros INTEGER := 0;
  v_detalhes JSONB := '[]'::JSONB;
  v_pedido RECORD;
  v_qtd_pecas INTEGER;
  v_sale_id UUID;
  v_erro_detalhes JSONB;
  v_observacoes TEXT;
BEGIN
  -- Buscar pedidos do Tiny que não têm venda correspondente
  -- OU pedidos que foram atualizados após a última venda criada
  FOR v_pedido IN
    SELECT 
      o.id as tiny_order_id,
      o.store_id,
      o.colaboradora_id,
      o.data_pedido,
      o.valor_total,
      o.itens,
      o.observacoes,
      o.numero_pedido,
      o.forma_pagamento,  -- ✅ ADICIONADO: Buscar forma de pagamento
      o.formas_pagamento_json,  -- ✅ ADICIONADO: Buscar formas de pagamento JSON
      o.updated_at as pedido_updated_at,
      s.id as sale_id,
      s.updated_at as sale_updated_at
    FROM sistemaretiradas.tiny_orders o
    LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = o.id
    WHERE 
      -- Filtro por loja (se fornecido)
      (p_store_id IS NULL OR o.store_id = p_store_id)
      -- Filtro por data (se fornecido)
      AND (p_data_inicio IS NULL OR o.data_pedido >= p_data_inicio)
      -- Apenas pedidos com colaboradora mapeada (obrigatório para criar venda)
      AND o.colaboradora_id IS NOT NULL
      -- Apenas pedidos com store_id preenchido (obrigatório para criar venda)
      AND o.store_id IS NOT NULL
      -- Apenas pedidos com valor > 0
      AND o.valor_total > 0
      -- Apenas pedidos que NÃO têm venda OU que foram atualizados após a venda
      AND (
        s.id IS NULL 
        OR (o.updated_at > s.updated_at)
      )
    ORDER BY o.data_pedido ASC, o.created_at ASC
  LOOP
    BEGIN
      -- Validações
      IF v_pedido.colaboradora_id IS NULL THEN
        v_erros := v_erros + 1;
        CONTINUE;
      END IF;
      
      IF v_pedido.store_id IS NULL THEN
        v_erros := v_erros + 1;
        CONTINUE;
      END IF;
      
      IF v_pedido.valor_total IS NULL OR v_pedido.valor_total <= 0 THEN
        v_erros := v_erros + 1;
        CONTINUE;
      END IF;
      
      -- Calcular quantidade de peças a partir dos itens
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
      
      -- Se já existe venda, atualizar
      IF v_pedido.sale_id IS NOT NULL THEN
        UPDATE sistemaretiradas.sales
        SET
          colaboradora_id = v_pedido.colaboradora_id,
          store_id = v_pedido.store_id,
          valor = v_pedido.valor_total,
          qtd_pecas = v_qtd_pecas,
          data_venda = v_pedido.data_pedido,
          observacoes = v_observacoes,
          forma_pagamento = v_pedido.forma_pagamento,  -- ✅ ADICIONADO
          formas_pagamento_json = v_pedido.formas_pagamento_json,  -- ✅ ADICIONADO
          updated_at = NOW()
        WHERE id = v_pedido.sale_id;
        
        v_vendas_atualizadas := v_vendas_atualizadas + 1;
        
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'atualizada',
          'tiny_order_id', v_pedido.tiny_order_id,
          'sale_id', v_pedido.sale_id,
          'numero_pedido', v_pedido.numero_pedido,
          'valor', v_pedido.valor_total,
          'forma_pagamento', v_pedido.forma_pagamento
        );
      ELSE
        -- Criar nova venda
        BEGIN
          INSERT INTO sistemaretiradas.sales (
            tiny_order_id,
            colaboradora_id,
            store_id,
            valor,
            qtd_pecas,
            data_venda,
            observacoes,
            forma_pagamento,  -- ✅ ADICIONADO
            formas_pagamento_json,  -- ✅ ADICIONADO
            lancado_por_id
          ) VALUES (
            v_pedido.tiny_order_id,
            v_pedido.colaboradora_id,
            v_pedido.store_id,
            v_pedido.valor_total,
            v_qtd_pecas,
            v_pedido.data_pedido,
            v_observacoes,
            v_pedido.forma_pagamento,  -- ✅ ADICIONADO
            v_pedido.formas_pagamento_json,  -- ✅ ADICIONADO
            NULL
          )
          RETURNING id INTO v_sale_id;
          
          v_vendas_criadas := v_vendas_criadas + 1;
          
          v_detalhes := v_detalhes || jsonb_build_object(
            'tipo', 'criada',
            'tiny_order_id', v_pedido.tiny_order_id,
            'sale_id', v_sale_id,
            'numero_pedido', v_pedido.numero_pedido,
            'valor', v_pedido.valor_total,
            'forma_pagamento', v_pedido.forma_pagamento
          );
        EXCEPTION
          WHEN unique_violation THEN
            SELECT id INTO v_sale_id
            FROM sistemaretiradas.sales
            WHERE tiny_order_id = v_pedido.tiny_order_id;
            
            IF v_sale_id IS NOT NULL THEN
              UPDATE sistemaretiradas.sales
              SET
                colaboradora_id = v_pedido.colaboradora_id,
                store_id = v_pedido.store_id,
                valor = v_pedido.valor_total,
                qtd_pecas = v_qtd_pecas,
                data_venda = v_pedido.data_pedido,
                observacoes = v_observacoes,
                forma_pagamento = v_pedido.forma_pagamento,  -- ✅ ADICIONADO
                formas_pagamento_json = v_pedido.formas_pagamento_json,  -- ✅ ADICIONADO
                updated_at = NOW()
              WHERE id = v_sale_id;
              
              v_vendas_atualizadas := v_vendas_atualizadas + 1;
            END IF;
        END;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      RAISE WARNING 'Erro ao processar pedido %: %', v_pedido.tiny_order_id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT 
    v_vendas_criadas,
    v_vendas_atualizadas,
    v_erros,
    v_detalhes;
END;
$$;

-- ============================================================================
-- PASSO 3: Backfill - Atualizar vendas existentes com forma_pagamento do tiny_orders
-- ============================================================================
UPDATE sistemaretiradas.sales s
SET 
  forma_pagamento = o.forma_pagamento,
  formas_pagamento_json = o.formas_pagamento_json
FROM sistemaretiradas.tiny_orders o
WHERE s.tiny_order_id = o.id
  AND s.forma_pagamento IS NULL
  AND o.forma_pagamento IS NOT NULL;

-- ============================================================================
-- PASSO 4: Verificar resultado
-- ============================================================================
SELECT 
  'Vendas com forma_pagamento preenchida' as verificacao,
  COUNT(*) as total
FROM sistemaretiradas.sales
WHERE forma_pagamento IS NOT NULL;

SELECT 
  'Vendas SEM forma_pagamento mas com tiny_order_id' as verificacao,
  COUNT(*) as total
FROM sistemaretiradas.sales s
JOIN sistemaretiradas.tiny_orders o ON s.tiny_order_id = o.id
WHERE s.forma_pagamento IS NULL
  AND o.forma_pagamento IS NOT NULL;

-- ============================================================================
-- PASSO 5: Reprocessar vendas do mês atual para garantir forma_pagamento
-- ============================================================================
SELECT sistemaretiradas.criar_vendas_de_tiny_orders(
  NULL,  -- Todas as lojas
  (date_trunc('month', CURRENT_DATE))::timestamptz  -- Início do mês atual
);

RAISE NOTICE '✅ Correção de forma de pagamento concluída!';
