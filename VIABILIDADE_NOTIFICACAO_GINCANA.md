# 📊 VIABILIDADE: Notificações WhatsApp para Gincanas Semanais

## 🎯 OBJETIVO
Enviar notificações WhatsApp para colaboradoras quando uma nova gincana semanal for criada, permitindo:
- Escolher a loja
- Ativar/desativar colaboradoras que vão receber
- Incluir condições, prêmio e vigência do bônus

---

## ✅ VIABILIDADE TÉCNICA: **ALTA**

### 1. **Sistema de WhatsApp já existe e funciona**
- ✅ Função `sendWhatsAppMessage()` em `src/lib/whatsapp.ts`
- ✅ Netlify Function `send-whatsapp-message` configurada
- ✅ Sistema já usado para vendas e adiantamentos

### 2. **Estrutura de dados disponível**
- ✅ Tabela `whatsapp_notification_config` para configurar destinatários
- ✅ Tabela `bonuses` com todas as informações necessárias
- ✅ Tabela `goals` com gincanas semanais (`tipo = 'SEMANAL'`)
- ✅ Tabela `profiles` com dados das colaboradoras (incluindo telefone, se disponível)

### 3. **Sistema de gincanas já implementado**
- ✅ `WeeklyGoalsManagement.tsx` - Interface para criar/editar gincanas
- ✅ Sistema de ativar/desativar colaboradoras já existe
- ✅ Seleção de loja já implementada

---

## 🔍 ANÁLISE DO SISTEMA ATUAL

### **Como funciona hoje:**

#### **1. Notificações WhatsApp (Vendas/Adiantamentos)**
```
Fluxo:
1. Evento ocorre (venda/adiantamento)
2. Busca destinatários em `whatsapp_notification_config`
   - Filtra por `admin_id`, `notification_type`, `store_id`
3. Formata mensagem com `formatVendaMessage()` ou `formatAdiantamentoMessage()`
4. Envia via `sendWhatsAppMessage()` para cada destinatário
```

#### **2. Gincanas Semanais**
```
Fluxo:
1. Admin seleciona loja e semana
2. Seleciona colaboradoras (ativar/desativar)
3. Define meta e super meta
4. Salva em `goals` com:
   - `tipo = 'SEMANAL'`
   - `semana_referencia` (formato: WWYYYY)
   - `colaboradora_id` (para cada colaboradora)
   - `meta_valor` e `super_meta_valor`
```

---

## 📋 O QUE PRECISA SER IMPLEMENTADO

### **1. Nova função de formatação de mensagem**
**Arquivo:** `src/lib/whatsapp.ts`

```typescript
export function formatGincanaMessage(params: {
  colaboradoraName: string;
  storeName: string;
  semanaReferencia: string; // WWYYYY
  metaValor: number;
  superMetaValor: number | null;
  premio?: string; // Texto do prêmio (ex: "Airfryer" ou "R$ 500")
  condicoes?: string; // Condições do bônus
  dataInicio: string; // Data de início da semana
  dataFim: string; // Data de fim da semana
}): string
```

### **2. Integração no WeeklyGoalsManagement**
**Arquivo:** `src/components/WeeklyGoalsManagement.tsx`

**Modificações necessárias:**
- Após salvar gincanas com sucesso, buscar colaboradoras selecionadas
- Para cada colaboradora ativa:
  - Buscar telefone (se disponível em `profiles` ou em nova tabela)
  - Formatar mensagem com dados da gincana
  - Enviar WhatsApp

**Desafio:** Colaboradoras podem não ter telefone cadastrado no sistema.

### **3. Configuração de destinatários**
**Solução escolhida:** Campo `whatsapp` na tabela `profiles`

- ✅ Mais simples e direto
- ✅ Já está atrelado ao cadastro da colaboradora
- ✅ Campo obrigatório no cadastro
- ✅ Não precisa de tabela separada

### **4. Controle de notificações**
**Solução:** Campo `enviar_notificacao_gincana` na tabela `bonuses`

- ✅ Notificação controlada pelo bônus, não pelo perfil
- ✅ Cada bônus pode ter sua própria configuração
- ✅ Se bônus está ativo e corresponde à gincana → envia notificação

### **5. Seleção de colaboradoras na criação da gincana**
**Arquivo:** `src/components/WeeklyGoalsManagement.tsx`

**Já existe!** O sistema já permite:
- Selecionar loja
- Ativar/desativar colaboradoras
- Ver lista de colaboradoras da loja

**O que falta:**
- Após salvar gincana, buscar bônus ativos relacionados
- Para cada colaboradora que recebeu a gincana:
  1. Verificar se tem WhatsApp cadastrado
  2. Verificar se há bônus ativo com `enviar_notificacao_gincana = true` que corresponde à gincana
  3. Se sim, enviar notificação com informações do bônus

---

## 🎨 ESTRUTURA DA MENSAGEM

### **Exemplo de mensagem:**

```
🎯 *Nova Gincana Semanal!*

Olá, [Nome da Colaboradora]!

Uma nova gincana semanal foi criada para você:

*Loja:* [Nome da Loja]
*Período:* [Data Início] a [Data Fim]
*Semana:* Semana [XX] de [YYYY]

*Metas:*
• Meta: R$ [valor]
• Super Meta: R$ [valor] (opcional)

*Prêmio:*
[Prêmio em dinheiro ou físico]

*Condições:*
[Descrição das condições do bônus]

Boa sorte! 💪

Sistema EleveaOne 📊
```

---

## ⚠️ DESAFIOS E CONSIDERAÇÕES

### **1. Telefone das colaboradoras**
- ❓ **Problema:** Colaboradoras podem não ter telefone cadastrado
- ✅ **Solução:** Campo obrigatório no cadastro de colaboradora
- ✅ **Validação:** Verificar se tem WhatsApp antes de enviar

### **2. Bônus associados**
- ✅ **Solução:** Buscar bônus ativos que correspondem à gincana
- ✅ Critérios de correspondência:
  - `periodo_semana` = semana da gincana
  - `store_id` = loja da gincana (ou NULL para todas)
  - `condicao_meta_tipo` = 'GINCANA_SEMANAL' ou 'SUPER_GINCANA_SEMANAL'
  - `ativo` = true
  - `enviar_notificacao_gincana` = true

### **3. Múltiplas gincanas simultâneas**
- ⚠️ Colaboradora pode receber várias gincanas
- ✅ Enviar uma mensagem por gincana
- ✅ Agrupar bônus relacionados na mesma mensagem (opcional)

### **4. Vigência**
- ✅ Já temos `semana_referencia` (WWYYYY)
- ✅ Calcular data início/fim da semana
- ✅ Incluir na mensagem

---

## 📊 ESTRUTURA DE DADOS NECESSÁRIA

### **1. Adicionar campo `whatsapp` na tabela `profiles`:**
```sql
ALTER TABLE sistemaretiradas.profiles
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;
```

### **2. Adicionar campo `enviar_notificacao_gincana` na tabela `bonuses`:**
```sql
ALTER TABLE bonuses
  ADD COLUMN IF NOT EXISTS enviar_notificacao_gincana BOOLEAN DEFAULT true;
```

**Lógica:**
- Quando uma gincana semanal é criada, o sistema busca bônus ativos relacionados
- Se o bônus tem `enviar_notificacao_gincana = true` e corresponde à gincana (semana, loja, tipo), envia notificação
- A notificação inclui informações do bônus (prêmio, condições)

---

## 🚀 PLANO DE IMPLEMENTAÇÃO

### **FASE 1: Estrutura de dados**
1. ✅ Criar tabela `colaboradora_whatsapp` (se Opção B)
2. ✅ Criar interface para cadastrar telefones
3. ✅ Adicionar RLS policies

### **FASE 2: Função de formatação**
1. ✅ Criar `formatGincanaMessage()` em `whatsapp.ts`
2. ✅ Testar formatação da mensagem

### **FASE 3: Integração**
1. ✅ Modificar `WeeklyGoalsManagement.tsx`
2. ✅ Adicionar checkbox "Enviar notificação?"
3. ✅ Buscar telefones das colaboradoras selecionadas
4. ✅ Enviar mensagens após salvar gincana

### **FASE 4: Buscar informações do bônus**
1. ✅ Buscar bônus ativo para a semana/loja
2. ✅ Incluir prêmio e condições na mensagem

### **FASE 5: Testes**
1. ✅ Testar envio para uma colaboradora
2. ✅ Testar com múltiplas colaboradoras
3. ✅ Testar sem telefone cadastrado
4. ✅ Validar formatação da mensagem

---

## ✅ CONCLUSÃO

### **VIABILIDADE: ALTA ✅**

**Pontos positivos:**
- ✅ Sistema de WhatsApp já funciona
- ✅ Estrutura de gincanas já existe
- ✅ Seleção de colaboradoras já implementada
- ✅ Apenas precisa integrar os sistemas

**Pontos de atenção:**
- ⚠️ Necessário cadastrar telefones das colaboradoras
- ⚠️ Considerar privacidade dos dados
- ⚠️ Definir se bônus sempre está associado à gincana

**Tempo estimado:** 4-6 horas de desenvolvimento

**Complexidade:** Média (integração de sistemas existentes)

---

## 📝 PRÓXIMOS PASSOS

1. **Decidir:** Opção A (whatsapp_notification_config) ou Opção B (tabela separada)?
2. **Definir:** Bônus sempre está associado à gincana?
3. **Confirmar:** Colaboradoras podem desativar notificações?
4. **Implementar:** Seguir plano de implementação acima

