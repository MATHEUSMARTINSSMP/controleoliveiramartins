# 🧪 Guia de Testes - Edge Functions

## 🔧 Ferramentas para Testar

### Opção 1: Via Supabase Dashboard (Recomendado)

1. **Acesse:** https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions/sync-tiny-orders
2. Clique em **"Invoke Function"** ou **"Test"**
3. Use o seguinte JSON para testar:

```json
{
  "store_id": "cee7d359-0240-4131-87a2-21ae44bd1bb4",
  "sync_type": "ORDERS",
  "hard_sync": false,
  "limit": 1,
  "max_pages": 1
}
```

### Opção 2: Via cURL (Terminal)

```bash
curl -X POST \
  'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/sync-tiny-orders' \
  -H 'Authorization: Bearer SEU_ANON_KEY_AQUI' \
  -H 'Content-Type: application/json' \
  -d '{
    "store_id": "cee7d359-0240-4131-87a2-21ae44bd1bb4",
    "sync_type": "ORDERS",
    "hard_sync": false,
    "limit": 1,
    "max_pages": 1
  }'
```

### Opção 3: Via Frontend (Console do Navegador)

```javascript
const { data, error } = await supabase.functions.invoke('sync-tiny-orders', {
  body: {
    store_id: 'cee7d359-0240-4131-87a2-21ae44bd1bb4',
    sync_type: 'ORDERS',
    hard_sync: false,
    limit: 1,
    max_pages: 1
  }
});

console.log('Data:', data);
console.log('Error:', error);
```

## ✅ Checklist de Verificação

### 1. Edge Function está Deployada?
- [ ] Acesse: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions
- [ ] A função `sync-tiny-orders` aparece na lista?
- [ ] Status mostra como "Deployed" ou "Active"?

### 2. Variáveis de Ambiente Configuradas?
- [ ] `SUPABASE_URL` está configurada?
- [ ] `SUPABASE_SERVICE_ROLE_KEY` está configurada?
- [ ] `NETLIFY_FUNCTION_URL` está configurada como `https://eleveaone.com.br`?

### 3. Teste Básico - Chamada Simples

**Teste 1: Chamada sem parâmetros (deve retornar sincronização automática)**
```bash
curl -X POST \
  'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/sync-tiny-orders' \
  -H 'Authorization: Bearer SEU_ANON_KEY' \
  -H 'Content-Type: application/json'
```

**Resultado Esperado:**
- Status: 200 OK
- Body: `{ "success": true, "message": "...", "results": [...] }`

### 4. Teste de Sincronização Manual

**Teste 2: Sincronização manual (background)**
```bash
curl -X POST \
  'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/sync-tiny-orders' \
  -H 'Authorization: Bearer SEU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "store_id": "cee7d359-0240-4131-87a2-21ae44bd1bb4",
    "sync_type": "ORDERS",
    "hard_sync": false,
    "limit": 1,
    "max_pages": 1
  }'
```

**Resultado Esperado:**
- Status: 200 OK
- Body: `{ "success": true, "message": "Sincronização de pedidos iniciada em background..." }`

### 5. Teste de Sincronização de Clientes

**Teste 3: Sincronização de clientes**
```bash
curl -X POST \
  'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/sync-tiny-orders' \
  -H 'Authorization: Bearer SEU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "store_id": "cee7d359-0240-4131-87a2-21ae44bd1bb4",
    "sync_type": "CONTACTS",
    "hard_sync": false,
    "limit": 1,
    "max_pages": 1
  }'
```

**Resultado Esperado:**
- Status: 200 OK
- Body: `{ "success": true, "message": "Sincronização de clientes iniciada em background..." }`

## 🔍 Verificar Logs

### Logs da Edge Function:
1. Acesse: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions/sync-tiny-orders/logs
2. Procure por:
   - `🔥 SINCRONIZAÇÃO MANUAL` - Indica chamada manual
   - `📡 Chamando Netlify Function` - Indica que está chamando a Netlify Function
   - `❌ Erro` - Indica erros

### Logs da Netlify Function:
1. Acesse: https://app.netlify.com/sites/[SEU_SITE]/functions
2. Procure por `sync-tiny-orders-background`
3. Verifique logs de execução

## ❌ Troubleshooting

### Erro 404: "Function not found"
- ✅ Verifique se a função está deployada
- ✅ Verifique se o nome está correto: `sync-tiny-orders`
- ✅ Faça redeploy: `supabase functions deploy sync-tiny-orders`

### Erro: "Failed to send request to Netlify Function"
- ✅ Verifique se `NETLIFY_FUNCTION_URL` está configurada
- ✅ Verifique se a Netlify Function existe
- ✅ Verifique logs da Edge Function

### Erro: "Token de acesso não encontrado"
- ✅ Verifique se `SUPABASE_SERVICE_ROLE_KEY` está configurada
- ✅ Verifique se a chave está completa

### Erro: "Loja não encontrada"
- ✅ Verifique se `store_id` está correto
- ✅ Verifique se a integração ERP está conectada

## 📊 Testes Automatizados (Próximos Passos)

Após validar manualmente, podemos criar testes automatizados usando:
- Jest ou Vitest para testes unitários
- Scripts de integração para testes end-to-end
- CI/CD para testes contínuos

