-- Índices adicionais para otimização de queries

-- 1. Índice para consultas de vendas por colaboradora e data
CREATE INDEX IF NOT EXISTS idx_sales_colaboradora_data 
ON sistemaretiradas.sales(colaboradora_id, data_venda DESC);

-- 2. Índice para consultas de vendas por loja e data
CREATE INDEX IF NOT EXISTS idx_sales_store_data 
ON sistemaretiradas.sales(store_id, data_venda DESC);

-- 3. Índice composto para metas por colaboradora e mês
CREATE INDEX IF NOT EXISTS idx_goals_colaboradora_mes 
ON sistemaretiradas.goals(colaboradora_id, mes_referencia DESC, tipo) 
WHERE colaboradora_id IS NOT NULL;

-- 4. Índice para consultas de analytics por data
CREATE INDEX IF NOT EXISTS idx_analytics_date 
ON sistemaretiradas.sales(date_trunc('day', data_venda), store_id, colaboradora_id);

-- 5. Índice para consultas de parcelas por competência
CREATE INDEX IF NOT EXISTS idx_parcelas_competencia 
ON sistemaretiradas.parcelas(competencia DESC, status_parcela);

-- 6. Índice para consultas de adiantamentos por mês de competência
CREATE INDEX IF NOT EXISTS idx_adiantamentos_competencia 
ON sistemaretiradas.adiantamentos(mes_competencia DESC, status);

-- Comentários explicativos
COMMENT ON INDEX idx_sales_colaboradora_data IS 'Otimiza queries de vendas por colaboradora ordenadas por data';
COMMENT ON INDEX idx_sales_store_data IS 'Otimiza queries de vendas por loja ordenadas por data';
COMMENT ON INDEX idx_goals_colaboradora_mes IS 'Otimiza busca de metas individuais por colaboradora e mês';
COMMENT ON INDEX idx_analytics_date IS 'Otimiza agregações diárias para analytics';
COMMENT ON INDEX idx_parcelas_competencia IS 'Otimiza filtros de parcelas por competência';
COMMENT ON INDEX idx_adiantamentos_competencia IS 'Otimiza filtros de adiantamentos por competência';

