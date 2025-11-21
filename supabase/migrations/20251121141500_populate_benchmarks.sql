-- Populate store benchmarks with initial values
-- Using subqueries to find store IDs by name to avoid hardcoding UUIDs

INSERT INTO sistemaretiradas.store_benchmarks (store_id, ideal_ticket_medio, ideal_pa, ideal_preco_medio)
VALUES 
    (
        (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%Mr. Kitsch%' LIMIT 1),
        750.00, -- Ticket Médio
        3.00,   -- PA
        400.00  -- Preço Médio
    ),
    (
        (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%Sacada%' LIMIT 1),
        750.00,
        3.00,
        400.00
    ),
    (
        (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%Loungerie%' LIMIT 1),
        350.00,
        4.00,
        100.00
    )
ON CONFLICT (store_id) DO UPDATE SET
    ideal_ticket_medio = EXCLUDED.ideal_ticket_medio,
    ideal_pa = EXCLUDED.ideal_pa,
    ideal_preco_medio = EXCLUDED.ideal_preco_medio;
