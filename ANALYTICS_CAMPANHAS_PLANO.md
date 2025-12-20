# 📊 Sistema de Analytics Inteligente para Campanhas WhatsApp

## Visão Geral

Sistema completo de analytics para rastrear performance de campanhas WhatsApp, identificar padrões de comportamento de clientes e otimizar estratégias de marketing.

## Estrutura de Dados

### 1. Categorias/Tags de Campanhas

Cada campanha terá uma categoria/tag que identifica seu propósito. Isso permite agrupar e analisar campanhas similares.

#### Categorias Principais:
- **DESCONTO** - Campanhas com ofertas e descontos
- **PROMOCAO** - Ações promocionais especiais
- **CASHBACK** - Campanhas relacionadas a cashback
- **SAUDACAO** - Mensagens de boas-vindas e saudação
- **REATIVACAO** - Para clientes inativos há muito tempo
- **NOVIDADES** - Lançamentos de produtos/coleções
- **DATAS_COMEMORATIVAS** - Dia das mães, natal, dia das mães, black friday, etc
- **ANIVERSARIO** - Mensagens de aniversário do cliente
- **ABANDONO_CARRINHO** - Recuperação de carrinho abandonado
- **FIDELIDADE** - Programa de fidelidade e pontos
- **PESQUISA** - Pesquisas de satisfação
- **LEMBRETE** - Lembretes de eventos/compromissos
- **EDUCACIONAL** - Dicas, conteúdos educacionais
- **SURVEY** - Questionários e pesquisas
- **VIP** - Campanhas exclusivas para clientes VIP
- **SEGMENTACAO** - Campanhas segmentadas por perfil de cliente
- **SAZONAL** - Campanhas sazonais (verão, inverno, etc)
- **LANCAMENTO** - Lançamento de novos produtos/coleções
- **ESGOTANDO** - Avisos de produtos que estão acabando
- **OUTROS** - Categoria genérica para casos não categorizados

### 2. Rastreamento de Retorno

Sistema para identificar quando um cliente retorna após receber uma mensagem:

1. **Evento de Envio**: Registro de quando mensagem foi enviada para cliente
2. **Evento de Retorno**: Primeira venda do cliente após o envio da mensagem
3. **Cálculo de Tempo**: Diferença entre data de envio e data da venda

### 3. Métricas Calculadas

#### Por Categoria de Campanha:
- **Taxa de Abertura**: (Mensagens enviadas / Mensagens lidas) - se disponível
- **Taxa de Conversão**: (Clientes que retornaram / Clientes que receberam mensagem)
- **Tempo Médio de Retorno**: Média de dias até cliente fazer primeira compra após mensagem
- **Faturamento Gerado**: Soma do faturamento de vendas após campanha
- **Ticket Médio Pós-Campanha**: Ticket médio das vendas geradas pela campanha
- **ROI**: (Faturamento gerado - Custos) / Custos

#### Por Cliente:
- **Responsividade por Categoria**: Qual categoria o cliente responde melhor
- **Tempo Médio de Retorno**: Tempo médio que leva para retornar após receber mensagem
- **Valor Médio Gerado**: Valor médio que gera ao retornar

#### Por Campanha:
- **Performance Geral**: Todas as métricas agregadas
- **Evolução Temporal**: Como a campanha performou ao longo do tempo
- **Comparação com Outras**: Comparar com campanhas similares

## Estrutura de Banco de Dados

### Modificações Necessárias

1. **Adicionar campo `category` em `whatsapp_campaigns`**:
   ```sql
   ALTER TABLE sistemaretiradas.whatsapp_campaigns
   ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN (
     'DESCONTO', 'PROMOCAO', 'CASHBACK', 'SAUDACAO', 
     'REATIVACAO', 'NOVIDADES', 'DATAS_COMEMORATIVAS',
     'ANIVERSARIO', 'ABANDONO_CARRINHO', 'FIDELIDADE',
     'PESQUISA', 'LEMBRETE', 'EDUCACIONAL', 'SURVEY',
     'VIP', 'SEGMENTACAO', 'SAZONAL', 'LANCAMENTO',
     'ESGOTANDO', 'OUTROS'
   ));
   
   CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_category 
     ON sistemaretiradas.whatsapp_campaigns(category);
   ```

2. **Criar tabela `campaign_customer_tracking`** (rastreamento de retorno):
   ```sql
   CREATE TABLE IF NOT EXISTS sistemaretiradas.campaign_customer_tracking (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     campaign_id UUID NOT NULL REFERENCES sistemaretiradas.whatsapp_campaigns(id) ON DELETE CASCADE,
     contact_id UUID REFERENCES sistemaretiradas.crm_contacts(id),
     phone TEXT NOT NULL,
     message_sent_at TIMESTAMPTZ NOT NULL,
     message_queue_id UUID REFERENCES sistemaretiradas.whatsapp_message_queue(id),
     
     -- Rastreamento de retorno
     first_sale_after_campaign UUID REFERENCES sistemaretiradas.sales(id),
     first_sale_date TIMESTAMPTZ,
     days_to_return INTEGER, -- Calculado: EXTRACT(DAY FROM first_sale_date - message_sent_at)
     
     -- Métricas financeiras
     total_revenue_generated NUMERIC(10,2) DEFAULT 0,
     number_of_purchases INTEGER DEFAULT 0,
     
     -- Metadados
     campaign_category TEXT, -- Cópia da categoria da campanha para queries rápidas
     store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
     
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW(),
     
     UNIQUE(campaign_id, contact_id, phone) -- Um registro por campanha/cliente/telefone
   );
   
   CREATE INDEX IF NOT EXISTS idx_campaign_tracking_campaign 
     ON sistemaretiradas.campaign_customer_tracking(campaign_id);
   CREATE INDEX IF NOT EXISTS idx_campaign_tracking_contact 
     ON sistemaretiradas.campaign_customer_tracking(contact_id);
   CREATE INDEX IF NOT EXISTS idx_campaign_tracking_category 
     ON sistemaretiradas.campaign_customer_tracking(campaign_category);
   CREATE INDEX IF NOT EXISTS idx_campaign_tracking_sent_at 
     ON sistemaretiradas.campaign_customer_tracking(message_sent_at);
   ```

3. **Função RPC para calcular métricas**:
   - `get_campaign_analytics(campaign_id)`
   - `get_category_analytics(category, start_date, end_date)`
   - `get_customer_responsiveness(contact_id)`

## Interface de Analytics

### Aba Analytics na Página de Campanhas

1. **Visão Geral**:
   - Gráfico de performance por categoria
   - Top 5 campanhas com melhor ROI
   - Taxa de conversão geral

2. **Análise por Categoria**:
   - Comparação de métricas entre categorias
   - Gráfico de barras: Taxa de conversão por categoria
   - Gráfico de linha: Evolução temporal

3. **Análise de Retorno**:
   - Distribuição de tempo de retorno
   - Histograma: Quantos clientes retornaram em X dias
   - Média, mediana, moda

4. **Análise de Clientes**:
   - Clientes mais responsivos
   - Clientes que nunca retornam
   - Segmentação por responsividade

5. **ROI e Faturamento**:
   - Faturamento gerado por categoria
   - Custo vs Retorno
   - Gráfico de ROI por categoria

### Filtros Disponíveis:
- Período (data inicial/final)
- Categoria de campanha
- Loja
- Faixa de tempo de retorno
- Valor mínimo de faturamento gerado

## Recomendações Inteligentes

Sistema sugerirá:
- **Melhor categoria** para cada cliente baseado no histórico
- **Melhor momento** para enviar (dia da semana, horário)
- **Categorias a evitar** para clientes específicos
- **Previsão de retorno** (probabilidade de cliente retornar)

## Próximos Passos

1. ✅ Adicionar campo `category` em `whatsapp_campaigns`
2. ✅ Criar tabela de tracking
3. ✅ Criar função para calcular métricas
4. ✅ Criar página/componente de Analytics
5. ✅ Implementar gráficos e visualizações
6. ✅ Sistema de recomendações
7. ✅ Exportação de relatórios

