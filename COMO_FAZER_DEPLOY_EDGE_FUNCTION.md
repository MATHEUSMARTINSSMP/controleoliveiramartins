# Como Fazer Deploy da Edge Function sync-tiny-orders

## Opção 1: Via Supabase Dashboard (Mais Fácil) ✅

1. Acesse o Supabase Dashboard: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc
2. Vá em **Edge Functions** no menu lateral
3. Procure pela função `sync-tiny-orders`
4. Clique em **Deploy** ou **Edit**
5. Cole o conteúdo do arquivo `supabase/functions/sync-tiny-orders/index.ts`
6. Clique em **Deploy** ou **Save**

## Opção 2: Via Supabase CLI (Recomendado para produção)

### Passo 1: Instalar Supabase CLI (se ainda não tiver)

```bash
# Via npm
npm install -g supabase

# Ou via Homebrew (Mac)
brew install supabase/tap/supabase

# Ou via Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Passo 2: Fazer login no Supabase

```bash
supabase login
```

### Passo 3: Linkar o projeto (se ainda não estiver linkado)

```bash
cd /home/matheusmartins/controleoliveiramartins-1
supabase link --project-ref kktsbnrnlnzyofupegjc
```

### Passo 4: Fazer deploy da função

```bash
supabase functions deploy sync-tiny-orders
```

## Opção 3: Via GitHub Actions (Automatizado)

Se você tiver GitHub Actions configurado, o deploy pode ser automático a cada push.

## Verificar se o Deploy Funcionou

Após o deploy, você pode verificar:

1. **No Dashboard**: Vá em Edge Functions > sync-tiny-orders > Logs
2. **Testar manualmente**: Execute o script SQL abaixo para testar:

```sql
-- Testar a função manualmente
SELECT sistemaretiradas.chamar_sync_tiny_orders('incremental_1min');
```

3. **Verificar logs**: Os logs devem aparecer no Dashboard do Supabase em Edge Functions > sync-tiny-orders > Logs

## Variáveis de Ambiente Necessárias

Certifique-se de que as seguintes variáveis estão configuradas no Supabase Dashboard:

1. Vá em **Edge Functions** > **sync-tiny-orders** > **Settings**
2. Configure as seguintes secrets:
   - `SUPABASE_URL` (geralmente já configurado automaticamente)
   - `SUPABASE_SERVICE_ROLE_KEY` (geralmente já configurado automaticamente)
   - `NETLIFY_FUNCTION_URL` ou `NETLIFY_URL` (opcional, fallback: https://eleveaone.com.br)

## Troubleshooting

### Erro: "Function not found"
- Verifique se o nome da função está correto: `sync-tiny-orders`
- Certifique-se de que está no diretório correto do projeto

### Erro: "Authentication failed"
- Execute `supabase login` novamente
- Verifique se você tem permissões no projeto

### Erro: "Module not found"
- Verifique se o arquivo `deno.json` está presente
- Certifique-se de que todas as dependências estão corretas

## Próximos Passos Após o Deploy

1. ✅ Execute `HABILITAR_PG_NET.sql` no Supabase SQL Editor
2. ✅ Verifique os logs da Edge Function para confirmar que está sendo chamada
3. ✅ Monitore os cron jobs para ver se estão executando corretamente

