# ✅ Verificar Migrations do Módulo de Marketing

## 🔍 Verificação Necessária

Você precisa verificar se as migrations do módulo de marketing foram executadas no Supabase.

### 📋 Migrations que DEVEM estar executadas:

1. ✅ `20251224000035_create_marketing_module.sql` - Estrutura base
2. ✅ `20251224000036_update_marketing_production_structure.sql` - Estrutura de produção
3. ✅ `20251224000037_add_prompt_templates_fields.sql` - Templates de prompts
4. ✅ `20251225000001_fix_lista_da_vez_analytics_errors.sql` - Correções de analytics
5. ✅ `20251225000002_fix_marketing_jobs_rls_policies.sql` - Correções de RLS

---

## 🔧 Como Verificar

### 1. Verificar se as tabelas existem:

Execute no **Supabase SQL Editor**:

```sql
-- Verificar tabelas do módulo de marketing
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'sistemaretiradas' 
  AND table_name LIKE 'marketing%'
ORDER BY table_name;
```

**Resultado esperado:**
- `marketing_assets`
- `marketing_campaigns`
- `marketing_jobs`
- `marketing_post_assets`
- `marketing_posts`
- `marketing_templates`
- `marketing_usage`

### 2. Verificar estrutura da tabela `marketing_assets`:

```sql
-- Verificar colunas de marketing_assets
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
  AND table_name = 'marketing_assets'
ORDER BY ordinal_position;
```

**Colunas importantes que devem existir:**
- ✅ `id` (UUID, PRIMARY KEY)
- ✅ `store_id` (UUID, NOT NULL)
- ✅ `user_id` (UUID, nullable)
- ✅ `type` (TEXT, NOT NULL)
- ✅ `url` (TEXT, NOT NULL) ← **IMPORTANTE: Esta coluna é obrigatória**
- ✅ `public_url` (TEXT, nullable)
- ✅ `signed_url` (TEXT, nullable)
- ✅ `storage_path` (TEXT, nullable)
- ✅ `provider` (TEXT, nullable)
- ✅ `provider_model` (TEXT, nullable)
- ✅ `prompt` (TEXT, nullable)
- ✅ `job_id` (UUID, nullable)
- ✅ `meta` (JSONB, nullable)

### 3. Verificar se a coluna `url` existe e é NOT NULL:

```sql
-- Verificar especificamente a coluna url
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
  AND table_name = 'marketing_assets'
  AND column_name = 'url';
```

**Resultado esperado:**
- `column_name`: `url`
- `data_type`: `text`
- `is_nullable`: `NO` (deve ser NOT NULL)
- `column_default`: `NULL` ou vazio

---

## ⚠️ Se as Tabelas NÃO Existem

Se as tabelas não existirem, você precisa executar as migrations na ordem:

1. **Acesse**: Supabase Dashboard → SQL Editor
2. **Execute na ordem**:
   - `20251224000035_create_marketing_module.sql`
   - `20251224000036_update_marketing_production_structure.sql`
   - `20251224000037_add_prompt_templates_fields.sql`
   - `20251225000002_fix_marketing_jobs_rls_policies.sql`

**Arquivos estão em**: `supabase/migrations/`

---

## ✅ Se as Tabelas JÁ Existem

Se as tabelas já existem, **NÃO precisa fazer nada**! 

O código já foi corrigido para preencher a coluna `url` corretamente. A estrutura do banco está correta.

---

## 🧪 Teste Rápido

Após verificar, teste gerando uma imagem:

1. Acesse: Gestão de Marketing → Gestão de Redes Sociais → Gerar Conteúdo
2. Preencha um prompt
3. Clique em "Gerar Imagem"
4. Verifique se a imagem é gerada e aparece na galeria

Se funcionar, está tudo certo! ✅

---

## 📝 Nota Importante

A coluna `url` é obrigatória (NOT NULL) porque é uma coluna legacy da estrutura original. O código agora preenche automaticamente com `publicUrl || signedUrl`, então não há necessidade de alterar a estrutura do banco.

