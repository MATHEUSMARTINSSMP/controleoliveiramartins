# Resultados dos Testes com cURL

## ✅ CONCLUSÃO DOS TESTES

Os testes com `curl` confirmaram que:

1. **O PostgREST RECONHECE o schema `sacadaohboy-mrkitsch-loungerie`** quando o header `Accept-Profile` é enviado
2. **Sem o header `Accept-Profile`**, o PostgREST tenta usar `elevea.profiles` (não `public.profiles`)
3. **Com o header correto**, o PostgREST retorna `content-profile: sacadaohboy-mrkitsch-loungerie` na resposta

## 🔍 PROBLEMA IDENTIFICADO

O problema é que o **cliente Supabase JS pode não estar enviando o header `Accept-Profile` corretamente** mesmo quando usamos `.schema()`.

## ✅ SOLUÇÃO APLICADA

1. **Headers globais no cliente Supabase**: Adicionados `Accept-Profile` e `Content-Profile` como headers globais
2. **Script SQL atualizado**: Adicionado `ALTER ROLE authenticator SET pgrst.db_schemas` para garantir que o PostgREST reconheça o schema

## 📋 PRÓXIMOS PASSOS

1. Execute o script `FORCAR_SCHEMA_POSTGREST.sql` no Supabase SQL Editor
2. Aguarde alguns segundos para o PostgREST recarregar o cache
3. Teste novamente no frontend

## 🧪 COMANDOS DE TESTE

Para testar manualmente:

```bash
# Teste sem header (deve dar erro)
curl -X GET \
  "https://kktsbnrnlnzyofupegjc.supabase.co/rest/v1/profiles?select=id,name&limit=1" \
  -H "apikey: sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp"

# Teste com header (deve funcionar)
curl -X GET \
  "https://kktsbnrnlnzyofupegjc.supabase.co/rest/v1/profiles?select=id,name&limit=1" \
  -H "apikey: sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp" \
  -H "Accept-Profile: sacadaohboy-mrkitsch-loungerie"
```

