-- =====================================================
-- ADICIONAR CAMPO DE OBSERVAÇÃO NA TABELA ADJUSTMENTS
-- =====================================================
-- Adiciona campo para observações/notas adicionais nos ajustes

ALTER TABLE sistemaretiradas.adjustments
ADD COLUMN IF NOT EXISTS observacao TEXT;

COMMENT ON COLUMN sistemaretiradas.adjustments.observacao IS 
'Campo para observações, notas ou informações adicionais sobre o ajuste';

