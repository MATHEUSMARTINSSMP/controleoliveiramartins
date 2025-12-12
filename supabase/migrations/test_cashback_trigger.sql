-- Script de Verificação de Cashback
-- Execute este script no SQL Editor do Supabase para testar a geração de cashback

DO $$
DECLARE
    v_store_id UUID;
    v_cliente_id UUID;
    v_sale_id UUID;
    v_cashback_exists BOOLEAN;
BEGIN
    -- 1. Pegar uma loja qualquer (ou defina um ID específico)
    SELECT id INTO v_store_id FROM sistemaretiradas.stores LIMIT 1;
    
    -- 2. Pegar um cliente qualquer dessa loja (ou crie um temporário)
    SELECT id INTO v_cliente_id FROM sistemaretiradas.crm_contacts WHERE store_id = v_store_id LIMIT 1;
    
    IF v_cliente_id IS NULL THEN
        RAISE NOTICE 'Nenhum cliente encontrado para a loja %', v_store_id;
        RETURN;
    END IF;

    RAISE NOTICE 'Testando com Loja: % e Cliente: %', v_store_id, v_cliente_id;

    -- 3. Inserir uma venda de teste
    INSERT INTO sistemaretiradas.sales (
        store_id,
        cliente_id,
        cliente_nome,
        valor,
        qtd_pecas,
        data_venda,
        observacoes
    ) VALUES (
        v_store_id,
        v_cliente_id,
        'Cliente Teste Cashback',
        100.00,
        1,
        NOW(),
        'Teste de Geração de Cashback Automático'
    ) RETURNING id INTO v_sale_id;

    RAISE NOTICE 'Venda criada com ID: %', v_sale_id;

    -- 4. Verificar se o cashback foi gerado
    SELECT EXISTS (
        SELECT 1 FROM sistemaretiradas.cashback_transactions 
        WHERE sale_id = v_sale_id
    ) INTO v_cashback_exists;

    IF v_cashback_exists THEN
        RAISE NOTICE '✅ SUCESSO: Cashback gerado para a venda %', v_sale_id;
    ELSE
        RAISE NOTICE '❌ FALHA: Cashback NÃO foi gerado para a venda %', v_sale_id;
    END IF;

    -- 5. (Opcional) Limpar dados de teste
    -- DELETE FROM sistemaretiradas.sales WHERE id = v_sale_id;
END $$;
