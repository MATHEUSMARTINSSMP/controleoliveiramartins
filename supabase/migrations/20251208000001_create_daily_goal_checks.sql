-- Migration: Sistema de Check de Meta Diária
-- Permite que colaboradoras confirmem que viram a meta do dia
-- e acumulem um valor configurável por check

-- 1. Criar tabela de configuração de check de meta diária nas stores
ALTER TABLE sistemaretiradas.stores
ADD COLUMN IF NOT EXISTS daily_goal_check_ativo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS daily_goal_check_valor_bonus NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS daily_goal_check_horario_limite TIME DEFAULT '18:00:00';

COMMENT ON COLUMN sistemaretiradas.stores.daily_goal_check_ativo IS 'Ativa/desativa funcionalidade de check de meta diária';
COMMENT ON COLUMN sistemaretiradas.stores.daily_goal_check_valor_bonus IS 'Valor em R$ que será acumulado por cada check realizado';
COMMENT ON COLUMN sistemaretiradas.stores.daily_goal_check_horario_limite IS 'Horário limite (HH:MM:SS) para realizar o check do dia';

-- 2. Criar tabela de checks de meta diária
CREATE TABLE IF NOT EXISTS sistemaretiradas.daily_goal_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    data_referencia DATE NOT NULL,
    meta_do_dia NUMERIC(10,2) NOT NULL,
    valor_atrasado NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    valor_total_confirmado NUMERIC(10,2) NOT NULL,
    valor_bonus NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    horario_check TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Garantir que cada colaboradora só pode dar check uma vez por dia
    UNIQUE(colaboradora_id, data_referencia)
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_daily_goal_checks_colaboradora_data 
    ON sistemaretiradas.daily_goal_checks(colaboradora_id, data_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_daily_goal_checks_store_data 
    ON sistemaretiradas.daily_goal_checks(store_id, data_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_daily_goal_checks_data_referencia 
    ON sistemaretiradas.daily_goal_checks(data_referencia DESC);

-- 4. Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION sistemaretiradas.update_daily_goal_checks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_daily_goal_checks_updated_at ON sistemaretiradas.daily_goal_checks;
CREATE TRIGGER trigger_update_daily_goal_checks_updated_at
    BEFORE UPDATE ON sistemaretiradas.daily_goal_checks
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_daily_goal_checks_updated_at();

-- 6. RLS (Row Level Security)
ALTER TABLE sistemaretiradas.daily_goal_checks ENABLE ROW LEVEL SECURITY;

-- Política: Colaboradoras podem ver seus próprios checks
CREATE POLICY "Colaboradoras podem ver seus próprios checks"
    ON sistemaretiradas.daily_goal_checks
    FOR SELECT
    USING (
        colaboradora_id = auth.uid()::uuid
    );

-- Política: Colaboradoras podem criar seus próprios checks
CREATE POLICY "Colaboradoras podem criar seus próprios checks"
    ON sistemaretiradas.daily_goal_checks
    FOR INSERT
    WITH CHECK (
        colaboradora_id = auth.uid()::uuid
        AND EXISTS (
            SELECT 1 FROM sistemaretiradas.stores s
            WHERE s.id = store_id
            AND s.daily_goal_check_ativo = true
        )
    );

-- Política: ADMIN pode ver todos os checks
CREATE POLICY "ADMIN pode ver todos os checks"
    ON sistemaretiradas.daily_goal_checks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles p
            WHERE p.id = auth.uid()::uuid
            AND p.role = 'ADMIN'
            AND p.active = true
        )
    );

-- Política: LOJA pode ver checks de sua loja
CREATE POLICY "LOJA pode ver checks de sua loja"
    ON sistemaretiradas.daily_goal_checks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles p
            WHERE p.id = auth.uid()::uuid
            AND p.role = 'LOJA'
            AND p.active = true
            AND (
                p.store_id = daily_goal_checks.store_id
                OR p.store_default::uuid = daily_goal_checks.store_id
            )
        )
    );

COMMENT ON TABLE sistemaretiradas.daily_goal_checks IS 'Registra os checks de meta diária realizados pelas colaboradoras';
COMMENT ON COLUMN sistemaretiradas.daily_goal_checks.meta_do_dia IS 'Meta do dia no momento do check';
COMMENT ON COLUMN sistemaretiradas.daily_goal_checks.valor_atrasado IS 'Valor atrasado acumulado no momento do check';
COMMENT ON COLUMN sistemaretiradas.daily_goal_checks.valor_total_confirmado IS 'Valor total confirmado pela colaboradora (meta do dia + atrasado)';
COMMENT ON COLUMN sistemaretiradas.daily_goal_checks.valor_bonus IS 'Valor do bônus acumulado por este check';

