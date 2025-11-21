-- Remove TODAS as políticas existentes da tabela goals
DROP POLICY IF EXISTS "Admin equal access goals" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "Colaboradora de suas metas" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "Admins can insert goals" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "Admins can update goals" ON sistemaretiradas.goals;

-- Agora cria as novas políticas para admins
CREATE POLICY "Admins can insert goals" 
ON sistemaretiradas.goals
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sistemaretiradas.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

CREATE POLICY "Admins can update goals" 
ON sistemaretiradas.goals
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sistemaretiradas.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sistemaretiradas.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Política para admins poderem ler todas as metas
CREATE POLICY "Admins can select goals" 
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sistemaretiradas.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Política para colaboradoras lerem suas próprias metas
CREATE POLICY "Colaboradoras can select their goals" 
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
  colaboradora_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM sistemaretiradas.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);
