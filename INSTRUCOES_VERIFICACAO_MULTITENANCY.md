# Instruções para Verificação de Multi-Tenancy

## 🎯 Objetivo

Verificar se o sistema está **100% pronto para multi-tenancy** conforme os requisitos:
- ✅ Admin tem acesso a todas as suas lojas
- ✅ Lojas têm acesso a todas as suas colaboradoras
- ✅ Colaboradoras têm acesso apenas aos seus dados
- ✅ Usuários podem ter várias lojas vinculadas

## 📋 Passo a Passo

### 1. Executar Query de Verificação

Execute o arquivo `verificar_multitenancy_completo.sql` no **Supabase SQL Editor**.

Esta query verificará:
- ✅ Se `stores.admin_id` existe
- ✅ Status do RLS em todas as tabelas principais
- ✅ Políticas RLS existentes
- ✅ Campos de multi-tenancy
- ✅ Dados órfãos (sem vinculação)

### 2. Analisar Resultados

Após executar a query, verifique:

#### ✅ Se `stores.admin_id` EXISTE:
- Sistema está no caminho certo
- Continue para verificar RLS

#### ❌ Se `stores.admin_id` NÃO EXISTE:
- **CRÍTICO:** Criar migration para adicionar a coluna
- Ver arquivo `CRIAR_ADMIN_ID_STORES.sql` (será criado se necessário)

### 3. Verificar RLS

Para cada tabela principal, verifique:
- ✅ RLS está habilitado?
- ✅ Há políticas para SELECT, INSERT, UPDATE, DELETE?
- ✅ Políticas usam `admin_id` ou `store_id` corretamente?

### 4. Verificar Campos de Multi-Tenancy

Para cada tabela, verifique se tem os campos necessários:
- `stores`: `admin_id` ✅
- `profiles`: `store_id`, `store_default` ✅
- `sales`: `store_id`, `colaboradora_id` ✅
- `goals`: `store_id`, `colaboradora_id` ✅
- `cashback_transactions`: `store_id`, `colaboradora_id` ✅
- `cashback_balance`: `store_id`, `colaboradora_id` ✅
- `tiny_orders`: `store_id`, `colaboradora_id` ✅
- `tiny_contacts`: `store_id` ✅
- `adiantamentos`: Verificar se tem `store_id` ou `colaboradora_id` ⚠️
- `compras`: Verificar se tem `loja_id` ou `colaboradora_id` ⚠️

## 🔧 Correções Necessárias (se aplicável)

### Se `stores.admin_id` não existir:

```sql
-- Migration: Adicionar admin_id a stores
ALTER TABLE sistemaretiradas.stores
ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_stores_admin_id ON sistemaretiradas.stores(admin_id);

-- Popular admin_id nas lojas existentes (ajustar conforme necessário)
-- UPDATE sistemaretiradas.stores SET admin_id = (SELECT id FROM sistemaretiradas.profiles WHERE role = 'ADMIN' LIMIT 1) WHERE admin_id IS NULL;
```

### Se RLS não estiver configurado:

Criar políticas RLS para cada tabela seguindo o padrão:

```sql
-- Exemplo para stores
ALTER TABLE sistemaretiradas.stores ENABLE ROW LEVEL SECURITY;

-- Admin pode ver suas lojas
CREATE POLICY "Admin pode ver suas lojas"
ON sistemaretiradas.stores
FOR SELECT
USING (
  admin_id = auth.uid()
);

-- Loja pode ver sua própria loja
CREATE POLICY "Loja pode ver sua loja"
ON sistemaretiradas.stores
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'LOJA'
    AND p.store_default = stores.id
  )
);
```

## 📊 Relatório Esperado

Após executar a verificação, você deve ter:

1. ✅ Confirmação de que `stores.admin_id` existe
2. ✅ Lista de tabelas com RLS habilitado
3. ✅ Contagem de políticas RLS por tabela
4. ✅ Verificação de campos de multi-tenancy
5. ✅ Identificação de dados órfãos (se houver)

## 🚨 Problemas Críticos

Se encontrar algum dos seguintes problemas, **corrija antes de considerar o sistema pronto**:

1. ❌ `stores.admin_id` não existe
2. ❌ RLS não habilitado em tabelas principais
3. ❌ Falta de políticas RLS que usam `admin_id` ou `store_id`
4. ❌ Dados órfãos (stores sem admin_id, sales sem store_id, etc.)

## ✅ Checklist Final

- [ ] `stores.admin_id` existe e está populado
- [ ] RLS habilitado em todas as tabelas principais
- [ ] Políticas RLS criadas para SELECT, INSERT, UPDATE, DELETE
- [ ] Políticas RLS usam `admin_id` ou `store_id` corretamente
- [ ] Todos os campos de multi-tenancy presentes
- [ ] Nenhum dado órfão encontrado
- [ ] Admin pode ver todas as suas lojas
- [ ] Loja pode ver todas as suas colaboradoras
- [ ] Colaboradora vê apenas seus dados

## 📝 Próximos Passos

1. Execute `verificar_multitenancy_completo.sql`
2. Analise os resultados
3. Se necessário, crie as migrations de correção
4. Execute as migrations
5. Re-execute a verificação para confirmar

