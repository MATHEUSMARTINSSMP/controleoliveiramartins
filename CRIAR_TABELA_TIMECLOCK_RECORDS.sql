-- =====================================================
-- TABELA BASE DE REGISTROS DE PONTO
-- Execute PRIMEIRO antes de time_clock_digital_signatures
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE INDEX IF NOT EXISTS idx_tcr_store ON sistemaretiradas.time_clock_records(store_id);
CREATE INDEX IF NOT EXISTS idx_tcr_colaboradora ON sistemaretiradas.time_clock_records(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_tcr_horario ON sistemaretiradas.time_clock_records(horario DESC);
CREATE INDEX IF NOT EXISTS idx_tcr_tipo ON sistemaretiradas.time_clock_records(tipo_registro);

ALTER TABLE sistemaretiradas.time_clock_records ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "colaboradora_own_records" ON sistemaretiradas.time_clock_records;
DROP POLICY IF EXISTS "admin_store_records" ON sistemaretiradas.time_clock_records;

CREATE POLICY "colaboradora_own_records" ON sistemaretiradas.time_clock_records
  FOR ALL
  USING (colaboradora_id = auth.uid());

CREATE POLICY "admin_store_records" ON sistemaretiradas.time_clock_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = time_clock_records.store_id))
    )
  );

COMMENT ON TABLE sistemaretiradas.time_clock_records IS 'Registros de ponto dos colaboradores (entrada, saida, intervalos)';

