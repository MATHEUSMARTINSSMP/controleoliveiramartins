-- Verificar se há vendas duplicadas ou problemas
SELECT 
    s.id as sale_id,
    s.tiny_order_id,
    s.colaboradora_id,
    s.valor,
    s.data_venda,
    s.observacoes,
    p.name as colaboradora_nome,
    CASE 
        WHEN s.tiny_order_id IS NOT NULL THEN 'ERP'
        ELSE 'Manual'
    END as origem
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.profiles p ON s.colaboradora_id = p.id
WHERE s.store_id = (SELECT id FROM sistemaretiradas.stores WHERE active = true LIMIT 1)
ORDER BY s.data_venda DESC
LIMIT 20;
