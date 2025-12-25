# 📋 Migrations do Módulo de Marketing - Ordem de Execução

**Data**: 2025-12-24

---

## ✅ Migrations a Executar (em ordem)

Execute as migrations **nesta ordem exata** no Supabase SQL Editor:

### 1️⃣ Primeira Migration (Estrutura Base)

```
20251224000035_create_marketing_module.sql
```

**O que faz:**
- Cria tabelas básicas:
  - `marketing_campaigns`
  - `marketing_templates`
  - `marketing_assets`
  - `marketing_posts`
  - `marketing_post_assets`
- Cria RLS policies
- Cria triggers e funções básicas

---

### 2️⃣ Segunda Migration (Estrutura de Produção)

```
20251224000036_update_marketing_production_structure.sql
```

**O que faz:**
- Atualiza `marketing_assets` com campos para IA:
  - `provider`, `provider_model`, `prompt`, `storage_path`, etc.
- Cria tabela `marketing_jobs` (processos assíncronos)
- Cria tabela `marketing_usage` (rastreamento de uso)
- Adiciona campos em `stores` (`brand_colors`, `brand_fonts`, `logo_url`)
- Adiciona RLS para novas tabelas

**⚠️ IMPORTANTE:** Esta migration depende da primeira!

---

### 3️⃣ Terceira Migration (Templates de Prompts)

```
20251224000037_add_prompt_templates_fields.sql
```

**O que faz:**
- Adiciona campos em `marketing_templates`:
  - `prompt`, `provider`, `model`, `tags`, `is_favorite`, `usage_count`, `user_id`
- Cria índices para favoritos e tags

**⚠️ IMPORTANTE:** Esta migration depende da primeira (onde `marketing_templates` é criada)!

---

## 📝 Como Executar

1. Acesse o **Supabase Dashboard** → **SQL Editor**

2. Execute cada migration **na ordem listada acima**

3. Verifique se não há erros (todas devem retornar sucesso)

4. **Importante:** Execute uma por vez e aguarde a conclusão antes de executar a próxima

---

## 🔍 Verificação Pós-Migration

Após executar todas as migrations, verifique se as tabelas foram criadas:

```sql
-- Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'sistemaretiradas' 
  AND table_name LIKE 'marketing%'
ORDER BY table_name;

-- Verificar colunas de marketing_jobs
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
  AND table_name = 'marketing_jobs'
ORDER BY ordinal_position;

-- Verificar colunas de marketing_assets
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
  AND table_name = 'marketing_assets'
ORDER BY ordinal_position;
```

---

## ⚠️ Notas Importantes

1. **Ordem é CRÍTICA**: Execute na ordem exata listada acima
2. **Não pule nenhuma**: Todas são necessárias
3. **Backup**: Recomendado fazer backup antes (especialmente se já tem dados)
4. **Teste em desenvolvimento primeiro**: Se possível, teste em ambiente de desenvolvimento antes de produção

---

## 📂 Localização dos Arquivos

Todos os arquivos estão em:
```
supabase/migrations/
├── 20251224000035_create_marketing_module.sql
├── 20251224000036_update_marketing_production_structure.sql
└── 20251224000037_add_prompt_templates_fields.sql
```

---

**Última atualização**: 2025-12-24

