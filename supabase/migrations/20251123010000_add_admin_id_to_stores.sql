-- Migration: Adicionar admin_id na tabela stores
-- Descrição: Permite vincular cada loja a um administrador específico
-- Data: 2025-11-23

-- ============================================
-- 1. ADICIONAR COLUNA admin_id NA TABELA stores
-- ============================================

-- Adicionar coluna admin_id (FK para profiles.id)
ALTER TABLE sistemaretiradas.stores
ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE SET NULL;

-- Adicionar comentário na coluna
COMMENT ON COLUMN sistemaretiradas.stores.admin_id IS 'ID do administrador responsável pela loja. Referencia profiles.id onde role = ADMIN.';

-- ============================================
-- 2. CRIAR ÍNDICE PARA MELHOR PERFORMANCE
-- ============================================

-- Criar índice na coluna admin_id para otimizar buscas
CREATE INDEX IF NOT EXISTS idx_stores_admin_id 
ON sistemaretiradas.stores(admin_id) 
WHERE admin_id IS NOT NULL;

-- ============================================
-- 3. ATUALIZAR DADOS EXISTENTES (OPCIONAL)
-- ============================================

-- Vincular a loja "Mr. Kitsch" ao admin existente (exemplo)
-- Descomente e ajuste conforme necessário:
-- UPDATE sistemaretiradas.stores
-- SET admin_id = '7391610a-f83b-4727-875f-81299b8bfa68'
-- WHERE name = 'Mr. Kitsch' AND admin_id IS NULL;

-- ============================================
-- 4. ADICIONAR CONSTRAINT DE VALIDAÇÃO (OPCIONAL)
-- ============================================

-- Garantir que admin_id sempre referencia um profile com role = ADMIN
-- Isso pode ser feito via trigger ou check constraint
-- Por enquanto, vamos confiar na lógica da aplicação

-- ============================================
-- 5. COMENTÁRIO DE DOCUMENTAÇÃO
-- ============================================

COMMENT ON TABLE sistemaretiradas.stores IS 
'Tabela de lojas. Cada loja pode ter um admin_id vinculado ao administrador responsável. 
O admin_id referencia profiles.id onde o perfil tem role = ADMIN.';

