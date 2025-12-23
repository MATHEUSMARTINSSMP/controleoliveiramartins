# Lista da Vez - Especificacao Tecnica

## Resumo
Sistema de fila de prioridade de atendimento para vendedores no salao de vendas, com registro de atendimentos e metricas de produtividade.

## Estados do Vendedor
- **Disponivel**: Na fila, pode ser o proximo
- **Em Atendimento**: Atendendo cliente
- **Indisponivel**: Pausa (almoco, estoque, caixa, pos-venda, treinamento)

---

## Tabelas Necessarias (Supabase - schema sistemaretiradas)

### 1. queue_sessions (Sessoes de Fila por Dia/Turno)
```sql
CREATE TABLE sistemaretiradas.queue_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES sistemaretiradas.tenants(id),
  loja_id UUID NOT NULL REFERENCES sistemaretiradas.lojas(id),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift VARCHAR(20) DEFAULT 'integral', -- 'manha', 'tarde', 'integral'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'closed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(loja_id, session_date, shift)
);
```

### 2. queue_members (Estado Atual na Fila)
```sql
CREATE TABLE sistemaretiradas.queue_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sistemaretiradas.queue_sessions(id),
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.colaboradoras(id),
  status VARCHAR(30) DEFAULT 'disponivel', -- 'disponivel', 'em_atendimento', 'indisponivel'
  pause_reason VARCHAR(50), -- 'almoco', 'estoque', 'caixa', 'pos_venda', 'treinamento', 'outro'
  position INTEGER NOT NULL DEFAULT 0,
  check_in_at TIMESTAMPTZ DEFAULT NOW(),
  check_out_at TIMESTAMPTZ,
  last_status_change TIMESTAMPTZ DEFAULT NOW(),
  total_available_time INTEGER DEFAULT 0, -- segundos
  total_busy_time INTEGER DEFAULT 0, -- segundos
  total_unavailable_time INTEGER DEFAULT 0, -- segundos
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. attendances (Atendimentos)
```sql
CREATE TABLE sistemaretiradas.attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES sistemaretiradas.tenants(id),
  loja_id UUID NOT NULL REFERENCES sistemaretiradas.lojas(id),
  session_id UUID REFERENCES sistemaretiradas.queue_sessions(id),
  colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.colaboradoras(id),
  transferred_from UUID REFERENCES sistemaretiradas.colaboradoras(id),
  transfer_reason VARCHAR(255),
  cliente_id UUID REFERENCES sistemaretiradas.clientes(id),
  cliente_nome VARCHAR(255),
  cliente_telefone VARCHAR(20),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status VARCHAR(20) DEFAULT 'em_andamento', -- 'em_andamento', 'finalizado', 'cancelado'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. attendance_outcomes (Resultado do Atendimento)
```sql
CREATE TABLE sistemaretiradas.attendance_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES sistemaretiradas.attendances(id),
  result VARCHAR(20) NOT NULL, -- 'venda', 'nao_vendeu'
  sale_value DECIMAL(12,2),
  items_count INTEGER,
  categories JSONB, -- ['sutia', 'calcinha', 'pijama']
  loss_reason_id UUID REFERENCES sistemaretiradas.loss_reasons(id),
  loss_reason_other VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. loss_reasons (Motivos de Perda - Configuravel por Loja)
```sql
CREATE TABLE sistemaretiradas.loss_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES sistemaretiradas.tenants(id),
  loja_id UUID REFERENCES sistemaretiradas.lojas(id), -- NULL = global para tenant
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Motivos padrao
INSERT INTO sistemaretiradas.loss_reasons (tenant_id, name, description, display_order) VALUES
(NULL, 'Preco alto', 'Cliente achou caro', 1),
(NULL, 'Falta de tamanho', 'Nao tinha o tamanho do cliente', 2),
(NULL, 'Falta de estoque', 'Produto indisponivel', 3),
(NULL, 'So olhando', 'Cliente estava apenas olhando', 4),
(NULL, 'Nao gostou', 'Cliente nao gostou do produto', 5),
(NULL, 'Vai pensar', 'Cliente disse que vai pensar', 6),
(NULL, 'Comprou em outro lugar', 'Cliente ja comprou em outro local', 7),
(NULL, 'Outro', 'Outro motivo', 99);
```

### 6. queue_events (Auditoria/Log)
```sql
CREATE TABLE sistemaretiradas.queue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sistemaretiradas.queue_sessions(id),
  member_id UUID REFERENCES sistemaretiradas.queue_members(id),
  attendance_id UUID REFERENCES sistemaretiradas.attendances(id),
  event_type VARCHAR(50) NOT NULL, 
  -- 'check_in', 'check_out', 'status_change', 'position_change', 
  -- 'attendance_start', 'attendance_end', 'transfer', 'force_status'
  event_data JSONB,
  performed_by UUID REFERENCES sistemaretiradas.colaboradoras(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7. queue_store_settings (Configuracoes por Loja)
```sql
CREATE TABLE sistemaretiradas.queue_store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES sistemaretiradas.tenants(id),
  loja_id UUID NOT NULL REFERENCES sistemaretiradas.lojas(id) UNIQUE,
  
  -- Regras de Fila
  entry_position VARCHAR(20) DEFAULT 'end', -- 'end', 'start', 'by_role'
  return_position VARCHAR(20) DEFAULT 'end', -- 'end', 'cooldown', 'by_performance'
  cooldown_minutes INTEGER DEFAULT 0,
  
  -- Pausas
  allowed_pause_types JSONB DEFAULT '["almoco", "estoque", "caixa"]',
  pause_requires_justification BOOLEAN DEFAULT false,
  max_pause_minutes JSONB DEFAULT '{"almoco": 60, "estoque": 15, "caixa": 30}',
  
  -- Transferencias
  transfer_allowed BOOLEAN DEFAULT true,
  transfer_requires_reason BOOLEAN DEFAULT true,
  transfer_counts_for VARCHAR(20) DEFAULT 'receiver', -- 'giver', 'receiver', 'both'
  
  -- Atendimento Manual
  manager_can_pull_anyone BOOLEAN DEFAULT true,
  seller_can_self_pull BOOLEAN DEFAULT false,
  
  -- Campos Obrigatorios no Fechamento
  require_loss_reason BOOLEAN DEFAULT true,
  require_sale_value BOOLEAN DEFAULT true,
  require_category BOOLEAN DEFAULT false,
  
  -- Categorias de Atendimento (para lingerie)
  attendance_categories JSONB DEFAULT '["sutia", "calcinha", "pijama", "pos_cirurgico", "fitness"]',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## RLS Policies

```sql
-- queue_sessions
ALTER TABLE sistemaretiradas.queue_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY queue_sessions_tenant ON sistemaretiradas.queue_sessions
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- queue_members
ALTER TABLE sistemaretiradas.queue_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY queue_members_tenant ON sistemaretiradas.queue_members
  FOR ALL USING (
    session_id IN (SELECT id FROM sistemaretiradas.queue_sessions WHERE tenant_id = current_setting('app.tenant_id')::uuid)
  );

-- attendances
ALTER TABLE sistemaretiradas.attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendances_tenant ON sistemaretiradas.attendances
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- attendance_outcomes
ALTER TABLE sistemaretiradas.attendance_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_outcomes_tenant ON sistemaretiradas.attendance_outcomes
  FOR ALL USING (
    attendance_id IN (SELECT id FROM sistemaretiradas.attendances WHERE tenant_id = current_setting('app.tenant_id')::uuid)
  );

-- loss_reasons
ALTER TABLE sistemaretiradas.loss_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY loss_reasons_tenant ON sistemaretiradas.loss_reasons
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid OR tenant_id IS NULL);

-- queue_events
ALTER TABLE sistemaretiradas.queue_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY queue_events_tenant ON sistemaretiradas.queue_events
  FOR ALL USING (
    session_id IN (SELECT id FROM sistemaretiradas.queue_sessions WHERE tenant_id = current_setting('app.tenant_id')::uuid)
  );

-- queue_store_settings
ALTER TABLE sistemaretiradas.queue_store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY queue_store_settings_tenant ON sistemaretiradas.queue_store_settings
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

---

## Indices para Performance

```sql
CREATE INDEX idx_queue_sessions_loja_date ON sistemaretiradas.queue_sessions(loja_id, session_date);
CREATE INDEX idx_queue_members_session ON sistemaretiradas.queue_members(session_id, status);
CREATE INDEX idx_queue_members_colaboradora ON sistemaretiradas.queue_members(colaboradora_id);
CREATE INDEX idx_attendances_session ON sistemaretiradas.attendances(session_id);
CREATE INDEX idx_attendances_colaboradora ON sistemaretiradas.attendances(colaboradora_id, started_at);
CREATE INDEX idx_attendances_loja_date ON sistemaretiradas.attendances(loja_id, started_at);
CREATE INDEX idx_queue_events_session ON sistemaretiradas.queue_events(session_id, created_at);
```

---

## Funcoes Uteis (Supabase Functions)

```sql
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
$$ LANGUAGE plpgsql;

-- Funcao para calcular proxima posicao na fila
CREATE OR REPLACE FUNCTION sistemaretiradas.get_next_queue_position(p_session_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(MAX(position), 0) + 1
  FROM sistemaretiradas.queue_members
  WHERE session_id = p_session_id;
$$ LANGUAGE sql;

-- Funcao para pegar proximo da fila
CREATE OR REPLACE FUNCTION sistemaretiradas.get_next_in_queue(p_session_id UUID)
RETURNS UUID AS $$
  SELECT colaboradora_id
  FROM sistemaretiradas.queue_members
  WHERE session_id = p_session_id
    AND status = 'disponivel'
  ORDER BY position ASC
  LIMIT 1;
$$ LANGUAGE sql;
```

---

## KPIs e Metricas

### Produtividade do Salao
- Atendimentos por vendedor (dia/semana/mes)
- Tempo medio em atendimento
- Tempo ocioso (Disponivel sem ser chamado)
- Tempo em indisponivel (pausas)
- Clientes atendidos por hora

### Resultado
- Taxa de conversao (vendas / atendimentos)
- Ticket medio
- Pecas por venda (UPT)
- Receita por atendimento
- Motivos de perda (ranking)

### Justica da Distribuicao
- Participacao de atendimentos (% por vendedor)
- Participacao de receita (% por vendedor)
- Indice de desigualdade
- Transferencias (quantas e por que)

---

## Telas Necessarias

1. **Tela Fila (TV/Tablet)**: Lista grande com cores por status, tempo real
2. **App Vendedor**: Check-in/out, iniciar/finalizar atendimento, ver ranking
3. **Painel Gerente**: Forcar status, transferir, ver alertas
4. **Dashboard**: Conversao, motivos de perda, produtividade, ranking

---

## Proximos Passos

1. [ ] Executar SQL de criacao das tabelas no Supabase
2. [ ] Criar hooks React para gerenciar a fila (useQueueSession, useQueueMembers)
3. [ ] Criar componentes de UI (QueueBoard, AttendanceDialog, QueueSettings)
4. [ ] Integrar com sistema de metas existente
5. [ ] Adicionar ao menu lateral do admin/loja
