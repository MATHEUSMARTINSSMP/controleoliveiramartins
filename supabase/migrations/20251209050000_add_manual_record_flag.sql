-- =====================================================
-- ADICIONAR CAMPO DE LANÇAMENTO MANUAL
-- =====================================================

ALTER TABLE sistemaretiradas.time_clock_records
ADD COLUMN IF NOT EXISTS lancamento_manual BOOLEAN DEFAULT FALSE;

ALTER TABLE sistemaretiradas.time_clock_records
ADD COLUMN IF NOT EXISTS lancado_por UUID REFERENCES sistemaretiradas.profiles(id);

COMMENT ON COLUMN sistemaretiradas.time_clock_records.lancamento_manual IS 'Indica se o registro foi criado manualmente pelo admin';
COMMENT ON COLUMN sistemaretiradas.time_clock_records.lancado_por IS 'ID do admin que fez o lançamento manual';

