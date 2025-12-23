-- Script de Verificação de Instalação do Cashback
-- Execute este script no SQL Editor do Supabase

DO $$
DECLARE
    v_trigger_exists BOOLEAN;
    v_function_src TEXT;
    v_queue_constraint_exists BOOLEAN;
BEGIN
    RAISE NOTICE '=== INICIANDO VERIFICAÇÃO ===';

    -- 1. Verificar se o Trigger existe na tabela sales
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE event_object_schema = 'sistemaretiradas' 
        AND event_object_table = 'sales' 
        AND trigger_name = 'trg_gerar_cashback_new_sale'
    ) INTO v_trigger_exists;

    IF v_trigger_exists THEN
        RAISE NOTICE '✅ Trigger trg_gerar_cashback_new_sale EXISTE na tabela sales.';
    ELSE
        RAISE NOTICE '❌ Trigger trg_gerar_cashback_new_sale NÃO EXISTE na tabela sales.';
    END IF;

    -- 2. Verificar se a função gerar_cashback aceita sale_id
    SELECT prosrc INTO v_function_src
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'sistemaretiradas' AND p.proname = 'gerar_cashback';

    IF v_function_src ILIKE '%p_sale_id%' THEN
        RAISE NOTICE '✅ Função gerar_cashback parece aceitar p_sale_id.';
    ELSE
        RAISE NOTICE '❌ Função gerar_cashback NÃO parece aceitar p_sale_id (versão antiga?).';
    END IF;

    -- 3. Verificar se a constraint de FK na fila foi removida
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cashback_whatsapp_queue_cliente_id_fkey'
    ) INTO v_queue_constraint_exists;

    IF NOT v_queue_constraint_exists THEN
        RAISE NOTICE '✅ Constraint cashback_whatsapp_queue_cliente_id_fkey foi REMOVIDA (Correto).';
    ELSE
        RAISE NOTICE '❌ Constraint cashback_whatsapp_queue_cliente_id_fkey AINDA EXISTE (Incorreto para vendas manuais).';
    END IF;

    RAISE NOTICE '=== FIM DA VERIFICAÇÃO ===';
END $$;
