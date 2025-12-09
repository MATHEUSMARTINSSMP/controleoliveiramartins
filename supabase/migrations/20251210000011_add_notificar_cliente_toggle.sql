-- =====================================================
-- ADICIONAR TOGGLE PARA NOTIFICAR CLIENTE
-- =====================================================
-- Adiciona campo para controlar se o cliente recebe notificações
-- e garante que o telefone do cliente está salvo

-- 1. Adicionar campo notificar_cliente em conditionals
ALTER TABLE sistemaretiradas.conditionals
ADD COLUMN IF NOT EXISTS notificar_cliente BOOLEAN DEFAULT false;

COMMENT ON COLUMN sistemaretiradas.conditionals.notificar_cliente IS 
'Se true, o cliente receberá notificações WhatsApp sobre mudanças de status. Padrão: false (desativado)';

-- 2. Adicionar campo notificar_cliente em adjustments
ALTER TABLE sistemaretiradas.adjustments
ADD COLUMN IF NOT EXISTS notificar_cliente BOOLEAN DEFAULT false;

COMMENT ON COLUMN sistemaretiradas.adjustments.notificar_cliente IS 
'Se true, o cliente receberá notificações WhatsApp sobre mudanças de status. Padrão: false (desativado)';

-- 3. Garantir que customer_contact existe e não é nulo (já deve existir, mas vamos garantir)
-- Se customer_contact não existir, criar (mas provavelmente já existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'conditionals' 
        AND column_name = 'customer_contact'
    ) THEN
        ALTER TABLE sistemaretiradas.conditionals
        ADD COLUMN customer_contact TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'adjustments' 
        AND column_name = 'customer_contact'
    ) THEN
        ALTER TABLE sistemaretiradas.adjustments
        ADD COLUMN customer_contact TEXT;
    END IF;
END $$;

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_conditionals_notificar_cliente 
ON sistemaretiradas.conditionals(notificar_cliente) 
WHERE notificar_cliente = true;

CREATE INDEX IF NOT EXISTS idx_adjustments_notificar_cliente 
ON sistemaretiradas.adjustments(notificar_cliente) 
WHERE notificar_cliente = true;

