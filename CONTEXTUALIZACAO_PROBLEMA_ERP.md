# 📋 CONTEXTUALIZAÇÃO COMPLETA DO PROBLEMA - INTEGRAÇÃO TINY ERP

## 🎯 OBJETIVO DO SISTEMA

Estamos implementando uma integração com o **Tiny ERP v3** para sincronizar dados de **pedidos (vendas)** e **clientes** de lojas físicas. O sistema deve:
1. Buscar pedidos finalizados (status "faturado") do Tiny ERP
2. Buscar dados de clientes
3. Salvar esses dados no nosso banco Supabase
4. Exibir os dados em uma interface web

---

## 🔍 PROBLEMA ATUAL

**Os dados não estão sendo exibidos corretamente na interface:**
- ❌ **Valor Total (valor_total)**: Todos os pedidos aparecem como **R$ 0,00** na tabela
- ❌ **Data do Pedido (data_pedido)**: Todos aparecem como **"-"** (vazio)
- ❌ **CPF/CNPJ do Cliente (cliente_cpf_cnpj)**: Aparece como **"-"** (vazio)
- ❌ **Data de Nascimento (data_nascimento)**: Aparece como **"-"** (vazio)

**Porém, nos logs do console vemos:**
- ✅ Os dados **ESTÃO sendo encontrados** na API do Tiny ERP
- ✅ Os valores **ESTÃO sendo parseados** corretamente (ex: `valor: "598"`, `valor: "868"`)
- ✅ As datas **ESTÃO sendo encontradas** (ex: `data: "2025-11-25"`, `data: "2025-11-23"`)
- ✅ Os CPFs **ESTÃO sendo encontrados** (ex: `CPF/CNPJ do cliente encontrado: 518***`, `671***`)

**O problema parece estar em uma das seguintes etapas:**
1. Os dados não estão sendo salvos corretamente no banco de dados
2. Os dados estão sendo salvos, mas não estão sendo recuperados corretamente na leitura
3. Há um problema de tipo de dado (DECIMAL vs number vs string)

---

## 📥 COMO OS DADOS CHEGAM DA API DO TINY ERP

### 1. Endpoint e Autenticação

**Endpoint:** `GET /pedidos` (Tiny ERP API v3)
**Autenticação:** OAuth 2.0 (access_token armazenado em `erp_integrations`)

**Fluxo:**
```
Frontend → Netlify Function Proxy (/.netlify/functions/erp-api-proxy) → Tiny ERP API
```

**Arquivo:** `src/lib/erpIntegrations.ts`
- Função `callERPAPI()` faz a requisição via proxy (para evitar CORS)
- Proxy busca `access_token` do banco (`erp_integrations` table)
- Proxy faz requisição real para Tiny ERP

### 2. Estrutura da Resposta da API Tiny ERP v3

A API retorna dados no formato:
```json
{
  "itens": [
    {
      "pedido": {
        "id": 945562578,
        "numeroPedido": 1387,
        "valor": "598",              // ← STRING, não number!
        "data": "2025-11-25",        // ← Data sem hora
        "dataFaturamento": "2025-11-25",
        "situacao": 1,               // 1 = Faturado
        "cliente": {
          "id": 123456,
          "nome": "Sônia Maria Schaefer",
          "cpfCnpj": "67112345678",  // ← camelCase
          "email": "cliente@email.com",
          "telefone": "(11) 99999-9999",
          "dataNascimento": "1990-01-15"  // ← camelCase
        },
        "vendedor": {
          "id": 927712006,
          "nome": "Yasmim Bruna"
        }
      }
    }
  ],
  "paginacao": {
    "pagina": 1,
    "limite": 50,
    "total": 20
  }
}
```

**PONTOS CRÍTICOS:**
- ⚠️ `valor` vem como **STRING** (`"598"`), não como number
- ⚠️ `data` vem apenas como **data** (`"2025-11-25"`), sem hora
- ⚠️ Campos em **camelCase** (`cpfCnpj`, `dataNascimento`, `numeroPedido`)
- ⚠️ `situacao` é um **número** (1 = Faturado)

**Arquivo:** `src/lib/erp/syncTiny.ts`
- Função `syncTinyOrders()` faz a requisição e processa os dados
- A resposta vem em `response.itens[]`, não diretamente em `response.pedidos[]`

---

## 🔄 COMO ESTAMOS PROCESSANDO OS DADOS

### 1. Parsing dos Dados Recebidos

**Arquivo:** `src/lib/erp/syncTiny.ts` (linhas 575-868)

**Processamento do Valor Total:**
```typescript
valor_total: (() => {
  const valorBruto = pedido.valorTotalPedido  // API v3 oficial (camelCase, number)
    || pedido.valor  // API v3 pode retornar como 'valor' (string) - VISTO NOS LOGS!
    || pedido.valor_total  // Fallback
    || null;

  if (valorBruto === null || valorBruto === undefined) {
    console.warn(`[SyncTiny] ⚠️ Valor não encontrado`);
    return 0;
  }

  // Se já é número, usar diretamente
  if (typeof valorBruto === 'number') {
    return valorBruto;
  }

  // Se é string, fazer parse
  const valorStr = String(valorBruto);
  const valorLimpo = valorStr.replace(/[^\d,.-]/g, '').replace(',', '.');
  const valorNum = parseFloat(valorLimpo);
  
  if (isNaN(valorNum)) {
    return 0;
  }

  console.log(`[SyncTiny] ✅ Valor parseado (string → number): ${valorStr} → ${valorNum}`);
  return valorNum;  // ← Retorna NUMBER
})(),
```

**Logs mostram que está funcionando:**
```
[SyncTiny] ✅ Valor parseado (string → number): 598 → 598
[SyncTiny] ✅ Valor parseado (string → number): 868 → 868
```

**Processamento da Data:**
```typescript
data_pedido: (() => {
  const data = pedido.data  // "2025-11-25"
    || pedido.dataFaturamento
    || null;

  if (!data) return null;

  // Se for apenas data (YYYY-MM-DD)
  if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return `${data}T00:00:00`;  // ← Adiciona hora para formato ISO
  }
  
  return data;
})(),
```

**Logs mostram que está funcionando:**
```
[SyncTiny] 📅 Data bruta recebida: "2025-11-25" (tipo: string)
```

**Processamento do CPF/CNPJ:**
```typescript
cliente_cpf_cnpj: (() => {
  const cpfCnpj = cliente.cpfCnpj  // API v3 oficial (camelCase)
    || cliente.cpf_cnpj
    || cliente.cpf
    || null;
  
  if (cpfCnpj) {
    console.log(`[SyncTiny] ✅ CPF/CNPJ do cliente encontrado: ${cpfCnpj.substring(0, 3)}***`);
  }
  return cpfCnpj;
})(),
```

**Logs mostram que está funcionando:**
```
[SyncTiny] ✅ CPF/CNPJ do cliente encontrado: 518***
[SyncTiny] ✅ CPF/CNPJ do cliente encontrado: 671***
```

### 2. Preparação do Objeto `orderData`

**Arquivo:** `src/lib/erp/syncTiny.ts` (linhas 747-868)

O objeto `orderData` é criado com os dados parseados:

```typescript
const orderData = {
  store_id: storeId,                    // UUID
  tiny_id: String(pedido.id),           // String do ID do Tiny
  numero_pedido: pedido.numeroPedido?.toString() || null,
  situacao: pedido.situacao?.toString() || null,
  data_pedido: "...",                   // String ISO: "2025-11-25T00:00:00"
  cliente_nome: cliente.nome || null,
  cliente_cpf_cnpj: "...",              // String: "67112345678"
  cliente_email: cliente.email || null,
  cliente_telefone: cliente.telefone || null,
  valor_total: 598,                     // NUMBER (parseado de string)
  // ... outros campos
};
```

**Log ANTES do upsert mostra:**
```javascript
[SyncTiny] 💾 Salvando pedido 945562578: {
  numero_pedido: "1387",
  valor_total: 598,              // ← NUMBER correto!
  data_pedido: "2025-11-25T00:00:00",  // ← String ISO correta!
  cliente_nome: "Sônia Maria Schaefer",
  cliente_cpf_cnpj: "671***",   // ← String correta!
  vendedor_nome: "Yasmim Bruna"
}
```

---

## 💾 COMO ESTAMOS SALVANDO NO BANCO DE DADOS

### 1. Estrutura da Tabela `tiny_orders`

**Arquivo:** `supabase/migrations/20250127040000_add_erp_system_to_stores_and_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS tiny_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    tiny_id TEXT NOT NULL,
    numero_pedido TEXT,
    situacao TEXT,
    data_pedido TIMESTAMP WITH TIME ZONE,  -- ← TIMESTAMP
    cliente_nome TEXT,
    cliente_cpf_cnpj TEXT,
    cliente_email TEXT,
    cliente_telefone TEXT,
    valor_total DECIMAL(10,2),             -- ← DECIMAL
    valor_desconto DECIMAL(10,2),
    valor_frete DECIMAL(10,2),
    -- ... outros campos
    UNIQUE(store_id, tiny_id)
);
```

**PONTOS CRÍTICOS:**
- `valor_total` é **DECIMAL(10,2)** no banco
- `data_pedido` é **TIMESTAMP WITH TIME ZONE** no banco
- `cliente_cpf_cnpj` é **TEXT** no banco

### 2. Operação de Upsert

**Arquivo:** `src/lib/erp/syncTiny.ts` (linhas 893-920)

```typescript
// Upsert pedido (insert ou update se já existir)
const { error: upsertError } = await supabase
  .schema('sistemaretiradas')
  .from('tiny_orders')
  .upsert(orderData, {
    onConflict: 'store_id,tiny_id',
    ignoreDuplicates: false,
  });

if (upsertError) {
  console.error(`[SyncTiny] ❌ Erro ao salvar pedido:`, upsertError);
  errors++;
} else {
  console.log(`[SyncTiny] ✅ Pedido salvo com sucesso!`);
  // ...
}
```

**PROBLEMA IDENTIFICADO:**
- ❌ O upsert **NÃO está retornando os dados salvos** (não usa `.select()`)
- ❌ Não há verificação se os dados foram salvos corretamente
- ❌ Não há log mostrando o que realmente foi salvo no banco

**Logs atuais mostram:**
```
[SyncTiny] ✅ Pedido 945562578 salvo com sucesso!
```

Mas não sabemos se `valor_total` foi salvo como `598` ou como `0`.

---

## 📤 COMO ESTAMOS LENDO OS DADOS DO BANCO

### 1. Componente de Listagem

**Arquivo:** `src/components/erp/TinyOrdersList.tsx`

**Função de Fetch:**
```typescript
const fetchOrders = async () => {
  let query = supabase
    .schema('sistemaretiradas')
    .from('tiny_orders')
    .select('*')
    .order('data_pedido', { ascending: false })
    .limit(limit);

  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  const { data, error } = await query;
  setOrders(data || []);
};
```

**Logs recentemente adicionados:**
```javascript
[TinyOrdersList] 📦 Dados recebidos do banco: {
  total: 20,
  primeiro_pedido: {
    tiny_id: "945562578",
    numero_pedido: "1387",
    valor_total: 0,              // ← ZERADO! Deveria ser 598
    data_pedido: null,            // ← NULL! Deveria ser "2025-11-25T00:00:00"
    cliente_cpf_cnpj: null,       // ← NULL! Deveria ser "67112345678"
    // ...
  }
}
```

### 2. Exibição na Interface

**Formatação do Valor:**
```typescript
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Na tabela:
{formatCurrency(order.valor_total || 0)}  // ← Mostra R$ 0,00 se valor_total for 0 ou null
```

**Formatação da Data:**
```typescript
const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';  // ← Retorna "-" se for null ou vazio
  try {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  } catch {
    return dateString;
  }
};

// Na tabela:
{formatDate(order.data_pedido)}  // ← Mostra "-" se data_pedido for null
```

---

## 🔍 HIPÓTESES DO PROBLEMA

### Hipótese 1: Tipo de Dado Incompatível (MAIS PROVÁVEL)

**Problema:** 
- Enviamos `valor_total` como **NUMBER** (598)
- Banco espera **DECIMAL(10,2)**
- Supabase pode estar rejeitando ou convertendo incorretamente

**Evidência:**
- Logs mostram valor correto antes do upsert
- Logs mostram valor zerado na leitura
- Não há erro no upsert (retorna sucesso)

**Solução possível:**
```typescript
// Converter explicitamente para string antes de salvar
valor_total: orderData.valor_total ? String(orderData.valor_total) : null,
// OU garantir que seja number válido
valor_total: orderData.valor_total || 0,
```

### Hipótese 2: Upsert Não Está Atualizando Corretamente

**Problema:**
- Registro já existe com valores zerados
- Upsert está fazendo match por `store_id, tiny_id`
- Mas pode não estar atualizando os campos que mudaram

**Evidência:**
- Logs mostram "Pedido salvo com sucesso!"
- Mas valores continuam zerados na leitura

**Solução possível:**
- Adicionar `.select()` no upsert para verificar o que foi salvo
- Verificar se há algum problema com o `onConflict`

### Hipótese 3: Problema de Timezone na Data

**Problema:**
- Enviamos `"2025-11-25T00:00:00"` (sem timezone)
- Banco espera `TIMESTAMP WITH TIME ZONE`
- Supabase pode estar convertendo incorretamente ou zerando

**Evidência:**
- Datas aparecem como null na leitura
- Mas logs mostram data correta antes do upsert

### Hipótese 4: Campos Não Estão Sendo Enviados no Upsert

**Problema:**
- Alguns campos do `orderData` podem não estar sendo incluídos no upsert
- Supabase pode estar ignorando campos undefined/null

**Evidência:**
- CPF e data de nascimento aparecem como null
- Mas logs mostram que foram encontrados

---

## 🛠️ PRÓXIMOS PASSOS PARA DIAGNOSTICAR

### 1. Adicionar Logs Detalhados no Upsert

```typescript
// ANTES do upsert
console.log(`[SyncTiny] 🔍 Dados COMPLETOS antes do upsert:`, {
  valor_total_TIPO: typeof orderData.valor_total,
  valor_total_VALOR: orderData.valor_total,
  data_pedido_TIPO: typeof orderData.data_pedido,
  data_pedido_VALOR: orderData.data_pedido,
});

// UPSERT com .select() para ver o que foi salvo
const { data: upsertedData, error: upsertError } = await supabase
  .schema('sistemaretiradas')
  .from('tiny_orders')
  .upsert(orderData, {
    onConflict: 'store_id,tiny_id',
    ignoreDuplicates: false,
  })
  .select();  // ← ADICIONAR ISSO!

// DEPOIS do upsert
if (upsertedData && upsertedData.length > 0) {
  const savedOrder = upsertedData[0];
  console.log(`[SyncTiny] ✅ Dados SALVOS no banco:`, {
    valor_total_SALVO: savedOrder.valor_total,
    data_pedido_SALVA: savedOrder.data_pedido,
  });
  
  // ALERTA se valores não batem
  if (orderData.valor_total > 0 && savedOrder.valor_total === 0) {
    console.error(`[SyncTiny] ⚠️⚠️⚠️ ATENÇÃO: Valor deveria ser ${orderData.valor_total} mas foi salvo como ${savedOrder.valor_total}`);
  }
}
```

### 2. Verificar Estrutura Real do orderData

Adicionar log completo do objeto antes do upsert:
```typescript
console.log(`[SyncTiny] 📋 orderData COMPLETO:`, JSON.stringify(orderData, null, 2));
```

### 3. Verificar Tipos de Dado no Banco

Executar query SQL direta:
```sql
SELECT 
  tiny_id,
  numero_pedido,
  valor_total,
  pg_typeof(valor_total) as tipo_valor_total,
  data_pedido,
  pg_typeof(data_pedido) as tipo_data_pedido,
  cliente_cpf_cnpj
FROM tiny_orders
WHERE tiny_id = '945562578'
LIMIT 1;
```

### 4. Testar Upsert Direto no Supabase

Tentar fazer upsert manual via SQL ou Supabase UI para ver se funciona.

---

## 📊 RESUMO EXECUTIVO

**O QUE FUNCIONA:**
- ✅ Autenticação OAuth com Tiny ERP
- ✅ Requisições à API do Tiny ERP
- ✅ Parsing dos dados recebidos (valor, data, CPF)
- ✅ Logs mostram dados corretos antes do upsert
- ✅ Upsert retorna sucesso (sem erros)

**O QUE NÃO FUNCIONA:**
- ❌ Valores não estão sendo salvos corretamente (zerados)
- ❌ Datas não estão sendo salvos corretamente (null)
- ❌ CPF/CNPJ não estão sendo salvos corretamente (null)
- ❌ Interface mostra todos os valores como zerados/vazios

**SUSPEITA PRINCIPAL:**
- Problema de tipo de dado entre JavaScript (number/string) e PostgreSQL (DECIMAL/TIMESTAMP)
- Upsert pode estar ignorando alguns campos ou convertendo incorretamente

**AÇÃO IMEDIATA:**
- Adicionar `.select()` no upsert para verificar o que realmente foi salvo
- Comparar dados ANTES vs DEPOIS do upsert
- Verificar tipos de dado no banco vs tipos enviados

---

## 📁 ARQUIVOS RELEVANTES

1. **`src/lib/erp/syncTiny.ts`** - Lógica de sincronização e parsing
2. **`src/lib/erpIntegrations.ts`** - Chamadas à API do Tiny ERP
3. **`src/components/erp/TinyOrdersList.tsx`** - Componente de exibição
4. **`supabase/migrations/20250127040000_add_erp_system_to_stores_and_tables.sql`** - Schema da tabela
5. **`netlify/functions/erp-api-proxy.js`** - Proxy para evitar CORS

---

**Data de criação:** 2025-11-25
**Última atualização:** 2025-11-25 23:10
**Status:** 🔴 PROBLEMA CRÍTICO - Dados não sendo salvos/exibidos corretamente

