-- ============================================================================
-- Migration: Adicionar campos de forma de pagamento à tiny_orders e copiar para sales
-- Data: 2025-12-22
-- Descrição: 
--   1. Adiciona colunas forma_pagamento e formas_pagamento_json em tiny_orders
--   2. Atualiza função criar_vendas_de_tiny_orders para copiar esses campos para sales
-- ============================================================================

-- ============================================================================
-- PARTE 1: Adicionar colunas de forma de pagamento em tiny_orders
-- ============================================================================

-- 1. Adicionar coluna forma_pagamento (TEXT, opcional)
ALTER TABLE sistemaretiradas.tiny_orders
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

-- 2. Adicionar coluna formas_pagamento_json (JSONB, opcional)
ALTER TABLE sistemaretiradas.tiny_orders
ADD COLUMN IF NOT EXISTS formas_pagamento_json JSONB;

-- 3. Comentários
COMMENT ON COLUMN sistemaretiradas.tiny_orders.forma_pagamento IS 
'Forma principal de pagamento do pedido (ex: DINHEIRO, CREDITO, DEBITO, PIX, VALE_TROCA). NULL para pedidos sem informação de pagamento.';

COMMENT ON COLUMN sistemaretiradas.tiny_orders.formas_pagamento_json IS 
'Array JSON com todas as formas de pagamento do pedido. Permite múltiplas formas na mesma venda.
Formato: [{"tipo": "CREDITO", "valor": 100.00}, {"tipo": "PIX", "valor": 99.90}]. NULL para pedidos sem informação de pagamento.';

-- ============================================================================
-- PARTE 2: Atualizar função criar_vendas_de_tiny_orders para copiar formas de pagamento
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
      o.forma_pagamento,
      o.formas_pagamento_json,
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
          forma_pagamento = v_pedido.forma_pagamento,
          formas_pagamento_json = v_pedido.formas_pagamento_json,
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
        -- ✅ CRIAR NOVA VENDA COM PROTEÇÃO CONTRA DUPLICATAS
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
            v_pedido.data_pedido,
            v_observacoes,
            v_pedido.forma_pagamento,
            v_pedido.formas_pagamento_json,
            NULL -- Vendas do ERP não têm lancado_por_id
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
                valor = v_pedido.valor_total,
                qtd_pecas = v_qtd_pecas,
                data_venda = v_pedido.data_pedido,
                observacoes = v_observacoes,
                forma_pagamento = v_pedido.forma_pagamento,
                formas_pagamento_json = v_pedido.formas_pagamento_json,
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
      
      -- Adicionar erro ao detalhes com informações completas para debug
      v_erro_detalhes := jsonb_build_object(
        'tipo', 'erro',
        'tiny_order_id', v_pedido.tiny_order_id,
        'numero_pedido', v_pedido.numero_pedido,
        'erro', SQLERRM,
        'sqlstate', SQLSTATE
      );
      
      v_detalhes := v_detalhes || v_erro_detalhes;
      
      RAISE WARNING 'Erro ao processar pedido % (número: %): %', 
        v_pedido.tiny_order_id, v_pedido.numero_pedido, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_vendas_criadas, v_vendas_atualizadas, v_erros, v_detalhes;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.criar_vendas_de_tiny_orders IS 
'Cria vendas (sales) automaticamente a partir de pedidos do Tiny ERP que ainda não têm venda correspondente.
Agora também copia forma_pagamento e formas_pagamento_json de tiny_orders para sales.
Parâmetros:
- p_store_id: ID da loja (NULL para processar todas as lojas)
- p_data_inicio: Data mínima dos pedidos (NULL para processar todos)

Retorna:
- vendas_criadas: Quantidade de vendas criadas
- vendas_atualizadas: Quantidade de vendas atualizadas
- erros: Quantidade de erros
- detalhes: JSONB com detalhes de cada operação';

-- ============================================================================
-- PARTE 3: Atualizar função processar_tiny_order_para_venda (usada pelo trigger)
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
    RAISE WARNING 'Pedido % não encontrado', p_tiny_order_id;
    RETURN NULL;
  END IF;
  
  -- Validações
  IF v_pedido.colaboradora_id IS NULL OR v_pedido.store_id IS NULL OR v_pedido.valor_total <= 0 THEN
    RAISE WARNING 'Pedido % não tem dados válidos para criar venda (colaboradora: %, store: %, valor: %)', 
      p_tiny_order_id, v_pedido.colaboradora_id, v_pedido.store_id, v_pedido.valor_total;
    RETURN NULL;
  END IF;
  
  -- Verificar se já existe venda para este pedido
  SELECT id INTO v_sale_id
  FROM sistemaretiradas.sales
  WHERE tiny_order_id = p_tiny_order_id;
  
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
    -- Atualizar venda existente
    UPDATE sistemaretiradas.sales
    SET
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
  ELSE
    -- Criar nova venda (com formas de pagamento)
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
      v_pedido.id,
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
  END IF;
  
  RETURN v_sale_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao processar pedido % para venda: %', p_tiny_order_id, SQLERRM;
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.processar_tiny_order_para_venda IS 
'Processa um único pedido do Tiny ERP e cria/atualiza a venda correspondente.
Usado pelo trigger automático para processar pedidos em tempo real.
Agora também copia forma_pagamento e formas_pagamento_json de tiny_orders para sales.';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

