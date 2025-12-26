-- Migration: Proteção contra parcelas faltantes
-- Data: 2025-12-26
-- Descrição: Adiciona trigger para garantir que parcelas sejam criadas automaticamente

-- ============================================
-- FUNÇÃO: Gerar parcelas automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION sistemaretiradas.auto_create_parcelas()
RETURNS TRIGGER AS $$
DECLARE
  v_valor_base NUMERIC;
  v_total_parcelas NUMERIC;
  v_diferenca NUMERIC;
  v_valor_parcela NUMERIC;
  v_ano INT;
  v_mes INT;
  v_mes_atual INT;
  v_ano_atual INT;
  v_competencia TEXT;
  v_parcelas_criadas INT := 0;
BEGIN
  -- Apenas para compras de colaboradoras (que têm colaboradora_id)
  IF NEW.colaboradora_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calcular valor base da parcela (arredondamento bancário)
  v_valor_base := ROUND((NEW.preco_final / NEW.num_parcelas)::NUMERIC, 2);
  v_total_parcelas := v_valor_base * NEW.num_parcelas;
  v_diferenca := NEW.preco_final - v_total_parcelas;

  -- Extrair ano e mês da data da compra
  v_ano := EXTRACT(YEAR FROM NEW.data_compra);
  v_mes := EXTRACT(MONTH FROM NEW.data_compra);

  -- Gerar parcelas
  FOR i IN 1..NEW.num_parcelas LOOP
    v_mes_atual := v_mes + (i - 1);
    v_ano_atual := v_ano + ((v_mes_atual - 1) / 12)::INT;
    v_mes_atual := ((v_mes_atual - 1) % 12) + 1;
    v_competencia := v_ano_atual::TEXT || LPAD(v_mes_atual::TEXT, 2, '0');

    -- Ajustar diferença na última parcela
    IF i = NEW.num_parcelas THEN
      v_valor_parcela := v_valor_base + v_diferenca;
    ELSE
      v_valor_parcela := v_valor_base;
    END IF;

    -- Inserir parcela
    INSERT INTO sistemaretiradas.parcelas (
      compra_id,
      n_parcela,
      competencia,
      valor_parcela,
      status_parcela
    ) VALUES (
      NEW.id,
      i,
      v_competencia,
      v_valor_parcela,
      'PENDENTE'
    );

    v_parcelas_criadas := v_parcelas_criadas + 1;
  END LOOP;

  -- Log para auditoria
  RAISE NOTICE 'Auto-criadas % parcelas para compra %', v_parcelas_criadas, NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Criar parcelas após inserir compra
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_create_parcelas ON sistemaretiradas.purchases;

CREATE TRIGGER trigger_auto_create_parcelas
  AFTER INSERT ON sistemaretiradas.purchases
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.auto_create_parcelas();

-- ============================================
-- FUNÇÃO: Validar integridade de parcelas
-- ============================================
CREATE OR REPLACE FUNCTION sistemaretiradas.validate_parcelas_integrity()
RETURNS TABLE (
  compra_id UUID,
  num_parcelas_esperado INT,
  num_parcelas_encontrado BIGINT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.num_parcelas,
    COUNT(parc.id),
    CASE 
      WHEN COUNT(parc.id) = 0 THEN 'CRÍTICO: Sem parcelas'
      WHEN COUNT(parc.id) < p.num_parcelas THEN 'AVISO: Parcelas incompletas'
      WHEN COUNT(parc.id) > p.num_parcelas THEN 'ERRO: Parcelas em excesso'
      ELSE 'OK'
    END
  FROM sistemaretiradas.purchases p
  LEFT JOIN sistemaretiradas.parcelas parc ON parc.compra_id = p.id
  WHERE p.colaboradora_id IS NOT NULL
  GROUP BY p.id, p.num_parcelas
  HAVING COUNT(parc.id) != p.num_parcelas
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Compras com problemas de parcelas
-- ============================================
CREATE OR REPLACE VIEW sistemaretiradas.v_purchases_missing_parcelas AS
SELECT 
  p.id as purchase_id,
  p.data_compra,
  p.item,
  p.preco_final,
  p.num_parcelas as parcelas_esperadas,
  COUNT(parc.id) as parcelas_encontradas,
  p.created_at
FROM sistemaretiradas.purchases p
LEFT JOIN sistemaretiradas.parcelas parc ON parc.compra_id = p.id
WHERE p.colaboradora_id IS NOT NULL
GROUP BY p.id, p.data_compra, p.item, p.preco_final, p.num_parcelas, p.created_at
HAVING COUNT(parc.id) != p.num_parcelas;

-- ============================================
-- COMENTÁRIOS
-- ============================================
COMMENT ON FUNCTION sistemaretiradas.auto_create_parcelas() IS 
  'Trigger function que cria parcelas automaticamente quando uma compra é inserida. Garante que nunca haverá compras sem parcelas.';

COMMENT ON FUNCTION sistemaretiradas.validate_parcelas_integrity() IS 
  'Função de validação que retorna todas as compras com problemas de parcelas (faltando, em excesso, ou sem nenhuma).';

COMMENT ON VIEW sistemaretiradas.v_purchases_missing_parcelas IS 
  'View que mostra compras com parcelas faltantes. Deve estar sempre vazia se o trigger estiver funcionando corretamente.';
