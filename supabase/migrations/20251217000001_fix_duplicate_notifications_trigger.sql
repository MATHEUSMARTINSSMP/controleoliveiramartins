-- =====================================================
-- CORREÇÃO: NOTIFICAÇÕES DUPLICADAS DE PONTO
-- Problema: SELECT DISTINCT phone retorna o mesmo telefone múltiplas vezes
-- se cadastrado como global (store_id IS NULL) E específico da loja
-- Solução: Agrupar por phone para garantir unicidade
-- =====================================================

-- Recriar função send_time_clock_notification com agrupamento correto
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
    v_message TEXT;
    v_tipo_label TEXT;
    v_horario_formatado TEXT;
    v_phone TEXT;
    v_config_count INTEGER := 0;
    v_phones TEXT[];
    v_i INTEGER;
BEGIN
    -- Log inicial
    RAISE NOTICE '[send_time_clock_notification] Iniciando notificacao para registro: %', NEW.id;
    
    -- Buscar dados da loja e colaboradora
    SELECT s.*, s.admin_id INTO v_store
    FROM sistemaretiradas.stores s
    WHERE s.id = NEW.store_id;
    
    IF NOT FOUND THEN
        RAISE WARNING '[send_time_clock_notification] Loja nao encontrada para store_id: %', NEW.store_id;
        RETURN NEW;
    END IF;
    
    SELECT p.* INTO v_colaboradora
    FROM sistemaretiradas.profiles p
    WHERE p.id = NEW.colaboradora_id;
    
    IF NOT FOUND THEN
        RAISE WARNING '[send_time_clock_notification] Colaboradora nao encontrada para colaboradora_id: %', NEW.colaboradora_id;
        RETURN NEW;
    END IF;
    
    v_admin_id := v_store.admin_id;
    
    IF v_admin_id IS NULL THEN
        RAISE WARNING '[send_time_clock_notification] admin_id e NULL para loja: %', v_store.name;
        RETURN NEW;
    END IF;
    
    -- Formatar tipo de registro
    v_tipo_label := CASE NEW.tipo_registro
        WHEN 'ENTRADA' THEN 'Entrada'
        WHEN 'SAIDA_INTERVALO' THEN 'Saida para Intervalo'
        WHEN 'ENTRADA_INTERVALO' THEN 'Retorno do Intervalo'
        WHEN 'SAIDA' THEN 'Saida'
        ELSE NEW.tipo_registro
    END;
    
    -- Formatar horário (Belém - UTC-3)
    v_horario_formatado := TO_CHAR(NEW.horario AT TIME ZONE 'UTC' AT TIME ZONE 'America/Belem', 'DD/MM/YYYY as HH24:MI');
    
    -- Montar mensagem
    v_message := '🕐 *REGISTRO DE PONTO*' || E'\n';
    v_message := v_message || '━━━━━━━━━━━━━━━━' || E'\n\n';
    v_message := v_message || '👤 *Colaboradora:*' || E'\n' || TRIM(v_colaboradora.name) || E'\n\n';
    v_message := v_message || '🏪 *Loja:*' || E'\n' || v_store.name || E'\n\n';
    v_message := v_message || '📋 *Tipo:*' || E'\n' || v_tipo_label || E'\n\n';
    v_message := v_message || '🕒 *Horario:*' || E'\n' || v_horario_formatado || E'\n';
    
    IF NEW.observacao IS NOT NULL AND NEW.observacao != '' THEN
        v_message := v_message || E'\n' || '📝 *Observacao:*' || E'\n' || NEW.observacao || E'\n';
    END IF;
    
    v_message := v_message || E'\n' || '━━━━━━━━━━━━━━━━' || E'\n';
    v_message := v_message || '📊 Sistema EleveaOne';
    
    -- ✅ CORREÇÃO: Usar array_agg com DISTINCT para garantir telefones únicos
    -- Isso elimina duplicatas mesmo quando o mesmo telefone está cadastrado
    -- como global (store_id IS NULL) E específico da loja
    SELECT ARRAY(
        SELECT DISTINCT unnest(array_agg(DISTINCT phone))
        FROM sistemaretiradas.whatsapp_notification_config
        WHERE admin_id = v_admin_id
        AND notification_type = 'CONTROLE_PONTO'
        AND active = true
        AND (store_id = NEW.store_id OR store_id IS NULL)
        AND phone IS NOT NULL
        AND phone != ''
    ) INTO v_phones;
    
    v_config_count := COALESCE(array_length(v_phones, 1), 0);
    
    RAISE NOTICE '[send_time_clock_notification] Telefones unicos encontrados: % -> %', v_config_count, v_phones;
    
    IF v_config_count = 0 THEN
        RAISE NOTICE '[send_time_clock_notification] Nenhum telefone ativo encontrado para admin_id: %, store_id: %', v_admin_id, NEW.store_id;
        RETURN NEW;
    END IF;
    
    -- Iterar sobre telefones únicos e inserir na fila
    FOR v_i IN 1..v_config_count LOOP
        v_phone := v_phones[v_i];
        
        -- Verificar se já existe uma notificação pendente para este registro e telefone
        -- (evita duplicatas se trigger for executada múltiplas vezes)
        IF EXISTS (
            SELECT 1 FROM sistemaretiradas.time_clock_notification_queue
            WHERE time_clock_record_id = NEW.id
            AND phone = v_phone
            AND status IN ('PENDING', 'SENT')
        ) THEN
            RAISE NOTICE '[send_time_clock_notification] Notificacao ja existe para % e registro %, pulando...', v_phone, NEW.id;
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
            
            RAISE NOTICE '[send_time_clock_notification] Notificacao adicionada a fila para % (loja: %, registro: %)', v_phone, NEW.store_id, NEW.id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[send_time_clock_notification] Erro ao inserir na fila para %: %', v_phone, SQLERRM;
        END;
    END LOOP;
    
    RETURN NEW;
END;
$$;

-- Garantir que o trigger existe e está correto
DROP TRIGGER IF EXISTS trigger_send_time_clock_notification ON sistemaretiradas.time_clock_records;
CREATE TRIGGER trigger_send_time_clock_notification
    AFTER INSERT ON sistemaretiradas.time_clock_records
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.send_time_clock_notification();

-- Adicionar índice único para evitar duplicatas na fila (safety net)
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_clock_notification_queue_unique_pending
ON sistemaretiradas.time_clock_notification_queue (time_clock_record_id, phone)
WHERE status = 'PENDING';

COMMENT ON FUNCTION sistemaretiradas.send_time_clock_notification() IS 
'Trigger que adiciona notificacao de ponto a fila - v2.0 com correcao de duplicatas';
