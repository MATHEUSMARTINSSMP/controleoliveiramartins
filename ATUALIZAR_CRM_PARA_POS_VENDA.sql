-- ============================================================================
-- ATUALIZAR ESTRUTURA CRM PARA INTEGRAÇÃO COM PÓS-VENDA
-- ============================================================================
-- Este script adiciona campos necessários para o sistema de pós-venda integrado

-- ============================================================================
-- 1. ADICIONAR CAMPOS NA TABELA crm_tasks PARA PÓS-VENDA
-- ============================================================================
DO $$
BEGIN
    -- Adicionar campo: quem_fez (colaboradora que executou a tarefa)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'crm_tasks' 
        AND column_name = 'quem_fez'
    ) THEN
        ALTER TABLE sistemaretiradas.crm_tasks
        ADD COLUMN quem_fez UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE SET NULL;
        
        COMMENT ON COLUMN sistemaretiradas.crm_tasks.quem_fez IS 'Colaboradora que executou a tarefa (pode ser diferente da colaboradora_id que criou)';
    END IF;

    -- Adicionar campo: como_foi_contato (tipo de contato realizado)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'crm_tasks' 
        AND column_name = 'como_foi_contato'
    ) THEN
        ALTER TABLE sistemaretiradas.crm_tasks
        ADD COLUMN como_foi_contato TEXT CHECK (como_foi_contato IN ('WHATSAPP', 'TELEFONE', 'EMAIL', 'PRESENCIAL', 'OUTRO'));
        
        COMMENT ON COLUMN sistemaretiradas.crm_tasks.como_foi_contato IS 'Tipo de contato realizado (WHATSAPP, TELEFONE, EMAIL, PRESENCIAL, OUTRO)';
    END IF;

    -- Adicionar campo: cliente_respondeu (se o cliente respondeu ao contato)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'crm_tasks' 
        AND column_name = 'cliente_respondeu'
    ) THEN
        ALTER TABLE sistemaretiradas.crm_tasks
        ADD COLUMN cliente_respondeu BOOLEAN DEFAULT NULL;
        
        COMMENT ON COLUMN sistemaretiradas.crm_tasks.cliente_respondeu IS 'Se o cliente respondeu ao contato (true/false/null se ainda não foi contatado)';
    END IF;

    -- Adicionar campo: observacoes_contato (observações sobre o contato)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'crm_tasks' 
        AND column_name = 'observacoes_contato'
    ) THEN
        ALTER TABLE sistemaretiradas.crm_tasks
        ADD COLUMN observacoes_contato TEXT;
        
        COMMENT ON COLUMN sistemaretiradas.crm_tasks.observacoes_contato IS 'Observações sobre o contato realizado';
    END IF;

    -- Adicionar campo: sale_id (link com a venda que gerou a tarefa)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'crm_tasks' 
        AND column_name = 'sale_id'
    ) THEN
        ALTER TABLE sistemaretiradas.crm_tasks
        ADD COLUMN sale_id UUID REFERENCES sistemaretiradas.sales(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_crm_tasks_sale ON sistemaretiradas.crm_tasks(sale_id);
        
        COMMENT ON COLUMN sistemaretiradas.crm_tasks.sale_id IS 'ID da venda que gerou esta tarefa de pós-venda';
    END IF;

    -- Adicionar campo: cliente_whatsapp (WhatsApp do cliente para facilitar contato)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'crm_tasks' 
        AND column_name = 'cliente_whatsapp'
    ) THEN
        ALTER TABLE sistemaretiradas.crm_tasks
        ADD COLUMN cliente_whatsapp TEXT;
        
        COMMENT ON COLUMN sistemaretiradas.crm_tasks.cliente_whatsapp IS 'WhatsApp do cliente para facilitar contato';
    END IF;

    -- Adicionar campo: informacoes_cliente (ocasião, viagem, evento, etc.)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'crm_tasks' 
        AND column_name = 'informacoes_cliente'
    ) THEN
        ALTER TABLE sistemaretiradas.crm_tasks
        ADD COLUMN informacoes_cliente TEXT;
        
        COMMENT ON COLUMN sistemaretiradas.crm_tasks.informacoes_cliente IS 'Informações do cliente (ocasião, viagem, evento, etc.) para melhor pós-venda';
    END IF;

    -- Adicionar campo: atribuido_para (para tarefas normais, pode ser "TODOS")
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'crm_tasks' 
        AND column_name = 'atribuido_para'
    ) THEN
        ALTER TABLE sistemaretiradas.crm_tasks
        ADD COLUMN atribuido_para TEXT DEFAULT NULL;
        
        COMMENT ON COLUMN sistemaretiradas.crm_tasks.atribuido_para IS 'Atribuído para colaboradora específica ou "TODOS" para tarefas gerais';
    END IF;
END $$;

-- ============================================================================
-- 2. ADICIONAR CAMPOS NA TABELA crm_post_sales PARA INFORMAÇÕES DO CLIENTE
-- ============================================================================
DO $$
BEGIN
    -- Adicionar campo: cliente_whatsapp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'crm_post_sales' 
        AND column_name = 'cliente_whatsapp'
    ) THEN
        ALTER TABLE sistemaretiradas.crm_post_sales
        ADD COLUMN cliente_whatsapp TEXT;
        
        COMMENT ON COLUMN sistemaretiradas.crm_post_sales.cliente_whatsapp IS 'WhatsApp do cliente para facilitar contato no pós-venda';
    END IF;

    -- Adicionar campo: informacoes_cliente (ocasião, viagem, evento, etc.)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'crm_post_sales' 
        AND column_name = 'informacoes_cliente'
    ) THEN
        ALTER TABLE sistemaretiradas.crm_post_sales
        ADD COLUMN informacoes_cliente TEXT;
        
        COMMENT ON COLUMN sistemaretiradas.crm_post_sales.informacoes_cliente IS 'Informações do cliente (ocasião, viagem, evento, etc.) para melhor pós-venda';
    END IF;

    -- Adicionar campo: observacoes_venda (observações da venda original)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'crm_post_sales' 
        AND column_name = 'observacoes_venda'
    ) THEN
        ALTER TABLE sistemaretiradas.crm_post_sales
        ADD COLUMN observacoes_venda TEXT;
        
        COMMENT ON COLUMN sistemaretiradas.crm_post_sales.observacoes_venda IS 'Observações da venda original que gerou este pós-venda';
    END IF;
END $$;

-- ============================================================================
-- 3. VERIFICAR ESTRUTURA ATUAL
-- ============================================================================
SELECT 
    'crm_tasks' as tabela,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'crm_tasks'
  AND column_name IN ('quem_fez', 'como_foi_contato', 'cliente_respondeu', 'observacoes_contato', 'sale_id', 'cliente_whatsapp', 'informacoes_cliente', 'atribuido_para')
ORDER BY column_name;

SELECT 
    'crm_post_sales' as tabela,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'crm_post_sales'
  AND column_name IN ('cliente_whatsapp', 'informacoes_cliente', 'observacoes_venda')
ORDER BY column_name;

