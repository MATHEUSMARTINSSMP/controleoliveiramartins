-- ============================================================================
-- Query para verificar se o vale troca está sendo salvo na forma de pagamento
-- ============================================================================

-- Verificar pedidos com forma de pagamento que contenha "vale troca"
SELECT 
    id,
    numero_pedido,
    data_pedido,
    cliente_nome,
    valor_total,
    forma_pagamento,
    observacoes,
    created_at,
    updated_at
FROM sistemaretiradas.tiny_orders
WHERE forma_pagamento ILIKE '%vale%troca%'
   OR forma_pagamento ILIKE '%vale%troca%'
   OR forma_pagamento ILIKE '%troca%'
ORDER BY data_pedido DESC
LIMIT 20;

-- Verificar os últimos pedidos sincronizados para ver a forma de pagamento
SELECT 
    id,
    numero_pedido,
    data_pedido,
    cliente_nome,
    valor_total,
    forma_pagamento,
    sync_at
FROM sistemaretiradas.tiny_orders
WHERE store_id = (SELECT id FROM sistemaretiradas.stores WHERE active = true LIMIT 1)
ORDER BY sync_at DESC
LIMIT 10;

