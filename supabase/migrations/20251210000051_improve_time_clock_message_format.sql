-- =====================================================
-- MELHORAR FORMATAÇÃO DAS MENSAGENS DE NOTIFICAÇÃO DE PONTO
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
    v_admin_id UUID;
    v_notification_configs RECORD;
    v_message TEXT;
    v_tipo_label TEXT;
    v_horario_formatado TEXT;
    v_phone TEXT;
    v_config_count INTEGER := 0;
BEGIN
    -- Log inicial
    RAISE NOTICE '[send_time_clock_notification] 🔔 Iniciando notificação para registro: %', NEW.id;
    
    -- Buscar dados da loja e colaboradora
    SELECT s.*, s.admin_id INTO v_store
    FROM sistemaretiradas.stores s
    WHERE s.id = NEW.store_id;
    
    IF NOT FOUND THEN
        RAISE WARNING '[send_time_clock_notification] ⚠️ Loja não encontrada para store_id: %', NEW.store_id;
        RETURN NEW;
    END IF;
    
    RAISE NOTICE '[send_time_clock_notification] ✅ Loja encontrada: % (admin_id: %)', v_store.name, v_store.admin_id;
    
    SELECT p.* INTO v_colaboradora
    FROM sistemaretiradas.profiles p
    WHERE p.id = NEW.colaboradora_id;
    
    IF NOT FOUND THEN
        RAISE WARNING '[send_time_clock_notification] ⚠️ Colaboradora não encontrada para colaboradora_id: %', NEW.colaboradora_id;
        RETURN NEW;
    END IF;
    
    RAISE NOTICE '[send_time_clock_notification] ✅ Colaboradora encontrada: %', v_colaboradora.name;
    
    v_admin_id := v_store.admin_id;
    
    IF v_admin_id IS NULL THEN
        RAISE WARNING '[send_time_clock_notification] ⚠️ admin_id é NULL para loja: %', v_store.name;
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
    
    -- Formatar horário (Brasília) - formato simples como nova venda
    v_horario_formatado := TO_CHAR(NEW.horario AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY às HH24:MI');
    
    -- Montar mensagem seguindo o padrão de nova venda (simples e limpo)
    v_message := '🕐 *Registro de Ponto*\n\n';
    v_message := v_message || '*Colaboradora:* ' || TRIM(v_colaboradora.name) || '\n';
    v_message := v_message || '*Loja:* ' || v_store.name || '\n';
    v_message := v_message || '*Tipo:* ' || v_tipo_label || '\n';
    v_message := v_message || '*Horário:* ' || v_horario_formatado || '\n';
    
    IF NEW.observacao IS NOT NULL AND NEW.observacao != '' THEN
        v_message := v_message || '*Observação:* ' || NEW.observacao || '\n';
    END IF;
    
    v_message := v_message || '\nSistema EleveaOne 📊';
    
    -- Contar configurações de notificação disponíveis
    SELECT COUNT(*) INTO v_config_count
    FROM sistemaretiradas.whatsapp_notification_config
    WHERE admin_id = v_admin_id
    AND notification_type = 'CONTROLE_PONTO'
    AND active = true
    AND (store_id = NEW.store_id OR store_id IS NULL);
    
    RAISE NOTICE '[send_time_clock_notification] 📱 Configurações encontradas: %', v_config_count;
    
    IF v_config_count = 0 THEN
        RAISE NOTICE '[send_time_clock_notification] ⚠️ Nenhuma configuração de notificação ativa encontrada para admin_id: %, store_id: %, tipo: CONTROLE_PONTO', v_admin_id, NEW.store_id;
        RETURN NEW;
    END IF;
    
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
        
        IF v_phone IS NULL OR v_phone = '' THEN
            RAISE NOTICE '[send_time_clock_notification] ⚠️ Telefone vazio, pulando...';
            CONTINUE;
        END IF;
        
        -- Inserir na fila para processamento
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
            
            RAISE NOTICE '[send_time_clock_notification] ✅ Notificação adicionada à fila para % (loja: %, registro: %)', v_phone, NEW.store_id, NEW.id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[send_time_clock_notification] ❌ Erro ao inserir na fila para %: %', v_phone, SQLERRM;
        END;
    END LOOP;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.send_time_clock_notification() IS 'Adiciona notificação de ponto à fila com mensagem formatada - Versão melhorada com formatação aprimorada e mais legível';

