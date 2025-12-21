-- =====================================================
-- FASE 3: MARCAR tiny_order_id COMO DEPRECATED
-- =====================================================
-- Cria trigger que sincroniza automaticamente tiny_order_id com external_order_id
-- Mantém compatibilidade bidirecional durante período de transição
-- =====================================================

-- 1. Marcar coluna como DEPRECATED
COMMENT ON COLUMN sistemaretiradas.sales.tiny_order_id IS 
'[DEPRECATED] Use external_order_id + order_source ao invés desta coluna. Esta coluna será removida em versão futura. Trigger automático mantém sincronização durante transição.';

-- 2. Criar trigger que sincroniza external_order_id -> tiny_order_id (INSERT/UPDATE)
CREATE OR REPLACE FUNCTION sistemaretiradas.sync_tiny_order_id_from_external()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Se external_order_id foi definido e order_source = 'TINY', sincronizar tiny_order_id
    IF NEW.external_order_id IS NOT NULL 
       AND NEW.order_source = 'TINY' 
       AND (NEW.tiny_order_id IS NULL OR NEW.tiny_order_id::TEXT != NEW.external_order_id) THEN
        -- Tentar converter para UUID
        BEGIN
            NEW.tiny_order_id := NEW.external_order_id::UUID;
        EXCEPTION WHEN OTHERS THEN
            -- Se não for UUID válido, deixar NULL
            NEW.tiny_order_id := NULL;
        END;
    END IF;
    
    -- Se tiny_order_id foi definido mas external_order_id não, sincronizar (compatibilidade reversa)
    IF NEW.tiny_order_id IS NOT NULL 
       AND (NEW.external_order_id IS NULL OR NEW.order_source IS NULL) THEN
        NEW.external_order_id := NEW.tiny_order_id::TEXT;
        NEW.order_source := 'TINY';
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tiny_order_id_from_external ON sistemaretiradas.sales;

CREATE TRIGGER trg_sync_tiny_order_id_from_external
BEFORE INSERT OR UPDATE ON sistemaretiradas.sales
FOR EACH ROW
EXECUTE FUNCTION sistemaretiradas.sync_tiny_order_id_from_external();

-- 3. Atualizar trigger de cashback para usar nova estrutura
CREATE OR REPLACE FUNCTION sistemaretiradas.trigger_gerar_cashback_venda()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cliente_id IS NOT NULL THEN
        -- Usar external_order_id + order_source se disponível, senão fallback para tiny_order_id
        PERFORM sistemaretiradas.gerar_cashback(
            p_sale_id := NEW.id,
            p_external_order_id := NEW.external_order_id,
            p_order_source := NEW.order_source,
            p_tiny_order_id := NEW.tiny_order_id -- Fallback para compatibilidade
        );
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro ao gerar cashback para venda %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Comentários
COMMENT ON FUNCTION sistemaretiradas.sync_tiny_order_id_from_external IS 
'Trigger que sincroniza automaticamente tiny_order_id com external_order_id + order_source. Mantém compatibilidade bidirecional durante período de transição.';

COMMENT ON TRIGGER trg_sync_tiny_order_id_from_external ON sistemaretiradas.sales IS 
'Sincroniza automaticamente tiny_order_id (DEPRECATED) com external_order_id + order_source. Permite código legado continuar funcionando durante migração.';

