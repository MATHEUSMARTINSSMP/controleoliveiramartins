# Estrutura Completa de Analytics para Campanhas WhatsApp

## 📊 Visão Geral

Este documento descreve a estrutura completa e robusta para analytics de campanhas WhatsApp, garantindo acesso 100% aos dados de `contacts`, `sales` e tabelas de campanhas para análises profundas.

## 🗄️ Tabelas Principais

### 1. `contacts` (Hub de Contatos)
- **Propósito**: Hub centralizado de todos os contatos do sistema
- **Campos principais**:
  - `id` (UUID): Identificador único
  - `nome` (TEXT): Nome do contato
  - `telefone` (TEXT): Telefone (normalizado)
  - `cpf` (TEXT): CPF do contato
  - `email` (TEXT): Email
  - `store_id` (UUID): Loja associada
  - `created_at`, `updated_at`

### 2. `sales` (Vendas)
- **Propósito**: Registro de todas as vendas
- **Campos principais**:
  - `id` (UUID): Identificador único
  - `cliente_id` (UUID): Referência a `contacts.id`
  - `cliente_nome` (TEXT): Nome do cliente (para matching flexível)
  - `data_venda` (TIMESTAMP): Data da venda
  - `valor` (NUMERIC): Valor da venda
  - `store_id` (UUID): Loja da venda
  - `qtd_pecas` (INTEGER): Quantidade de peças

### 3. `whatsapp_campaigns` (Campanhas)
- **Propósito**: Registro de campanhas de envio em massa
- **Campos principais**:
  - `id` (UUID): Identificador único
  - `name` (TEXT): Nome da campanha
  - `category` (TEXT): Categoria para analytics
  - `store_id` (UUID): Loja
  - `status` (TEXT): Status (DRAFT, RUNNING, COMPLETED, etc)
  - `total_recipients` (INTEGER): Total de destinatários
  - `sent_count` (INTEGER): Mensagens enviadas
  - `failed_count` (INTEGER): Mensagens falhas
  - `scheduled_start_at` (TIMESTAMPTZ): Data agendada
  - `created_at`, `started_at`, `completed_at`

### 4. `whatsapp_message_queue` (Fila de Mensagens)
- **Propósito**: Registro detalhado de cada mensagem enviada
- **Campos principais**:
  - `id` (UUID): Identificador único
  - `campaign_id` (UUID): Referência a `whatsapp_campaigns.id`
  - `phone` (TEXT): Telefone do destinatário
  - `message` (TEXT): Conteúdo da mensagem
  - `status` (TEXT): Status (SENT, FAILED, PENDING, etc)
  - `sent_at` (TIMESTAMPTZ): Data/hora do envio
  - `error_message` (TEXT): Mensagem de erro (se houver)
  - `created_at`

## 🔗 Relacionamentos e Matching

### Matching Contacts ↔ Sales
1. **Por ID direto**: `sales.cliente_id = contacts.id`
2. **Por nome (fuzzy)**: `sales.cliente_nome ILIKE '%' || contacts.nome || '%'`
3. **Por CPF**: Quando disponível em ambos

### Matching Contacts ↔ Messages
1. **Por telefone normalizado**: 
   - Normalizar telefone removendo caracteres: `(`, `)`, `-`, espaços
   - Comparar: `contacts.telefone = normalized(whatsapp_message_queue.phone)`

### Matching Messages ↔ Sales
1. **Via Contacts**: Messages → Contacts → Sales
2. **Janela de tempo**: Sales devem ocorrer após `message_queue.sent_at`
3. **Períodos analisados**: 30, 60, 90 dias após envio

## 📈 Funções RPC para Analytics

### 1. `get_campaign_analytics_by_category`
**Retorna**: Estatísticas agregadas por categoria

**Métricas**:
- Total de campanhas
- Total de mensagens enviadas
- Total de destinatários únicos
- Taxa de conversão (clientes que retornaram / total)
- Tempo médio até retorno (dias)
- Receita total gerada
- Ticket médio pós-campanha
- ROI percentual

**Parâmetros**:
- `p_store_id` (opcional): Filtrar por loja
- `p_category` (opcional): Filtrar por categoria
- `p_start_date` (opcional): Data inicial
- `p_end_date` (opcional): Data final

### 2. `track_customer_return_after_campaign`
**Retorna**: Detalhes de retorno de cada cliente após campanha

**Campos**:
- Informações do contato
- Data do envio da mensagem
- Primeira venda após mensagem
- Dias até retorno
- Total de vendas e receita gerada
- Ticket médio
- Flag `returned` (boolean)

**Parâmetros**:
- `p_campaign_id`: ID da campanha

### 3. `get_campaign_detailed_analytics`
**Retorna**: Métricas detalhadas de uma campanha específica

**Métricas em múltiplos períodos** (30, 60, 90 dias):
- Receita gerada
- Ticket médio
- Total de vendas
- ROI

**Parâmetros**:
- `p_campaign_id`: ID da campanha

### 4. `get_most_responsive_customers_by_category`
**Retorna**: Lista de clientes mais responsivos por categoria

**Campos**:
- Informações do cliente
- Categoria da campanha
- Quantas campanhas recebeu
- Quantas vezes retornou
- Receita total gerada
- Score de responsividade (%)

**Parâmetros**:
- `p_store_id` (opcional)
- `p_category` (opcional)
- `p_limit` (padrão: 50)

## 🎯 Categorias de Campanha

Categorias pré-definidas para analytics:
- `DESCONTO`: Campanhas de desconto
- `PROMOCAO`: Promoções especiais
- `CASHBACK`: Campanhas de cashback
- `SAUDACAO`: Mensagens de saudação/boas-vindas
- `REATIVACAO`: Reativação de clientes inativos
- `NOVIDADES`: Lançamento de novos produtos
- `DATAS_COMEMORATIVAS`: Campanhas sazonais
- `ANIVERSARIO`: Mensagens de aniversário
- `ABANDONO_CARRINHO`: Recuperação de carrinho
- `FIDELIDADE`: Programa de fidelidade
- `PESQUISA`: Pesquisas e feedback
- `LEMBRETE`: Lembretes diversos
- `EDUCACIONAL`: Conteúdo educativo
- `SURVEY`: Pesquisas de satisfação
- `VIP`: Campanhas para clientes VIP
- `SEGMENTACAO`: Campanhas segmentadas
- `SAZONAL`: Campanhas sazonais
- `LANCAMENTO`: Lançamentos
- `ESGOTANDO`: Produtos esgotando
- `OUTROS`: Outras categorias

## 📊 Métricas Principais

### Por Campanha
1. **Performance Básica**:
   - Total enviado vs. total destinatários
   - Taxa de sucesso (sent / total)
   - Taxa de falha

2. **Conversão**:
   - Taxa de conversão (retornaram / receberam)
   - Tempo médio até conversão
   - Clientes únicos que retornaram

3. **Receita**:
   - Receita total gerada (30/60/90 dias)
   - Ticket médio pós-campanha
   - Total de vendas geradas

4. **ROI**:
   - ROI em 30 dias
   - ROI em 60 dias
   - ROI em 90 dias
   - Custo por mensagem vs. receita gerada

### Por Categoria
1. **Agregados**:
   - Total de campanhas por categoria
   - Performance média da categoria
   - ROI médio da categoria

2. **Comparação**:
   - Qual categoria tem melhor conversão
   - Qual categoria gera mais receita
   - Qual categoria tem melhor ROI

### Por Cliente
1. **Responsividade**:
   - Score de responsividade (%)
   - Quantas campanhas recebeu
   - Quantas vezes retornou
   - Receita total gerada

2. **Preferências**:
   - Categorias mais efetivas para o cliente
   - Tempo médio de retorno por categoria

## 🔐 Segurança e Performance

### RLS (Row Level Security)
- Todas as funções usam `SECURITY DEFINER` para garantir acesso aos dados
- Queries são filtradas por `store_id` quando aplicável
- Dados sensíveis são protegidos por políticas RLS existentes

### Índices para Performance
- `idx_whatsapp_campaigns_category`: Índice em `category`
- `idx_whatsapp_campaigns_store_category`: Índice composto (store_id, category)
- Índices existentes em `contacts.telefone`, `sales.cliente_id`, `sales.data_venda`

### Otimizações
- CTEs (Common Table Expressions) para queries complexas
- Agregações eficientes com `FILTER` clauses
- Limites apropriados para queries de listagem

## 📝 Exemplos de Uso

### Exemplo 1: Analytics por Categoria
```sql
SELECT * FROM sistemaretiradas.get_campaign_analytics_by_category(
  p_store_id := 'uuid-da-loja',
  p_category := 'DESCONTO',
  p_start_date := '2025-01-01'::timestamptz,
  p_end_date := NOW()
);
```

### Exemplo 2: Rastrear Retorno de Clientes
```sql
SELECT * FROM sistemaretiradas.track_customer_return_after_campaign(
  p_campaign_id := 'uuid-da-campanha'
)
WHERE returned = true
ORDER BY days_to_return ASC;
```

### Exemplo 3: Clientes Mais Responsivos
```sql
SELECT * FROM sistemaretiradas.get_most_responsive_customers_by_category(
  p_store_id := 'uuid-da-loja',
  p_category := 'CASHBACK',
  p_limit := 20
);
```

## 🚀 Próximos Passos

1. **Frontend**: Criar página de Analytics
2. **Gráficos**: Visualizações interativas
3. **Exportação**: Relatórios em CSV/Excel
4. **Alertas**: Notificações de campanhas de alta performance
5. **Recomendações**: IA para sugerir melhor categoria por cliente

