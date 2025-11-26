-- =============================================================================
-- Migration PARTE 4: Criar trigger para calcular cashback automaticamente
-- Data: 2025-01-30
-- Descrição: Trigger que dispara a função de cálculo de cashback
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- TRIGGER: Disparar cálculo de cashback em tiny_orders
-- =============================================================================

-- Verificar se tiny_orders existe antes de criar trigger
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'tiny_orders'
    ) THEN
        -- Remover trigger anterior se existir
        DROP TRIGGER IF EXISTS trigger_calculate_cashback_tiny_order ON tiny_orders;

        -- Criar trigger após INSERT ou UPDATE (quando situacao for faturado/aprovado)
        -- NOTA: TG_OP não pode ser usado na cláusula WHEN, então verificamos dentro da função
        -- O trigger vai sempre chamar a função, e ela decide se processa ou não
        CREATE TRIGGER trigger_calculate_cashback_tiny_order
            AFTER INSERT OR UPDATE ON tiny_orders
            FOR EACH ROW
            WHEN (
                NEW.valor_total > 0 
                AND NEW.cliente_id IS NOT NULL
                AND NEW.situacao IN ('1', '3') -- Faturado ou Aprovado
            )
            EXECUTE FUNCTION calculate_cashback_for_tiny_order();

        RAISE NOTICE 'Trigger trigger_calculate_cashback_tiny_order criado com sucesso';
    ELSE
        RAISE NOTICE 'Tabela tiny_orders não existe. Trigger não será criado.';
    END IF;
END $$;

