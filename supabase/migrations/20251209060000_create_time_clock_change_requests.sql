-- =====================================================
-- TABELA DE SOLICITAÇÕES DE ALTERAÇÃO DE REGISTRO DE PONTO
-- Permite que colaboradoras solicitem alterações de horário
-- Admin/Loja pode aprovar ou rejeitar
-- =====================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referências
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
  
  -- Registro original que será alterado
  registro_original_id UUID NOT NULL REFERENCES sistemaretiradas.time_clock_records(id) ON DELETE CASCADE,
  tipo_registro_original TEXT NOT NULL CHECK (tipo_registro_original IN ('ENTRADA', 'SAIDA_INTERVALO', 'ENTRADA_INTERVALO', 'SAIDA')),
  
  -- Horários
  horario_original TIMESTAMP WITH TIME ZONE NOT NULL,
  horario_solicitado TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Motivo da solicitação
  motivo TEXT NOT NULL,
  
  -- Status da solicitação
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADO', 'REJEITADO')),
  
  -- Análise pelo admin
  analisado_por UUID REFERENCES sistemaretiradas.profiles(id),
  analisado_em TIMESTAMP WITH TIME ZONE,
  justificativa_analise TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tccr_store ON sistemaretiradas.time_clock_change_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_tccr_colaboradora ON sistemaretiradas.time_clock_change_requests(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_tccr_registro ON sistemaretiradas.time_clock_change_requests(registro_original_id);
CREATE INDEX IF NOT EXISTS idx_tccr_status ON sistemaretiradas.time_clock_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_tccr_created_at ON sistemaretiradas.time_clock_change_requests(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE sistemaretiradas.time_clock_change_requests ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "colaboradora_own_requests" ON sistemaretiradas.time_clock_change_requests;
DROP POLICY IF EXISTS "admin_store_requests" ON sistemaretiradas.time_clock_change_requests;
DROP POLICY IF EXISTS "colaboradora_insert_requests" ON sistemaretiradas.time_clock_change_requests;

-- Política: Colaboradora pode ver suas próprias solicitações
CREATE POLICY "colaboradora_own_requests" ON sistemaretiradas.time_clock_change_requests
  FOR SELECT
  USING (colaboradora_id = auth.uid());

-- Política: Admin/Loja pode ver todas as solicitações da loja
CREATE POLICY "admin_store_requests" ON sistemaretiradas.time_clock_change_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = time_clock_change_requests.store_id))
    )
  );

-- Política: Colaboradora pode criar solicitações para seus próprios registros
CREATE POLICY "colaboradora_insert_requests" ON sistemaretiradas.time_clock_change_requests
  FOR INSERT
  WITH CHECK (
    colaboradora_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sistemaretiradas.time_clock_records tcr
      WHERE tcr.id = registro_original_id
      AND tcr.colaboradora_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION sistemaretiradas.update_time_clock_change_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_time_clock_change_requests_updated_at ON sistemaretiradas.time_clock_change_requests;

CREATE TRIGGER trigger_update_time_clock_change_requests_updated_at
  BEFORE UPDATE ON sistemaretiradas.time_clock_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_time_clock_change_requests_updated_at();

COMMENT ON TABLE sistemaretiradas.time_clock_change_requests IS 'Solicitações de alteração de registro de ponto feitas por colaboradoras';
COMMENT ON COLUMN sistemaretiradas.time_clock_change_requests.status IS 'Status: PENDENTE, APROVADO ou REJEITADO';
COMMENT ON COLUMN sistemaretiradas.time_clock_change_requests.motivo IS 'Motivo da solicitação de alteração informado pela colaboradora';
COMMENT ON COLUMN sistemaretiradas.time_clock_change_requests.justificativa_analise IS 'Justificativa do admin ao aprovar ou rejeitar';

