-- ============================================================================
-- FIX: Criar RPC para contar total de pedidos corretamente
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.count_total_orders(p_store_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM sistemaretiradas.tiny_orders
  WHERE store_id = p_store_id;
  
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.count_total_orders IS 'Retorna o total de registros de pedidos (não apenas únicos)';

-- Grant para roles necessárias
GRANT EXECUTE ON FUNCTION sistemaretiradas.count_total_orders TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.count_total_orders TO anon;
