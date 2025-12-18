-- ============================================================================
-- FIX: Corrigir trigger de cashback e reprocessar transações perdidas
-- Data: 2025-12-18
-- 
-- PROBLEMA: Muitas transações EARNED não estão sendo adicionadas à fila
-- SOLUÇÃO: 
--   1. Recriar o trigger com mais validações e logging
--   2. Criar função para reprocessar transações antigas
--   3. Adicionar verificação de cliente_id NULL
-- ============================================================================

-- ============================================================================
-- PARTE 1: Dropar e Recriar o Trigger com Melhorias
-- ============================================================================

-- Dropar trigger existente
DROP TRIGGER IF EXISTS trg_after_cashback_created ON sistemaretiradas.cashback_transactions;

-- Dropar função do trigger
DROP FUNCTION IF EXISTS sistemaretiradas.fn_after_cashback_created();

-- Criar função do trigger melhorada com mais validações
CREATE OR REPLACE FUNCTION sistemaretiradas.fn_after_cashback_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
    v_whatsapp_ativo BOOLEAN;
    v_cashback_ativo BOOLEAN;
    v_cliente_telefone TEXT;
    v_cliente_nome TEXT;
BEGIN
    -- Só processar transações do tipo EARNED (cashback gerado)
    IF NEW.transaction_type != 'EARNED' THEN
        RETURN NEW;
    END IF;

    -- Verificar se tem cliente_id
    IF NEW.cliente_id IS NULL THEN
        RAISE NOTICE '[Cashback Trigger] Transação % sem cliente_id, ignorando', NEW.id;
        RETURN NEW;
    END IF;

    -- Obter store_id da transação ou buscar do cliente
    v_store_id := NEW.store_id;

    -- Se store_id for NULL, tentar buscar do cliente
    IF v_store_id IS NULL THEN
        -- Tentar buscar de crm_contacts
        SELECT store_id INTO v_store_id
        FROM sistemaretiradas.crm_contacts
        WHERE id = NEW.cliente_id;

        -- Se ainda for NULL, tentar de tiny_contacts
        IF v_store_id IS NULL THEN
            SELECT store_id INTO v_store_id
            FROM sistemaretiradas.tiny_contacts
            WHERE id = NEW.cliente_id;
        END IF;
    END IF;

    -- Se ainda não temos store_id, não podemos enviar WhatsApp
    IF v_store_id IS NULL THEN
        RAISE NOTICE '[Cashback Trigger] Transação % sem store_id (cliente: %), WhatsApp não enfileirado', NEW.id, NEW.cliente_id;
        RETURN NEW;
    END IF;

    -- Verificar se a loja tem WhatsApp e Cashback ativos
    SELECT whatsapp_ativo, cashback_ativo 
    INTO v_whatsapp_ativo, v_cashback_ativo
    FROM sistemaretiradas.stores
    WHERE id = v_store_id;

    -- Se loja não encontrada
    IF v_whatsapp_ativo IS NULL THEN
        RAISE WARNING '[Cashback Trigger] Loja % não encontrada para transação %', v_store_id, NEW.id;
        RETURN NEW;
    END IF;

    -- Se WhatsApp estiver desativado, não enfileirar
    IF v_whatsapp_ativo IS FALSE THEN
        RAISE NOTICE '[Cashback Trigger] Loja % tem WhatsApp desativado, não enfileirando transação %', v_store_id, NEW.id;
        RETURN NEW;
    END IF;

    -- Se Cashback estiver desativado, não enfileirar
    IF v_cashback_ativo IS FALSE THEN
        RAISE NOTICE '[Cashback Trigger] Loja % tem Cashback desativado, não enfileirando transação %', v_store_id, NEW.id;
        RETURN NEW;
    END IF;

    -- Verificar se cliente tem telefone ANTES de chamar enqueue
    SELECT telefone, nome INTO v_cliente_telefone, v_cliente_nome
    FROM sistemaretiradas.crm_contacts
    WHERE id = NEW.cliente_id;

    IF v_cliente_telefone IS NULL OR v_cliente_telefone = '' THEN
        SELECT telefone, nome INTO v_cliente_telefone, v_cliente_nome
        FROM sistemaretiradas.tiny_contacts
        WHERE id = NEW.cliente_id;
    END IF;

    IF v_cliente_telefone IS NULL OR v_cliente_telefone = '' THEN
        RAISE NOTICE '[Cashback Trigger] Cliente % sem telefone, WhatsApp não enfileirado para transação %', NEW.cliente_id, NEW.id;
        RETURN NEW;
    END IF;

    -- Chamar a função de enqueue (que busca os dados do cliente internamente)
    BEGIN
        PERFORM sistemaretiradas.enqueue_cashback_whatsapp(
            NEW.id,           -- transaction_id
            NEW.cliente_id,   -- cliente_id
            v_store_id        -- store_id
        );
        RAISE NOTICE '[Cashback Trigger] ✅ WhatsApp enfileirado com sucesso para transação % (cliente: %, loja: %)', NEW.id, NEW.cliente_id, v_store_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[Cashback Trigger] ❌ Erro ao enfileirar WhatsApp para transação %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$;

-- Criar trigger
CREATE TRIGGER trg_after_cashback_created
    AFTER INSERT ON sistemaretiradas.cashback_transactions
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.fn_after_cashback_created();

-- ============================================================================
-- PARTE 2: Função para Reprocessar Transações Antigas
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.reprocessar_cashback_fila(
    p_dias_retroativos INTEGER DEFAULT 7,
    p_limite INTEGER DEFAULT 100
)
RETURNS TABLE(
    transaction_id UUID,
    status TEXT,
    motivo TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction RECORD;
    v_count INTEGER := 0;
    v_store_id UUID;
    v_whatsapp_ativo BOOLEAN;
    v_cashback_ativo BOOLEAN;
    v_cliente_telefone TEXT;
    v_cliente_nome TEXT;
BEGIN
    -- Buscar transações EARNED que não estão na fila
    FOR v_transaction IN
        SELECT ct.id, ct.cliente_id, ct.store_id, ct.amount, ct.created_at
        FROM sistemaretiradas.cashback_transactions ct
        WHERE ct.transaction_type = 'EARNED'
            AND ct.created_at >= CURRENT_DATE - (p_dias_retroativos || ' days')::INTERVAL
            AND NOT EXISTS (
                SELECT 1 
                FROM sistemaretiradas.cashback_whatsapp_queue cwq
                WHERE cwq.transaction_id = ct.id
            )
            AND ct.cliente_id IS NOT NULL
        ORDER BY ct.created_at DESC
        LIMIT p_limite
    LOOP
        v_count := v_count + 1;
        
        -- Obter store_id
        v_store_id := v_transaction.store_id;
        
        IF v_store_id IS NULL THEN
            SELECT store_id INTO v_store_id
            FROM sistemaretiradas.crm_contacts
            WHERE id = v_transaction.cliente_id;
            
            IF v_store_id IS NULL THEN
                SELECT store_id INTO v_store_id
                FROM sistemaretiradas.tiny_contacts
                WHERE id = v_transaction.cliente_id;
            END IF;
        END IF;
        
        -- Verificar condições
        IF v_store_id IS NULL THEN
            transaction_id := v_transaction.id;
            status := 'SKIPPED';
            motivo := 'Sem store_id';
            RETURN NEXT;
            CONTINUE;
        END IF;
        
        -- Verificar configurações da loja
        SELECT whatsapp_ativo, cashback_ativo 
        INTO v_whatsapp_ativo, v_cashback_ativo
        FROM sistemaretiradas.stores
        WHERE id = v_store_id;
        
        IF v_whatsapp_ativo IS FALSE THEN
            transaction_id := v_transaction.id;
            status := 'SKIPPED';
            motivo := 'WhatsApp desativado na loja';
            RETURN NEXT;
            CONTINUE;
        END IF;
        
        IF v_cashback_ativo IS FALSE THEN
            transaction_id := v_transaction.id;
            status := 'SKIPPED';
            motivo := 'Cashback desativado na loja';
            RETURN NEXT;
            CONTINUE;
        END IF;
        
        -- Verificar telefone do cliente
        SELECT telefone, nome INTO v_cliente_telefone, v_cliente_nome
        FROM sistemaretiradas.crm_contacts
        WHERE id = v_transaction.cliente_id;
        
        IF v_cliente_telefone IS NULL OR v_cliente_telefone = '' THEN
            SELECT telefone, nome INTO v_cliente_telefone, v_cliente_nome
            FROM sistemaretiradas.tiny_contacts
            WHERE id = v_transaction.cliente_id;
        END IF;
        
        IF v_cliente_telefone IS NULL OR v_cliente_telefone = '' THEN
            transaction_id := v_transaction.id;
            status := 'SKIPPED';
            motivo := 'Cliente sem telefone';
            RETURN NEXT;
            CONTINUE;
        END IF;
        
        -- Tentar enfileirar
        BEGIN
            PERFORM sistemaretiradas.enqueue_cashback_whatsapp(
                v_transaction.id,
                v_transaction.cliente_id,
                v_store_id
            );
            
            transaction_id := v_transaction.id;
            status := 'ENQUEUED';
            motivo := 'Adicionado à fila com sucesso';
            RETURN NEXT;
        EXCEPTION WHEN OTHERS THEN
            transaction_id := v_transaction.id;
            status := 'ERROR';
            motivo := 'Erro: ' || SQLERRM;
            RETURN NEXT;
        END;
    END LOOP;
    
    RETURN;
END;
$$;

-- ============================================================================
-- PARTE 3: Executar Reprocessamento (comentado - executar manualmente se necessário)
-- ============================================================================

-- Descomente para reprocessar transações dos últimos 7 dias (máximo 100)
/*
SELECT * FROM sistemaretiradas.reprocessar_cashback_fila(7, 100);
*/

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
DECLARE
    v_trigger_exists BOOLEAN;
    v_trigger_enabled CHAR;
BEGIN
    -- Verificar se trigger existe e está ativo
    SELECT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'trg_after_cashback_created'
            AND tgrelid = 'sistemaretiradas.cashback_transactions'::regclass
    ) INTO v_trigger_exists;
    
    IF v_trigger_exists THEN
        SELECT tgenabled INTO v_trigger_enabled
        FROM pg_trigger
        WHERE tgname = 'trg_after_cashback_created'
            AND tgrelid = 'sistemaretiradas.cashback_transactions'::regclass;
        
        RAISE NOTICE '============================================================';
        RAISE NOTICE 'VERIFICAÇÃO DO TRIGGER';
        RAISE NOTICE '============================================================';
        RAISE NOTICE 'Trigger existe: %', v_trigger_exists;
        RAISE NOTICE 'Trigger habilitado: % (O=Ativo, D=Desabilitado)', v_trigger_enabled;
        RAISE NOTICE '============================================================';
    ELSE
        RAISE WARNING '❌ Trigger trg_after_cashback_created NÃO EXISTE!';
    END IF;
END $$;

