# 📋 Plano de Etapas - Integração ERP

## ✅ Regra de Ouro
**Fazer uma etapa por vez, testar, confirmar, depois partir para a próxima!**

---

## 🎯 Etapas (Uma de Cada Vez)

### ✅ **ETAPA 1: SQL - Estrutura do Banco** (COMPLETA)
- [x] Migration: adicionar `sistema_erp` em `stores`
- [x] Migration: criar tabela `erp_integrations`
- [x] Migration: criar tabelas Tiny (`tiny_products`, `tiny_orders`, `tiny_contacts`)
- [x] Migration: criar `erp_sync_logs`
- [x] RLS configurado
- [x] Índices criados

**Status:** ✅ **COMPLETA** - SQL corrigido e pronto

---

### ⏳ **ETAPA 2: Formulário de Loja com Select de Sistema**
**Objetivo:** Adicionar campo `sistema_erp` no cadastro/edição de loja

**O que fazer:**
- [ ] Criar nova página isolada `/dev/store-config` (ou encontrar onde lojas são criadas)
- [ ] Adicionar `<Select>` com sistemas disponíveis (Tiny, Bling, etc)
- [ ] Salvar `sistema_erp` no banco ao criar/editar loja
- [ ] Não mexer em páginas existentes

**Arquivos a criar:**
- `src/pages/dev/StoreERPConfig.tsx` (nova página isolada)

**Teste:**
- Criar/editar loja e selecionar sistema ERP
- Verificar se `sistema_erp` foi salvo no banco

---

### ⏳ **ETAPA 3: Painel Dev - Configurar Credenciais**
**Objetivo:** Painel para dev configurar Client ID/Secret por loja

**O que fazer:**
- [ ] Criar página `/dev/erp-config`
- [ ] Listar lojas com sistema ERP selecionado
- [ ] Formulário para inserir Client ID e Client Secret
- [ ] Salvar em `erp_integrations`
- [ ] Não mexer em páginas existentes

**Arquivos a criar:**
- `src/pages/dev/ERPConfig.tsx` (nova página isolada)

**Teste:**
- Acessar painel dev
- Configurar credenciais de uma loja
- Verificar se foi salvo no banco

---

### ⏳ **ETAPA 4: OAuth Flow - Conectar com Tiny**
**Objetivo:** Implementar fluxo OAuth para autorizar acesso

**O que fazer:**
- [ ] Atualizar `getERPAuthorizationUrl()` para usar credenciais do banco
- [ ] Atualizar callback OAuth para salvar tokens
- [ ] Testar fluxo completo: clicar "Conectar" → autorizar → callback → salvar token

**Arquivos a atualizar:**
- `src/lib/erpIntegrations.ts` (já existe, apenas atualizar)
- `netlify/functions/erp-oauth-callback.js` (já existe, apenas atualizar)

**Teste:**
- Clicar "Conectar" no painel dev
- Ser redirecionado para Tiny
- Autorizar e voltar
- Verificar se token foi salvo

---

### ⏳ **ETAPA 5: Sincronização - Buscar Produtos do Tiny**
**Objetivo:** Criar função para sincronizar produtos do Tiny

**O que fazer:**
- [ ] Criar `src/lib/erp/syncTiny.ts`
- [ ] Função para buscar produtos da API Tiny
- [ ] Mapear dados do Tiny para `tiny_products`
- [ ] Salvar no banco
- [ ] Criar log em `erp_sync_logs`

**Arquivos a criar:**
- `src/lib/erp/syncTiny.ts` (novo arquivo isolado)
- `src/lib/erp/types/tiny.ts` (tipos TypeScript)

**Teste:**
- Executar sincronização manualmente
- Verificar se produtos foram salvos em `tiny_products`
- Verificar log em `erp_sync_logs`

---

### ⏳ **ETAPA 6: Sincronização - Buscar Pedidos do Tiny**
**Objetivo:** Sincronizar pedidos/vendas do Tiny

**O que fazer:**
- [ ] Adicionar função em `syncTiny.ts` para buscar pedidos
- [ ] Mapear dados do Tiny para `tiny_orders`
- [ ] Salvar no banco
- [ ] Atualizar log

**Arquivos a atualizar:**
- `src/lib/erp/syncTiny.ts` (adicionar função)

**Teste:**
- Executar sincronização de pedidos
- Verificar se pedidos foram salvos

---

### ⏳ **ETAPA 7: Componente - Exibir Produtos Sincronizados**
**Objetivo:** Criar componente React para exibir produtos do ERP

**O que fazer:**
- [ ] Criar `src/components/erp/TinyProductsList.tsx`
- [ ] Buscar produtos de `tiny_products` por loja
- [ ] Exibir em tabela/cards
- [ ] Não mexer em componentes existentes

**Arquivos a criar:**
- `src/components/erp/TinyProductsList.tsx` (novo componente isolado)

**Teste:**
- Acessar página de produtos
- Ver produtos sincronizados do Tiny

---

### ⏳ **ETAPA 8: Componente - Exibir Pedidos Sincronizados**
**Objetivo:** Criar componente para exibir pedidos do ERP

**O que fazer:**
- [ ] Criar `src/components/erp/TinyOrdersList.tsx`
- [ ] Buscar pedidos de `tiny_orders` por loja
- [ ] Exibir em tabela

**Arquivos a criar:**
- `src/components/erp/TinyOrdersList.tsx` (novo componente isolado)

---

### ⏳ **ETAPA 9: Página - Dashboard ERP por Loja**
**Objetivo:** Criar página para visualizar todos os dados ERP de uma loja

**O que fazer:**
- [ ] Criar `src/pages/erp/ERPData.tsx`
- [ ] Integrar componentes de produtos e pedidos
- [ ] Mostrar status de sincronização
- [ ] Botão para sincronizar manualmente

**Arquivos a criar:**
- `src/pages/erp/ERPData.tsx` (nova página isolada)

---

### ⏳ **ETAPA 10: Sincronização Automática (Opcional)**
**Objetivo:** Criar job/cron para sincronizar automaticamente

**O que fazer:**
- [ ] Criar Netlify Function ou Edge Function
- [ ] Agendar sincronização periódica
- [ ] Enviar notificações em caso de erro

---

## 📝 Notas

- **Cada etapa é independente** - pode ser testada isoladamente
- **Não alterar código existente** - apenas criar novos arquivos
- **Confirmar antes de prosseguir** - aguardar OK do usuário
- **Testar cada etapa** - garantir que funciona antes de continuar

---

## 🚀 Próxima Etapa

**ETAPA 2: Formulário de Loja com Select de Sistema**

Aguardando confirmação para começar! ✅

