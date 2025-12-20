# 📋 GUIA DE TESTES - NÚMEROS RESERVA WHATSAPP

**Data:** 2025-12-20  
**Objetivo:** Guia completo para testar todas as funcionalidades de números reserva

---

## ✅ PRÉ-REQUISITOS

1. ✅ Migrations SQL executadas no Supabase
2. ✅ Número principal já configurado e funcionando
3. ✅ Acesso à página de Envio em Massa (`/admin/whatsapp-bulk-send`)
4. ✅ Pelo menos uma loja configurada com `site_slug`

---

## 🧪 TESTE 1: Fluxo Completo de Número Reserva

### Passo 1: Preparar número reserva no banco

**SQL para criar número reserva:**
```sql
-- Substitua os valores conforme necessário
INSERT INTO sistemaretiradas.whatsapp_accounts (
    id,
    store_id,
    phone,
    is_backup1,  -- ou is_backup2, is_backup3
    is_connected,
    uazapi_status,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),  -- ou use um UUID específico
    'SEU_STORE_ID_AQUI',
    '5599123456789',    -- número do WhatsApp
    true,               -- true para is_backup1
    false,              -- false inicialmente (não conectado)
    'disconnected',     -- status inicial
    NOW(),
    NOW()
);
```

### Passo 2: Verificar número na UI

1. Acesse `/admin/whatsapp-bulk-send`
2. Selecione uma loja no Passo 1
3. Vá para o Passo 4 (Configurações de Envio)
4. Verifique se o número reserva aparece na seção "Números Reserva"
5. ✅ **Esperado:** Número deve aparecer com badge "Desconectado"

### Passo 3: Gerar QR Code

1. Clique em "Gerar QR Code" para o número reserva
2. ✅ **Esperado:**
   - Toast de "Gerando QR Code..."
   - QR Code deve aparecer na tela
   - Badge deve mudar para "QR Code necessário"
   - Polling deve iniciar automaticamente

### Passo 4: Escanear QR Code

1. Abra WhatsApp no celular
2. Vá em Configurações → Dispositivos Conectados
3. Escaneie o QR Code exibido na tela
4. ✅ **Esperado:**
   - Status deve mudar para "Conectando..." (badge animado)
   - Após alguns segundos, status deve mudar para "Conectado" (badge verde)
   - Toast de sucesso: "Número X está conectado!"
   - Polling deve parar automaticamente

### Passo 5: Verificar Status Manualmente

1. Clique em "Verificar Status"
2. ✅ **Esperado:**
   - Status deve ser atualizado
   - Se conectado, badge verde deve aparecer
   - Toast informativo deve aparecer

### Passo 6: Verificar no Banco de Dados

**SQL:**
```sql
SELECT 
    id,
    phone,
    is_backup1,
    is_backup2,
    is_backup3,
    is_connected,
    uazapi_status,
    uazapi_phone_number,
    updated_at
FROM sistemaretiradas.whatsapp_accounts
WHERE store_id = 'SEU_STORE_ID_AQUI'
ORDER BY created_at DESC;
```

✅ **Esperado:**
- `is_connected` = `true`
- `uazapi_status` = `'connected'`
- `uazapi_phone_number` deve estar preenchido
- `updated_at` deve ser recente

---

## 🧪 TESTE 2: Envio de Campanha Usando Número Reserva

### Passo 1: Preparar campanha

1. Acesse `/admin/whatsapp-bulk-send`
2. Selecione uma loja
3. Selecione alguns contatos (Passo 2)
4. Crie mensagem de teste (Passo 3)
5. Vá para Configurações (Passo 4)

### Passo 2: Selecionar número reserva

1. Na seção "Números WhatsApp":
   - Selecione número principal (obrigatório)
   - **IMPORTANTE:** Selecione um número reserva conectado em "Selecionar Números Reserva para Campanha"
2. ✅ **Esperado:**
   - Apenas números conectados devem aparecer no dropdown
   - Números desconectados não devem aparecer

### Passo 3: Configurar rotação (opcional)

1. Marque checkbox "Alternar entre números"
2. ✅ **Esperado:** Opção de alternar deve estar disponível

### Passo 4: Criar campanha

1. Revise tudo no Passo 5
2. Clique em "Confirmar e Enviar"
3. ✅ **Esperado:**
   - Toast de sucesso: "Campanha criada! X mensagens agendadas"
   - Redirecionamento para `/admin`

### Passo 5: Verificar fila de mensagens

**SQL:**
```sql
SELECT 
    id,
    phone,
    message,
    whatsapp_account_id,
    status,
    priority,
    message_type,
    campaign_id,
    created_at
FROM sistemaretiradas.whatsapp_message_queue
WHERE campaign_id = (
    SELECT id FROM sistemaretiradas.whatsapp_campaigns 
    ORDER BY created_at DESC LIMIT 1
)
ORDER BY created_at
LIMIT 10;
```

✅ **Esperado:**
- Mensagens devem ter `whatsapp_account_id` preenchido (UUID do número reserva)
- `status` deve ser `'PENDING'` ou `'SCHEDULED'`
- `priority` deve ser `8` (campanhas)
- `message_type` deve ser `'CAMPAIGN'`

### Passo 6: Processar fila (manual ou cron)

**Opção 1: Via Netlify Function (manual)**
```bash
curl -X POST https://eleveaone.com.br/.netlify/functions/process-whatsapp-queue
```

**Opção 2: Verificar logs do cron job** (se configurado)

✅ **Esperado:**
- Mensagens devem ser enviadas usando o número reserva correto
- Status deve mudar para `'SENT'`
- Mensagem deve chegar no destinatário do número reserva (não do principal)

---

## 🧪 TESTE 3: Rotação de Números (Principal + Reservas)

### Passo 1: Configurar múltiplos números

1. Garanta que número principal está conectado
2. Garanta que pelo menos 2 números reserva estão conectados
3. Na página de Envio em Massa, configure:
   - Número principal selecionado
   - 2 números reserva selecionados
   - Checkbox "Alternar entre números" marcado

### Passo 2: Criar campanha com múltiplos contatos

1. Selecione pelo menos 6 contatos (para testar rotação)
2. Crie mensagem de teste
3. Envie campanha

### Passo 3: Verificar rotação na fila

**SQL:**
```sql
WITH numbered_messages AS (
    SELECT 
        phone,
        whatsapp_account_id,
        ROW_NUMBER() OVER (ORDER BY created_at) as msg_number
    FROM sistemaretiradas.whatsapp_message_queue
    WHERE campaign_id = (
        SELECT id FROM sistemaretiradas.whatsapp_campaigns 
        ORDER BY created_at DESC LIMIT 1
    )
    ORDER BY created_at
    LIMIT 10
)
SELECT 
    msg_number,
    phone,
    CASE 
        WHEN whatsapp_account_id IS NULL THEN 'PRINCIPAL (NULL)'
        ELSE 'RESERVA: ' || whatsapp_account_id::text
    END as numero_usado
FROM numbered_messages;
```

✅ **Esperado:**
- Mensagem 1: `whatsapp_account_id = NULL` (número principal)
- Mensagem 2: `whatsapp_account_id = UUID1` (primeira reserva)
- Mensagem 3: `whatsapp_account_id = UUID2` (segunda reserva)
- Mensagem 4: `whatsapp_account_id = NULL` (número principal novamente)
- E assim por diante...

### Passo 4: Processar e verificar envios

1. Processe a fila
2. Verifique mensagens recebidas nos telefones de teste
3. ✅ **Esperado:**
   - Mensagens devem vir de números diferentes
   - Rotação deve funcionar corretamente

---

## 🧪 TESTE 4: Validar que Números Principais Continuam Funcionando

### Passo 1: Testar envio com apenas número principal

1. Acesse qualquer funcionalidade que envia WhatsApp (ex: cashback, notificação)
2. ✅ **Esperado:** Mensagem deve ser enviada normalmente usando número principal

### Passo 2: Testar configuração de número principal

1. Acesse `/admin` → Tab "Configurações" → Seção WhatsApp
2. Teste gerar QR code para número principal
3. Teste verificar status de número principal
4. ✅ **Esperado:** Tudo deve funcionar como antes (sem regressão)

### Passo 3: Verificar que não há interferência

1. Crie campanha usando apenas número principal (sem reservas)
2. ✅ **Esperado:**
   - Campanha deve funcionar normalmente
   - Mensagens devem ter `whatsapp_account_id = NULL`
   - Envio deve usar número principal

---

## 🔍 CHECKLIST DE VALIDAÇÃO

### Funcionalidades de Autenticação

- [ ] Número reserva aparece na lista
- [ ] Botão "Gerar QR Code" funciona
- [ ] QR Code é exibido corretamente
- [ ] Status atualiza durante polling
- [ ] Status muda para "Conectado" após escanear
- [ ] Botão "Verificar Status" funciona
- [ ] Status é salvo no banco de dados

### Funcionalidades de Envio

- [ ] Número reserva conectado aparece na seleção
- [ ] Número reserva desconectado NÃO aparece na seleção
- [ ] Campanha é criada com `whatsapp_account_id` correto
- [ ] Mensagens são inseridas na fila corretamente
- [ ] Fila processa mensagens
- [ ] Mensagens são enviadas do número reserva correto
- [ ] Rotação funciona entre principal e reservas

### Validação de Regressão

- [ ] Números principais continuam funcionando
- [ ] Configuração de números principais funciona
- [ ] Envio usando apenas principal funciona
- [ ] Nenhuma funcionalidade existente quebrou

---

## 🐛 PROBLEMAS COMUNS E SOLUÇÕES

### Problema 1: Número reserva não aparece na lista

**Causa possível:**
- Número não foi criado no banco
- `store_id` não corresponde à loja selecionada
- `is_backup1/2/3` não está como `true`

**Solução:**
```sql
-- Verificar se número existe
SELECT * FROM sistemaretiradas.whatsapp_accounts WHERE store_id = 'SEU_STORE_ID';

-- Corrigir se necessário
UPDATE sistemaretiradas.whatsapp_accounts 
SET is_backup1 = true 
WHERE id = 'ID_DO_NUMERO';
```

### Problema 2: QR Code não é gerado

**Causa possível:**
- N8N workflow não está configurado
- `site_slug` da loja não está preenchido
- Erro na função `whatsapp-connect.js`

**Solução:**
- Verificar logs do Netlify Function `whatsapp-connect`
- Verificar se `site_slug` está preenchido na tabela `stores`
- Verificar se N8N workflow está funcionando

### Problema 3: Status não atualiza após escanear

**Causa possível:**
- Polling parou antes de conectar
- N8N não está retornando status correto
- Erro na função `whatsapp-status.js`

**Solução:**
- Clicar em "Verificar Status" manualmente
- Verificar logs do Netlify Function `whatsapp-status`
- Verificar se N8N está retornando status `connected`

### Problema 4: Mensagem não chega do número reserva

**Causa possível:**
- `whatsapp_account_id` não está sendo passado corretamente
- `fetchBackupAccountCredential` não está funcionando
- Número reserva não está realmente conectado

**Solução:**
- Verificar logs de `send-whatsapp-message.js`
- Verificar se `whatsapp_account_id` está na fila
- Verificar se número está realmente conectado (status = 'connected')

---

## 📊 QUERIES SQL ÚTEIS PARA DEBUG

### Ver todos os números reserva de uma loja
```sql
SELECT 
    id,
    phone,
    is_backup1,
    is_backup2,
    is_backup3,
    is_connected,
    uazapi_status,
    uazapi_phone_number,
    created_at,
    updated_at
FROM sistemaretiradas.whatsapp_accounts
WHERE store_id = 'SEU_STORE_ID'
ORDER BY created_at DESC;
```

### Ver mensagens na fila de uma campanha
```sql
SELECT 
    q.id,
    q.phone,
    q.message,
    q.whatsapp_account_id,
    q.status,
    q.priority,
    q.created_at,
    a.phone as account_phone
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.whatsapp_accounts a ON a.id = q.whatsapp_account_id
WHERE q.campaign_id = (
    SELECT id FROM sistemaretiradas.whatsapp_campaigns 
    ORDER BY created_at DESC LIMIT 1
)
ORDER BY q.created_at
LIMIT 20;
```

### Verificar status de conexão de todos os números
```sql
SELECT 
    'PRINCIPAL' as tipo,
    wc.site_slug,
    wc.uazapi_phone_number as phone,
    wc.uazapi_status,
    wc.is_global
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.status = 'active'
UNION ALL
SELECT 
    CASE 
        WHEN wa.is_backup1 THEN 'RESERVA_1'
        WHEN wa.is_backup2 THEN 'RESERVA_2'
        WHEN wa.is_backup3 THEN 'RESERVA_3'
        ELSE 'RESERVA'
    END as tipo,
    s.site_slug,
    wa.phone,
    wa.uazapi_status,
    false as is_global
FROM sistemaretiradas.whatsapp_accounts wa
JOIN sistemaretiradas.stores s ON s.id = wa.store_id
ORDER BY tipo, site_slug;
```

---

## ✅ CRITÉRIOS DE SUCESSO

O sistema está funcionando corretamente quando:

1. ✅ Números reserva podem ser autenticados (QR code + escaneamento)
2. ✅ Status é atualizado em tempo real durante autenticação
3. ✅ Números reserva conectados aparecem para seleção em campanhas
4. ✅ Campanhas são criadas com `whatsapp_account_id` correto
5. ✅ Mensagens são enviadas do número reserva correto
6. ✅ Rotação funciona entre principal e reservas
7. ✅ Números principais continuam funcionando normalmente
8. ✅ Nenhuma regressão foi introduzida

---

**Fim do Guia de Testes**

