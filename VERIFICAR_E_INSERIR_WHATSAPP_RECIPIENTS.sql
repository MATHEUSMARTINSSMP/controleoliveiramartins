-- Script para verificar e inserir destinatários WhatsApp
-- Execute este script no Supabase SQL Editor

-- ============================================
-- 1. VERIFICAR ADMIN E LOJAS
-- ============================================

-- Verificar admin
SELECT 
  id,
  name,
  email,
  role,
  active
FROM sistemaretiradas.profiles
WHERE id = '7391610a-f83b-4727-875f-81299b8bfa68';

-- Verificar lojas vinculadas ao admin
SELECT 
  s.id,
  s.name as store_name,
  s.admin_id,
  p.name as admin_name
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.profiles p ON p.id = s.admin_id
WHERE s.admin_id = '7391610a-f83b-4727-875f-81299b8bfa68'
  AND s.active = true;

-- ============================================
-- 2. VERIFICAR DESTINATÁRIOS EXISTENTES
-- ============================================

-- Verificar se já existem destinatários para este admin
SELECT 
  id,
  admin_id,
  phone,
  active,
  created_at
FROM sistemaretiradas.whatsapp_recipients
WHERE admin_id = '7391610a-f83b-4727-875f-81299b8bfa68';

-- ============================================
-- 3. INSERIR DESTINATÁRIOS (SE NÃO EXISTIREM)
-- ============================================

-- Inserir destinatários WhatsApp para o admin
-- Os números devem estar sem DDI (o sistema adiciona 55 automaticamente)
-- Formato: apenas números (ex: 96981113307 ao invés de 5596981113307)

INSERT INTO sistemaretiradas.whatsapp_recipients (admin_id, phone, active)
VALUES 
  ('7391610a-f83b-4727-875f-81299b8bfa68', '96981113307', true),
  ('7391610a-f83b-4727-875f-81299b8bfa68', '96981032928', true)
ON CONFLICT (admin_id, phone) 
DO UPDATE SET 
  active = true,
  updated_at = NOW();

-- ============================================
-- 4. VERIFICAR SE FORAM INSERIDOS
-- ============================================

-- Verificar destinatários após inserção
SELECT 
  id,
  admin_id,
  phone,
  active,
  created_at,
  updated_at
FROM sistemaretiradas.whatsapp_recipients
WHERE admin_id = '7391610a-f83b-4727-875f-81299b8bfa68'
  AND active = true
ORDER BY created_at;

-- ============================================
-- 5. VERIFICAR POLÍTICAS RLS DA TABELA whatsapp_recipients
-- ============================================

-- Verificar se as políticas RLS permitem leitura
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'whatsapp_recipients'
ORDER BY policyname;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. Os números devem ser inseridos SEM o DDI 55
-- 2. O sistema adiciona automaticamente o DDI 55 ao enviar
-- 3. O formato esperado é apenas números (ex: 96981113307)
-- 4. Se os números já existirem, o ON CONFLICT apenas atualiza active = true
-- 5. Verifique se as políticas RLS permitem que usuários de loja leiam os destinatários

