# 📱 IMPLEMENTAÇÃO: Envio Automático de WhatsApp ao Gerar Cashback

## ✅ RESUMO

Implementado envio automático de mensagem WhatsApp para o cliente quando um cashback é gerado automaticamente pelo sistema.

---

## 📋 O QUE FOI IMPLEMENTADO

### 1. ✅ Função de Formatação de Mensagem (`src/lib/whatsapp.ts`)

**Função:** `formatCashbackMessage()`

Formata a mensagem de cashback conforme especificado:

```
🎁 *Cashback Gerado!*

[PRIMEIRO NOME],

Obrigado pela sua compra na [LOJA X], nós somos muito gratos por ter você como nossa cliente.

Você gerou [XX.XX] de cashback para você utilizar em nossa loja.

Esse cashback é válido até o dia [X] e você poderá cobrir até [X%] do valor da sua próxima compra.

Seu saldo atual é [XX,XX].

Com carinho,
[LOJA X]

Sistema EleveaOne 📊
```

**Parâmetros:**
- `clienteNome`: Nome completo do cliente
- `storeName`: Nome da loja
- `cashbackAmount`: Valor do cashback gerado
- `dataExpiracao`: Data de expiração do cashback
- `percentualUsoMaximo`: Percentual máximo de uso
- `saldoAtual`: Saldo atual do cliente

---

### 2. ✅ Netlify Function (`netlify/functions/send-cashback-whatsapp.js`)

**Endpoint:** `/.netlify/functions/send-cashback-whatsapp`

**Método:** `POST`

**Body esperado:**
```json
{
  "transaction_id": "uuid",
  "cliente_id": "uuid",
  "store_id": "uuid"
}
```

**Funcionalidades:**
1. Busca dados da transação de cashback
2. Busca dados do cliente (nome e telefone)
3. Busca dados da loja (nome)
4. Busca configurações de cashback (percentual de uso máximo)
5. Busca saldo atual do cliente
6. Formata mensagem personalizada
7. Envia WhatsApp via webhook n8n

**Validações:**
- ✅ Verifica se cliente tem telefone cadastrado
- ✅ Retorna erro se dados não forem encontrados
- ✅ Não bloqueia geração de cashback se WhatsApp falhar

---

### 3. ✅ Função RPC no Banco (`supabase/migrations/20250131000005_add_whatsapp_cashback_notification.sql`)

**Função:** `sistemaretiradas.enviar_whatsapp_cashback()`

**Parâmetros:**
- `p_transaction_id`: ID da transação de cashback
- `p_cliente_id`: ID do cliente
- `p_store_id`: ID da loja

**Funcionalidades:**
1. Busca URL do Netlify da configuração (`app_config.netlify_url`)
2. Chama Netlify Function via HTTP usando `pg_net` (padrão Supabase)
3. Fallback para `http` extension se `pg_net` não estiver disponível
4. Não bloqueia geração de cashback se falhar

**Tratamento de Erros:**
- ✅ Se `pg_net` falhar, tenta `http` extension
- ✅ Se ambas falharem, apenas loga warning
- ✅ Nunca bloqueia a geração de cashback

---

### 4. ✅ Modificação da Função `gerar_cashback()`

**Mudanças:**
- Após gerar cashback com sucesso, chama `enviar_whatsapp_cashback()`
- Executa em background (não bloqueia)
- Aguarda 500ms para garantir commit da transação
- Trata erros sem afetar geração de cashback

**Fluxo:**
```
1. Gerar cashback
2. Criar transação
3. Atualizar saldo
4. ✅ NOVO: Enviar WhatsApp (background)
5. Retornar sucesso
```

---

## 🔄 FLUXO COMPLETO

```
1. Nova venda no Tiny ERP
   ↓
2. Sincronização insere pedido em tiny_orders
   ↓
3. Trigger dispara automaticamente
   ↓
4. Função gerar_cashback() é chamada
   ↓
5. Cashback é gerado e salvo
   ↓
6. ✅ NOVO: enviar_whatsapp_cashback() é chamada
   ↓
7. Função RPC chama Netlify Function via HTTP
   ↓
8. Netlify Function busca dados do cliente/loja
   ↓
9. Formata mensagem personalizada
   ↓
10. Envia WhatsApp via webhook n8n
   ↓
11. Cliente recebe mensagem no WhatsApp
```

---

## 📊 DADOS UTILIZADOS NA MENSAGEM

### Dados do Cliente:
- **Nome:** `tiny_contacts.nome` (primeiro nome extraído)
- **Telefone:** `tiny_contacts.telefone` (obrigatório)

### Dados da Loja:
- **Nome:** `stores.name`

### Dados do Cashback:
- **Valor:** `cashback_transactions.amount`
- **Data de Expiração:** `cashback_transactions.data_expiracao`
- **Percentual de Uso Máximo:** `cashback_settings.percentual_uso_maximo`

### Dados do Saldo:
- **Saldo Atual:** `cashback_balance.balance`

---

## ⚙️ CONFIGURAÇÕES NECESSÁRIAS

### 1. Variáveis de Ambiente (Netlify):
- ✅ `SUPABASE_URL` - URL do Supabase
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço
- ✅ `WHATSAPP_WEBHOOK_URL` - URL do webhook n8n (opcional, hardcoded)
- ✅ `WHATSAPP_WEBHOOK_AUTH` - Token do webhook (opcional, hardcoded)

### 2. Configuração no Banco (`app_config`):
- ✅ `netlify_url` - URL base do Netlify (padrão: `https://eleveaone.com.br`)

### 3. Extensões do PostgreSQL:
- ✅ `pg_net` - Padrão do Supabase (usado primeiro)
- ✅ `http` - Fallback se `pg_net` não estiver disponível

---

## ✅ VALIDAÇÕES E TRATAMENTO DE ERROS

### Validações:
1. ✅ Cliente deve ter telefone cadastrado
2. ✅ Transação de cashback deve existir
3. ✅ Loja deve existir
4. ✅ Configurações de cashback devem existir

### Tratamento de Erros:
1. ✅ Se cliente não tem telefone → Retorna erro (não envia)
2. ✅ Se dados não encontrados → Retorna erro 404
3. ✅ Se HTTP call falhar → Loga warning, não bloqueia cashback
4. ✅ Se extensão HTTP não disponível → Loga warning, não bloqueia cashback

---

## 🎯 CASOS DE USO

### ✅ Caso 1: Cashback Gerado com Sucesso
- Cliente tem telefone cadastrado
- WhatsApp é enviado automaticamente
- Mensagem personalizada com todos os dados

### ⚠️ Caso 2: Cliente Sem Telefone
- Cashback é gerado normalmente
- WhatsApp não é enviado
- Log de warning é registrado

### ⚠️ Caso 3: Falha no Envio de WhatsApp
- Cashback é gerado normalmente
- WhatsApp não é enviado
- Log de warning é registrado
- Sistema continua funcionando

---

## 📝 MENSAGEM EXEMPLO

```
🎁 *Cashback Gerado!*

Maria,

Obrigado pela sua compra na Loja Oliveira Martins, nós somos muito gratos por ter você como nossa cliente.

Você gerou R$ 15,00 de cashback para você utilizar em nossa loja.

Esse cashback é válido até o dia 15/03/2025 e você poderá cobrir até 30% do valor da sua próxima compra.

Seu saldo atual é R$ 45,00.

Com carinho,
Loja Oliveira Martins

Sistema EleveaOne 📊
```

---

## 🔧 MANUTENÇÃO

### Verificar Logs:
```sql
-- Verificar logs de envio de WhatsApp
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%enviar_whatsapp_cashback%';
```

### Testar Manualmente:
```sql
-- Testar envio de WhatsApp para uma transação específica
SELECT sistemaretiradas.enviar_whatsapp_cashback(
    'transaction_id'::UUID,
    'cliente_id'::UUID,
    'store_id'::UUID
);
```

### Verificar Configuração:
```sql
-- Verificar URL do Netlify
SELECT * FROM sistemaretiradas.app_config 
WHERE key = 'netlify_url';
```

---

## ✅ STATUS

**Implementação:** ✅ **COMPLETA**

**Arquivos Criados/Modificados:**
1. ✅ `src/lib/whatsapp.ts` - Função `formatCashbackMessage()`
2. ✅ `netlify/functions/send-cashback-whatsapp.js` - Netlify Function
3. ✅ `supabase/migrations/20250131000005_add_whatsapp_cashback_notification.sql` - Migration

**Próximos Passos:**
1. Executar migration no Supabase
2. Verificar se extensões HTTP estão habilitadas
3. Configurar `netlify_url` na tabela `app_config`
4. Testar com uma venda real

---

**Data da Implementação:** 2025-01-31
**Status:** ✅ **PRONTO PARA TESTE**

