-- =============================================================================
-- Migration: Tabela de Controle de Sincronização
-- Data: 2025-01-31
-- Descrição: Cria tabela para armazenar último pedido sincronizado por loja
--            Permite verificação inteligente antes de sincronizar
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- TABELA: sync_control
-- =============================================================================
-- Armazena informações sobre a última sincronização de cada loja
-- Permite verificar se há nova venda antes de sincronizar (polling inteligente)

CREATE TABLE IF NOT EXISTS sync_control (
    store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Último pedido sincronizado
    ultimo_numero_pedido INTEGER,
    ultima_data_pedido TIMESTAMP,
    
    -- Controle de sincronização
    ultima_sync_pedidos TIMESTAMP,
    ultima_sync_contatos TIMESTAMP,
    
    -- Estatísticas
    total_pedidos_sincronizados INTEGER DEFAULT 0,
    total_contatos_sincronizados INTEGER DEFAULT 0,
    
    -- Metadados
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- ÍNDICES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_sync_control_store_id ON sync_control(store_id);
CREATE INDEX IF NOT EXISTS idx_sync_control_ultima_sync ON sync_control(ultima_sync_pedidos);

-- =============================================================================
-- FUNÇÃO: Atualizar controle de sincronização
-- =============================================================================

CREATE OR REPLACE FUNCTION update_sync_control(
    p_store_id UUID,
    p_ultimo_numero_pedido INTEGER DEFAULT NULL,
    p_ultima_data_pedido TIMESTAMP DEFAULT NULL,
    p_total_pedidos INTEGER DEFAULT NULL,
    p_total_contatos INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
BEGIN
    INSERT INTO sync_control (
        store_id,
        ultimo_numero_pedido,
        ultima_data_pedido,
        ultima_sync_pedidos,
        total_pedidos_sincronizados,
        total_contatos_sincronizados,
        updated_at
    )
    VALUES (
        p_store_id,
        p_ultimo_numero_pedido,
        p_ultima_data_pedido,
        NOW(),
        COALESCE(p_total_pedidos, 0),
        COALESCE(p_total_contatos, 0),
        NOW()
    )
    ON CONFLICT (store_id)
    DO UPDATE SET
        ultimo_numero_pedido = COALESCE(EXCLUDED.ultimo_numero_pedido, sync_control.ultimo_numero_pedido),
        ultima_data_pedido = COALESCE(EXCLUDED.ultima_data_pedido, sync_control.ultima_data_pedido),
        ultima_sync_pedidos = COALESCE(EXCLUDED.ultima_sync_pedidos, sync_control.ultima_sync_pedidos),
        total_pedidos_sincronizados = COALESCE(EXCLUDED.total_pedidos_sincronizados, sync_control.total_pedidos_sincronizados),
        total_contatos_sincronizados = COALESCE(EXCLUDED.total_contatos_sincronizados, sync_control.total_contatos_sincronizados),
        updated_at = NOW();
END;
$$;

-- =============================================================================
-- FUNÇÃO: Verificar se há nova venda (para polling inteligente)
-- =============================================================================

CREATE OR REPLACE FUNCTION verificar_nova_venda(
    p_store_id UUID
)
RETURNS TABLE (
    tem_nova_venda BOOLEAN,
    ultimo_numero_pedido INTEGER,
    ultima_data_pedido TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_ultimo_numero INTEGER;
    v_ultima_data TIMESTAMP;
BEGIN
    -- Buscar último pedido no banco para esta loja
    SELECT 
        MAX(numero_pedido)::INTEGER,
        MAX(data_pedido)::TIMESTAMP
    INTO 
        v_ultimo_numero,
        v_ultima_data
    FROM tiny_orders
    WHERE store_id = p_store_id
      AND numero_pedido IS NOT NULL;
    
    -- Retornar resultado
    RETURN QUERY
    SELECT 
        TRUE as tem_nova_venda, -- Sempre retorna TRUE (a verificação real será feita na Edge Function comparando com API)
        v_ultimo_numero as ultimo_numero_pedido,
        v_ultima_data as ultima_data_pedido;
END;
$$;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE sync_control ENABLE ROW LEVEL SECURITY;

-- Permitir leitura para ADMIN
CREATE POLICY "sync_control_select_admin"
    ON sync_control
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

-- Permitir inserção/atualização para ADMIN
CREATE POLICY "sync_control_insert_update_admin"
    ON sync_control
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

-- Permitir service_role (Edge Functions)
CREATE POLICY "sync_control_service_role"
    ON sync_control
    FOR ALL
    USING (auth.role() = 'service_role');

-- =============================================================================
-- COMENTÁRIOS
-- =============================================================================

COMMENT ON TABLE sync_control IS 'Armazena informações sobre a última sincronização de cada loja para permitir polling inteligente';
COMMENT ON COLUMN sync_control.ultimo_numero_pedido IS 'Número do último pedido sincronizado (usado para verificar se há nova venda)';
COMMENT ON COLUMN sync_control.ultima_data_pedido IS 'Data do último pedido sincronizado';
COMMENT ON FUNCTION update_sync_control IS 'Atualiza ou cria registro de controle de sincronização para uma loja';
COMMENT ON FUNCTION verificar_nova_venda IS 'Retorna informações sobre o último pedido sincronizado (a comparação com API será feita na Edge Function)';

