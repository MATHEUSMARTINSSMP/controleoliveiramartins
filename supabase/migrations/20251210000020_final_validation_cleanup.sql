-- =====================================================
-- LIMPEZA FINAL: GARANTIR ESTADO LIMPO
-- =====================================================
-- Esta migração garante que não há NENHUMA referência
-- à função validate_notification_limit que está causando o erro

-- PASSO 1: Remover TODAS as funções relacionadas (com todas as assinaturas possíveis)
DO $$
DECLARE
    func_rec RECORD;
BEGIN
    -- Listar e remover TODAS as funções que contenham "validate" e "notification" e "limit"
    FOR func_rec IN
        SELECT 
            oid,
            proname as function_name,
            pg_get_function_identity_arguments(oid) as function_args
        FROM pg_proc
        WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
        AND (
            proname LIKE '%validate%notification%limit%'
            OR proname = 'validate_notification_limit'
            OR (proname LIKE '%validate%' AND proname LIKE '%limit%' AND proname LIKE '%notification%')
        )
    LOOP
        BEGIN
            RAISE NOTICE 'Removendo função: %(%)', func_rec.function_name, func_rec.function_args;
            EXECUTE 'DROP FUNCTION IF EXISTS sistemaretiradas.' || quote_ident(func_rec.function_name) || '(' || func_rec.function_args || ') CASCADE';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Erro ao remover função %: %', func_rec.function_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- PASSO 2: Remover funções com assinaturas específicas conhecidas
DROP FUNCTION IF EXISTS sistemaretiradas.validate_notification_limit(uuid, time without time zone[], integer[]) CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.validate_notification_limit(uuid, time[], integer[]) CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.validate_notification_limit CASCADE;

-- PASSO 3: Remover TODOS os triggers relacionados
DROP TRIGGER IF EXISTS trigger_validate_notification_limit ON sistemaretiradas.store_notifications CASCADE;
DROP TRIGGER IF EXISTS trigger_validate_notification_limit ON sistemaretiradas.store_notification_recipients CASCADE;

-- PASSO 4: Remover TODAS as constraints CHECK que podem estar chamando a função
DO $$
DECLARE
    constraint_rec RECORD;
BEGIN
    FOR constraint_rec IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'sistemaretiradas.store_notifications'::regclass
        AND contype = 'c'
        AND (
            pg_get_constraintdef(oid) LIKE '%validate%'
            OR pg_get_constraintdef(oid) LIKE '%notification%'
            OR pg_get_constraintdef(oid) LIKE '%limit%'
        )
    LOOP
        BEGIN
            EXECUTE 'ALTER TABLE sistemaretiradas.store_notifications DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_rec.conname) || ' CASCADE';
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;
    END LOOP;
END $$;

-- PASSO 5: Verificar se há alguma view ou materialized view que possa estar usando a função
DO $$
DECLARE
    view_rec RECORD;
BEGIN
    FOR view_rec IN
        SELECT 
            schemaname,
            viewname,
            definition
        FROM pg_views
        WHERE schemaname = 'sistemaretiradas'
        AND definition LIKE '%validate_notification_limit%'
    LOOP
        BEGIN
            RAISE NOTICE 'View encontrada que usa validate_notification_limit: %.%', view_rec.schemaname, view_rec.viewname;
            -- Não removemos views automaticamente, apenas avisamos
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;
    END LOOP;
END $$;

-- PASSO 6: Garantir que as funções corretas existem (serão criadas pela migração 20251210000017)
-- Esta migração apenas limpa, não cria nada novo

-- PASSO 7: Log final para debug
DO $$
DECLARE
    func_count INTEGER;
    trigger_count INTEGER;
    constraint_count INTEGER;
BEGIN
    -- Contar funções restantes
    SELECT COUNT(*) INTO func_count
    FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
    AND proname LIKE '%validate%notification%limit%';
    
    -- Contar triggers restantes
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgrelid IN (
        'sistemaretiradas.store_notifications'::regclass,
        'sistemaretiradas.store_notification_recipients'::regclass
    )
    AND NOT tgisinternal
    AND pg_get_triggerdef(oid) LIKE '%validate%notification%limit%';
    
    -- Contar constraints restantes
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint
    WHERE conrelid = 'sistemaretiradas.store_notifications'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%validate%notification%limit%';
    
    RAISE NOTICE '=== LIMPEZA FINAL CONCLUÍDA ===';
    RAISE NOTICE 'Funções validate_notification_limit restantes: %', func_count;
    RAISE NOTICE 'Triggers validate_notification_limit restantes: %', trigger_count;
    RAISE NOTICE 'Constraints validate_notification_limit restantes: %', constraint_count;
    
    IF func_count > 0 OR trigger_count > 0 OR constraint_count > 0 THEN
        RAISE WARNING 'ATENÇÃO: Ainda existem referências à função validate_notification_limit!';
    ELSE
        RAISE NOTICE '✅ Limpeza completa! Nenhuma referência restante.';
    END IF;
END $$;

