# TODO: Implementação - Google My Business (Lista Atualizada)

## ✅ JÁ IMPLEMENTADO

### Migração n8n → Netlify Functions
- ✅ 5 Netlify Functions criadas (oauth-start, oauth-callback, reviews-fetch, reviews-respond, reviews-stats)
- ✅ Hooks atualizados para usar Netlify Functions
- ✅ Todas referências ao n8n removidas

### Frontend - Reviews
- ✅ Paginação de reviews
- ✅ Filtros (rating, data, status)
- ✅ Busca por texto
- ✅ Ordenação (mais recentes, mais antigos, melhor/menor rating)
- ✅ Badge "Nova" para reviews não lidas
- ✅ Link para Google Maps
- ✅ Exportação CSV
- ✅ Templates de resposta (5 templates)
- ✅ Contador de caracteres (4096 max)
- ✅ Validações (10-4096 caracteres)
- ✅ Modal de confirmação antes de desconectar

### Backend
- ✅ Tabela `google_credentials` criada
- ✅ Tabela `google_reviews` criada (com `is_read`, `account_id`, `location_id`)
- ✅ Tabela `google_business_accounts` criada
- ✅ Sincronização automática (migration criada)

---

## 🔴 CRÍTICO - IMPLEMENTAR AGORA

### 1. Verificar/Criar Campos Faltantes no Banco
- [ ] Verificar se `is_read`, `account_id`, `location_id` existem em `google_reviews`
- [ ] Criar migration se campos faltarem
- [ ] Criar índices compostos para queries de filtros

### 2. Melhorias no Frontend - Responder Reviews
- [ ] Marcar itens do TODO como concluídos (contador, templates, validações já feitos)
- [ ] Adicionar preview da resposta antes de enviar
- [ ] Melhorar tratamento de erro quando OAuth é cancelado

### 3. Tratamento de Erros da API do Google
- [ ] Adicionar tratamento específico para:
  - Rate limit excedido (429) - já parcialmente feito
  - Token expirado (401) - já parcialmente feito
  - Permissão negada (403)
  - Recurso não encontrado (404)
- [ ] Mensagens de erro mais amigáveis
- [ ] Log de erros estruturado

---

## 🟠 ALTA PRIORIDADE

### 4. Estatísticas Avançadas
- [ ] Gráfico de linha (evolução de reviews ao longo do tempo)
- [ ] Gráfico de pizza (distribuição de ratings)
- [ ] Comparação com período anterior (↑/↓ com percentual)
- [ ] Exportar relatório de estatísticas (PDF)

### 5. Informações do Perfil Google
- [ ] Exibir nome, email do perfil Google conectado
- [ ] Buscar e exibir foto do perfil (se disponível)
- [ ] Mostrar informações do perfil na interface

### 6. Botão de Sincronização Manual
- [ ] Adicionar botão "Sincronizar Agora" no frontend
- [ ] Chamar Netlify Function de sincronização
- [ ] Feedback visual durante sincronização

### 7. Preview da Resposta
- [ ] Modal de preview mostrando como ficará a resposta
- [ ] Opção de editar antes de confirmar envio

---

## 🟡 MÉDIA PRIORIDADE

### 8. Gerenciamento de Locations/Accounts
- [ ] Aba "Locations" no componente GoogleIntegration
- [ ] Listar accounts conectadas
- [ ] Listar locations por account
- [ ] Card com informações da location (nome, endereço, telefone, etc.)
- [ ] Seleção de location padrão
- [ ] Netlify Function para buscar informações detalhadas da location

### 9. Melhorias de UX/UI
- [ ] Skeleton loaders durante carregamento
- [ ] Empty states mais atrativos (com ilustrações)
- [ ] Tooltips explicativos nos botões/campos
- [ ] Loading state durante autenticação OAuth
- [ ] Feedback visual melhor durante processos

### 10. Exportação PDF
- [ ] Função para exportar reviews em PDF
- [ ] Função para exportar estatísticas em PDF
- [ ] Formatação profissional dos PDFs

---

## 🟢 BAIXA PRIORIDADE

### 11. Funcionalidades Avançadas
- [ ] Análise de sentimento dos reviews
- [ ] Nuvem de palavras das reviews
- [ ] Gráficos comparativos de períodos
- [ ] Notificações de novos reviews
- [ ] Sistema de templates personalizados por usuário

### 12. Testes e Documentação
- [ ] Testes unitários dos hooks
- [ ] Testes de integração
- [ ] Documentação de API das Netlify Functions
- [ ] Guia de uso para administradores

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO (Ordem)

### Fase 1: Crítico (Fazer Primeiro)
1. ✅ Verificar campos do banco de dados
2. ✅ Criar migration se necessário
3. ✅ Melhorar tratamento de erros
4. ✅ Adicionar preview da resposta
5. ✅ Melhorar feedback visual

### Fase 2: Alta Prioridade
6. ✅ Gráficos de estatísticas
7. ✅ Informações do perfil Google
8. ✅ Botão sincronização manual
9. ✅ Exportação PDF

### Fase 3: Média Prioridade
10. ✅ Gerenciamento de locations
11. ✅ Melhorias UX/UI
12. ✅ Funcionalidades adicionais

---

## 🎯 FOCO ATUAL

Começar pela **Fase 1 - Crítico**, começando com:
1. Verificar estrutura do banco de dados
2. Criar migrations se necessário
3. Melhorar tratamento de erros
4. Adicionar funcionalidades críticas faltantes


