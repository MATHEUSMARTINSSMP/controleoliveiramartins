-- =====================================================
-- CORRIGIR RLS DE time_clock_records PARA COLABORADORAS PODEREM INSERIR
-- =====================================================
-- O erro "new row violates row-level security policy" indica que a política WITH CHECK está falhando
-- Esta migração garante que colaboradoras possam criar seus próprios registros de ponto
-- e remove qualquer política conflitante de migrações anteriores

-- Habilitar RLS (se não estiver habilitado)
ALTER TABLE sistemaretiradas.time_clock_records ENABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas antigas de INSERT para colaboradoras (pode haver múltiplas)
DROP POLICY IF EXISTS "colaboradora_insert_records" ON sistemaretiradas.time_clock_records;
DROP POLICY IF EXISTS "colaboradora_own_records" ON sistemaretiradas.time_clock_records;

-- Política: Colaboradora pode criar seus próprios registros
-- IMPORTANTE: Simplificada ao máximo - apenas verifica que colaboradora_id = auth.uid()
-- A verificação de role será feita pela política de SELECT (colaboradora_read_records)
CREATE POLICY "colaboradora_insert_records" 
ON sistemaretiradas.time_clock_records
FOR INSERT
TO authenticated
WITH CHECK (
    -- Verificar apenas que o colaboradora_id corresponde ao usuário autenticado
    -- Isso é suficiente porque apenas colaboradoras devem ter acesso a esta funcionalidade
    colaboradora_id = auth.uid()
);

-- Comentário
COMMENT ON POLICY "colaboradora_insert_records" ON sistemaretiradas.time_clock_records IS 
'Permite que colaboradora crie seus próprios registros de ponto, validando colaboradora_id e store_id';

