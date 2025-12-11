# 🚀 Deploy da Edge Function: process-time-clock-notifications

## Método 1: Via Supabase CLI (Recomendado)

### 1. Instalar Supabase CLI (se ainda não tiver)

```bash
npm install -g supabase
```

### 2. Login no Supabase

```bash
supabase login
```

Isso abrirá seu navegador para autenticação.

### 3. Linkar ao projeto

```bash
cd /home/matheusmartins/controleoliveiramartins-1
supabase link --project-ref kktsbnrnlnzyofupegjc
```

Quando solicitado, insira o `db_password` (senha do banco de dados do Supabase).

### 4. Fazer deploy da função

```bash
supabase functions deploy process-time-clock-notifications
```

---

## Método 2: Via Supabase Dashboard (Web)

### 1. Acessar Edge Functions

Abra no navegador:
```
https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions
```

### 2. Criar nova função

1. Clique em **"Create a new function"**
2. Nome: `process-time-clock-notifications`
3. Descrição: `Processa fila de notificações de ponto e envia via WhatsApp`

### 3. Copiar código

1. Abra o arquivo: `supabase/functions/process-time-clock-notifications/index.ts`
2. Copie TODO o conteúdo
3. Cole no editor do Supabase Dashboard

### 4. Deploy

1. Clique em **"Deploy"**
2. Aguarde o deploy completar (pode levar alguns segundos)

---

## Método 3: Via API (Script)

```bash
# Fazer login e obter access token
supabase login

# Deploy via CLI
supabase functions deploy process-time-clock-notifications \
  --project-ref kktsbnrnlnzyofupegjc
```

---

## ✅ Verificar se Deploy Funcionou

Após o deploy, acesse:

```
https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions/process-time-clock-notifications
```

Você deve ver:
- ✅ Status: "Active"
- ✅ Última atualização: Data/hora atual
- ✅ Botão "Invoke" disponível

---

## 🧪 Testar Manualmente

### Via Dashboard:

1. Vá em: Edge Functions → `process-time-clock-notifications`
2. Clique em **"Invoke"**
3. Deixe o body vazio: `{}`
4. Clique em **"Invoke Function"**
5. Verifique a resposta JSON

### Via Terminal (usando o script):

```bash
./TESTE_EDGE_FUNCTION.sh
```

Ou manualmente:

```bash
curl -X POST 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

---

## 📊 Logs e Monitoramento

Para ver os logs da Edge Function:

1. Dashboard → Edge Functions → `process-time-clock-notifications`
2. Aba **"Logs"**
3. Você verá todas as execuções em tempo real

---

## 🐛 Troubleshooting

### Erro: "Function not found"
- Verifique se o nome da função está correto: `process-time-clock-notifications`
- Verifique se o deploy foi concluído

### Erro: "Unauthorized"
- Verifique se está usando o `SERVICE_ROLE_KEY` correto
- Verifique se o token não expirou

### Erro: "Internal server error"
- Verifique os logs da Edge Function
- Verifique se as variáveis de ambiente estão configuradas no Supabase

---

**Próximo passo**: Após fazer o deploy, configure o cron job usando os comandos em `COMANDOS_RAPIDOS_NOTIFICACOES_PONTO.sql`

