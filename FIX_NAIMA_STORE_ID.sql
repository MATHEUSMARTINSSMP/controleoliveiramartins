-- Fix: Adicionar store_id para a colaboradora NAÍMA que foi criada sem store_id
-- O store_default é "Sacada Oh,Boy!" que corresponde à loja "Sacada | Oh, Boy" com ID cee7d359-0240-4131-87a2-21ae44bd1bb4

UPDATE sistemaretiradas.profiles
SET store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'
WHERE id = '91192cc7-4865-43d1-9194-0544438ed6d9'
  AND role = 'COLABORADORA'
  AND store_id IS NULL
  AND store_default LIKE '%Sacada%';

-- Verificar se foi atualizado corretamente
SELECT id, name, email, store_default, store_id, active
FROM sistemaretiradas.profiles
WHERE id = '91192cc7-4865-43d1-9194-0544438ed6d9';

