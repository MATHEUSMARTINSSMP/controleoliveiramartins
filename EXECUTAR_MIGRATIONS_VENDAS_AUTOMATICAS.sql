-- ============================================================================
-- SCRIPT COMPLETO: Criar Vendas Automaticamente a partir de Pedidos do Tiny
-- Data: 2025-02-01
-- Descrição: Adiciona campo tiny_order_id em sales e cria função para conversão automática
-- ============================================================================
-- 
-- INSTRUÇÕES:
-- 1. Execute este script no Supabase SQL Editor
-- 2. Execute na ordem: primeiro a migration 1, depois a migration 2
-- 3. Após executar, as vendas serão criadas automaticamente após cada sincronização
--
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: Adicionar tiny_order_id na tabela sales
-- ============================================================================

-- 1. Adicionar coluna tiny_order_id
ALTER TABLE sistemaretiradas.sales 
ADD COLUMN IF NOT EXISTS tiny_order_id UUID REFERENCES sistemaretiradas.tiny_orders(id) ON DELETE SET NULL;

-- 2. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_sales_tiny_order_id 
ON sistemaretiradas.sales(tiny_order_id) 
WHERE tiny_order_id IS NOT NULL;

-- 3. Criar índice único para evitar duplicatas (um pedido = uma venda)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_tiny_order_id_unique 
ON sistemaretiradas.sales(tiny_order_id) 
WHERE tiny_order_id IS NOT NULL;

-- Comentários
COMMENT ON COLUMN sistemaretiradas.sales.tiny_order_id IS 
'ID do pedido do Tiny ERP que originou esta venda. NULL para vendas manuais.';

COMMENT ON INDEX sistemaretiradas.idx_sales_tiny_order_id IS 
'Índice para busca rápida de vendas por pedido do Tiny ERP.';

COMMENT ON INDEX sistemaretiradas.idx_sales_tiny_order_id_unique IS 
'Garante que cada pedido do Tiny ERP gere apenas uma venda (evita duplicatas).';

-- ============================================================================
-- MIGRATION 2: Função para criar vendas automaticamente
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
          valor = v_pedido.valor_total,
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
          'valor', v_pedido.valor_total,
          'qtd_pecas', v_qtd_pecas
        );
      ELSE
        -- Criar nova venda
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
          v_pedido.valor_total,
          v_qtd_pecas,
          v_pedido.data_pedido,
          v_observacoes,
          NULL -- Vendas do ERP não têm lancado_por_id
        )
        RETURNING id INTO v_sale_id;
        
        v_vendas_criadas := v_vendas_criadas + 1;
        
        -- Adicionar ao detalhes
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
      
      -- Adicionar erro ao detalhes
      v_erro_detalhes := jsonb_build_object(
        'tipo', 'erro',
        'tiny_order_id', v_pedido.tiny_order_id,
        'numero_pedido', v_pedido.numero_pedido,
        'erro', SQLERRM
      );
      
      v_detalhes := v_detalhes || v_erro_detalhes;
      
      -- Log do erro (não interrompe o processamento)
      RAISE WARNING 'Erro ao processar pedido %: %', v_pedido.tiny_order_id, SQLERRM;
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
-- TESTE: Executar função para criar vendas de pedidos existentes
-- ============================================================================
-- Descomente as linhas abaixo para testar a função após executar as migrations:
--
-- SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders(NULL, NULL);
--
-- Ou para uma loja específica:
-- SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders('UUID_DA_LOJA', NULL);
--
-- ============================================================================
-- ✅ SCRIPT COMPLETO
-- ============================================================================
-- Após executar este script:
-- 1. As vendas serão criadas automaticamente após cada sincronização do Tiny
-- 2. As metas serão atualizadas automaticamente (calculadas a partir de sales)
-- 3. Cada pedido do Tiny gerará apenas uma venda (evita duplicatas)
-- ============================================================================

