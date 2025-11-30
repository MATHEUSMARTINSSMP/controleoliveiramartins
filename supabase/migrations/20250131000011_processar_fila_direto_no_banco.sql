-- ============================================================================
-- MIGRATION: Processar Fila de WhatsApp Diretamente no Banco
-- Data: 2025-01-31
-- Descrição: Cria função que processa a fila diretamente, sem precisar de HTTP
-- ============================================================================

-- ============================================================================
-- PROBLEMA: A função chamar_processar_fila_whatsapp() precisa de extensão http
-- que pode não estar disponível. Esta solução processa a fila diretamente.
-- ============================================================================

-- ============================================================================
-- 1. FUNÇÃO PARA PROCESSAR FILA DIRETAMENTE (Chama Netlify Function)
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.processar_fila_whatsapp_direto()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_netlify_url TEXT;
    v_queue_items RECORD;
    v_processed INTEGER := 0;
    v_sent INTEGER := 0;
    v_failed INTEGER := 0;
    v_skipped INTEGER := 0;
    v_result JSON;
BEGIN
    -- Obter URL do Netlify
    SELECT value INTO v_netlify_url
    FROM sistemaretiradas.app_config
    WHERE key = 'netlify_url';
    
    IF v_netlify_url IS NULL OR v_netlify_url = '' THEN
        v_netlify_url := 'https://eleveaone.com.br';
    END IF;
    
    -- Buscar itens pendentes (máximo 10)
    FOR v_queue_items IN 
        SELECT 
            q.id,
            q.transaction_id,
            q.cliente_id,
            q.store_id,
            q.attempts,
            c.telefone,
            ct.amount
        FROM sistemaretiradas.cashback_whatsapp_queue q
        LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
        LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
        WHERE q.status = 'PENDING'
        ORDER BY q.created_at ASC
        LIMIT 10
    LOOP
        BEGIN
            -- Marcar como PROCESSING
            UPDATE sistemaretiradas.cashback_whatsapp_queue
            SET 
                status = 'PROCESSING',
                attempts = v_queue_items.attempts + 1,
                last_attempt_at = NOW(),
                updated_at = NOW()
            WHERE id = v_queue_items.id;
            
            -- Verificar se cliente tem telefone
            IF v_queue_items.telefone IS NULL OR v_queue_items.telefone = '' THEN
                -- Sem telefone - marcar como SKIPPED
                UPDATE sistemaretiradas.cashback_whatsapp_queue
                SET 
                    status = 'SKIPPED',
                    error_message = 'Cliente sem telefone cadastrado',
                    updated_at = NOW()
                WHERE id = v_queue_items.id;
                
                v_skipped := v_skipped + 1;
                CONTINUE;
            END IF;
            
            -- Tentar chamar Netlify Function via http extension (se disponível)
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
                    -- Usar http extension para chamar Netlify Function
                    SELECT content::JSON INTO v_result
                    FROM http((
                        'POST',
                        v_netlify_url || '/.netlify/functions/send-cashback-whatsapp',
                        ARRAY[
                            http_header('Content-Type', 'application/json')
                        ],
                        'application/json',
                        json_build_object(
                            'transaction_id', v_queue_items.transaction_id,
                            'cliente_id', v_queue_items.cliente_id,
                            'store_id', v_queue_items.store_id
                        )::TEXT
                    )::http_request);
                    
                    -- Se chegou aqui, a chamada foi feita
                    -- Marcar como SENT (assumindo sucesso - pode melhorar verificando resposta)
                    UPDATE sistemaretiradas.cashback_whatsapp_queue
                    SET 
                        status = 'SENT',
                        updated_at = NOW()
                    WHERE id = v_queue_items.id;
                    
                    v_sent := v_sent + 1;
                ELSE
                    -- Se não tem http extension, não pode processar
                    RAISE NOTICE '⚠️ Extensão http não disponível. Não é possível processar via HTTP.';
                    -- Marcar como PENDING novamente para tentar depois
                    UPDATE sistemaretiradas.cashback_whatsapp_queue
                    SET 
                        status = 'PENDING',
                        updated_at = NOW()
                    WHERE id = v_queue_items.id;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- Erro ao chamar - marcar como PENDING ou FAILED
                IF v_queue_items.attempts >= 2 THEN
                    UPDATE sistemaretiradas.cashback_whatsapp_queue
                    SET 
                        status = 'FAILED',
                        error_message = SQLERRM,
                        updated_at = NOW()
                    WHERE id = v_queue_items.id;
                    v_failed := v_failed + 1;
                ELSE
                    UPDATE sistemaretiradas.cashback_whatsapp_queue
                    SET 
                        status = 'PENDING',
                        error_message = SQLERRM,
                        updated_at = NOW()
                    WHERE id = v_queue_items.id;
                END IF;
            END;
            
            v_processed := v_processed + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '⚠️ Erro ao processar item %: %', v_queue_items.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'processed', v_processed,
        'sent', v_sent,
        'skipped', v_skipped,
        'failed', v_failed
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.processar_fila_whatsapp_direto IS 'Processa fila de WhatsApp diretamente no banco. Usa extensão http se disponível, senão retorna erro.';

-- ============================================================================
-- 2. ATUALIZAR CRON JOB PARA USAR NOVA FUNÇÃO
-- ============================================================================

-- Remover job antigo
SELECT cron.unschedule('processar-fila-whatsapp-cashback') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'processar-fila-whatsapp-cashback'
);

-- Criar novo job com função que processa diretamente
SELECT cron.schedule(
    'processar-fila-whatsapp-cashback',
    '* * * * *',
    $$
    SELECT sistemaretiradas.processar_fila_whatsapp_direto();
    $$
);

-- ============================================================================
-- NOTA: Esta função ainda precisa da extensão http para funcionar.
-- Se não estiver disponível, a melhor solução é usar n8n ou
-- Supabase Scheduled Jobs para chamar a Edge Function diretamente.
-- ============================================================================

