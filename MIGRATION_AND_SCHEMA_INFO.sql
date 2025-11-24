-- =============================================================================
-- PARTE 1: MIGRATION (CRIAÇÃO DA TABELA DE COLABORADORAS DO BÔNUS)
-- Execute esta parte para corrigir o problema de seleção de colaboradoras
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- 1. Criar tabela de vínculo se não existir
CREATE TABLE IF NOT EXISTS bonus_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bonus_id UUID NOT NULL REFERENCES bonuses(id) ON DELETE CASCADE,
    colaboradora_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(bonus_id, colaboradora_id)
);

-- 2. Habilitar segurança (RLS)
ALTER TABLE bonus_collaborators ENABLE ROW LEVEL SECURITY;

-- 3. Limpar políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "admin_all_bonus_collaborators" ON bonus_collaborators;
DROP POLICY IF EXISTS "loja_manage_bonus_collaborators" ON bonus_collaborators;
DROP POLICY IF EXISTS "colab_view_own_bonus_collaborators" ON bonus_collaborators;

-- 4. Criar políticas de acesso

-- Admin pode tudo
CREATE POLICY "admin_all_bonus_collaborators" 
ON bonus_collaborators FOR ALL 
USING (get_user_role() = 'ADMIN');

-- Loja gerencia suas colaboradoras
CREATE POLICY "loja_manage_bonus_collaborators" 
ON bonus_collaborators FOR ALL 
USING (
    get_user_role() = 'LOJA' 
    AND EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = bonus_collaborators.colaboradora_id 
        AND p.store_id::text = get_user_store_id_text()
    )
);

-- Colaboradora vê os seus
CREATE POLICY "colab_view_own_bonus_collaborators" 
ON bonus_collaborators FOR SELECT 
USING (colaboradora_id = auth.uid());

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_bonus_collaborators_bonus_id ON bonus_collaborators(bonus_id);
CREATE INDEX IF NOT EXISTS idx_bonus_collaborators_colaboradora_id ON bonus_collaborators(colaboradora_id);


-- =============================================================================
-- PARTE 2: INSPEÇÃO DO SCHEMA (Listar todas as tabelas e colunas)
-- Isso mostrará a estrutura atual do seu banco de dados no schema 'sistemaretiradas'
-- =============================================================================

SELECT 
    t.table_name AS "Tabela",
    c.column_name AS "Coluna",
    c.data_type AS "Tipo de Dado",
    c.is_nullable AS "Aceita Null?"
FROM 
    information_schema.tables t
JOIN 
    information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE 
    t.table_schema = 'sistemaretiradas'
ORDER BY 
    t.table_name, c.ordinal_position;
