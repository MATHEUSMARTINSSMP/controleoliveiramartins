# 🏢 Como Funciona a Criação de Novos Tenants

## 📊 Estrutura Atual (Oliveira Martins)

```
sistemaretiradas (schema atual)
├── tenants (tabela de controle)
│   └── oliveira-martins (schema_name = NULL → usa sistemaretiradas)
│
├── profiles (dados do Oliveira Martins)
├── stores (dados do Oliveira Martins)
├── sales (dados do Oliveira Martins)
└── ... (todas as outras tabelas)
```

## 🆕 Quando Criar um Novo Tenant (ex: "Empresa ABC")

### Passo 1: Criar o Tenant

```sql
SELECT create_tenant_schema('empresa-abc', 'Empresa ABC');
```

### Passo 2: O que acontece automaticamente:

1. **Cria entrada na tabela `tenants`:**
   ```sql
   INSERT INTO tenants (name, slug, schema_name)
   VALUES ('Empresa ABC', 'empresa-abc', 'tenant_empresa_abc');
   ```

2. **Cria novo schema:** `tenant_empresa_abc`

3. **Copia estrutura de TODAS as tabelas** (mas vazio, sem dados):
   ```
   tenant_empresa_abc (NOVO schema - estrutura idêntica)
   ├── profiles (mesma estrutura, vazio)
   ├── stores (mesma estrutura, vazio)
   ├── sales (mesma estrutura, vazio)
   ├── goals (mesma estrutura, vazio)
   ├── cashback_balance (mesma estrutura, vazio)
   ├── tiny_api_credentials (mesma estrutura, vazio)
   └── ... (TODAS as outras tabelas com mesma estrutura)
   ```

## ✅ Garantias

### 1. **Mesmas Tabelas:**
- ✅ Todas as tabelas do `sistemaretiradas` são copiadas
- ✅ Lista completa: profiles, stores, sales, goals, day_weights, purchases, parcelas, adiantamentos, bonuses, bonus_collaborators, store_benchmarks, collaborator_off_days, weekly_goals, whatsapp_notification_config, cashback_balance, cashback_transactions, cashback_rules, tiny_api_credentials

### 2. **Mesmas Colunas:**
- ✅ Usa `CREATE TABLE ... LIKE ... INCLUDING ALL`
- ✅ Copia todas as colunas, tipos, constraints, defaults
- ✅ Copia índices, foreign keys, etc.

### 3. **Dados Isolados:**
- ✅ Cada tenant tem seus próprios dados
- ✅ Zero risco de vazamento entre tenants
- ✅ Backup/restore independente por tenant

## 📝 Exemplo Prático

### Cenário: Criar tenant "Loja XYZ"

```sql
-- 1. Criar tenant
SELECT create_tenant_schema('loja-xyz', 'Loja XYZ');
-- Resultado: Cria schema tenant_loja_xyz com todas as tabelas vazias

-- 2. Criar usuário admin para este tenant
INSERT INTO tenant_loja_xyz.profiles (id, name, email, role, active)
VALUES (gen_random_uuid(), 'Admin Loja XYZ', 'admin@lojaxyz.com', 'ADMIN', true);

-- 3. Criar loja
INSERT INTO tenant_loja_xyz.stores (id, name, active)
VALUES (gen_random_uuid(), 'Loja XYZ - Matriz', true);

-- 4. Criar colaboradora
INSERT INTO tenant_loja_xyz.profiles (id, name, email, role, store_id, active)
VALUES (gen_random_uuid(), 'Maria Silva', 'maria@lojaxyz.com', 'COLABORADORA', 'store-id-aqui', true);
```

## 🔄 Fluxo de Dados

### Para Oliveira Martins (tenant padrão):
```
Usuário faz login
  ↓
Sistema identifica: schema_name = NULL
  ↓
Usa schema: sistemaretiradas
  ↓
Dados salvos em: sistemaretiradas.profiles, sistemaretiradas.sales, etc.
```

### Para Novo Tenant (ex: Empresa ABC):
```
Usuário faz login
  ↓
Sistema identifica: schema_name = 'tenant_empresa_abc'
  ↓
Usa schema: tenant_empresa_abc
  ↓
Dados salvos em: tenant_empresa_abc.profiles, tenant_empresa_abc.sales, etc.
```

## 🎯 Resumo

| Aspecto | Oliveira Martins (Atual) | Novo Tenant (Futuro) |
|---------|-------------------------|---------------------|
| **Schema** | `sistemaretiradas` | `tenant_empresa_abc` |
| **Tabelas** | Todas existentes | Todas copiadas (mesmas) |
| **Colunas** | Todas existentes | Todas copiadas (mesmas) |
| **Dados** | Dados atuais | Vazio (começa do zero) |
| **Isolamento** | Usa schema padrão | Schema separado |

## ✅ Vantagens

1. **Estrutura Idêntica:**
   - Todos os tenants têm exatamente as mesmas tabelas
   - Mesmas colunas, tipos, constraints
   - Código frontend funciona igual para todos

2. **Isolamento Total:**
   - Cada tenant é completamente independente
   - Zero risco de vazamento de dados
   - Backup/restore por tenant

3. **Escalabilidade:**
   - Fácil criar novos tenants
   - Cada tenant pode ter milhões de registros
   - Performance não é afetada entre tenants

4. **Manutenção:**
   - Se precisar adicionar nova tabela, adiciona em todos os schemas
   - Ou cria migration que replica para todos os tenants

## 🛠️ Manutenção de Estrutura

### Se precisar adicionar nova tabela no futuro:

```sql
-- 1. Criar no sistemaretiradas (padrão)
CREATE TABLE sistemaretiradas.nova_tabela (...);

-- 2. Replicar para todos os tenants
DO $$
DECLARE
    v_tenant RECORD;
BEGIN
    FOR v_tenant IN 
        SELECT schema_name FROM tenants 
        WHERE schema_name IS NOT NULL 
        AND schema_name != 'sistemaretiradas'
    LOOP
        EXECUTE format('
            CREATE TABLE %I.nova_tabela (LIKE sistemaretiradas.nova_tabela INCLUDING ALL)
        ', v_tenant.schema_name);
    END LOOP;
END;
$$;
```

---

**Resumindo: Sim, novos tenants terão seu próprio schema com exatamente as mesmas tabelas e colunas! 🎯**

