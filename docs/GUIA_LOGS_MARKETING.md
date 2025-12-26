# 📋 Guia de Logs - Módulo Marketing

Este guia explica onde encontrar os logs do módulo de marketing para debug e troubleshooting.

## 🔍 Onde Ver os Logs

### 1. **Console do Navegador (Frontend)**

**Como acessar:**
- Pressione `F12` ou `Ctrl+Shift+I` (Windows/Linux) ou `Cmd+Option+I` (Mac)
- Vá para a aba **"Console"**

**O que você verá:**
- Logs do hook `useMarketingJobs`: `[useMarketingJobs] ...`
- Erros de busca de jobs
- Erros de criação de jobs
- Logs de polling de status

**Exemplo de logs:**
```
[useMarketingJobs] Buscando jobs para storeId: abc-123-def
[useMarketingJobs] Jobs encontrados: 0 []
[useMarketingJobs] Erro na query: {code: "42501", message: "permission denied"}
```

---

### 2. **Netlify Functions (Backend)**

**Como acessar:**
1. Acesse o **Netlify Dashboard**: https://app.netlify.com
2. Selecione seu site (`eleveaone`)
3. Vá em **Functions** → **Functions log**
4. Filtre por função:
   - `marketing-media` - Criação de jobs
   - `marketing-worker` - Processamento de jobs
   - `marketing-jobs` - Consulta de status
   - `marketing-prompt-expand` - Expansão de prompts

**O que você verá:**
- `[MARKETING_JOB_CREATED]` - Quando um job é criado
- `[marketing-worker]` - Logs do worker de processamento
- `[marketing-media]` - Erros de criação de job
- Erros de API (Gemini, OpenAI)

**Exemplo de logs:**
```
[marketing-media] Erro ao criar job: {code: "23505", message: "duplicate key value"}
[marketing-worker] Processando job abc-123 (image, gemini)
[marketing-worker] Job abc-123 concluído em 5000ms
```

---

### 3. **Supabase Logs (Banco de Dados)**

**Como acessar:**
1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Logs** → **Postgres Logs** ou **API Logs**

**O que você verá:**
- Queries SQL executadas
- Erros de RLS (Row Level Security)
- Erros de constraint (chaves duplicadas, etc.)
- Performance de queries

**Exemplo de logs:**
```
ERROR: permission denied for table marketing_jobs
ERROR: duplicate key value violates unique constraint
```

---

### 4. **Supabase SQL Editor (Verificar Dados Diretamente)**

**Como acessar:**
1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Execute queries para verificar dados:

```sql
-- Ver todos os jobs
SELECT * FROM sistemaretiradas.marketing_jobs 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver jobs de uma loja específica
SELECT * FROM sistemaretiradas.marketing_jobs 
WHERE store_id = 'SEU_STORE_ID_AQUI'
ORDER BY created_at DESC;

-- Ver jobs com erro
SELECT id, status, error_message, error_code, created_at 
FROM sistemaretiradas.marketing_jobs 
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Ver assets gerados
SELECT * FROM sistemaretiradas.marketing_assets 
WHERE store_id = 'SEU_STORE_ID_AQUI'
ORDER BY created_at DESC 
LIMIT 20;
```

---

## 🐛 Problemas Comuns e Como Diagnosticar

### Problema 1: "Nenhum processamento encontrado"

**Possíveis causas:**
1. **RLS bloqueando acesso** - Verificar permissões no Supabase
2. **storeId incorreto** - Verificar se o storeId está sendo passado corretamente
3. **Jobs não foram criados** - Verificar logs do `marketing-media`

**Como diagnosticar:**
1. Abra o Console do navegador (F12)
2. Procure por logs `[useMarketingJobs]`
3. Verifique se há erros de permissão
4. Execute a query SQL acima no Supabase para ver se há jobs no banco

---

### Problema 2: "Erro ao criar job"

**Possíveis causas:**
1. **Tabela não existe** - Verificar se migrations foram executadas
2. **Campos obrigatórios faltando** - Verificar payload enviado
3. **Erro de validação** - Verificar constraints da tabela

**Como diagnosticar:**
1. Verifique logs do Netlify Function `marketing-media`
2. Verifique o erro retornado no console do navegador
3. Execute a query SQL para verificar estrutura da tabela:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
AND table_name = 'marketing_jobs';
```

---

### Problema 3: "Job criado mas não aparece"

**Possíveis causas:**
1. **RLS bloqueando leitura** - Verificar políticas RLS
2. **storeId diferente** - Job criado com storeId diferente do usado na busca
3. **Polling não iniciado** - Verificar se o hook está fazendo polling

**Como diagnosticar:**
1. Verifique logs `[MARKETING_JOB_CREATED]` no Netlify
2. Verifique o `store_id` do job criado
3. Compare com o `storeId` usado na busca
4. Verifique políticas RLS no Supabase

---

## 🔧 Verificações Rápidas

### 1. Verificar se a tabela existe:
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'sistemaretiradas' 
  AND table_name = 'marketing_jobs'
);
```

### 2. Verificar políticas RLS:
```sql
SELECT * FROM pg_policies 
WHERE schemaname = 'sistemaretiradas' 
AND tablename = 'marketing_jobs';
```

### 3. Verificar se há jobs no banco:
```sql
SELECT COUNT(*) FROM sistemaretiradas.marketing_jobs;
```

### 4. Verificar último job criado:
```sql
SELECT id, store_id, status, created_at, error_message 
FROM sistemaretiradas.marketing_jobs 
ORDER BY created_at DESC 
LIMIT 1;
```

---

## 📝 Logs Importantes para Monitorar

### Frontend (Console do Navegador):
- `[useMarketingJobs]` - Busca de jobs
- `Erro ao gerar conteúdo` - Erro na criação
- `Erro ao buscar jobs` - Erro na consulta

### Backend (Netlify Functions):
- `[MARKETING_JOB_CREATED]` - Job criado com sucesso
- `[marketing-media] Erro ao criar job` - Erro na criação
- `[marketing-worker]` - Processamento de jobs
- `[marketing-worker] Erro ao processar job` - Erro no processamento

### Banco de Dados (Supabase):
- Erros de RLS (permission denied)
- Erros de constraint (duplicate key, etc.)
- Queries lentas (timeout)

---

## 🚨 Ação Imediata

Se não aparecer nada em "Processamentos":

1. **Abra o Console do Navegador (F12)**
2. **Procure por logs `[useMarketingJobs]`**
3. **Copie qualquer erro que aparecer**
4. **Execute no Supabase SQL Editor:**
   ```sql
   SELECT * FROM sistemaretiradas.marketing_jobs 
   WHERE store_id = (SELECT id FROM sistemaretiradas.stores LIMIT 1)
   ORDER BY created_at DESC;
   ```
5. **Verifique se há jobs no banco**

Se houver jobs no banco mas não aparecerem no frontend, o problema é de **RLS (Row Level Security)** ou **storeId incorreto**.

