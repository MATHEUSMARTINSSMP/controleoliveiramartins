-- ============================================================================
-- ✅ VERIFICAÇÃO COMPLETA DO SISTEMA DE CASHBACK
-- ============================================================================
-- Execute esta query para diagnosticar todo o sistema de cashback

-- ============================================================================
-- 1. VERIFICAR ESTRUTURA DA TABELA tiny_orders
-- ============================================================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'tiny_orders'
  AND column_name IN ('id', 'cliente_id', 'store_id', 'valor_total', 'situacao')
ORDER BY ordinal_position;

-- ============================================================================
-- 2. VERIFICAR SE O TRIGGER EXISTE E ESTÁ ATIVO
-- ============================================================================
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    CASE 
        WHEN tgenabled = 'O' THEN '✅ ATIVO'
        WHEN tgenabled = 'D' THEN '❌ DESABILITADO'
        ELSE '❓ DESCONHECIDO'
    END as status,
    tgenabled as enabled_code,
    pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'sistemaretiradas.tiny_orders'::regclass
  AND tgname LIKE '%cashback%'
ORDER BY tgname;

-- ============================================================================
-- 3. VERIFICAR SE AS FUNÇÕES EXISTEM
-- ============================================================================
SELECT 
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name = 'gerar_cashback' THEN '✅ Função principal'
        WHEN routine_name = 'get_cashback_settings' THEN '✅ Função de configuração'
        WHEN routine_name = 'trigger_gerar_cashback_pedido' THEN '✅ Função do trigger'
        ELSE 'ℹ️ Outra função'
    END as descricao
FROM information_schema.routines
WHERE routine_schema = 'sistemaretiradas'
  AND routine_name LIKE '%cashback%'
ORDER BY routine_name;

-- ============================================================================
-- 4. VERIFICAR CONFIGURAÇÕES DE CASHBACK
-- ============================================================================
SELECT 
    COALESCE(s.name, 'GLOBAL') as loja,
    cs.percentual_cashback || '%' as percentual,
    cs.prazo_liberacao_dias || ' dias' as liberacao,
    cs.prazo_expiracao_dias || ' dias' as expiracao,
    CASE 
        WHEN cs.renovacao_habilitada THEN '✅ Habilitada'
        ELSE '❌ Desabilitada'
    END as renovacao
FROM sistemaretiradas.cashback_settings cs
LEFT JOIN sistemaretiradas.stores s ON cs.store_id = s.id
ORDER BY s.name NULLS FIRST;

-- ============================================================================
-- 5. VERIFICAR ÚLTIMOS PEDIDOS E SE GERARAM CASHBACK
-- ============================================================================
SELECT 
    o.id,
    o.numero_pedido,
    o.valor_total,
    o.situacao,
    CASE 
        WHEN o.cliente_id IS NULL THEN '❌ Sem cliente'
        ELSE '✅ Tem cliente'
    END as tem_cliente,
    CASE 
        WHEN ct.id IS NOT NULL THEN '✅ Gerou cashback'
        ELSE '❌ Não gerou'
    END as cashback_status,
    ct.amount as valor_cashback,
    c.cpf_cnpj
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.cashback_transactions ct ON o.id = ct.tiny_order_id AND ct.transaction_type = 'EARNED'
LEFT JOIN sistemaretiradas.tiny_contacts c ON o.cliente_id = c.id
WHERE o.valor_total > 0
ORDER BY o.created_at DESC
LIMIT 10;

-- ============================================================================
-- 6. VERIFICAR PEDIDOS SEM CASHBACK (para debug)
-- ============================================================================
SELECT 
    o.id,
    o.numero_pedido,
    o.valor_total,
    o.situacao,
    o.cliente_id,
    CASE
        WHEN o.cliente_id IS NULL THEN 'Sem cliente_id'
        WHEN o.valor_total <= 0 THEN 'Valor <= 0'
        WHEN LOWER(TRIM(COALESCE(o.situacao::TEXT, ''))) = 'cancelado' THEN 'Pedido cancelado'
        WHEN c.cpf_cnpj IS NULL OR TRIM(c.cpf_cnpj) = '' THEN 'Cliente sem CPF'
        WHEN LENGTH(REGEXP_REPLACE(c.cpf_cnpj, '\D', '', 'g')) < 11 THEN 'CPF inválido'
        ELSE 'Possível erro no trigger'
    END as motivo_sem_cashback
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.tiny_contacts c ON o.cliente_id = c.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON o.id = ct.tiny_order_id AND ct.transaction_type = 'EARNED'
WHERE ct.id IS NULL
  AND o.valor_total > 0
  AND o.cliente_id IS NOT NULL
ORDER BY o.created_at DESC
LIMIT 10;

