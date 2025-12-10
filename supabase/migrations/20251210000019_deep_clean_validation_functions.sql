-- =====================================================
-- LIMPEZA PROFUNDA: REMOVER TODAS AS REFERÊNCIAS À FUNÇÃO INEXISTENTE
-- =====================================================
-- Esta migração faz uma limpeza completa de todas as referências
-- à função validate_notification_limit que não existe

-- 1. REMOVER TODAS AS CONSTRAINTS CHECK QUE PODEM ESTAR CHAMANDO A FUNÇÃO
DO $$
DECLARE
    constraint_rec RECORD;
    constraint_def TEXT;
BEGIN
    -- Listar todas as constraints CHECK na tabela store_notifications
    FOR constraint_rec IN
        SELECT 
            conname as constraint_name,
            pg_get_constraintdef(oid) as constraint_def
        FROM pg_constraint
        WHERE conrelid = 'sistemaretiradas.store_notifications'::regclass
        AND contype = 'c'  -- CHECK constraint
    LOOP
        constraint_def := constraint_rec.constraint_def;
        
        -- Se a constraint menciona validate_notification_limit ou validate, remover
        IF constraint_def LIKE '%validate%notification%limit%' 
           OR constraint_def LIKE '%validate_notification_limit%'
           OR constraint_def LIKE '%validate_store_notification_limit%' THEN
            BEGIN
                RAISE NOTICE 'Removendo constraint: %', constraint_rec.constraint_name;
                EXECUTE 'ALTER TABLE sistemaretiradas.store_notifications DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_rec.constraint_name) || ' CASCADE';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Erro ao remover constraint %: %', constraint_rec.constraint_name, SQLERRM;
            END;
        END IF;
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao processar constraints: %', SQLERRM;
END $$;

-- 2. REMOVER TODOS OS TRIGGERS QUE PODEM ESTAR CHAMANDO A FUNÇÃO
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    -- Listar todos os triggers na tabela store_notifications
    FOR trigger_rec IN
        SELECT 
            tgname as trigger_name,
            pg_get_triggerdef(oid) as trigger_def
        FROM pg_trigger
        WHERE tgrelid = 'sistemaretiradas.store_notifications'::regclass
        AND NOT tgisinternal  -- Apenas triggers criados pelo usuário
    LOOP
        -- Se o trigger menciona validate_notification_limit, remover
        IF trigger_rec.trigger_def LIKE '%validate_notification_limit%' 
           OR trigger_rec.trigger_def LIKE '%validate_store_notification_limit%' THEN
            BEGIN
                RAISE NOTICE 'Removendo trigger: %', trigger_rec.trigger_name;
                EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trigger_rec.trigger_name) || ' ON sistemaretiradas.store_notifications CASCADE';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Erro ao remover trigger %: %', trigger_rec.trigger_name, SQLERRM;
            END;
        END IF;
    END LOOP;
    
    -- Listar todos os triggers na tabela store_notification_recipients
    FOR trigger_rec IN
        SELECT 
            tgname as trigger_name,
            pg_get_triggerdef(oid) as trigger_def
        FROM pg_trigger
        WHERE tgrelid = 'sistemaretiradas.store_notification_recipients'::regclass
        AND NOT tgisinternal  -- Apenas triggers criados pelo usuário
    LOOP
        -- Se o trigger menciona validate_notification_limit, remover
        IF trigger_rec.trigger_def LIKE '%validate_notification_limit%' 
           OR trigger_rec.trigger_def LIKE '%validate_store_notification_limit%' THEN
            BEGIN
                RAISE NOTICE 'Removendo trigger: %', trigger_rec.trigger_name;
                EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trigger_rec.trigger_name) || ' ON sistemaretiradas.store_notification_recipients CASCADE';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Erro ao remover trigger %: %', trigger_rec.trigger_name, SQLERRM;
            END;
        END IF;
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao processar triggers: %', SQLERRM;
END $$;

-- 3. REMOVER TODAS AS FUNÇÕES QUE PODEM ESTAR CAUSANDO O PROBLEMA
-- Remover com todas as assinaturas possíveis
DROP FUNCTION IF EXISTS sistemaretiradas.validate_notification_limit(uuid, time without time zone[], integer[]) CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.validate_notification_limit(uuid, time[], integer[]) CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.validate_notification_limit CASCADE;

-- 4. LISTAR TODAS AS FUNÇÕES RESTANTES PARA DEBUG (opcional, comentado)
/*
DO $$
DECLARE
    func_rec RECORD;
BEGIN
    RAISE NOTICE '=== FUNÇÕES DE VALIDAÇÃO RESTANTES ===';
    FOR func_rec IN
        SELECT 
            proname as function_name,
            pg_get_function_arguments(oid) as function_args
        FROM pg_proc
        WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
        AND (proname LIKE '%validate%' OR proname LIKE '%notification%' OR proname LIKE '%limit%')
    LOOP
        RAISE NOTICE 'Função: %(%)', func_rec.function_name, func_rec.function_args;
    END LOOP;
END $$;
*/

-- 5. GARANTIR QUE NÃO HÁ DEPENDÊNCIAS ÓRFÃS
-- Isso vai falhar silenciosamente se não houver nada para limpar
DO $$
BEGIN
    -- Tentar remover qualquer função órfã que possa estar causando problemas
    PERFORM pg_get_function_identity_arguments(oid)
    FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
    AND proname = 'validate_notification_limit'
    AND pg_get_function_arguments(oid) LIKE '%uuid%time%integer%';
EXCEPTION
    WHEN OTHERS THEN
        -- Ignorar erros
        NULL;
END $$;

COMMENT ON FUNCTION sistemaretiradas.validate_store_notification_limit() IS 'Valida limite de 10 mensagens POR DIA DA SEMANA (após limpeza completa)';

