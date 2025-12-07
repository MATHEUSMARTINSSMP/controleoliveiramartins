-- ============================================================================
-- Query para verificar se o vale troca está sendo salvo na forma de pagamento
-- ============================================================================

-- Verificar pedidos recentes com forma de pagamento
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
LIMIT 20;

-- Verificar se há algum pedido com "vale troca" na forma de pagamento
SELECT 
    id,
    numero_pedido,
    data_pedido,
    cliente_nome,
    valor_total,
    forma_pagamento,
    sync_at
FROM sistemaretiradas.tiny_orders
WHERE forma_pagamento ILIKE '%vale%'
   OR forma_pagamento ILIKE '%troca%'
ORDER BY data_pedido DESC
LIMIT 20;

