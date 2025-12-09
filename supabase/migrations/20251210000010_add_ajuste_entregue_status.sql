-- =====================================================
-- ADICIONAR STATUS AJUSTE_ENTREGUE
-- =====================================================
-- Adiciona o novo status 'AJUSTE_ENTREGUE' à constraint CHECK
-- da tabela adjustments

-- 1. Remover constraint antiga
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'adjustments_status_check' 
        AND conrelid = 'sistemaretiradas.adjustments'::regclass
    ) THEN
        ALTER TABLE sistemaretiradas.adjustments 
        DROP CONSTRAINT adjustments_status_check;
        RAISE NOTICE '✅ Constraint antiga removida';
    END IF;
END $$;

-- 2. Criar nova constraint com o novo status
ALTER TABLE sistemaretiradas.adjustments
ADD CONSTRAINT adjustments_status_check 
CHECK (status IN (
    'AJUSTE_GERADO',
    'PRONTO_PARA_LEVAR',
    'ENTREGUE_COSTUREIRA',
    'RETIRADO_DA_COSTUREIRA',
    'AJUSTE_EM_LOJA',
    'CLIENTE_JA_AVISADA',
    'EM_ROTA_ENTREGA_CLIENTE',
    'CLIENTE_RETIROU',
    'AJUSTE_ENTREGUE'
));

COMMENT ON CONSTRAINT adjustments_status_check 
ON sistemaretiradas.adjustments IS 
'Status do ajuste: AJUSTE_GERADO, PRONTO_PARA_LEVAR, ENTREGUE_COSTUREIRA, RETIRADO_DA_COSTUREIRA, AJUSTE_EM_LOJA, CLIENTE_JA_AVISADA, EM_ROTA_ENTREGA_CLIENTE, CLIENTE_RETIROU, AJUSTE_ENTREGUE';

