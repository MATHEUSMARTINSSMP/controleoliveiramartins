-- =====================================================
-- TRIGGER PARA ATUALIZAR BANCO DE HORAS AUTOMATICAMENTE
-- =====================================================
-- Quando um registro de ponto é criado, atualiza o banco de horas
-- calculando a diferença entre jornada esperada e realizada

CREATE OR REPLACE FUNCTION sistemaretiradas.update_hours_balance_on_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_work_schedule RECORD;
    v_jornada_esperada_minutos INTEGER := 0;
    v_jornada_realizada_minutos INTEGER := 0;
    v_saldo_dia_minutos INTEGER := 0;
    v_data_registro DATE;
    v_entrada RECORD;
    v_saida RECORD;
    v_saida_intervalo RECORD;
    v_entrada_intervalo RECORD;
    v_balance RECORD;
    v_novo_saldo_minutos INTEGER;
BEGIN
    -- Obter data do registro (em timezone de Belém)
    v_data_registro := (NEW.horario AT TIME ZONE 'UTC' AT TIME ZONE 'America/Belem')::DATE;
    
    -- Buscar jornada de trabalho da colaboradora
    SELECT * INTO v_work_schedule
    FROM sistemaretiradas.colaboradora_work_schedules
    WHERE colaboradora_id = NEW.colaboradora_id
    AND store_id = NEW.store_id
    AND ativo = true
    LIMIT 1;
    
    -- Se não tem jornada configurada, não calcula
    IF NOT FOUND OR v_work_schedule IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Calcular jornada esperada para o dia
    IF v_work_schedule.carga_horaria_diaria IS NOT NULL THEN
        -- Usar carga horária do template (em horas, converter para minutos)
        v_jornada_esperada_minutos := ROUND(v_work_schedule.carga_horaria_diaria * 60);
    ELSIF v_work_schedule.hora_entrada IS NOT NULL AND v_work_schedule.hora_saida IS NOT NULL THEN
        -- Calcular baseado em horários específicos
        DECLARE
            v_entrada_min INTEGER;
            v_saida_min INTEGER;
            v_intervalo_saida_min INTEGER;
            v_intervalo_retorno_min INTEGER;
        BEGIN
            -- Converter horários para minutos do dia
            v_entrada_min := EXTRACT(HOUR FROM v_work_schedule.hora_entrada::TIME) * 60 + EXTRACT(MINUTE FROM v_work_schedule.hora_entrada::TIME);
            v_saida_min := EXTRACT(HOUR FROM v_work_schedule.hora_saida::TIME) * 60 + EXTRACT(MINUTE FROM v_work_schedule.hora_saida::TIME);
            v_jornada_esperada_minutos := v_saida_min - v_entrada_min;
            
            -- Subtrair intervalo se configurado
            IF v_work_schedule.hora_intervalo_saida IS NOT NULL AND v_work_schedule.hora_intervalo_retorno IS NOT NULL THEN
                v_intervalo_saida_min := EXTRACT(HOUR FROM v_work_schedule.hora_intervalo_saida::TIME) * 60 + EXTRACT(MINUTE FROM v_work_schedule.hora_intervalo_saida::TIME);
                v_intervalo_retorno_min := EXTRACT(HOUR FROM v_work_schedule.hora_intervalo_retorno::TIME) * 60 + EXTRACT(MINUTE FROM v_work_schedule.hora_intervalo_retorno::TIME);
                v_jornada_esperada_minutos := v_jornada_esperada_minutos - (v_intervalo_retorno_min - v_intervalo_saida_min);
            END IF;
        END;
    ELSE
        -- Padrão: 6 horas (360 minutos)
        v_jornada_esperada_minutos := 360;
    END IF;
    
    -- Buscar todos os registros do dia para calcular jornada realizada
    SELECT * INTO v_entrada
    FROM sistemaretiradas.time_clock_records
    WHERE colaboradora_id = NEW.colaboradora_id
    AND store_id = NEW.store_id
    AND tipo_registro = 'ENTRADA'
    AND (horario AT TIME ZONE 'UTC' AT TIME ZONE 'America/Belem')::DATE = v_data_registro
    ORDER BY horario ASC
    LIMIT 1;
    
    SELECT * INTO v_saida
    FROM sistemaretiradas.time_clock_records
    WHERE colaboradora_id = NEW.colaboradora_id
    AND store_id = NEW.store_id
    AND tipo_registro = 'SAIDA'
    AND (horario AT TIME ZONE 'UTC' AT TIME ZONE 'America/Belem')::DATE = v_data_registro
    ORDER BY horario DESC
    LIMIT 1;
    
    -- Se não tem entrada e saída, não calcula ainda
    IF v_entrada IS NULL OR v_saida IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Calcular jornada realizada (em minutos)
    v_jornada_realizada_minutos := EXTRACT(EPOCH FROM (v_saida.horario - v_entrada.horario)) / 60;
    
    -- Subtrair intervalo se existir
    SELECT * INTO v_saida_intervalo
    FROM sistemaretiradas.time_clock_records
    WHERE colaboradora_id = NEW.colaboradora_id
    AND store_id = NEW.store_id
    AND tipo_registro = 'SAIDA_INTERVALO'
    AND (horario AT TIME ZONE 'UTC' AT TIME ZONE 'America/Belem')::DATE = v_data_registro
    ORDER BY horario ASC
    LIMIT 1;
    
    SELECT * INTO v_entrada_intervalo
    FROM sistemaretiradas.time_clock_records
    WHERE colaboradora_id = NEW.colaboradora_id
    AND store_id = NEW.store_id
    AND tipo_registro = 'ENTRADA_INTERVALO'
    AND (horario AT TIME ZONE 'UTC' AT TIME ZONE 'America/Belem')::DATE = v_data_registro
    ORDER BY horario DESC
    LIMIT 1;
    
    IF v_saida_intervalo IS NOT NULL AND v_entrada_intervalo IS NOT NULL THEN
        DECLARE
            v_minutos_intervalo INTEGER;
        BEGIN
            v_minutos_intervalo := EXTRACT(EPOCH FROM (v_entrada_intervalo.horario - v_saida_intervalo.horario)) / 60;
            v_jornada_realizada_minutos := v_jornada_realizada_minutos - v_minutos_intervalo;
        END;
    END IF;
    
    -- Calcular saldo do dia (realizado - esperado)
    v_saldo_dia_minutos := ROUND(v_jornada_realizada_minutos) - v_jornada_esperada_minutos;
    
    -- Buscar ou criar registro de banco de horas
    SELECT * INTO v_balance
    FROM sistemaretiradas.time_clock_hours_balance
    WHERE colaboradora_id = NEW.colaboradora_id
    AND store_id = NEW.store_id
    LIMIT 1;
    
    IF NOT FOUND THEN
        -- Criar registro inicial
        INSERT INTO sistemaretiradas.time_clock_hours_balance (
            colaboradora_id,
            store_id,
            saldo_minutos,
            ultimo_calculo_em,
            ultimo_registro_calculado
        ) VALUES (
            NEW.colaboradora_id,
            NEW.store_id,
            v_saldo_dia_minutos,
            NOW(),
            NEW.id
        );
    ELSE
        -- Atualizar saldo acumulado
        -- Buscar saldo anterior do dia (se já foi calculado antes)
        DECLARE
            v_saldo_anterior_dia INTEGER := 0;
        BEGIN
            SELECT saldo_minutos INTO v_saldo_anterior_dia
            FROM sistemaretiradas.hours_daily_balances
            WHERE colaboradora_id = NEW.colaboradora_id
            AND store_id = NEW.store_id
            AND data = v_data_registro
            LIMIT 1;
            
            -- Se já tinha saldo calculado para este dia, remover do total antes de adicionar o novo
            IF v_saldo_anterior_dia IS NOT NULL THEN
                v_novo_saldo_minutos := v_balance.saldo_minutos - v_saldo_anterior_dia + v_saldo_dia_minutos;
            ELSE
                -- Primeira vez calculando este dia, apenas adicionar
                v_novo_saldo_minutos := v_balance.saldo_minutos + v_saldo_dia_minutos;
            END IF;
        END;
        
        UPDATE sistemaretiradas.time_clock_hours_balance
        SET saldo_minutos = v_novo_saldo_minutos,
            ultimo_calculo_em = NOW(),
            ultimo_registro_calculado = NEW.id,
            updated_at = NOW()
        WHERE id = v_balance.id;
    END IF;
    
    -- Salvar saldo diário para histórico
    INSERT INTO sistemaretiradas.hours_daily_balances (
        colaboradora_id,
        store_id,
        data,
        minutos_trabalhados,
        minutos_esperados,
        saldo_minutos,
        schedule_id
    ) VALUES (
        NEW.colaboradora_id,
        NEW.store_id,
        v_data_registro,
        ROUND(v_jornada_realizada_minutos),
        v_jornada_esperada_minutos,
        v_saldo_dia_minutos,
        v_work_schedule.id
    )
    ON CONFLICT (colaboradora_id, data) 
    DO UPDATE SET
        minutos_trabalhados = ROUND(v_jornada_realizada_minutos),
        minutos_esperados = v_jornada_esperada_minutos,
        saldo_minutos = v_saldo_dia_minutos,
        schedule_id = v_work_schedule.id,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_update_hours_balance ON sistemaretiradas.time_clock_records;

CREATE TRIGGER trigger_update_hours_balance
AFTER INSERT ON sistemaretiradas.time_clock_records
FOR EACH ROW
EXECUTE FUNCTION sistemaretiradas.update_hours_balance_on_record();

COMMENT ON FUNCTION sistemaretiradas.update_hours_balance_on_record() IS 'Atualiza banco de horas automaticamente quando um registro de ponto é criado, calculando diferença entre jornada esperada e realizada';

