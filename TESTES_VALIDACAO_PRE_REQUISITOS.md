# 🧪 TESTES DE VALIDAÇÃO DE PRÉ-REQUISITOS DE BÔNUS

## 📋 GUIA DE TESTES

Este documento contém os testes recomendados para validar o funcionamento dos pré-requisitos de bônus.

---

## ✅ TESTE 1: Loja bateu meta mensal

### Objetivo
Verificar se o bônus é concedido apenas quando a loja bateu a meta mensal.

### Pré-condições
1. Criar um bônus com pré-requisito: **"Válido apenas se a loja bater a meta mensal"**
2. Vincular uma colaboradora ao bônus
3. Configurar meta mensal da loja (ex: R$ 50.000)
4. Configurar meta individual da colaboradora (ex: R$ 5.000)

### Cenário 1: Loja bateu meta, colaboradora bateu meta
1. Fazer vendas da loja totalizando R$ 50.000 ou mais
2. Fazer vendas da colaboradora totalizando R$ 5.000 ou mais (100% da meta)
3. **Resultado esperado**: ✅ Bônus deve ser concedido

### Cenário 2: Loja NÃO bateu meta, colaboradora bateu meta
1. Fazer vendas da loja totalizando menos de R$ 50.000 (ex: R$ 45.000)
2. Fazer vendas da colaboradora totalizando R$ 5.000 ou mais (100% da meta)
3. **Resultado esperado**: ❌ Bônus NÃO deve ser concedido
4. **Mensagem esperada**: "Loja não bateu meta mensal (45000.00 / 50000.00)"

### Onde verificar
- **Admin Dashboard** → Acompanhamento de Metas → Bônus Ativos
- Verificar se colaboradora aparece como "achieved" ou não
- Verificar mensagem de alerta se pré-requisitos não foram cumpridos

---

## ✅ TESTE 2: Colaboradora bateu meta mensal

### Objetivo
Verificar se o bônus é concedido apenas quando a colaboradora bateu a meta mensal.

### Pré-condições
1. Criar um bônus com pré-requisito: **"Válido apenas se a consultora atingir meta mensal"**
2. Vincular uma colaboradora ao bônus
3. Configurar meta individual da colaboradora (ex: R$ 5.000)

### Cenário 1: Colaboradora bateu meta
1. Fazer vendas da colaboradora totalizando R$ 5.000 ou mais (100% da meta)
2. **Resultado esperado**: ✅ Bônus deve ser concedido quando bater condição do bônus

### Cenário 2: Colaboradora NÃO bateu meta
1. Fazer vendas da colaboradora totalizando menos de R$ 5.000 (ex: R$ 4.500)
2. **Resultado esperado**: ❌ Bônus NÃO deve ser concedido
3. **Mensagem esperada**: "Colaboradora não bateu meta mensal (4500.00 / 5000.00)"

### Onde verificar
- **Admin Dashboard** → Acompanhamento de Metas → Bônus Ativos
- Verificar se colaboradora aparece como "achieved" ou não
- Verificar mensagem de alerta se pré-requisitos não foram cumpridos

---

## ✅ TESTE 3: Loja bateu meta semanal

### Objetivo
Verificar se o bônus semanal é concedido apenas quando a loja bateu a meta semanal.

### Pré-condições
1. Criar um bônus semanal (META_SEMANAL) com pré-requisito: **"Válido apenas se a loja bater a meta semanal"**
2. Vincular uma colaboradora ao bônus
3. Configurar meta mensal da loja (ex: R$ 50.000)
4. Configurar meta individual da colaboradora (ex: R$ 5.000)

### Cenário 1: Loja bateu meta semanal, colaboradora bateu meta semanal
1. Calcular meta semanal da loja (baseado em daily_weights ou divisão igual)
2. Fazer vendas da loja na semana totalizando meta semanal ou mais
3. Fazer vendas da colaboradora na semana totalizando meta semanal ou mais
4. **Resultado esperado**: ✅ Bônus deve ser concedido

### Cenário 2: Loja NÃO bateu meta semanal, colaboradora bateu meta semanal
1. Fazer vendas da loja na semana totalizando menos que a meta semanal
2. Fazer vendas da colaboradora na semana totalizando meta semanal ou mais
3. **Resultado esperado**: ❌ Bônus NÃO deve ser concedido
4. **Mensagem esperada**: "Loja não bateu meta semanal (X / Y)"

### Onde verificar
- **Loja Dashboard** → Bônus Semanal
- Verificar se colaboradora aparece como "ATINGIDO" ou não
- Verificar mensagem de alerta se pré-requisitos não foram cumpridos

---

## ✅ TESTE 4: Colaboradora bateu meta semanal

### Objetivo
Verificar se o bônus semanal é concedido apenas quando a colaboradora bateu a meta semanal.

### Pré-condições
1. Criar um bônus semanal (META_SEMANAL) com pré-requisito: **"Válido apenas se a colaboradora atingir meta semanal"**
2. Vincular uma colaboradora ao bônus
3. Configurar meta individual da colaboradora (ex: R$ 5.000 mensal)

### Cenário 1: Colaboradora bateu meta semanal
1. Calcular meta semanal da colaboradora (baseado em daily_weights ou divisão igual)
2. Fazer vendas da colaboradora na semana totalizando meta semanal ou mais
3. **Resultado esperado**: ✅ Bônus deve ser concedido

### Cenário 2: Colaboradora NÃO bateu meta semanal
1. Fazer vendas da colaboradora na semana totalizando menos que a meta semanal
2. **Resultado esperado**: ❌ Bônus NÃO deve ser concedido
3. **Mensagem esperada**: "Colaboradora não bateu meta semanal (X / Y)"

### Onde verificar
- **Loja Dashboard** → Bônus Semanal
- Verificar se colaboradora aparece como "ATINGIDO" ou não
- Verificar mensagem de alerta se pré-requisitos não foram cumpridos

---

## ✅ TESTE 5: Bônus sem pré-requisitos

### Objetivo
Verificar se bônus sem pré-requisitos funcionam normalmente.

### Pré-condições
1. Criar um bônus SEM pré-requisitos
2. Vincular uma colaboradora ao bônus

### Cenário
1. Fazer colaboradora bater condição do bônus (ex: 100% da meta)
2. **Resultado esperado**: ✅ Bônus deve ser concedido normalmente (sem validação de pré-requisitos)

### Onde verificar
- **Admin Dashboard** → Acompanhamento de Metas → Bônus Ativos
- Verificar se colaboradora aparece como "achieved"

---

## ✅ TESTE 6: Múltiplos pré-requisitos (futuro)

### Objetivo
Verificar se sistema suporta múltiplos pré-requisitos (quando implementado).

### Nota
Atualmente, o sistema suporta apenas um pré-requisito por bônus. Se no futuro for implementado suporte a múltiplos pré-requisitos, este teste deve ser executado.

---

## 📊 CHECKLIST DE VALIDAÇÃO

### Funcionalidades Básicas
- [ ] Campo de pré-requisitos aparece no formulário de criação/edição de bônus
- [ ] Pré-requisitos são salvos corretamente no banco de dados
- [ ] Pré-requisitos são exibidos na mensagem WhatsApp quando bônus é criado

### Validação de Pré-requisitos
- [ ] Loja bateu meta mensal → validação funciona
- [ ] Colaboradora bateu meta mensal → validação funciona
- [ ] Loja bateu meta semanal → validação funciona
- [ ] Colaboradora bateu meta semanal → validação funciona
- [ ] Bônus sem pré-requisitos → funciona normalmente

### Interface
- [ ] Admin Dashboard (BonusTracker) exibe mensagem quando pré-requisitos não cumpridos
- [ ] Loja Dashboard (WeeklyBonusProgress) exibe mensagem quando pré-requisitos não cumpridos
- [ ] Mensagens são claras e explicam o motivo

### Casos Especiais
- [ ] Meta não encontrada → exibe mensagem apropriada
- [ ] Erro na validação → exibe mensagem de erro
- [ ] Pré-requisito não reconhecido → exibe mensagem apropriada

---

## 🐛 PROBLEMAS CONHECIDOS

### Nenhum problema conhecido no momento

---

## 📝 NOTAS DE TESTE

### Como executar os testes
1. Acessar Admin Dashboard
2. Criar bônus com pré-requisitos conforme descrito
3. Vincular colaboradoras
4. Simular vendas conforme cenários
5. Verificar resultados nos dashboards

### Dados de teste recomendados
- **Loja**: Loungerie (ID: 5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b)
- **Colaboradora de teste**: Qualquer colaboradora ativa
- **Meta mensal loja**: R$ 50.000
- **Meta mensal colaboradora**: R$ 5.000

---

**Data de criação**: 2025-01-25
**Última atualização**: 2025-01-25

