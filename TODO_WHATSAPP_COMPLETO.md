# 📋 TODO COMPLETO - SISTEMA WHATSAPP

**Data de Criação:** 2025-12-20  
**Status:** Migrations SQL já executadas ✅  
**Próximo Passo:** Implementar correções e funcionalidades faltantes

---

## 🎯 PRIORIDADE CRÍTICA (Bloqueadores)

### 1. ❌ Corrigir `fetchBackupAccountCredential` em `send-whatsapp-message.js`

**Problema:**
- Função tenta buscar `admin_id` via `stores.admin_id`, mas essa coluna não existe
- Isso pode causar falha ao enviar mensagens usando números reserva

**Localização:** `netlify/functions/send-whatsapp-message.js` (linha ~186-220)

**Ação Necessária:**
- Remover dependência de `stores.admin_id`
- Buscar `admin_id` corretamente:
  - Opção 1: Buscar via relação `stores` → `profiles` (se existir)
  - Opção 2: Buscar `admin_id` diretamente de `whatsapp_accounts` se tiver essa relação
  - Opção 3: Usar `customer_id` (email) e buscar em `profiles` por email
- Testar que a busca funciona corretamente

**Arquivo a editar:**
- `netlify/functions/send-whatsapp-message.js`

---

### 2. ❌ Adaptar `whatsapp-connect.js` para suportar números reserva

**Problema:**
- Função atual só trabalha com `whatsapp_credentials` (números principais)
- Não há suporte para gerar QR code para números reserva (`whatsapp_accounts`)

**Localização:** `netlify/functions/whatsapp-connect.js`

**Ação Necessária:**
1. Adicionar parâmetro opcional `whatsapp_account_id` na query string
2. Se `whatsapp_account_id` fornecido:
   - Buscar registro em `whatsapp_accounts` por ID
   - Obter `store_id` e buscar `site_slug` da loja
   - Obter `customer_id` (email) do admin via `profiles`
   - Chamar N8N workflow normalmente
   - Atualizar `whatsapp_accounts.uazapi_qr_code` e `uazapi_status` ao invés de `whatsapp_credentials`
3. Se não fornecido, manter comportamento atual (números principais)

**Arquivo a editar:**
- `netlify/functions/whatsapp-connect.js`

---

### 3. ❌ Adaptar `whatsapp-status.js` para suportar números reserva

**Problema:**
- Função atual só trabalha com `whatsapp_credentials` (números principais)
- Não há suporte para verificar status de números reserva (`whatsapp_accounts`)

**Localização:** `netlify/functions/whatsapp-status.js`

**Ação Necessária:**
1. Adicionar parâmetro opcional `whatsapp_account_id` na query string
2. Se `whatsapp_account_id` fornecido:
   - Buscar registro em `whatsapp_accounts` por ID
   - Obter `store_id` e buscar `site_slug` da loja
   - Obter `customer_id` (email) do admin via `profiles`
   - Chamar N8N workflow normalmente
   - Retornar status de `whatsapp_accounts` ao invés de `whatsapp_credentials`
3. Se não fornecido, manter comportamento atual (números principais)

**Arquivo a editar:**
- `netlify/functions/whatsapp-status.js`

---

## 🎯 PRIORIDADE ALTA (Funcionalidades Principais)

### 4. ✅ Implementar `handleGenerateBackupQRCode` em `WhatsAppBulkSend.tsx`

**Localização:** `src/pages/admin/WhatsAppBulkSend.tsx`

**Ação Necessária:**
1. Criar função `handleGenerateBackupQRCode` similar a `handleGenerateQRCode` em `WhatsAppStoreConfig.tsx`
2. Função deve:
   - Receber `accountId` (UUID do número reserva)
   - Chamar `connectWhatsApp` (ou criar função específica) passando `whatsapp_account_id`
   - Atualizar estado local com QR code recebido
   - Iniciar polling de status
   - Exibir toast com sucesso/erro
3. Conectar botão "Gerar QR Code" na UI para números reserva

**Arquivos a editar:**
- `src/pages/admin/WhatsAppBulkSend.tsx`
- `src/lib/whatsapp.ts` (se precisar adaptar `connectWhatsApp`)

---

### 5. ✅ Implementar `handleCheckBackupStatus` em `WhatsAppBulkSend.tsx`

**Localização:** `src/pages/admin/WhatsAppBulkSend.tsx`

**Ação Necessária:**
1. Criar função `handleCheckBackupStatus` similar a `handleCheckStatus` em `WhatsAppStoreConfig.tsx`
2. Função deve:
   - Receber `accountId` (UUID do número reserva)
   - Chamar `fetchWhatsAppStatus` (ou criar função específica) passando `whatsapp_account_id`
   - Atualizar estado local com status recebido
   - Salvar status no Supabase (`whatsapp_accounts.uazapi_status`)
   - Exibir toast com resultado
3. Conectar botão "Verificar Status" na UI para números reserva

**Arquivos a editar:**
- `src/pages/admin/WhatsAppBulkSend.tsx`
- `src/lib/whatsapp.ts` (se precisar adaptar `fetchWhatsAppStatus`)

---

### 6. ✅ Implementar polling de status para números reserva

**Localização:** `src/pages/admin/WhatsAppBulkSend.tsx`

**Ação Necessária:**
1. Criar função `startPollingForBackupAccount` similar a `startPollingForStore` em `WhatsAppStoreConfig.tsx`
2. Função deve:
   - Receber `accountId` e iniciar intervalo de polling
   - Chamar `fetchWhatsAppStatus` periodicamente
   - Atualizar estado local e Supabase com status
   - Parar polling quando status for terminal (`connected`, `error`, `disconnected`)
3. Integrar com `handleGenerateBackupQRCode` para iniciar polling automaticamente
4. Gerenciar intervalos (limpar quando componente desmontar)

**Arquivos a editar:**
- `src/pages/admin/WhatsAppBulkSend.tsx`

---

### 7. ✅ Conectar UI de QR code e status em `WhatsAppBulkSend.tsx`

**Localização:** `src/pages/admin/WhatsAppBulkSend.tsx` (seção de Configurações de Envio)

**Ação Necessária:**
1. Exibir QR code quando disponível:
   - Mostrar imagem do QR code (base64) em modal ou área dedicada
   - Botão "Fechar" para esconder QR code
2. Exibir status badge:
   - Badge colorido conforme status (`connected`, `qr_required`, `disconnected`, `error`)
   - Atualizar em tempo real durante polling
3. Botões de ação:
   - "Gerar QR Code" (quando desconectado ou erro)
   - "Verificar Status" (sempre disponível)
   - Desabilitar botões durante operações (loading state)
4. Integrar com estados:
   - `backupAccountStatus` (já existe no código)
   - Estados de loading por account ID

**Arquivos a editar:**
- `src/pages/admin/WhatsAppBulkSend.tsx`

---

## 🎯 PRIORIDADE MÉDIA (Testes e Validação)

### 8. ✅ Testar fluxo completo de número reserva

**Ações:**
1. Criar número reserva manualmente no Supabase (ou via UI se existir)
2. Acessar página de Envio em Massa
3. Selecionar loja
4. Ir para seção de números reserva
5. Clicar em "Gerar QR Code"
6. Verificar se QR code aparece
7. Escanear QR code com WhatsApp
8. Verificar se status muda para "connected"
9. Verificar se número aparece como disponível na lista
10. Verificar se número pode ser selecionado para envio

**Checklist:**
- [ ] QR code é gerado corretamente
- [ ] QR code aparece na UI
- [ ] Status atualiza durante polling
- [ ] Status muda para "connected" após escanear
- [ ] Número fica disponível para seleção

---

### 9. ✅ Testar envio de campanha usando números reserva

**Ações:**
1. Criar campanha de teste com número reserva selecionado
2. Selecionar alguns contatos
3. Criar mensagem de teste
4. Configurar para usar número reserva (ou rotação)
5. Enviar campanha
6. Verificar se mensagens são inseridas na fila com `whatsapp_account_id` correto
7. Processar fila (manual ou cron)
8. Verificar se mensagem chega do número reserva correto

**Checklist:**
- [ ] Campanha é criada corretamente
- [ ] Mensagens são inseridas na fila com `whatsapp_account_id` correto
- [ ] Fila processa mensagens
- [ ] `send-whatsapp-message` recebe `whatsapp_account_id`
- [ ] `fetchBackupAccountCredential` funciona corretamente
- [ ] Mensagem é enviada do número reserva correto
- [ ] Mensagem chega no destinatário

---

### 10. ✅ Testar rotação de números (principal + reservas)

**Ações:**
1. Configurar campanha com número principal + 2 reservas
2. Selecionar modo de rotação (alternar)
3. Selecionar múltiplos contatos
4. Criar campanha
5. Verificar se mensagens na fila alternam entre números:
   - Primeira mensagem: número principal (`whatsapp_account_id = NULL`)
   - Segunda mensagem: reserva 1 (`whatsapp_account_id = UUID1`)
   - Terceira mensagem: reserva 2 (`whatsapp_account_id = UUID2`)
   - Quarta mensagem: número principal novamente
   - E assim por diante
6. Processar fila e verificar envios

**Checklist:**
- [ ] Rotação funciona corretamente
- [ ] `whatsapp_account_id` alterna entre NULL e UUIDs
- [ ] Mensagens chegam dos números corretos
- [ ] Distribuição é equilibrada

---

### 11. ✅ Validar que números principais continuam funcionando

**Ações:**
1. Testar envio usando apenas número principal (sem reservas)
2. Verificar que não quebrou funcionalidade existente
3. Testar geração de QR code para número principal
4. Testar verificação de status para número principal
5. Testar campanha usando apenas número principal

**Checklist:**
- [ ] Números principais funcionam normalmente
- [ ] QR code funciona para principais
- [ ] Status funciona para principais
- [ ] Envio funciona para principais
- [ ] Nenhuma regressão introduzida

---

## 🎯 PRIORIDADE BAIXA (Documentação e Melhorias)

### 12. ✅ Atualizar documentação do sistema

**Ações:**
1. Documentar diferenças entre números principais e reserva:
   - Onde são gerenciados
   - Como autenticar cada um
   - Quando usar cada um
2. Documentar fluxos de autenticação:
   - Fluxo para números principais
   - Fluxo para números reserva
3. Criar guia de uso para admin:
   - Como configurar número principal
   - Como configurar números reserva
   - Como usar na campanha
4. Atualizar README.md com informações sobre números reserva

**Arquivos a editar/criar:**
- `README.md`
- `docs/WHATSAPP_NUMEROS.md` (novo arquivo)

---

## 📊 RESUMO DE PROGRESSO

### Total de Itens: 12

- **Pendentes:** 12
- **Em Progresso:** 0
- **Concluídos:** 0

### Por Prioridade:
- **Críticos:** 3 itens
- **Altos:** 4 itens
- **Médios:** 4 itens
- **Baixos:** 1 item

---

## 🚀 ORDEM RECOMENDADA DE EXECUÇÃO

1. **Corrigir `fetchBackupAccountCredential`** (Crítico - bloqueia envio)
2. **Adaptar `whatsapp-connect.js`** (Crítico - necessário para QR code)
3. **Adaptar `whatsapp-status.js`** (Crítico - necessário para status)
4. **Implementar `handleGenerateBackupQRCode`** (Alto - funcionalidade principal)
5. **Implementar `handleCheckBackupStatus`** (Alto - funcionalidade principal)
6. **Implementar polling** (Alto - UX importante)
7. **Conectar UI** (Alto - interface completa)
8. **Testar fluxo completo** (Médio - validação)
9. **Testar campanha** (Médio - validação)
10. **Testar rotação** (Médio - validação)
11. **Validar principais** (Médio - garantir sem regressão)
12. **Documentar** (Baixo - pode ser feito depois)

---

## 📝 NOTAS IMPORTANTES

1. **Migrations já executadas** ✅
   - Todas as migrations SQL foram executadas no Supabase
   - Estrutura de banco está pronta

2. **Compatibilidade:**
   - Manter compatibilidade com números principais (não quebrar funcionalidade existente)
   - Números reserva são opcionais (sistema deve funcionar sem eles)

3. **Testes:**
   - Testar cada funcionalidade isoladamente antes de integrar
   - Validar que não há regressão em funcionalidades existentes

4. **Código existente:**
   - Usar `WhatsAppStoreConfig.tsx` como referência para implementar funcionalidades similares
   - Reutilizar funções de `src/lib/whatsapp.ts` quando possível

---

**Fim da Lista TODO**

