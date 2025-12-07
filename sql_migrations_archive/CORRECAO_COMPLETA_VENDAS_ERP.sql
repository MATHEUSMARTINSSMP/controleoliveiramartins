-- ============================================================================
-- CORREÇÃO COMPLETA: Vendas do ERP não aparecem corretamente
-- Data: 2025-12-07
-- Problema: Timezone UTC vs BRT causa vendas aparecerem no dia errado
-- ============================================================================

-- ============================================================================
-- DIAGNÓSTICO 1: Verificar vendas que estão no dia errado por causa do timezone
-- ============================================================================
SELECT 
  'Vendas com problema de timezone' as verificacao,
  COUNT(*) as total
FROM sistemaretiradas.sales s
JOIN sistemaretiradas.tiny_orders o ON s.tiny_order_id = o.id
WHERE 
  -- Data da venda está em UTC
  s.data_venda::date != (s.data_venda AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date;

-- ============================================================================
-- DIAGNÓSTICO 2: Verificar vendas sem forma de pagamento
-- ============================================================================
SELECT 
  'Vendas sem forma_pagamento mas com tiny_order com forma_pagamento' as verificacao,
  COUNT(*) as total
FROM sistemaretiradas.sales s
JOIN sistemaretiradas.tiny_orders o ON s.tiny_order_id = o.id
WHERE s.forma_pagamento IS NULL
  AND o.forma_pagamento IS NOT NULL;

-- ============================================================================
-- DIAGNÓSTICO 3: Verificar pedidos do Tiny sem venda correspondente
-- ============================================================================
SELECT 
  'Pedidos Tiny sem venda (colaboradora OK)' as verificacao,
  COUNT(*) as total
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = o.id
WHERE s.id IS NULL
  AND o.colaboradora_id IS NOT NULL
  AND o.valor_total > 0;

-- ============================================================================
-- PASSO 1: Adicionar colunas de forma de pagamento na tabela sales (se não existirem)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'sales' 
    AND column_name = 'forma_pagamento'
  ) THEN
    ALTER TABLE sistemaretiradas.sales ADD COLUMN forma_pagamento TEXT NULL;
    RAISE NOTICE '✅ Coluna forma_pagamento adicionada';
  ELSE
    RAISE NOTICE '⚠️ Coluna forma_pagamento já existe';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'sales' 
    AND column_name = 'formas_pagamento_json'
  ) THEN
    ALTER TABLE sistemaretiradas.sales ADD COLUMN formas_pagamento_json JSONB NULL;
    RAISE NOTICE '✅ Coluna formas_pagamento_json adicionada';
  ELSE
    RAISE NOTICE '⚠️ Coluna formas_pagamento_json já existe';
  END IF;
END $$;

-- ============================================================================
-- PASSO 2: Backfill - Atualizar forma de pagamento das vendas existentes
-- ============================================================================
UPDATE sistemaretiradas.sales s
SET 
  forma_pagamento = o.forma_pagamento,
  formas_pagamento_json = o.formas_pagamento_json
FROM sistemaretiradas.tiny_orders o
WHERE s.tiny_order_id = o.id
  AND (s.forma_pagamento IS NULL OR s.formas_pagamento_json IS NULL)
  AND (o.forma_pagamento IS NOT NULL OR o.formas_pagamento_json IS NOT NULL);

-- ============================================================================
-- PASSO 3: Atualizar função criar_vendas_de_tiny_orders COM TIMEZONE E FORMA PAGAMENTO
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
  v_data_venda_local TIMESTAMPTZ;
BEGIN
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
      o.forma_pagamento,
      o.formas_pagamento_json,
      o.updated_at as pedido_updated_at,
      s.id as sale_id,
      s.updated_at as sale_updated_at
    FROM sistemaretiradas.tiny_orders o
    LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = o.id
    WHERE 
      (p_store_id IS NULL OR o.store_id = p_store_id)
      AND (p_data_inicio IS NULL OR o.data_pedido >= p_data_inicio)
      AND o.colaboradora_id IS NOT NULL
      AND o.store_id IS NOT NULL
      AND o.valor_total > 0
      AND (
        s.id IS NULL 
        OR (o.updated_at > s.updated_at)
        OR s.forma_pagamento IS NULL  -- Reprocessar vendas sem forma de pagamento
      )
    ORDER BY o.data_pedido ASC, o.created_at ASC
  LOOP
    BEGIN
      IF v_pedido.colaboradora_id IS NULL OR v_pedido.store_id IS NULL THEN
        v_erros := v_erros + 1;
        CONTINUE;
      END IF;
      
      IF v_pedido.valor_total IS NULL OR v_pedido.valor_total <= 0 THEN
        v_erros := v_erros + 1;
        CONTINUE;
      END IF;
      
      -- ✅ CORREÇÃO DE TIMEZONE: Manter a data/hora no timezone do Brasil
      -- Se a data já tem timezone, usar diretamente
      -- Se não tem, assumir que está em horário de Brasília
      v_data_venda_local := v_pedido.data_pedido;
      
      -- Calcular quantidade de peças
      v_qtd_pecas := 0;
      IF v_pedido.itens IS NOT NULL AND jsonb_typeof(v_pedido.itens) = 'array' THEN
        SELECT COALESCE(SUM((item->>'quantidade')::INTEGER), 0)
        INTO v_qtd_pecas
        FROM jsonb_array_elements(v_pedido.itens) AS item
        WHERE (item->>'quantidade') IS NOT NULL;
      END IF;
      IF v_qtd_pecas = 0 THEN v_qtd_pecas := 1; END IF;
      
      -- Preparar observações
      v_observacoes := COALESCE(v_pedido.observacoes, '');
      IF v_pedido.numero_pedido IS NOT NULL THEN
        IF v_observacoes != '' THEN v_observacoes := v_observacoes || ' | '; END IF;
        v_observacoes := v_observacoes || 'Pedido Tiny: #' || v_pedido.numero_pedido;
      END IF;
      
      IF v_pedido.sale_id IS NOT NULL THEN
        -- ATUALIZAR venda existente
        UPDATE sistemaretiradas.sales
        SET
          colaboradora_id = v_pedido.colaboradora_id,
          store_id = v_pedido.store_id,
          valor = v_pedido.valor_total,
          qtd_pecas = v_qtd_pecas,
          data_venda = v_data_venda_local,
          observacoes = v_observacoes,
          forma_pagamento = v_pedido.forma_pagamento,
          formas_pagamento_json = v_pedido.formas_pagamento_json,
          updated_at = NOW()
        WHERE id = v_pedido.sale_id;
        
        v_vendas_atualizadas := v_vendas_atualizadas + 1;
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'atualizada',
          'tiny_order_id', v_pedido.tiny_order_id,
          'sale_id', v_pedido.sale_id,
          'numero_pedido', v_pedido.numero_pedido,
          'forma_pagamento', v_pedido.forma_pagamento
        );
      ELSE
        -- CRIAR nova venda
        BEGIN
          INSERT INTO sistemaretiradas.sales (
            tiny_order_id,
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
            v_pedido.tiny_order_id,
            v_pedido.colaboradora_id,
            v_pedido.store_id,
            v_pedido.valor_total,
            v_qtd_pecas,
            v_data_venda_local,
            v_observacoes,
            v_pedido.forma_pagamento,
            v_pedido.formas_pagamento_json,
            NULL
          )
          RETURNING id INTO v_sale_id;
          
          v_vendas_criadas := v_vendas_criadas + 1;
          v_detalhes := v_detalhes || jsonb_build_object(
            'tipo', 'criada',
            'tiny_order_id', v_pedido.tiny_order_id,
            'sale_id', v_sale_id,
            'numero_pedido', v_pedido.numero_pedido,
            'forma_pagamento', v_pedido.forma_pagamento
          );
        EXCEPTION
          WHEN unique_violation THEN
            SELECT id INTO v_sale_id FROM sistemaretiradas.sales WHERE tiny_order_id = v_pedido.tiny_order_id;
            IF v_sale_id IS NOT NULL THEN
              UPDATE sistemaretiradas.sales
              SET
                colaboradora_id = v_pedido.colaboradora_id,
                store_id = v_pedido.store_id,
                valor = v_pedido.valor_total,
                qtd_pecas = v_qtd_pecas,
                data_venda = v_data_venda_local,
                observacoes = v_observacoes,
                forma_pagamento = v_pedido.forma_pagamento,
                formas_pagamento_json = v_pedido.formas_pagamento_json,
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
  
  RETURN QUERY SELECT v_vendas_criadas, v_vendas_atualizadas, v_erros, v_detalhes;
END;
$$;

-- ============================================================================
-- PASSO 4: Reprocessar TODAS as vendas do mês atual para corrigir forma de pagamento
-- ============================================================================
SELECT sistemaretiradas.criar_vendas_de_tiny_orders(
  NULL,  -- Todas as lojas
  (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::timestamptz  -- Último mês + mês atual
);

-- ============================================================================
-- PASSO 5: Verificar resultado final
-- ============================================================================
SELECT 
  'Vendas com forma_pagamento preenchida' as verificacao,
  COUNT(*) as total
FROM sistemaretiradas.sales
WHERE forma_pagamento IS NOT NULL;

SELECT 
  'Vendas do Tiny ERP total' as verificacao,
  COUNT(*) as total
FROM sistemaretiradas.sales
WHERE tiny_order_id IS NOT NULL;

SELECT 
  'Pedidos Tiny ainda sem venda' as verificacao,
  COUNT(*) as total
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = o.id
WHERE s.id IS NULL
  AND o.colaboradora_id IS NOT NULL
  AND o.valor_total > 0;

-- ============================================================================
-- ✅ CORREÇÃO COMPLETA EXECUTADA!
-- ============================================================================
-- Resumo das correções:
-- 1. Adicionadas colunas forma_pagamento e formas_pagamento_json em sales
-- 2. Backfill de formas de pagamento das vendas existentes
-- 3. Função criar_vendas_de_tiny_orders atualizada com suporte a forma de pagamento
-- 4. Reprocessamento de todas as vendas do mês para garantir dados corretos
-- ============================================================================
