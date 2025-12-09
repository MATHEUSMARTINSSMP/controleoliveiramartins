-- =====================================================
-- ADICIONAR NOVOS STATUS PARA CONDICIONAIS E AJUSTES
-- =====================================================
-- Adiciona os status 'EM_LOJA' e 'CLIENTE_AVISADA' para condicionais e ajustes

-- 1. Verificar e atualizar constraint de status em conditionals
DO $$
BEGIN
    -- Remover constraint antiga se existir
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'conditionals_status_check' 
        AND conrelid = 'sistemaretiradas.conditionals'::regclass
    ) THEN
        ALTER TABLE sistemaretiradas.conditionals 
        DROP CONSTRAINT conditionals_status_check;
    END IF;
    
    -- Adicionar nova constraint com todos os status
    ALTER TABLE sistemaretiradas.conditionals
    ADD CONSTRAINT conditionals_status_check 
    CHECK (status IN (
        'GERADA', 
        'PREPARANDO', 
        'PRONTA', 
        'ROTA_ENTREGA', 
        'ENTREGUE', 
        'PRONTA_RETIRADA', 
        'ROTA_DEVOLUCAO',
        'EM_LOJA',
        'CLIENTE_AVISADA',
        'FINALIZADA'
    ));
END $$;

-- 2. Verificar e atualizar constraint de status em adjustments
DO $$
BEGIN
    -- Remover constraint antiga se existir
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'adjustments_status_check' 
        AND conrelid = 'sistemaretiradas.adjustments'::regclass
    ) THEN
        ALTER TABLE sistemaretiradas.adjustments 
        DROP CONSTRAINT adjustments_status_check;
    END IF;
    
    -- Adicionar nova constraint com todos os status
    ALTER TABLE sistemaretiradas.adjustments
    ADD CONSTRAINT adjustments_status_check 
    CHECK (status IN (
        'GERADA', 
        'PREPARANDO', 
        'PRONTA', 
        'ROTA_ENTREGA', 
        'ENTREGUE', 
        'PRONTA_RETIRADA', 
        'ROTA_DEVOLUCAO',
        'EM_LOJA',
        'CLIENTE_AVISADA',
        'FINALIZADA'
    ));
END $$;

-- 3. Comentários
COMMENT ON COLUMN sistemaretiradas.conditionals.status IS 'Status da condicional: GERADA, PREPARANDO, PRONTA, ROTA_ENTREGA, ENTREGUE, PRONTA_RETIRADA, ROTA_DEVOLUCAO, EM_LOJA, CLIENTE_AVISADA, FINALIZADA';
COMMENT ON COLUMN sistemaretiradas.adjustments.status IS 'Status do ajuste: GERADA, PREPARANDO, PRONTA, ROTA_ENTREGA, ENTREGUE, PRONTA_RETIRADA, ROTA_DEVOLUCAO, EM_LOJA, CLIENTE_AVISADA, FINALIZADA';

