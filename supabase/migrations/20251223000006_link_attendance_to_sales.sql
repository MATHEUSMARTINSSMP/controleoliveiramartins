-- ============================================================================
-- MIGRATION: Linkar Atendimentos com Vendas
-- ============================================================================
-- Data: 2025-12-23
-- Descrição: Adiciona campo attendance_id na tabela sales para linkar
--            vendas com atendimentos da Lista da Vez, evitando duplicação
--            de dados e permitindo analytics integradas
-- ============================================================================

-- 1. Adicionar coluna attendance_id na tabela sales
ALTER TABLE sistemaretiradas.sales
ADD COLUMN IF NOT EXISTS attendance_id UUID REFERENCES sistemaretiradas.attendances(id) ON DELETE SET NULL;

-- 2. Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_sales_attendance_id
ON sistemaretiradas.sales(attendance_id)
WHERE attendance_id IS NOT NULL;

-- 3. Adicionar coluna sale_id na tabela attendance_outcomes
ALTER TABLE sistemaretiradas.attendance_outcomes
ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sistemaretiradas.sales(id) ON DELETE SET NULL;

-- 4. Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_attendance_outcomes_sale_id
ON sistemaretiradas.attendance_outcomes(sale_id)
WHERE sale_id IS NOT NULL;

-- 5. Comentários
COMMENT ON COLUMN sistemaretiradas.sales.attendance_id IS
'ID do atendimento da Lista da Vez que gerou esta venda. Permite linkar vendas com atendimentos para analytics integradas.';

COMMENT ON COLUMN sistemaretiradas.attendance_outcomes.sale_id IS
'ID da venda gerada a partir deste atendimento. Linka o resultado do atendimento com a venda registrada no sistema.';

-- 6. Função para atualizar sale_id no attendance_outcome após criar venda
CREATE OR REPLACE FUNCTION sistemaretiradas.link_sale_to_attendance()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a venda tem attendance_id, atualizar o attendance_outcome correspondente
    IF NEW.attendance_id IS NOT NULL THEN
        UPDATE sistemaretiradas.attendance_outcomes
        SET sale_id = NEW.id
        WHERE attendance_id = NEW.attendance_id
          AND sale_id IS NULL
          AND result = 'venda';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger para executar após inserção de venda
DROP TRIGGER IF EXISTS trigger_link_sale_to_attendance ON sistemaretiradas.sales;
CREATE TRIGGER trigger_link_sale_to_attendance
    AFTER INSERT ON sistemaretiradas.sales
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.link_sale_to_attendance();

-- 8. Função para atualizar attendance_id na venda após atualizar attendance_outcome
CREATE OR REPLACE FUNCTION sistemaretiradas.link_attendance_to_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o outcome tem sale_id e result é 'venda', atualizar a venda com attendance_id
    IF NEW.sale_id IS NOT NULL AND NEW.result = 'venda' THEN
        UPDATE sistemaretiradas.sales
        SET attendance_id = NEW.attendance_id
        WHERE id = NEW.sale_id
          AND attendance_id IS NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Trigger para executar após inserção/atualização de attendance_outcome
DROP TRIGGER IF EXISTS trigger_link_attendance_to_sale ON sistemaretiradas.attendance_outcomes;
CREATE TRIGGER trigger_link_attendance_to_sale
    AFTER INSERT OR UPDATE ON sistemaretiradas.attendance_outcomes
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.link_attendance_to_sale();

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

