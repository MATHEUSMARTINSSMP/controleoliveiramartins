# 📚 ENTENDENDO A API DO TINY ERP - GUIA COMPLETO

## 🎯 CONCEITO FUNDAMENTAL

**TODOS os endpoints na documentação Swagger são REQUISIÇÕES QUE NÓS FAZEMOS para o Tiny ERP.**

Quando você vê:
- `GET /pedidos` → **NÓS** fazemos uma requisição GET para buscar/listar pedidos
- `GET /pedidos/{idPedido}` → **NÓS** fazemos uma requisição GET para buscar detalhes de um pedido específico
- `POST /pedidos` → **NÓS** fazemos uma requisição POST para criar um novo pedido
- `POST /pedidos/{idPedido}/estornar-contas` → **NÓS** fazemos uma requisição POST para executar uma ação (estornar contas)

**NÃO são ações que o Tiny faz internamente. São requisições HTTP que o NOSSO sistema faz PARA o Tiny ERP.**

---

## 📥 COMO FUNCIONAM OS VERBOS HTTP

### GET = LER/CONSULTAR DADOS
- **O que fazemos:** Enviamos uma requisição GET para o Tiny ERP
- **O que o Tiny faz:** Retorna os dados solicitados
- **Exemplo:** `GET /pedidos` → Tiny retorna lista de pedidos

### POST = CRIAR/EXECUTAR
- **O que fazemos:** Enviamos uma requisição POST com dados/ação
- **O que o Tiny faz:** Cria um recurso ou executa uma ação
- **Exemplo:** `POST /pedidos` → Criar novo pedido
- **Exemplo:** `POST /pedidos/{idPedido}/estornar-contas` → Executar ação de estornar

### PUT = ATUALIZAR
- **O que fazemos:** Enviamos uma requisição PUT com dados atualizados
- **O que o Tiny faz:** Atualiza o recurso existente
- **Exemplo:** `PUT /pedidos/{idPedido}` → Atualizar pedido existente

### DELETE = REMOVER
- **O que fazemos:** Enviamos uma requisição DELETE
- **O que o Tiny faz:** Remove o recurso
- **Exemplo:** `DELETE /pedidos/{idPedido}` → Deletar pedido

---

## 🔍 ENDPOINTS QUE ESTAMOS USANDO NO NOSSO CÓDIGO

### 1. **GET /pedidos** - Listar Pedidos

**Onde usamos:** `src/lib/erp/syncTiny.ts` (linha ~490)

```typescript
const response = await callERPAPI(storeId, '/pedidos', params);
```

**O que enviamos:**
```
GET https://erp.tiny.com.br/public-api/v3/pedidos?pagina=1&limite=50&dataInicial=2025-11-01&dataFinal=2025-11-30
Headers:
  Authorization: Bearer {access_token}
```

**O que o Tiny retorna:**
```json
{
  "itens": [
    {
      "id": 945562578,
      "numeroPedido": 1387,
      "situacao": 3,  // 3 = Aprovada
      "valor": "598",  // ⚠️ String, pode estar vazio para pedidos aprovados
      "dataCriacao": "2025-11-25",
      "cliente": {
        "nome": "Sônia Maria Schaefer",
        "cpfCnpj": "67112345678"
      },
      "vendedor": {
        "id": 927712006,
        "nome": "Yasmim Bruna"
      }
    }
  ],
  "paginacao": {
    "limit": 50,
    "offset": 0,
    "total": 20
  }
}
```

**PROBLEMA:** 
- Para pedidos com `situacao: 3` (Aprovada), o campo `valor` pode vir vazio ou null
- Para pedidos com `situacao: 1` (Faturada), o campo `valor` geralmente vem preenchido

---

### 2. **GET /pedidos/{idPedido}** - Detalhes Completos de um Pedido

**Onde usamos:** `src/lib/erp/syncTiny.ts` (função `fetchPedidoCompletoFromTiny`, linha ~1117)

```typescript
const response = await callERPAPI(storeId, `/pedidos/${pedidoId}`);
```

**O que enviamos:**
```
GET https://erp.tiny.com.br/public-api/v3/pedidos/945562578
Headers:
  Authorization: Bearer {access_token}
```

**O que o Tiny retorna (COMPLETO):**
```json
{
  "id": 945562578,
  "numeroPedido": 1387,
  "situacao": 3,
  "data": "2025-11-25",
  "dataFaturamento": "2025-11-25",
  
  // ✅ ESTE É O VALOR QUE PRECISAMOS!
  "valorTotalPedido": 598.00,  // ← NUMBER, sempre presente nos detalhes
  
  "valorTotalProdutos": 650.00,
  "valorDesconto": 50.00,
  "valorFrete": 0.00,
  "valorOutrasDespesas": 0.00,
  
  "cliente": {
    "id": 123456,
    "nome": "Sônia Maria Schaefer",
    "cpfCnpj": "67112345678",
    "email": "cliente@email.com",
    "telefone": "(11) 99999-9999",
    "dataNascimento": "1990-01-15"
  },
  
  "vendedor": {
    "id": 927712006,
    "nome": "Yasmim Bruna"
  },
  
  "itens": [
    {
      "produto": {
        "id": 12345,
        "sku": "PROD-001",
        "descricao": "Produto Exemplo"
      },
      "quantidade": 2,
      "valorUnitario": 325.00
    }
  ],
  
  "pagamento": {
    "formaPagamento": {
      "id": 1,
      "nome": "Dinheiro"
    },
    "parcelas": [
      {
        "dias": 0,
        "data": "2025-11-25",
        "valor": 598.00
      }
    ]
  }
}
```

**SOLUÇÃO:**
- Quando `valor` na listagem está vazio/null, fazemos uma segunda requisição para `GET /pedidos/{idPedido}`
- Buscamos o campo `valorTotalPedido` que **sempre** está presente nos detalhes completos

---

### 3. **GET /contatos** - Listar Clientes

**Onde usamos:** `src/lib/erp/syncTiny.ts` (função `syncTinyContacts`)

```typescript
const response = await callERPAPI(storeId, '/contatos', params);
```

**O que enviamos:**
```
GET https://erp.tiny.com.br/public-api/v3/contatos?pagina=1&limite=100
Headers:
  Authorization: Bearer {access_token}
```

**O que o Tiny retorna:**
```json
{
  "itens": [
    {
      "id": 123456,
      "nome": "Sônia Maria Schaefer",
      "cpfCnpj": "67112345678",
      "email": "cliente@email.com",
      "telefone": "(11) 99999-9999",
      "celular": "(11) 88888-8888",
      "dataNascimento": "1990-01-15",
      "situacao": "B"
    }
  ],
  "paginacao": {
    "limit": 100,
    "offset": 0,
    "total": 50
  }
}
```

---

### 4. **GET /contatos/{idContato}** - Detalhes Completos de um Cliente/Vendedor

**Onde usamos:** `src/lib/erp/syncTiny.ts` (função `fetchVendedorCompletoFromTiny`)

```typescript
const response = await callERPAPI(storeId, `/contatos/${vendedorId}`);
```

**O que enviamos:**
```
GET https://erp.tiny.com.br/public-api/v3/contatos/927712006
Headers:
  Authorization: Bearer {access_token}
```

**O que o Tiny retorna:**
```json
{
  "id": 927712006,
  "nome": "Yasmim Bruna Mendes Castro",
  "cpfCnpj": "12345678901",  // ← CPF completo que precisamos para matching
  "email": "yasmim@loja.com",
  "telefone": "(11) 77777-7777",
  "celular": "(11) 66666-6666",
  "dataNascimento": "1995-05-10",
  "situacao": "B",
  "vendedor": {
    "id": 927712006,
    "nome": "Yasmim Bruna"
  }
}
```

---

## 🔄 FLUXO COMPLETO DA SINCRONIZAÇÃO

### Passo 1: Listar Pedidos
```
NOSSO SISTEMA → GET /pedidos → TINY ERP
TINY ERP → Retorna lista de pedidos (com ou sem valor)
```

### Passo 2: Para Cada Pedido

#### 2.1: Se o pedido tem valor na listagem
```
✅ Usar valor da listagem
Salvar no banco
```

#### 2.2: Se o pedido NÃO tem valor (situacao: 3 - Aprovada)
```
NOSSO SISTEMA → GET /pedidos/{idPedido} → TINY ERP
TINY ERP → Retorna detalhes completos com valorTotalPedido
NOSSO SISTEMA → Usar valorTotalPedido
Salvar no banco
```

### Passo 3: Buscar Dados do Cliente
```
NOSSO SISTEMA → GET /contatos/{idCliente} → TINY ERP
TINY ERP → Retorna dados completos do cliente (CPF, email, etc)
NOSSO SISTEMA → Salvar no banco
```

### Passo 4: Buscar Dados do Vendedor (se necessário)
```
NOSSO SISTEMA → GET /contatos/{idVendedor} → TINY ERP
TINY ERP → Retorna dados completos do vendedor (CPF, etc)
NOSSO SISTEMA → Fazer matching com colaboradoras do nosso sistema
```

---

## 📊 COMPARAÇÃO: LISTAGEM vs DETALHES

### GET /pedidos (Listagem)
**Vantagens:**
- ✅ Retorna muitos pedidos de uma vez (paginado)
- ✅ Mais rápido (menos dados)
- ✅ Bom para listar/rastrear

**Desvantagens:**
- ❌ Campos limitados
- ❌ `valor` pode estar vazio para pedidos aprovados
- ❌ Não tem todos os detalhes do pagamento

### GET /pedidos/{idPedido} (Detalhes)
**Vantagens:**
- ✅ TODOS os campos disponíveis
- ✅ `valorTotalPedido` sempre presente
- ✅ Detalhes de itens, pagamento, cliente completo

**Desvantagens:**
- ❌ Uma requisição por pedido (mais lento)
- ❌ Mais dados trafegados
- ❌ Mais custo de API (se houver limite)

---

## 🎯 ESTRATÉGIA ATUAL DO NOSSO CÓDIGO

### Fase 1: Buscar Listagem
1. Fazemos `GET /pedidos` para buscar todos os pedidos
2. Processamos cada pedido da listagem
3. Tentamos extrair `valor` da listagem

### Fase 2: Buscar Detalhes (Se Necessário)
4. **SE** `valor` estiver vazio/null/zero:
   - Fazemos `GET /pedidos/{idPedido}` para buscar detalhes
   - Extraímos `valorTotalPedido` dos detalhes
   - Usamos esse valor

### Fase 3: Fallback (Se Detalhes Não Funcionar)
5. **SE** `valorTotalPedido` não vier nos detalhes:
   - Calculamos o valor a partir dos itens
   - Fórmula: `(quantidade × valorUnitario)` - desconto + frete

---

## 🔑 CAMPOS IMPORTANTES POR ENDPOINT

### GET /pedidos (Listagem)
```typescript
{
  id: number,              // ID do pedido
  numeroPedido: number,    // Número do pedido
  situacao: number,        // 3 = Aprovada, 1 = Faturada
  valor: string | null,    // ⚠️ Pode estar vazio para aprovados
  dataCriacao: string,     // Data de criação
  cliente: {
    nome: string,
    cpfCnpj: string,
    id: number
  },
  vendedor: {
    id: number,
    nome: string
  }
}
```

### GET /pedidos/{idPedido} (Detalhes)
```typescript
{
  id: number,
  numeroPedido: number,
  situacao: number,
  
  // ✅ VALORES (sempre presentes)
  valorTotalPedido: number,      // ← ESTE É O VALOR QUE USAMOS!
  valorTotalProdutos: number,
  valorDesconto: number,
  valorFrete: number,
  valorOutrasDespesas: number,
  
  // Datas
  data: string,
  dataFaturamento: string,
  dataPrevista: string,
  
  // Cliente completo
  cliente: {
    id: number,
    nome: string,
    cpfCnpj: string,
    email: string,
    telefone: string,
    celular: string,
    dataNascimento: string,  // ← Importante!
    endereco: {...}
  },
  
  // Vendedor
  vendedor: {
    id: number,
    nome: string
  },
  
  // Itens do pedido
  itens: [
    {
      produto: {
        id: number,
        sku: string,
        descricao: string
      },
      quantidade: number,
      valorUnitario: number
    }
  ],
  
  // Pagamento
  pagamento: {
    formaPagamento: {
      id: number,
      nome: string
    },
    parcelas: [...]
  }
}
```

---

## ❓ PERGUNTAS FREQUENTES

### Q: Por que o valor vem vazio na listagem?
**R:** Para pedidos aprovados (situacao: 3), o Tiny ERP não preenche o campo `valor` na listagem. Isso é por design do Tiny - eles querem que você busque os detalhes completos para ter o valor final.

### Q: Todos os endpoints são requisições que fazemos?
**R:** SIM! Todos os endpoints na documentação Swagger são requisições HTTP que o NOSSO sistema faz PARA o Tiny ERP. O Tiny ERP é o servidor, nós somos o cliente.

### Q: Precisamos fazer POST para buscar dados?
**R:** NÃO. POST é para criar/executar ações. Para buscar dados, usamos GET. Só usamos POST quando queremos criar um pedido ou executar uma ação (como estornar).

### Q: O que é o Bearer Token?
**R:** É o token de autenticação que recebemos após o OAuth. Precisamos enviar em TODAS as requisições:
```
Authorization: Bearer {access_token}
```

### Q: Por que fazemos várias requisições?
**R:** Porque:
1. Listagem é rápida mas incompleta
2. Detalhes são completos mas mais lentos
3. Fazemos apenas quando necessário (quando valor está vazio)

---

## 📝 RESUMO EXECUTIVO

1. **Todos os endpoints = Requisições que FAZEMOS para o Tiny**
2. **GET /pedidos** = Listar pedidos (rápido, mas valor pode estar vazio)
3. **GET /pedidos/{idPedido}** = Detalhes completos (lento, mas valor sempre presente)
4. **Estratégia:** Usar listagem primeiro, buscar detalhes se valor estiver vazio
5. **Campo importante:** `valorTotalPedido` (sempre presente nos detalhes)

---

**Data de criação:** 2025-11-26
**Última atualização:** 2025-11-26 02:17

