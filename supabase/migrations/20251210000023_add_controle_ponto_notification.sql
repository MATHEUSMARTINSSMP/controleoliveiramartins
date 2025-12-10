-- =====================================================
-- ADICIONAR NOTIFICAÇÕES DE CONTROLE DE PONTO
-- =====================================================
-- Adiciona o tipo 'CONTROLE_PONTO' à constraint CHECK
-- e cria trigger para enviar WhatsApp a cada registro de ponto

-- 1. Adicionar tipo CONTROLE_PONTO à constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'whatsapp_notification_config_notification_type_check' 
        AND conrelid = 'sistemaretiradas.whatsapp_notification_config'::regclass
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_notification_config 
        DROP CONSTRAINT whatsapp_notification_config_notification_type_check;
        RAISE NOTICE '✅ Constraint antiga removida';
    END IF;
END $$;

-- 2. Criar nova constraint com o novo tipo
ALTER TABLE sistemaretiradas.whatsapp_notification_config
ADD CONSTRAINT whatsapp_notification_config_notification_type_check 
CHECK (notification_type IN ('VENDA', 'ADIANTAMENTO', 'PARABENS', 'AJUSTES_CONDICIONAIS', 'CONTROLE_PONTO'));

COMMENT ON CONSTRAINT whatsapp_notification_config_notification_type_check 
ON sistemaretiradas.whatsapp_notification_config IS 
'Permite os tipos: VENDA, ADIANTAMENTO, PARABENS, AJUSTES_CONDICIONAIS, CONTROLE_PONTO';

-- 3. Criar tabela de fila para notificações de ponto (se não existir)
CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time_clock_record_id UUID NOT NULL REFERENCES sistemaretiradas.time_clock_records(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_time_clock_notification_queue_status ON sistemaretiradas.time_clock_notification_queue(status) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_time_clock_notification_queue_created_at ON sistemaretiradas.time_clock_notification_queue(created_at);

-- 4. Criar função para enviar notificação de controle de ponto (insere na fila)
CREATE OR REPLACE FUNCTION sistemaretiradas.send_time_clock_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store RECORD;
    v_colaboradora RECORD;
    v_admin_id UUID;
    v_notification_configs RECORD;
    v_message TEXT;
    v_tipo_label TEXT;
    v_horario_formatado TEXT;
    v_phone TEXT;
BEGIN
    -- Buscar dados da loja e colaboradora
    SELECT s.*, s.admin_id INTO v_store
    FROM sistemaretiradas.stores s
    WHERE s.id = NEW.store_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE '⚠️ Loja não encontrada para store_id: %', NEW.store_id;
        RETURN NEW;
    END IF;
    
    SELECT p.* INTO v_colaboradora
    FROM sistemaretiradas.profiles p
    WHERE p.id = NEW.colaboradora_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE '⚠️ Colaboradora não encontrada para colaboradora_id: %', NEW.colaboradora_id;
        RETURN NEW;
    END IF;
    
    v_admin_id := v_store.admin_id;
    
    -- Formatar tipo de registro
    v_tipo_label := CASE NEW.tipo_registro
        WHEN 'ENTRADA' THEN 'Entrada'
        WHEN 'SAIDA_INTERVALO' THEN 'Saída para Intervalo'
        WHEN 'ENTRADA_INTERVALO' THEN 'Retorno do Intervalo'
        WHEN 'SAIDA' THEN 'Saída'
        ELSE NEW.tipo_registro
    END;
    
    -- Formatar horário
    v_horario_formatado := TO_CHAR(NEW.horario AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
    
    -- Montar mensagem
    v_message := '🕐 *Registro de Ponto*\n\n';
    v_message := v_message || '*Colaboradora:* ' || v_colaboradora.name || '\n';
    v_message := v_message || '*Loja:* ' || v_store.name || '\n';
    v_message := v_message || '*Tipo:* ' || v_tipo_label || '\n';
    v_message := v_message || '*Horário:* ' || v_horario_formatado || '\n';
    
    IF NEW.observacao IS NOT NULL AND NEW.observacao != '' THEN
        v_message := v_message || '*Observação:* ' || NEW.observacao || '\n';
    END IF;
    
    v_message := v_message || '\nSistema EleveaOne 📊';
    
    -- Buscar configurações de notificação para esta loja e admin
    FOR v_notification_configs IN
        SELECT DISTINCT phone
        FROM sistemaretiradas.whatsapp_notification_config
        WHERE admin_id = v_admin_id
        AND notification_type = 'CONTROLE_PONTO'
        AND active = true
        AND (store_id = NEW.store_id OR store_id IS NULL)
    LOOP
        v_phone := v_notification_configs.phone;
        
        -- Inserir na fila para processamento
        INSERT INTO sistemaretiradas.time_clock_notification_queue (
            time_clock_record_id,
            store_id,
            phone,
            message,
            status
        ) VALUES (
            NEW.id,
            NEW.store_id,
            v_phone,
            v_message,
            'PENDING'
        );
        
        RAISE NOTICE '✅ Notificação de ponto adicionada à fila para % (loja: %)', v_phone, NEW.store_id;
    END LOOP;
    
    RETURN NEW;
END;
$$;

-- 5. Criar trigger para enviar notificação após INSERT de registro de ponto
DROP TRIGGER IF EXISTS trigger_send_time_clock_notification ON sistemaretiradas.time_clock_records;
CREATE TRIGGER trigger_send_time_clock_notification
    AFTER INSERT ON sistemaretiradas.time_clock_records
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.send_time_clock_notification();

-- 6. Criar função para processar fila de notificações de ponto
CREATE OR REPLACE FUNCTION sistemaretiradas.process_time_clock_notification_queue()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_queue_item RECORD;
    v_netlify_url TEXT;
    v_response JSONB;
    v_sent_count INTEGER := 0;
    v_failed_count INTEGER := 0;
BEGIN
    -- Obter URL do Netlify
    SELECT value INTO v_netlify_url
    FROM sistemaretiradas.app_config
    WHERE key = 'netlify_url'
    LIMIT 1;
    
    IF v_netlify_url IS NULL OR v_netlify_url = '' THEN
        v_netlify_url := 'https://eleveaone.com.br';
    END IF;
    
    -- Processar até 50 itens pendentes por vez
    FOR v_queue_item IN
        SELECT *
        FROM sistemaretiradas.time_clock_notification_queue
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        LIMIT 50
    LOOP
        BEGIN
            -- Tentar enviar via pg_net se disponível
            IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
                SELECT content::JSONB INTO v_response
                FROM net.http_post(
                    url := v_netlify_url || '/.netlify/functions/send-whatsapp-message',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json'
                    ),
                    body := jsonb_build_object(
                        'phone', v_queue_item.phone,
                        'message', v_queue_item.message,
                        'store_id', v_queue_item.store_id::TEXT
                    )
                );
                
                -- Atualizar status
                UPDATE sistemaretiradas.time_clock_notification_queue
                SET status = 'SENT',
                    sent_at = NOW(),
                    attempts = attempts + 1
                WHERE id = v_queue_item.id;
                
                v_sent_count := v_sent_count + 1;
            ELSE
                -- Se não tem pg_net, marcar como falha
                UPDATE sistemaretiradas.time_clock_notification_queue
                SET status = 'FAILED',
                    error_message = 'pg_net não disponível',
                    attempts = attempts + 1
                WHERE id = v_queue_item.id;
                
                v_failed_count := v_failed_count + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Em caso de erro, marcar como falha
            UPDATE sistemaretiradas.time_clock_notification_queue
            SET status = 'FAILED',
                error_message = SQLERRM,
                attempts = attempts + 1
            WHERE id = v_queue_item.id;
            
            v_failed_count := v_failed_count + 1;
        END;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'sent', v_sent_count,
        'failed', v_failed_count,
        'total_processed', v_sent_count + v_failed_count
    );
END;
$$;

-- 7. Conceder permissões
GRANT EXECUTE ON FUNCTION sistemaretiradas.process_time_clock_notification_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.process_time_clock_notification_queue() TO anon;

COMMENT ON FUNCTION sistemaretiradas.send_time_clock_notification() IS 'Adiciona notificação de ponto à fila quando há registro de ponto (entrada, saída, intervalos)';
COMMENT ON FUNCTION sistemaretiradas.process_time_clock_notification_queue() IS 'Processa fila de notificações de ponto e envia via WhatsApp';
COMMENT ON TRIGGER trigger_send_time_clock_notification ON sistemaretiradas.time_clock_records IS 'Trigger que adiciona notificação à fila após cada registro de ponto';
COMMENT ON TABLE sistemaretiradas.time_clock_notification_queue IS 'Fila de notificações de controle de ponto aguardando envio via WhatsApp';

