-- Criar tabela para armazenar templates de mensagens personalizadas do CRM por loja
CREATE TABLE IF NOT EXISTS sistemaretiradas.crm_message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    
    -- Templates de mensagens
    birthday_message TEXT DEFAULT 'Oi {nome}! Feliz Aniversário! 🎉 Aproveite nosso cupom HAPPY20 com 20% OFF em sua próxima compra!',
    post_sale_message TEXT DEFAULT 'Oi {nome}! Esperamos que esteja satisfeita com sua compra! Como podemos ajudar você hoje?',
    task_message TEXT DEFAULT 'Oi {nome}! Lembramos que você tem uma tarefa pendente: {tarefa}',
    commitment_message TEXT DEFAULT 'Oi {nome}! Lembramos do seu compromisso: {compromisso}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Garantir que cada loja tenha apenas um template
    UNIQUE(store_id)
);

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_crm_message_templates_store_id ON sistemaretiradas.crm_message_templates(store_id);

-- Habilitar RLS
ALTER TABLE sistemaretiradas.crm_message_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver templates de suas lojas
CREATE POLICY "Users can view templates of their stores"
    ON sistemaretiradas.crm_message_templates
    FOR SELECT
    USING (
        store_id IN (
            SELECT store_id FROM sistemaretiradas.profiles 
            WHERE id = auth.uid()
        )
    );

-- Policy: Usuários admin podem ver todos os templates
CREATE POLICY "Admin users can view all templates"
    ON sistemaretiradas.crm_message_templates
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles 
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Policy: Usuários podem atualizar templates de suas lojas
CREATE POLICY "Users can update templates of their stores"
    ON sistemaretiradas.crm_message_templates
    FOR UPDATE
    USING (
        store_id IN (
            SELECT store_id FROM sistemaretiradas.profiles 
            WHERE id = auth.uid()
        )
    );

-- Policy: Usuários admin podem atualizar todos os templates
CREATE POLICY "Admin users can update all templates"
    ON sistemaretiradas.crm_message_templates
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles 
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Policy: Usuários podem inserir templates para suas lojas
CREATE POLICY "Users can insert templates for their stores"
    ON sistemaretiradas.crm_message_templates
    FOR INSERT
    WITH CHECK (
        store_id IN (
            SELECT store_id FROM sistemaretiradas.profiles 
            WHERE id = auth.uid()
        )
    );

-- Policy: Usuários admin podem inserir templates para qualquer loja
CREATE POLICY "Admin users can insert templates for any store"
    ON sistemaretiradas.crm_message_templates
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles 
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION sistemaretiradas.update_crm_message_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_crm_message_templates_updated_at
    BEFORE UPDATE ON sistemaretiradas.crm_message_templates
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_crm_message_templates_updated_at();

-- Inserir templates padrão para todas as lojas existentes
INSERT INTO sistemaretiradas.crm_message_templates (store_id)
SELECT id FROM sistemaretiradas.stores
ON CONFLICT (store_id) DO NOTHING;

