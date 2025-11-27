# 🚀 ALTERNATIVAS PARA DETECÇÃO DE NOVAS VENDAS EM TEMPO REAL

## 🎯 OBJETIVO

Encontrar alternativas para detectar novas vendas em tempo real, já que **pg_cron não suporta segundos** (mínimo é 1 minuto).

---

## ✅ ALTERNATIVAS VIÁVEIS

### **1. POLLING INTELIGENTE COM VERIFICAÇÃO DE MUDANÇAS** ⭐⭐⭐⭐⭐

**Como funciona:**
- Antes de sincronizar, verificar se houve mudança
- Comparar `ultimo_numero_pedido` ou `ultima_data_pedido` no banco vs API
- Só sincronizar se detectar mudança

**Vantagens:**
- ✅ Muito eficiente (evita requisições desnecessárias)
- ✅ Funciona com qualquer frequência (1 minuto, 5 minutos, etc.)
- ✅ Reduz drasticamente o custo
- ✅ Não depende de recursos externos

**Implementação:**
```sql
-- 1. Criar tabela de controle de última sincronização
CREATE TABLE IF NOT EXISTS sync_control (
    store_id UUID PRIMARY KEY,
    ultimo_numero_pedido INTEGER,
    ultima_data_pedido TIMESTAMP,
    ultima_sync TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Edge Function verifica antes de sincronizar
-- Compara último número de pedido no banco vs API
-- Se diferente, sincroniza; se igual, pula
```

**Código exemplo:**
```typescript
// Verificar se há nova venda antes de sincronizar
async function verificarNovaVenda(storeId: string): Promise<boolean> {
  // 1. Buscar último pedido no banco
  const { data: ultimoPedido } = await supabase
    .from('tiny_orders')
    .select('numero_pedido, data_pedido')
    .eq('store_id', storeId)
    .order('numero_pedido', { ascending: false })
    .limit(1)
    .single();

  // 2. Buscar último pedido na API (requisição leve, apenas listagem)
  const response = await callERPAPI('/pedidos', {
    situacao: '9,8', // Aprovado e Faturado
    limit: 1,
    ordenar: 'numeroPedido|DESC'
  });

  const ultimoPedidoAPI = response?.pedidos?.[0];

  // 3. Comparar
  if (!ultimoPedido || ultimoPedido.numero_pedido !== ultimoPedidoAPI.numeroPedido) {
    return true; // Há nova venda!
  }

  return false; // Sem mudanças
}
```

**Frequência recomendada:** A cada 1-2 minutos (muito leve, apenas verificação)

---

### **2. WEBHOOKS DO TINY ERP** ⭐⭐⭐⭐⭐ (SE DISPONÍVEL)

**Como funciona:**
- Tiny ERP envia notificação HTTP quando há nova venda
- Recebemos a notificação em tempo real (0 segundos de delay!)

**Vantagens:**
- ✅ Tempo real verdadeiro (0 delay)
- ✅ Zero requisições desnecessárias
- ✅ Mais eficiente possível

**Desvantagens:**
- ❌ Precisa verificar se Tiny ERP oferece webhooks
- ❌ Precisa configurar endpoint público para receber
- ❌ Precisa validar assinatura/autenticação

**Implementação:**
```typescript
// Netlify Function: /netlify/functions/tiny-webhook.js
export const handler = async (event) => {
  // 1. Validar assinatura do Tiny ERP
  const signature = event.headers['x-tiny-signature'];
  if (!validarAssinatura(signature, event.body)) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  // 2. Processar notificação
  const { tipo, pedido_id } = JSON.parse(event.body);
  
  if (tipo === 'pedido.criado' || tipo === 'pedido.faturado') {
    // 3. Sincronizar apenas este pedido específico
    await syncPedidoEspecifico(pedido_id);
  }

  return { statusCode: 200, body: 'OK' };
};
```

**Status:** ⚠️ **PRECISA VERIFICAR** se Tiny ERP oferece webhooks na documentação oficial

---

### **3. EDGE FUNCTION COM LOOP INTERNO** ⭐⭐⭐

**Como funciona:**
- Edge Function que fica rodando continuamente
- Loop interno verifica a cada 30 segundos
- Mantém estado entre verificações

**Vantagens:**
- ✅ Pode verificar a cada 30 segundos
- ✅ Não depende de pg_cron

**Desvantagens:**
- ❌ Edge Functions têm timeout (máximo 60 segundos no Supabase)
- ❌ Não é ideal para loops longos
- ❌ Pode ser custoso manter função rodando

**Implementação:**
```typescript
// Edge Function com loop interno (limitado pelo timeout)
Deno.serve(async (req) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s max

  try {
    while (!controller.signal.aborted) {
      // Verificar nova venda
      const temNovaVenda = await verificarNovaVenda();
      
      if (temNovaVenda) {
        await sincronizarUltimaVenda();
      }

      // Aguardar 30 segundos
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  } finally {
    clearTimeout(timeoutId);
  }
});
```

**Status:** ⚠️ **LIMITADO** pelo timeout de 60 segundos do Supabase

---

### **4. COMPARAÇÃO DE TIMESTAMPS** ⭐⭐⭐⭐

**Como funciona:**
- Armazenar `ultima_data_pedido` no banco
- Comparar com `data_pedido` do último pedido na API
- Só sincronizar se data for mais recente

**Vantagens:**
- ✅ Muito eficiente (apenas 1 requisição leve)
- ✅ Funciona com qualquer frequência
- ✅ Reduz custos drasticamente

**Implementação:**
```typescript
async function verificarNovaVendaPorData(storeId: string): Promise<boolean> {
  // 1. Buscar última data no banco
  const { data: ultimaData } = await supabase
    .from('tiny_orders')
    .select('data_pedido')
    .eq('store_id', storeId)
    .order('data_pedido', { ascending: false })
    .limit(1)
    .single();

  // 2. Buscar última data na API (requisição leve)
  const response = await callERPAPI('/pedidos', {
    situacao: '9,8',
    limit: 1,
    ordenar: 'data|DESC'
  });

  const ultimaDataAPI = new Date(response?.pedidos?.[0]?.data);

  // 3. Comparar
  if (!ultimaData || new Date(ultimaData.data_pedido) < ultimaDataAPI) {
    return true; // Há nova venda!
  }

  return false;
}
```

---

### **5. SUPABASE REALTIME + TRIGGERS** ⭐⭐⭐

**Como funciona:**
- Usar Supabase Realtime para escutar mudanças
- Trigger no banco detecta nova venda
- Notifica em tempo real

**Vantagens:**
- ✅ Tempo real verdadeiro
- ✅ Integrado ao Supabase

**Desvantagens:**
- ❌ Só funciona se a venda já estiver no banco
- ❌ Não detecta vendas que ainda não foram sincronizadas
- ❌ Não resolve o problema inicial (detectar na API)

**Status:** ⚠️ **NÃO APLICÁVEL** para detectar vendas na API do Tiny ERP

---

### **6. SERVER-SENT EVENTS (SSE) OU WEBSOCKETS** ⭐⭐

**Como funciona:**
- Frontend mantém conexão aberta
- Backend verifica periodicamente e envia notificações

**Vantagens:**
- ✅ Notificações em tempo real no frontend

**Desvantagens:**
- ❌ Ainda precisa fazer polling no backend
- ❌ Mais complexo de implementar
- ❌ Não resolve o problema de detecção

**Status:** ⚠️ **NÃO RESOLVE** o problema de detecção na API

---

## 🎯 RECOMENDAÇÃO FINAL

### **SOLUÇÃO HÍBRIDA: POLLING INTELIGENTE + WEBHOOK (SE DISPONÍVEL)**

#### **Opção 1: Polling Inteligente (RECOMENDADO)** ⭐⭐⭐⭐⭐

**Implementação:**
1. ✅ Criar tabela `sync_control` para armazenar último pedido
2. ✅ Edge Function verifica mudanças antes de sincronizar
3. ✅ Só sincroniza se detectar mudança
4. ✅ Frequência: A cada 1-2 minutos (muito leve)

**Vantagens:**
- ✅ Funciona 100% (não depende de recursos externos)
- ✅ Muito eficiente (evita requisições desnecessárias)
- ✅ Reduz custos drasticamente
- ✅ Fácil de implementar

**Custo estimado:**
- Verificação: ~288 requisições/dia (a cada 1 minuto)
- Sincronização: Apenas quando há mudança (muito menos!)

#### **Opção 2: Webhook (SE DISPONÍVEL)** ⭐⭐⭐⭐⭐

**Implementação:**
1. ✅ Verificar documentação do Tiny ERP para webhooks
2. ✅ Configurar endpoint público (Netlify Function)
3. ✅ Validar assinatura/autenticação
4. ✅ Sincronizar apenas quando receber notificação

**Vantagens:**
- ✅ Tempo real verdadeiro (0 delay)
- ✅ Zero requisições desnecessárias
- ✅ Mais eficiente possível

**Status:** ⚠️ **PRECISA VERIFICAR** se Tiny ERP oferece webhooks

---

## 📊 COMPARAÇÃO DAS ALTERNATIVAS

| Alternativa | Tempo Real | Eficiência | Complexidade | Custo | Viabilidade |
|-------------|------------|------------|--------------|-------|-------------|
| **Polling Inteligente** | ⭐⭐⭐⭐ (1-2 min) | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 100% |
| **Webhook Tiny ERP** | ⭐⭐⭐⭐⭐ (0s) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⚠️ Verificar |
| **Edge Function Loop** | ⭐⭐⭐ (30s) | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⚠️ Limitado |
| **Comparação Timestamps** | ⭐⭐⭐⭐ (1-2 min) | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ 100% |
| **Supabase Realtime** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ❌ Não aplicável |
| **SSE/WebSocket** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⚠️ Complexo |

---

## 🚀 PRÓXIMOS PASSOS

### **1. Verificar Webhooks do Tiny ERP**
```bash
# Consultar documentação oficial
# https://erp.tiny.com.br/public-api/v3/swagger/index.html
# Procurar por "webhook", "notificação", "callback"
```

### **2. Implementar Polling Inteligente (RECOMENDADO)**
1. ✅ Criar migration para tabela `sync_control`
2. ✅ Criar função `verificarNovaVenda()` na Edge Function
3. ✅ Modificar job de 5 minutos para usar verificação inteligente
4. ✅ Testar eficiência e custos

### **3. Se Webhook Disponível, Implementar**
1. ✅ Criar Netlify Function para receber webhooks
2. ✅ Configurar endpoint público
3. ✅ Validar assinatura
4. ✅ Sincronizar apenas quando receber notificação

---

## ✅ CONCLUSÃO

**A melhor alternativa é POLLING INTELIGENTE:**
- ✅ Funciona 100% (não depende de recursos externos)
- ✅ Muito eficiente (evita requisições desnecessárias)
- ✅ Reduz custos drasticamente
- ✅ Fácil de implementar
- ✅ Ainda é muito rápido (1-2 minutos)

**Se Tiny ERP oferecer webhooks, usar como complemento:**
- ✅ Tempo real verdadeiro (0 delay)
- ✅ Zero requisições desnecessárias
- ✅ Mais eficiente possível

**Recomendação final:**
🎯 **IMPLEMENTAR POLLING INTELIGENTE AGORA** e verificar webhooks depois!

