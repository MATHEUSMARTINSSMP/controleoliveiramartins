# TODO: Implementação Prioritária - Google My Business

## ✅ JÁ IMPLEMENTADO (NÃO PRECISA FAZER)

### Infraestrutura
- ✅ Migração completa n8n → Netlify Functions
- ✅ 5 Netlify Functions criadas
- ✅ Tabelas do banco criadas (google_credentials, google_reviews, google_business_accounts)
- ✅ Campos account_id, location_id, is_read já existem (migration 20251226000004)
- ✅ Hooks atualizados para usar Netlify Functions
- ✅ RLS policies configuradas

### Frontend - Reviews
- ✅ Paginação, filtros, busca, ordenação
- ✅ Badge "Nova" para reviews não lidas
- ✅ Link para Google Maps
- ✅ Exportação CSV
- ✅ Templates de resposta (5 templates)
- ✅ Contador de caracteres (4096 max)
- ✅ Validações (10-4096 caracteres)
- ✅ Modal de confirmação antes de desconectar
- ✅ Marcar review como lida

---

## 🔴 CRÍTICO - IMPLEMENTAR AGORA

### 1. Índices Compostos para Performance
- [ ] Criar migration para índices compostos em google_reviews:
  - `(customer_id, site_slug, is_read, review_date)`
  - `(customer_id, site_slug, rating, review_date)`
  - `(customer_id, site_slug, account_id, location_id)`

### 2. Melhorias de Tratamento de Erros
- [ ] Adicionar tratamento específico para erro 403 (Permissão negada)
- [ ] Adicionar tratamento específico para erro 404 (Recurso não encontrado)
- [ ] Melhorar mensagens de erro no frontend
- [ ] Adicionar retry automático com backoff exponencial (já existe parcialmente)

### 3. Loading States Melhorados
- [ ] Skeleton loaders durante carregamento de reviews
- [ ] Loading state visual durante autenticação OAuth
- [ ] Feedback visual durante sincronização

---

## 🟠 ALTA PRIORIDADE

### 4. Informações do Perfil Google
- [ ] Buscar informações do perfil no hook useGoogleAuth
- [ ] Exibir nome, email do perfil conectado na interface
- [ ] Buscar e exibir foto do perfil (se disponível)
- [ ] Netlify Function para buscar perfil (ou usar token direto no frontend)

### 5. Preview da Resposta
- [ ] Adicionar botão "Preview" no dialog de resposta
- [ ] Modal mostrando como ficará a resposta formatada
- [ ] Opção de editar antes de confirmar envio

### 6. Botão de Sincronização Manual
- [ ] Adicionar botão "Sincronizar Agora" no frontend
- [ ] Netlify Function para sincronização manual (ou reutilizar existente)
- [ ] Feedback visual durante sincronização
- [ ] Toast de sucesso/erro

### 7. Gráficos de Estatísticas
- [ ] Instalar biblioteca de gráficos (recharts ou chart.js)
- [ ] Gráfico de linha (evolução de reviews ao longo do tempo)
- [ ] Gráfico de pizza (distribuição de ratings)
- [ ] Comparação com período anterior (↑/↓ com percentual)

### 8. Exportação PDF
- [ ] Função para exportar reviews em PDF
- [ ] Função para exportar estatísticas em PDF
- [ ] Formatação profissional dos PDFs (usar jsPDF + autoTable)

---

## 🟡 MÉDIA PRIORIDADE

### 9. Gerenciamento de Locations
- [ ] Aba "Locations" no componente GoogleIntegration
- [ ] Netlify Function para buscar informações detalhadas da location
- [ ] Listar locations conectadas
- [ ] Card com informações (nome, endereço, telefone, horário, website, categoria)
- [ ] Seleção de location padrão

### 10. Melhorias de UX/UI
- [ ] Empty states mais atrativos (com ilustrações)
- [ ] Tooltips explicativos nos botões/campos importantes
- [ ] Badge "Nova resposta" quando review é respondida
- [ ] Preview expandido do review (ver mais/menos para comentários longos)

### 11. Tratamento de OAuth Cancelado
- [ ] Detectar quando usuário cancela OAuth
- [ ] Mostrar mensagem amigável
- [ ] Não mostrar erro crítico, apenas informar

---

## 🟢 BAIXA PRIORIDADE (Futuro)

### 12. Funcionalidades Avançadas
- [ ] Análise de sentimento dos reviews
- [ ] Nuvem de palavras das reviews
- [ ] Gráficos comparativos de períodos
- [ ] Notificações de novos reviews
- [ ] Sistema de templates personalizados por usuário
- [ ] Editar/deletar respostas existentes

---

## 📋 ORDEM DE IMPLEMENTAÇÃO

### Sprint 1 (Crítico - Fazer Agora)
1. ✅ Índices compostos para performance
2. ✅ Melhorias de tratamento de erros (403, 404)
3. ✅ Loading states melhorados

### Sprint 2 (Alta Prioridade)
4. ✅ Informações do perfil Google
5. ✅ Preview da resposta
6. ✅ Botão sincronização manual
7. ✅ Gráficos de estatísticas
8. ✅ Exportação PDF

### Sprint 3 (Média Prioridade)
9. ✅ Gerenciamento de locations
10. ✅ Melhorias UX/UI
11. ✅ Tratamento OAuth cancelado

---

## 🎯 COMEÇAR AGORA

Vamos começar pelo **Sprint 1 - Crítico**:
1. Criar migration para índices compostos
2. Melhorar tratamento de erros
3. Adicionar loading states


