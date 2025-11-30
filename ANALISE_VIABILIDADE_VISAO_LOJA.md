# 📊 Análise de Viabilidade: Integração Visão Loja

## 🎯 Objetivo
Integrar o ERP Visão Loja com o sistema, permitindo que:
- Vendas sejam criadas automaticamente a partir de pedidos do Visão Loja
- Metas sejam contabilizadas automaticamente para cada colaboradora
- Não seja necessário lançar vendas manualmente

## ✅ Situação Atual

### Sistema Tiny ERP (Referência)
1. **Estrutura de Dados:**
   - Tabela `tiny_orders`: Armazena pedidos sincronizados do Tiny
   - Tabela `tiny_contacts`: Armazena clientes do Tiny
   - Tabela `tiny_products`: Armazena produtos do Tiny
   - Campo `sistema_erp` na tabela `stores`: Identifica qual ERP a loja usa

2. **Sincronização:**
   - Função `sync-tiny-orders-background.js`: Sincroniza pedidos do Tiny
   - Edge Function `sync-tiny-orders`: Orquestra a sincronização
   - Cron jobs: Executam sincronização automática a cada X minutos

3. **Matching de Colaboradoras:**
   - Campo `tiny_vendedor_id` na tabela `profiles`
   - Prioridade de matching: CPF > `tiny_vendedor_id` > Email > Nome normalizado
   - Função `findCollaboratorByVendedor` no sync-tiny-orders-background.js

4. **Criação de Vendas:**
   - ❌ **ATUALMENTE NÃO EXISTE**: Não há conversão automática de `tiny_orders` → `sales`
   - Vendas são criadas manualmente no dashboard da loja
   - Metas são calculadas a partir da tabela `sales` (não de `tiny_orders`)

## 🔍 Análise de Viabilidade

### ✅ Pontos Positivos

1. **Estrutura Genérica Já Existe:**
   - Sistema já suporta múltiplos ERPs (`erpIntegrations.ts`)
   - Campo `sistema_erp` na tabela `stores` permite identificar qual ERP usar
   - Estrutura de `erp_integrations` já suporta diferentes sistemas

2. **Matching de Colaboradoras Funciona:**
   - Sistema de matching já implementado e testado
   - Pode ser adaptado para Visão Loja (usar ID do vendedor do Visão Loja)

3. **Metas Já São Calculadas Automaticamente:**
   - Sistema já calcula metas a partir da tabela `sales`
   - Se criarmos `sales` automaticamente, as metas serão atualizadas automaticamente

### ⚠️ Pontos de Atenção

1. **API do Visão Loja:**
   - ❓ **NECESSÁRIO VERIFICAR**: Visão Loja tem API? Qual formato?
   - ❓ **NECESSÁRIO VERIFICAR**: Como autenticar? OAuth? Token? API Key?
   - ❓ **NECESSÁRIO VERIFICAR**: Quais endpoints disponíveis? (pedidos, vendedores, clientes)

2. **Conversão Automática de Pedidos → Vendas:**
   - ❌ **NÃO EXISTE ATUALMENTE**: Precisa ser implementado
   - Seria necessário criar uma função/trigger que:
     - Detecta novos pedidos em `visao_loja_orders` (ou similar)
     - Cria registro correspondente em `sales`
     - Mapeia colaboradora corretamente
     - Calcula quantidade de peças

3. **Estrutura de Dados:**
   - Precisa criar tabelas similares a `tiny_*`:
     - `visao_loja_orders` (ou usar tabela genérica `erp_orders`)
     - `visao_loja_contacts` (ou usar tabela genérica `erp_contacts`)
   - Ou criar estrutura genérica que funcione para ambos

4. **Mapeamento de Colaboradoras:**
   - Precisa adicionar campo `visao_loja_vendedor_id` na tabela `profiles`
   - Ou usar campo genérico `erp_vendedor_id` com `sistema_erp` para identificar

## 💡 Recomendações

### Opção 1: Estrutura Específica (Mais Rápida)
Criar tabelas específicas para Visão Loja, similar ao Tiny:
- `visao_loja_orders`
- `visao_loja_contacts`
- `visao_loja_products`
- Campo `visao_loja_vendedor_id` em `profiles`

**Vantagens:**
- Implementação mais rápida
- Reutiliza código existente do Tiny
- Menos risco de quebrar sistema atual

**Desvantagens:**
- Duplicação de código
- Manutenção mais complexa (duas estruturas)

### Opção 2: Estrutura Genérica (Mais Escalável)
Criar tabelas genéricas que funcionam para qualquer ERP:
- `erp_orders` (com campo `sistema_erp`)
- `erp_contacts` (com campo `sistema_erp`)
- `erp_products` (com campo `sistema_erp`)
- Campo `erp_vendedor_id` + `sistema_erp` em `profiles`

**Vantagens:**
- Mais escalável (fácil adicionar novos ERPs)
- Código único para todos os ERPs
- Manutenção mais simples

**Desvantagens:**
- Refatoração maior do código existente
- Mais tempo de desenvolvimento
- Risco de quebrar sistema atual

### Opção 3: Híbrida (Recomendada)
Manter estrutura atual do Tiny, mas criar funções genéricas:
- Manter `tiny_orders`, `tiny_contacts`, etc.
- Criar `visao_loja_orders`, `visao_loja_contacts`, etc.
- Criar função genérica `createSalesFromERPOrders(sistema_erp)` que funciona para ambos

**Vantagens:**
- Não quebra sistema atual
- Permite evoluir para estrutura genérica no futuro
- Implementação incremental

## 📋 Checklist de Implementação

### Fase 1: Investigação (ANTES DE COMEÇAR)
- [ ] Verificar se Visão Loja tem API
- [ ] Documentar endpoints disponíveis
- [ ] Verificar método de autenticação
- [ ] Testar acesso à API
- [ ] Verificar estrutura de dados retornados

### Fase 2: Estrutura de Dados
- [ ] Criar tabelas para Visão Loja (ou genéricas)
- [ ] Adicionar campo de identificação de vendedor em `profiles`
- [ ] Criar migrations necessárias

### Fase 3: Sincronização
- [ ] Criar função de sincronização de pedidos (similar a `sync-tiny-orders-background.js`)
- [ ] Criar Edge Function para orquestrar sincronização
- [ ] Configurar cron jobs para sincronização automática

### Fase 4: Matching de Colaboradoras
- [ ] Adaptar função de matching para Visão Loja
- [ ] Mapear colaboradoras existentes
- [ ] Testar matching automático

### Fase 5: Conversão Automática de Vendas
- [ ] Criar função/trigger que converte pedidos → vendas
- [ ] Testar criação automática de vendas
- [ ] Verificar se metas são atualizadas automaticamente

### Fase 6: Testes e Validação
- [ ] Testar sincronização completa
- [ ] Validar que vendas são criadas corretamente
- [ ] Verificar que metas são contabilizadas
- [ ] Testar com dados reais

## ❓ Perguntas para o Cliente

1. **API do Visão Loja:**
   - Visão Loja tem API disponível?
   - Qual o formato? REST? SOAP?
   - Como autenticar? (OAuth, Token, API Key)
   - Há documentação disponível?

2. **Dados Disponíveis:**
   - A API retorna pedidos/vendas?
   - A API retorna vendedores/colaboradores?
   - A API retorna clientes?
   - Qual a estrutura dos dados?

3. **Mapeamento:**
   - Como identificar colaboradoras no Visão Loja? (ID, CPF, Email, Nome?)
   - As colaboradoras já estão cadastradas no sistema?
   - Precisa mapear manualmente ou pode ser automático?

4. **Escopo:**
   - Apenas vendas novas (daqui pra frente)?
   - Precisa sincronizar histórico?
   - Qual frequência de sincronização? (tempo real, a cada X minutos?)

## 🎯 Conclusão

### Viabilidade: ✅ ALTA

**Motivos:**
1. Sistema já tem estrutura para múltiplos ERPs
2. Matching de colaboradoras já funciona
3. Metas já são calculadas automaticamente
4. Apenas falta criar conversão automática de pedidos → vendas

**Próximos Passos:**
1. **INVESTIGAR API DO VISÃO LOJA** (crítico - sem isso não dá pra começar)
2. Escolher opção de implementação (recomendo Opção 3: Híbrida)
3. Implementar sincronização de pedidos
4. Implementar conversão automática de vendas
5. Testar e validar

**Riscos:**
- ⚠️ Se Visão Loja não tiver API, será necessário outra abordagem (webhook, exportação, etc.)
- ⚠️ Se estrutura de dados for muito diferente, pode precisar de mais adaptações

