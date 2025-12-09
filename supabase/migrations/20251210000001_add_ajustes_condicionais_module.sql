-- =====================================================
-- ADICIONAR MÓDULO AJUSTES & CONDICIONAIS
-- =====================================================

-- Adicionar campo para ativar/desativar módulo
ALTER TABLE sistemaretiradas.stores
ADD COLUMN IF NOT EXISTS ajustes_condicionais_ativo BOOLEAN DEFAULT false;

COMMENT ON COLUMN sistemaretiradas.stores.ajustes_condicionais_ativo IS 'Ativa/desativa módulo de Ajustes & Condicionais para a loja';

-- Criar índice para busca de produtos em condicionais e ajustes
-- Isso será usado para buscar produtos que estão fora da loja
CREATE INDEX IF NOT EXISTS idx_conditionals_products_gin ON sistemaretiradas.conditionals USING GIN (products);
CREATE INDEX IF NOT EXISTS idx_adjustments_product_gin ON sistemaretiradas.adjustments USING GIN (to_tsvector('portuguese', product));

-- Função para buscar produtos fora da loja (em condicionais ou ajustes)
CREATE OR REPLACE FUNCTION sistemaretiradas.search_products_out_of_store(
    p_store_id UUID,
    p_search_term TEXT DEFAULT NULL
)
RETURNS TABLE (
    tipo TEXT,
    id UUID,
    produto TEXT,
    cliente_nome TEXT,
    cliente_contato TEXT,
    status TEXT,
    data_geracao DATE,
    store_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    -- Buscar em condicionais
    SELECT 
        'CONDICIONAL'::TEXT as tipo,
        c.id,
        p->>'description' as produto,
        c.customer_name as cliente_nome,
        c.customer_contact as cliente_contato,
        c.status,
        c.date_generated as data_geracao,
        c.store_id
    FROM sistemaretiradas.conditionals c
    CROSS JOIN LATERAL jsonb_array_elements(c.products) AS p
    WHERE c.store_id = p_store_id
    AND c.status NOT IN ('FINALIZADA', 'ROTA_DEVOLUCAO')
    AND (
        p_search_term IS NULL 
        OR p_search_term = ''
        OR (p->>'description') ILIKE '%' || p_search_term || '%'
    )
    
    UNION ALL
    
    -- Buscar em ajustes
    SELECT 
        'AJUSTE'::TEXT as tipo,
        a.id,
        a.product as produto,
        a.customer_name as cliente_nome,
        a.customer_contact as cliente_contato,
        a.status,
        a.date_generated as data_geracao,
        a.store_id
    FROM sistemaretiradas.adjustments a
    WHERE a.store_id = p_store_id
    AND a.status NOT IN ('FINALIZADA', 'ROTA_DEVOLUCAO')
    AND (
        p_search_term IS NULL 
        OR p_search_term = ''
        OR a.product ILIKE '%' || p_search_term || '%'
    )
    
    ORDER BY data_geracao DESC;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.search_products_out_of_store(UUID, TEXT) IS 'Busca produtos que estão fora da loja (em condicionais ou ajustes) com busca aproximada por termo';

