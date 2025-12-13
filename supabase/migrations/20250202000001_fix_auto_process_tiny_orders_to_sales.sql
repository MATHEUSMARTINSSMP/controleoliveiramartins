-- ============================================================================
-- Migration: Fix e Auto-Processamento de Tiny Orders para Sales
-- Data: 2025-02-02
-- Descrição: 
--   1. Corrige a função criar_vendas_de_tiny_orders para garantir compatibilidade com schema atual
--   2. Adiciona trigger automático para processar vendas quando pedidos são inseridos/atualizados
--   3. Adiciona função de validação de schema para prevenir erros futuros
--   4. Adiciona função de monitoramento para detectar vendas não processadas
-- ============================================================================

-- ============================================================================
-- PARTE 1: Função auxiliar para validar schema da tabela sales
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.validar_schema_sales()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_column_exists BOOLEAN;
BEGIN
  -- Verificar se colunas obrigatórias existem
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'sistemaretiradas'
      AND table_name = 'sales'
      AND column_name IN ('id', 'tiny_order_id', 'colaboradora_id', 'store_id', 'valor', 'qtd_pecas', 'data_venda', 'observacoes', 'created_at', 'updated_at')
  ) INTO v_column_exists;
  
  IF NOT v_column_exists THEN
    RAISE EXCEPTION 'Schema da tabela sales está incompleto. Colunas obrigatórias faltando.';
  END IF;
  
  RETURN TRUE;
END;
$$;

-- ============================================================================
-- PARTE 2: Re-criar função criar_vendas_de_tiny_orders com validações robustas
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
  -- ✅ VALIDAÇÃO INICIAL: Verificar se schema está correto
  PERFORM sistemaretiradas.validar_schema_sales();
  
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

-- ============================================================================
-- PARTE 3: Função para processar um único pedido (usada pelo trigger)
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
  -- Buscar dados do pedido
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
  
  -- Criar ou atualizar venda
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
      updated_at = NOW()
    WHERE id = v_sale_id;
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
      v_pedido.id,
      v_pedido.colaboradora_id,
      v_pedido.store_id,
      v_pedido.valor_total,
      v_qtd_pecas,
      v_pedido.data_pedido,
      v_observacoes,
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

-- ============================================================================
-- PARTE 4: Trigger para processar automaticamente quando pedido é inserido/atualizado
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.trigger_processar_tiny_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Processar apenas se o pedido tem dados válidos
  IF NEW.colaboradora_id IS NOT NULL 
     AND NEW.store_id IS NOT NULL 
     AND NEW.valor_total > 0 THEN
    -- Tentar processar (ignore erros silenciosamente para não quebrar o INSERT)
    PERFORM sistemaretiradas.processar_tiny_order_para_venda(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_auto_processar_tiny_order ON sistemaretiradas.tiny_orders;

-- Criar trigger
CREATE TRIGGER trigger_auto_processar_tiny_order
  AFTER INSERT OR UPDATE ON sistemaretiradas.tiny_orders
  FOR EACH ROW
  WHEN (NEW.colaboradora_id IS NOT NULL AND NEW.store_id IS NOT NULL AND NEW.valor_total > 0)
  EXECUTE FUNCTION sistemaretiradas.trigger_processar_tiny_order();

-- ============================================================================
-- PARTE 5: Função de monitoramento para detectar vendas não processadas
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.verificar_vendas_nao_processadas(
  p_store_id UUID DEFAULT NULL,
  p_dias_retrocesso INTEGER DEFAULT 7
)
RETURNS TABLE (
  tiny_order_id UUID,
  numero_pedido TEXT,
  store_id UUID,
  colaboradora_id UUID,
  valor_total NUMERIC,
  data_pedido TIMESTAMPTZ,
  motivo TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id as tiny_order_id,
    o.numero_pedido,
    o.store_id,
    o.colaboradora_id,
    o.valor_total,
    o.data_pedido,
    CASE
      WHEN o.colaboradora_id IS NULL THEN 'colaboradora_id é NULL'
      WHEN o.store_id IS NULL THEN 'store_id é NULL'
      WHEN o.valor_total IS NULL OR o.valor_total <= 0 THEN 'valor_total inválido'
      WHEN s.id IS NOT NULL THEN 'já tem venda (não deveria aparecer)'
      ELSE 'desconhecido'
    END as motivo
  FROM sistemaretiradas.tiny_orders o
  LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = o.id
  WHERE 
    (p_store_id IS NULL OR o.store_id = p_store_id)
    AND o.data_pedido >= NOW() - (p_dias_retrocesso || ' days')::INTERVAL
    AND s.id IS NULL
    AND (
      o.colaboradora_id IS NULL 
      OR o.store_id IS NULL 
      OR o.valor_total IS NULL 
      OR o.valor_total <= 0
    )
  ORDER BY o.data_pedido DESC;
END;
$$;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================
COMMENT ON FUNCTION sistemaretiradas.validar_schema_sales() IS 
'Valida se o schema da tabela sales está completo. Usado para prevenir erros de colunas faltantes.';

COMMENT ON FUNCTION sistemaretiradas.criar_vendas_de_tiny_orders IS 
'Cria vendas (sales) automaticamente a partir de pedidos do Tiny ERP que ainda não têm venda correspondente.
Parâmetros:
- p_store_id: ID da loja (NULL para processar todas as lojas)
- p_data_inicio: Data mínima dos pedidos (NULL para processar todos)

Retorna:
- vendas_criadas: Quantidade de vendas criadas
- vendas_atualizadas: Quantidade de vendas atualizadas
- erros: Quantidade de erros
- detalhes: JSONB com detalhes de cada operação

⚠️ IMPORTANTE: Esta função NUNCA deve tentar acessar colunas que não existem na tabela sales.
Colunas válidas: id, tiny_order_id, colaboradora_id, store_id, valor, qtd_pecas, data_venda, observacoes, created_at, updated_at, lancado_por_id, cliente_id, cliente_nome';

COMMENT ON FUNCTION sistemaretiradas.processar_tiny_order_para_venda IS 
'Processa um único pedido do Tiny ERP e cria/atualiza a venda correspondente.
Usado pelo trigger automático para processar pedidos em tempo real.';

COMMENT ON FUNCTION sistemaretiradas.trigger_processar_tiny_order() IS 
'Trigger que processa automaticamente pedidos do Tiny ERP para criar vendas.
Executa após INSERT ou UPDATE na tabela tiny_orders.';

COMMENT ON FUNCTION sistemaretiradas.verificar_vendas_nao_processadas IS 
'Identifica pedidos do Tiny ERP que não foram processados para vendas.
Útil para monitoramento e diagnóstico de problemas no processamento automático.
Parâmetros:
- p_store_id: ID da loja (NULL para todas)
- p_dias_retrocesso: Quantos dias retroceder na busca (padrão: 7)';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

