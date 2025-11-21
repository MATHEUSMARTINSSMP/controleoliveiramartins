-- 1. Tabela de Benchmarks (Metas de Qualidade por Loja)
CREATE TABLE IF NOT EXISTS sistemaretiradas.store_benchmarks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES sistemaretiradas.stores(id) NOT NULL,
    ideal_ticket_medio DECIMAL(10,2) NOT NULL, -- Ex: 750.00
    ideal_pa DECIMAL(4,2) NOT NULL,            -- Ex: 3.00
    ideal_preco_medio DECIMAL(10,2) NOT NULL,  -- Ex: 400.00
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id)
);

-- 2. View Analítica Diária (A base para todos os relatórios rápidos)
-- Agrupa vendas por Dia, Loja e Colaboradora, calculando KPIs automaticamente.
CREATE OR REPLACE VIEW sistemaretiradas.analytics_daily_performance AS
SELECT 
    date_trunc('day', s.data_venda)::date as data_referencia,
    s.store_id,
    st.name as store_name,
    s.colaboradora_id,
    p.name as colaboradora_name,
    COUNT(s.id) as total_vendas,
    SUM(s.valor) as total_valor,
    SUM(s.qtd_pecas) as total_pecas,
    -- KPIs Calculados
    CASE WHEN COUNT(s.id) > 0 THEN SUM(s.valor) / COUNT(s.id) ELSE 0 END as ticket_medio,
    CASE WHEN COUNT(s.id) > 0 THEN SUM(s.qtd_pecas)::DECIMAL / COUNT(s.id) ELSE 0 END as pa,
    CASE WHEN SUM(s.qtd_pecas) > 0 THEN SUM(s.valor) / SUM(s.qtd_pecas) ELSE 0 END as preco_medio
FROM 
    sistemaretiradas.sales s
    JOIN sistemaretiradas.stores st ON s.store_id = st.id
    JOIN sistemaretiradas.profiles p ON s.colaboradora_id = p.id
GROUP BY 
    1, 2, 3, 4, 5;

-- 3. Políticas RLS para a nova tabela
ALTER TABLE sistemaretiradas.store_benchmarks ENABLE ROW LEVEL SECURITY;

-- Admins podem tudo nos benchmarks
CREATE POLICY "Admins manage benchmarks" ON sistemaretiradas.store_benchmarks
    FOR ALL USING (auth.uid() IN (SELECT id FROM sistemaretiradas.profiles WHERE role = 'ADMIN'));

-- Todos podem ler benchmarks (para verem suas metas de qualidade)
CREATE POLICY "Everyone reads benchmarks" ON sistemaretiradas.store_benchmarks
    FOR SELECT USING (true);
