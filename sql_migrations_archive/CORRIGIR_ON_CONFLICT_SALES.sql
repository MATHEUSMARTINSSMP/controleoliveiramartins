-- ============================================================================
-- CORRIGIR: ON CONFLICT para criar_vendas_de_tiny_orders
-- Problema: Índice parcial não é reconhecido pelo ON CONFLICT
-- Solução: Usar EXCEPTION unique_violation ao invés de ON CONFLICT
-- ============================================================================

-- 1. Garantir que o índice único existe
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_tiny_order_id_unique 
ON sistemaretiradas.sales(tiny_order_id)
WHERE tiny_order_id IS NOT NULL;

-- 2. Atualizar a função criar_vendas_de_tiny_orders
-- Substituir ON CONFLICT por EXCEPTION unique_violation
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
  v_valor_final NUMERIC;
BEGIN
  -- Loop através de pedidos do Tiny que ainda não têm venda correspondente
  FOR v_pedido IN
    SELECT 
      o.id as tiny_order_id,
      o.numero_pedido,
      o.data_pedido,
      o.valor_total,
      o.colaboradora_id,
      o.store_id,
      o.itens,
      s.id as sale_id
    FROM sistemaretiradas.tiny_orders o
    LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = o.id
    WHERE 
      -- Filtros opcionais
      (p_store_id IS NULL OR o.store_id = p_store_id)
      AND (p_data_inicio IS NULL OR o.data_pedido >= p_data_inicio)
      -- Apenas pedidos que ainda não têm venda OU foram atualizados depois da venda
      AND (s.id IS NULL OR o.updated_at > s.updated_at)
      -- Apenas pedidos com colaboradora e loja válidos
      AND o.colaboradora_id IS NOT NULL
      AND o.store_id IS NOT NULL
      -- Apenas pedidos com valor maior que zero
      AND o.valor_total > 0
      -- Apenas pedidos com tiny_order_id (garantir que não seja NULL)
      AND o.id IS NOT NULL
    ORDER BY o.data_pedido DESC, o.created_at DESC
  LOOP
    BEGIN
      -- ✅ VALIDAÇÕES EXPLICITAS
      IF v_pedido.colaboradora_id IS NULL THEN
        RAISE WARNING 'Pedido % sem colaboradora_id, pulando...', v_pedido.numero_pedido;
        v_erros := v_erros + 1;
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'erro',
          'erro', 'colaboradora_id IS NULL',
          'numero_pedido', v_pedido.numero_pedido,
          'tiny_order_id', v_pedido.tiny_order_id
        );
        CONTINUE;
      END IF;
      
      IF v_pedido.store_id IS NULL THEN
        RAISE WARNING 'Pedido % sem store_id, pulando...', v_pedido.numero_pedido;
        v_erros := v_erros + 1;
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'erro',
          'erro', 'store_id IS NULL',
          'numero_pedido', v_pedido.numero_pedido,
          'tiny_order_id', v_pedido.tiny_order_id
        );
        CONTINUE;
      END IF;
      
      IF v_pedido.valor_total <= 0 THEN
        RAISE WARNING 'Pedido % com valor_total <= 0, pulando...', v_pedido.numero_pedido;
        v_erros := v_erros + 1;
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'erro',
          'erro', 'valor_total <= 0',
          'numero_pedido', v_pedido.numero_pedido,
          'tiny_order_id', v_pedido.tiny_order_id
        );
        CONTINUE;
      END IF;
      
      -- Calcular quantidade de peças
      v_qtd_pecas := 0;
      IF v_pedido.itens IS NOT NULL AND jsonb_typeof(v_pedido.itens) = 'array' THEN
        SELECT COALESCE(SUM((item->>'quantidade')::INTEGER), 0)
        INTO v_qtd_pecas
        FROM jsonb_array_elements(v_pedido.itens) AS item;
      END IF;
      
      -- Montar observações
      v_observacoes := 'Venda gerada automaticamente do pedido #' || v_pedido.numero_pedido || ' do Tiny ERP.';
      
      -- ✅ VALOR FINAL: Usar valor_total diretamente (já tem vale troca descontado)
      v_valor_final := v_pedido.valor_total;
      
      -- Se valor final for <= 0, pular
      IF v_valor_final <= 0 THEN
        RAISE WARNING 'Pedido % com valor final <= 0 após processamento, pulando...', v_pedido.numero_pedido;
        v_erros := v_erros + 1;
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'erro',
          'erro', 'valor_final <= 0',
          'numero_pedido', v_pedido.numero_pedido,
          'tiny_order_id', v_pedido.tiny_order_id
        );
        CONTINUE;
      END IF;
      
      -- Se já existe venda, atualizar
      IF v_pedido.sale_id IS NOT NULL THEN
        UPDATE sistemaretiradas.sales
        SET
          colaboradora_id = v_pedido.colaboradora_id,
          store_id = v_pedido.store_id,
          valor = v_valor_final,
          qtd_pecas = v_qtd_pecas,
          data_venda = v_pedido.data_pedido,
          observacoes = v_observacoes,
          updated_at = NOW()
        WHERE id = v_pedido.sale_id;
        
        v_sale_id := v_pedido.sale_id;
        v_vendas_atualizadas := v_vendas_atualizadas + 1;
        
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'atualizada',
          'tiny_order_id', v_pedido.tiny_order_id,
          'sale_id', v_pedido.sale_id,
          'numero_pedido', v_pedido.numero_pedido,
          'valor', v_pedido.valor_total,
          'qtd_pecas', v_qtd_pecas
        );
      ELSE
        -- ✅ CRIAR NOVA VENDA COM PROTEÇÃO CONTRA DUPLICATAS
        -- Usar INSERT com EXCEPTION para tratar unique_violation (race conditions)
        -- O índice único idx_sales_tiny_order_id_unique garante que cada pedido gere apenas uma venda
        BEGIN
          INSERT INTO sistemaretiradas.sales (
            tiny_order_id,
            colaboradora_id,
            store_id,
            valor,
            qtd_pecas,
            data_venda,
            observacoes,
            lancado_por_id
          ) VALUES (
            v_pedido.tiny_order_id,
            v_pedido.colaboradora_id,
            v_pedido.store_id,
            v_valor_final,
            v_qtd_pecas,
            v_pedido.data_pedido,
            v_observacoes,
            NULL
          )
          RETURNING id INTO v_sale_id;
          
          -- ✅ Inserção bem-sucedida
          v_vendas_criadas := v_vendas_criadas + 1;
          
          v_detalhes := v_detalhes || jsonb_build_object(
            'tipo', 'criada',
            'tiny_order_id', v_pedido.tiny_order_id,
            'sale_id', v_sale_id,
            'numero_pedido', v_pedido.numero_pedido,
            'valor', v_pedido.valor_total,
            'qtd_pecas', v_qtd_pecas
          );
        EXCEPTION
          WHEN unique_violation THEN
            -- Se já existe (race condition), buscar e atualizar
            SELECT id INTO v_sale_id
            FROM sistemaretiradas.sales
            WHERE tiny_order_id = v_pedido.tiny_order_id;
            
            IF v_sale_id IS NOT NULL THEN
              UPDATE sistemaretiradas.sales
              SET
                colaboradora_id = v_pedido.colaboradora_id,
                store_id = v_pedido.store_id,
                valor = v_valor_final,
                qtd_pecas = v_qtd_pecas,
                data_venda = v_pedido.data_pedido,
                observacoes = v_observacoes,
                updated_at = NOW()
              WHERE id = v_sale_id;
              
              v_vendas_atualizadas := v_vendas_atualizadas + 1;
              
              v_detalhes := v_detalhes || jsonb_build_object(
                'tipo', 'atualizada_apos_conflito',
                'tiny_order_id', v_pedido.tiny_order_id,
                'sale_id', v_sale_id,
                'numero_pedido', v_pedido.numero_pedido,
                'valor', v_pedido.valor_total,
                'qtd_pecas', v_qtd_pecas
              );
            END IF;
        END;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log do erro e continuar
        RAISE WARNING 'Erro ao processar pedido %: %', v_pedido.numero_pedido, SQLERRM;
        v_erros := v_erros + 1;
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'erro',
          'erro', SQLERRM,
          'numero_pedido', v_pedido.numero_pedido,
          'tiny_order_id', v_pedido.tiny_order_id,
          'erro_detalhado', SQLSTATE
        );
    END;
  END LOOP;
  
  -- Retornar resultados
  RETURN QUERY SELECT 
    v_vendas_criadas,
    v_vendas_atualizadas,
    v_erros,
    v_detalhes;
END;
$$;

-- Verificar se a função foi atualizada
SELECT 
  'Função atualizada com sucesso!' as status,
  proname as nome_funcao,
  pg_get_functiondef(oid) as definicao
FROM pg_proc
WHERE proname = 'criar_vendas_de_tiny_orders'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
LIMIT 1;
