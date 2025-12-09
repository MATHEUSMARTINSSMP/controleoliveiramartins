-- =====================================================
-- CORREÇÕES E MELHORIAS NO SISTEMA DE PONTO
-- =====================================================

-- 1. Adicionar trigger para updated_at em time_clock_records
CREATE OR REPLACE FUNCTION sistemaretiradas.update_time_clock_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_time_clock_records_updated_at ON sistemaretiradas.time_clock_records;

CREATE TRIGGER trigger_update_time_clock_records_updated_at
  BEFORE UPDATE ON sistemaretiradas.time_clock_records
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_time_clock_records_updated_at();

-- 2. Adicionar constraint para evitar registros duplicados no mesmo minuto
-- (mesma colaboradora, mesmo tipo, mesmo minuto)
-- Criar função imutável para truncar ao minuto (necessário para índice)
-- Usa epoch para garantir imutabilidade: floor divide por 60 segundos e multiplica de volta
CREATE OR REPLACE FUNCTION sistemaretiradas.truncate_to_minute(ts TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT to_timestamp(floor(EXTRACT(EPOCH FROM ts) / 60) * 60);
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tcr_unique_minute 
ON sistemaretiradas.time_clock_records(
  colaboradora_id, 
  tipo_registro, 
  sistemaretiradas.truncate_to_minute(horario)
);

-- 3. Adicionar constraint para evitar registros no futuro (mais de 5 minutos)
-- Isso será validado no frontend também, mas é uma camada extra de segurança
-- Nota: Não podemos usar CHECK constraint com NOW() diretamente, então faremos via trigger

CREATE OR REPLACE FUNCTION sistemaretiradas.validate_time_clock_record_horario()
RETURNS TRIGGER AS $$
BEGIN
  -- Permitir até 5 minutos no futuro (tolerância para diferença de relógio)
  IF NEW.horario > NOW() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'Não é possível registrar ponto no futuro (mais de 5 minutos)';
  END IF;
  
  -- Não permitir registros muito antigos (mais de 1 ano)
  IF NEW.horario < NOW() - INTERVAL '1 year' THEN
    RAISE EXCEPTION 'Não é possível registrar ponto com mais de 1 ano de atraso';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_time_clock_record_horario ON sistemaretiradas.time_clock_records;

CREATE TRIGGER trigger_validate_time_clock_record_horario
  BEFORE INSERT OR UPDATE ON sistemaretiradas.time_clock_records
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.validate_time_clock_record_horario();

-- 4. Adicionar constraint para validar sequência lógica de registros
-- (via função que será chamada antes de inserir)
CREATE OR REPLACE FUNCTION sistemaretiradas.validate_time_clock_sequence(
  p_colaboradora_id UUID,
  p_tipo_registro TEXT,
  p_horario TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_last_record TEXT;
  v_last_horario TIMESTAMP WITH TIME ZONE;
  v_same_day BOOLEAN;
BEGIN
  -- Buscar último registro do dia
  SELECT tipo_registro, horario INTO v_last_record, v_last_horario
  FROM sistemaretiradas.time_clock_records
  WHERE colaboradora_id = p_colaboradora_id
    AND DATE(horario) = DATE(p_horario)
  ORDER BY horario DESC
  LIMIT 1;
  
  -- Se não há registro anterior no dia, só pode ser ENTRADA
  IF v_last_record IS NULL THEN
    IF p_tipo_registro != 'ENTRADA' THEN
      RAISE EXCEPTION 'Primeiro registro do dia deve ser ENTRADA';
    END IF;
    RETURN true;
  END IF;
  
  -- Validar sequência lógica
  CASE v_last_record
    WHEN 'ENTRADA' THEN
      IF p_tipo_registro NOT IN ('SAIDA_INTERVALO', 'SAIDA') THEN
        RAISE EXCEPTION 'Após ENTRADA, o próximo registro deve ser SAIDA_INTERVALO ou SAIDA';
      END IF;
    WHEN 'SAIDA_INTERVALO' THEN
      IF p_tipo_registro != 'ENTRADA_INTERVALO' THEN
        RAISE EXCEPTION 'Após SAIDA_INTERVALO, o próximo registro deve ser ENTRADA_INTERVALO';
      END IF;
    WHEN 'ENTRADA_INTERVALO' THEN
      IF p_tipo_registro != 'SAIDA' THEN
        RAISE EXCEPTION 'Após ENTRADA_INTERVALO, o próximo registro deve ser SAIDA';
      END IF;
    WHEN 'SAIDA' THEN
      -- Após SAIDA, pode começar novo dia (ENTRADA) ou continuar no mesmo dia (não permitido)
      IF p_tipo_registro != 'ENTRADA' THEN
        RAISE EXCEPTION 'Após SAIDA, o próximo registro deve ser ENTRADA (novo dia)';
      END IF;
      -- Verificar se é realmente um novo dia
      IF DATE(p_horario) = DATE(v_last_horario) THEN
        RAISE EXCEPTION 'Não é possível registrar ENTRADA no mesmo dia após SAIDA';
      END IF;
  END CASE;
  
  RETURN true;
END;
$$;

-- 5. Melhorar RLS policies para time_clock_records
-- Colaboradora NÃO deve poder UPDATE ou DELETE seus próprios registros
-- Apenas INSERT (criar novos registros)

DROP POLICY IF EXISTS "colaboradora_own_records" ON sistemaretiradas.time_clock_records;
DROP POLICY IF EXISTS "colaboradora_insert_records" ON sistemaretiradas.time_clock_records;
DROP POLICY IF EXISTS "colaboradora_read_records" ON sistemaretiradas.time_clock_records;

-- Política: Colaboradora pode ler seus próprios registros
CREATE POLICY "colaboradora_read_records" ON sistemaretiradas.time_clock_records
  FOR SELECT
  USING (colaboradora_id = auth.uid());

-- Política: Colaboradora pode criar seus próprios registros
CREATE POLICY "colaboradora_insert_records" ON sistemaretiradas.time_clock_records
  FOR INSERT
  WITH CHECK (colaboradora_id = auth.uid());

-- Política: Admin/Loja pode fazer tudo com registros da loja
DROP POLICY IF EXISTS "admin_store_records" ON sistemaretiradas.time_clock_records;

CREATE POLICY "admin_store_records" ON sistemaretiradas.time_clock_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = time_clock_records.store_id))
    )
  );

-- 6. Adicionar validação na função RPC de inserir assinatura
-- Verificar se o registro não tem assinatura já
-- Verificar se o registro não é muito antigo

-- Atualizar função insert_time_clock_digital_signature para adicionar validações
-- (Isso será feito em migration separada se necessário, pois a função já existe)

-- 7. Adicionar índice composto para melhorar performance de queries por dia
-- Criar função imutável para extrair data (necessário para índice)
-- Converte para UTC e extrai a data (UTC é constante, então é imutável)
CREATE OR REPLACE FUNCTION sistemaretiradas.extract_date(ts TIMESTAMP WITH TIME ZONE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (ts AT TIME ZONE 'UTC')::DATE;
$$;

CREATE INDEX IF NOT EXISTS idx_tcr_colaboradora_data 
ON sistemaretiradas.time_clock_records(colaboradora_id, sistemaretiradas.extract_date(horario));

-- 8. Adicionar constraint para limitar registros por dia (máximo 4)
-- Isso será validado via trigger
CREATE OR REPLACE FUNCTION sistemaretiradas.validate_max_records_per_day()
RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Contar registros do dia para esta colaboradora
  SELECT COUNT(*) INTO v_count
  FROM sistemaretiradas.time_clock_records
  WHERE colaboradora_id = NEW.colaboradora_id
    AND DATE(horario) = DATE(NEW.horario);
  
  -- Se já tem 4 registros, não permitir mais (exceto se for lançamento manual)
  IF v_count >= 4 AND (NEW.lancamento_manual IS NULL OR NEW.lancamento_manual = false) THEN
    RAISE EXCEPTION 'Limite de 4 registros por dia atingido. Use lançamento manual se necessário.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_max_records_per_day ON sistemaretiradas.time_clock_records;

CREATE TRIGGER trigger_validate_max_records_per_day
  BEFORE INSERT ON sistemaretiradas.time_clock_records
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.validate_max_records_per_day();

-- 9. Adicionar validação em time_clock_change_requests
-- Não permitir solicitar alteração de registro muito antigo (>30 dias)
-- Não permitir solicitar alteração de registro já processado

CREATE OR REPLACE FUNCTION sistemaretiradas.validate_change_request()
RETURNS TRIGGER AS $$
DECLARE
  v_record_horario TIMESTAMP WITH TIME ZONE;
  v_record_exists BOOLEAN;
  v_request_status TEXT;
BEGIN
  -- Verificar se o registro existe
  SELECT horario INTO v_record_horario
  FROM sistemaretiradas.time_clock_records
  WHERE id = NEW.registro_original_id;
  
  IF v_record_horario IS NULL THEN
    RAISE EXCEPTION 'Registro de ponto não encontrado';
  END IF;
  
  -- Não permitir solicitar alteração de registro muito antigo (>30 dias)
  IF v_record_horario < NOW() - INTERVAL '30 days' THEN
    RAISE EXCEPTION 'Não é possível solicitar alteração de registro com mais de 30 dias';
  END IF;
  
  -- Verificar se já existe solicitação pendente ou aprovada para este registro
  SELECT status INTO v_request_status
  FROM sistemaretiradas.time_clock_change_requests
  WHERE registro_original_id = NEW.registro_original_id
    AND status IN ('PENDENTE', 'APROVADO')
  LIMIT 1;
  
  IF v_request_status IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe uma solicitação % para este registro', v_request_status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_change_request ON sistemaretiradas.time_clock_change_requests;

CREATE TRIGGER trigger_validate_change_request
  BEFORE INSERT ON sistemaretiradas.time_clock_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.validate_change_request();

-- 10. Adicionar campo assinado_em em time_clock_digital_signatures se não existir
-- (já existe created_at, mas assinado_em é mais semântico)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'time_clock_digital_signatures' 
    AND column_name = 'assinado_em'
  ) THEN
    ALTER TABLE sistemaretiradas.time_clock_digital_signatures
    ADD COLUMN assinado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    
    -- Atualizar registros existentes
    UPDATE sistemaretiradas.time_clock_digital_signatures
    SET assinado_em = created_at
    WHERE assinado_em IS NULL;
  END IF;
END $$;

-- Comentários
COMMENT ON FUNCTION sistemaretiradas.validate_time_clock_record_horario() IS 'Valida que registro não seja no futuro ou muito antigo';
COMMENT ON FUNCTION sistemaretiradas.validate_time_clock_sequence(UUID, TEXT, TIMESTAMP WITH TIME ZONE) IS 'Valida sequência lógica de registros de ponto';
COMMENT ON FUNCTION sistemaretiradas.validate_max_records_per_day() IS 'Valida limite de 4 registros por dia (exceto lançamento manual)';
COMMENT ON FUNCTION sistemaretiradas.validate_change_request() IS 'Valida solicitação de alteração de registro de ponto';


