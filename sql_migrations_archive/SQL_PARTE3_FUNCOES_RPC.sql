-- =====================================================
-- PARTE 3: FUNCOES RPC PARA PIN
-- Execute DEPOIS da PARTE 2
-- =====================================================

-- Funcao para criar/atualizar PIN
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
  IF NOT p_pin ~ '^\d{6,8}$' THEN
    RAISE EXCEPTION 'PIN deve ter entre 6 e 8 digitos numericos';
  END IF;
  
  v_pin_hash := crypt(p_pin, gen_salt('bf', 10));
  
  IF NOT EXISTS (SELECT 1 FROM sistemaretiradas.time_clock_signature_pins WHERE colaboradora_id = p_colaboradora_id) THEN
    v_is_new := TRUE;
  END IF;
  
  INSERT INTO sistemaretiradas.time_clock_signature_pins (
    colaboradora_id, store_id, pin_hash, tentativas_falhas, bloqueado_ate, criado_em, atualizado_em
  ) VALUES (
    p_colaboradora_id, p_store_id, v_pin_hash, 0, NULL, NOW(), NOW()
  )
  ON CONFLICT (colaboradora_id)
  DO UPDATE SET
    pin_hash = v_pin_hash,
    tentativas_falhas = 0,
    bloqueado_ate = NULL,
    atualizado_em = NOW(),
    reset_token = NULL,
    reset_token_expires = NULL;
  
  INSERT INTO sistemaretiradas.time_clock_pin_audit_log (
    colaboradora_id, store_id, operacao, detalhes
  ) VALUES (
    p_colaboradora_id, p_store_id,
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
RETURNS TABLE(valido BOOLEAN, mensagem TEXT, bloqueado BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record RECORD;
  v_max_tentativas INTEGER := 5;
  v_tempo_bloqueio INTERVAL := '15 minutes';
BEGIN
  SELECT * INTO v_record
  FROM sistemaretiradas.time_clock_signature_pins
  WHERE colaboradora_id = p_colaboradora_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'PIN nao cadastrado. Configure seu PIN primeiro.'::TEXT, FALSE;
    RETURN;
  END IF;
  
  IF v_record.bloqueado_ate IS NOT NULL AND v_record.bloqueado_ate > NOW() THEN
    RETURN QUERY SELECT FALSE, 
      format('PIN bloqueado. Tente novamente em %s minutos.', 
        CEIL(EXTRACT(EPOCH FROM (v_record.bloqueado_ate - NOW())) / 60)::INTEGER)::TEXT, 
      TRUE;
    RETURN;
  END IF;
  
  IF v_record.bloqueado_ate IS NOT NULL AND v_record.bloqueado_ate <= NOW() THEN
    UPDATE sistemaretiradas.time_clock_signature_pins
    SET bloqueado_ate = NULL, tentativas_falhas = 0
    WHERE colaboradora_id = p_colaboradora_id;
    
    INSERT INTO sistemaretiradas.time_clock_pin_audit_log (colaboradora_id, store_id, operacao, detalhes)
    VALUES (p_colaboradora_id, v_record.store_id, 'DESBLOQUEIO', jsonb_build_object('motivo', 'tempo_expirado'));
  END IF;
  
  IF v_record.pin_hash = crypt(p_pin, v_record.pin_hash) THEN
    UPDATE sistemaretiradas.time_clock_signature_pins
    SET tentativas_falhas = 0, bloqueado_ate = NULL, ultimo_uso = NOW()
    WHERE colaboradora_id = p_colaboradora_id;
    
    INSERT INTO sistemaretiradas.time_clock_pin_audit_log (colaboradora_id, store_id, operacao, detalhes)
    VALUES (p_colaboradora_id, v_record.store_id, 'VALIDACAO_SUCESSO', jsonb_build_object('timestamp', NOW()));
    
    RETURN QUERY SELECT TRUE, 'PIN validado com sucesso.'::TEXT, FALSE;
  ELSE
    UPDATE sistemaretiradas.time_clock_signature_pins
    SET 
      tentativas_falhas = tentativas_falhas + 1,
      bloqueado_ate = CASE 
        WHEN tentativas_falhas + 1 >= v_max_tentativas THEN NOW() + v_tempo_bloqueio
        ELSE bloqueado_ate
      END,
      atualizado_em = NOW()
    WHERE colaboradora_id = p_colaboradora_id;
    
    INSERT INTO sistemaretiradas.time_clock_pin_audit_log (colaboradora_id, store_id, operacao, detalhes)
    VALUES (p_colaboradora_id, v_record.store_id, 'TENTATIVA_FALHA', jsonb_build_object('tentativa', v_record.tentativas_falhas + 1));
    
    IF v_record.tentativas_falhas + 1 >= v_max_tentativas THEN
      INSERT INTO sistemaretiradas.time_clock_pin_audit_log (colaboradora_id, store_id, operacao, detalhes)
      VALUES (p_colaboradora_id, v_record.store_id, 'BLOQUEIO', jsonb_build_object('duracao_minutos', 15));
      
      RETURN QUERY SELECT FALSE, 'PIN incorreto. Limite atingido. Bloqueado por 15 minutos.'::TEXT, TRUE;
    ELSE
      RETURN QUERY SELECT FALSE, 
        format('PIN incorreto. Tentativas restantes: %s', v_max_tentativas - v_record.tentativas_falhas - 1)::TEXT, 
        FALSE;
    END IF;
  END IF;
END;
$$;

-- Funcao para verificar se tem PIN
CREATE OR REPLACE FUNCTION sistemaretiradas.has_signature_pin(p_colaboradora_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM sistemaretiradas.time_clock_signature_pins WHERE colaboradora_id = p_colaboradora_id);
END;
$$;

-- Funcao para admin resetar PIN
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
  IF NOT p_new_pin ~ '^\d{6,8}$' THEN
    RAISE EXCEPTION 'PIN deve ter entre 6 e 8 digitos numericos';
  END IF;
  
  SELECT store_id INTO v_store_id FROM sistemaretiradas.profiles WHERE id = p_colaboradora_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Colaboradora nao encontrada'; END IF;
  
  v_pin_hash := crypt(p_new_pin, gen_salt('bf', 10));
  
  INSERT INTO sistemaretiradas.time_clock_signature_pins (
    colaboradora_id, store_id, pin_hash, tentativas_falhas, bloqueado_ate, resetado_por, resetado_em, criado_em, atualizado_em
  ) VALUES (
    p_colaboradora_id, v_store_id, v_pin_hash, 0, NULL, p_admin_id, NOW(), NOW(), NOW()
  )
  ON CONFLICT (colaboradora_id)
  DO UPDATE SET
    pin_hash = v_pin_hash, tentativas_falhas = 0, bloqueado_ate = NULL,
    resetado_por = p_admin_id, resetado_em = NOW(), atualizado_em = NOW(),
    reset_token = NULL, reset_token_expires = NULL;
  
  INSERT INTO sistemaretiradas.time_clock_pin_audit_log (colaboradora_id, store_id, operacao, executado_por, detalhes)
  VALUES (p_colaboradora_id, v_store_id, 'RESET_ADMIN', p_admin_id, jsonb_build_object('timestamp', NOW()));
  
  RETURN TRUE;
END;
$$;

-- Funcao para gerar token de reset por email
CREATE OR REPLACE FUNCTION sistemaretiradas.generate_pin_reset_token(p_colaboradora_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token TEXT;
  v_store_id UUID;
BEGIN
  v_token := lpad(floor(random() * 100000000)::text, 8, '0');
  SELECT store_id INTO v_store_id FROM sistemaretiradas.profiles WHERE id = p_colaboradora_id;
  
  UPDATE sistemaretiradas.time_clock_signature_pins
  SET reset_token = crypt(v_token, gen_salt('bf', 10)), reset_token_expires = NOW() + INTERVAL '1 hour', atualizado_em = NOW()
  WHERE colaboradora_id = p_colaboradora_id;
  
  IF NOT FOUND THEN
    INSERT INTO sistemaretiradas.time_clock_signature_pins (colaboradora_id, store_id, pin_hash, reset_token, reset_token_expires)
    VALUES (p_colaboradora_id, v_store_id, 'PENDING_RESET', crypt(v_token, gen_salt('bf', 10)), NOW() + INTERVAL '1 hour');
  END IF;
  
  RETURN v_token;
END;
$$;

-- Funcao para validar token e definir novo PIN
CREATE OR REPLACE FUNCTION sistemaretiradas.reset_pin_with_token(
  p_colaboradora_id UUID,
  p_token TEXT,
  p_new_pin TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record RECORD;
  v_pin_hash TEXT;
BEGIN
  IF NOT p_new_pin ~ '^\d{6,8}$' THEN
    RETURN QUERY SELECT FALSE, 'PIN deve ter entre 6 e 8 digitos numericos'::TEXT;
    RETURN;
  END IF;
  
  SELECT * INTO v_record FROM sistemaretiradas.time_clock_signature_pins WHERE colaboradora_id = p_colaboradora_id;
  
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 'Colaboradora nao encontrada'::TEXT; RETURN; END IF;
  IF v_record.reset_token IS NULL THEN RETURN QUERY SELECT FALSE, 'Nenhum token de reset pendente'::TEXT; RETURN; END IF;
  
  IF v_record.reset_token_expires < NOW() THEN
    UPDATE sistemaretiradas.time_clock_signature_pins SET reset_token = NULL, reset_token_expires = NULL WHERE colaboradora_id = p_colaboradora_id;
    RETURN QUERY SELECT FALSE, 'Token expirado. Solicite um novo.'::TEXT;
    RETURN;
  END IF;
  
  IF v_record.reset_token != crypt(p_token, v_record.reset_token) THEN
    RETURN QUERY SELECT FALSE, 'Token invalido'::TEXT;
    RETURN;
  END IF;
  
  v_pin_hash := crypt(p_new_pin, gen_salt('bf', 10));
  
  UPDATE sistemaretiradas.time_clock_signature_pins
  SET pin_hash = v_pin_hash, tentativas_falhas = 0, bloqueado_ate = NULL, reset_token = NULL, reset_token_expires = NULL, atualizado_em = NOW()
  WHERE colaboradora_id = p_colaboradora_id;
  
  INSERT INTO sistemaretiradas.time_clock_pin_audit_log (colaboradora_id, store_id, operacao, detalhes)
  VALUES (p_colaboradora_id, v_record.store_id, 'RESET_EMAIL', jsonb_build_object('timestamp', NOW()));
  
  RETURN QUERY SELECT TRUE, 'PIN alterado com sucesso'::TEXT;
END;
$$;

-- Funcao para obter status do PIN
CREATE OR REPLACE FUNCTION sistemaretiradas.get_pin_status(p_colaboradora_id UUID)
RETURNS TABLE(has_pin BOOLEAN, is_blocked BOOLEAN, blocked_until TIMESTAMPTZ, failed_attempts INTEGER, last_used TIMESTAMPTZ, created_at TIMESTAMPTZ, reset_by UUID, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE, (p.bloqueado_ate IS NOT NULL AND p.bloqueado_ate > NOW()),
    p.bloqueado_ate, p.tentativas_falhas, p.ultimo_uso, p.criado_em, p.resetado_por, p.resetado_em
  FROM sistemaretiradas.time_clock_signature_pins p
  WHERE p.colaboradora_id = p_colaboradora_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::TIMESTAMPTZ, 0, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::UUID, NULL::TIMESTAMPTZ;
  END IF;
END;
$$;
