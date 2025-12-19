# 📊 Como Acessar os Logs da Function payment-webhook

## 🎯 Acesso Rápido

### Opção 1: Através do Dashboard Netlify

1. **Acesse o Netlify Dashboard:**
   ```
   https://app.netlify.com/
   ```

2. **Selecione seu site:**
   - Se você tem vários sites, escolha o site `eleveaone` (ou o nome do seu site)

3. **Vá em "Functions":**
   - No menu lateral esquerdo, clique em **"Functions"**
   - Ou na barra superior, procure por **"Functions"**

4. **Selecione a função `payment-webhook`:**
   - Você verá uma lista de funções
   - Clique em **`payment-webhook`**

5. **Veja os Logs:**
   - Na página da função, você verá a aba **"Logs"** ou **"Invocation log"**
   - Clique para ver os logs em tempo real

### Opção 2: URL Direta (Se você souber o Site ID)

```
https://app.netlify.com/sites/[SEU_SITE_ID]/functions/payment-webhook
```

## 📋 O que Você Verá nos Logs

### Logs Normais (Sucesso):

```
[Payment Webhook] Gateway: CAKTO
[Payment Webhook] Method: POST
[Payment Webhook] Processing CAKTO event
[Payment Webhook] CAKTO Event Type: purchase.approved
[Payment Webhook] CAKTO Purchase Data: { customerEmail: '...', ... }
[Payment Webhook] Processing CAKTO purchase approved - creating admin user
✅ User created: cliente@email.com
✅ Welcome email sent to: cliente@email.com
```

### Logs de Erro:

```
[Payment Webhook] Gateway: CAKTO
[Payment Webhook] Signature validation failed: Invalid signature
❌ Error creating user: ...
```

## 🔍 Como Filtrar Logs

### Buscar por Palavra-Chave:

Nos logs do Netlify, você pode usar a barra de busca para filtrar:
- `CAKTO` - Ver apenas eventos do Cakto
- `purchase.approved` - Ver apenas compras aprovadas
- `Error` - Ver apenas erros
- `User created` - Ver apenas usuários criados

### Por Período:

Os logs mostram por padrão as últimas invocações. Você pode:
- Ver logs em tempo real (auto-refresh)
- Filtrar por data/hora
- Ver logs de invocações específicas

## 🎯 Outros Lugares para Ver Logs

### 1. Netlify CLI (Se você usar localmente)

```bash
# Ver logs em tempo real
netlify functions:log payment-webhook

# Ver logs das últimas invocações
netlify functions:invoke payment-webhook --no-verify
```

### 2. Supabase Logs (Para ver o que foi salvo no banco)

```sql
-- Ver eventos de billing processados
SELECT 
    id,
    payment_gateway,
    event_type,
    external_event_id,
    processed,
    error_message,
    created_at
FROM sistemaretiradas.billing_events
WHERE payment_gateway = 'CAKTO'
ORDER BY created_at DESC
LIMIT 50;
```

### 3. Email de Erro (Se configurado)

Se a função tiver erros críticos, o Netlify pode enviar email (se configurado nas notificações).

## 🔐 Permissões Necessárias

Para ver os logs, você precisa:
- ✅ Ter acesso ao site no Netlify (Owner, Admin ou Developer)
- ✅ Estar logado na conta do Netlify

## 📱 Acesso via App Mobile

O Netlify tem app mobile onde você também pode ver logs:
1. Baixe o app Netlify
2. Faça login
3. Selecione seu site
4. Vá em Functions → payment-webhook → Logs

## 🎨 Interface dos Logs

Quando você abrir os logs, verá:

```
┌─────────────────────────────────────────────────┐
│ payment-webhook                                  │
├─────────────────────────────────────────────────┤
│ [Invocation Log] [Metrics] [Settings]           │
├─────────────────────────────────────────────────┤
│                                                  │
│ 2025-12-18 23:45:12 [INFO]                      │
│ [Payment Webhook] Gateway: CAKTO                │
│                                                  │
│ 2025-12-18 23:45:12 [INFO]                      │
│ [Payment Webhook] Processing CAKTO event        │
│                                                  │
│ 2025-12-18 23:45:13 [SUCCESS]                   │
│ ✅ User created: cliente@email.com              │
│                                                  │
└─────────────────────────────────────────────────┘
```

## 💡 Dicas

1. **Use a busca**: A barra de busca ajuda muito a filtrar logs
2. **Verifique timestamps**: Os logs mostram data/hora de cada invocação
3. **Veja detalhes completos**: Clique em uma invocação específica para ver logs completos
4. **Compare invocações**: Você pode comparar logs de diferentes invocações

## 🚨 Se Não Conseguir Ver Logs

### Problema: "Functions não aparece no menu"

**Solução:**
- Certifique-se de que a função está deployada
- Verifique se você tem permissões de Developer ou superior
- Tente acessar diretamente pela URL do site

### Problema: "Não vejo logs recentes"

**Solução:**
- Os logs podem ter delay de alguns segundos
- Verifique se a função foi realmente invocada (tente fazer uma compra de teste)
- Verifique o filtro de data/hora

### Problema: "Logs muito antigos"

**Solução:**
- O Netlify mantém logs por um período limitado (geralmente 7 dias)
- Para logs mais antigos, considere usar um serviço de logging externo (ex: LogDNA, Datadog)

## 📞 Próximos Passos

Depois de acessar os logs:

1. **Faça uma compra de teste** no Cakto
2. **Monitore os logs** em tempo real
3. **Verifique se**:
   - ✅ O webhook foi recebido
   - ✅ O usuário foi criado
   - ✅ O email foi enviado
   - ✅ Não há erros

## 🎯 Exemplo de Teste Completo

1. Acesse os logs: `Netlify → Functions → payment-webhook → Logs`
2. Abra em outra aba: Faça uma compra de teste no Cakto
3. Volte aos logs: Você deve ver em tempo real:
   ```
   [Payment Webhook] Gateway: CAKTO
   [Payment Webhook] Processing CAKTO event
   ✅ User created: teste@exemplo.com
   ✅ Welcome email sent
   ```

---

**📍 Link Direto (ajuste com seu Site ID):**
```
https://app.netlify.com/sites/[SEU_SITE_ID]/functions/payment-webhook
```

