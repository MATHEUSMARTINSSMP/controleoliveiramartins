# 📋 Plano de Migração para Multi-Tenancy

## 🎯 Objetivo

Migrar o sistema atual (single-tenant) para multi-tenancy usando **Separate Schemas**, onde cada empresa/cliente terá seu próprio schema isolado.

---

## 📊 Estrutura Atual vs Nova

### Atual (Single-Tenant):
```
sistemaretiradas (schema único)
├── profiles
├── stores
├── sales
└── ... (todas as tabelas)
```

### Nova (Multi-Tenant):
```
sistemaretiradas (schema público - apenas controle)
├── tenants (tabela de controle)

tenant_oliveira_martins (schema do tenant)
├── profiles
├── stores
├── sales
└── ... (todas as tabelas)

tenant_empresa2 (schema do tenant 2)
├── profiles
├── stores
├── sales
└── ... (todas as tabelas)
```

---

## 🚀 Passos de Migração

### FASE 1: Preparação ✅
- [x] Criar migration de estrutura multi-tenant
- [x] Criar tabela `tenants`
- [x] Criar funções auxiliares

### FASE 2: Criar Tenant Padrão
- [ ] Executar migration `20250127020000_create_multi_tenancy_structure.sql`
- [ ] Verificar se o tenant "oliveira-martins" foi criado
- [ ] Verificar se o schema `tenant_oliveira_martins` foi criado

### FASE 3: Migrar Dados Existentes
- [ ] Executar função `migrate_data_to_tenant('tenant_oliveira_martins')`
- [ ] Validar integridade dos dados migrados
- [ ] Verificar contagens (profiles, stores, sales, etc.)

### FASE 4: Atualizar Código Frontend
- [ ] Modificar `AuthContext` para identificar tenant
- [ ] Modificar `supabase/client.ts` para usar schema dinâmico
- [ ] Atualizar todas as queries para usar schema do tenant

### FASE 5: Atualizar RLS
- [ ] Recriar políticas RLS no schema do tenant
- [ ] Testar isolamento de dados
- [ ] Garantir que usuários só veem dados do seu tenant

### FASE 6: Testes
- [ ] Testar login e autenticação
- [ ] Testar todas as funcionalidades principais
- [ ] Testar isolamento entre tenants (se houver múltiplos)

### FASE 7: Limpeza (Opcional)
- [ ] Após validação completa, remover dados do schema antigo
- [ ] Manter apenas estrutura vazia no `sistemaretiradas` se necessário

---

## 🔧 Comandos SQL para Executar

### 1. Executar Migration Base
```sql
-- Já está no arquivo de migration
-- Execute no Supabase SQL Editor
```

### 2. Verificar Tenant Criado
```sql
SELECT * FROM sistemaretiradas.tenants;
```

### 3. Verificar Schema Criado
```sql
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name LIKE 'tenant_%';
```

### 4. Migrar Dados (CUIDADO - Execute apenas uma vez!)
```sql
SELECT migrate_data_to_tenant('tenant_oliveira_martins');
```

### 5. Validar Migração
```sql
-- Comparar contagens
SELECT 
    'sistemaretiradas' as schema,
    (SELECT COUNT(*) FROM sistemaretiradas.profiles) as profiles,
    (SELECT COUNT(*) FROM sistemaretiradas.stores) as stores,
    (SELECT COUNT(*) FROM sistemaretiradas.sales) as sales
UNION ALL
SELECT 
    'tenant_oliveira_martins' as schema,
    (SELECT COUNT(*) FROM tenant_oliveira_martins.profiles) as profiles,
    (SELECT COUNT(*) FROM tenant_oliveira_martins.stores) as stores,
    (SELECT COUNT(*) FROM tenant_oliveira_martins.sales) as sales;
```

---

## ⚠️ Pontos de Atenção

### 1. RLS Policies
- As políticas RLS precisam ser recriadas no schema do tenant
- Cada tenant terá suas próprias políticas
- Garantir que políticas não permitam acesso cross-tenant

### 2. Foreign Keys
- Foreign keys entre tabelas do mesmo tenant funcionam normalmente
- Foreign keys para tabelas do schema público precisam ser ajustadas

### 3. Funções e Triggers
- Funções e triggers precisam ser recriados no schema do tenant
- Ou ajustados para usar schema dinâmico

### 4. Índices
- Índices são copiados automaticamente com `INCLUDING ALL`
- Verificar se todos os índices necessários existem

---

## 🧪 Testes Pós-Migração

### Teste 1: Login
- [ ] Fazer login com usuário existente
- [ ] Verificar se o sistema identifica o tenant corretamente
- [ ] Verificar se os dados são carregados do schema correto

### Teste 2: Funcionalidades Principais
- [ ] Dashboard Admin
- [ ] Dashboard Loja
- [ ] Dashboard Colaboradora
- [ ] Gestão de Metas
- [ ] Gestão de Bônus
- [ ] Vendas
- [ ] Adiantamentos

### Teste 3: Isolamento
- [ ] Criar segundo tenant de teste
- [ ] Verificar que dados não se misturam
- [ ] Verificar que RLS funciona corretamente

---

## 📝 Checklist Final

- [ ] Migration executada com sucesso
- [ ] Tenant padrão criado
- [ ] Dados migrados e validados
- [ ] Código frontend atualizado
- [ ] RLS policies recriadas
- [ ] Todos os testes passando
- [ ] Documentação atualizada

---

## 🆘 Rollback (Se necessário)

Se algo der errado, você pode:

1. **Manter dados no schema antigo** (não deletar durante migração)
2. **Reverter código** para usar `sistemaretiradas` como schema fixo
3. **Remover tenant** se necessário:
   ```sql
   DROP SCHEMA IF EXISTS tenant_oliveira_martins CASCADE;
   DELETE FROM sistemaretiradas.tenants WHERE slug = 'oliveira-martins';
   ```

---

**Pronto para começar a migração? 🚀**

