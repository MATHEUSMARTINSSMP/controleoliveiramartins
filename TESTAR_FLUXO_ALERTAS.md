# Guia de Teste - Fluxo Completo de Alertas

## 🎯 Objetivo

Testar o fluxo completo: **Criação de Alerta → Processamento → Envio via WhatsApp**

## 📋 Pré-requisitos

1. ✅ Tabelas criadas (`store_notifications`, `store_notification_recipients`, `store_notification_queue`)
2. ✅ Função RPC `process_store_task_alerts()` criada
3. ✅ Função Netlify `process-store-task-alerts` funcionando
4. ✅ WhatsApp configurado e funcionando

## 🧪 Passo a Passo do Teste

### 1. Criar Alerta de Teste

**Via Admin Dashboard:**
1. Acesse **Admin Dashboard** > **Avisos**
2. Clique em **Novo Alerta**
3. Preencha:
   - **Nome:** "Teste de Alerta"
   - **Mensagem:** "Esta é uma mensagem de teste do sistema de alertas"
   - **Horários:** Adicione o horário atual (ex: 12:30)
   - **Dias da Semana:** Selecione o dia atual (0=domingo, 6=sábado)
   - **Destinatários:** Adicione um número de WhatsApp válido
4. Salve o alerta

**Ou via SQL (para teste rápido):**
```sql
-- Criar alerta de teste
INSERT INTO sistemaretiradas.store_notifications (
    store_id,
    nome,
    mensagem,
    horarios,
    dias_semana,
    ativo
) VALUES (
    'SEU_STORE_ID_AQUI',  -- Substitua pelo ID da sua loja
    'Teste de Alerta',
    'Esta é uma mensagem de teste do sistema de alertas',
    ARRAY[CURRENT_TIME::TEXT],  -- Horário atual
    ARRAY[EXTRACT(DOW FROM CURRENT_DATE)::INTEGER],  -- Dia atual
    true
) RETURNING id;

-- Adicionar destinatário (use o ID retornado acima)
INSERT INTO sistemaretiradas.store_notification_recipients (
    notification_id,
    phone,
    name,
    ativo
) VALUES (
    'ID_DO_ALERTA_ACIMA',  -- Substitua pelo ID retornado
    '5511999999999',  -- Número de WhatsApp (formato: 55 + DDD + número)
    'Destinatário Teste',
    true
);
```

### 2. Verificar se Alerta foi Criado

```sql
SELECT 
    sn.id,
    sn.nome,
    sn.mensagem,
    sn.horarios,
    sn.dias_semana,
    sn.ativo,
    sn.envios_hoje,
    s.name as store_name,
    COUNT(snr.id) as destinatarios
FROM sistemaretiradas.store_notifications sn
JOIN sistemaretiradas.stores s ON s.id = sn.store_id
LEFT JOIN sistemaretiradas.store_notification_recipients snr 
    ON snr.notification_id = sn.id AND snr.ativo = true
WHERE sn.nome = 'Teste de Alerta'
GROUP BY sn.id, sn.nome, sn.mensagem, sn.horarios, sn.dias_semana, sn.ativo, sn.envios_hoje, s.name;
```

### 3. Processar Alertas (Inserir na Fila)

**Opção A: Via Função RPC (Automático se cron estiver ativo)**
```sql
-- Esta função identifica alertas que devem ser enviados agora e insere na fila
SELECT sistemaretiradas.process_store_task_alerts();
```

**Opção B: Processar Manualmente**
- Se o cron não estiver ativo, execute a função acima manualmente
- Ou aguarde o próximo minuto se o cron estiver configurado

### 4. Verificar Fila de Mensagens

```sql
SELECT 
    id,
    notification_id,
    phone,
    LEFT(message, 50) as message_preview,
    status,
    retry_count,
    error_message,
    created_at,
    sent_at
FROM sistemaretiradas.store_notification_queue
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Resultado Esperado:**
- Deve haver pelo menos uma mensagem com `status = 'PENDING'`
- `phone` deve conter o número do destinatário
- `message` deve conter a mensagem do alerta

### 5. Processar Fila (Enviar Mensagens)

**Opção A: Via Cron Job (Automático)**
- Se pg_cron estiver ativo, aguarde até 1 minuto
- O job `process-store-task-alerts` executará automaticamente

**Opção B: Via Função Netlify (Manual)**
```bash
curl -X POST https://eleveaone.com.br/.netlify/functions/process-store-task-alerts \
  -H "Content-Type: application/json"
```

**Ou via navegador:**
- Acesse: `https://eleveaone.com.br/.netlify/functions/process-store-task-alerts`
- Deve retornar JSON com `success: true`

### 6. Verificar Status de Envio

```sql
SELECT 
    id,
    phone,
    status,
    sent_at,
    error_message,
    retry_count,
    created_at
FROM sistemaretiradas.store_notification_queue
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Resultado Esperado:**
- `status` deve ser `'SENT'` se sucesso
- `status` deve ser `'FAILED'` se houver erro
- `sent_at` deve ter timestamp se enviado com sucesso
- `error_message` deve estar preenchido se houver erro

### 7. Verificar WhatsApp

- Verifique se a mensagem chegou no WhatsApp do destinatário
- A mensagem deve conter o texto configurado no alerta

## 🔍 Troubleshooting

### Problema: Nenhuma mensagem na fila

**Causa:** A função `process_store_task_alerts()` não identificou alertas para enviar

**Verificar:**
```sql
-- Verificar se alerta está ativo
SELECT id, nome, ativo, horarios, dias_semana, envios_hoje
FROM sistemaretiradas.store_notifications
WHERE nome = 'Teste de Alerta';

-- Verificar se horário atual está nos horários do alerta
SELECT 
    CURRENT_TIME as hora_atual,
    horarios,
    dias_semana,
    EXTRACT(DOW FROM CURRENT_DATE) as dia_atual
FROM sistemaretiradas.store_notifications
WHERE nome = 'Teste de Alerta';

-- Verificar se há destinatários ativos
SELECT 
    snr.id,
    snr.phone,
    snr.ativo
FROM sistemaretiradas.store_notification_recipients snr
JOIN sistemaretiradas.store_notifications sn ON sn.id = snr.notification_id
WHERE sn.nome = 'Teste de Alerta';
```

**Solução:** Ajuste o horário do alerta para o horário atual ou aguarde o horário configurado

### Problema: Mensagem na fila mas não enviada

**Causa:** Erro na função Netlify ou integração WhatsApp

**Verificar:**
```sql
-- Ver mensagens com erro
SELECT 
    id,
    phone,
    status,
    error_message,
    retry_count
FROM sistemaretiradas.store_notification_queue
WHERE status = 'FAILED'
ORDER BY created_at DESC
LIMIT 10;
```

**Solução:**
1. Verificar logs da função Netlify
2. Verificar se WhatsApp está configurado corretamente
3. Verificar se número de telefone está no formato correto (55 + DDD + número)

### Problema: Cron job não está executando

**Verificar:**
```sql
SELECT sistemaretiradas.verificar_status_cron();
```

**Solução:**
- Se pg_cron não estiver habilitado, configure Netlify Scheduled Functions
- Ou execute manualmente a cada minuto

## ✅ Checklist de Teste

- [ ] Alerta criado com sucesso
- [ ] Destinatário adicionado
- [ ] Função `process_store_task_alerts()` executada
- [ ] Mensagem inserida na fila (`status = 'PENDING'`)
- [ ] Função Netlify `process-store-task-alerts` executada
- [ ] Mensagem processada (`status = 'SENT'` ou `'FAILED'`)
- [ ] Mensagem recebida no WhatsApp (se `status = 'SENT'`)
- [ ] Logs verificados (sem erros)

## 📊 Queries Úteis para Monitoramento

### Estatísticas de Envio (Últimas 24h)
```sql
SELECT 
    DATE(created_at) as data,
    status,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'SENT') as enviadas,
    COUNT(*) FILTER (WHERE status = 'FAILED') as falhas,
    AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as tempo_medio_segundos
FROM sistemaretiradas.store_notification_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE(created_at), status
ORDER BY data DESC, status;
```

### Alertas Mais Ativos
```sql
SELECT 
    sn.nome,
    sn.store_id,
    s.name as store_name,
    COUNT(snq.id) as total_mensagens,
    COUNT(snq.id) FILTER (WHERE snq.status = 'SENT') as enviadas,
    COUNT(snq.id) FILTER (WHERE snq.status = 'FAILED') as falhas
FROM sistemaretiradas.store_notifications sn
JOIN sistemaretiradas.stores s ON s.id = sn.store_id
LEFT JOIN sistemaretiradas.store_notification_queue snq ON snq.notification_id = sn.id
WHERE snq.created_at > NOW() - INTERVAL '7 days'
GROUP BY sn.id, sn.nome, sn.store_id, s.name
ORDER BY total_mensagens DESC;
```

## 🎉 Teste Bem-Sucedido

Se todos os passos foram concluídos e a mensagem chegou no WhatsApp, o sistema está funcionando corretamente! ✅

