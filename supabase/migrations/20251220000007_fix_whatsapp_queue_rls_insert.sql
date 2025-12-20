-- =====================================================
-- CORREÇÃO: Política RLS para INSERT em whatsapp_message_queue
-- =====================================================
-- Esta migration adiciona uma política RLS que permite
-- que admins inseram mensagens na fila de WhatsApp
-- 
-- A política verifica se o admin possui a loja (store_id)
-- =====================================================

-- Remover política antiga de INSERT se existir (para recriar)
DROP POLICY IF EXISTS "Admin pode inserir mensagens na fila" 
ON sistemaretiradas.whatsapp_message_queue;

-- Criar política de INSERT para admins
CREATE POLICY "Admin pode inserir mensagens na fila"
ON sistemaretiradas.whatsapp_message_queue
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = whatsapp_message_queue.store_id
        AND s.admin_id = auth.uid()
    )
);

-- Garantir que também existe política de UPDATE para admins
DROP POLICY IF EXISTS "Admin pode atualizar mensagens na fila" 
ON sistemaretiradas.whatsapp_message_queue;

CREATE POLICY "Admin pode atualizar mensagens na fila"
ON sistemaretiradas.whatsapp_message_queue
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = whatsapp_message_queue.store_id
        AND s.admin_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = whatsapp_message_queue.store_id
        AND s.admin_id = auth.uid()
    )
);

-- Garantir que também existe política de DELETE para admins (caso necessário)
DROP POLICY IF EXISTS "Admin pode deletar mensagens da fila" 
ON sistemaretiradas.whatsapp_message_queue;

CREATE POLICY "Admin pode deletar mensagens da fila"
ON sistemaretiradas.whatsapp_message_queue
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = whatsapp_message_queue.store_id
        AND s.admin_id = auth.uid()
    )
);

-- Comentários
COMMENT ON POLICY "Admin pode inserir mensagens na fila" ON sistemaretiradas.whatsapp_message_queue IS 
'Permite que admins insiram mensagens na fila de WhatsApp para suas lojas';

COMMENT ON POLICY "Admin pode atualizar mensagens na fila" ON sistemaretiradas.whatsapp_message_queue IS 
'Permite que admins atualizem mensagens na fila de WhatsApp para suas lojas';

COMMENT ON POLICY "Admin pode deletar mensagens da fila" ON sistemaretiradas.whatsapp_message_queue IS 
'Permite que admins deletem mensagens da fila de WhatsApp para suas lojas';

