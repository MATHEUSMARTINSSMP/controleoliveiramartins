-- ============================================================================
-- MIGRATION: Função RPC para buscar histórico de compras dos clientes
-- ============================================================================
-- Data: 2025-12-19
-- Descrição: Cria função RPC para buscar clientes com estatísticas de compras
--            incluindo última compra, dias sem comprar, total faturado, etc.
-- ============================================================================

-- Função RPC para buscar clientes com estatísticas de compras
CREATE OR REPLACE FUNCTION sistemaretiradas.get_customer_purchase_history(
    p_store_id UUID,
    p_max_days_since_last_purchase INTEGER DEFAULT NULL,
    p_min_last_purchase_date DATE DEFAULT NULL,
    p_min_total_revenue NUMERIC DEFAULT NULL,
    p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
    cliente_id UUID,
    cliente_nome TEXT,
    cliente_cpf TEXT,
    cliente_telefone TEXT,
    ultima_compra DATE,
    dias_sem_comprar INTEGER,
    total_compras NUMERIC,
    quantidade_compras BIGINT,
    ticket_medio NUMERIC,
    primeira_compra DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH customer_stats AS (
        SELECT 
            c.id AS cliente_id,
            c.nome AS cliente_nome,
            c.cpf AS cliente_cpf,
            c.telefone AS cliente_telefone,
            MAX(s.data_venda::DATE) AS ultima_compra,
            MIN(s.data_venda::DATE) AS primeira_compra,
            COUNT(s.id) AS quantidade_compras,
            COALESCE(SUM(s.valor), 0) AS total_compras,
            CASE 
                WHEN COUNT(s.id) > 0 THEN COALESCE(SUM(s.valor), 0) / COUNT(s.id)
                ELSE 0
            END AS ticket_medio
        FROM sistemaretiradas.crm_contacts c
        LEFT JOIN sistemaretiradas.sales s ON (
            s.store_id = p_store_id
            AND (
                s.cliente_id = c.id
                OR (s.cliente_id IS NULL AND s.cliente_nome ILIKE '%' || c.nome || '%')
                OR (s.cliente_id IS NULL AND c.cpf IS NOT NULL AND EXISTS (
                    SELECT 1 
                    FROM sistemaretiradas.crm_contacts c2 
                    WHERE c2.cpf = c.cpf 
                    AND c2.store_id = p_store_id
                    AND s.cliente_id = c2.id
                ))
            )
        )
        WHERE c.store_id = p_store_id
        GROUP BY c.id, c.nome, c.cpf, c.telefone
    )
    SELECT 
        cs.cliente_id,
        cs.cliente_nome,
        cs.cliente_cpf,
        cs.cliente_telefone,
        cs.ultima_compra,
        CASE 
            WHEN cs.ultima_compra IS NOT NULL 
            THEN (CURRENT_DATE - cs.ultima_compra)::INTEGER
            ELSE 9999
        END AS dias_sem_comprar,
        cs.total_compras,
        cs.quantidade_compras,
        cs.ticket_medio,
        cs.primeira_compra
    FROM customer_stats cs
    WHERE 1=1
        -- Filtro: máximo de dias desde última compra
        AND (p_max_days_since_last_purchase IS NULL 
             OR cs.ultima_compra IS NULL 
             OR (CURRENT_DATE - cs.ultima_compra)::INTEGER <= p_max_days_since_last_purchase)
        -- Filtro: não compram desde data específica
        AND (p_min_last_purchase_date IS NULL 
             OR cs.ultima_compra IS NULL 
             OR cs.ultima_compra < p_min_last_purchase_date)
        -- Filtro: faturamento mínimo
        AND (p_min_total_revenue IS NULL 
             OR cs.total_compras >= p_min_total_revenue)
    ORDER BY 
        CASE WHEN cs.ultima_compra IS NOT NULL THEN cs.ultima_compra ELSE '1900-01-01'::DATE END DESC,
        cs.total_compras DESC
    LIMIT p_limit;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION sistemaretiradas.get_customer_purchase_history IS 
'Busca histórico de compras dos clientes com estatísticas. Retorna clientes com última compra, dias sem comprar, total faturado, etc.';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

