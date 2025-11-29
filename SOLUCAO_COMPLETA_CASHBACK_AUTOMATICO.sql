-- ============================================================================
-- ✅ SOLUÇÃO COMPLETA: CASHBACK 100% AUTOMÁTICO
-- ============================================================================
-- Execute esta query COMPLETA no Supabase SQL Editor para garantir que
-- o cashback seja gerado AUTOMATICAMENTE para TODAS as vendas finalizadas no Tiny

-- ============================================================================
-- PASSO 1: GARANTIR QUE TODAS AS TABELAS EXISTEM
-- ============================================================================

-- Tabela cashback_settings (já deve existir, mas verificar)
CREATE TABLE IF NOT EXISTS sistemaretiradas.cashback_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    prazo_liberacao_dias INTEGER NOT NULL DEFAULT 2,
    prazo_expiracao_dias INTEGER NOT NULL DEFAULT 30,
    percentual_cashback NUMERIC(5,2) NOT NULL DEFAULT 15.00,
    percentual_uso_maximo NUMERIC(5,2) NOT NULL DEFAULT 30.00,
    renovacao_habilitada BOOLEAN NOT NULL DEFAULT true,
    renovacao_dias INTEGER NOT NULL DEFAULT 3,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT cashback_settings_unique_store UNIQUE NULLS NOT DISTINCT (store_id)
);

-- Tabela cashback_balance (já deve existir, mas verificar)
CREATE TABLE IF NOT EXISTS sistemaretiradas.cashback_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES sistemaretiradas.tiny_contacts(id) ON DELETE CASCADE,
    balance NUMERIC(10,2) NOT NULL DEFAULT 0,
    balance_disponivel NUMERIC(10,2) NOT NULL DEFAULT 0,
    balance_pendente NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT cashback_balance_unique_cliente UNIQUE(cliente_id)
);

-- Tabela cashback_transactions (já deve existir, mas verificar)
CREATE TABLE IF NOT EXISTS sistemaretiradas.cashback_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES sistemaretiradas.tiny_contacts(id) ON DELETE CASCADE,
    tiny_order_id UUID REFERENCES sistemaretiradas.tiny_orders(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('EARNED', 'REDEEMED', 'EXPIRED', 'ADJUSTMENT')),
    amount NUMERIC(10,2) NOT NULL,
    description TEXT,
    data_liberacao TIMESTAMP WITH TIME ZONE,
    data_expiracao TIMESTAMP WITH TIME ZONE,
    renovado BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PASSO 2: GARANTIR CONFIGURAÇÃO PADRÃO
-- ============================================================================
INSERT INTO sistemaretiradas.cashback_settings (
    store_id, prazo_liberacao_dias, prazo_expiracao_dias,
    percentual_cashback, percentual_uso_maximo,
    renovacao_habilitada, renovacao_dias, observacoes
)
SELECT NULL, 2, 30, 15.00, 30.00, true, 3, 'Configuração padrão global - CASHBACK AUTOMÁTICO'
WHERE NOT EXISTS (
    SELECT 1 FROM sistemaretiradas.cashback_settings WHERE store_id IS NULL
)
ON CONFLICT (store_id) DO NOTHING;

-- ============================================================================
-- PASSO 3: REMOVER TRIGGER ANTIGO E RECRIAR (MELHORADO)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_gerar_cashback_new_order ON sistemaretiradas.tiny_orders;

-- Função do trigger (MELHORADA)
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
            RAISE NOTICE '🚫 Cashback não gerado para pedido % - Cliente sem CPF/CNPJ', NEW.id;
            RETURN NEW;
        END IF;
        
        IF LENGTH(REGEXP_REPLACE(v_cliente_cpf, '\D', '', 'g')) < 11 THEN
            RAISE NOTICE '🚫 Cashback não gerado para pedido % - CPF/CNPJ inválido', NEW.id;
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

-- Recriar trigger
CREATE TRIGGER trg_gerar_cashback_new_order
    AFTER INSERT OR UPDATE ON sistemaretiradas.tiny_orders
    FOR EACH ROW
    WHEN (NEW.cliente_id IS NOT NULL AND NEW.valor_total > 0)
    EXECUTE FUNCTION sistemaretiradas.trigger_gerar_cashback_pedido();

-- ============================================================================
-- PASSO 4: VERIFICAR SE FOI CRIADO CORRETAMENTE
-- ============================================================================
SELECT 
    '✅ SISTEMA DE CASHBACK CONFIGURADO!' as status,
    tgname as trigger_name,
    CASE 
        WHEN tgenabled = 'O' THEN '✅ ATIVO'
        ELSE '❌ DESABILITADO - VERIFICAR!'
    END as estado_trigger
FROM pg_trigger
WHERE tgrelid = 'sistemaretiradas.tiny_orders'::regclass
  AND tgname = 'trg_gerar_cashback_new_order';

-- Verificar configuração
SELECT 
    '✅ CONFIGURAÇÃO ATIVA!' as status,
    percentual_cashback || '%' as cashback,
    prazo_liberacao_dias || ' dias' as liberacao
FROM sistemaretiradas.cashback_settings
WHERE store_id IS NULL;

-- ============================================================================
-- PASSO 5: TESTAR COM ÚLTIMO PEDIDO (DESCOMENTAR PARA TESTAR)
-- ============================================================================
-- SELECT * FROM sistemaretiradas.tiny_orders 
-- ORDER BY created_at DESC 
-- LIMIT 1;

