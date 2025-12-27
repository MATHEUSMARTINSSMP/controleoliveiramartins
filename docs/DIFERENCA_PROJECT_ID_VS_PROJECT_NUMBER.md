# 🔢 Diferença entre Project ID e Project Number

## Resumo Rápido

No formulário do Google Business Profile API, você precisa preencher **AMBOS** os campos:

| Campo | Valor | Onde Encontrar |
|-------|-------|----------------|
| **ID do projeto** | `cosmic-sensor-473804-k9` | ✅ Já temos |
| **Número do projeto** | (número numérico) | ⚠️ Precisa buscar no console |

---

## 1. ID do Projeto (Project ID)

**Valor:** `cosmic-sensor-473804-k9`

- ✅ **Já temos este valor!**
- É um identificador de texto (pode conter letras e números)
- É o nome único do seu projeto no Google Cloud
- Aparece na URL: `https://console.cloud.google.com/?project=cosmic-sensor-473804-k9`
- É usado para identificar o projeto em comandos e APIs

---

## 2. Número do Projeto (Project Number)

**Valor:** Precisa buscar no console (é um número numérico)

- ⚠️ **Precisa buscar este valor**
- É um número numérico (ex: `123456789012`)
- É diferente do Project ID
- É gerado automaticamente pelo Google
- Aparece nas configurações do projeto

### Como encontrar o Project Number:

1. **Acesse:** https://console.cloud.google.com/home/dashboard?project=cosmic-sensor-473804-k9

2. **Opção A - Via Dashboard:**
   - No topo da página, ao lado do nome do projeto
   - Procure por "Project number" ou "Número do projeto"

3. **Opção B - Via Project Settings:**
   - No menu lateral (☰), clique em **"IAM & Admin"** → **"Settings"** (ou "Configurações")
   - Ou vá direto em: https://console.cloud.google.com/iam-admin/settings?project=cosmic-sensor-473804-k9
   - O **Project number** aparece no topo da página, logo abaixo do Project ID

4. **Opção C - Via Project Info (Info do Projeto):**
   - Clique no dropdown do projeto no topo (ao lado do nome)
   - Selecione "Project settings" ou "Configurações do projeto"
   - O Project Number aparece na primeira linha

---

## 📝 Exemplo Visual

Quando você acessar o console, verá algo assim:

```
Project: cosmic-sensor-473804-k9
Project Number: 123456789012  ← Este é o número que você precisa!
```

---

## ⚠️ Importante

- **AMBOS** os campos são obrigatórios no formulário
- O **Project ID** é `cosmic-sensor-473804-k9` (texto)
- O **Project Number** é um número numérico (precisa buscar)
- Eles são **diferentes** e servem para propósitos diferentes

---

## 🔗 Links Úteis

- **Dashboard do Projeto:** https://console.cloud.google.com/home/dashboard?project=cosmic-sensor-473804-k9
- **Project Settings:** https://console.cloud.google.com/iam-admin/settings?project=cosmic-sensor-473804-k9

