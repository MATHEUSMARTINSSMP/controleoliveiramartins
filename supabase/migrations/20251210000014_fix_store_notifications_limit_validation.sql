-- =====================================================
-- CORREÇÃO: Validação de limite POR DIA DA SEMANA
-- =====================================================
-- O limite é de 10 mensagens POR DIA DA SEMANA, não no total
-- Esta função valida cada dia separadamente

CREATE OR REPLACE FUNCTION sistemaretiradas.validate_store_notification_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_dia_semana INTEGER;
    v_mensagens_neste_dia INTEGER;
    v_mensagens_novo_alerta INTEGER;
    v_total_neste_dia INTEGER;
    v_nome_dia TEXT;
    v_recipients_count INTEGER;
    v_horarios_count INTEGER;
BEGIN
    -- Se o alerta não está ativo, não precisa validar
    IF NOT NEW.ativo THEN
        RETURN NEW;
    END IF;
    
    -- Contar horários do novo alerta
    v_horarios_count := array_length(NEW.horarios, 1);
    IF v_horarios_count IS NULL OR v_horarios_count = 0 THEN
        RETURN NEW;
    END IF;
    
    -- Contar recipients ativos do novo alerta
    -- CRÍTICO: No INSERT, o notification_id ainda não existe, então precisamos contar depois
    -- No UPDATE, podemos contar agora
    IF TG_OP = 'UPDATE' THEN
        SELECT COUNT(*) INTO v_recipients_count
        FROM sistemaretiradas.store_notification_recipients
        WHERE notification_id = NEW.id
        AND ativo = true
        AND phone IS NOT NULL
        AND phone != '';
        
        -- Se não tem recipients, não precisa validar
        IF v_recipients_count = 0 THEN
            RETURN NEW;
        END IF;
    ELSE
        -- No INSERT, não podemos contar recipients ainda (serão inseridos depois)
        -- A validação será feita por um trigger nos recipients após inserção
        -- Por enquanto, vamos pular a validação no INSERT da notificação
        RETURN NEW;
    END IF;
    
    -- Mensagens que o novo alerta adicionará por dia
    v_mensagens_novo_alerta := v_horarios_count * v_recipients_count;
    
    -- Verificar cada dia da semana que o novo alerta inclui
    FOR v_dia_semana IN SELECT unnest(NEW.dias_semana)
    LOOP
        -- Calcular mensagens atuais neste dia específico (excluindo o alerta sendo editado)
        SELECT COALESCE(SUM(
            array_length(sn.horarios, 1) * 
            (SELECT COUNT(*) 
             FROM sistemaretiradas.store_notification_recipients snr
             WHERE snr.notification_id = sn.id
             AND snr.ativo = true
             AND snr.phone IS NOT NULL
             AND snr.phone != '')
        ), 0) INTO v_mensagens_neste_dia
        FROM sistemaretiradas.store_notifications sn
        WHERE sn.store_id = NEW.store_id
        AND sn.ativo = true
        AND v_dia_semana = ANY(sn.dias_semana)
        -- CRÍTICO: Excluir o alerta sendo editado (se estiver editando)
        AND (TG_OP = 'INSERT' OR sn.id != NEW.id);
        
        -- Total neste dia após adicionar/atualizar
        v_total_neste_dia := v_mensagens_neste_dia + v_mensagens_novo_alerta;
        
        -- Nome do dia para mensagem de erro
        v_nome_dia := CASE v_dia_semana
            WHEN 0 THEN 'Domingo'
            WHEN 1 THEN 'Segunda'
            WHEN 2 THEN 'Terça'
            WHEN 3 THEN 'Quarta'
            WHEN 4 THEN 'Quinta'
            WHEN 5 THEN 'Sexta'
            WHEN 6 THEN 'Sábado'
            ELSE 'Dia ' || v_dia_semana::TEXT
        END;
        
        -- Validar limite de 10 mensagens por dia
        IF v_total_neste_dia > 10 THEN
            RAISE EXCEPTION 'Limite de 10 mensagens por dia ultrapassado na %. Mensagens atuais: %, tentando adicionar: % (total: %)',
                v_nome_dia, v_mensagens_neste_dia, v_mensagens_novo_alerta, v_total_neste_dia;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_validate_store_notification_limit ON sistemaretiradas.store_notifications;

-- Criar trigger para validar antes de INSERT ou UPDATE
CREATE TRIGGER trigger_validate_store_notification_limit
    BEFORE INSERT OR UPDATE ON sistemaretiradas.store_notifications
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.validate_store_notification_limit();

COMMENT ON FUNCTION sistemaretiradas.validate_store_notification_limit() IS 'Valida limite de 10 mensagens POR DIA DA SEMANA, não no total';

-- =====================================================
-- TRIGGER NOS RECIPIENTS PARA VALIDAR APÓS INSERÇÃO
-- =====================================================
-- Quando recipients são inseridos/atualizados, valida o limite

CREATE OR REPLACE FUNCTION sistemaretiradas.validate_store_notification_limit_after_recipient_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_notification RECORD;
    v_dia_semana INTEGER;
    v_mensagens_neste_dia INTEGER;
    v_mensagens_novo_alerta INTEGER;
    v_total_neste_dia INTEGER;
    v_nome_dia TEXT;
    v_recipients_count INTEGER;
    v_horarios_count INTEGER;
BEGIN
    -- Buscar dados da notificação
    SELECT * INTO v_notification
    FROM sistemaretiradas.store_notifications
    WHERE id = COALESCE(NEW.notification_id, OLD.notification_id);
    
    -- Se a notificação não está ativa, não precisa validar
    IF NOT v_notification.ativo THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Contar horários da notificação
    v_horarios_count := array_length(v_notification.horarios, 1);
    IF v_horarios_count IS NULL OR v_horarios_count = 0 THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Contar recipients ativos desta notificação
    SELECT COUNT(*) INTO v_recipients_count
    FROM sistemaretiradas.store_notification_recipients
    WHERE notification_id = v_notification.id
    AND ativo = true
    AND phone IS NOT NULL
    AND phone != '';
    
    -- Se não tem recipients, não precisa validar
    IF v_recipients_count = 0 THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Mensagens que esta notificação adiciona por dia
    v_mensagens_novo_alerta := v_horarios_count * v_recipients_count;
    
    -- Verificar cada dia da semana que a notificação inclui
    FOR v_dia_semana IN SELECT unnest(v_notification.dias_semana)
    LOOP
        -- Calcular mensagens atuais neste dia específico (excluindo esta notificação)
        SELECT COALESCE(SUM(
            array_length(sn.horarios, 1) * 
            (SELECT COUNT(*) 
             FROM sistemaretiradas.store_notification_recipients snr
             WHERE snr.notification_id = sn.id
             AND snr.ativo = true
             AND snr.phone IS NOT NULL
             AND snr.phone != '')
        ), 0) INTO v_mensagens_neste_dia
        FROM sistemaretiradas.store_notifications sn
        WHERE sn.store_id = v_notification.store_id
        AND sn.ativo = true
        AND v_dia_semana = ANY(sn.dias_semana)
        AND sn.id != v_notification.id; -- Excluir esta notificação
        
        -- Total neste dia
        v_total_neste_dia := v_mensagens_neste_dia + v_mensagens_novo_alerta;
        
        -- Nome do dia para mensagem de erro
        v_nome_dia := CASE v_dia_semana
            WHEN 0 THEN 'Domingo'
            WHEN 1 THEN 'Segunda'
            WHEN 2 THEN 'Terça'
            WHEN 3 THEN 'Quarta'
            WHEN 4 THEN 'Quinta'
            WHEN 5 THEN 'Sexta'
            WHEN 6 THEN 'Sábado'
            ELSE 'Dia ' || v_dia_semana::TEXT
        END;
        
        -- Validar limite de 10 mensagens por dia
        IF v_total_neste_dia > 10 THEN
            RAISE EXCEPTION 'Limite de 10 mensagens por dia ultrapassado na %. Mensagens atuais: %, tentando adicionar: % (total: %)',
                v_nome_dia, v_mensagens_neste_dia, v_mensagens_novo_alerta, v_total_neste_dia;
        END IF;
    END LOOP;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_validate_store_notification_limit_after_recipient_change ON sistemaretiradas.store_notification_recipients;

-- Criar trigger para validar após INSERT ou UPDATE de recipients
CREATE TRIGGER trigger_validate_store_notification_limit_after_recipient_change
    AFTER INSERT OR UPDATE ON sistemaretiradas.store_notification_recipients
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.validate_store_notification_limit_after_recipient_change();

COMMENT ON FUNCTION sistemaretiradas.validate_store_notification_limit_after_recipient_change() IS 'Valida limite de 10 mensagens POR DIA DA SEMANA após inserir/atualizar recipients';

