# Guia de Testes - Sistema de Bônus Avançado

Este documento descreve os testes necessários para validar todas as funcionalidades implementadas no sistema de bônus avançado.

## 📋 Checklist de Testes

### ✅ Teste 1: Múltiplos Pré-requisitos

**Objetivo:** Verificar se é possível criar um bônus com múltiplos pré-requisitos.

**Passos:**
1. Acesse o painel de administração
2. Vá em "Gerenciamento de Bônus"
3. Clique em "Criar Novo Bônus"
4. Preencha os dados básicos do bônus
5. Na seção "Pré-requisitos", clique no botão "Adicionar"
6. Selecione um pré-requisito (ex: "Loja deve bater meta mensal")
7. Clique em "Adicionar" novamente
8. Selecione outro pré-requisito (ex: "Colaboradora deve atingir meta mensal")
9. Verifique se ambos os pré-requisitos aparecem na lista
10. Salve o bônus

**Resultado Esperado:**
- ✅ Dois pré-requisitos devem aparecer na lista
- ✅ Cada pré-requisito deve ter um botão "X" para remover
- ✅ O bônus deve ser salvo com sucesso
- ✅ Ao editar o bônus, ambos os pré-requisitos devem aparecer

---

### ✅ Teste 2: Prêmios por Posição (Top 1, 2, 3)

**Objetivo:** Verificar se é possível criar bônus com prêmios diferentes para cada posição.

#### Teste 2.1: Top 1 (Apenas 1º lugar)

**Passos:**
1. Crie um novo bônus
2. Selecione "Condições Básicas"
3. Selecione uma métrica (ex: "Ticket Médio")
4. Selecione "Ranking: Melhor (1º lugar)"
5. Verifique se aparece a seção "Prêmios por Posição"
6. Preencha apenas o prêmio do 1º lugar (ex: R$ 500,00)
7. Salve o bônus

**Resultado Esperado:**
- ✅ Deve aparecer apenas o campo "🥇 1º Lugar"
- ✅ Não deve aparecer campos para 2º e 3º lugar
- ✅ O bônus deve ser salvo com sucesso

#### Teste 2.2: Top 2 (1º e 2º lugar)

**Passos:**
1. Crie um novo bônus
2. Selecione "Condições Básicas"
3. Selecione uma métrica (ex: "PA")
4. Selecione "Ranking: Top 2"
5. Verifique se aparecem os campos para 1º e 2º lugar
6. Preencha:
   - 1º lugar: R$ 500,00
   - 2º lugar: R$ 300,00
7. Salve o bônus

**Resultado Esperado:**
- ✅ Devem aparecer campos "🥇 1º Lugar" e "🥈 2º Lugar"
- ✅ Não deve aparecer campo para 3º lugar
- ✅ O bônus deve ser salvo com sucesso

#### Teste 2.3: Top 3 (1º, 2º e 3º lugar)

**Passos:**
1. Crie um novo bônus
2. Selecione "Condições Básicas"
3. Selecione uma métrica (ex: "Faturamento")
4. Selecione "Ranking: Top 3"
5. Verifique se aparecem os campos para 1º, 2º e 3º lugar
6. Preencha:
   - 1º lugar: R$ 500,00
   - 2º lugar: R$ 300,00
   - 3º lugar: R$ 200,00
7. Salve o bônus

**Resultado Esperado:**
- ✅ Devem aparecer campos "🥇 1º Lugar", "🥈 2º Lugar" e "🥉 3º Lugar"
- ✅ O bônus deve ser salvo com sucesso

#### Teste 2.4: Prêmios Físicos por Posição

**Passos:**
1. Crie um novo bônus com Top 3
2. Na seção "Prêmios por Posição", selecione "🎁 Prêmio Físico"
3. Preencha:
   - 1º lugar: "Airfryer"
   - 2º lugar: "Vale compras R$ 300"
   - 3º lugar: "Kit de produtos"
4. Salve o bônus

**Resultado Esperado:**
- ✅ Os campos devem aceitar texto livre
- ✅ O bônus deve ser salvo com sucesso

---

### ✅ Teste 3: Mensagem WhatsApp com Múltiplos Pré-requisitos

**Objetivo:** Verificar se a mensagem WhatsApp mostra corretamente múltiplos pré-requisitos.

**Passos:**
1. Crie um bônus com múltiplos pré-requisitos
2. Vincule colaboradoras ao bônus (que tenham WhatsApp configurado)
3. Salve o bônus
4. Verifique o WhatsApp da colaboradora

**Resultado Esperado:**
- ✅ A mensagem deve mostrar "Pré-requisitos:" (no plural)
- ✅ Cada pré-requisito deve aparecer numerado (1., 2., etc.)
- ✅ Não deve aparecer "Condições:" na mensagem
- ✅ Deve aparecer apenas "Descrição:" se houver descrição

---

### ✅ Teste 4: Mensagem WhatsApp com Prêmios por Posição

**Objetivo:** Verificar se a mensagem WhatsApp mostra corretamente os prêmios por posição.

**Passos:**
1. Crie um bônus com Top 3 e prêmios diferentes para cada posição
2. Vincule colaboradoras ao bônus
3. Salve o bônus
4. Verifique o WhatsApp da colaboradora

**Resultado Esperado:**
- ✅ A mensagem deve mostrar "Prêmios por Posição:"
- ✅ Deve aparecer:
  - 🥇 1º Lugar: [valor ou descrição]
  - 🥈 2º Lugar: [valor ou descrição]
  - 🥉 3º Lugar: [valor ou descrição]
- ✅ Valores monetários devem estar formatados (R$ 500,00)
- ✅ Prêmios físicos devem aparecer como texto

---

### ✅ Teste 5: Validação de Múltiplos Pré-requisitos na Geração de Troféus

**Objetivo:** Verificar se o sistema valida TODOS os pré-requisitos antes de conceder o bônus.

#### Teste 5.1: Todos os Pré-requisitos Válidos

**Passos:**
1. Crie um bônus com 2 pré-requisitos:
   - "Loja deve bater meta mensal"
   - "Colaboradora deve atingir meta mensal"
2. Configure a loja para bater a meta mensal
3. Configure a colaboradora para atingir a meta mensal
4. Verifique se o bônus aparece como "conquistado" no dashboard

**Resultado Esperado:**
- ✅ O bônus deve aparecer como "conquistado" ✅
- ✅ O troféu deve aparecer

#### Teste 5.2: Um Pré-requisito Inválido

**Passos:**
1. Crie um bônus com 2 pré-requisitos:
   - "Loja deve bater meta mensal"
   - "Colaboradora deve atingir meta mensal"
2. Configure a loja para bater a meta mensal
3. Configure a colaboradora para NÃO atingir a meta mensal
4. Verifique se o bônus aparece como "não conquistado"

**Resultado Esperado:**
- ✅ O bônus NÃO deve aparecer como "conquistado"
- ✅ O troféu NÃO deve aparecer
- ✅ Deve aparecer uma mensagem indicando qual pré-requisito não foi atendido

#### Teste 5.3: Nenhum Pré-requisito Válido

**Passos:**
1. Crie um bônus com 2 pré-requisitos
2. Configure ambos para não serem atendidos
3. Verifique se o bônus não aparece como conquistado

**Resultado Esperado:**
- ✅ O bônus NÃO deve aparecer como "conquistado"
- ✅ O troféu NÃO deve aparecer

---

### ✅ Teste 6: FATURAMENTO como Métrica

**Objetivo:** Verificar se FATURAMENTO funciona como métrica.

**Passos:**
1. Crie um novo bônus
2. Selecione "Condições Básicas"
3. Selecione "Faturamento" como métrica
4. Verifique se aparece o campo "Valor de Faturamento (R$)"
5. Preencha um valor (ex: 50000)
6. Selecione um ranking (ex: Top 1)
7. Salve o bônus

**Resultado Esperado:**
- ✅ FATURAMENTO deve aparecer no select de métricas
- ✅ Deve aparecer campo para valor de faturamento
- ✅ O bônus deve ser salvo com sucesso

---

### ✅ Teste 7: Edição de Bônus com Múltiplos Pré-requisitos

**Objetivo:** Verificar se é possível editar um bônus com múltiplos pré-requisitos.

**Passos:**
1. Crie um bônus com 2 pré-requisitos
2. Salve o bônus
3. Edite o bônus
4. Verifique se ambos os pré-requisitos aparecem
5. Adicione um terceiro pré-requisito
6. Remova um pré-requisito
7. Salve o bônus

**Resultado Esperado:**
- ✅ Todos os pré-requisitos devem aparecer ao editar
- ✅ Deve ser possível adicionar novos pré-requisitos
- ✅ Deve ser possível remover pré-requisitos
- ✅ As alterações devem ser salvas corretamente

---

### ✅ Teste 8: Edição de Bônus com Prêmios por Posição

**Objetivo:** Verificar se é possível editar um bônus com prêmios por posição.

**Passos:**
1. Crie um bônus com Top 3 e prêmios diferentes
2. Salve o bônus
3. Edite o bônus
4. Verifique se todos os prêmios aparecem corretamente
5. Altere os valores dos prêmios
6. Salve o bônus

**Resultado Esperado:**
- ✅ Todos os prêmios devem aparecer ao editar
- ✅ Deve ser possível alterar os valores
- ✅ As alterações devem ser salvas corretamente

---

## 🐛 Problemas Conhecidos

Nenhum problema conhecido no momento.

---

## 📝 Notas de Teste

- **Data dos Testes:** [Preencher]
- **Testador:** [Preencher]
- **Ambiente:** [Produção / Desenvolvimento]
- **Observações:** [Preencher]

---

## ✅ Resultado Final

- [ ] Todos os testes passaram
- [ ] Alguns testes falharam (especificar quais)
- [ ] Problemas encontrados (descrever)

---

## 🔧 Correções Necessárias

[Listar aqui qualquer correção necessária após os testes]

