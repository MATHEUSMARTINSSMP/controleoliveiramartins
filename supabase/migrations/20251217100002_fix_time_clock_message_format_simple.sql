-- =====================================================
-- CORREÇÃO: FORMATO DA MENSAGEM DE PONTO E TIMEZONE
-- 
-- Problemas:
-- 1. Formato feio com muitos emojis e linhas
-- 2. Timezone com dupla conversão (UTC AT TIME ZONE 'America/Belem')
--
-- Solução:
-- 1. Voltar ao formato limpo e simples
-- 2. Converter timezone apenas uma vez
-- =====================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.send_time_clock_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_store RECORD;
    v_colaboradora RECORD;
    v_config RECORD;
    v_message TEXT;
    v_tipo_label TEXT;
    v_horario_formatado TEXT;
    v_phone TEXT;
    v_normalized_phone TEXT;
    v_phones_sent TEXT[] := '{}';
    v_raw_phone TEXT;
BEGIN
    RAISE NOTICE '[send_time_clock_notification] Iniciando para registro: %', NEW.id;
    
    -- Buscar dados da loja
    SELECT s.* INTO v_store
    FROM sistemaretiradas.stores s
    WHERE s.id = NEW.store_id;
    
    IF NOT FOUND THEN
        RAISE WARNING '[send_time_clock_notification] Loja nao encontrada: %', NEW.store_id;
        RETURN NEW;
    END IF;
    
    -- Buscar dados da colaboradora
    SELECT p.* INTO v_colaboradora
    FROM sistemaretiradas.profiles p
    WHERE p.id = NEW.colaboradora_id;
    
    IF NOT FOUND THEN
        RAISE WARNING '[send_time_clock_notification] Colaboradora nao encontrada: %', NEW.colaboradora_id;
        RETURN NEW;
    END IF;
    
    -- Buscar configuração de notificação da loja
    SELECT * INTO v_config
    FROM sistemaretiradas.time_clock_notification_config
    WHERE store_id = NEW.store_id
    AND notifications_enabled = true;
    
    IF NOT FOUND THEN
        RAISE NOTICE '[send_time_clock_notification] Notificacoes desabilitadas para loja: %', v_store.name;
        RETURN NEW;
    END IF;
    
    -- Verificar se há destinatários
    IF v_config.recipient_phones IS NULL OR array_length(v_config.recipient_phones, 1) IS NULL THEN
        RAISE NOTICE '[send_time_clock_notification] Nenhum destinatario configurado para loja: %', v_store.name;
        RETURN NEW;
    END IF;
    
    -- Verificar tipo de notificação habilitada
    IF NEW.tipo_registro IN ('ENTRADA', 'ENTRADA_INTERVALO') AND NOT COALESCE(v_config.notify_clock_in, true) THEN
        RAISE NOTICE '[send_time_clock_notification] Notificacao de entrada desabilitada';
        RETURN NEW;
    END IF;
    
    IF NEW.tipo_registro IN ('SAIDA', 'SAIDA_INTERVALO') AND NOT COALESCE(v_config.notify_clock_out, true) THEN
        RAISE NOTICE '[send_time_clock_notification] Notificacao de saida desabilitada';
        RETURN NEW;
    END IF;
    
    -- Formatar tipo de registro
    v_tipo_label := CASE NEW.tipo_registro
        WHEN 'ENTRADA' THEN 'Entrada'
        WHEN 'SAIDA_INTERVALO' THEN 'Saída para Intervalo'
        WHEN 'ENTRADA_INTERVALO' THEN 'Retorno do Intervalo'
        WHEN 'SAIDA' THEN 'Saída'
        ELSE NEW.tipo_registro
    END;
    
    -- CORRIGIDO: Converter timezone apenas uma vez para Belém (UTC-3)
    -- NEW.horario já é TIMESTAMP WITH TIME ZONE, só precisa converter direto
    v_horario_formatado := TO_CHAR(NEW.horario AT TIME ZONE 'America/Belem', 'DD/MM/YYYY às HH24:MI');
    
    -- FORMATO SIMPLES E LIMPO (como era antes)
    v_message := '🕐 *Registro de Ponto*' || CHR(10) || CHR(10);
    v_message := v_message || '*Colaboradora:* ' || TRIM(v_colaboradora.name) || CHR(10);
    v_message := v_message || '*Loja:* ' || v_store.name || CHR(10);
    v_message := v_message || '*Tipo:* ' || v_tipo_label || CHR(10);
    v_message := v_message || '*Horário:* ' || v_horario_formatado || CHR(10);
    
    IF NEW.observacao IS NOT NULL AND NEW.observacao != '' THEN
        v_message := v_message || '*Observação:* ' || NEW.observacao || CHR(10);
    END IF;
    
    v_message := v_message || CHR(10) || 'Sistema EleveaOne 📊';
    
    RAISE NOTICE '[send_time_clock_notification] Destinatarios configurados: %', v_config.recipient_phones;
    
    -- Iterar sobre telefones do array, normalizando para evitar duplicatas
    FOREACH v_raw_phone IN ARRAY v_config.recipient_phones
    LOOP
        -- Normalizar telefone (remover código 55 se duplicado)
        v_normalized_phone := sistemaretiradas.normalize_brazilian_phone(v_raw_phone);
        
        -- Verificar se já enviamos para este número normalizado
        IF v_normalized_phone = ANY(v_phones_sent) THEN
            RAISE NOTICE '[send_time_clock_notification] Telefone % ja processado, pulando...', v_raw_phone;
            CONTINUE;
        END IF;
        
        -- Adicionar à lista de enviados
        v_phones_sent := array_append(v_phones_sent, v_normalized_phone);
        
        -- Usar o telefone original para envio
        v_phone := v_raw_phone;
        
        IF v_phone IS NULL OR v_phone = '' THEN
            CONTINUE;
        END IF;
        
        -- Verificar se já existe na fila para este registro
        IF EXISTS (
            SELECT 1 FROM sistemaretiradas.time_clock_notification_queue
            WHERE time_clock_record_id = NEW.id
            AND sistemaretiradas.normalize_brazilian_phone(phone) = v_normalized_phone
            AND status IN ('PENDING', 'SENT')
        ) THEN
            RAISE NOTICE '[send_time_clock_notification] Notificacao ja existe para % e registro %', v_phone, NEW.id;
            CONTINUE;
        END IF;
        
        -- Inserir na fila
        BEGIN
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
            
            RAISE NOTICE '[send_time_clock_notification] Adicionado a fila: %', v_phone;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[send_time_clock_notification] Erro ao inserir: %', SQLERRM;
        END;
    END LOOP;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.send_time_clock_notification() IS 
'Trigger de notificacao de ponto - v4.0: Formato simples e limpo, timezone corrigido (America/Belem)';
