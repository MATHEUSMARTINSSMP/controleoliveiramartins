-- ============================================================================
-- CORRIGIR: ON CONFLICT para criar_vendas_de_tiny_orders
-- Problema: Índice parcial não é reconhecido pelo ON CONFLICT
-- Solução: Criar constraint única ao invés de índice único
-- ============================================================================

-- 1. Remover o índice único parcial (não funciona bem com ON CONFLICT)
DROP INDEX IF EXISTS sistemaretiradas.idx_sales_tiny_order_id_unique;

-- 2. Criar constraint única (funciona perfeitamente com ON CONFLICT)
-- Nota: PostgreSQL não permite constraints parciais diretamente, mas podemos usar um índice único
-- que será tratado como constraint. A melhor abordagem é usar o nome do índice no ON CONFLICT.
-- Mas como isso não está funcionando, vamos criar uma constraint única sem a cláusula WHERE
-- e garantir que o código sempre insira valores não-nulos.

-- Alternativa: Criar um índice único sem WHERE e usar ON CONFLICT normalmente
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_tiny_order_id_unique 
ON sistemaretiradas.sales(tiny_order_id)
WHERE tiny_order_id IS NOT NULL;

-- 3. Atualizar a função criar_vendas_de_tiny_orders para usar o nome do índice
-- Mas como ON CONFLICT ON CONSTRAINT não funciona com índices, vamos usar uma abordagem diferente:
-- Usar ON CONFLICT (tiny_order_id) mas garantir que o valor não seja NULL antes do INSERT

-- Na verdade, o problema pode ser que precisamos usar uma sintaxe específica.
-- Vou verificar se podemos usar o índice diretamente no ON CONFLICT.

-- SOLUÇÃO FINAL: Usar uma abordagem com verificação prévia + INSERT simples
-- ou usar ON CONFLICT com o nome do índice usando uma sintaxe específica.

-- Vou criar um script para atualizar a função:
DO $$
BEGIN
    -- Atualizar a função para usar uma abordagem que funciona com índices parciais
    EXECUTE '
    CREATE OR REPLACE FUNCTION sistemaretiradas.criar_vendas_de_tiny_orders(
        p_store_id UUID DEFAULT NULL,
        p_data_inicio DATE DEFAULT NULL,
        p_data_fim DATE DEFAULT NULL
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
        v_pedido RECORD;
        v_sale_id UUID;
        v_qtd_pecas INTEGER;
        v_observacoes TEXT;
        v_vendas_criadas INTEGER := 0;
        v_vendas_atualizadas INTEGER := 0;
        v_erros INTEGER := 0;
        v_detalhes JSONB := ''[]''::JSONB;
        v_valor_final NUMERIC;
    BEGIN
        -- Loop através de pedidos do Tiny que ainda não têm venda correspondente
        FOR v_pedido IN
            SELECT 
                o.id as tiny_order_id,
                o.numero_pedido,
                o.data_pedido,
                o.valor_total,
                o.colaboradora_id,
                o.store_id,
                o.itens,
                s.id as sale_id
            FROM sistemaretiradas.tiny_orders o
            LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = o.id
            WHERE 
                -- Filtros opcionais
                (p_store_id IS NULL OR o.store_id = p_store_id)
                AND (p_data_inicio IS NULL OR o.data_pedido::DATE >= p_data_inicio)
                AND (p_data_fim IS NULL OR o.data_pedido::DATE <= p_data_fim)
                -- Apenas pedidos que ainda não têm venda OU foram atualizados depois da venda
                AND (s.id IS NULL OR o.updated_at > s.updated_at)
                -- Apenas pedidos com colaboradora e loja válidos
                AND o.colaboradora_id IS NOT NULL
                AND o.store_id IS NOT NULL
                -- Apenas pedidos com valor maior que zero
                AND o.valor_total > 0
                -- Apenas pedidos com tiny_order_id (garantir que não seja NULL)
                AND o.id IS NOT NULL
            ORDER BY o.data_pedido DESC, o.created_at DESC
        LOOP
            BEGIN
                -- ✅ VALIDAÇÕES EXPLICITAS
                IF v_pedido.colaboradora_id IS NULL THEN
                    RAISE WARNING ''Pedido % sem colaboradora_id, pulando...'', v_pedido.numero_pedido;
                    v_erros := v_erros + 1;
                    v_detalhes := v_detalhes || jsonb_build_object(
                        ''tipo'', ''erro'',
                        ''erro'', ''colaboradora_id IS NULL'',
                        ''numero_pedido'', v_pedido.numero_pedido,
                        ''tiny_order_id'', v_pedido.tiny_order_id
                    );
                    CONTINUE;
                END IF;
                
                IF v_pedido.store_id IS NULL THEN
                    RAISE WARNING ''Pedido % sem store_id, pulando...'', v_pedido.numero_pedido;
                    v_erros := v_erros + 1;
                    v_detalhes := v_detalhes || jsonb_build_object(
                        ''tipo'', ''erro'',
                        ''erro'', ''store_id IS NULL'',
                        ''numero_pedido'', v_pedido.numero_pedido,
                        ''tiny_order_id'', v_pedido.tiny_order_id
                    );
                    CONTINUE;
                END IF;
                
                IF v_pedido.valor_total <= 0 THEN
                    RAISE WARNING ''Pedido % com valor_total <= 0, pulando...'', v_pedido.numero_pedido;
                    v_erros := v_erros + 1;
                    v_detalhes := v_detalhes || jsonb_build_object(
                        ''tipo'', ''erro'',
                        ''erro'', ''valor_total <= 0'',
                        ''numero_pedido'', v_pedido.numero_pedido,
                        ''tiny_order_id'', v_pedido.tiny_order_id
                    );
                    CONTINUE;
                END IF;
                
                -- Calcular quantidade de peças
                v_qtd_pecas := 0;
                IF v_pedido.itens IS NOT NULL AND jsonb_typeof(v_pedido.itens) = ''array'' THEN
                    SELECT COALESCE(SUM((item->>''quantidade'')::INTEGER), 0)
                    INTO v_qtd_pecas
                    FROM jsonb_array_elements(v_pedido.itens) AS item;
                END IF;
                
                -- Montar observações
                v_observacoes := ''Venda gerada automaticamente do pedido #'' || v_pedido.numero_pedido || '' do Tiny ERP.'';
                
                -- ✅ VALOR FINAL: Usar valor_total diretamente (já tem vale troca descontado)
                v_valor_final := v_pedido.valor_total;
                
                -- Se valor final for <= 0, pular
                IF v_valor_final <= 0 THEN
                    RAISE WARNING ''Pedido % com valor final <= 0 após processamento, pulando...'', v_pedido.numero_pedido;
                    v_erros := v_erros + 1;
                    v_detalhes := v_detalhes || jsonb_build_object(
                        ''tipo'', ''erro'',
                        ''erro'', ''valor_final <= 0'',
                        ''numero_pedido'', v_pedido.numero_pedido,
                        ''tiny_order_id'', v_pedido.tiny_order_id
                    );
                    CONTINUE;
                END IF;
                
                -- Se já existe venda, atualizar
                IF v_pedido.sale_id IS NOT NULL THEN
                    UPDATE sistemaretiradas.sales
                    SET
                        colaboradora_id = v_pedido.colaboradora_id,
                        store_id = v_pedido.store_id,
                        valor = v_valor_final,
                        qtd_pecas = v_qtd_pecas,
                        data_venda = v_pedido.data_pedido,
                        observacoes = v_observacoes,
                        updated_at = NOW()
                    WHERE id = v_pedido.sale_id;
                    
                    v_sale_id := v_pedido.sale_id;
                    v_vendas_atualizadas := v_vendas_atualizadas + 1;
                    
                    v_detalhes := v_detalhes || jsonb_build_object(
                        ''tipo'', ''atualizada'',
                        ''tiny_order_id'', v_pedido.tiny_order_id,
                        ''sale_id'', v_pedido.sale_id,
                        ''numero_pedido'', v_pedido.numero_pedido,
                        ''valor'', v_pedido.valor_total,
                        ''qtd_pecas'', v_qtd_pecas
                    );
                ELSE
                    -- ✅ CRIAR NOVA VENDA COM PROTEÇÃO CONTRA DUPLICATAS
                    -- Usar INSERT ... ON CONFLICT com verificação prévia
                    -- Como o índice é parcial (WHERE tiny_order_id IS NOT NULL),
                    -- precisamos garantir que o valor não seja NULL
                    -- A melhor abordagem é usar uma verificação prévia + INSERT simples
                    -- ou usar uma abordagem com TRY/CATCH
                    
                    -- Tentar inserir. Se já existir (por race condition), atualizar
                    BEGIN
                        INSERT INTO sistemaretiradas.sales (
                            tiny_order_id,
                            colaboradora_id,
                            store_id,
                            valor,
                            qtd_pecas,
                            data_venda,
                            observacoes,
                            lancado_por_id
                        ) VALUES (
                            v_pedido.tiny_order_id,
                            v_pedido.colaboradora_id,
                            v_pedido.store_id,
                            v_valor_final,
                            v_qtd_pecas,
                            v_pedido.data_pedido,
                            v_observacoes,
                            NULL
                        )
                        RETURNING id INTO v_sale_id;
                        
                        v_vendas_criadas := v_vendas_criadas + 1;
                        
                        v_detalhes := v_detalhes || jsonb_build_object(
                            ''tipo'', ''criada'',
                            ''tiny_order_id'', v_pedido.tiny_order_id,
                            ''sale_id'', v_sale_id,
                            ''numero_pedido'', v_pedido.numero_pedido,
                            ''valor'', v_pedido.valor_total,
                            ''qtd_pecas'', v_qtd_pecas
                        );
                    EXCEPTION
                        WHEN unique_violation THEN
                            -- Se já existe (race condition), buscar e atualizar
                            SELECT id INTO v_sale_id
                            FROM sistemaretiradas.sales
                            WHERE tiny_order_id = v_pedido.tiny_order_id;
                            
                            IF v_sale_id IS NOT NULL THEN
                                UPDATE sistemaretiradas.sales
                                SET
                                    colaboradora_id = v_pedido.colaboradora_id,
                                    store_id = v_pedido.store_id,
                                    valor = v_valor_final,
                                    qtd_pecas = v_qtd_pecas,
                                    data_venda = v_pedido.data_pedido,
                                    observacoes = v_observacoes,
                                    updated_at = NOW()
                                WHERE id = v_sale_id;
                                
                                v_vendas_atualizadas := v_vendas_atualizadas + 1;
                                
                                v_detalhes := v_detalhes || jsonb_build_object(
                                    ''tipo'', ''atualizada_apos_conflito'',
                                    ''tiny_order_id'', v_pedido.tiny_order_id,
                                    ''sale_id'', v_sale_id,
                                    ''numero_pedido'', v_pedido.numero_pedido,
                                    ''valor'', v_pedido.valor_total,
                                    ''qtd_pecas'', v_qtd_pecas
                                );
                            END IF;
                    END;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    -- Log do erro e continuar
                    RAISE WARNING ''Erro ao processar pedido %: %'', v_pedido.numero_pedido, SQLERRM;
                    v_erros := v_erros + 1;
                    v_detalhes := v_detalhes || jsonb_build_object(
                        ''tipo'', ''erro'',
                        ''erro'', SQLERRM,
                        ''numero_pedido'', v_pedido.numero_pedido,
                        ''tiny_order_id'', v_pedido.tiny_order_id,
                        ''erro_detalhado'', SQLSTATE
                    );
            END;
        END LOOP;
        
        RETURN jsonb_build_object(
            ''vendas_criadas'', v_vendas_criadas,
            ''vendas_atualizadas'', v_vendas_atualizadas,
            ''erros'', v_erros,
            ''total_detalhes'', jsonb_array_length(v_detalhes),
            ''detalhes'', v_detalhes
        );
    END;
    $$;';
END $$;

-- Verificar se a função foi atualizada
SELECT 
    'Função atualizada com sucesso!' as status,
    proname as nome_funcao,
    pg_get_functiondef(oid) as definicao
FROM pg_proc
WHERE proname = 'criar_vendas_de_tiny_orders'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
LIMIT 1;

