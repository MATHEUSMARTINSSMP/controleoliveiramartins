-- =====================================================
-- SQL COMPLETO PARA ASSINATURA DIGITAL DO PONTO (REP-P)
-- Portaria 671/2021 - Sistema de Ponto Eletronico
-- =====================================================
-- 
-- IMPORTANTE: Antes de executar este SQL, certifique-se de que
-- as tabelas base ja existem:
-- - sistemaretiradas.profiles
-- - sistemaretiradas.stores
-- - sistemaretiradas.time_clock_records
--
-- Se time_clock_records NAO existir, execute primeiro:
-- SQL_BASE_TIME_CLOCK.sql (ou a secao PARTE 0 abaixo)
-- =====================================================

-- =====================================================
-- PARTE 0: TABELA BASE DE REGISTROS DE PONTO
-- (Execute apenas se a tabela ainda nao existir)
-- =====================================================

-- Habilitar extensao pgcrypto se nao existir
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabela base de registros de ponto
CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
  tipo_registro TEXT NOT NULL CHECK (tipo_registro IN ('ENTRADA', 'SAIDA_INTERVALO', 'ENTRADA_INTERVALO', 'SAIDA')),
  horario TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  endereco_completo TEXT,
  observacao TEXT,
  justificativa_admin TEXT,
  autorizado_por UUID REFERENCES sistemaretiradas.profiles(id),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  alterado_em TIMESTAMP WITH TIME ZONE,
  alterado_por UUID REFERENCES sistemaretiradas.profiles(id)
);

-- Indices para time_clock_records
CREATE INDEX IF NOT EXISTS idx_tcr_store ON sistemaretiradas.time_clock_records(store_id);
CREATE INDEX IF NOT EXISTS idx_tcr_colaboradora ON sistemaretiradas.time_clock_records(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_tcr_horario ON sistemaretiradas.time_clock_records(horario DESC);
CREATE INDEX IF NOT EXISTS idx_tcr_tipo ON sistemaretiradas.time_clock_records(tipo_registro);

-- RLS para time_clock_records
ALTER TABLE sistemaretiradas.time_clock_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "colaboradora_own_records" ON sistemaretiradas.time_clock_records;
CREATE POLICY "colaboradora_own_records" ON sistemaretiradas.time_clock_records
  FOR ALL
  USING (colaboradora_id = auth.uid());

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

-- =====================================================
-- PARTE 1: TABELA DE PINS DE ASSINATURA DIGITAL
-- =====================================================

-- Tabela para armazenar o PIN de assinatura digital de cada colaboradora
CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_signature_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  
  -- Hash do PIN (6-8 digitos) usando pgcrypto bcrypt
  pin_hash TEXT NOT NULL,
  
  -- Controle de tentativas e bloqueio
  tentativas_falhas INTEGER DEFAULT 0,
  bloqueado_ate TIMESTAMPTZ,
  ultimo_uso TIMESTAMPTZ,
  
  -- Metadados
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  resetado_por UUID REFERENCES sistemaretiradas.profiles(id),
  resetado_em TIMESTAMPTZ,
  
  -- Token para reset por email
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  
  -- Unico por colaboradora
  CONSTRAINT unique_pin_per_colaboradora UNIQUE(colaboradora_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_signature_pins_colaboradora 
  ON sistemaretiradas.time_clock_signature_pins(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_signature_pins_store 
  ON sistemaretiradas.time_clock_signature_pins(store_id);
CREATE INDEX IF NOT EXISTS idx_signature_pins_reset_token 
  ON sistemaretiradas.time_clock_signature_pins(reset_token) WHERE reset_token IS NOT NULL;

-- =====================================================
-- PARTE 2: TABELA DE ASSINATURAS DIGITAIS
-- (Registro de cada assinatura feita)
-- =====================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_digital_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_clock_record_id UUID NOT NULL REFERENCES sistemaretiradas.time_clock_records(id) ON DELETE CASCADE,
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  
  -- Hash da assinatura (nao e o PIN, e um hash unico por registro)
  password_hash TEXT NOT NULL,
  
  -- Informacoes do dispositivo
  device_info JSONB,
  ip_address INET,
  user_agent TEXT,
  
  -- Identificador REP-P
  rep_identity TEXT NOT NULL,
  
  -- Timestamp
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unico por registro de ponto
  CONSTRAINT unique_signature_per_record UNIQUE(time_clock_record_id)
);

-- Indices para assinaturas
CREATE INDEX IF NOT EXISTS idx_signatures_record 
  ON sistemaretiradas.time_clock_digital_signatures(time_clock_record_id);
CREATE INDEX IF NOT EXISTS idx_signatures_colaboradora 
  ON sistemaretiradas.time_clock_digital_signatures(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_signatures_store 
  ON sistemaretiradas.time_clock_digital_signatures(store_id);
CREATE INDEX IF NOT EXISTS idx_signatures_signed_at 
  ON sistemaretiradas.time_clock_digital_signatures(signed_at);
CREATE INDEX IF NOT EXISTS idx_signatures_rep_identity 
  ON sistemaretiradas.time_clock_digital_signatures(rep_identity);

-- =====================================================
-- PARTE 3: TABELA DE AUDITORIA DE PINS
-- (Log de todas as operacoes com PIN)
-- =====================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_pin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  
  -- Tipo de operacao
  operacao TEXT NOT NULL CHECK (operacao IN ('CRIACAO', 'ALTERACAO', 'RESET_ADMIN', 'RESET_EMAIL', 'TENTATIVA_FALHA', 'BLOQUEIO', 'DESBLOQUEIO', 'VALIDACAO_SUCESSO')),
  
  -- Quem executou (null se foi o proprio colaborador)
  executado_por UUID REFERENCES sistemaretiradas.profiles(id),
  
  -- Informacoes adicionais
  detalhes JSONB,
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para auditoria
CREATE INDEX IF NOT EXISTS idx_pin_audit_colaboradora 
  ON sistemaretiradas.time_clock_pin_audit_log(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_pin_audit_store 
  ON sistemaretiradas.time_clock_pin_audit_log(store_id);
CREATE INDEX IF NOT EXISTS idx_pin_audit_operacao 
  ON sistemaretiradas.time_clock_pin_audit_log(operacao);
CREATE INDEX IF NOT EXISTS idx_pin_audit_criado_em 
  ON sistemaretiradas.time_clock_pin_audit_log(criado_em);

-- =====================================================
-- PARTE 4: FUNCOES RPC
-- =====================================================

-- Funcao para criar/atualizar PIN com hash
CREATE OR REPLACE FUNCTION sistemaretiradas.set_signature_pin(
  p_colaboradora_id UUID,
  p_store_id UUID,
  p_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pin_hash TEXT;
  v_is_new BOOLEAN := FALSE;
BEGIN
  -- Validar PIN (6-8 digitos numericos)
  IF NOT p_pin ~ '^\d{6,8}$' THEN
    RAISE EXCEPTION 'PIN deve ter entre 6 e 8 digitos numericos';
  END IF;
  
  -- Criar hash do PIN com bcrypt
  v_pin_hash := crypt(p_pin, gen_salt('bf', 10));
  
  -- Verificar se ja existe
  IF NOT EXISTS (SELECT 1 FROM sistemaretiradas.time_clock_signature_pins WHERE colaboradora_id = p_colaboradora_id) THEN
    v_is_new := TRUE;
  END IF;
  
  -- Inserir ou atualizar
  INSERT INTO sistemaretiradas.time_clock_signature_pins (
    colaboradora_id,
    store_id,
    pin_hash,
    tentativas_falhas,
    bloqueado_ate,
    criado_em,
    atualizado_em
  )
  VALUES (
    p_colaboradora_id,
    p_store_id,
    v_pin_hash,
    0,
    NULL,
    NOW(),
    NOW()
  )
  ON CONFLICT (colaboradora_id)
  DO UPDATE SET
    pin_hash = v_pin_hash,
    tentativas_falhas = 0,
    bloqueado_ate = NULL,
    atualizado_em = NOW(),
    reset_token = NULL,
    reset_token_expires = NULL;
  
  -- Registrar auditoria
  INSERT INTO sistemaretiradas.time_clock_pin_audit_log (
    colaboradora_id,
    store_id,
    operacao,
    detalhes
  )
  VALUES (
    p_colaboradora_id,
    p_store_id,
    CASE WHEN v_is_new THEN 'CRIACAO' ELSE 'ALTERACAO' END,
    jsonb_build_object('timestamp', NOW())
  );
  
  RETURN TRUE;
END;
$$;

-- Funcao para validar PIN
CREATE OR REPLACE FUNCTION sistemaretiradas.validate_signature_pin(
  p_colaboradora_id UUID,
  p_pin TEXT
)
RETURNS TABLE(
  valido BOOLEAN,
  mensagem TEXT,
  bloqueado BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record RECORD;
  v_max_tentativas INTEGER := 5;
  v_tempo_bloqueio INTERVAL := '15 minutes';
BEGIN
  -- Buscar registro do PIN
  SELECT * INTO v_record
  FROM sistemaretiradas.time_clock_signature_pins
  WHERE colaboradora_id = p_colaboradora_id;
  
  -- Se nao existe PIN cadastrado
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'PIN nao cadastrado. Configure seu PIN primeiro.'::TEXT, FALSE;
    RETURN;
  END IF;
  
  -- Verificar se esta bloqueado
  IF v_record.bloqueado_ate IS NOT NULL AND v_record.bloqueado_ate > NOW() THEN
    RETURN QUERY SELECT FALSE, 
      format('PIN bloqueado. Tente novamente em %s minutos.', 
        CEIL(EXTRACT(EPOCH FROM (v_record.bloqueado_ate - NOW())) / 60)::INTEGER)::TEXT, 
      TRUE;
    RETURN;
  END IF;
  
  -- Se estava bloqueado mas o tempo passou, desbloquear
  IF v_record.bloqueado_ate IS NOT NULL AND v_record.bloqueado_ate <= NOW() THEN
    UPDATE sistemaretiradas.time_clock_signature_pins
    SET bloqueado_ate = NULL, tentativas_falhas = 0
    WHERE colaboradora_id = p_colaboradora_id;
    
    -- Registrar desbloqueio
    INSERT INTO sistemaretiradas.time_clock_pin_audit_log (
      colaboradora_id, store_id, operacao, detalhes
    )
    VALUES (
      p_colaboradora_id, v_record.store_id, 'DESBLOQUEIO',
      jsonb_build_object('motivo', 'tempo_expirado')
    );
  END IF;
  
  -- Validar PIN
  IF v_record.pin_hash = crypt(p_pin, v_record.pin_hash) THEN
    -- PIN correto - resetar tentativas
    UPDATE sistemaretiradas.time_clock_signature_pins
    SET 
      tentativas_falhas = 0,
      bloqueado_ate = NULL,
      ultimo_uso = NOW()
    WHERE colaboradora_id = p_colaboradora_id;
    
    -- Registrar sucesso
    INSERT INTO sistemaretiradas.time_clock_pin_audit_log (
      colaboradora_id, store_id, operacao, detalhes
    )
    VALUES (
      p_colaboradora_id, v_record.store_id, 'VALIDACAO_SUCESSO',
      jsonb_build_object('timestamp', NOW())
    );
    
    RETURN QUERY SELECT TRUE, 'PIN validado com sucesso.'::TEXT, FALSE;
  ELSE
    -- PIN incorreto - incrementar tentativas
    UPDATE sistemaretiradas.time_clock_signature_pins
    SET 
      tentativas_falhas = tentativas_falhas + 1,
      bloqueado_ate = CASE 
        WHEN tentativas_falhas + 1 >= v_max_tentativas THEN NOW() + v_tempo_bloqueio
        ELSE bloqueado_ate
      END,
      atualizado_em = NOW()
    WHERE colaboradora_id = p_colaboradora_id;
    
    -- Registrar tentativa falha
    INSERT INTO sistemaretiradas.time_clock_pin_audit_log (
      colaboradora_id, store_id, operacao, detalhes
    )
    VALUES (
      p_colaboradora_id, v_record.store_id, 'TENTATIVA_FALHA',
      jsonb_build_object('tentativa', v_record.tentativas_falhas + 1)
    );
    
    -- Verificar se atingiu limite
    IF v_record.tentativas_falhas + 1 >= v_max_tentativas THEN
      -- Registrar bloqueio
      INSERT INTO sistemaretiradas.time_clock_pin_audit_log (
        colaboradora_id, store_id, operacao, detalhes
      )
      VALUES (
        p_colaboradora_id, v_record.store_id, 'BLOQUEIO',
        jsonb_build_object('duracao_minutos', 15)
      );
      
      RETURN QUERY SELECT FALSE, 'PIN incorreto. Limite de tentativas atingido. Bloqueado por 15 minutos.'::TEXT, TRUE;
    ELSE
      RETURN QUERY SELECT FALSE, 
        format('PIN incorreto. Tentativas restantes: %s', v_max_tentativas - v_record.tentativas_falhas - 1)::TEXT, 
        FALSE;
    END IF;
  END IF;
END;
$$;

-- Funcao para verificar se colaboradora tem PIN cadastrado
CREATE OR REPLACE FUNCTION sistemaretiradas.has_signature_pin(
  p_colaboradora_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM sistemaretiradas.time_clock_signature_pins 
    WHERE colaboradora_id = p_colaboradora_id
  );
END;
$$;

-- Funcao para admin resetar PIN de colaboradora
CREATE OR REPLACE FUNCTION sistemaretiradas.admin_reset_signature_pin(
  p_colaboradora_id UUID,
  p_admin_id UUID,
  p_new_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pin_hash TEXT;
  v_store_id UUID;
BEGIN
  -- Validar PIN (6-8 digitos numericos)
  IF NOT p_new_pin ~ '^\d{6,8}$' THEN
    RAISE EXCEPTION 'PIN deve ter entre 6 e 8 digitos numericos';
  END IF;
  
  -- Buscar store_id da colaboradora
  SELECT store_id INTO v_store_id
  FROM sistemaretiradas.profiles
  WHERE id = p_colaboradora_id;
  
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Colaboradora nao encontrada';
  END IF;
  
  -- Criar hash do PIN
  v_pin_hash := crypt(p_new_pin, gen_salt('bf', 10));
  
  -- Inserir ou atualizar
  INSERT INTO sistemaretiradas.time_clock_signature_pins (
    colaboradora_id,
    store_id,
    pin_hash,
    tentativas_falhas,
    bloqueado_ate,
    resetado_por,
    resetado_em,
    criado_em,
    atualizado_em
  )
  VALUES (
    p_colaboradora_id,
    v_store_id,
    v_pin_hash,
    0,
    NULL,
    p_admin_id,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (colaboradora_id)
  DO UPDATE SET
    pin_hash = v_pin_hash,
    tentativas_falhas = 0,
    bloqueado_ate = NULL,
    resetado_por = p_admin_id,
    resetado_em = NOW(),
    atualizado_em = NOW(),
    reset_token = NULL,
    reset_token_expires = NULL;
  
  -- Registrar auditoria
  INSERT INTO sistemaretiradas.time_clock_pin_audit_log (
    colaboradora_id,
    store_id,
    operacao,
    executado_por,
    detalhes
  )
  VALUES (
    p_colaboradora_id,
    v_store_id,
    'RESET_ADMIN',
    p_admin_id,
    jsonb_build_object('timestamp', NOW())
  );
  
  RETURN TRUE;
END;
$$;

-- Funcao para gerar token de reset por email
CREATE OR REPLACE FUNCTION sistemaretiradas.generate_pin_reset_token(
  p_colaboradora_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token TEXT;
  v_store_id UUID;
BEGIN
  -- Gerar token aleatorio (8 digitos)
  v_token := lpad(floor(random() * 100000000)::text, 8, '0');
  
  -- Buscar store_id
  SELECT store_id INTO v_store_id
  FROM sistemaretiradas.profiles
  WHERE id = p_colaboradora_id;
  
  -- Atualizar token (expira em 1 hora)
  UPDATE sistemaretiradas.time_clock_signature_pins
  SET 
    reset_token = crypt(v_token, gen_salt('bf', 10)),
    reset_token_expires = NOW() + INTERVAL '1 hour',
    atualizado_em = NOW()
  WHERE colaboradora_id = p_colaboradora_id;
  
  -- Se nao existe registro, criar um temporario
  IF NOT FOUND THEN
    INSERT INTO sistemaretiradas.time_clock_signature_pins (
      colaboradora_id,
      store_id,
      pin_hash,
      reset_token,
      reset_token_expires
    )
    VALUES (
      p_colaboradora_id,
      v_store_id,
      'PENDING_RESET',
      crypt(v_token, gen_salt('bf', 10)),
      NOW() + INTERVAL '1 hour'
    );
  END IF;
  
  RETURN v_token;
END;
$$;

-- Funcao para validar token de reset e definir novo PIN
CREATE OR REPLACE FUNCTION sistemaretiradas.reset_pin_with_token(
  p_colaboradora_id UUID,
  p_token TEXT,
  p_new_pin TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record RECORD;
  v_pin_hash TEXT;
BEGIN
  -- Validar PIN (6-8 digitos numericos)
  IF NOT p_new_pin ~ '^\d{6,8}$' THEN
    RETURN QUERY SELECT FALSE, 'PIN deve ter entre 6 e 8 digitos numericos'::TEXT;
    RETURN;
  END IF;
  
  -- Buscar registro
  SELECT * INTO v_record
  FROM sistemaretiradas.time_clock_signature_pins
  WHERE colaboradora_id = p_colaboradora_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Colaboradora nao encontrada'::TEXT;
    RETURN;
  END IF;
  
  -- Verificar token
  IF v_record.reset_token IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Nenhum token de reset pendente'::TEXT;
    RETURN;
  END IF;
  
  -- Verificar se expirou
  IF v_record.reset_token_expires < NOW() THEN
    -- Limpar token expirado
    UPDATE sistemaretiradas.time_clock_signature_pins
    SET reset_token = NULL, reset_token_expires = NULL
    WHERE colaboradora_id = p_colaboradora_id;
    
    RETURN QUERY SELECT FALSE, 'Token expirado. Solicite um novo.'::TEXT;
    RETURN;
  END IF;
  
  -- Validar token
  IF v_record.reset_token != crypt(p_token, v_record.reset_token) THEN
    RETURN QUERY SELECT FALSE, 'Token invalido'::TEXT;
    RETURN;
  END IF;
  
  -- Token valido - criar novo hash do PIN
  v_pin_hash := crypt(p_new_pin, gen_salt('bf', 10));
  
  -- Atualizar PIN
  UPDATE sistemaretiradas.time_clock_signature_pins
  SET
    pin_hash = v_pin_hash,
    tentativas_falhas = 0,
    bloqueado_ate = NULL,
    reset_token = NULL,
    reset_token_expires = NULL,
    atualizado_em = NOW()
  WHERE colaboradora_id = p_colaboradora_id;
  
  -- Registrar auditoria
  INSERT INTO sistemaretiradas.time_clock_pin_audit_log (
    colaboradora_id,
    store_id,
    operacao,
    detalhes
  )
  VALUES (
    p_colaboradora_id,
    v_record.store_id,
    'RESET_EMAIL',
    jsonb_build_object('timestamp', NOW())
  );
  
  RETURN QUERY SELECT TRUE, 'PIN alterado com sucesso'::TEXT;
END;
$$;

-- Funcao para obter status do PIN (para admin)
CREATE OR REPLACE FUNCTION sistemaretiradas.get_pin_status(
  p_colaboradora_id UUID
)
RETURNS TABLE(
  has_pin BOOLEAN,
  is_blocked BOOLEAN,
  blocked_until TIMESTAMPTZ,
  failed_attempts INTEGER,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  reset_by UUID,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as has_pin,
    (p.bloqueado_ate IS NOT NULL AND p.bloqueado_ate > NOW()) as is_blocked,
    p.bloqueado_ate as blocked_until,
    p.tentativas_falhas as failed_attempts,
    p.ultimo_uso as last_used,
    p.criado_em as created_at,
    p.resetado_por as reset_by,
    p.resetado_em as reset_at
  FROM sistemaretiradas.time_clock_signature_pins p
  WHERE p.colaboradora_id = p_colaboradora_id;
  
  -- Se nao encontrou, retornar status vazio
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE as has_pin,
      FALSE as is_blocked,
      NULL::TIMESTAMPTZ as blocked_until,
      0 as failed_attempts,
      NULL::TIMESTAMPTZ as last_used,
      NULL::TIMESTAMPTZ as created_at,
      NULL::UUID as reset_by,
      NULL::TIMESTAMPTZ as reset_at;
  END IF;
END;
$$;

-- =====================================================
-- PARTE 5: POLITICAS RLS
-- =====================================================

ALTER TABLE sistemaretiradas.time_clock_signature_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.time_clock_digital_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.time_clock_pin_audit_log ENABLE ROW LEVEL SECURITY;

-- Politicas para PINs
DROP POLICY IF EXISTS "colaboradora_view_own_pin" ON sistemaretiradas.time_clock_signature_pins;
CREATE POLICY "colaboradora_view_own_pin" ON sistemaretiradas.time_clock_signature_pins
  FOR SELECT
  USING (colaboradora_id = auth.uid());

DROP POLICY IF EXISTS "admin_view_store_pins" ON sistemaretiradas.time_clock_signature_pins;
CREATE POLICY "admin_view_store_pins" ON sistemaretiradas.time_clock_signature_pins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = time_clock_signature_pins.store_id))
    )
  );

-- Politicas para assinaturas
DROP POLICY IF EXISTS "colaboradora_view_own_signatures" ON sistemaretiradas.time_clock_digital_signatures;
CREATE POLICY "colaboradora_view_own_signatures" ON sistemaretiradas.time_clock_digital_signatures
  FOR SELECT
  USING (colaboradora_id = auth.uid());

DROP POLICY IF EXISTS "colaboradora_insert_own_signatures" ON sistemaretiradas.time_clock_digital_signatures;
CREATE POLICY "colaboradora_insert_own_signatures" ON sistemaretiradas.time_clock_digital_signatures
  FOR INSERT
  WITH CHECK (colaboradora_id = auth.uid());

DROP POLICY IF EXISTS "admin_view_all_signatures" ON sistemaretiradas.time_clock_digital_signatures;
CREATE POLICY "admin_view_all_signatures" ON sistemaretiradas.time_clock_digital_signatures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = time_clock_digital_signatures.store_id))
    )
  );

-- Politicas para auditoria (somente leitura para admins)
DROP POLICY IF EXISTS "admin_view_audit_logs" ON sistemaretiradas.time_clock_pin_audit_log;
CREATE POLICY "admin_view_audit_logs" ON sistemaretiradas.time_clock_pin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = time_clock_pin_audit_log.store_id))
    )
  );

-- =====================================================
-- PARTE 6: COMENTARIOS
-- =====================================================

COMMENT ON TABLE sistemaretiradas.time_clock_records IS 'Registros de ponto dos colaboradores (entrada, saida, intervalos)';
COMMENT ON TABLE sistemaretiradas.time_clock_signature_pins IS 'PINs de assinatura digital para registro de ponto (REP-P). PIN e diferente da senha de acesso ao sistema.';
COMMENT ON COLUMN sistemaretiradas.time_clock_signature_pins.pin_hash IS 'Hash bcrypt do PIN de 6-8 digitos';
COMMENT ON COLUMN sistemaretiradas.time_clock_signature_pins.tentativas_falhas IS 'Contador de tentativas falhas para bloqueio (max 5)';
COMMENT ON COLUMN sistemaretiradas.time_clock_signature_pins.bloqueado_ate IS 'Timestamp ate quando o PIN esta bloqueado (15 min apos 5 falhas)';
COMMENT ON COLUMN sistemaretiradas.time_clock_signature_pins.reset_token IS 'Token para reset por email (hash bcrypt)';
COMMENT ON COLUMN sistemaretiradas.time_clock_signature_pins.reset_token_expires IS 'Expiracao do token de reset (1 hora)';

COMMENT ON TABLE sistemaretiradas.time_clock_digital_signatures IS 'Assinaturas digitais de cada registro de ponto (REP-P Portaria 671/2021)';
COMMENT ON COLUMN sistemaretiradas.time_clock_digital_signatures.rep_identity IS 'Identificador unico REP-P para auditoria';

COMMENT ON TABLE sistemaretiradas.time_clock_pin_audit_log IS 'Log de auditoria de operacoes com PIN de assinatura digital';
COMMENT ON COLUMN sistemaretiradas.time_clock_pin_audit_log.operacao IS 'Tipo: CRIACAO, ALTERACAO, RESET_ADMIN, RESET_EMAIL, TENTATIVA_FALHA, BLOQUEIO, DESBLOQUEIO, VALIDACAO_SUCESSO';
