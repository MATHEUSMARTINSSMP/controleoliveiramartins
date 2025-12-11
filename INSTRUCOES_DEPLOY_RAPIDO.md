# 🚀 INSTRUÇÕES RÁPIDAS: Deploy da Edge Function

## ⚠️ IMPORTANTE: Como Copiar o Código Corretamente

O erro "Expression expected" geralmente acontece quando há caracteres invisíveis ou comentários no início do arquivo.

## ✅ SOLUÇÃO: Use o arquivo `EDGE_FUNCTION_CODIGO_COMPLETO.txt`

1. **Abra o arquivo**: `EDGE_FUNCTION_CODIGO_COMPLETO.txt`
2. **Selecione TODO o conteúdo** (Ctrl+A ou Cmd+A)
3. **Copie** (Ctrl+C ou Cmd+C)
4. **Cole no Supabase Dashboard**

---

## 📋 PASSO A PASSO NO SUPABASE DASHBOARD

### 1. Acesse Edge Functions
```
https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions
```

### 2. Criar Nova Função
- Clique em **"Create a new function"**
- **Nome**: `process-time-clock-notifications`
- **Descrição**: `Processa fila de notificações de ponto`

### 3. Copiar Código
- **NÃO copie do arquivo `.ts` diretamente**
- **Use o arquivo `EDGE_FUNCTION_CODIGO_COMPLETO.txt`**
- Selecione TODO o conteúdo (do primeiro `import` até o último `})`)
- Cole no editor do Dashboard

### 4. Deploy
- Clique em **"Deploy"**
- Aguarde alguns segundos

---

## ✅ VERIFICAÇÃO

Após o deploy, você deve ver:
- ✅ Status: "Active"
- ✅ Última atualização: Data/hora atual
- ✅ Botão "Invoke" disponível

---

## 🧪 TESTE RÁPIDO

Após o deploy, clique em **"Invoke"** e deixe o body vazio: `{}`

Você deve receber uma resposta JSON como:
```json
{
  "success": true,
  "processed": 0,
  "sent": 0,
  "failed": 0
}
```

---

## 🐛 SE AINDA DER ERRO

1. **Limpe o editor completamente** (delete tudo)
2. **Copie novamente do arquivo `EDGE_FUNCTION_CODIGO_COMPLETO.txt`**
3. **Certifique-se de que não há espaços ou caracteres antes do primeiro `import`**
4. **A primeira linha deve ser exatamente**: `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'`

---

## 📝 PRÓXIMO PASSO

Após o deploy bem-sucedido, configure o cron job usando os comandos em `COMANDOS_RAPIDOS_NOTIFICACOES_PONTO.sql`

