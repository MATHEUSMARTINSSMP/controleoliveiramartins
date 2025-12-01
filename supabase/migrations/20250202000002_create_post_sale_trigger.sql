-- ============================================================================
-- Migration: Trigger para criar pós-vendas automaticamente
-- Data: 2025-02-02
-- Descrição: Cria trigger que automaticamente cria pós-vendas quando vendas são criadas
-- ============================================================================

-- Função para criar pós-venda automaticamente
CREATE OR REPLACE FUNCTION sistemaretiradas.criar_pos_venda_automatica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_crm_ativo BOOLEAN;
  v_cliente_nome TEXT;
  v_tiny_order_id UUID;
  v_follow_up_date DATE;
BEGIN
  -- Verificar se o CRM está ativo para esta loja
  SELECT crm_ativo INTO v_crm_ativo
  FROM sistemaretiradas.stores
  WHERE id = NEW.store_id;

  -- Se CRM não estiver ativo, não criar pós-venda
  IF NOT v_crm_ativo THEN
    RETURN NEW;
  END IF;

  -- Buscar nome do cliente
  v_cliente_nome := 'Cliente não identificado';
  
  -- Se a venda veio do ERP (tiny_order_id), buscar nome do cliente do pedido
  IF NEW.tiny_order_id IS NOT NULL THEN
    SELECT cliente_nome INTO v_cliente_nome
    FROM sistemaretiradas.tiny_orders
    WHERE id = NEW.tiny_order_id;
    
    -- Se não encontrou, usar padrão
    IF v_cliente_nome IS NULL OR v_cliente_nome = '' THEN
      v_cliente_nome := 'Cliente não identificado';
    END IF;
  END IF;

  -- Calcular data do follow-up (7 dias após a venda)
  v_follow_up_date := (NEW.data_venda::DATE + INTERVAL '7 days')::DATE;

  -- Criar pós-venda
  INSERT INTO sistemaretiradas.crm_post_sales (
    store_id,
    sale_id,
    tiny_order_id,
    colaboradora_id,
    cliente_nome,
    sale_date,
    scheduled_follow_up,
    details,
    status
  ) VALUES (
    NEW.store_id,
    NEW.id,
    NEW.tiny_order_id,
    NEW.colaboradora_id,
    v_cliente_nome,
    NEW.data_venda::DATE,
    v_follow_up_date,
    'Pós-venda automática criada para venda realizada em ' || TO_CHAR(NEW.data_venda::DATE, 'DD/MM/YYYY'),
    'AGENDADA'
  )
  ON CONFLICT DO NOTHING; -- Evitar duplicatas se o trigger for chamado múltiplas vezes

  RETURN NEW;
END;
$$;

-- Criar trigger que executa após INSERT na tabela sales
DROP TRIGGER IF EXISTS trigger_criar_pos_venda_automatica ON sistemaretiradas.sales;

CREATE TRIGGER trigger_criar_pos_venda_automatica
  AFTER INSERT ON sistemaretiradas.sales
  FOR EACH ROW
  WHEN (NEW.store_id IS NOT NULL)
  EXECUTE FUNCTION sistemaretiradas.criar_pos_venda_automatica();

-- Comentários
COMMENT ON FUNCTION sistemaretiradas.criar_pos_venda_automatica() IS 
'Cria automaticamente uma pós-venda agendada quando uma venda é criada, se o CRM estiver ativo para a loja';

COMMENT ON TRIGGER trigger_criar_pos_venda_automatica ON sistemaretiradas.sales IS 
'Trigger que cria pós-vendas automaticamente após inserção de vendas';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

