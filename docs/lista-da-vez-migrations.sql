-- =====================================================
-- LISTA DA VEZ - Migrations SQL para Supabase
-- Execute estas queries no SQL Editor do Supabase
-- =====================================================

-- 1. TABELA: queue_sessions (Sessoes de Fila por Dia/Turno)
CREATE TABLE IF NOT EXISTS sistemaretiradas.queue_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES sistemaretiradas.tenants(id),
  loja_id UUID NOT NULL REFERENCES sistemaretiradas.lojas(id),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift VARCHAR(20) DEFAULT 'integral',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(loja_id, session_date, shift)
);

-- 2. TABELA: queue_members (Estado Atual na Fila)
CREATE TABLE IF NOT EXISTS sistemaretiradas.queue_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sistemaretiradas.queue_sessions(id) ON DELETE CASCADE,
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.colaboradoras(id),
  status VARCHAR(30) DEFAULT 'disponivel',
  pause_reason VARCHAR(50),
  position INTEGER NOT NULL DEFAULT 0,
  check_in_at TIMESTAMPTZ DEFAULT NOW(),
  check_out_at TIMESTAMPTZ,
  last_status_change TIMESTAMPTZ DEFAULT NOW(),
  total_available_time INTEGER DEFAULT 0,
  total_busy_time INTEGER DEFAULT 0,
  total_unavailable_time INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA: loss_reasons (Motivos de Perda)
CREATE TABLE IF NOT EXISTS sistemaretiradas.loss_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES sistemaretiradas.tenants(id),
  loja_id UUID REFERENCES sistemaretiradas.lojas(id),
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA: attendances (Atendimentos)
CREATE TABLE IF NOT EXISTS sistemaretiradas.attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES sistemaretiradas.tenants(id),
  loja_id UUID NOT NULL REFERENCES sistemaretiradas.lojas(id),
  session_id UUID REFERENCES sistemaretiradas.queue_sessions(id),
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.colaboradoras(id),
  transferred_from UUID REFERENCES sistemaretiradas.colaboradoras(id),
  transfer_reason VARCHAR(255),
  cliente_id UUID,
  cliente_nome VARCHAR(255),
  cliente_telefone VARCHAR(20),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status VARCHAR(20) DEFAULT 'em_andamento',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA: attendance_outcomes (Resultado do Atendimento)
CREATE TABLE IF NOT EXISTS sistemaretiradas.attendance_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES sistemaretiradas.attendances(id) ON DELETE CASCADE,
  result VARCHAR(20) NOT NULL,
  sale_value DECIMAL(12,2),
  items_count INTEGER,
  categories JSONB,
  loss_reason_id UUID REFERENCES sistemaretiradas.loss_reasons(id),
  loss_reason_other VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA: queue_events (Auditoria/Log)
CREATE TABLE IF NOT EXISTS sistemaretiradas.queue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sistemaretiradas.queue_sessions(id) ON DELETE CASCADE,
  member_id UUID REFERENCES sistemaretiradas.queue_members(id),
  attendance_id UUID REFERENCES sistemaretiradas.attendances(id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  performed_by UUID REFERENCES sistemaretiradas.colaboradoras(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELA: queue_store_settings (Configuracoes por Loja)
CREATE TABLE IF NOT EXISTS sistemaretiradas.queue_store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES sistemaretiradas.tenants(id),
  loja_id UUID NOT NULL REFERENCES sistemaretiradas.lojas(id) UNIQUE,
  entry_position VARCHAR(20) DEFAULT 'end',
  return_position VARCHAR(20) DEFAULT 'end',
  cooldown_minutes INTEGER DEFAULT 0,
  allowed_pause_types JSONB DEFAULT '["almoco", "estoque", "caixa"]',
  pause_requires_justification BOOLEAN DEFAULT false,
  max_pause_minutes JSONB DEFAULT '{"almoco": 60, "estoque": 15, "caixa": 30}',
  transfer_allowed BOOLEAN DEFAULT true,
  transfer_requires_reason BOOLEAN DEFAULT true,
  transfer_counts_for VARCHAR(20) DEFAULT 'receiver',
  manager_can_pull_anyone BOOLEAN DEFAULT true,
  seller_can_self_pull BOOLEAN DEFAULT false,
  require_loss_reason BOOLEAN DEFAULT true,
  require_sale_value BOOLEAN DEFAULT true,
  require_category BOOLEAN DEFAULT false,
  attendance_categories JSONB DEFAULT '["sutia", "calcinha", "pijama", "pos_cirurgico", "fitness"]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_queue_sessions_loja_date ON sistemaretiradas.queue_sessions(loja_id, session_date);
CREATE INDEX IF NOT EXISTS idx_queue_members_session ON sistemaretiradas.queue_members(session_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_members_colaboradora ON sistemaretiradas.queue_members(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_attendances_session ON sistemaretiradas.attendances(session_id);
CREATE INDEX IF NOT EXISTS idx_attendances_colaboradora ON sistemaretiradas.attendances(colaboradora_id, started_at);
CREATE INDEX IF NOT EXISTS idx_attendances_loja_date ON sistemaretiradas.attendances(loja_id, started_at);
CREATE INDEX IF NOT EXISTS idx_queue_events_session ON sistemaretiradas.queue_events(session_id, created_at);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE sistemaretiradas.queue_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.queue_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.attendance_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.loss_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.queue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.queue_store_settings ENABLE ROW LEVEL SECURITY;

-- Policies usando auth.uid() para Supabase
CREATE POLICY queue_sessions_policy ON sistemaretiradas.queue_sessions FOR ALL 
  USING (tenant_id IN (SELECT tenant_id FROM sistemaretiradas.profiles WHERE id = auth.uid()));

CREATE POLICY queue_members_policy ON sistemaretiradas.queue_members FOR ALL 
  USING (session_id IN (
    SELECT qs.id FROM sistemaretiradas.queue_sessions qs 
    WHERE qs.tenant_id IN (SELECT tenant_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
  ));

CREATE POLICY attendances_policy ON sistemaretiradas.attendances FOR ALL 
  USING (tenant_id IN (SELECT tenant_id FROM sistemaretiradas.profiles WHERE id = auth.uid()));

CREATE POLICY attendance_outcomes_policy ON sistemaretiradas.attendance_outcomes FOR ALL 
  USING (attendance_id IN (
    SELECT a.id FROM sistemaretiradas.attendances a 
    WHERE a.tenant_id IN (SELECT tenant_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
  ));

CREATE POLICY loss_reasons_policy ON sistemaretiradas.loss_reasons FOR ALL 
  USING (tenant_id IS NULL OR tenant_id IN (SELECT tenant_id FROM sistemaretiradas.profiles WHERE id = auth.uid()));

CREATE POLICY queue_events_policy ON sistemaretiradas.queue_events FOR ALL 
  USING (session_id IN (
    SELECT qs.id FROM sistemaretiradas.queue_sessions qs 
    WHERE qs.tenant_id IN (SELECT tenant_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
  ));

CREATE POLICY queue_store_settings_policy ON sistemaretiradas.queue_store_settings FOR ALL 
  USING (tenant_id IN (SELECT tenant_id FROM sistemaretiradas.profiles WHERE id = auth.uid()));

-- =====================================================
-- MOTIVOS DE PERDA PADRAO (Globais)
-- =====================================================

INSERT INTO sistemaretiradas.loss_reasons (tenant_id, name, description, display_order) VALUES
(NULL, 'Preco alto', 'Cliente achou caro', 1),
(NULL, 'Falta de tamanho', 'Nao tinha o tamanho do cliente', 2),
(NULL, 'Falta de estoque', 'Produto indisponivel', 3),
(NULL, 'So olhando', 'Cliente estava apenas olhando', 4),
(NULL, 'Nao gostou', 'Cliente nao gostou do produto', 5),
(NULL, 'Vai pensar', 'Cliente disse que vai pensar', 6),
(NULL, 'Comprou em outro lugar', 'Cliente ja comprou em outro local', 7),
(NULL, 'Outro', 'Outro motivo', 99)
ON CONFLICT DO NOTHING;

-- =====================================================
-- FUNCOES UTEIS
-- =====================================================

-- Funcao para obter ou criar sessao do dia
CREATE OR REPLACE FUNCTION sistemaretiradas.get_or_create_queue_session(
  p_loja_id UUID,
  p_tenant_id UUID,
  p_shift VARCHAR DEFAULT 'integral'
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  SELECT id INTO v_session_id
  FROM sistemaretiradas.queue_sessions
  WHERE loja_id = p_loja_id
    AND session_date = CURRENT_DATE
    AND shift = p_shift
    AND status = 'active';
  
  IF v_session_id IS NULL THEN
    INSERT INTO sistemaretiradas.queue_sessions (tenant_id, loja_id, shift)
    VALUES (p_tenant_id, p_loja_id, p_shift)
    RETURNING id INTO v_session_id;
  END IF;
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funcao para calcular proxima posicao na fila
CREATE OR REPLACE FUNCTION sistemaretiradas.get_next_queue_position(p_session_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(MAX(position), 0) + 1
  FROM sistemaretiradas.queue_members
  WHERE session_id = p_session_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Funcao para pegar proximo da fila
CREATE OR REPLACE FUNCTION sistemaretiradas.get_next_in_queue(p_session_id UUID)
RETURNS UUID AS $$
  SELECT colaboradora_id
  FROM sistemaretiradas.queue_members
  WHERE session_id = p_session_id
    AND status = 'disponivel'
  ORDER BY position ASC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
