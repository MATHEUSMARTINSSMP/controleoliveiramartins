# Análise de Multi-Tenancy - Status Atual

## 📋 Resumo Executivo

Este documento analisa se o sistema está **100% pronto para multi-tenancy** conforme os requisitos:
- ✅ Admin tem acesso a todas as suas lojas
- ✅ Lojas têm acesso a todas as suas colaboradoras  
- ✅ Colaboradoras têm acesso apenas aos seus dados
- ✅ Usuários podem ter várias lojas vinculadas

## 🔍 Verificações Necessárias

### 1. Estrutura da Tabela `stores`

**Status:** ⚠️ **VERIFICAR**

As migrations de RLS fazem referência a `stores.admin_id`, mas **não encontramos uma migration explícita que cria ou adiciona essa coluna**.

**Ação necessária:**
- Verificar se a coluna `admin_id` existe na tabela `stores`
- Se não existir, criar migration para adicionar:
  ```sql
  ALTER TABLE sistemaretiradas.stores
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE;
  
  CREATE INDEX IF NOT EXISTS idx_stores_admin_id ON sistemaretiradas.stores(admin_id);
  ```

### 2. Políticas RLS (Row Level Security)

**Status:** ✅ **PARCIALMENTE IMPLEMENTADO**

#### Tabelas com RLS configurado:
- ✅ `goals` - Políticas que usam `admin_id` via `stores.admin_id = auth.uid()`
- ✅ `cashback_transactions` - Políticas para ADMIN e LOJA
- ✅ `cashback_balance` - Políticas para ADMIN e LOJA
- ✅ `tiny_orders` - Política para ADMIN deletar
- ✅ `app_config` - Políticas para ADMIN

#### Tabelas que precisam verificar RLS:
- ⚠️ `stores` - Precisa verificar se há políticas que permitem admin ver apenas suas lojas
- ⚠️ `profiles` - Precisa verificar se há políticas que permitem:
  - Admin ver perfis de suas lojas
  - Loja ver perfis de sua loja
  - Colaboradora ver apenas seu próprio perfil
- ⚠️ `sales` - Precisa verificar se há políticas que usam `store_id` ou `admin_id`
- ⚠️ `tiny_contacts` - Precisa verificar se há políticas que usam `store_id`
- ⚠️ `adiantamentos` - Precisa verificar se há políticas que usam `colaboradora_id` ou `store_id`
- ⚠️ `compras` - Precisa verificar se há políticas que usam `loja_id` ou `colaboradora_id`

### 3. Campos de Multi-Tenancy nas Tabelas

**Status:** ✅ **PARCIALMENTE IMPLEMENTADO**

#### Tabelas com campos corretos:
- ✅ `stores` - Deve ter `admin_id` (verificar se existe)
- ✅ `profiles` - Tem `store_id` e `store_default`
- ✅ `sales` - Tem `store_id` e `colaboradora_id`
- ✅ `goals` - Tem `store_id` e `colaboradora_id`
- ✅ `cashback_transactions` - Tem `store_id` e `colaboradora_id` (adicionado em migration recente)
- ✅ `cashback_balance` - Tem `store_id` e `colaboradora_id` (adicionado em migration recente)
- ✅ `tiny_orders` - Tem `store_id` e `colaboradora_id`
- ✅ `tiny_contacts` - Tem `store_id`

#### Tabelas que precisam verificar:
- ⚠️ `adiantamentos` - Verificar se tem `store_id` ou `colaboradora_id`
- ⚠️ `compras` - Verificar se tem `loja_id` ou `colaboradora_id`

### 4. Relacionamentos Admin-Loja-Colaboradora

**Status:** ✅ **ESTRUTURA CORRETA**

A estrutura de relacionamento está correta:
- Admin → Stores (via `stores.admin_id`)
- Store → Colaboradoras (via `profiles.store_id`)
- Colaboradora → Dados próprios (via `colaboradora_id` em várias tabelas)

**Problema potencial:**
- Se `stores.admin_id` não existir, o relacionamento Admin → Stores não funcionará

### 5. Políticas RLS que Usam `admin_id`

**Status:** ✅ **IMPLEMENTADO (PARCIALMENTE)**

As políticas RLS em `goals` usam:
```sql
EXISTS (
  SELECT 1 FROM sistemaretiradas.stores s
  WHERE s.id = goals.store_id
  AND s.admin_id = auth.uid()
)
```

Isso está correto, mas **depende de `stores.admin_id` existir**.

## 🚨 Problemas Identificados

### Crítico:
1. **`stores.admin_id` pode não existir** - Todas as políticas RLS que verificam acesso de admin dependem desta coluna

### Importante:
2. **RLS pode não estar configurado em todas as tabelas principais** - Precisa verificar:
   - `stores`
   - `profiles`
   - `sales`
   - `tiny_contacts`
   - `adiantamentos`
   - `compras`

3. **Algumas tabelas podem não ter campos de multi-tenancy** - Verificar:
   - `adiantamentos` - Precisa `store_id`?
   - `compras` - Precisa `loja_id` ou `colaboradora_id`?

## ✅ Próximos Passos

1. **Executar `verificar_multitenancy_completo.sql`** no Supabase SQL Editor para verificar:
   - Se `stores.admin_id` existe
   - Status do RLS em todas as tabelas
   - Políticas RLS existentes
   - Dados órfãos (sem vinculação)

2. **Se `stores.admin_id` não existir:**
   - Criar migration para adicionar a coluna
   - Popular `admin_id` nas lojas existentes (se possível)
   - Criar índice

3. **Se RLS não estiver configurado:**
   - Criar políticas RLS para todas as tabelas principais
   - Garantir que políticas usem `admin_id` ou `store_id` corretamente

4. **Se campos de multi-tenancy faltarem:**
   - Adicionar campos necessários
   - Popular dados existentes
   - Atualizar RLS para usar os novos campos

## 📝 Queries de Verificação

Execute as queries em `verificar_multitenancy_completo.sql` para obter um relatório completo do status atual.

## 🎯 Conclusão

O sistema está **parcialmente pronto** para multi-tenancy, mas precisa de verificações e possíveis correções:

1. ✅ Estrutura de relacionamento está correta
2. ⚠️ `stores.admin_id` precisa ser verificado/criado
3. ⚠️ RLS precisa ser verificado em todas as tabelas
4. ⚠️ Algumas tabelas podem precisar de campos de multi-tenancy

**Recomendação:** Execute as queries de verificação primeiro para identificar exatamente o que está faltando.

