-- ============================================================================
-- Migration: Função para criar vendas automaticamente a partir de pedidos do Tiny
-- Data: 2025-02-01
-- Descrição: Converte pedidos do Tiny ERP em vendas (sales) automaticamente
-- ============================================================================

-- Função RPC para criar vendas a partir de pedidos do Tiny
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
      -- ✅ VALIDAÇÕES EXPLÍCITAS: Verificar se todos os dados necessários estão presentes
      IF v_pedido.colaboradora_id IS NULL THEN
        RAISE WARNING 'Pedido % (número: %) não tem colaboradora_id. Pulando criação de venda.', 
          v_pedido.tiny_order_id, v_pedido.numero_pedido;
        v_erros := v_erros + 1;
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'erro',
          'tiny_order_id', v_pedido.tiny_order_id,
          'numero_pedido', v_pedido.numero_pedido,
          'erro', 'colaboradora_id é NULL'
        );
        CONTINUE; -- Pular para próximo pedido
      END IF;
      
      IF v_pedido.store_id IS NULL THEN
        RAISE WARNING 'Pedido % (número: %) não tem store_id. Pulando criação de venda.', 
          v_pedido.tiny_order_id, v_pedido.numero_pedido;
        v_erros := v_erros + 1;
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'erro',
          'tiny_order_id', v_pedido.tiny_order_id,
          'numero_pedido', v_pedido.numero_pedido,
          'erro', 'store_id é NULL'
        );
        CONTINUE; -- Pular para próximo pedido
      END IF;
      
      IF v_pedido.valor_total IS NULL OR v_pedido.valor_total <= 0 THEN
        RAISE WARNING 'Pedido % (número: %) tem valor_total inválido (%). Pulando criação de venda.', 
          v_pedido.tiny_order_id, v_pedido.numero_pedido, v_pedido.valor_total;
        v_erros := v_erros + 1;
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'erro',
          'tiny_order_id', v_pedido.tiny_order_id,
          'numero_pedido', v_pedido.numero_pedido,
          'erro', 'valor_total é NULL ou <= 0'
        );
        CONTINUE; -- Pular para próximo pedido
      END IF;
      
      -- Calcular quantidade de peças a partir dos itens
      v_qtd_pecas := 0;
      
      IF v_pedido.itens IS NOT NULL AND jsonb_typeof(v_pedido.itens) = 'array' THEN
        -- Somar quantidades de todos os itens
        SELECT COALESCE(SUM((item->>'quantidade')::INTEGER), 0)
        INTO v_qtd_pecas
        FROM jsonb_array_elements(v_pedido.itens) AS item
        WHERE (item->>'quantidade') IS NOT NULL;
      END IF;
      
      -- Se não conseguiu calcular, usar 1 como padrão
      IF v_qtd_pecas = 0 THEN
        v_qtd_pecas := 1;
      END IF;
      
      -- ✅ IMPORTANTE: O valor_total do tiny_orders JÁ está com o vale troca descontado
      -- Não precisamos descontar novamente aqui, apenas usar o valor que já está correto
      
      -- Preparar observações (incluir número do pedido se disponível)
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
          valor = v_pedido.valor_total, -- ✅ O valor_total já está correto (vale troca descontado no tiny_orders)
          qtd_pecas = v_qtd_pecas,
          data_venda = v_pedido.data_pedido,
          observacoes = v_observacoes,
          updated_at = NOW()
        WHERE id = v_pedido.sale_id;
        
        v_vendas_atualizadas := v_vendas_atualizadas + 1;
        
        -- Adicionar ao detalhes
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'atualizada',
          'tiny_order_id', v_pedido.tiny_order_id,
          'sale_id', v_pedido.sale_id,
          'numero_pedido', v_pedido.numero_pedido,
          'valor', v_pedido.valor_total, -- ✅ O valor_total já está correto (vale troca descontado no tiny_orders)
          'qtd_pecas', v_qtd_pecas
        );
      ELSE
        -- ✅ CRIAR NOVA VENDA COM PROTEÇÃO CONTRA DUPLICATAS
        -- Usar INSERT ... ON CONFLICT para garantir que não haverá duplicatas mesmo em execuções simultâneas
        -- O índice único idx_sales_tiny_order_id_unique garante que cada pedido gere apenas uma venda
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
          v_pedido.valor_total, -- ✅ O valor_total já está correto (vale troca descontado no tiny_orders)
          v_qtd_pecas,
          v_pedido.data_pedido,
          v_observacoes,
          NULL -- Vendas do ERP não têm lancado_por_id
        )
        ON CONFLICT (tiny_order_id)
        DO UPDATE SET
          colaboradora_id = EXCLUDED.colaboradora_id,
          store_id = EXCLUDED.store_id,
          valor = EXCLUDED.valor,
          qtd_pecas = EXCLUDED.qtd_pecas,
          data_venda = EXCLUDED.data_venda,
          observacoes = EXCLUDED.observacoes,
          updated_at = NOW()
        RETURNING id INTO v_sale_id;
        
        -- ✅ ON CONFLICT garante que não haverá duplicatas
        -- Se chegou aqui, a venda foi criada (ou atualizada pelo ON CONFLICT)
        -- Como o LEFT JOIN já filtra vendas existentes, contamos como criada
        -- O ON CONFLICT é apenas uma proteção adicional contra race conditions
        v_vendas_criadas := v_vendas_criadas + 1;
        
        v_detalhes := v_detalhes || jsonb_build_object(
          'tipo', 'criada',
          'tiny_order_id', v_pedido.tiny_order_id,
          'sale_id', v_sale_id,
          'numero_pedido', v_pedido.numero_pedido,
          'valor', v_pedido.valor_total,
          'qtd_pecas', v_qtd_pecas
        );
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      
      -- Adicionar erro ao detalhes com informações completas para debug
      v_erro_detalhes := jsonb_build_object(
        'tipo', 'erro',
        'tiny_order_id', v_pedido.tiny_order_id,
        'numero_pedido', v_pedido.numero_pedido,
        'store_id', v_pedido.store_id,
        'colaboradora_id', v_pedido.colaboradora_id,
        'valor_total', v_pedido.valor_total,
        'erro', SQLERRM,
        'erro_detalhado', SQLSTATE || ': ' || SQLERRM
      );
      
      v_detalhes := v_detalhes || v_erro_detalhes;
      
      -- Log do erro (não interrompe o processamento)
      RAISE WARNING 'Erro ao processar pedido % (número: %, store: %, colaboradora: %, valor: %): %', 
        v_pedido.tiny_order_id, 
        v_pedido.numero_pedido,
        v_pedido.store_id,
        v_pedido.colaboradora_id,
        v_pedido.valor_total,
        SQLERRM;
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

-- Comentários
COMMENT ON FUNCTION sistemaretiradas.criar_vendas_de_tiny_orders IS 
'Cria vendas (sales) automaticamente a partir de pedidos do Tiny ERP que ainda não têm venda correspondente.
Parâmetros:
- p_store_id: ID da loja (NULL para processar todas as lojas)
- p_data_inicio: Data mínima dos pedidos (NULL para processar todos)

Retorna:
- vendas_criadas: Quantidade de vendas criadas
- vendas_atualizadas: Quantidade de vendas atualizadas
- erros: Quantidade de erros
- detalhes: JSONB com detalhes de cada operação';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

