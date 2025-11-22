-- =====================================================
-- SISTEMA DE TROFÉUS E CONQUISTAS
-- =====================================================
-- Esta migração cria:
-- 1. Tabela para armazenar troféus/conquistas
-- 2. Funções para criar troféus automaticamente
-- 3. Políticas RLS para acesso seguro
-- =====================================================

-- Criar enum para tipos de troféus
DO $$ BEGIN
    CREATE TYPE trophy_type AS ENUM (
        'META_MENSAL',
        'SUPER_META_MENSAL',
        'META_SEMANAL',
        'SUPER_META_SEMANAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Criar tabela de troféus
CREATE TABLE IF NOT EXISTS sistemaretiradas.trophies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    tipo trophy_type NOT NULL,
    mes_referencia VARCHAR(6), -- Formato: YYYYMM (ex: 202511)
    semana_referencia VARCHAR(6), -- Formato: WWYYYY (ex: 462025)
    meta_valor DECIMAL(15, 2) NOT NULL,
    realizado DECIMAL(15, 2) NOT NULL,
    percentual DECIMAL(5, 2) NOT NULL, -- Percentual de alcance (ex: 150.50 para 150.5%)
    data_conquista DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT trophies_mes_or_semana CHECK (
        (tipo IN ('META_MENSAL', 'SUPER_META_MENSAL') AND mes_referencia IS NOT NULL AND semana_referencia IS NULL) OR
        (tipo IN ('META_SEMANAL', 'SUPER_META_SEMANAL') AND semana_referencia IS NOT NULL AND mes_referencia IS NULL)
    ),
    CONSTRAINT trophies_percentual_positivo CHECK (percentual >= 100.00) -- Só salva se atingiu a meta (>= 100%)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_trophies_colaboradora_id ON sistemaretiradas.trophies(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_trophies_store_id ON sistemaretiradas.trophies(store_id);
CREATE INDEX IF NOT EXISTS idx_trophies_tipo ON sistemaretiradas.trophies(tipo);
CREATE INDEX IF NOT EXISTS idx_trophies_mes_referencia ON sistemaretiradas.trophies(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_trophies_semana_referencia ON sistemaretiradas.trophies(semana_referencia);
CREATE INDEX IF NOT EXISTS idx_trophies_data_conquista ON sistemaretiradas.trophies(data_conquista DESC);

-- Índices únicos parciais para evitar troféus duplicados
-- Para metas mensais
CREATE UNIQUE INDEX IF NOT EXISTS idx_trophies_unique_mensal 
ON sistemaretiradas.trophies(colaboradora_id, store_id, tipo, mes_referencia)
WHERE tipo IN ('META_MENSAL', 'SUPER_META_MENSAL') AND mes_referencia IS NOT NULL;

-- Para metas semanais
CREATE UNIQUE INDEX IF NOT EXISTS idx_trophies_unique_semanal 
ON sistemaretiradas.trophies(colaboradora_id, store_id, tipo, semana_referencia)
WHERE tipo IN ('META_SEMANAL', 'SUPER_META_SEMANAL') AND semana_referencia IS NOT NULL;

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION sistemaretiradas.set_updated_at_trophies()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_set_updated_at_trophies ON sistemaretiradas.trophies;
CREATE TRIGGER trigger_set_updated_at_trophies
    BEFORE UPDATE ON sistemaretiradas.trophies
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.set_updated_at_trophies();

-- =====================================================
-- FUNÇÕES PARA CRIAR TROFÉUS AUTOMATICAMENTE
-- =====================================================

-- Função para criar troféu de meta mensal
CREATE OR REPLACE FUNCTION sistemaretiradas.create_monthly_trophy(
    p_colaboradora_id UUID,
    p_store_id UUID,
    p_mes_referencia VARCHAR(6),
    p_meta_valor DECIMAL(15, 2),
    p_realizado DECIMAL(15, 2),
    p_is_super BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
    v_tipo trophy_type;
    v_percentual DECIMAL(5, 2);
    v_trophy_id UUID;
BEGIN
    -- Determinar tipo de troféu
    IF p_is_super THEN
        v_tipo := 'SUPER_META_MENSAL';
    ELSE
        v_tipo := 'META_MENSAL';
    END IF;

    -- Calcular percentual
    v_percentual := (p_realizado / NULLIF(p_meta_valor, 0)) * 100;

    -- Só criar troféu se atingiu a meta (>= 100%)
    IF v_percentual >= 100.00 THEN
        -- Verificar se já existe
        SELECT id INTO v_trophy_id
        FROM sistemaretiradas.trophies
        WHERE colaboradora_id = p_colaboradora_id
            AND store_id = p_store_id
            AND tipo = v_tipo
            AND mes_referencia = p_mes_referencia;

        IF v_trophy_id IS NOT NULL THEN
            -- Atualizar existente
            UPDATE sistemaretiradas.trophies
            SET realizado = p_realizado,
                percentual = v_percentual,
                data_conquista = CURRENT_DATE,
                updated_at = NOW()
            WHERE id = v_trophy_id;
        ELSE
            -- Inserir novo
            INSERT INTO sistemaretiradas.trophies (
                colaboradora_id,
                store_id,
                tipo,
                mes_referencia,
                meta_valor,
                realizado,
                percentual,
                data_conquista
            )
            VALUES (
                p_colaboradora_id,
                p_store_id,
                v_tipo,
                p_mes_referencia,
                p_meta_valor,
                p_realizado,
                v_percentual,
                CURRENT_DATE
            )
            RETURNING id INTO v_trophy_id;
        END IF;

        RETURN v_trophy_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar troféu de meta semanal
CREATE OR REPLACE FUNCTION sistemaretiradas.create_weekly_trophy(
    p_colaboradora_id UUID,
    p_store_id UUID,
    p_semana_referencia VARCHAR(6),
    p_meta_valor DECIMAL(15, 2),
    p_realizado DECIMAL(15, 2),
    p_is_super BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
    v_tipo trophy_type;
    v_percentual DECIMAL(5, 2);
    v_trophy_id UUID;
BEGIN
    -- Determinar tipo de troféu
    IF p_is_super THEN
        v_tipo := 'SUPER_META_SEMANAL';
    ELSE
        v_tipo := 'META_SEMANAL';
    END IF;

    -- Calcular percentual
    v_percentual := (p_realizado / NULLIF(p_meta_valor, 0)) * 100;

    -- Só criar troféu se atingiu a meta (>= 100%)
    IF v_percentual >= 100.00 THEN
        -- Verificar se já existe
        SELECT id INTO v_trophy_id
        FROM sistemaretiradas.trophies
        WHERE colaboradora_id = p_colaboradora_id
            AND store_id = p_store_id
            AND tipo = v_tipo
            AND semana_referencia = p_semana_referencia;

        IF v_trophy_id IS NOT NULL THEN
            -- Atualizar existente
            UPDATE sistemaretiradas.trophies
            SET realizado = p_realizado,
                percentual = v_percentual,
                data_conquista = CURRENT_DATE,
                updated_at = NOW()
            WHERE id = v_trophy_id;
        ELSE
            -- Inserir novo
            INSERT INTO sistemaretiradas.trophies (
                colaboradora_id,
                store_id,
                tipo,
                semana_referencia,
                meta_valor,
                realizado,
                percentual,
                data_conquista
            )
            VALUES (
                p_colaboradora_id,
                p_store_id,
                v_tipo,
                p_semana_referencia,
                p_meta_valor,
                p_realizado,
                v_percentual,
                CURRENT_DATE
            )
            RETURNING id INTO v_trophy_id;
        END IF;

        RETURN v_trophy_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar e criar troféus de uma colaboradora no mês
CREATE OR REPLACE FUNCTION sistemaretiradas.check_and_create_monthly_trophies(
    p_colaboradora_id UUID,
    p_store_id UUID,
    p_mes_referencia VARCHAR(6)
)
RETURNS TABLE(created_trophies INTEGER) AS $$
DECLARE
    v_goal RECORD;
    v_super_goal RECORD;
    v_total_sales DECIMAL(15, 2);
    v_start_date DATE;
    v_end_date DATE;
    v_count INTEGER := 0;
BEGIN
    -- Calcular datas do mês
    v_start_date := TO_DATE(p_mes_referencia, 'YYYYMM');
    v_end_date := (TO_DATE(p_mes_referencia, 'YYYYMM') + INTERVAL '1 month - 1 day')::DATE;

    -- Buscar meta individual
    SELECT * INTO v_goal
    FROM sistemaretiradas.goals
    WHERE store_id = p_store_id
        AND colaboradora_id = p_colaboradora_id
        AND mes_referencia = p_mes_referencia
        AND tipo = 'INDIVIDUAL';

    IF v_goal IS NULL THEN
        RETURN QUERY SELECT 0;
        RETURN;
    END IF;

    -- Calcular total de vendas do mês
    SELECT COALESCE(SUM(valor), 0) INTO v_total_sales
    FROM sistemaretiradas.sales
    WHERE colaboradora_id = p_colaboradora_id
        AND store_id = p_store_id
        AND data_venda >= v_start_date
        AND data_venda < (v_end_date + INTERVAL '1 day');

    -- Verificar e criar troféu de meta mensal
    IF v_total_sales >= v_goal.meta_valor THEN
        PERFORM sistemaretiradas.create_monthly_trophy(
            p_colaboradora_id,
            p_store_id,
            p_mes_referencia,
            v_goal.meta_valor,
            v_total_sales,
            FALSE
        );
        v_count := v_count + 1;
    END IF;

    -- Verificar e criar troféu de super meta mensal
    IF v_goal.super_meta_valor IS NOT NULL AND v_total_sales >= v_goal.super_meta_valor THEN
        PERFORM sistemaretiradas.create_monthly_trophy(
            p_colaboradora_id,
            p_store_id,
            p_mes_referencia,
            v_goal.super_meta_valor,
            v_total_sales,
            TRUE
        );
        v_count := v_count + 1;
    END IF;

    RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar e criar troféus de uma colaboradora na semana
CREATE OR REPLACE FUNCTION sistemaretiradas.check_and_create_weekly_trophies(
    p_colaboradora_id UUID,
    p_store_id UUID,
    p_semana_referencia VARCHAR(6)
)
RETURNS TABLE(created_trophies INTEGER) AS $$
DECLARE
    v_goal RECORD;
    v_total_sales DECIMAL(15, 2);
    v_week_start DATE;
    v_week_end DATE;
    v_count INTEGER := 0;
    v_year INTEGER;
    v_week INTEGER;
    v_first_two INTEGER;
    v_first_four INTEGER;
BEGIN
    -- Parse semana_referencia (formato WWYYYY ou YYYYWW)
    v_first_two := CAST(SUBSTRING(p_semana_referencia FROM 1 FOR 2) AS INTEGER);
    v_first_four := CAST(SUBSTRING(p_semana_referencia FROM 1 FOR 4) AS INTEGER);

    IF v_first_two = 20 AND v_first_four >= 2000 AND v_first_four <= 2099 THEN
        -- Formato antigo YYYYWW
        v_year := v_first_four;
        v_week := CAST(SUBSTRING(p_semana_referencia FROM 5 FOR 2) AS INTEGER);
    ELSIF v_first_two >= 1 AND v_first_two <= 53 THEN
        -- Formato novo WWYYYY
        v_week := v_first_two;
        v_year := CAST(SUBSTRING(p_semana_referencia FROM 3 FOR 4) AS INTEGER);
    ELSE
        RETURN QUERY SELECT 0;
        RETURN;
    END IF;

    -- Calcular datas da semana (segunda a domingo)
    v_week_start := DATE_TRUNC('week', TO_DATE(v_year || '-01-01', 'YYYY-MM-DD') + (v_week - 1) * INTERVAL '7 days');
    v_week_end := v_week_start + INTERVAL '6 days';

    -- Buscar meta semanal
    SELECT * INTO v_goal
    FROM sistemaretiradas.goals
    WHERE store_id = p_store_id
        AND colaboradora_id = p_colaboradora_id
        AND semana_referencia = p_semana_referencia
        AND tipo = 'SEMANAL';

    IF v_goal IS NULL THEN
        RETURN QUERY SELECT 0;
        RETURN;
    END IF;

    -- Calcular total de vendas da semana
    SELECT COALESCE(SUM(valor), 0) INTO v_total_sales
    FROM sistemaretiradas.sales
    WHERE colaboradora_id = p_colaboradora_id
        AND store_id = p_store_id
        AND data_venda >= v_week_start
        AND data_venda <= v_week_end;

    -- Verificar e criar troféu de meta semanal
    IF v_total_sales >= v_goal.meta_valor THEN
        PERFORM sistemaretiradas.create_weekly_trophy(
            p_colaboradora_id,
            p_store_id,
            p_semana_referencia,
            v_goal.meta_valor,
            v_total_sales,
            FALSE
        );
        v_count := v_count + 1;
    END IF;

    -- Verificar e criar troféu de super meta semanal
    IF v_goal.super_meta_valor IS NOT NULL AND v_total_sales >= v_goal.super_meta_valor THEN
        PERFORM sistemaretiradas.create_weekly_trophy(
            p_colaboradora_id,
            p_store_id,
            p_semana_referencia,
            v_goal.super_meta_valor,
            v_total_sales,
            TRUE
        );
        v_count := v_count + 1;
    END IF;

    RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS na tabela
ALTER TABLE sistemaretiradas.trophies ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "COLABORADORA can view own trophies" ON sistemaretiradas.trophies;
    DROP POLICY IF EXISTS "LOJA can view trophies from their store" ON sistemaretiradas.trophies;
    DROP POLICY IF EXISTS "ADMIN can view all trophies" ON sistemaretiradas.trophies;
END $$;

-- Política: COLABORADORA pode ver seus próprios troféus
CREATE POLICY "COLABORADORA can view own trophies"
ON sistemaretiradas.trophies
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM sistemaretiradas.profiles
        WHERE profiles.id = auth.uid()
            AND profiles.role = 'COLABORADORA'
            AND profiles.id = trophies.colaboradora_id
            AND profiles.active = true
    )
);

-- Política: LOJA pode ver troféus de suas colaboradoras
CREATE POLICY "LOJA can view trophies from their store"
ON sistemaretiradas.trophies
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM sistemaretiradas.profiles
        WHERE profiles.id = auth.uid()
            AND profiles.role = 'LOJA'
            AND (
                (profiles.store_id = trophies.store_id) OR
                (profiles.store_id IS NULL AND profiles.store_default IN (
                    SELECT name FROM sistemaretiradas.stores WHERE id = trophies.store_id
                ))
            )
    )
);

-- Política: ADMIN pode ver todos os troféus
CREATE POLICY "ADMIN can view all trophies"
ON sistemaretiradas.trophies
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM sistemaretiradas.profiles
        WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
            AND profiles.active = true
    )
);

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE sistemaretiradas.trophies IS 'Armazena troféus e conquistas alcançadas por colaboradoras';
COMMENT ON COLUMN sistemaretiradas.trophies.tipo IS 'Tipo de troféu: META_MENSAL, SUPER_META_MENSAL, META_SEMANAL, SUPER_META_SEMANAL';
COMMENT ON COLUMN sistemaretiradas.trophies.mes_referencia IS 'Referência do mês no formato YYYYMM (ex: 202511)';
COMMENT ON COLUMN sistemaretiradas.trophies.semana_referencia IS 'Referência da semana no formato WWYYYY (ex: 462025)';
COMMENT ON COLUMN sistemaretiradas.trophies.percentual IS 'Percentual de alcance da meta (>= 100.00 significa que a meta foi atingida)';

COMMENT ON FUNCTION sistemaretiradas.create_monthly_trophy IS 'Cria um troféu de meta mensal automaticamente';
COMMENT ON FUNCTION sistemaretiradas.create_weekly_trophy IS 'Cria um troféu de meta semanal automaticamente';
COMMENT ON FUNCTION sistemaretiradas.check_and_create_monthly_trophies IS 'Verifica vendas do mês e cria troféus automaticamente se metas forem atingidas';
COMMENT ON FUNCTION sistemaretiradas.check_and_create_weekly_trophies IS 'Verifica vendas da semana e cria troféus automaticamente se metas forem atingidas';

-- =====================================================
-- INSTRUÇÕES DE USO
-- =====================================================
-- 
-- 1. CRIAR TROFÉUS AUTOMATICAMENTE:
--    SELECT * FROM sistemaretiradas.check_and_create_monthly_trophies(
--        'uuid-da-colaboradora',
--        'uuid-da-loja',
--        '202511'  -- Mês no formato YYYYMM
--    );
--
--    SELECT * FROM sistemaretiradas.check_and_create_weekly_trophies(
--        'uuid-da-colaboradora',
--        'uuid-da-loja',
--        '462025'  -- Semana no formato WWYYYY
--    );
--
-- 2. BUSCAR TROFÉUS DE UMA COLABORADORA:
--    SELECT * FROM sistemaretiradas.trophies
--    WHERE colaboradora_id = 'uuid-da-colaboradora'
--    ORDER BY data_conquista DESC;
--
-- 3. BUSCAR TROFÉUS DE UMA LOJA (ÚLTIMOS 50):
--    SELECT * FROM sistemaretiradas.trophies
--    WHERE store_id = 'uuid-da-loja'
--    ORDER BY data_conquista DESC
--    LIMIT 50;
--
-- 4. BUSCAR TROFÉUS POR TIPO:
--    SELECT * FROM sistemaretiradas.trophies
--    WHERE tipo = 'SUPER_META_MENSAL'
--    ORDER BY data_conquista DESC;
--
-- =====================================================

