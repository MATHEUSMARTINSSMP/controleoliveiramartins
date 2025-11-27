# 🚀 Deploy da Edge Function `sync-tiny-orders`

## ⚠️ PROBLEMA IDENTIFICADO

A Edge Function `sync-tiny-orders` **não está deployada no Supabase**, causando erro 404 e fazendo o sistema usar fallback (sincronização no frontend).

## ✅ SOLUÇÃO: Deploy da Edge Function

### Opção 1: Deploy via Supabase CLI (Recomendado)

```bash
# 1. Instalar Supabase CLI (se não tiver)
npm install -g supabase

# 2. Login no Supabase
supabase login

# 3. Linkar projeto local ao Supabase
supabase link --project-ref kktsbnrnlnzyofupeqjc

# 4. Deploy da função específica
supabase functions deploy sync-tiny-orders

# OU deploy de todas as funções
supabase functions deploy
```

### Opção 2: Deploy via Dashboard do Supabase

1. Acesse: https://supabase.com/dashboard/project/kktsbnrnlnzyofupeqjc/functions
2. Clique em "Create a new function"
3. Nome: `sync-tiny-orders`
4. Cole o conteúdo do arquivo `supabase/functions/sync-tiny-orders/index.ts`
5. Clique em "Deploy"

### Opção 3: Deploy via API/CLI Automatizado

```bash
# Usando Supabase CLI com variáveis de ambiente
SUPABASE_ACCESS_TOKEN=seu_token_aqui \
SUPABASE_PROJECT_ID=kktsbnrnlnzyofupeqjc \
supabase functions deploy sync-tiny-orders
```

## 🔧 Configurar Variáveis de Ambiente

Após o deploy, configure as variáveis de ambiente no Supabase:

1. Acesse: https://supabase.com/dashboard/project/kktsbnrnlnzyofupeqjc/settings/functions
2. Adicione as seguintes variáveis:
   - `NETLIFY_FUNCTION_URL` = `https://eleveaone.com.br`
   - `SUPABASE_URL` = (já configurado automaticamente)
   - `SUPABASE_SERVICE_ROLE_KEY` = (já configurado automaticamente)

## ✅ Verificar se Deploy Funcionou

1. Acesse: https://supabase.com/dashboard/project/kktsbnrnlnzyofupeqjc/functions/sync-tiny-orders
2. Deve aparecer a função listada
3. Teste fazendo uma requisição manual ou tentando sincronizar novamente

## 🔍 Troubleshooting

### Erro 404 continua aparecendo:
- Verifique se o nome da função está exatamente `sync-tiny-orders`
- Verifique se o deploy foi concluído com sucesso
- Verifique os logs do Supabase Dashboard

### Erro de CORS:
- A Edge Function já tem CORS headers configurados
- O erro 404 causa o problema de CORS (é efeito, não causa)

## 📝 Nota Importante

A Edge Function precisa estar deployada para que:
- ✅ Sincronizações manuais rodem em background
- ✅ Você possa fechar a página durante a sincronização
- ✅ O sistema funcione corretamente sem fallback

