# ⏱️ Timing do Envio de WhatsApp de Cashback

## 📋 FLUXO COMPLETO

### 1. **Venda chega do Tiny ERP**
   - Pedido é sincronizado via `sync-tiny-orders-background.js`
   - Pedido é salvo na tabela `tiny_orders`

### 2. **Trigger Automático (Imediato)**
   - **Trigger:** `trg_gerar_cashback_new_order`
   - **Quando:** Imediatamente após inserção/atualização em `tiny_orders`
   - **Ação:** Chama função `trigger_gerar_cashback_pedido()`

### 3. **Geração de Cashback (Imediato)**
   - Função `gerar_cashback()` é chamada
   - Cashback é gerado na tabela `cashback_transactions`
   - **✅ NOVO:** WhatsApp é adicionado à fila (`enqueue_cashback_whatsapp()`)
   - **Tempo:** ~1-2 segundos após a venda ser salva

### 4. **Processamento da Fila**
   - A fila é processada por `process-cashback-whatsapp-queue.js`
   - **Quando:** Imediatamente após a sincronização do pedido (dentro da mesma função)
   - **Tempo:** ~2-5 segundos após a venda ser salva

---

## ⏱️ TIMING TOTAL

### **Tempo Atual: 2-5 segundos após a venda**

```
Venda no Tiny ERP
    ↓ (~1-3 segundos)
Sincronização (sync-tiny-orders-background)
    ↓ (~0.5 segundos)
Salva em tiny_orders
    ↓ (Imediato - Trigger)
Gera cashback + Adiciona à fila
    ↓ (~1-2 segundos)
Processa fila e envia WhatsApp
    ↓
✅ WhatsApp enviado!
```

**TOTAL: ~2-5 segundos após a venda ser sincronizada**

---

## 🔄 PROCESSAMENTO DA FILA

### Quando a fila é processada:

1. **Imediatamente após sincronização** (automático)
   - Função `sync-tiny-orders-background` chama `process-cashback-whatsapp-queue`
   - Acontece dentro do mesmo processo de sincronização

2. **Manual** (se necessário)
   - Pode ser chamado via HTTP POST
   - Endpoint: `/.netlify/functions/process-cashback-whatsapp-queue`

3. **❌ NÃO há cron job configurado** (por enquanto)
   - A fila só é processada quando há sincronização
   - Ou quando chamada manualmente

---

## ⚠️ PONTOS DE ATENÇÃO

### 1. **Se não houver sincronização:**
   - Mensagens ficam na fila com status `PENDING`
   - Precisam ser processadas manualmente ou na próxima sincronização

### 2. **Se a sincronização falhar:**
   - Cashback pode ser gerado mas WhatsApp não enviado
   - Mensagem fica na fila para processar depois

### 3. **Limite de processamento:**
   - A função processa **máximo 10 itens** por execução
   - Se houver mais de 10 pendentes, processa em lotes

---

## ✅ VANTAGENS DO SISTEMA ATUAL

1. ✅ **Rápido:** Mensagem enviada em segundos após a venda
2. ✅ **Confiável:** Fila garante que mensagem não seja perdida
3. ✅ **Não bloqueia:** Erro no WhatsApp não impede geração de cashback
4. ✅ **Retry automático:** Até 3 tentativas se falhar

---

## 🔧 POSSÍVEIS MELHORIAS

### Opção 1: Adicionar Cron Job (Recomendado)
```javascript
// Executar a cada 1 minuto
// Garante que mensagens pendentes sejam processadas mesmo sem sincronização
```

### Opção 2: Processar em Tempo Real
- Usar Supabase Realtime para processar imediatamente quando item é adicionado à fila
- Mais complexo, mas garante processamento instantâneo

### Opção 3: Adicionar Delay Opcional
- Se quiser enviar WhatsApp após X minutos/horas da venda
- Útil para não sobrecarregar cliente com muitas mensagens

---

## 📊 QUERY PARA VER TIMING REAL

```sql
-- Ver tempo entre criação da fila e envio
SELECT 
    q.id,
    q.status,
    q.created_at as criado_em,
    q.last_attempt_at as enviado_em,
    CASE 
        WHEN q.status = 'SENT' THEN 
            EXTRACT(EPOCH FROM (q.last_attempt_at - q.created_at))::INTEGER
        ELSE NULL
    END as segundos_ate_envio,
    c.nome as cliente_nome,
    s.name as loja_nome
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
WHERE q.status = 'SENT'
ORDER BY q.last_attempt_at DESC
LIMIT 50;
```

---

## 🎯 CONCLUSÃO

**Tempo atual:** ~2-5 segundos após a venda ser sincronizada

**É escalado?** ✅ Sim, mas apenas durante sincronizações. Para garantir processamento sempre, seria ideal adicionar um cron job.

**Quer adicionar um cron job para processar a fila automaticamente?**

