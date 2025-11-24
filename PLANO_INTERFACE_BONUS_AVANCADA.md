# Plano: Interface Avançada de Bônus

## Estrutura de Condições

### 1. Condições Básicas (Rankings e Métricas)
- **Ticket Médio**
  - Melhor Ticket Médio
  - Top 2 Melhores Tickets Médios
  - Top 3 Melhores Tickets Médios
  
- **PA (Peças por Atendimento)**
  - Melhor PA
  - Top 2 Melhores PA
  - Top 3 Melhores PA

### 2. Filtros Avançados (Metas e Gincanas)

#### Metas de Loja:
- Loja bater Meta Mensal
- Loja bater Meta Semanal
- Loja bater Meta Diária
- Loja bater X Faturamento (valor específico)
- Loja bater Super Meta Mensal
- Loja bater Super Meta Semanal

#### Metas de Colaboradora:
- Colaboradora bater Meta Mensal
- Colaboradora bater Meta Diária
- Colaboradora bater Super Meta
- Colaboradora bater Gincana Semanal
- Colaboradora bater Super Gincana Semanal

### 3. Período de Referência
- **Data X a Data X** (período customizado)
- **Mês X** (mês específico: Janeiro/2025, etc)
- **Semana X** (semana específica: Semana 1/2025, etc)

## Estrutura de Dados no Banco

### Campos Adicionais Necessários:
```sql
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS condicao_tipo TEXT; -- 'TICKET_MEDIO', 'PA', 'META_LOJA', 'META_COLAB', etc
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS condicao_ranking INTEGER; -- 1, 2, 3 para top rankings
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS condicao_meta_tipo TEXT; -- 'MENSAL', 'SEMANAL', 'DIARIA', 'SUPER_META', etc
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS condicao_faturamento DECIMAL; -- Para "bater X faturamento"
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS periodo_tipo TEXT; -- 'CUSTOM', 'MES', 'SEMANA'
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS periodo_data_inicio DATE;
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS periodo_data_fim DATE;
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS periodo_mes TEXT; -- 'YYYYMM' format
ALTER TABLE bonuses ADD COLUMN IF NOT EXISTS periodo_semana TEXT; -- 'WWYYYY' format
```

## Interface do Usuário

### Estrutura do Formulário:

1. **Informações Básicas** (já existe)
   - Nome do Bônus
   - Descrição
   - Tipo (VALOR_FIXO, PERCENTUAL, PRODUTO)
   - Valor do Bônus

2. **Seção: Condição Principal**
   - Radio buttons ou Select:
     - [ ] Condições Básicas (Rankings)
     - [ ] Filtros Avançados (Metas)

3. **Seção: Condições Básicas** (se selecionado)
   - Métrica:
     - [ ] Ticket Médio
     - [ ] PA (Peças por Atendimento)
   - Ranking:
     - [ ] Melhor (1º lugar)
     - [ ] Top 2
     - [ ] Top 3

4. **Seção: Filtros Avançados** (se selecionado)
   - Escopo:
     - [ ] Loja
     - [ ] Colaboradora
   - Tipo de Meta:
     - [ ] Meta Mensal
     - [ ] Meta Semanal
     - [ ] Meta Diária
     - [ ] Super Meta Mensal
     - [ ] Super Meta Semanal
     - [ ] Gincana Semanal
     - [ ] Super Gincana Semanal
     - [ ] Faturamento X (com campo de valor)

5. **Seção: Período de Referência**
   - Tipo:
     - [ ] Período Customizado (Data Início - Data Fim)
     - [ ] Mês Específico (Seletor de mês/ano)
     - [ ] Semana Específica (Seletor de semana/ano)

6. **Loja** (já existe)
   - Todas ou Loja específica

## Fluxo de Implementação

1. ✅ Corrigir mensagem WhatsApp (forma de pagamento) - FEITO
2. Atualizar schema do banco (adicionar novos campos)
3. Atualizar interface BonusManagement.tsx
4. Atualizar lógica de cálculo de bônus
5. Testar todas as condições

