-- =====================================================
-- SISTEMA DE BANCO DE HORAS - EleveaOne
-- =====================================================

-- 1. Tabela de políticas de tolerância por loja
CREATE TABLE IF NOT EXISTS sistemaretiradas.hours_policies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    
    -- Tolerâncias em minutos
    tolerancia_entrada_minutos INTEGER DEFAULT 10,
    tolerancia_saida_minutos INTEGER DEFAULT 10,
    tolerancia_intervalo_minutos INTEGER DEFAULT 5,
    
    -- Arredondamento (none, 5min, 10min, 15min)
    arredondamento_tipo VARCHAR(20) DEFAULT 'none',
    
    -- Se considera hora extra apenas após tolerância
    desconta_atraso BOOLEAN DEFAULT true,
    paga_hora_extra BOOLEAN DEFAULT true,
    
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(store_id)
);

-- 2. Tabela de saldo diário de horas
CREATE TABLE IF NOT EXISTS sistemaretiradas.hours_daily_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    
    -- Data do registro
    data DATE NOT NULL,
    
    -- Minutos trabalhados e esperados
    minutos_trabalhados INTEGER NOT NULL DEFAULT 0,
    minutos_esperados INTEGER NOT NULL DEFAULT 0,
    minutos_intervalo INTEGER NOT NULL DEFAULT 0,
    
    -- Saldo do dia (positivo = hora extra, negativo = hora devida)
    saldo_minutos INTEGER NOT NULL DEFAULT 0,
    
    -- Referência ao template/contrato usado
    template_id UUID REFERENCES sistemaretiradas.work_schedule_templates(id) ON DELETE SET NULL,
    schedule_id UUID REFERENCES sistemaretiradas.colaboradora_work_schedules(id) ON DELETE SET NULL,
    
    -- Status do cálculo
    status VARCHAR(20) DEFAULT 'calculated', -- calculated, manual_adjustment, pending
    observacao TEXT,
    
    -- Registro de ponto relacionado
    time_clock_record_id UUID,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Único por colaboradora/dia
    UNIQUE(colaboradora_id, data)
);

-- 3. Tabela de saldo mensal consolidado
CREATE TABLE IF NOT EXISTS sistemaretiradas.hours_monthly_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    
    -- Mês/Ano de referência
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    
    -- Saldos em minutos
    saldo_anterior INTEGER DEFAULT 0, -- Transportado do mês anterior
    total_horas_extras INTEGER DEFAULT 0, -- Total positivo do mês
    total_horas_devidas INTEGER DEFAULT 0, -- Total negativo do mês (valor absoluto)
    ajustes_manuais INTEGER DEFAULT 0, -- Ajustes feitos manualmente
    saldo_final INTEGER DEFAULT 0, -- Saldo ao final do mês
    
    -- Dias trabalhados
    dias_trabalhados INTEGER DEFAULT 0,
    dias_falta INTEGER DEFAULT 0,
    dias_folga INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'open', -- open, closed, adjusted
    fechado_em TIMESTAMP WITH TIME ZONE,
    fechado_por UUID REFERENCES sistemaretiradas.profiles(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Único por colaboradora/mês/ano
    UNIQUE(colaboradora_id, ano, mes)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_hours_policies_store ON sistemaretiradas.hours_policies(store_id);
CREATE INDEX IF NOT EXISTS idx_hours_daily_balances_colaboradora ON sistemaretiradas.hours_daily_balances(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_hours_daily_balances_data ON sistemaretiradas.hours_daily_balances(data);
CREATE INDEX IF NOT EXISTS idx_hours_daily_balances_store ON sistemaretiradas.hours_daily_balances(store_id);
CREATE INDEX IF NOT EXISTS idx_hours_monthly_balances_colaboradora ON sistemaretiradas.hours_monthly_balances(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_hours_monthly_balances_periodo ON sistemaretiradas.hours_monthly_balances(ano, mes);

-- RLS Policies
ALTER TABLE sistemaretiradas.hours_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.hours_daily_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.hours_monthly_balances ENABLE ROW LEVEL SECURITY;

-- Política: Admin gerencia políticas da sua loja
CREATE POLICY "hours_policies_admin_manage"
ON sistemaretiradas.hours_policies
FOR ALL
TO authenticated
USING (admin_id = auth.uid())
WITH CHECK (admin_id = auth.uid());

-- Política: Admin vê saldos diários da sua loja
CREATE POLICY "hours_daily_balances_admin_read"
ON sistemaretiradas.hours_daily_balances
FOR SELECT
TO authenticated
USING (
    store_id IN (
        SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
    )
);

-- Política: Admin pode inserir/atualizar saldos da sua loja
CREATE POLICY "hours_daily_balances_admin_write"
ON sistemaretiradas.hours_daily_balances
FOR ALL
TO authenticated
USING (
    store_id IN (
        SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
    )
)
WITH CHECK (
    store_id IN (
        SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
    )
);

-- Política: Colaboradora vê seu próprio saldo
CREATE POLICY "hours_daily_balances_colaboradora_read"
ON sistemaretiradas.hours_daily_balances
FOR SELECT
TO authenticated
USING (colaboradora_id = auth.uid());

-- Política: Admin vê saldos mensais da sua loja
CREATE POLICY "hours_monthly_balances_admin_read"
ON sistemaretiradas.hours_monthly_balances
FOR SELECT
TO authenticated
USING (
    store_id IN (
        SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
    )
);

-- Política: Admin pode gerenciar saldos mensais da sua loja
CREATE POLICY "hours_monthly_balances_admin_write"
ON sistemaretiradas.hours_monthly_balances
FOR ALL
TO authenticated
USING (
    store_id IN (
        SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
    )
)
WITH CHECK (
    store_id IN (
        SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
    )
);

-- Política: Colaboradora vê seu próprio saldo mensal
CREATE POLICY "hours_monthly_balances_colaboradora_read"
ON sistemaretiradas.hours_monthly_balances
FOR SELECT
TO authenticated
USING (colaboradora_id = auth.uid());
