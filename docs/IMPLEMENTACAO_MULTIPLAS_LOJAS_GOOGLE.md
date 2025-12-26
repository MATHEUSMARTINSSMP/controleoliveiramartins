# Implementação: Múltiplas Lojas e Contas Google

## ✅ Implementado

### 1. Migration do Banco de Dados
**Arquivo:** `supabase/migrations/20251227000001_add_location_id_to_google_credentials.sql`

- Adicionada coluna `location_id` opcional em `google_credentials`
- Permite mapear uma location específica do Google para uma loja
- Suporta cenário: 1 conta Google → múltiplas lojas (cada location → uma loja)

### 2. Seletor de Loja
**Arquivo:** `src/pages/admin/GoogleIntegration.tsx`

- Adicionado seletor de loja antes de conectar conta Google
- Permite escolher qual loja está conectando antes de iniciar OAuth
- Suporta cenário: múltiplas lojas → múltiplas contas Google (uma por loja)

### 3. Componente de Mapeamento de Locations
**Arquivo:** `src/components/google-integration/LocationMapping.tsx`

- Interface para mapear locations do Google para lojas
- Aparece quando há múltiplas locations na conta Google
- Permite associar cada location a uma loja diferente
- Cria credenciais separadas para cada loja com `location_id` específico

### 4. Filtro por Location ID no Backend
**Arquivo:** `netlify/functions/google-reviews-fetch.js`

- Modificado para buscar `location_id` da credencial
- Filtra locations por `location_id` quando definido
- Reviews são filtrados pela location específica da loja

### 5. Atualização do Callback OAuth
**Arquivo:** `netlify/functions/google-oauth-callback.js`

- Redirecionamento corrigido para `/admin/marketing` (em vez de `/client/dashboard`)
- Já salva todas as locations automaticamente
- Suporta ambos os cenários (múltiplas contas ou 1 conta com múltiplas locations)

## 🎯 Cenários Suportados

### Cenário 1: Múltiplas Lojas → Múltiplas Contas Google ✅
```
Loja A → Conecta Conta Google 1
Loja B → Conecta Conta Google 2
Loja C → Conecta Conta Google 3
```
**Como usar:**
1. Selecione a loja desejada no seletor
2. Clique em "Conectar com Google"
3. Repita para cada loja com sua respectiva conta Google

### Cenário 2: 1 Conta Google → 1 Loja (com múltiplas locations) ✅
```
Loja A → Conta Google 1
  ├─ Location 1
  ├─ Location 2
  └─ Location 3
```
**Como usar:**
1. Selecione a loja desejada
2. Conecte a conta Google
3. Todas as locations aparecerão (comportamento padrão)

### Cenário 3: 1 Conta Google → Múltiplas Lojas (cada location → uma loja) ✅
```
Conta Google 1 (tem 3 locations)
  ├─ Location 1 → Loja A
  ├─ Location 2 → Loja B
  └─ Location 3 → Loja C
```
**Como usar:**
1. Conecte a conta Google para a primeira loja (selecione qualquer loja)
2. Após conexão, o componente "Mapear Locations para Lojas" aparecerá
3. Associe cada location a uma loja diferente
4. Reviews de cada location aparecerão apenas na loja mapeada

## 📋 Estrutura do Banco de Dados

### `elevea.google_credentials`
```sql
customer_id VARCHAR(255)
site_slug VARCHAR(255)
location_id VARCHAR(255) -- NOVO: Opcional, para mapear location específica
access_token TEXT
refresh_token TEXT
...
PRIMARY KEY (customer_id, site_slug)
```

### `elevea.google_business_accounts`
```sql
customer_id VARCHAR(255)
site_slug VARCHAR(255)
account_id VARCHAR(255)
location_id VARCHAR(255)
...
UNIQUE (customer_id, site_slug, account_id, location_id)
```

## 🔄 Fluxo de Mapeamento

1. **Admin conecta conta Google** → Salva credencial em `google_credentials` (sem `location_id`)
2. **Sistema busca todas as locations** → Salva em `google_business_accounts`
3. **Se há múltiplas locations** → Mostra componente `LocationMapping`
4. **Admin mapeia locations** → Cria credenciais adicionais em `google_credentials` (uma por loja, com `location_id`)
5. **Reviews são filtrados** → Por `location_id` quando definido na credencial

## ⚠️ Notas Importantes

1. **Schema das tabelas:** As tabelas do Google estão no schema `elevea`, não `sistemaretiradas`
2. **Backward compatibility:** Credenciais existentes (sem `location_id`) continuam funcionando
3. **Múltiplas credenciais:** Uma conta Google pode ter múltiplas credenciais (uma por loja mapeada)
4. **Location principal:** A primeira credencial (sem `location_id`) serve como "base" para criar as outras

## 🚀 Próximos Passos (Opcional)

- [ ] Corrigir schema nas queries do frontend (alguns hooks ainda usam `sistemaretiradas` em vez de `elevea`)
- [ ] Adicionar interface para visualizar/editar mapeamentos existentes
- [ ] Adicionar validação para evitar mapear mesma location para múltiplas lojas
- [ ] Adicionar indicador visual de qual location está ativa em cada loja

