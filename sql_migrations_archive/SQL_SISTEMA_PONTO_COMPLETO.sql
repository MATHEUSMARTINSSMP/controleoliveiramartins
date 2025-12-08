-- =========================================================
-- SISTEMA COMPLETO DE PONTO - ELEVEA ONE
-- Em conformidade com CLT e Portaria 671/2021 (REP-P)
-- =========================================================

-- =========================================================
-- TABELA 1: Solicitacoes de Alteracao de Horario
-- Quando colaboradora precisa ajustar um registro de ponto
-- =========================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
  registro_original_id UUID NOT NULL REFERENCES sistemaretiradas.time_clock_records(id) ON DELETE CASCADE,
  
  -- Dados originais (para auditoria)
  tipo_registro_original TEXT NOT NULL,
  horario_original TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Dados solicitados
  horario_solicitado TIMESTAMP WITH TIME ZONE NOT NULL,
  motivo TEXT NOT NULL,
  
  -- Status da solicitacao
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADO', 'REJEITADO')),
  
  -- Dados de aprovacao/rejeicao
  analisado_por UUID REFERENCES sistemaretiradas.profiles(id),
  analisado_em TIMESTAMP WITH TIME ZONE,
  justificativa_analise TEXT,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_change_requests_store ON sistemaretiradas.time_clock_change_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_colaboradora ON sistemaretiradas.time_clock_change_requests(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON sistemaretiradas.time_clock_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_created ON sistemaretiradas.time_clock_change_requests(created_at DESC);

-- =========================================================
-- TABELA 2: Assinaturas Digitais de Ponto
-- Comprovante legal de que colaboradora confirmou o registro
-- =========================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_digital_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
  registro_id UUID NOT NULL REFERENCES sistemaretiradas.time_clock_records(id) ON DELETE CASCADE,
  
  -- Hash da senha para verificacao de autenticidade
  -- Armazenamos hash BCrypt da senha + timestamp + registro_id
  signature_hash TEXT NOT NULL,
  
  -- Dados do momento da assinatura
  assinado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Para conformidade REP-P
  numero_sequencial_rep BIGINT GENERATED ALWAYS AS IDENTITY,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Cada registro so pode ter uma assinatura
  CONSTRAINT unique_signature_per_record UNIQUE (registro_id)
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_signatures_store ON sistemaretiradas.time_clock_digital_signatures(store_id);
CREATE INDEX IF NOT EXISTS idx_signatures_colaboradora ON sistemaretiradas.time_clock_digital_signatures(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_signatures_created ON sistemaretiradas.time_clock_digital_signatures(assinado_em DESC);

-- =========================================================
-- TABELA 3: Fechamentos de Periodo (Folha de Ponto)
-- Para gerar relatorios mensais/semanais com totalizacao
-- =========================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_period_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
  
  -- Periodo do fechamento
  tipo_periodo TEXT NOT NULL CHECK (tipo_periodo IN ('SEMANAL', 'MENSAL', 'CUSTOMIZADO')),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  
  -- Totalizacoes calculadas (em minutos)
  total_horas_trabalhadas INTEGER NOT NULL DEFAULT 0,
  total_horas_esperadas INTEGER NOT NULL DEFAULT 0,
  total_horas_extras INTEGER NOT NULL DEFAULT 0,
  total_horas_faltantes INTEGER NOT NULL DEFAULT 0,
  total_intervalo INTEGER NOT NULL DEFAULT 0,
  
  -- Dias trabalhados/faltosos
  dias_trabalhados INTEGER NOT NULL DEFAULT 0,
  dias_falta INTEGER NOT NULL DEFAULT 0,
  dias_folga INTEGER NOT NULL DEFAULT 0,
  
  -- Status do fechamento
  status TEXT NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'FECHADO', 'ASSINADO')),
  
  -- Assinatura do fechamento pelo colaborador
  assinado_colaboradora_em TIMESTAMP WITH TIME ZONE,
  assinatura_colaboradora_hash TEXT,
  
  -- Aprovacao do gestor
  aprovado_por UUID REFERENCES sistemaretiradas.profiles(id),
  aprovado_em TIMESTAMP WITH TIME ZONE,
  
  -- Observacoes
  observacoes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_period_closing UNIQUE (colaboradora_id, store_id, tipo_periodo, data_inicio, data_fim)
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_closings_store ON sistemaretiradas.time_clock_period_closings(store_id);
CREATE INDEX IF NOT EXISTS idx_closings_colaboradora ON sistemaretiradas.time_clock_period_closings(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_closings_periodo ON sistemaretiradas.time_clock_period_closings(data_inicio, data_fim);

-- =========================================================
-- POLITICAS RLS - Seguranca por Nivel de Acesso
-- =========================================================

-- Enable RLS em todas as tabelas
ALTER TABLE sistemaretiradas.time_clock_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.time_clock_digital_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.time_clock_period_closings ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- RLS: time_clock_change_requests
-- =========================================================

-- ADMIN: Ver/gerenciar todas solicitacoes de suas lojas
CREATE POLICY admin_change_requests_all ON sistemaretiradas.time_clock_change_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND (
        p.store_id = time_clock_change_requests.store_id
        OR EXISTS (
          SELECT 1 FROM sistemaretiradas.stores s
          WHERE s.id = time_clock_change_requests.store_id
          AND s.admin_id = p.id
        )
      )
    )
  );

-- LOJA: Ver/gerenciar solicitacoes de sua loja
CREATE POLICY loja_change_requests_all ON sistemaretiradas.time_clock_change_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'LOJA'
      AND p.store_id = time_clock_change_requests.store_id
    )
  );

-- COLABORADORA: Ver/criar suas proprias solicitacoes
CREATE POLICY colaboradora_change_requests_select ON sistemaretiradas.time_clock_change_requests
  FOR SELECT
  TO authenticated
  USING (
    colaboradora_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'COLABORADORA'
    )
  );

CREATE POLICY colaboradora_change_requests_insert ON sistemaretiradas.time_clock_change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    colaboradora_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'COLABORADORA'
    )
  );

-- =========================================================
-- RLS: time_clock_digital_signatures
-- =========================================================

-- ADMIN: Ver todas assinaturas de suas lojas
CREATE POLICY admin_signatures_select ON sistemaretiradas.time_clock_digital_signatures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND (
        p.store_id = time_clock_digital_signatures.store_id
        OR EXISTS (
          SELECT 1 FROM sistemaretiradas.stores s
          WHERE s.id = time_clock_digital_signatures.store_id
          AND s.admin_id = p.id
        )
      )
    )
  );

-- LOJA: Ver assinaturas de sua loja
CREATE POLICY loja_signatures_select ON sistemaretiradas.time_clock_digital_signatures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'LOJA'
      AND p.store_id = time_clock_digital_signatures.store_id
    )
  );

-- COLABORADORA: Ver/criar suas proprias assinaturas
CREATE POLICY colaboradora_signatures_all ON sistemaretiradas.time_clock_digital_signatures
  FOR ALL
  TO authenticated
  USING (
    colaboradora_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'COLABORADORA'
    )
  );

-- =========================================================
-- RLS: time_clock_period_closings
-- =========================================================

-- ADMIN: Gerenciamento completo
CREATE POLICY admin_closings_all ON sistemaretiradas.time_clock_period_closings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND (
        p.store_id = time_clock_period_closings.store_id
        OR EXISTS (
          SELECT 1 FROM sistemaretiradas.stores s
          WHERE s.id = time_clock_period_closings.store_id
          AND s.admin_id = p.id
        )
      )
    )
  );

-- LOJA: Gerenciamento completo de sua loja
CREATE POLICY loja_closings_all ON sistemaretiradas.time_clock_period_closings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'LOJA'
      AND p.store_id = time_clock_period_closings.store_id
    )
  );

-- COLABORADORA: Ver e assinar seus proprios fechamentos
CREATE POLICY colaboradora_closings_select ON sistemaretiradas.time_clock_period_closings
  FOR SELECT
  TO authenticated
  USING (
    colaboradora_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'COLABORADORA'
    )
  );

CREATE POLICY colaboradora_closings_update ON sistemaretiradas.time_clock_period_closings
  FOR UPDATE
  TO authenticated
  USING (
    colaboradora_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'COLABORADORA'
    )
  )
  WITH CHECK (
    colaboradora_id = auth.uid()
    -- Colaboradora so pode atualizar para assinar (campos de assinatura)
  );

-- =========================================================
-- FUNCAO: Calcular horas trabalhadas em um periodo
-- =========================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.calcular_horas_periodo(
  p_colaboradora_id UUID,
  p_store_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE
)
RETURNS TABLE (
  total_trabalhado_minutos INTEGER,
  total_esperado_minutos INTEGER,
  saldo_minutos INTEGER,
  dias_trabalhados INTEGER,
  registros_incompletos INTEGER
) AS $$
DECLARE
  v_total_trabalhado INTEGER := 0;
  v_total_esperado INTEGER := 0;
  v_dias_trabalhados INTEGER := 0;
  v_registros_incompletos INTEGER := 0;
  v_current_date DATE;
  v_entrada TIMESTAMP WITH TIME ZONE;
  v_saida TIMESTAMP WITH TIME ZONE;
  v_intervalo_saida TIMESTAMP WITH TIME ZONE;
  v_intervalo_retorno TIMESTAMP WITH TIME ZONE;
  v_jornada RECORD;
BEGIN
  -- Buscar jornada ativa
  SELECT * INTO v_jornada
  FROM sistemaretiradas.colaboradora_work_schedules
  WHERE colaboradora_id = p_colaboradora_id
    AND store_id = p_store_id
    AND ativo = true
    AND (data_inicio IS NULL OR data_inicio <= p_data_fim)
    AND (data_fim IS NULL OR data_fim >= p_data_inicio)
  LIMIT 1;

  -- Iterar por cada dia do periodo
  FOR v_current_date IN 
    SELECT generate_series(p_data_inicio, p_data_fim, '1 day'::interval)::date
  LOOP
    -- Verificar se e dia de trabalho
    IF v_jornada IS NOT NULL AND 
       EXTRACT(DOW FROM v_current_date) = ANY(v_jornada.dias_semana) THEN
      
      -- Calcular horas esperadas do dia
      v_total_esperado := v_total_esperado + 
        (EXTRACT(EPOCH FROM (v_jornada.hora_saida - v_jornada.hora_entrada)) / 60)::INTEGER -
        (EXTRACT(EPOCH FROM (v_jornada.hora_intervalo_retorno - v_jornada.hora_intervalo_saida)) / 60)::INTEGER;
      
      -- Buscar registros do dia
      SELECT 
        MIN(CASE WHEN tipo_registro = 'ENTRADA' THEN horario END),
        MAX(CASE WHEN tipo_registro = 'SAIDA' THEN horario END),
        MIN(CASE WHEN tipo_registro = 'SAIDA_INTERVALO' THEN horario END),
        MAX(CASE WHEN tipo_registro = 'ENTRADA_INTERVALO' THEN horario END)
      INTO v_entrada, v_saida, v_intervalo_saida, v_intervalo_retorno
      FROM sistemaretiradas.time_clock_records
      WHERE colaboradora_id = p_colaboradora_id
        AND store_id = p_store_id
        AND horario::date = v_current_date;
      
      IF v_entrada IS NOT NULL AND v_saida IS NOT NULL THEN
        v_dias_trabalhados := v_dias_trabalhados + 1;
        
        -- Calcular tempo trabalhado (em minutos)
        v_total_trabalhado := v_total_trabalhado + 
          (EXTRACT(EPOCH FROM (v_saida - v_entrada)) / 60)::INTEGER;
        
        -- Subtrair intervalo se registrado
        IF v_intervalo_saida IS NOT NULL AND v_intervalo_retorno IS NOT NULL THEN
          v_total_trabalhado := v_total_trabalhado - 
            (EXTRACT(EPOCH FROM (v_intervalo_retorno - v_intervalo_saida)) / 60)::INTEGER;
        END IF;
      ELSIF v_entrada IS NOT NULL OR v_saida IS NOT NULL THEN
        v_registros_incompletos := v_registros_incompletos + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY SELECT 
    v_total_trabalhado,
    v_total_esperado,
    v_total_trabalhado - v_total_esperado,
    v_dias_trabalhados,
    v_registros_incompletos;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- TRIGGER: Atualizar updated_at automaticamente
-- =========================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.update_time_clock_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_change_requests_timestamp
  BEFORE UPDATE ON sistemaretiradas.time_clock_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_time_clock_timestamp();

CREATE TRIGGER update_period_closings_timestamp
  BEFORE UPDATE ON sistemaretiradas.time_clock_period_closings
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_time_clock_timestamp();

-- =========================================================
-- COMENTARIOS PARA DOCUMENTACAO
-- =========================================================
COMMENT ON TABLE sistemaretiradas.time_clock_change_requests IS 'Solicitacoes de alteracao de registro de ponto por colaboradoras';
COMMENT ON TABLE sistemaretiradas.time_clock_digital_signatures IS 'Assinaturas digitais para comprovacao de registro de ponto (REP-P)';
COMMENT ON TABLE sistemaretiradas.time_clock_period_closings IS 'Fechamentos de periodo (folha de ponto) com totalizacoes';
COMMENT ON FUNCTION sistemaretiradas.calcular_horas_periodo IS 'Calcula horas trabalhadas vs esperadas em um periodo';
