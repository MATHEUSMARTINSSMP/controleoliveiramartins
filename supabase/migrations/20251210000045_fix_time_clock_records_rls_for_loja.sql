-- =====================================================
-- CORRIGIR RLS DE time_clock_records PARA PERMITIR LOJA VER REGISTROS
-- =====================================================
-- O erro de CORS indica que as políticas RLS estão bloqueando o acesso
-- Esta migração garante que LOJA possa ver registros das colaboradoras da sua loja

-- Habilitar RLS (se não estiver habilitado)
ALTER TABLE sistemaretiradas.time_clock_records ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "colaboradora_own_records" ON sistemaretiradas.time_clock_records;
DROP POLICY IF EXISTS "colaboradora_insert_records" ON sistemaretiradas.time_clock_records;
DROP POLICY IF EXISTS "colaboradora_read_records" ON sistemaretiradas.time_clock_records;
DROP POLICY IF EXISTS "admin_store_records" ON sistemaretiradas.time_clock_records;
DROP POLICY IF EXISTS "loja_store_records" ON sistemaretiradas.time_clock_records;

-- Política: Colaboradora pode ler seus próprios registros
CREATE POLICY "colaboradora_read_records" 
ON sistemaretiradas.time_clock_records
FOR SELECT
TO authenticated
USING (
    colaboradora_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'COLABORADORA'
          AND is_active = true
    )
);

-- Política: Colaboradora pode criar seus próprios registros
CREATE POLICY "colaboradora_insert_records" 
ON sistemaretiradas.time_clock_records
FOR INSERT
TO authenticated
WITH CHECK (
    colaboradora_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'COLABORADORA'
          AND is_active = true
    )
);

-- Política: LOJA pode ler registros das colaboradoras da sua loja
CREATE POLICY "loja_store_records" 
ON sistemaretiradas.time_clock_records
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p_loja
        JOIN sistemaretiradas.stores s ON s.id = p_loja.store_id OR s.admin_id = p_loja.id
        WHERE p_loja.id = auth.uid()
          AND p_loja.role = 'LOJA'
          AND p_loja.is_active = true
          AND (
              time_clock_records.store_id = s.id
              OR time_clock_records.store_id IN (
                  SELECT id FROM sistemaretiradas.stores 
                  WHERE admin_id = p_loja.id
              )
          )
    )
    OR
    -- LOJA também pode ver registros de colaboradoras que têm o mesmo store_id ou store_default
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p_loja
        JOIN sistemaretiradas.profiles p_colab ON (
            p_colab.store_id = p_loja.store_id 
            OR p_colab.store_default = (SELECT name FROM sistemaretiradas.stores WHERE id = p_loja.store_id LIMIT 1)
        )
        WHERE p_loja.id = auth.uid()
          AND p_loja.role = 'LOJA'
          AND p_loja.is_active = true
          AND time_clock_records.colaboradora_id = p_colab.id
          AND time_clock_records.store_id IN (
              SELECT id FROM sistemaretiradas.stores 
              WHERE id = p_loja.store_id 
              OR admin_id = (SELECT admin_id FROM sistemaretiradas.stores WHERE id = p_loja.store_id LIMIT 1)
          )
    )
);

-- Política: Admin pode fazer tudo com registros da sua loja
CREATE POLICY "admin_store_records" 
ON sistemaretiradas.time_clock_records
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'ADMIN'
          AND p.is_active = true
          AND (
              time_clock_records.store_id IN (
                  SELECT id FROM sistemaretiradas.stores WHERE admin_id = p.id
              )
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'ADMIN'
          AND p.is_active = true
          AND (
              time_clock_records.store_id IN (
                  SELECT id FROM sistemaretiradas.stores WHERE admin_id = p.id
              )
          )
    )
);

-- Comentários
COMMENT ON POLICY "colaboradora_read_records" ON sistemaretiradas.time_clock_records IS 
'Permite que colaboradora veja seus próprios registros de ponto';
COMMENT ON POLICY "colaboradora_insert_records" ON sistemaretiradas.time_clock_records IS 
'Permite que colaboradora crie seus próprios registros de ponto';
COMMENT ON POLICY "loja_store_records" ON sistemaretiradas.time_clock_records IS 
'Permite que LOJA veja registros das colaboradoras da sua loja';
COMMENT ON POLICY "admin_store_records" ON sistemaretiradas.time_clock_records IS 
'Permite que Admin gerencie todos os registros da sua loja';

