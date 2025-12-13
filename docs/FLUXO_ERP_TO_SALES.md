# 🔄 Fluxo Completo: ERP → tiny_orders → sales

Este documento descreve o fluxo completo de processamento de vendas do ERP até a tabela `sales`.

## 📋 Visão Geral

```
ERP (Tiny/Bling) 
  ↓
Webhook/API recebe pedido
  ↓
INSERT em tiny_orders
  ↓
TRIGGER automático processa
  ↓
INSERT/UPDATE em sales
  ↓
✅ Venda disponível no sistema
```

## 🔍 Etapas Detalhadas

### 1. Recebimento de Dados do ERP

**Localização:** Webhook ou endpoint de API externo

- O ERP (Tiny, Bling, etc.) envia dados do pedido
- Sistema recebe e valida dados básicos
- Dados são inseridos na tabela `tiny_orders`

**Campos obrigatórios em `tiny_orders`:**
- `numero_pedido` (TEXT)
- `store_id` (UUID)
- `valor_total` (NUMERIC)
- `data_pedido` (TIMESTAMPTZ)
- `itens` (JSONB)
- `colaboradora_id` (UUID) - **deve estar mapeado**

### 2. Processamento Automático (TRIGGER)

**Localização:** `trigger_auto_processar_tiny_order` em `tiny_orders`

Quando um pedido é inserido ou atualizado em `tiny_orders`:

1. **Validação automática:**
   - ✅ `colaboradora_id` IS NOT NULL
   - ✅ `store_id` IS NOT NULL
   - ✅ `valor_total` > 0

2. **Se válido:**
   - Executa `processar_tiny_order_para_venda(tiny_order_id)`
   - Cria ou atualiza registro em `sales`

3. **Se inválido:**
   - Pedido fica em `tiny_orders` mas não gera venda
   - Pode ser processado manualmente depois (quando `colaboradora_id` for mapeado)

### 3. Criação/Atualização de Venda

**Função:** `processar_tiny_order_para_venda(tiny_order_id)`

**Processo:**
1. Busca dados do pedido
2. Valida dados necessários
3. Calcula `qtd_pecas` a partir de `itens` (JSONB)
4. Prepara `observacoes` (inclui número do pedido se disponível)
5. Verifica se já existe venda (`sales.tiny_order_id`)
   - Se existe: **UPDATE** (atualiza dados)
   - Se não existe: **INSERT** (cria nova venda)

**Colunas preenchidas em `sales`:**
- `tiny_order_id` → ID do pedido original
- `colaboradora_id` → Vendedora responsável
- `store_id` → Loja
- `valor` → Valor total (já com vale troca descontado)
- `qtd_pecas` → Soma das quantidades dos itens
- `data_venda` → Data do pedido
- `observacoes` → Observações + "Pedido Tiny: #XXX"
- `lancado_por_id` → NULL (vendas do ERP não têm lançador)

### 4. Processamento Manual (Quando Necessário)

**Função:** `criar_vendas_de_tiny_orders(p_store_id, p_data_inicio)`

Esta função processa **múltiplos pedidos** de uma vez.

**Uso:**
- Processar pedidos que chegaram antes do trigger estar ativo
- Reprocessar pedidos que falharam
- Processar pedidos pendentes de uma loja específica
- Processar pedidos de um período específico

**Quando usar:**
```sql
-- Processar todos os pedidos pendentes
SELECT * FROM criar_vendas_de_tiny_orders();

-- Processar apenas de uma loja
SELECT * FROM criar_vendas_de_tiny_orders('store-uuid-here');

-- Processar apenas dos últimos 30 dias
SELECT * FROM criar_vendas_de_tiny_orders(NULL, NOW() - INTERVAL '30 days');
```

## ⚠️ Validações e Proteções

### Validação de Schema

**Função:** `validar_schema_sales()`

Antes de processar vendas, a função valida se todas as colunas obrigatórias existem na tabela `sales`. Isso previne erros como:
- `column sales.numero_pedido does not exist`
- `column sales.cliente_telefone does not exist`

### Proteção Contra Duplicatas

- **Índice único:** `idx_sales_tiny_order_id_unique` garante que cada pedido gere apenas uma venda
- **EXCEPTION handling:** Trata race conditions (quando dois processos tentam criar a mesma venda simultaneamente)

### Validações de Dados

Antes de criar venda, verifica:
- ✅ `colaboradora_id` IS NOT NULL
- ✅ `store_id` IS NOT NULL
- ✅ `valor_total` > 0

Se alguma validação falhar, o pedido fica em `tiny_orders` mas não gera venda.

## 🔍 Monitoramento

### Verificar Vendas Não Processadas

**Função:** `verificar_vendas_nao_processadas(p_store_id, p_dias_retrocesso)`

Identifica pedidos que não foram processados e mostra o motivo.

```sql
-- Verificar últimos 7 dias (padrão)
SELECT * FROM verificar_vendas_nao_processadas();

-- Verificar últimos 30 dias de uma loja específica
SELECT * FROM verificar_vendas_nao_processadas('store-uuid', 30);
```

**Motivos comuns:**
- `colaboradora_id é NULL` → Precisa mapear colaboradora no pedido
- `store_id é NULL` → Dados do ERP incompletos
- `valor_total inválido` → Valor zero ou negativo

## 📊 Estrutura de Dados

### Tabela: `tiny_orders`

Campos principais:
- `id` (UUID, PK)
- `numero_pedido` (TEXT)
- `store_id` (UUID, FK → stores)
- `colaboradora_id` (UUID, FK → profiles, nullable)
- `valor_total` (NUMERIC)
- `data_pedido` (TIMESTAMPTZ)
- `itens` (JSONB)
- `observacoes` (TEXT)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### Tabela: `sales`

Campos principais:
- `id` (UUID, PK)
- `tiny_order_id` (UUID, FK → tiny_orders, nullable, unique)
- `colaboradora_id` (UUID, FK → profiles)
- `store_id` (UUID, FK → stores)
- `valor` (NUMERIC)
- `qtd_pecas` (INTEGER)
- `data_venda` (TIMESTAMPTZ)
- `observacoes` (TEXT)
- `cliente_id` (UUID, FK → crm_contacts, nullable)
- `cliente_nome` (TEXT, nullable)
- `lancado_por_id` (UUID, FK → profiles, nullable)
- `created_at`, `updated_at` (TIMESTAMPTZ)

## 🚨 Troubleshooting

### Problema: Venda não aparece em `sales`

**Solução 1:** Verificar se pedido tem dados válidos
```sql
SELECT * FROM verificar_vendas_nao_processadas();
```

**Solução 2:** Processar manualmente
```sql
SELECT * FROM criar_vendas_de_tiny_orders('store-id');
```

**Solução 3:** Verificar se trigger está ativo
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_auto_processar_tiny_order';
```

### Problema: Erro "column does not exist"

**Causa:** Schema da tabela `sales` foi alterado mas função não foi atualizada.

**Solução:** Executar migration mais recente que atualiza a função `criar_vendas_de_tiny_orders`.

### Problema: Duplicatas em `sales`

**Causa:** Race condition (improvável, mas possível).

**Solução:** O índice único `idx_sales_tiny_order_id_unique` previne duplicatas. Se ocorrer, verificar logs.

## ✅ Checklist de Garantia de Qualidade

Para garantir que nenhuma venda seja perdida:

1. ✅ Trigger automático está ativo
2. ✅ Função `criar_vendas_de_tiny_orders` usa apenas colunas que existem
3. ✅ Validação de schema antes de processar
4. ✅ Monitoramento de vendas não processadas
5. ✅ Logs de erros para diagnóstico
6. ✅ Proteção contra duplicatas (índice único)

## 🔄 Processo de Recuperação

Se uma venda foi perdida:

1. Identificar o pedido em `tiny_orders`
2. Verificar se tem `colaboradora_id` mapeado
3. Se não tem, mapear colaboradora
4. Executar processamento manual:
   ```sql
   SELECT * FROM criar_vendas_de_tiny_orders('store-id');
   ```
5. Verificar se venda foi criada:
   ```sql
   SELECT * FROM sales WHERE tiny_order_id = 'pedido-id';
   ```

---

**Última atualização:** 2025-02-02
**Versão:** 1.0

