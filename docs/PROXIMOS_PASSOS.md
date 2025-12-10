# 🚀 Próximos Passos - Sistema EleveaOne

## ✅ Concluído Recentemente

- ✅ Sistema de billing genérico multi-gateway
- ✅ Página de onboarding (`/obrigado`)
- ✅ Migração para usar `profile.id` ao invés de email
- ✅ Campo `site_slug` na tabela stores
- ✅ Sistema de suspensão gradual de acesso

## 📋 Próximos Passos Prioritários

### 1. 🔐 Segurança do Webhook de Pagamento

**Prioridade: ALTA**

- [ ] Implementar validação de assinatura para Stripe
- [ ] Implementar validação de assinatura para Mercado Pago
- [ ] Implementar validação de assinatura para Asaas
- [ ] Adicionar rate limiting no webhook
- [ ] Criar sistema de retry para eventos falhos

**Arquivos a modificar:**
- `netlify/functions/payment-webhook.js`

**Exemplo de validação Stripe:**
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const signature = event.headers['stripe-signature'];
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

try {
  stripe.webhooks.constructEvent(event.body, signature, webhookSecret);
} catch (err) {
  return { statusCode: 400, body: 'Invalid signature' };
}
```

### 2. 📊 Dashboard de Eventos de Billing

**Prioridade: MÉDIA**

- [ ] Criar componente `BillingEventsDashboard.tsx`
- [ ] Listar eventos recebidos (tabela `billing_events`)
- [ ] Filtrar por gateway, tipo, status
- [ ] Visualizar detalhes do evento (JSON expandido)
- [ ] Botão para reprocessar evento manualmente
- [ ] Estatísticas (eventos por dia, taxa de sucesso, etc)

**Localização:** `src/components/admin/BillingEventsDashboard.tsx`

### 3. 🔔 Notificações de Pagamento

**Prioridade: ALTA**

- [ ] Email quando pagamento falhar
- [ ] Email quando assinatura for cancelada
- [ ] Email quando pagamento for bem-sucedido
- [ ] WhatsApp (opcional) para pagamentos críticos
- [ ] Notificação in-app no dashboard

**Arquivos a criar:**
- `netlify/functions/send-payment-failed-email.js`
- `netlify/functions/send-payment-success-email.js`
- `netlify/functions/send-subscription-canceled-email.js`

### 4. 🔄 Job de Reprocessamento Automático

**Prioridade: MÉDIA**

- [ ] Criar função SQL `reprocess_failed_billing_events()`
- [ ] Agendar job com `pg_cron` (a cada 1 hora)
- [ ] Reprocessar eventos com `processed = false` e `error_message IS NULL`
- [ ] Limitar tentativas (max 3 tentativas)
- [ ] Marcar como erro após tentativas esgotadas

**Arquivo:** `supabase/migrations/20251210000030_create_reprocess_billing_events_job.sql`

### 5. 🧪 Testes de Webhook

**Prioridade: MÉDIA**

- [ ] Criar página de teste de webhook (`/admin/test-webhook`)
- [ ] Simular eventos de diferentes gateways
- [ ] Validar processamento correto
- [ ] Testar cenários de erro

**Arquivo:** `src/components/admin/WebhookTester.tsx`

### 6. 📱 Melhorias no Onboarding

**Prioridade: BAIXA**

- [ ] Adicionar campo de telefone do admin
- [ ] Permitir upload de logo da loja
- [ ] Adicionar colaboradoras durante onboarding
- [ ] Configuração inicial de módulos (cashback, CRM, etc)
- [ ] Tour guiado após onboarding

**Arquivo:** `src/pages/Onboarding.tsx`

### 7. 🔍 Monitoramento e Alertas

**Prioridade: MÉDIA**

- [ ] Dashboard de saúde do sistema
- [ ] Alertas quando webhook não receber eventos por X horas
- [ ] Alertas quando muitos eventos falharem
- [ ] Métricas de performance (tempo de processamento)

**Arquivo:** `src/components/admin/SystemHealthDashboard.tsx`

### 8. 📄 Documentação de API

**Prioridade: BAIXA**

- [ ] Documentar todas as funções RPC do Supabase
- [ ] Criar Postman collection para testes
- [ ] Documentar estrutura de eventos de cada gateway
- [ ] Guia de integração para novos gateways

**Arquivo:** `docs/API_REFERENCE.md`

### 9. 🎨 Melhorias de UX

**Prioridade: BAIXA**

- [ ] Loading states mais informativos
- [ ] Mensagens de erro mais claras
- [ ] Confirmações antes de ações críticas
- [ ] Feedback visual em tempo real

### 10. 🚀 Performance

**Prioridade: BAIXA**

- [ ] Otimizar queries do billing dashboard
- [ ] Cache de dados de subscription
- [ ] Paginação em listas grandes
- [ ] Lazy loading de componentes pesados

## 🔧 Melhorias Técnicas

### Banco de Dados

- [ ] Adicionar índices em queries frequentes
- [ ] Criar views materializadas para relatórios
- [ ] Implementar particionamento de `billing_events` (por data)
- [ ] Backup automático de dados críticos

### Código

- [ ] Adicionar TypeScript strict mode
- [ ] Implementar testes unitários
- [ ] Adicionar ESLint rules mais rigorosas
- [ ] Documentar funções complexas

### DevOps

- [ ] CI/CD pipeline completo
- [ ] Testes automatizados antes de deploy
- [ ] Monitoramento de erros (Sentry)
- [ ] Logs estruturados

## 📅 Roadmap Sugerido

### Sprint 1 (Semana 1-2)
1. Segurança do Webhook ⚠️ CRÍTICO
2. Notificações de Pagamento ⚠️ IMPORTANTE

### Sprint 2 (Semana 3-4)
3. Dashboard de Eventos
4. Job de Reprocessamento

### Sprint 3 (Semana 5-6)
5. Testes de Webhook
6. Monitoramento e Alertas

### Sprint 4 (Semana 7+)
7. Melhorias de UX
8. Performance
9. Documentação

## 🎯 Métricas de Sucesso

- ✅ 100% dos webhooks validados e seguros
- ✅ < 1% de eventos não processados
- ✅ < 5s tempo médio de processamento
- ✅ 0 pagamentos perdidos por falha de webhook
- ✅ 100% de cobertura de testes críticos

