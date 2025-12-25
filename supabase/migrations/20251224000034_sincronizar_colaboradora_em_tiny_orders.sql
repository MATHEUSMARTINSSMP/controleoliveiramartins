-- ============================================================================
-- FUNÇÃO PARA SINCRONIZAR colaboradora_id EM tiny_orders
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Atualiza colaboradora_id em pedidos que não têm, usando matching
--            por tiny_vendedor_id, email ou nome exato (como no código TypeScript)
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.sincronizar_colaboradora_em_tiny_orders(
  p_store_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  pedidos_processados INTEGER,
  colaboradoras_vinculadas INTEGER,
  detalhes JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pedido RECORD;
  v_colaboradora_id UUID;
  v_processados INTEGER := 0;
  v_vinculadas INTEGER := 0;
  v_detalhes JSONB := '[]'::JSONB;
  v_resultado JSONB;
BEGIN
  -- Processar pedidos sem colaboradora_id
  FOR v_pedido IN
    SELECT 
      to.id,
      to.store_id,
      to.vendedor_tiny_id,
      to.vendedor_nome
    FROM sistemaretiradas.tiny_orders to
    WHERE to.colaboradora_id IS NULL
      AND to.valor_total > 0
      AND (p_store_id IS NULL OR to.store_id = p_store_id)
      AND (to.vendedor_tiny_id IS NOT NULL OR to.vendedor_nome IS NOT NULL)
    ORDER BY to.created_at DESC
    LIMIT p_limit
  LOOP
    v_colaboradora_id := NULL;
    v_processados := v_processados + 1;
    
    -- PRIORIDADE 1: Buscar por tiny_vendedor_id (mais confiável)
    IF v_pedido.vendedor_tiny_id IS NOT NULL THEN
      SELECT p.id INTO v_colaboradora_id
      FROM sistemaretiradas.profiles p
      WHERE p.tiny_vendedor_id = v_pedido.vendedor_tiny_id::TEXT
        AND p.role = 'COLABORADORA'
        AND p.is_active = true
        AND (v_pedido.store_id IS NULL OR p.store_id = v_pedido.store_id)
      LIMIT 1;
      
      IF v_colaboradora_id IS NOT NULL THEN
        RAISE NOTICE '[sync_colaboradora] ✅ Match por tiny_vendedor_id: pedido % -> colaboradora %', v_pedido.id, v_colaboradora_id;
      END IF;
    END IF;
    
    -- PRIORIDADE 2: Buscar por nome exato (se não encontrou por ID)
    IF v_colaboradora_id IS NULL AND v_pedido.vendedor_nome IS NOT NULL THEN
      -- Buscar colaboradoras da loja por nome exato
      SELECT p.id INTO v_colaboradora_id
      FROM sistemaretiradas.profiles p
      WHERE p.role = 'COLABORADORA'
        AND p.is_active = true
        AND (v_pedido.store_id IS NULL OR p.store_id = v_pedido.store_id)
        AND LOWER(TRIM(p.name)) = LOWER(TRIM(v_pedido.vendedor_nome))
      LIMIT 1;
      
      IF v_colaboradora_id IS NOT NULL THEN
        RAISE NOTICE '[sync_colaboradora] ✅ Match por nome exato: pedido % -> colaboradora %', v_pedido.id, v_colaboradora_id;
      END IF;
    END IF;
    
    -- PRIORIDADE 3: Buscar por nome parcial (se ainda não encontrou)
    -- Match parcial: nome do vendedor contém nome da colaboradora ou vice-versa
    IF v_colaboradora_id IS NULL AND v_pedido.vendedor_nome IS NOT NULL THEN
      SELECT p.id INTO v_colaboradora_id
      FROM sistemaretiradas.profiles p
      WHERE p.role = 'COLABORADORA'
        AND p.is_active = true
        AND (v_pedido.store_id IS NULL OR p.store_id = v_pedido.store_id)
        AND (
          LOWER(TRIM(p.name)) LIKE '%' || LOWER(TRIM(v_pedido.vendedor_nome)) || '%'
          OR LOWER(TRIM(v_pedido.vendedor_nome)) LIKE '%' || LOWER(TRIM(p.name)) || '%'
        )
      LIMIT 1;
      
      IF v_colaboradora_id IS NOT NULL THEN
        RAISE NOTICE '[sync_colaboradora] ✅ Match por nome parcial: pedido % -> colaboradora %', v_pedido.id, v_colaboradora_id;
      END IF;
    END IF;
    
    -- Se encontrou colaboradora, atualizar pedido
    IF v_colaboradora_id IS NOT NULL THEN
      UPDATE sistemaretiradas.tiny_orders
      SET colaboradora_id = v_colaboradora_id,
          updated_at = NOW()
      WHERE id = v_pedido.id;
      
      v_vinculadas := v_vinculadas + 1;
      
      v_resultado := jsonb_build_object(
        'pedido_id', v_pedido.id,
        'colaboradora_id', v_colaboradora_id,
        'vendedor_tiny_id', v_pedido.vendedor_tiny_id,
        'vendedor_nome', v_pedido.vendedor_nome,
        'status', 'vinculado'
      );
    ELSE
      v_resultado := jsonb_build_object(
        'pedido_id', v_pedido.id,
        'vendedor_tiny_id', v_pedido.vendedor_tiny_id,
        'vendedor_nome', v_pedido.vendedor_nome,
        'status', 'nao_encontrado'
      );
    END IF;
    
    v_detalhes := v_detalhes || v_resultado;
  END LOOP;
  
  RETURN QUERY SELECT 
    v_processados,
    v_vinculadas,
    v_detalhes;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.sincronizar_colaboradora_em_tiny_orders IS 
'Sincroniza colaboradora_id em pedidos tiny_orders que não têm.
Usa matching por: 1) tiny_vendedor_id, 2) nome exato, 3) nome parcial.
Parâmetros:
- p_store_id: ID da loja (NULL para todas)
- p_limit: Limite de pedidos a processar (padrão: 100)
Retorna: pedidos_processados, colaboradoras_vinculadas, detalhes (JSONB)';

-- ============================================================================
-- SINCRONIZAR PEDIDOS DA SACADA
-- ============================================================================
SELECT * FROM sistemaretiradas.sincronizar_colaboradora_em_tiny_orders(
  'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID, -- Sacada | Oh, Boy
  500 -- Processar até 500 pedidos
);

-- VERIFICAR RESULTADO
SELECT 
    COUNT(*) as pedidos_sem_colaboradora,
    COUNT(*) FILTER (WHERE vendedor_tiny_id IS NOT NULL) as com_tiny_id,
    COUNT(*) FILTER (WHERE vendedor_nome IS NOT NULL) as com_nome,
    COUNT(*) FILTER (WHERE vendedor_tiny_id IS NULL AND vendedor_nome IS NULL) as sem_info_vendedor
FROM sistemaretiradas.tiny_orders
WHERE colaboradora_id IS NULL
    AND store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID
    AND valor_total > 0;

-- ============================================================================
-- ✅ FUNÇÃO CRIADA
-- ============================================================================

