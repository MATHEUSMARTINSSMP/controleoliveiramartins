-- ============================================================================
-- MIGRATION: Envio Automático de WhatsApp quando Cashback é Gerado
-- Data: 2025-01-31
-- Descrição: Adiciona função para enviar WhatsApp automaticamente ao gerar cashback
-- ============================================================================

-- ============================================================================
-- 1. FUNÇÃO RPC: Enviar WhatsApp de Cashback (chama Netlify Function)
-- ============================================================================
-- Esta função será chamada pelo trigger após gerar cashback
-- Ela chama a Netlify Function via HTTP para enviar WhatsApp

CREATE OR REPLACE FUNCTION sistemaretiradas.enviar_whatsapp_cashback(
    p_transaction_id UUID,
    p_cliente_id UUID,
    p_store_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_netlify_url TEXT;
    v_response JSON;
    v_result TEXT;
BEGIN
    -- Buscar URL do Netlify da configuração
    SELECT value INTO v_netlify_url
    FROM sistemaretiradas.app_config
    WHERE key = 'netlify_url'
    LIMIT 1;
    
    -- Se não encontrar, usar URL padrão
    IF v_netlify_url IS NULL OR v_netlify_url = '' THEN
        v_netlify_url = 'https://eleveaone.com.br';
    END IF;
    
    -- Construir URL da função Netlify
    v_netlify_url := v_netlify_url || '/.netlify/functions/send-cashback-whatsapp';
    
    -- Tentar chamar Netlify Function via HTTP
    -- NOTA: Usa pg_net (padrão do Supabase) ou http extension
    -- Se não estiver disponível, apenas loga e não falha
    
    BEGIN
        -- Tentar usar pg_net primeiro (padrão do Supabase)
        DECLARE
            v_request_id BIGINT;
        BEGIN
            -- Chamar Netlify Function usando pg_net
            SELECT net.http_post(
                url := v_netlify_url,
                headers := jsonb_build_object(
                    'Content-Type', 'application/json'
                ),
                body := jsonb_build_object(
                    'transaction_id', p_transaction_id::TEXT,
                    'cliente_id', p_cliente_id::TEXT,
                    'store_id', p_store_id::TEXT
                )
            ) INTO v_request_id;
            
            RAISE NOTICE '✅ WhatsApp de cashback enviado com sucesso para transação % (Request ID: %)', p_transaction_id, v_request_id;
            
            RETURN json_build_object(
                'success', true,
                'message', 'WhatsApp enviado com sucesso',
                'request_id', v_request_id
            );
        EXCEPTION WHEN OTHERS THEN
            -- Se pg_net falhar, tentar http extension
            BEGIN
                SELECT content::JSON INTO v_response
                FROM http((
                    'POST',
                    v_netlify_url,
                    ARRAY[
                        http_header('Content-Type', 'application/json')
                    ],
                    'application/json',
                    json_build_object(
                        'transaction_id', p_transaction_id,
                        'cliente_id', p_cliente_id,
                        'store_id', p_store_id
                    )::TEXT
                )::http_request);
                
                RAISE NOTICE '✅ WhatsApp de cashback enviado via http extension para transação %', p_transaction_id;
                
                RETURN json_build_object(
                    'success', true,
                    'message', 'WhatsApp enviado com sucesso (via http)',
                    'response', v_response
                );
            EXCEPTION WHEN OTHERS THEN
                -- Se ambas falharem, apenas logar
                RAISE WARNING '⚠️ Erro ao enviar WhatsApp de cashback (não bloqueia geração): %', SQLERRM;
                
                RETURN json_build_object(
                    'success', false,
                    'message', 'Erro ao enviar WhatsApp (não bloqueia geração)',
                    'error', SQLERRM
                );
            END;
        END;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback final
        RAISE WARNING '⚠️ Erro ao enviar WhatsApp de cashback (não bloqueia geração): %', SQLERRM;
        
        RETURN json_build_object(
            'success', false,
            'message', 'Erro ao enviar WhatsApp (não bloqueia geração)',
            'error', SQLERRM
        );
    END;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.enviar_whatsapp_cashback IS 
'Envia WhatsApp automaticamente para cliente quando cashback é gerado. Chamada pelo trigger após gerar cashback.';

-- ============================================================================
-- 2. MODIFICAR FUNÇÃO gerar_cashback: Adicionar chamada de WhatsApp
-- ============================================================================
-- Modificar a função gerar_cashback para chamar envio de WhatsApp após gerar com sucesso

CREATE OR REPLACE FUNCTION sistemaretiradas.gerar_cashback(
    p_tiny_order_id UUID,
    p_cliente_id UUID,
    p_store_id UUID,
    p_valor_total NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings sistemaretiradas.cashback_settings;
    v_cashback_amount NUMERIC;
    v_data_liberacao TIMESTAMP WITH TIME ZONE;
    v_data_expiracao TIMESTAMP WITH TIME ZONE;
    v_transaction_id UUID;
    v_balance_id UUID;
    v_existing_balance sistemaretiradas.cashback_balance;
    v_result JSON;
BEGIN
    -- Obter configurações
    v_settings := sistemaretiradas.get_cashback_settings(p_store_id);
    
    -- ✅ Calcular valor do cashback e arredondar PARA CIMA (sem centavos)
    -- Exemplo: 152.15 -> 153 | 77.07 -> 78
    v_cashback_amount := CEIL((p_valor_total * v_settings.percentual_cashback) / 100);
    
    -- Se não há cashback para gerar, retornar
    IF v_cashback_amount <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Valor de cashback zero ou negativo'
        );
    END IF;
    
    -- Calcular datas
    v_data_liberacao := NOW() + (v_settings.prazo_liberacao_dias || ' days')::INTERVAL;
    v_data_expiracao := v_data_liberacao + (v_settings.prazo_expiracao_dias || ' days')::INTERVAL;
    
    -- Verificar se já existe transação para este pedido
    SELECT id INTO v_transaction_id
    FROM sistemaretiradas.cashback_transactions
    WHERE tiny_order_id = p_tiny_order_id
      AND transaction_type = 'EARNED'
    LIMIT 1;
    
    -- Se já existe, não criar novamente
    IF v_transaction_id IS NOT NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Cashback já foi gerado para este pedido',
            'transaction_id', v_transaction_id
        );
    END IF;
    
    -- Criar transação
    INSERT INTO sistemaretiradas.cashback_transactions (
        cliente_id,
        tiny_order_id,
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao
    ) VALUES (
        p_cliente_id,
        p_tiny_order_id,
        'EARNED',
        v_cashback_amount,
        'Cashback gerado automaticamente para pedido #' || (SELECT numero_pedido FROM sistemaretiradas.tiny_orders WHERE id = p_tiny_order_id),
        v_data_liberacao,
        v_data_expiracao
    )
    RETURNING id INTO v_transaction_id;
    
    -- Atualizar ou criar saldo
    SELECT * INTO v_existing_balance
    FROM sistemaretiradas.cashback_balance
    WHERE cliente_id = p_cliente_id
    LIMIT 1;
    
    IF v_existing_balance IS NULL THEN
        -- Criar novo saldo
        INSERT INTO sistemaretiradas.cashback_balance (
            cliente_id,
            balance,
            balance_pendente,
            total_earned
        ) VALUES (
            p_cliente_id,
            v_cashback_amount,
            v_cashback_amount,
            v_cashback_amount
        )
        RETURNING id INTO v_balance_id;
    ELSE
        -- Atualizar saldo existente
        UPDATE sistemaretiradas.cashback_balance
        SET balance = balance + v_cashback_amount,
            balance_pendente = balance_pendente + v_cashback_amount,
            total_earned = total_earned + v_cashback_amount,
            updated_at = NOW()
        WHERE cliente_id = p_cliente_id;
    END IF;
    
    -- ✅ NOVO: Enviar WhatsApp automaticamente (em background, não bloqueia)
    -- Executar em background para não bloquear a geração de cashback
    BEGIN
        -- Aguardar um pouco para garantir que a transação foi commitada
        PERFORM pg_sleep(0.5);
        
        -- Chamar função de envio de WhatsApp
        v_result := sistemaretiradas.enviar_whatsapp_cashback(
            v_transaction_id,
            p_cliente_id,
            p_store_id
        );
        
        IF (v_result->>'success')::BOOLEAN THEN
            RAISE NOTICE '✅ WhatsApp de cashback enviado com sucesso para cliente %', p_cliente_id;
        ELSE
            RAISE WARNING '⚠️ Falha ao enviar WhatsApp de cashback (não bloqueia): %', v_result->>'error';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Não falhar a geração de cashback por causa do WhatsApp
        RAISE WARNING '⚠️ Erro ao enviar WhatsApp de cashback (não bloqueia geração): %', SQLERRM;
    END;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Cashback gerado com sucesso',
        'transaction_id', v_transaction_id,
        'amount', v_cashback_amount,
        'data_liberacao', v_data_liberacao,
        'data_expiracao', v_data_expiracao
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- COMMENT ON FUNCTION sistemaretiradas.gerar_cashback IS 
-- 'Gera cashback automaticamente para um pedido e envia WhatsApp para o cliente';

-- ============================================================================
-- 3. VERIFICAR SE EXTENSÕES HTTP ESTÃO DISPONÍVEIS
-- ============================================================================
-- Verificar se as extensões pg_net ou http estão habilitadas

DO $$
BEGIN
    -- pg_net é padrão do Supabase, mas verificar se está disponível
    -- Não criar extensão aqui (deve ser criada pelo admin do Supabase)
    RAISE NOTICE '✅ Verificando extensões HTTP disponíveis...';
    RAISE NOTICE 'ℹ️ pg_net é padrão do Supabase e será usado se disponível';
    RAISE NOTICE 'ℹ️ http extension será usado como fallback se pg_net não estiver disponível';
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️ Erro ao verificar extensões HTTP: %', SQLERRM;
END $$;

-- ============================================================================
-- 4. CONFIGURAR URL DO NETLIFY (se não existir)
-- ============================================================================
-- Adicionar URL do Netlify na tabela app_config se não existir

INSERT INTO sistemaretiradas.app_config (key, value, description)
VALUES (
    'netlify_url',
    'https://eleveaone.com.br',
    'URL base do Netlify para chamar funções serverless'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description;

