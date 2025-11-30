# Proteção Contra Duplicatas de Vendas

## Resumo

A função `criar_vendas_de_tiny_orders` foi atualizada com **múltiplas camadas de proteção** contra duplicatas de vendas:

### 1. Índice Único no Banco de Dados
- **Nome do índice**: `idx_sales_tiny_order_id_unique`
- **Localização**: `sistemaretiradas.sales.tiny_order_id`
- **Garantia**: Cada `tiny_order_id` pode gerar apenas **uma** venda
- **Proteção**: Nível de banco de dados (a mais confiável)

### 2. Filtro na Query Principal
```sql
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = o.id
WHERE (
  s.id IS NULL  -- Não tem venda
  OR (o.updated_at > s.updated_at)  -- Pedido foi atualizado após a venda
)
```
- **Proteção**: Nível de lógica - filtra pedidos que já têm venda

### 3. Verificação Condicional
```sql
IF v_pedido.sale_id IS NOT NULL THEN
  -- Atualiza venda existente
ELSE
  -- Cria nova venda
END IF
```
- **Proteção**: Nível de lógica - separa criação de atualização

### 4. INSERT com ON CONFLICT
```sql
INSERT INTO sistemaretiradas.sales (...)
ON CONFLICT (tiny_order_id)
DO UPDATE SET ...
```
- **Proteção**: Nível de banco de dados - previne duplicatas mesmo em execuções simultâneas (race conditions)

## Como Verificar Duplicatas

Execute a query SQL em `verificar_vendas_duplicadas.sql` para verificar se há duplicatas existentes no banco.

## Conclusão

✅ **Não é possível criar vendas duplicadas** porque:
1. O índice único impede duplicatas no nível do banco
2. O ON CONFLICT trata qualquer tentativa de duplicação
3. A lógica de filtro evita processar pedidos que já têm venda

