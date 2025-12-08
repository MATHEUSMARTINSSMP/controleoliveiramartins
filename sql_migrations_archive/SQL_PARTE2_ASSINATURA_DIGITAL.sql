-- =====================================================
-- PARTE 2: SISTEMA DE ASSINATURA DIGITAL (PIN)
-- Execute DEPOIS da PARTE 1 (time_clock_records)
-- =====================================================

-- Tabela de PINs de assinatura digital
CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_signature_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  tentativas_falhas INTEGER DEFAULT 0,
  bloqueado_ate TIMESTAMPTZ,
  ultimo_uso TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  resetado_por UUID REFERENCES sistemaretiradas.profiles(id),
  resetado_em TIMESTAMPTZ,
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  CONSTRAINT unique_pin_per_colaboradora UNIQUE(colaboradora_id)
);

CREATE INDEX IF NOT EXISTS idx_signature_pins_colaboradora ON sistemaretiradas.time_clock_signature_pins(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_signature_pins_store ON sistemaretiradas.time_clock_signature_pins(store_id);
CREATE INDEX IF NOT EXISTS idx_signature_pins_reset_token ON sistemaretiradas.time_clock_signature_pins(reset_token) WHERE reset_token IS NOT NULL;

-- Tabela de assinaturas digitais
CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_digital_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_clock_record_id UUID NOT NULL REFERENCES sistemaretiradas.time_clock_records(id) ON DELETE CASCADE,
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  device_info JSONB,
  ip_address INET,
  user_agent TEXT,
  rep_identity TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_signature_per_record UNIQUE(time_clock_record_id)
);

CREATE INDEX IF NOT EXISTS idx_signatures_record ON sistemaretiradas.time_clock_digital_signatures(time_clock_record_id);
CREATE INDEX IF NOT EXISTS idx_signatures_colaboradora ON sistemaretiradas.time_clock_digital_signatures(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_signatures_store ON sistemaretiradas.time_clock_digital_signatures(store_id);
CREATE INDEX IF NOT EXISTS idx_signatures_signed_at ON sistemaretiradas.time_clock_digital_signatures(signed_at);

-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_pin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  operacao TEXT NOT NULL CHECK (operacao IN ('CRIACAO', 'ALTERACAO', 'RESET_ADMIN', 'RESET_EMAIL', 'TENTATIVA_FALHA', 'BLOQUEIO', 'DESBLOQUEIO', 'VALIDACAO_SUCESSO')),
  executado_por UUID REFERENCES sistemaretiradas.profiles(id),
  detalhes JSONB,
  ip_address INET,
  user_agent TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pin_audit_colaboradora ON sistemaretiradas.time_clock_pin_audit_log(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_pin_audit_store ON sistemaretiradas.time_clock_pin_audit_log(store_id);
CREATE INDEX IF NOT EXISTS idx_pin_audit_operacao ON sistemaretiradas.time_clock_pin_audit_log(operacao);
CREATE INDEX IF NOT EXISTS idx_pin_audit_criado_em ON sistemaretiradas.time_clock_pin_audit_log(criado_em);

-- RLS
ALTER TABLE sistemaretiradas.time_clock_signature_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.time_clock_digital_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.time_clock_pin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "colaboradora_view_own_pin" ON sistemaretiradas.time_clock_signature_pins;
CREATE POLICY "colaboradora_view_own_pin" ON sistemaretiradas.time_clock_signature_pins
  FOR SELECT USING (colaboradora_id = auth.uid());

DROP POLICY IF EXISTS "admin_view_store_pins" ON sistemaretiradas.time_clock_signature_pins;
CREATE POLICY "admin_view_store_pins" ON sistemaretiradas.time_clock_signature_pins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = time_clock_signature_pins.store_id))
    )
  );

DROP POLICY IF EXISTS "colaboradora_view_own_signatures" ON sistemaretiradas.time_clock_digital_signatures;
CREATE POLICY "colaboradora_view_own_signatures" ON sistemaretiradas.time_clock_digital_signatures
  FOR SELECT USING (colaboradora_id = auth.uid());

DROP POLICY IF EXISTS "colaboradora_insert_own_signatures" ON sistemaretiradas.time_clock_digital_signatures;
CREATE POLICY "colaboradora_insert_own_signatures" ON sistemaretiradas.time_clock_digital_signatures
  FOR INSERT WITH CHECK (colaboradora_id = auth.uid());

DROP POLICY IF EXISTS "admin_view_all_signatures" ON sistemaretiradas.time_clock_digital_signatures;
CREATE POLICY "admin_view_all_signatures" ON sistemaretiradas.time_clock_digital_signatures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = time_clock_digital_signatures.store_id))
    )
  );

DROP POLICY IF EXISTS "admin_view_audit_logs" ON sistemaretiradas.time_clock_pin_audit_log;
CREATE POLICY "admin_view_audit_logs" ON sistemaretiradas.time_clock_pin_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = time_clock_pin_audit_log.store_id))
    )
  );
