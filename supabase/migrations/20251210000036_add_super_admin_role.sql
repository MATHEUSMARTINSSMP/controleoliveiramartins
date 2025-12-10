-- =====================================================
-- ADICIONAR CAMPO is_super_admin PARA DIFERENCIAR ADMIN DE SUPER ADMIN
-- =====================================================
-- Esta migração adiciona um campo para identificar Super Admins
-- Super Admin = Matheus (dono do sistema)
-- Admin = Clientes que compram o sistema

-- Adicionar coluna is_super_admin
ALTER TABLE sistemaretiradas.profiles
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_super_admin ON sistemaretiradas.profiles(is_super_admin);

-- Marcar dev@dev.com como super admin
UPDATE sistemaretiradas.profiles
SET is_super_admin = TRUE
WHERE email = 'dev@dev.com';

-- Comentário
COMMENT ON COLUMN sistemaretiradas.profiles.is_super_admin IS 'Indica se o perfil é Super Admin (dono do sistema). Super Admins têm acesso total a todas as funcionalidades e dados do sistema.';

-- Adicionar constraint para garantir que apenas admins podem ser super admins
ALTER TABLE sistemaretiradas.profiles
ADD CONSTRAINT check_super_admin_is_admin 
CHECK (
  (is_super_admin = TRUE AND role = 'ADMIN') OR 
  is_super_admin = FALSE
);

COMMENT ON CONSTRAINT check_super_admin_is_admin ON sistemaretiradas.profiles IS 'Apenas perfis com role ADMIN podem ser Super Admin';

