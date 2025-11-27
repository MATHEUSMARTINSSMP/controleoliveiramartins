-- Script SQL para Verificar Sincronização de Dados
-- 
-- Este script verifica se os dados estão sendo sincronizados corretamente:
-- - Pedidos com itens completos
-- - Clientes com dados completos
-- - Tamanho e cor extraídos corretamente
-- - Horários corretos (não fixos em 00:00:00)

-- =============================================================================
-- 1. VERIFICAR PEDIDOS RECENTES
-- =============================================================================

SELECT 
  'Pedidos Recentes' as verificacao,
  COUNT(*) as total,
  COUNT(CASE WHEN itens IS NOT NULL AND jsonb_typeof(itens::jsonb) = 'array' AND jsonb_array_length(itens::jsonb) > 0 THEN 1 END) as com_itens,
  COUNT(CASE WHEN data_pedido IS NOT NULL AND data_pedido::text NOT LIKE '%T00:00:00%' THEN 1 END) as com_hora_real,
  COUNT(CASE WHEN cliente_id IS NOT NULL THEN 1 END) as com_cliente_id,
  COUNT(CASE WHEN colaboradora_id IS NOT NULL THEN 1 END) as com_colaboradora_id
FROM sistemaretiradas.tiny_orders
WHERE sync_at >= NOW() - INTERVAL '24 hours';

-- =============================================================================
-- 2. VERIFICAR ITENS COM TAMANHO E COR
-- =============================================================================

SELECT 
  'Itens com Tamanho e Cor' as verificacao,
  COUNT(*) as total_itens,
  COUNT(CASE WHEN item->>'tamanho' IS NOT NULL THEN 1 END) as com_tamanho,
  COUNT(CASE WHEN item->>'cor' IS NOT NULL THEN 1 END) as com_cor,
  COUNT(CASE WHEN item->>'categoria' IS NOT NULL THEN 1 END) as com_categoria,
  COUNT(CASE WHEN item->>'marca' IS NOT NULL THEN 1 END) as com_marca,
  COUNT(CASE WHEN item->>'tamanho' IS NOT NULL AND item->>'cor' IS NOT NULL THEN 1 END) as com_tamanho_e_cor
FROM sistemaretiradas.tiny_orders,
  jsonb_array_elements(itens) as item
WHERE sync_at >= NOW() - INTERVAL '24 hours'
  AND itens IS NOT NULL
  AND jsonb_typeof(itens::jsonb) = 'array';

-- =============================================================================
-- 3. VERIFICAR CLIENTES COM DADOS COMPLETOS
-- =============================================================================

SELECT 
  'Clientes com Dados Completos' as verificacao,
  COUNT(*) as total,
  COUNT(CASE WHEN telefone IS NOT NULL THEN 1 END) as com_telefone,
  COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as com_email,
  COUNT(CASE WHEN data_nascimento IS NOT NULL THEN 1 END) as com_data_nascimento,
  COUNT(CASE WHEN telefone IS NOT NULL AND email IS NOT NULL AND data_nascimento IS NOT NULL THEN 1 END) as completos
FROM sistemaretiradas.tiny_contacts
WHERE updated_at >= NOW() - INTERVAL '24 hours';

-- =============================================================================
-- 4. VERIFICAR HORÁRIOS DOS PEDIDOS (não devem ser todos 00:00:00)
-- =============================================================================

SELECT 
  'Horários dos Pedidos' as verificacao,
  COUNT(*) as total,
  COUNT(CASE WHEN data_pedido::text LIKE '%T00:00:00%' THEN 1 END) as com_hora_00_00_00,
  COUNT(CASE WHEN data_pedido::text NOT LIKE '%T00:00:00%' THEN 1 END) as com_hora_real,
  ROUND(100.0 * COUNT(CASE WHEN data_pedido::text NOT LIKE '%T00:00:00%' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as percentual_hora_real
FROM sistemaretiradas.tiny_orders
WHERE sync_at >= NOW() - INTERVAL '24 hours'
  AND data_pedido IS NOT NULL;

-- =============================================================================
-- 5. EXEMPLOS DE PEDIDOS RECENTES COM DADOS COMPLETOS
-- =============================================================================

SELECT 
  'Exemplos de Pedidos Completos' as verificacao,
  numero_pedido,
  data_pedido,
  cliente_nome,
  vendedor_nome,
  jsonb_array_length(itens::jsonb) as quantidade_itens,
  CASE 
    WHEN itens IS NOT NULL AND jsonb_typeof(itens::jsonb) = 'array' THEN
      (SELECT COUNT(*) FROM jsonb_array_elements(itens) WHERE value->>'tamanho' IS NOT NULL AND value->>'cor' IS NOT NULL)
    ELSE 0
  END as itens_com_tamanho_e_cor,
  sync_at
FROM sistemaretiradas.tiny_orders
WHERE sync_at >= NOW() - INTERVAL '24 hours'
  AND itens IS NOT NULL
  AND jsonb_typeof(itens::jsonb) = 'array'
ORDER BY sync_at DESC
LIMIT 10;

-- =============================================================================
-- 6. EXEMPLOS DE ITENS COM TAMANHO E COR
-- =============================================================================

SELECT 
  'Exemplos de Itens' as verificacao,
  o.numero_pedido,
  item->>'descricao' as produto,
  item->>'tamanho' as tamanho,
  item->>'cor' as cor,
  item->>'categoria' as categoria,
  item->>'marca' as marca,
  o.sync_at
FROM sistemaretiradas.tiny_orders o,
  jsonb_array_elements(o.itens) as item
WHERE o.sync_at >= NOW() - INTERVAL '24 hours'
  AND o.itens IS NOT NULL
  AND jsonb_typeof(o.itens::jsonb) = 'array'
  AND item->>'tamanho' IS NOT NULL
  AND item->>'cor' IS NOT NULL
ORDER BY o.sync_at DESC
LIMIT 20;

-- =============================================================================
-- 7. ESTATÍSTICAS GERAIS
-- =============================================================================

SELECT 
  'Estatísticas Gerais' as verificacao,
  (SELECT COUNT(*) FROM sistemaretiradas.tiny_orders WHERE sync_at >= NOW() - INTERVAL '24 hours') as pedidos_ultimas_24h,
  (SELECT COUNT(*) FROM sistemaretiradas.tiny_contacts WHERE updated_at >= NOW() - INTERVAL '24 hours') as clientes_ultimas_24h,
  (SELECT COUNT(*) FROM sistemaretiradas.tiny_orders WHERE sync_at >= NOW() - INTERVAL '7 days') as pedidos_ultimos_7_dias,
  (SELECT COUNT(*) FROM sistemaretiradas.tiny_contacts WHERE updated_at >= NOW() - INTERVAL '7 days') as clientes_ultimos_7_dias;

