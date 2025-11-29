-- ============================================================================
-- CORREÇÃO: Garantir que Cashback seja gerado AUTOMATICAMENTE
-- ============================================================================
-- Este script garante que o cashback seja gerado automaticamente para TODOS
-- os pedidos que atendam aos critérios, independente da situação (exceto cancelados)

-- ============================================================================
-- 1. ATUALIZAR TRIGGER: Remover restrições desnecessárias de situação
-- ============================================================================
DROP TRIGGER IF EXISTS trg_gerar_cashback_new_order ON sistemaretiradas.tiny_orders;

CREATE OR REPLACE FUNCTION sistemaretiradas.trigger_gerar_cashback_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cliente_cpf TEXT;
    v_situacao TEXT;
    v_config_exists BOOLEAN;
BEGIN
    -- ✅ ACEITAR TODAS AS SITUAÇÕES EXCETO CANCELADAS
    -- Converter situação para texto para comparação
    v_situacao := COALESCE(NEW.situacao::TEXT, '');
    
    -- Verificar se está cancelado (aceitar qualquer variação: 'cancelado', 'Cancelado', etc.)
    IF LOWER(TRIM(v_situacao)) = 'cancelado' THEN
        RAISE NOTICE '🚫 Cashback NÃO gerado para pedido % - Pedido cancelado (situação: %)', NEW.id, v_situacao;
        RETURN NEW;
    END IF;
    
    -- ✅ REGRA: Apenas se tiver cliente, valor > 0 e não for cancelado
    IF NEW.cliente_id IS NOT NULL AND NEW.valor_total > 0 THEN
        
        -- 🔴 VALIDAÇÃO OBRIGATÓRIA: Cliente DEVE ter CPF/CNPJ
        SELECT cpf_cnpj INTO v_cliente_cpf
        FROM sistemaretiradas.tiny_contacts
        WHERE id = NEW.cliente_id;
        
        -- Validar se CPF existe e não está vazio
        IF v_cliente_cpf IS NULL OR TRIM(v_cliente_cpf) = '' THEN
            RAISE NOTICE '🚫 Cashback NÃO gerado para pedido % - Cliente sem CPF/CNPJ (OBRIGATÓRIO)', NEW.id;
            RETURN NEW;
        END IF;
        
        -- Validar tamanho mínimo do CPF (11 dígitos) ou CNPJ (14 dígitos)
        IF LENGTH(REGEXP_REPLACE(v_cliente_cpf, '\D', '', 'g')) < 11 THEN
            RAISE NOTICE '🚫 Cashback NÃO gerado para pedido % - CPF/CNPJ inválido (muito curto)', NEW.id;
            RETURN NEW;
        END IF;
        
        -- ✅ VERIFICAR SE JÁ EXISTE CASHBACK PARA ESTE PEDIDO
        -- Evitar duplicação: só gerar se não existir transação EARNED para este pedido
        IF NOT EXISTS (
            SELECT 1 
            FROM sistemaretiradas.cashback_transactions 
            WHERE tiny_order_id = NEW.id 
              AND transaction_type = 'EARNED'
        ) THEN
            -- ✅ CPF VALIDADO E SEM CASHBACK EXISTENTE: Gerar cashback
            BEGIN
                PERFORM sistemaretiradas.gerar_cashback(
                    NEW.id,
                    NEW.cliente_id,
                    NEW.store_id,
                    NEW.valor_total
                );
                RAISE NOTICE '✅ Cashback gerado AUTOMATICAMENTE para pedido % (situação: %) - Cliente: %', NEW.id, v_situacao, v_cliente_cpf;
            EXCEPTION WHEN OTHERS THEN
                -- Logar erro mas não falhar a transação do pedido
                RAISE WARNING '❌ Erro ao gerar cashback AUTOMATICAMENTE para pedido %: %', NEW.id, SQLERRM;
            END;
        ELSE
            RAISE NOTICE 'ℹ️ Cashback já existe para pedido % - Pulando geração', NEW.id;
        END IF;
    ELSE
        -- Log quando não atende critérios básicos
        IF NEW.cliente_id IS NULL THEN
            RAISE NOTICE '⚠️ Pedido % sem cliente_id - Cashback não gerado', NEW.id;
        ELSIF NEW.valor_total <= 0 THEN
            RAISE NOTICE '⚠️ Pedido % com valor_total <= 0 - Cashback não gerado', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Recriar o trigger
CREATE TRIGGER trg_gerar_cashback_new_order
    AFTER INSERT OR UPDATE ON sistemaretiradas.tiny_orders
    FOR EACH ROW
    WHEN (NEW.cliente_id IS NOT NULL AND NEW.valor_total > 0)
    EXECUTE FUNCTION sistemaretiradas.trigger_gerar_cashback_pedido();

COMMENT ON FUNCTION sistemaretiradas.trigger_gerar_cashback_pedido IS 'Gera cashback AUTOMATICAMENTE para novos pedidos que atendam aos critérios';

-- ============================================================================
-- 2. VERIFICAR SE O TRIGGER ESTÁ ATIVO
-- ============================================================================
-- Query para verificar se o trigger está ativo:
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled,
    CASE 
        WHEN tgenabled = 'O' THEN '✅ ATIVO'
        WHEN tgenabled = 'D' THEN '❌ DESABILITADO'
        ELSE '❓ DESCONHECIDO'
    END as status
FROM pg_trigger
WHERE tgrelid = 'sistemaretiradas.tiny_orders'::regclass
  AND tgname = 'trg_gerar_cashback_new_order';

-- ============================================================================
-- 3. GARANTIR CONFIGURAÇÃO PADRÃO (se não existir)
-- ============================================================================
INSERT INTO sistemaretiradas.cashback_settings (
    store_id,
    prazo_liberacao_dias,
    prazo_expiracao_dias,
    percentual_cashback,
    percentual_uso_maximo,
    renovacao_habilitada,
    renovacao_dias,
    observacoes
)
SELECT 
    NULL, -- Configuração global
    2,    -- Liberação em 2 dias
    30,   -- Expiração em 30 dias
    15.00, -- 15% de cashback
    30.00, -- Máx 30% da compra
    true,  -- Renovação habilitada
    3,     -- +3 dias ao renovar
    'Configuração padrão global criada automaticamente'
WHERE NOT EXISTS (
    SELECT 1 FROM sistemaretiradas.cashback_settings 
    WHERE store_id IS NULL
)
ON CONFLICT (store_id) DO NOTHING;

-- ============================================================================
-- 4. TESTE: Verificar último pedido e tentar gerar cashback manualmente
-- ============================================================================
-- SELECT * FROM sistemaretiradas.tiny_orders 
-- ORDER BY created_at DESC 
-- LIMIT 1;

