# Análise Completa do Fluxo de Pré-requisitos

## 🔍 Fluxo de Dados

### 1. SALVAMENTO (handleSubmit)
**Localização:** `src/components/BonusManagement.tsx:303-305`

```typescript
pre_requisitos: Array.isArray(formData.pre_requisitos) && formData.pre_requisitos.length > 0
    ? JSON.stringify(formData.pre_requisitos.filter(pr => pr && pr.trim()))
    : null,
```

**O que acontece:**
- ✅ Filtra pré-requisitos vazios (`pr && pr.trim()`)
- ✅ Converte array para JSON string: `["texto1", "texto2"]` → `'["texto1","texto2"]'`
- ✅ Salva `null` se não houver pré-requisitos válidos

**Formato no banco:** JSONB (PostgreSQL) ou TEXT com JSON string

---

### 2. CARREGAMENTO (handleEdit)
**Localização:** `src/components/BonusManagement.tsx:67-93` (parsePreRequisitosFromDB)

**O que acontece:**
- ✅ Aceita array direto (se já vier do banco como array)
- ✅ Aceita string JSON (tenta parsear)
- ✅ Aceita string única (compatibilidade com dados antigos)
- ✅ Filtra valores vazios
- ✅ Normaliza para array de strings

**Exemplo:**
```typescript
// Do banco: '["Válido apenas se a loja bater a meta mensal"]'
// Resultado: ["Válido apenas se a loja bater a meta mensal"]
```

---

### 3. VALIDAÇÃO (validateBonusPreRequisitos)
**Localização:** `src/lib/bonusValidation.ts:582-636`

**O que acontece:**
- ✅ Aceita string única ou array (compatibilidade)
- ✅ Converte para array interno
- ✅ Valida CADA pré-requisito individualmente
- ✅ Retorna `isValid: true` apenas se TODOS forem válidos

**Palavras-chave buscadas:**
- `"loja"` + `"meta mensal"` + (`"bater"` OU `"atingir"` OU `"bateu"`)
- `"loja"` + `"super meta mensal"` + (`"bater"` OU `"atingir"` OU `"bateu"`)
- `"loja"` + `"meta semanal"` + (`"bater"` OU `"atingir"` OU `"bateu"`)
- `"loja"` + `"super meta semanal"` + (`"bater"` OU `"atingir"` OU `"bateu"`)
- `"consultora"` OU `"colaboradora"` + `"meta mensal"` + (`"bater"` OU `"atingir"` OU `"bateu"`)
- `"consultora"` OU `"colaboradora"` + `"super meta mensal"` + (`"bater"` OU `"atingir"` OU `"bateu"`)
- `"consultora"` OU `"colaboradora"` + `"meta semanal"` + (`"bater"` OU `"atingir"` OU `"bateu"`)
- `"consultora"` OU `"colaboradora"` + `"super meta semanal"` + (`"bater"` OU `"atingir"` OU `"bateu"`)
- `"consultora"` OU `"colaboradora"` + `"meta diária"` + (`"bater"` OU `"atingir"` OU `"bateu"`)

---

## ✅ Textos Gerados vs Validação

### Textos Gerados no Form:
1. `"Válido apenas se a loja bater a meta mensal"` ✅
2. `"Válido apenas se a loja bater a super meta mensal"` ✅
3. `"Válido apenas se a loja bater a meta semanal"` ✅
4. `"Válido apenas se a loja bater a super meta semanal"` ✅
5. `"Válido apenas se a consultora atingir meta mensal"` ✅
6. `"Válido apenas se a consultora atingir super meta mensal"` ✅
7. `"Válido apenas se a colaboradora atingir meta semanal"` ✅
8. `"Válido apenas se a colaboradora atingir super meta semanal"` ✅
9. `"Válido apenas se a colaboradora atingir meta diária"` ✅

### Verificação de Correspondência:
- ✅ Todos contêm as palavras-chave necessárias
- ✅ Todos usam `.toLowerCase()` na validação (case-insensitive)
- ✅ Todos contêm "bater" ou "atingir" (requisito da validação)

---

## ⚠️ POSSÍVEIS PROBLEMAS IDENTIFICADOS

### 1. Pré-requisitos com valor "NENHUM"
**Problema:** Se o usuário selecionar "NENHUM" e depois adicionar outro pré-requisito, pode ficar um item vazio no array.

**Solução:** Filtrar "NENHUM" e strings vazias antes de salvar.

### 2. Pré-requisitos CUSTOM vazios
**Problema:** Se o usuário selecionar "CUSTOM" mas não preencher o textarea, pode salvar string vazia.

**Solução:** Já está sendo filtrado no `handleSubmit` com `.filter(pr => pr && pr.trim())`.

### 3. Ordem de validação
**Problema:** A validação verifica condições na ordem específica. Se houver múltiplas condições que se sobrepõem, pode dar match errado.

**Solução:** A ordem está correta (super meta antes de meta, mensal antes de semanal).

---

## 🔧 CORREÇÕES NECESSÁRIAS

### 1. Filtrar pré-requisitos "NENHUM" e vazios antes de salvar
**Localização:** `handleSubmit` linha 303-305

**Ação:** Adicionar filtro para remover "NENHUM" e strings vazias.

### 2. Garantir que pré-requisitos CUSTOM não sejam salvos vazios
**Localização:** UI de pré-requisitos

**Ação:** Validar antes de permitir salvar se houver CUSTOM vazio.

### 3. Adicionar logs de debug
**Localização:** `validateBonusPreRequisitos`

**Ação:** Adicionar logs para verificar o que está sendo validado.

---

## 📊 FLUXO COMPLETO

```
1. Usuário seleciona pré-requisitos no form
   ↓
2. Textos são gerados: "Válido apenas se a loja bater a meta mensal"
   ↓
3. Array é criado: ["Válido apenas se a loja bater a meta mensal", "Válido apenas se a consultora atingir meta mensal"]
   ↓
4. handleSubmit filtra vazios e converte para JSON: '["Válido apenas se a loja bater a meta mensal","Válido apenas se a consultora atingir meta mensal"]'
   ↓
5. Salvo no banco como JSONB ou TEXT JSON
   ↓
6. handleEdit carrega e parseia: ["Válido apenas se a loja bater a meta mensal", "Válido apenas se a consultora atingir meta mensal"]
   ↓
7. validateBonusPreRequisitos recebe array ou string JSON
   ↓
8. Converte para array interno
   ↓
9. Valida CADA pré-requisito individualmente
   ↓
10. Retorna isValid: true apenas se TODOS forem válidos
```

---

## ✅ CHECKLIST DE VERIFICAÇÃO

- [x] Textos gerados correspondem às palavras-chave da validação
- [x] Filtro de strings vazias no salvamento
- [x] Parse correto do JSON no carregamento
- [x] Validação aceita array ou string (compatibilidade)
- [ ] Filtrar "NENHUM" antes de salvar
- [ ] Validar CUSTOM não vazio antes de salvar
- [ ] Adicionar logs de debug na validação

