# VERIFICAÇÃO COMPLETA DO SISTEMA - WhatsApp Accounts/Credentials

## 🔍 PROBLEMAS ENCONTRADOS

### ❌ PROBLEMA 1: Inconsistência entre `admin_id` e `customer_id` em `whatsapp_credentials`

**Localização:**
- `src/pages/admin/WhatsAppBulkSend.tsx` linha 482
- `netlify/functions/send-whatsapp-message.js` linha 252
- `src/components/admin/WhatsAppStoreConfig.tsx` linha 341

**Problema:**
- A tabela `whatsapp_credentials` tem PRIMARY KEY `(customer_id, site_slug)` conforme migration `20251205000009_create_whatsapp_credentials.sql`
- Porém, o código está usando `admin_id` que não existe na tabela original
- A migration `20251220000002` adiciona apenas `is_backup`, não adiciona `admin_id`

**Solução Necessária:**
1. Verificar se existe migration que adiciona `admin_id`
2. Se não existir, criar migration para adicionar `admin_id` OU
3. Alterar código para usar `customer_id` (que é o email do admin)

---

### ❌ PROBLEMA 2: Campo `is_global` não existe na tabela

**Localização:**
- `netlify/functions/send-whatsapp-message.js` linhas 160, 255

**Problema:**
- O código busca credenciais com `.eq('is_global', true)` e `.eq('is_global', false)`
- A migration original não cria coluna `is_global`
- Nenhuma migration posterior adiciona essa coluna

**Solução Necessária:**
1. Criar migration para adicionar `is_global BOOLEAN DEFAULT false`
2. Ou remover uso de `is_global` e usar outra lógica

---

### ❌ PROBLEMA 3: `send-whatsapp-message.js` não usa `whatsapp_account_id`

**Localização:**
- `netlify/functions/process-whatsapp-queue.js` linha 170 passa `whatsapp_account_id`
- `netlify/functions/send-whatsapp-message.js` não recebe nem usa esse parâmetro

**Problema:**
- Para números reserva (BACKUP_1, BACKUP_2, BACKUP_3), precisamos usar credenciais de `whatsapp_accounts`
- A função atual só busca em `whatsapp_credentials` (números principais)

**Solução Necessária:**
1. Modificar `send-whatsapp-message.js` para aceitar `whatsapp_account_id`
2. Se `whatsapp_account_id` fornecido, buscar em `whatsapp_accounts` ao invés de `whatsapp_credentials`
3. Usar `uazapi_token` e `uazapi_instance_id` de `whatsapp_accounts` para números reserva

---

### ❌ PROBLEMA 4: `WhatsAppBulkSend.tsx` busca PRIMARY com ID fictício

**Localização:**
- `src/pages/admin/WhatsAppBulkSend.tsx` linha 492 cria ID fictício: `primary-${selectedStoreId}`

**Problema:**
- Ao criar mensagens na fila, usa `whatsapp_account_id = primary-${selectedStoreId}`
- Isso não é um UUID válido de `whatsapp_accounts`
- A função `send-whatsapp-message.js` não vai conseguir resolver isso

**Solução Necessária:**
1. Para números principais, NÃO usar `whatsapp_account_id` na fila
2. Usar `NULL` ou campo especial `is_primary: true`
3. Modificar `send-whatsapp-message.js` para tratar números principais diferente de reserva

---

### ⚠️ PROBLEMA 5: `whatsapp_credentials` não tem coluna `admin_id`

**Verificação necessária:**
- A migration `20251205000009_create_whatsapp_credentials.sql` usa `customer_id` como chave primária
- Mas o código em `WhatsAppStoreConfig.tsx` e outros lugares usa `admin_id`
- Precisamos verificar se existe uma migration que adiciona `admin_id` OU alterar código para usar `customer_id`

---

## ✅ PONTOS CORRETOS

1. ✅ `WhatsAppBulkSend.tsx` busca números principais de `whatsapp_credentials` corretamente
2. ✅ `WhatsAppBulkSend.tsx` busca números reserva de `whatsapp_accounts` com `BACKUP_1/2/3`
3. ✅ Migration remove `PRIMARY` do CHECK constraint de `whatsapp_accounts`
4. ✅ Migration adiciona campos `uazapi_qr_code` e `uazapi_status` em `whatsapp_accounts`

---

## 📋 CHECKLIST DE CORREÇÕES NECESSÁRIAS

- [ ] Verificar se existe migration que adiciona `admin_id` em `whatsapp_credentials`
- [ ] Se não existir, decidir: adicionar `admin_id` OU mudar código para usar `customer_id`
- [ ] Verificar se existe migration que adiciona `is_global` em `whatsapp_credentials`
- [ ] Se não existir, criar migration para `is_global` OU remover uso
- [ ] Modificar `send-whatsapp-message.js` para suportar `whatsapp_account_id` (números reserva)
- [ ] Modificar `WhatsAppBulkSend.tsx` para não usar ID fictício para números principais
- [ ] Atualizar `process-whatsapp-queue.js` para passar `whatsapp_account_id` corretamente
- [ ] Testar fluxo completo: número principal → whatsapp_credentials, número reserva → whatsapp_accounts

---

## 🔗 DEPENDÊNCIAS

1. **Números Principais** (`whatsapp_credentials`):
   - Gerenciados em: WhatsApp Config normal
   - Buscados por: `admin_id` + `site_slug` OU `customer_id` + `site_slug`
   - Usados quando: `whatsapp_account_id` é NULL ou não fornecido

2. **Números Reserva** (`whatsapp_accounts`):
   - Gerenciados em: Envio em Massa (WhatsAppBulkSend)
   - Buscados por: `store_id` + `account_type` (BACKUP_1/2/3)
   - Usados quando: `whatsapp_account_id` é fornecido na fila

