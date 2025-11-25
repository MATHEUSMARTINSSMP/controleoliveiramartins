-- =============================================================================
-- Migration: Suporte a múltiplos pré-requisitos e prêmios por posição
-- =============================================================================
-- Esta migration adiciona suporte para:
-- 1. Múltiplos pré-requisitos (array JSONB)
-- 2. Prêmios diferentes por posição (Top 1, Top 2, Top 3)
-- 3. Prêmios físicos por posição
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. ALTERAR COLUNA pre_requisitos DE TEXT PARA JSONB (array)
-- =============================================================================
-- Migrar dados existentes: converter string única para array JSONB
DO $$
DECLARE
    rec record;
    pre_req_array jsonb;
BEGIN
    -- Para cada bônus com pre_requisitos não nulo
    FOR rec IN 
        SELECT id, pre_requisitos 
        FROM bonuses 
        WHERE pre_requisitos IS NOT NULL AND pre_requisitos != ''
    LOOP
        -- Converter string única para array JSONB
        pre_req_array := jsonb_build_array(rec.pre_requisitos);
        
        -- Atualizar com array
        UPDATE bonuses 
        SET pre_requisitos = pre_req_array::text
        WHERE id = rec.id;
    END LOOP;
END $$;

-- Alterar tipo da coluna para JSONB
ALTER TABLE bonuses 
    ALTER COLUMN pre_requisitos TYPE jsonb 
    USING CASE 
        WHEN pre_requisitos IS NULL THEN NULL::jsonb
        WHEN pre_requisitos::text LIKE '[%' THEN pre_requisitos::jsonb
        ELSE jsonb_build_array(pre_requisitos::text)
    END;

-- Comentário
COMMENT ON COLUMN bonuses.pre_requisitos IS 'Array JSONB de pré-requisitos. Ex: ["Válido apenas se a loja bater a meta mensal", "Válido apenas se a consultora atingir meta mensal"]';

-- =============================================================================
-- 2. ADICIONAR CAMPOS PARA PRÊMIOS POR POSIÇÃO (Top 1, Top 2, Top 3)
-- =============================================================================

-- Prêmios monetários por posição
ALTER TABLE bonuses 
    ADD COLUMN IF NOT EXISTS valor_bonus_1 DECIMAL(10,2), -- Prêmio para 1º lugar
    ADD COLUMN IF NOT EXISTS valor_bonus_2 DECIMAL(10,2), -- Prêmio para 2º lugar
    ADD COLUMN IF NOT EXISTS valor_bonus_3 DECIMAL(10,2); -- Prêmio para 3º lugar

-- Prêmios físicos (texto) por posição
ALTER TABLE bonuses 
    ADD COLUMN IF NOT EXISTS valor_bonus_texto_1 TEXT, -- Prêmio físico para 1º lugar (ex: "Airfryer")
    ADD COLUMN IF NOT EXISTS valor_bonus_texto_2 TEXT, -- Prêmio físico para 2º lugar
    ADD COLUMN IF NOT EXISTS valor_bonus_texto_3 TEXT; -- Prêmio físico para 3º lugar

-- Comentários
COMMENT ON COLUMN bonuses.valor_bonus_1 IS 'Valor do prêmio monetário para 1º lugar (Top 1)';
COMMENT ON COLUMN bonuses.valor_bonus_2 IS 'Valor do prêmio monetário para 2º lugar (Top 2)';
COMMENT ON COLUMN bonuses.valor_bonus_3 IS 'Valor do prêmio monetário para 3º lugar (Top 3)';
COMMENT ON COLUMN bonuses.valor_bonus_texto_1 IS 'Descrição do prêmio físico para 1º lugar (ex: "Airfryer", "Vale compras R$ 300")';
COMMENT ON COLUMN bonuses.valor_bonus_texto_2 IS 'Descrição do prêmio físico para 2º lugar';
COMMENT ON COLUMN bonuses.valor_bonus_texto_3 IS 'Descrição do prêmio físico para 3º lugar';

-- =============================================================================
-- 3. MIGRAR DADOS EXISTENTES (se houver valor_bonus, copiar para valor_bonus_1)
-- =============================================================================
-- Se já existe valor_bonus e condicao_ranking = 1, copiar para valor_bonus_1
UPDATE bonuses 
SET valor_bonus_1 = valor_bonus
WHERE valor_bonus IS NOT NULL 
    AND valor_bonus > 0 
    AND (condicao_ranking = 1 OR condicao_ranking IS NULL)
    AND valor_bonus_1 IS NULL;

-- Se já existe valor_bonus_texto, copiar para valor_bonus_texto_1
UPDATE bonuses 
SET valor_bonus_texto_1 = valor_bonus_texto
WHERE valor_bonus_texto IS NOT NULL 
    AND valor_bonus_texto != ''
    AND valor_bonus_texto_1 IS NULL;

-- =============================================================================
-- 4. CRIAR ÍNDICES PARA PERFORMANCE
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_bonuses_pre_requisitos ON bonuses USING GIN (pre_requisitos) WHERE pre_requisitos IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bonuses_valor_bonus_1 ON bonuses(valor_bonus_1) WHERE valor_bonus_1 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bonuses_condicao_ranking ON bonuses(condicao_ranking) WHERE condicao_ranking IS NOT NULL;

-- =============================================================================
-- 5. VERIFICAR SE FATURAMENTO JÁ EXISTE EM condicao_meta_tipo
-- =============================================================================
-- FATURAMENTO já deve estar documentado na migration anterior
-- Este é apenas um comentário de verificação
COMMENT ON COLUMN bonuses.condicao_meta_tipo IS 'Tipo de meta: MENSAL, SEMANAL, DIARIA, SUPER_META_MENSAL, SUPER_META_SEMANAL, GINCANA_SEMANAL, SUPER_GINCANA_SEMANAL, FATURAMENTO';

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

