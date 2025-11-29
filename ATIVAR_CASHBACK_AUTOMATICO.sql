-- ============================================================================
-- ✅ ATIVAR GERAÇÃO AUTOMÁTICA DE CASHBACK
-- ============================================================================
-- Execute esta query no Supabase SQL Editor para garantir que o cashback
-- seja gerado AUTOMATICAMENTE para todos os pedidos que atendam aos critérios

-- 1️⃣ REMOVER TRIGGER ANTIGO (se existir)
DROP TRIGGER IF EXISTS trg_gerar_cashback_new_order ON sistemaretiradas.tiny_orders;

-- 2️⃣ RECRIAR FUNÇÃO DO TRIGGER (melhorada)
CREATE OR REPLACE FUNCTION sistemaretiradas.trigger_gerar_cashback_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cliente_cpf TEXT;
    v_situacao TEXT;
BEGIN
    -- ✅ ACEITAR TODAS AS SITUAÇÕES EXCETO CANCELADAS
    v_situacao := COALESCE(NEW.situacao::TEXT, '');
    
    -- Verificar se está cancelado
    IF LOWER(TRIM(v_situacao)) = 'cancelado' THEN
        RETURN NEW;
    END IF;
    
    -- ✅ REGRA: Apenas se tiver cliente, valor > 0 e não for cancelado
    IF NEW.cliente_id IS NOT NULL AND NEW.valor_total > 0 THEN
        
        -- Buscar CPF do cliente
        SELECT cpf_cnpj INTO v_cliente_cpf
        FROM sistemaretiradas.tiny_contacts
        WHERE id = NEW.cliente_id;
        
        -- Validar CPF
        IF v_cliente_cpf IS NULL OR TRIM(v_cliente_cpf) = '' THEN
            RETURN NEW;
        END IF;
        
        IF LENGTH(REGEXP_REPLACE(v_cliente_cpf, '\D', '', 'g')) < 11 THEN
            RETURN NEW;
        END IF;
        
        -- ✅ GERAR CASHBACK (evitar duplicação)
        IF NOT EXISTS (
            SELECT 1 
            FROM sistemaretiradas.cashback_transactions 
            WHERE tiny_order_id = NEW.id 
              AND transaction_type = 'EARNED'
        ) THEN
            BEGIN
                PERFORM sistemaretiradas.gerar_cashback(
                    NEW.id,
                    NEW.cliente_id,
                    NEW.store_id,
                    NEW.valor_total
                );
                RAISE NOTICE '✅ Cashback gerado AUTOMATICAMENTE para pedido %', NEW.id;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '❌ Erro ao gerar cashback: %', SQLERRM;
            END;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 3️⃣ CRIAR TRIGGER (executa após INSERT ou UPDATE)
CREATE TRIGGER trg_gerar_cashback_new_order
    AFTER INSERT OR UPDATE ON sistemaretiradas.tiny_orders
    FOR EACH ROW
    WHEN (NEW.cliente_id IS NOT NULL AND NEW.valor_total > 0)
    EXECUTE FUNCTION sistemaretiradas.trigger_gerar_cashback_pedido();

-- 4️⃣ VERIFICAR SE FOI CRIADO CORRETAMENTE
SELECT 
    '✅ Trigger criado!' as status,
    tgname as trigger_name,
    CASE 
        WHEN tgenabled = 'O' THEN '✅ ATIVO'
        ELSE '❌ DESABILITADO'
    END as estado
FROM pg_trigger
WHERE tgrelid = 'sistemaretiradas.tiny_orders'::regclass
  AND tgname = 'trg_gerar_cashback_new_order';

-- 5️⃣ GARANTIR CONFIGURAÇÃO PADRÃO
INSERT INTO sistemaretiradas.cashback_settings (
    store_id, prazo_liberacao_dias, prazo_expiracao_dias,
    percentual_cashback, percentual_uso_maximo,
    renovacao_habilitada, renovacao_dias, observacoes
)
SELECT NULL, 2, 30, 15.00, 30.00, true, 3, 'Configuração padrão global'
WHERE NOT EXISTS (
    SELECT 1 FROM sistemaretiradas.cashback_settings 
    WHERE store_id IS NULL
)
ON CONFLICT (store_id) DO NOTHING;

-- 6️⃣ VERIFICAR CONFIGURAÇÃO
SELECT '✅ Configuração ativa!' as status, percentual_cashback, prazo_liberacao_dias
FROM sistemaretiradas.cashback_settings
WHERE store_id IS NULL;

