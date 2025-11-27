# 🚀 Deploy da Edge Function usando Personal Access Token

## 🔑 Personal Access Token Fornecido

```
sbp_1ddf5cc7ba0370fede733a28a17cba8e2909e3ab
```

⚠️ **IMPORTANTE:** Mantenha este token seguro! Ele tem acesso ao seu projeto Supabase.

---

## 📋 Opção 1: Deploy via API (Recomendado - Usa o Token)

### Passo 1: Preparar o código

A função já está pronta em: `supabase/functions/sync-tiny-orders/`

### Passo 2: Deploy usando cURL

```bash
# Compactar a função
cd supabase/functions/sync-tiny-orders
zip -r function.zip . -x "*.md"

# Fazer deploy via API
curl -X POST \
  'https://api.supabase.com/v1/projects/kktsbnrnlnzyofupegjc/functions/sync-tiny-orders' \
  -H 'Authorization: Bearer sbp_1ddf5cc7ba0370fede733a28a17cba8e2909e3ab' \
  -H 'Content-Type: application/zip' \
  --data-binary @function.zip
```

### Passo 3: Verificar deploy

Acesse: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions/sync-tiny-orders

---

## 📋 Opção 2: Deploy via Supabase CLI

### Passo 1: Login com Personal Access Token

```bash
supabase login --token sbp_1ddf5cc7ba0370fede733a28a17cba8e2909e3ab
```

### Passo 2: Linkar projeto

```bash
supabase link --project-ref kktsbnrnlnzyofupegjc
```

### Passo 3: Deploy

```bash
supabase functions deploy sync-tiny-orders
```

---

## 📋 Opção 3: Deploy via Dashboard (Mais Fácil)

1. **Acesse:** https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions

2. **Clique em "Create a new function"**

3. **Nome:** `sync-tiny-orders`

4. **Cole o código:**
   - Abra o arquivo: `supabase/functions/sync-tiny-orders/index.ts`
   - Copie todo o conteúdo
   - Cole no editor do Dashboard

5. **Clique em "Deploy"**

---

## ✅ Após o Deploy - Configurar Variáveis de Ambiente

1. **Acesse:** https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/settings/functions

2. **Adicione as seguintes variáveis:**

   | Nome | Valor |
   |------|-------|
   | `NETLIFY_FUNCTION_URL` | `https://eleveaone.com.br` |
   | `SUPABASE_SERVICE_ROLE_KEY` | (copie do Settings > API > service_role) |
   | `SUPABASE_URL` | (já configurado automaticamente) |

---

## 🧪 Testar a Edge Function

### Teste Rápido via Dashboard:

1. Acesse: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions/sync-tiny-orders
2. Clique em **"Invoke Function"**
3. Use este JSON:

```json
{
  "store_id": "cee7d359-0240-4131-87a2-21ae44bd1bb4",
  "sync_type": "ORDERS",
  "hard_sync": false,
  "limit": 1,
  "max_pages": 1
}
```

4. Clique em **"Invoke"**

### Resultado Esperado:

```json
{
  "success": true,
  "message": "Sincronização de pedidos iniciada em background para loja [nome]. Você pode fechar a página!",
  "sync_type": "ORDERS",
  "hard_sync": false
}
```

---

## ✅ Checklist Final

- [ ] Edge Function `sync-tiny-orders` está deployada
- [ ] Variável `NETLIFY_FUNCTION_URL` está configurada
- [ ] Variável `SUPABASE_SERVICE_ROLE_KEY` está configurada
- [ ] Teste via Dashboard retornou sucesso
- [ ] Logs mostram execução correta
- [ ] Frontend consegue chamar a função sem erro 404

---

## 🔍 Verificar Logs

1. **Acesse:** https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions/sync-tiny-orders/logs

2. **Procure por:**
   - `🔥 SINCRONIZAÇÃO MANUAL` - Indica chamada manual
   - `📡 Chamando Netlify Function` - Indica que está funcionando
   - `❌ Erro` - Indica problemas

---

## 📝 Próximos Passos

Após deploy bem-sucedido:
1. ✅ Testar sincronização manual no frontend
2. ✅ Verificar se roda em background (pode fechar a página)
3. ✅ Verificar logs da Netlify Function
4. ✅ Configurar sincronização automática (pg_cron)

