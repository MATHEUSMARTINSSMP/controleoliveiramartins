-- =====================================================
-- ATUALIZAR STATUS DE AJUSTES PARA NOVOS VALORES
-- =====================================================
-- Remove status antigos e adiciona novos status específicos para ajustes

-- 1. Remover constraint antiga se existir (ANTES de migrar dados)
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

-- 2. Migrar dados existentes (mapear status antigos para novos) - ANTES de criar nova constraint
-- Se houver registros com status antigos, convertê-los para os novos
UPDATE sistemaretiradas.adjustments
SET status = CASE
    WHEN status = 'GERADA' THEN 'AJUSTE_GERADO'
    WHEN status = 'PREPARANDO' THEN 'PRONTO_PARA_LEVAR'
    WHEN status = 'PRONTA' THEN 'AJUSTE_EM_LOJA'
    WHEN status = 'ROTA_ENTREGA' THEN 'EM_ROTA_ENTREGA_CLIENTE'
    WHEN status = 'ENTREGUE' THEN 'CLIENTE_RETIROU'
    WHEN status = 'PRONTA_RETIRADA' THEN 'AJUSTE_EM_LOJA'
    WHEN status = 'ROTA_DEVOLUCAO' THEN 'RETIRADO_DA_COSTUREIRA'
    WHEN status = 'EM_LOJA' THEN 'AJUSTE_EM_LOJA'
    WHEN status = 'CLIENTE_AVISADA' THEN 'CLIENTE_JA_AVISADA'
    WHEN status = 'FINALIZADA' THEN 'CLIENTE_RETIROU'
    ELSE 'AJUSTE_GERADO' -- Fallback para status desconhecidos
END
WHERE status IN (
    'GERADA', 'PREPARANDO', 'PRONTA', 'ROTA_ENTREGA', 'ENTREGUE',
    'PRONTA_RETIRADA', 'ROTA_DEVOLUCAO', 'EM_LOJA', 'CLIENTE_AVISADA', 'FINALIZADA'
);

-- 3. Criar nova constraint com novos status (DEPOIS de migrar dados)
DO $$
BEGIN
    -- Adicionar nova constraint com novos status de ajuste
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
        'CLIENTE_RETIROU'
    ));
    RAISE NOTICE '✅ Nova constraint criada com sucesso';
END $$;

-- 4. Atualizar valor padrão da coluna status
ALTER TABLE sistemaretiradas.adjustments
ALTER COLUMN status SET DEFAULT 'AJUSTE_GERADO';

-- 5. Comentários
COMMENT ON COLUMN sistemaretiradas.adjustments.status IS 
'Status do ajuste: AJUSTE_GERADO, PRONTO_PARA_LEVAR, ENTREGUE_COSTUREIRA, RETIRADO_DA_COSTUREIRA, AJUSTE_EM_LOJA, CLIENTE_JA_AVISADA, EM_ROTA_ENTREGA_CLIENTE, CLIENTE_RETIROU';

-- 6. Verificar se há registros com status inválidos (deve retornar 0 após migração)
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM sistemaretiradas.adjustments
    WHERE status NOT IN (
        'AJUSTE_GERADO', 'PRONTO_PARA_LEVAR', 'ENTREGUE_COSTUREIRA', 
        'RETIRADO_DA_COSTUREIRA', 'AJUSTE_EM_LOJA', 'CLIENTE_JA_AVISADA', 
        'EM_ROTA_ENTREGA_CLIENTE', 'CLIENTE_RETIROU'
    );
    
    IF invalid_count > 0 THEN
        RAISE WARNING 'Ainda existem % registros com status inválidos. Verifique manualmente.', invalid_count;
    ELSE
        RAISE NOTICE '✅ Migração concluída. Todos os registros foram atualizados para os novos status.';
    END IF;
END $$;

