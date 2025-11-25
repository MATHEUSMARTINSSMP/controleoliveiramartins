# 🏢 Análise e Plano de Implementação - Multi-Tenancy

## 📋 Visão Geral

Multi-tenancy permite que múltiplas empresas/clientes usem o mesmo sistema, cada um com seus dados completamente isolados. Cada tenant teria:
- Suas próprias lojas
- Suas próprias colaboradoras
- Seus próprios dados de vendas
- Sua própria integração com Tiny ERP
- Seus próprios dashboards e configurações

---

## 🎯 Modelos de Multi-Tenancy

### 1. **Shared Database, Shared Schema** (Atual - Não é Multi-Tenancy)
- Todos os dados na mesma tabela
- Separação por `store_id` ou similar
- ❌ **Não é verdadeiro multi-tenancy**

### 2. **Shared Database, Separate Schemas** (Recomendado para nosso caso)
- Um schema por tenant no mesmo banco
- Exemplo: `tenant_empresa1`, `tenant_empresa2`
- ✅ **Isolamento completo**
- ✅ **Fácil backup/restore por tenant**
- ✅ **Performance boa**

### 3. **Separate Databases** (Mais complexo)
- Um banco de dados por tenant
- ✅ **Máximo isolamento**
- ❌ **Complexidade alta**
- ❌ **Custo maior**

### 4. **Shared Database, Tenant ID Column** (Mais simples, menos seguro)
- Tabela `tenants` + coluna `tenant_id` em todas as tabelas
- ✅ **Implementação mais simples**
- ⚠️ **Risco de vazamento de dados se RLS falhar**

---

## 🏗️ Arquitetura Recomendada: **Shared Database, Separate Schemas**

### Estrutura Proposta:

```
sistemaretiradas (schema público)
├── tenants (tabela de controle)
│   ├── id
│   ├── name
│   ├── slug (ex: "oliveira-martins")
│   ├── schema_name (ex: "tenant_oliveira_martins")
│   └── active
│
└── tenant_oliveira_martins (schema do tenant)
    ├── profiles
    ├── stores
    ├── sales
    ├── goals
    ├── cashback_balance
    ├── tiny_api_credentials
    └── ... (todas as outras tabelas)
```

---

## 📊 Impacto nas Tabelas Existentes

### Tabelas que precisam de mudança:

1. **`profiles`** → Adicionar `tenant_id` OU mover para schema do tenant
2. **`stores`** → Adicionar `tenant_id` OU mover para schema do tenant
3. **`sales`** → Adicionar `tenant_id` OU mover para schema do tenant
4. **`goals`** → Adicionar `tenant_id` OU mover para schema do tenant
5. **Todas as outras tabelas** → Mesma lógica

### Tabela de Controle:

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE, -- Ex: "oliveira-martins"
    schema_name TEXT NOT NULL UNIQUE, -- Ex: "tenant_oliveira_martins"
    admin_user_id UUID, -- ID do usuário admin do tenant
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔐 Autenticação Multi-Tenant

### Opção 1: Subdomínio (Recomendado)
```
oliveira-martins.eleveaone.com.br → Tenant "oliveira-martins"
empresa2.eleveaone.com.br → Tenant "empresa2"
```

### Opção 2: Path-based
```
eleveaone.com.br/oliveira-martins → Tenant "oliveira-martins"
eleveaone.com.br/empresa2 → Tenant "empresa2"
```

### Opção 3: Seleção Manual
```
eleveaone.com.br/login → Usuário escolhe empresa após login
```

---

## 🛠️ Implementação Técnica

### 1. Migration para Criar Estrutura Multi-Tenant

```sql
-- =============================================================================
-- MIGRATION: Multi-Tenancy Setup
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- 1. Criar tabela de tenants
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    schema_name TEXT NOT NULL UNIQUE,
    admin_user_id UUID,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Função para criar schema de tenant
CREATE OR REPLACE FUNCTION create_tenant_schema(
    p_tenant_slug TEXT,
    p_tenant_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_schema_name TEXT;
BEGIN
    -- Gerar schema name
    v_schema_name := 'tenant_' || lower(regexp_replace(p_tenant_slug, '[^a-z0-9]', '_', 'g'));
    
    -- Criar tenant
    INSERT INTO tenants (name, slug, schema_name)
    VALUES (p_tenant_name, p_tenant_slug, v_schema_name)
    RETURNING id INTO v_tenant_id;
    
    -- Criar schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema_name);
    
    -- Copiar estrutura de tabelas para o schema do tenant
    -- (Isso precisa ser feito manualmente ou via script)
    
    RETURN v_tenant_id;
END;
$$;

-- 3. Função para obter schema do tenant atual
CREATE OR REPLACE FUNCTION get_tenant_schema()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_schema_name TEXT;
BEGIN
    -- Buscar schema do tenant baseado no usuário logado
    SELECT t.schema_name INTO v_schema_name
    FROM tenants t
    JOIN profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid();
    
    RETURN COALESCE(v_schema_name, 'sistemaretiradas');
END;
$$;
```

### 2. Modificar AuthContext para Suportar Multi-Tenancy

```typescript
// src/contexts/AuthContext.tsx

interface Profile {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "LOJA" | "COLABORADORA";
  tenant_id: string; // NOVO
  tenant_slug: string; // NOVO
  // ... outros campos
}

// Ao fazer login, identificar tenant
// Opção 1: Por subdomínio
const getTenantFromSubdomain = () => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return parts[0]; // "oliveira-martins" de "oliveira-martins.eleveaone.com.br"
  }
  return null;
};

// Opção 2: Por path
const getTenantFromPath = () => {
  const path = window.location.pathname;
  const match = path.match(/^\/([^\/]+)/);
  return match ? match[1] : null;
};
```

### 3. Modificar Supabase Client para Usar Schema do Tenant

```typescript
// src/integrations/supabase/client.ts

export const getSupabaseClient = (tenantSchema?: string) => {
  const schema = tenantSchema || 'sistemaretiradas';
  
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    db: {
      schema: schema, // Schema dinâmico baseado no tenant
    },
    global: {
      headers: {
        'Accept-Profile': schema,
        'Content-Profile': schema,
      },
    },
  });
};
```

---

## 🔄 Migração de Dados Existentes

### Estratégia de Migração:

1. **Criar tenant padrão** (ex: "oliveira-martins")
2. **Criar schema do tenant** (`tenant_oliveira_martins`)
3. **Copiar todas as tabelas** do schema `sistemaretiradas` para o schema do tenant
4. **Migrar dados** existentes
5. **Atualizar RLS** para usar schema do tenant
6. **Testar** tudo funcionando
7. **Remover dados** do schema antigo (após validação)

---

## 🎯 Integração com Tiny ERP (Multi-Tenant)

### Cada Tenant tem seu próprio Tiny ERP:

```sql
-- Tabela tiny_api_credentials agora é por tenant
-- Cada tenant tem suas próprias credenciais

CREATE TABLE tenant_oliveira_martins.tiny_api_credentials (
    -- mesma estrutura, mas isolada por tenant
);
```

### Fluxo de Autenticação:

1. Usuário faz login → Identifica tenant
2. Sistema carrega credenciais do Tiny do tenant específico
3. Todas as chamadas de API usam as credenciais do tenant

---

## 📋 Checklist de Implementação

### Fase 1: Preparação
- [ ] Criar tabela `tenants`
- [ ] Criar funções auxiliares (create_tenant_schema, get_tenant_schema)
- [ ] Documentar estratégia de migração

### Fase 2: Estrutura Multi-Tenant
- [ ] Criar função para criar schema de tenant dinamicamente
- [ ] Criar script para copiar estrutura de tabelas
- [ ] Criar tenant padrão com dados existentes

### Fase 3: Autenticação
- [ ] Modificar AuthContext para identificar tenant
- [ ] Implementar detecção de tenant (subdomínio/path)
- [ ] Modificar Supabase client para usar schema dinâmico

### Fase 4: RLS Multi-Tenant
- [ ] Atualizar todas as políticas RLS para considerar tenant
- [ ] Testar isolamento de dados entre tenants

### Fase 5: UI/UX
- [ ] Adicionar seletor de tenant (se necessário)
- [ ] Atualizar todas as queries para usar schema do tenant
- [ ] Testar todos os fluxos

### Fase 6: Migração de Dados
- [ ] Criar tenant padrão
- [ ] Migrar dados existentes
- [ ] Validar integridade
- [ ] Remover dados antigos (após validação)

---

## ⚠️ Considerações Importantes

### Segurança:
- ✅ **RLS deve garantir isolamento** entre tenants
- ✅ **Nunca permitir acesso cross-tenant**
- ✅ **Validar tenant em todas as queries**

### Performance:
- ⚠️ **Índices por tenant** podem ser necessários
- ⚠️ **Connection pooling** precisa considerar multi-tenant
- ⚠️ **Cache** precisa ser isolado por tenant

### Backup/Restore:
- ✅ **Backup por tenant** é mais fácil com schemas separados
- ✅ **Restore de um tenant** não afeta outros

### Escalabilidade:
- ✅ **Fácil adicionar novos tenants**
- ✅ **Fácil remover tenants inativos**
- ✅ **Cada tenant pode ter configurações diferentes**

---

## 💡 Alternativa Mais Simples: Tenant ID Column

Se multi-tenancy completo for muito complexo agora, podemos começar com:

### Estrutura Simplificada:

```sql
-- Adicionar tenant_id em todas as tabelas
ALTER TABLE profiles ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE stores ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE sales ADD COLUMN tenant_id UUID REFERENCES tenants(id);
-- ... etc

-- RLS garante isolamento
CREATE POLICY "tenant_isolation" ON profiles
    FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
```

**Vantagens:**
- ✅ Implementação mais rápida
- ✅ Menos mudanças no código
- ✅ Fácil migração futura para schemas separados

**Desvantagens:**
- ⚠️ Risco de vazamento se RLS falhar
- ⚠️ Queries mais complexas (sempre filtrar por tenant_id)

---

## 🎯 Recomendação

### Para Começar (Fase 1):
**Usar Tenant ID Column** - Mais simples, implementação rápida

### Para Escalar (Fase 2):
**Migrar para Separate Schemas** - Máximo isolamento e segurança

---

## ❓ Perguntas para Decidir:

1. **Quantos tenants você espera ter?**
   - Poucos (< 10): Tenant ID Column é suficiente
   - Muitos (> 50): Separate Schemas é melhor

2. **Cada tenant terá seu próprio Tiny ERP?**
   - Sim: Precisa de isolamento completo
   - Não: Pode compartilhar

3. **Precisa de isolamento legal/compliance?**
   - Sim: Separate Schemas é obrigatório
   - Não: Tenant ID Column pode ser suficiente

4. **Orçamento para infraestrutura?**
   - Limitado: Tenant ID Column
   - Flexível: Separate Schemas

---

**Qual modelo você prefere? Posso começar a implementar! 🚀**

