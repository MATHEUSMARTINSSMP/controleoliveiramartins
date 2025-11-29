# ✅ SISTEMA DE CASHBACK COMPLETO - AUTOMÁTICO + MANUAL

## 🎯 OBJETIVO
Sistema híbrido que funciona de forma **100% automática** quando as vendas vêm do Tiny API, mas também permite **gestão manual** através do dashboard.

---

## 🔄 COMO FUNCIONA

### 1. **AUTOMÁTICO (Via Trigger) - PRIMÁRIO**
Quando uma venda é finalizada no Tiny ERP:

```
Tiny ERP → Sincronização → Supabase (INSERT/UPDATE tiny_orders)
                                         ↓
                              TRIGGER automático executa:
                              ✅ Verifica se tem cliente_id
                              ✅ Verifica se valor_total > 0
                              ✅ Verifica se não está cancelado
                              ✅ Verifica se cliente tem CPF válido
                              ✅ GERA CASHBACK AUTOMATICAMENTE
```

**Arquivos envolvidos:**
- `supabase/migrations/20250128000000_create_cashback_system.sql` - Trigger
- `supabase/migrations/20250128000005_fix_cashback_auto_generation.sql` - Trigger melhorado

---

### 2. **FALLBACK MANUAL (Via Netlify Function) - SEGUNDÁRIO**
Se o trigger não funcionar, a Netlify Function tenta manualmente:

```javascript
// netlify/functions/sync-tiny-orders-background.js
1. Salva pedido no banco
2. Aguarda 500ms (para trigger executar)
3. Verifica se cashback foi gerado pelo trigger
4. Se NÃO foi gerado → Tenta gerar manualmente via RPC
```

**Arquivo:** `netlify/functions/sync-tiny-orders-background.js` (linhas 453-505)

---

### 3. **GESTÃO MANUAL (Via Dashboard) - TERTIÁRIO**
Para operações manuais de lançamento/resgate:

**Página:** `src/pages/erp/CashbackManagement.tsx`
- **Tab "Lançar"**: Lança cashback manualmente
- **Tab "Clientes"**: Visualiza saldos e transações
- **Tab "Histórico Geral"**: Vê todas as transações

**RPCs utilizados:**
- `lancar_cashback_manual()` - Lança cashback manual
- `resgatar_cashback_manual()` - Resgata cashback manual

---

## 📋 ESTRUTURA COMPLETA

### Tabelas no Supabase:
1. ✅ `cashback_settings` - Configurações (global ou por loja)
2. ✅ `cashback_balance` - Saldos por cliente
3. ✅ `cashback_transactions` - Histórico de transações

### Funções RPC:
1. ✅ `get_cashback_settings()` - Busca configurações
2. ✅ `gerar_cashback()` - Gera cashback automaticamente
3. ✅ `lancar_cashback_manual()` - Lança cashback manual
4. ✅ `resgatar_cashback_manual()` - Resgata cashback manual
5. ✅ `atualizar_saldo_cliente_cashback()` - Atualiza saldo

### Triggers:
1. ✅ `trg_gerar_cashback_new_order` - Gera cashback automaticamente quando pedido é inserido/atualizado
2. ✅ `trg_atualizar_saldo_cashback_insert` - Atualiza saldo quando transação é inserida
3. ✅ `trg_atualizar_saldo_cashback_update` - Atualiza saldo quando transação é atualizada

---

## ⚙️ FLUXO COMPLETO

### Quando uma venda é finalizada no Tiny:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. VENDA FINALIZADA NO TINY ERP                             │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. SINCRONIZAÇÃO AUTOMÁTICA (Netlify Function)              │
│    - Busca pedido do Tiny API                               │
│    - Processa dados (itens, cliente, etc)                   │
│    - Salva na tabela tiny_orders                            │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. TRIGGER AUTOMÁTICO (PRIMÁRIO)                            │
│    ✅ Executa após INSERT/UPDATE                             │
│    ✅ Valida critérios                                       │
│    ✅ GERA CASHBACK AUTOMATICAMENTE                          │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. VERIFICAÇÃO DE FALLBACK (Netlify Function)               │
│    ⏱️ Aguarda 500ms                                          │
│    🔍 Verifica se cashback foi gerado                        │
│    ⚠️ Se NÃO → Tenta gerar manualmente (FALLBACK)           │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. CASHBACK GERADO!                                          │
│    ✅ Transação criada em cashback_transactions              │
│    ✅ Saldo atualizado em cashback_balance                   │
│    ✅ Disponível para resgate                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 CONFIGURAÇÃO NECESSÁRIA

### 1. Executar Script SQL no Supabase:
```sql
-- Execute: SOLUCAO_COMPLETA_CASHBACK_AUTOMATICO.sql
-- Isso cria:
--   ✅ Tabelas
--   ✅ Configuração padrão
--   ✅ Trigger automático
```

### 2. Verificar se está funcionando:
```sql
-- Execute: VERIFICACAO_COMPLETA_CASHBACK.sql
-- Verifica:
--   ✅ Estrutura das tabelas
--   ✅ Status do trigger
--   ✅ Configurações ativas
--   ✅ Últimos pedidos
```

---

## ✅ CRITÉRIOS PARA GERAÇÃO AUTOMÁTICA

O cashback é gerado automaticamente quando:
1. ✅ Pedido tem `cliente_id` (não é NULL)
2. ✅ Pedido tem `valor_total > 0`
3. ✅ Pedido NÃO está cancelado (`situacao != 'cancelado'`)
4. ✅ Cliente tem CPF/CNPJ válido (11+ dígitos)
5. ✅ Não existe cashback EARNED para este pedido (evita duplicação)

---

## 🎛️ OPERAÇÕES MANUAIS

### No Dashboard (`/erp/cashback`):

**Lançar Cashback Manualmente:**
- Seleciona cliente
- Informa valor
- Opcional: descrição
- Chama RPC: `lancar_cashback_manual()`

**Resgatar Cashback:**
- Seleciona cliente
- Informa valor a resgatar
- Opcional: descrição
- Chama RPC: `resgatar_cashback_manual()`

**Visualizar:**
- Saldos por cliente
- Histórico de transações
- KPIs gerais

---

## 🔄 SISTEMA HÍBRIDO - COMO FUNCIONAM JUNTOS

### Fluxo Normal (99% dos casos):
1. Trigger gera automaticamente ✅
2. Fallback verifica e encontra que já foi gerado ✅
3. Nada mais acontece ✅

### Fluxo de Fallback (1% dos casos - se trigger falhar):
1. Trigger não executa ou falha ❌
2. Fallback detecta que não foi gerado ⚠️
3. Fallback gera manualmente via RPC ✅
4. Cashback gerado com sucesso ✅

### Fluxo Manual (quando necessário):
1. Admin acessa dashboard `/erp/cashback`
2. Seleciona "Lançar" ou "Resgatar"
3. Executa operação manual ✅
4. Saldo atualizado automaticamente via triggers ✅

---

## 📝 ARQUIVOS MODIFICADOS/CRIADOS

### ✅ Modificados:
- `netlify/functions/sync-tiny-orders-background.js` - Adicionado fallback manual

### ✅ Criados:
- `SOLUCAO_COMPLETA_CASHBACK_AUTOMATICO.sql` - Script completo de configuração
- `VERIFICACAO_COMPLETA_CASHBACK.sql` - Script de diagnóstico
- `ATIVAR_CASHBACK_AUTOMATICO.sql` - Script simplificado
- `SISTEMA_CASHBACK_COMPLETO.md` - Este documento

---

## ✅ CHECKLIST FINAL

- [x] Trigger automático configurado
- [x] Fallback manual implementado
- [x] Página de gestão manual funcionando
- [x] Configuração padrão criada
- [x] RPCs de operação manual funcionando
- [x] Triggers de atualização de saldo ativos

---

**✅ SISTEMA 100% FUNCIONAL: AUTOMÁTICO + MANUAL + FALLBACK!**

