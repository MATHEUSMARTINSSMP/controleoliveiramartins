-- ============================================================================
-- MIGRATION: Adicionar paginação à função get_crm_customer_stats
-- ============================================================================
-- Data: 2025-12-19
-- Descrição: Adiciona parâmetros opcionais de paginação (offset e limit)
--            para permitir buscar contatos em lotes
-- ============================================================================

-- Atualizar função para aceitar paginação
CREATE OR REPLACE FUNCTION sistemaretiradas.get_crm_customer_stats(
    p_store_id UUID,
    p_offset INTEGER DEFAULT 0,
    p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
    contact_id UUID,
    nome TEXT,
    telefone TEXT,
    email TEXT,
    cpf TEXT,
    ultima_compra DATE,
    dias_sem_comprar INTEGER,
    total_compras NUMERIC,
    quantidade_compras INTEGER,
    ticket_medio NUMERIC,
    categoria TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH customer_sales AS (
        -- Busca vendas da tabela SALES (unificada de todos os ERPs: Tiny, Bling, etc)
        SELECT 
            s.cliente_id,
            MAX(s.data_venda::DATE) AS ultima_compra,
            SUM(COALESCE(s.valor, 0)) AS total_compras,
            COUNT(*) AS quantidade_compras
        FROM sistemaretiradas.sales s
        WHERE s.store_id = p_store_id
        AND s.cliente_id IS NOT NULL
        GROUP BY s.cliente_id
    )
    SELECT 
        c.id AS contact_id,
        c.nome,
        COALESCE(c.telefone, c.celular) AS telefone,
        c.email,
        c.cpf,
        cs.ultima_compra,
        COALESCE((CURRENT_DATE - cs.ultima_compra), 9999)::INTEGER AS dias_sem_comprar,
        COALESCE(cs.total_compras, 0) AS total_compras,
        COALESCE(cs.quantidade_compras::INTEGER, 0) AS quantidade_compras,
        CASE WHEN cs.quantidade_compras > 0 
            THEN ROUND(cs.total_compras / cs.quantidade_compras, 2) 
            ELSE 0 
        END AS ticket_medio,
        CASE 
            WHEN cs.total_compras >= 5000 THEN 'BLACK'
            WHEN cs.total_compras >= 2000 THEN 'PLATINUM'
            WHEN cs.total_compras >= 500 THEN 'VIP'
            ELSE 'REGULAR'
        END AS categoria
    FROM sistemaretiradas.crm_contacts c
    LEFT JOIN customer_sales cs ON c.id = cs.cliente_id
    WHERE c.store_id = p_store_id
    AND (c.telefone IS NOT NULL OR c.celular IS NOT NULL)
    ORDER BY c.nome
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Função auxiliar para contar total de contatos
CREATE OR REPLACE FUNCTION sistemaretiradas.get_crm_customer_stats_count(
    p_store_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM sistemaretiradas.crm_contacts c
    WHERE c.store_id = p_store_id
    AND (c.telefone IS NOT NULL OR c.celular IS NOT NULL);
    
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.get_crm_customer_stats(UUID, INTEGER, INTEGER) IS 
'Retorna estatísticas CRM dos clientes da tabela SALES unificada com paginação (offset, limit)';

COMMENT ON FUNCTION sistemaretiradas.get_crm_customer_stats_count(UUID) IS 
'Retorna o total de contatos disponíveis para uma loja';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

