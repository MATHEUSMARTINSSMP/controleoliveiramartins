-- =====================================================
-- SISTEMA DE OCORRÊNCIAS DE PONTO - EleveaOne
-- Tipos: FALTA, ABONO, FOLGA, ATESTADO, FERIAS
-- =====================================================

-- Tabela de ocorrências de ponto
CREATE TABLE IF NOT EXISTS sistemaretiradas.timeclock_occurrences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    
    -- Data da ocorrência
    data DATE NOT NULL,
    
    -- Tipo da ocorrência
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('FALTA', 'ABONO', 'FOLGA', 'ATESTADO', 'FERIAS', 'FERIADO')),
    
    -- Detalhes
    motivo TEXT,
    observacao TEXT,
    
    -- Controle de aprovação (para solicitações de colaboradora)
    solicitado_por UUID REFERENCES sistemaretiradas.profiles(id), -- NULL = lançado por admin
    status VARCHAR(20) DEFAULT 'aprovado' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    aprovado_por UUID REFERENCES sistemaretiradas.profiles(id),
    aprovado_em TIMESTAMP WITH TIME ZONE,
    motivo_rejeicao TEXT,
    
    -- Impacto no banco de horas
    desconta_banco_horas BOOLEAN DEFAULT false, -- Se true, desconta do banco
    minutos_abonados INTEGER DEFAULT 0, -- Para abono parcial
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES sistemaretiradas.profiles(id),
    
    -- Índice único para evitar duplicatas
    UNIQUE(colaboradora_id, data, tipo)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_timeclock_occurrences_colaboradora ON sistemaretiradas.timeclock_occurrences(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_timeclock_occurrences_store ON sistemaretiradas.timeclock_occurrences(store_id);
CREATE INDEX IF NOT EXISTS idx_timeclock_occurrences_data ON sistemaretiradas.timeclock_occurrences(data);
CREATE INDEX IF NOT EXISTS idx_timeclock_occurrences_status ON sistemaretiradas.timeclock_occurrences(status);
CREATE INDEX IF NOT EXISTS idx_timeclock_occurrences_tipo ON sistemaretiradas.timeclock_occurrences(tipo);

-- RLS
ALTER TABLE sistemaretiradas.timeclock_occurrences ENABLE ROW LEVEL SECURITY;

-- Política: Admin vê e gerencia ocorrências da sua loja
CREATE POLICY "timeclock_occurrences_admin_all"
ON sistemaretiradas.timeclock_occurrences
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

-- Política: Colaboradora vê suas próprias ocorrências
CREATE POLICY "timeclock_occurrences_colaboradora_read"
ON sistemaretiradas.timeclock_occurrences
FOR SELECT
TO authenticated
USING (colaboradora_id = auth.uid());

-- Política: Colaboradora pode criar solicitações (pendentes)
CREATE POLICY "timeclock_occurrences_colaboradora_insert"
ON sistemaretiradas.timeclock_occurrences
FOR INSERT
TO authenticated
WITH CHECK (
    colaboradora_id = auth.uid() 
    AND solicitado_por = auth.uid()
    AND status = 'pendente'
);
