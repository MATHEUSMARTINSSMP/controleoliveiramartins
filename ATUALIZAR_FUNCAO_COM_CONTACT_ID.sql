-- ============================================================================
-- ATUALIZAR FUNÇÃO criar_vendas_de_tiny_orders PARA INCLUIR tiny_contact_id
-- Execute este script no Supabase SQL Editor APÓS executar ADICIONAR_TINY_CONTACT_ID.sql
-- ============================================================================

-- Função RPC para criar vendas a partir de pedidos do Tiny (com tiny_contact_id)
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
  FOR v_pedido IN
    SELECT 
      o.id as tiny_order_id,
      o.store_id,
      o.colaboradora_id,
      o.cliente_id as tiny_contact_id,
      o.data_pedido,
      o.valor_total,
      o.itens,
      o.qtd_itens,
      o.observacoes,
      o.numero_pedido,
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
      )
    ORDER BY o.data_pedido ASC, o.created_at ASC
  LOOP
    BEGIN
      IF v_pedido.colaboradora_id IS NULL THEN
        v_erros := v_erros + 1;
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'erro',
          'tiny_order_id', v_pedido.tiny_order_id,
          'numero_pedido', v_pedido.numero_pedido,
          'erro', 'colaboradora_id e NULL'
        );
        CONTINUE;
      END IF;
      
      IF v_pedido.store_id IS NULL THEN
        v_erros := v_erros + 1;
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'erro',
          'tiny_order_id', v_pedido.tiny_order_id,
          'numero_pedido', v_pedido.numero_pedido,
          'erro', 'store_id e NULL'
        );
        CONTINUE;
      END IF;
      
      IF v_pedido.valor_total IS NULL OR v_pedido.valor_total <= 0 THEN
        v_erros := v_erros + 1;
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'erro',
          'tiny_order_id', v_pedido.tiny_order_id,
          'numero_pedido', v_pedido.numero_pedido,
          'erro', 'valor_total e NULL ou <= 0'
        );
        CONTINUE;
      END IF;
      
      -- USAR qtd_itens DA TABELA OU CALCULAR DO JSON
      v_qtd_pecas := COALESCE(v_pedido.qtd_itens, 0);
      
      IF v_qtd_pecas = 0 AND v_pedido.itens IS NOT NULL AND jsonb_typeof(v_pedido.itens) = 'array' THEN
        SELECT COALESCE(SUM((item->>'quantidade')::INTEGER), 0)
        INTO v_qtd_pecas
        FROM jsonb_array_elements(v_pedido.itens) AS item
        WHERE (item->>'quantidade') IS NOT NULL;
      END IF;
      
      -- Fallback: usar 1 como padrao
      IF v_qtd_pecas = 0 OR v_qtd_pecas IS NULL THEN
        v_qtd_pecas := 1;
      END IF;
      
      v_observacoes := COALESCE(v_pedido.observacoes, '');
      
      IF v_pedido.numero_pedido IS NOT NULL THEN
        IF v_observacoes != '' THEN
          v_observacoes := v_observacoes || ' | ';
        END IF;
        v_observacoes := v_observacoes || 'Pedido Tiny: #' || v_pedido.numero_pedido;
      END IF;
      
      -- Se ja existe venda, atualizar
      IF v_pedido.sale_id IS NOT NULL THEN
        UPDATE sistemaretiradas.sales
        SET
          colaboradora_id = v_pedido.colaboradora_id,
          store_id = v_pedido.store_id,
          tiny_contact_id = v_pedido.tiny_contact_id,
          valor = v_pedido.valor_total,
          qtd_pecas = v_qtd_pecas,
          data_venda = v_pedido.data_pedido,
          observacoes = v_observacoes,
          updated_at = NOW()
        WHERE id = v_pedido.sale_id;
        
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
        -- CRIAR NOVA VENDA
        BEGIN
          INSERT INTO sistemaretiradas.sales (
            tiny_order_id,
            tiny_contact_id,
            colaboradora_id,
            store_id,
            valor,
            qtd_pecas,
            data_venda,
            observacoes,
            lancado_por_id
          ) VALUES (
            v_pedido.tiny_order_id,
            v_pedido.tiny_contact_id,
            v_pedido.colaboradora_id,
            v_pedido.store_id,
            v_pedido.valor_total,
            v_qtd_pecas,
            v_pedido.data_pedido,
            v_observacoes,
            NULL
          )
          RETURNING id INTO v_sale_id;
          
          v_vendas_criadas := v_vendas_criadas + 1;
          
          v_detalhes := v_detalhes || jsonb_build_object(
            'tipo', 'criada',
            'tiny_order_id', v_pedido.tiny_order_id,
            'tiny_contact_id', v_pedido.tiny_contact_id,
            'sale_id', v_sale_id,
            'numero_pedido', v_pedido.numero_pedido,
            'valor', v_pedido.valor_total,
            'qtd_pecas', v_qtd_pecas
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
                tiny_contact_id = v_pedido.tiny_contact_id,
                valor = v_pedido.valor_total,
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
      
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      
      v_erro_detalhes := jsonb_build_object(
        'tipo', 'erro',
        'tiny_order_id', v_pedido.tiny_order_id,
        'numero_pedido', v_pedido.numero_pedido,
        'store_id', v_pedido.store_id,
        'colaboradora_id', v_pedido.colaboradora_id,
        'valor_total', v_pedido.valor_total,
        'qtd_pecas_calculado', v_qtd_pecas,
        'erro', SQLERRM,
        'erro_detalhado', SQLSTATE
      );
      
      v_detalhes := v_detalhes || v_erro_detalhes;
      
      RAISE WARNING 'Erro ao processar pedido % (numero: %): %', 
        v_pedido.tiny_order_id, 
        v_pedido.numero_pedido,
        SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT 
    v_vendas_criadas,
    v_vendas_atualizadas,
    v_erros,
    v_detalhes;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.criar_vendas_de_tiny_orders IS 
'Cria vendas (sales) automaticamente a partir de pedidos do Tiny ERP.
ATUALIZADO: Agora inclui tiny_contact_id e usa qtd_itens da tabela tiny_orders.';
