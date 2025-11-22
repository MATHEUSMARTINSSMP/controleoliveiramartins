# Checklist de Verificação Mobile-First

## 📱 PWA e Configuração Mobile

### ✅ Concluído
- [x] Manifest.json criado
- [x] Service Worker criado (sw.js)
- [x] Meta tags para mobile no index.html
- [x] Meta tags para iOS (apple-mobile-web-app-*)
- [x] Viewport configurado corretamente

### ⏳ Pendente
- [ ] Criar ícones PWA (192x192, 512x512) a partir do favicon.ico
- [ ] Criar apple-touch-icon.png (180x180)
- [ ] Testar instalação como PWA no iOS
- [ ] Testar instalação como PWA no Android

---

## 📄 Páginas Principais

### AdminDashboard.tsx
**Status:** ⚠️ Necessita verificação
- [ ] Cards de KPI responsivos (grid adaptável)
- [ ] Tabs funcionando bem em mobile
- [ ] Botões com tamanho adequado para toque
- [ ] Tabelas com scroll horizontal quando necessário

### LojaDashboard.tsx
**Status:** ✅ Maioria implementada
- [x] Cards de KPI responsivos (grid 1-2-4 colunas)
- [x] Tabelas com colunas ocultas (hidden sm:table-cell)
- [x] Formulários com espaçamento adequado
- [ ] **PENDENTE:** Verificar barra de progresso semanal em telas pequenas
- [ ] Verificar tabela mensal por colaboradora/dia em mobile

### ColaboradoraDashboard.tsx
**Status:** ⚠️ Necessita verificação
- [ ] Cards de metas e vendas responsivos
- [ ] Gráficos (Recharts) responsivos
- [ ] Tabelas com scroll horizontal

### Colaboradores.tsx
**Status:** ⚠️ Necessita verificação
- [ ] Tabs (Colaboradoras/Lojas) em mobile
- [ ] Tabelas com colunas ocultas
- [ ] Formulários de criação/edição
- [ ] Dialog de confirmação

### Relatorios.tsx
**Status:** ⚠️ Necessita verificação
- [ ] Filtros de data responsivos
- [ ] Gráficos (Recharts) responsivos
- [ ] Tabelas de comparação de lojas
- [ ] Tabela de tendências diárias

---

## 🧩 Componentes

### WeeklyGoalProgress.tsx
**Status:** ⚠️ Corrigindo
- [x] Header com labels responsivo (flex-col sm:flex-row)
- [ ] **PENDENTE:** Garantir que labels não ultrapassem container
- [ ] Barra de progresso com overflow controlado
- [ ] Labels de checkpoint ajustados para mobile

### WeeklyBonusProgress.tsx
**Status:** ✅ Implementado
- [x] Cards de status responsivos
- [x] Layout adaptável (flex-col/grid)

### MetasManagement.tsx
**Status:** ⚠️ Necessita verificação
- [ ] Formulários de metas mensais
- [ ] Tabela de metas existentes
- [ ] Dialog de edição
- [ ] Seleção de loja

### WeeklyGoalsManagement.tsx
**Status:** ⚠️ Necessita verificação
- [ ] Interface step-by-step em mobile
- [ ] Seleção de colaboradoras (switches/checkboxes)
- [ ] Formulários de customização
- [ ] Tabela de metas semanais agrupadas

### BonusManagement.tsx
**Status:** ⚠️ Necessita verificação
- [ ] Formulários de bônus
- [ ] Cards de bônus existentes
- [ ] Dialog de edição

---

## 📊 Elementos Específicos

### Tabelas
- [x] scroll horizontal (overflow-x-auto) implementado onde necessário
- [x] Colunas ocultas em mobile (hidden sm:table-cell, hidden md:table-cell)
- [ ] **PENDENTE:** Verificar todas as tabelas para garantir usabilidade em mobile

### Formulários
- [x] Inputs com tamanho adequado (h-10, padding)
- [x] Labels visíveis e legíveis
- [ ] **PENDENTE:** Verificar todos os selects e date pickers

### Botões
- [x] Tamanho mínimo para toque (h-8 mínimo)
- [x] Espaçamento adequado entre botões
- [x] Ícones com tamanho responsivo (h-3 w-3 sm:h-4 sm:w-4)

### Gráficos (Recharts)
- [x] ResponsiveContainer usado
- [ ] **PENDENTE:** Verificar em telas muito pequenas (< 320px)

### Dialogs/Modais
- [x] DialogContent com padding responsivo (p-3 sm:p-6)
- [ ] **PENDENTE:** Verificar altura máxima e scroll interno

---

## 🎨 Aspectos Visuais

### Espaçamento
- [x] Padding responsivo (p-3 sm:p-6)
- [x] Gap responsivo (gap-2 sm:gap-4)
- [x] Margin responsivo onde necessário

### Tipografia
- [x] Tamanhos de fonte responsivos (text-xs sm:text-sm)
- [x] Títulos adaptáveis (text-xl sm:text-2xl lg:text-3xl)

### Layouts
- [x] Grid responsivo (grid-cols-1 sm:grid-cols-2 lg:grid-cols-4)
- [x] Flex responsivo (flex-col sm:flex-row)

---

## ✅ Próximos Passos Prioritários

1. **URGENTE:** Corrigir barra de progresso semanal (labels saindo do container)
2. Criar ícones PWA (192x192, 512x512)
3. Verificar e testar todas as tabelas em mobile
4. Verificar todos os dialogs/modais
5. Testar em dispositivos reais (iOS e Android)

