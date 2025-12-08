-- =====================================================
-- SQL PARA PIN DE ASSINATURA DIGITAL (REP-P)
-- Portaria 671/2021 - PIN separado da senha de acesso
-- =====================================================

-- Tabela para armazenar o PIN de assinatura digital de cada colaboradora
CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_signature_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  
  -- Hash do PIN (6-8 digitos) usando pgcrypto
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
  
  -- Unico por colaboradora
  CONSTRAINT unique_pin_per_colaboradora UNIQUE(colaboradora_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_signature_pins_colaboradora 
  ON sistemaretiradas.time_clock_signature_pins(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_signature_pins_store 
  ON sistemaretiradas.time_clock_signature_pins(store_id);

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
BEGIN
  -- Validar PIN (6-8 digitos numericos)
  IF NOT p_pin ~ '^\d{6,8}$' THEN
    RAISE EXCEPTION 'PIN deve ter entre 6 e 8 digitos numericos';
  END IF;
  
  -- Criar hash do PIN
  v_pin_hash := crypt(p_pin, gen_salt('bf', 10));
  
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
    atualizado_em = NOW();
  
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
        EXTRACT(MINUTE FROM (v_record.bloqueado_ate - NOW()))::INTEGER + 1)::TEXT, 
      TRUE;
    RETURN;
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
    
    -- Verificar se atingiu limite
    IF v_record.tentativas_falhas + 1 >= v_max_tentativas THEN
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
CREATE OR REPLACE FUNCTION sistemaretiradas.reset_signature_pin(
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
BEGIN
  -- Validar PIN (6-8 digitos numericos)
  IF NOT p_new_pin ~ '^\d{6,8}$' THEN
    RAISE EXCEPTION 'PIN deve ter entre 6 e 8 digitos numericos';
  END IF;
  
  -- Criar hash do PIN
  v_pin_hash := crypt(p_new_pin, gen_salt('bf', 10));
  
  -- Atualizar PIN
  UPDATE sistemaretiradas.time_clock_signature_pins
  SET
    pin_hash = v_pin_hash,
    tentativas_falhas = 0,
    bloqueado_ate = NULL,
    resetado_por = p_admin_id,
    resetado_em = NOW(),
    atualizado_em = NOW()
  WHERE colaboradora_id = p_colaboradora_id;
  
  -- Se nao existia, criar
  IF NOT FOUND THEN
    INSERT INTO sistemaretiradas.time_clock_signature_pins (
      colaboradora_id,
      store_id,
      pin_hash,
      resetado_por,
      resetado_em
    )
    SELECT 
      p_colaboradora_id,
      store_id,
      v_pin_hash,
      p_admin_id,
      NOW()
    FROM sistemaretiradas.profiles
    WHERE id = p_colaboradora_id;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Politicas RLS
ALTER TABLE sistemaretiradas.time_clock_signature_pins ENABLE ROW LEVEL SECURITY;

-- Colaboradora pode ver apenas seu proprio PIN (mas nao o hash)
CREATE POLICY "colaboradora_view_own_pin" ON sistemaretiradas.time_clock_signature_pins
  FOR SELECT
  USING (colaboradora_id = auth.uid());

-- Admin/Loja podem ver PINs da sua loja
CREATE POLICY "admin_view_store_pins" ON sistemaretiradas.time_clock_signature_pins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = time_clock_signature_pins.store_id))
    )
  );

-- Comentarios
COMMENT ON TABLE sistemaretiradas.time_clock_signature_pins IS 'PINs de assinatura digital para registro de ponto (REP-P)';
COMMENT ON COLUMN sistemaretiradas.time_clock_signature_pins.pin_hash IS 'Hash bcrypt do PIN de 6-8 digitos';
COMMENT ON COLUMN sistemaretiradas.time_clock_signature_pins.tentativas_falhas IS 'Contador de tentativas falhas para bloqueio';
COMMENT ON COLUMN sistemaretiradas.time_clock_signature_pins.bloqueado_ate IS 'Timestamp ate quando o PIN esta bloqueado';
