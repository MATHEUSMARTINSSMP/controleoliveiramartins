# 🔍 DIAGNÓSTICO: Erro `relation "public.profiles" does not exist`

## ❌ PROBLEMA IDENTIFICADO

O erro `relation "public.profiles" does not exist` (código `42P01`) aparece mesmo com:
- ✅ Código usando `.schema("sistemaretiradas")`
- ✅ Headers `Accept-Profile: sistemaretiradas` sendo enviados
- ✅ Cliente Supabase configurado com `db: { schema: 'sistemaretiradas' }`

## 🔎 CAUSA RAIZ

O **PostgREST não está reconhecendo o schema `sistemaretiradas`** porque:

1. **O schema não está exposto no PostgREST** (`pgrst.db_schemas` não inclui `sistemaretiradas`)
2. **O cache do PostgREST não foi recarregado** após renomear o schema
3. **Permissões insuficientes** no schema `sistemaretiradas`

## ✅ SOLUÇÃO

### Passo 1: Execute o script SQL

Execute o arquivo `VERIFICAR_E_CORRIGIR_POSTGREST.sql` no **SQL Editor do Supabase**.

Este script:
- ✅ Verifica se o schema existe
- ✅ Verifica se a tabela `profiles` existe
- ✅ Configura `pgrst.db_schemas` para incluir `sistemaretiradas`
- ✅ Concede todas as permissões necessárias
- ✅ **Força o PostgREST a recarregar o cache** (`NOTIFY pgrst, 'reload schema'`)

### Passo 2: Verifique no Supabase Dashboard

1. Vá em **Settings** > **API** > **Exposed schemas**
2. Confirme que `sistemaretiradas` está na lista
3. Se não estiver, adicione manualmente

### Passo 3: Aguarde alguns segundos

Após executar o script, aguarde **5-10 segundos** para o PostgREST processar o `NOTIFY`.

### Passo 4: Teste novamente

1. Recarregue a página do dashboard (Ctrl+F5)
2. Verifique o console do navegador
3. O erro `relation "public.profiles" does not exist` deve desaparecer

## 📋 VERIFICAÇÃO

Após executar o script, você deve ver:

1. **No console do navegador:**
   - Status: `200` (não mais `404`)
   - `Content-Profile: sistemaretiradas` (não mais `null`)
   - Dados retornados (não mais `Array []`)

2. **No Network tab:**
   - Headers da requisição incluem `Accept-Profile: sistemaretiradas`
   - Headers da resposta incluem `Content-Profile: sistemaretiradas`

## ⚠️ IMPORTANTE

Se o erro persistir após executar o script:

1. **Verifique se o schema foi renomeado corretamente:**
   ```sql
   SELECT schema_name FROM information_schema.schemata 
   WHERE schema_name = 'sistemaretiradas';
   ```

2. **Verifique se a tabela existe:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'sistemaretiradas' AND table_name = 'profiles';
   ```

3. **Verifique a configuração do PostgREST:**
   ```sql
   SELECT rolconfig FROM pg_roles WHERE rolname = 'authenticator';
   ```
   Deve conter: `pgrst.db_schemas=public, sistemaretiradas, elevea`

4. **Force um novo deploy no Netlify** para garantir que as variáveis de ambiente estão corretas

