# Google My Business - Múltiplas Lojas e Contas Google

## 📊 Situação Atual

### Estrutura do Banco de Dados

1. **`elevea.google_credentials`**
   - PRIMARY KEY: `(customer_id, site_slug)`
   - **1 credencial Google por combinação de (customer_id, site_slug)**
   - Ou seja: Cada loja (site_slug) pode ter sua própria conta Google

2. **`elevea.google_business_accounts`**
   - UNIQUE: `(customer_id, site_slug, account_id, location_id)`
   - Armazena todas as locations de uma conta Google
   - **Todas as locations são associadas ao mesmo (customer_id, site_slug)**

### Cenários Suportados ✅

#### Cenário 1: Múltiplas Lojas → Múltiplas Contas Google
```
Loja A (site_slug: loja-a) → Conta Google 1
Loja B (site_slug: loja-b) → Conta Google 2
Loja C (site_slug: loja-c) → Conta Google 3
```
**Status:** ✅ **FUNCIONA** - Cada loja conecta sua própria conta Google

#### Cenário 2: 1 Conta Google → 1 Loja (com múltiplas locations)
```
Loja A (site_slug: loja-a) → Conta Google 1
  ├─ Location 1 (loja física 1)
  ├─ Location 2 (loja física 2)
  └─ Location 3 (loja física 3)
```
**Status:** ✅ **FUNCIONA** - Todas as locations são associadas à mesma loja

### Cenários NÃO Suportados ❌

#### Cenário 3: 1 Conta Google → Múltiplas Lojas (cada location em uma loja diferente)
```
Conta Google 1
  ├─ Location 1 → Loja A (site_slug: loja-a) ❌
  ├─ Location 2 → Loja B (site_slug: loja-b) ❌
  └─ Location 3 → Loja C (site_slug: loja-c) ❌
```
**Status:** ❌ **NÃO FUNCIONA** - Não há como mapear cada location para um site_slug diferente

---

## 🔧 Soluções Propostas

### Opção 1: Mapeamento Manual de Locations (Recomendado)

Permitir que o usuário selecione qual location de uma conta Google deve ser associada a qual loja.

**Como funcionaria:**
1. Admin conecta Conta Google 1 (que tem 3 locations)
2. Sistema salva todas as 3 locations em `google_business_accounts` temporariamente
3. Interface permite mapear:
   - Location 1 → Loja A (site_slug: loja-a)
   - Location 2 → Loja B (site_slug: loja-b)
   - Location 3 → Loja C (site_slug: loja-c)
4. Sistema cria 3 registros em `google_credentials` (um por loja) usando a mesma conta Google, mas filtrando por location_id

**Mudanças necessárias:**
- Modificar `google_credentials` para incluir `location_id` (opcional)
- Modificar lógica de busca de reviews para filtrar por location_id específica
- Interface para mapear locations → lojas

### Opção 2: Seleção de Loja no Início do OAuth

Permitir que o admin selecione qual loja está conectando antes de iniciar o OAuth.

**Como funcionaria:**
1. Interface mostra lista de lojas do admin
2. Admin seleciona qual loja quer conectar
3. OAuth é iniciado com `site_slug` específico
4. Após conexão, mostra todas as locations disponíveis
5. Admin escolhe qual location usar (ou todas)

**Mudanças necessárias:**
- Adicionar seletor de loja no componente `GoogleIntegration`
- Passar `site_slug` selecionado no `startAuth()`

### Opção 3: Múltiplas Conexões por Loja

Permitir que uma loja tenha múltiplas contas Google conectadas simultaneamente.

**Como funcionaria:**
- Remover PRIMARY KEY de `google_credentials`, usar ID único
- Permitir múltiplas credenciais por (customer_id, site_slug)
- Interface permite selecionar qual conta Google usar para cada operação

---

## 🎯 Recomendação

**Combinar Opção 1 + Opção 2:**

1. **Adicionar seletor de loja** no início (Opção 2)
   - Mais simples de implementar
   - Já resolve o caso de "3 lojas → 3 contas Google"

2. **Adicionar mapeamento de locations** (Opção 1) - Fase 2
   - Para o caso de "1 conta Google → múltiplas lojas"
   - Requer mais mudanças na estrutura

---

## 📝 Implementação - Fase 1 (Seletor de Loja)

### Mudanças Necessárias:

1. **Frontend: `GoogleIntegration.tsx`**
   - Buscar todas as lojas do admin
   - Adicionar seletor de loja
   - Passar `site_slug` selecionado para `startAuth()`

2. **Backend: `google-oauth-callback.js`**
   - Já recebe `siteSlug` no state - não precisa mudar

3. **Banco de Dados**
   - Nenhuma mudança necessária para esta fase

### Exemplo de Código:

```typescript
// GoogleIntegration.tsx
const [selectedStoreSlug, setSelectedStoreSlug] = useState<string>("");

useEffect(() => {
  const fetchStores = async () => {
    const { data: stores } = await supabase
      .schema("sistemaretiradas")
      .from("stores")
      .select("slug, name")
      .eq("admin_id", profile.id)
      .eq("active", true);
    
    if (stores && stores.length > 0) {
      setSelectedStoreSlug(stores[0].slug); // Primeira loja como padrão
    }
  };
  fetchStores();
}, [profile?.id]);

const handleConnect = async () => {
  if (!selectedStoreSlug) return;
  await startAuth(selectedStoreSlug);
};
```

---

## 🚧 Implementação - Fase 2 (Mapeamento de Locations)

Para suportar "1 conta Google → múltiplas lojas", seria necessário:

1. **Modificar `google_credentials`:**
   ```sql
   ALTER TABLE elevea.google_credentials
   ADD COLUMN location_id VARCHAR(255);
   
   -- Criar índice composto
   CREATE INDEX idx_google_credentials_location 
   ON elevea.google_credentials(customer_id, site_slug, location_id);
   ```

2. **Modificar lógica de busca de reviews:**
   - Filtrar por `location_id` específica quando houver

3. **Interface de mapeamento:**
   - Listar todas as locations disponíveis
   - Permitir associar cada location a uma loja diferente
   - Salvar múltiplas credenciais (uma por location/loja)

---

## ❓ Perguntas para Definir Escopo

1. **Cenário mais comum:**
   - Você tem 3 lojas separadas, cada uma com sua própria conta Google? → **Opção 2 resolve**
   - Você tem 1 conta Google com 3 locations físicas que quer mapear para 3 lojas diferentes? → **Precisa Opção 1**

2. **Comportamento esperado:**
   - Reviews de uma location devem aparecer apenas na loja mapeada?
   - Ou reviews de todas as locations aparecem em todas as lojas?

3. **Prioridade:**
   - Qual cenário é mais crítico para implementar primeiro?

