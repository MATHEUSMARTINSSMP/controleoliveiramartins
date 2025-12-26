# 🔍 Melhorias Pendentes - Gestão de Marketing

**Data**: 2025-12-25  
**Status**: Após refatoração de estrutura e correções de bugs

---

## ✅ **Melhorias Já Implementadas**

- ✅ Eliminação de botões "Voltar" duplicados
- ✅ Títulos consistentes quando embedded
- ✅ Correção de importações duplicadas
- ✅ Correção de função `getStatusColor` ausente
- ✅ Props `embedded` implementadas corretamente
- ✅ `MarketingAnalytics` aceita `storeId` como prop

---

## 📋 **Melhorias Pendentes Identificadas**

### 1. 🔧 **Correções Técnicas Menores**

#### 1.1. TODO em WhatsAppBulkSend.tsx
**Localização**: `src/pages/admin/WhatsAppBulkSend.tsx:1633`

```typescript
// TODO: Implementar busca de cashback quando necessário
```

**Prioridade**: BAIXA  
**Descrição**: Placeholder para busca de saldo de cashback nos placeholders de mensagem.  
**Ação**: Implementar busca de cashback quando o placeholder `{cashback}` for usado.

---

### 2. 🎨 **Melhorias de UX**

#### 2.1. Loading States Mais Informativos
**Prioridade**: MÉDIA

- [ ] Adicionar indicadores de progresso detalhados durante geração de mídia
- [ ] Mostrar estimativa de tempo restante para vídeos
- [ ] Skeleton loaders mais elaborados em todas as listas
- [ ] Loading states específicos para cada tipo de operação (upload, processamento, etc)

**Arquivos afetados**:
- `src/components/marketing/MarketingAssetSkeleton.tsx`
- `src/components/marketing/MarketingJobSkeleton.tsx`
- `src/pages/admin/SocialMediaMarketing.tsx`

---

#### 2.2. Mensagens de Erro Mais Claras
**Prioridade**: MÉDIA

- [ ] Traduzir mensagens de erro técnicas para linguagem amigável
- [ ] Adicionar ações sugeridas quando erros ocorrem
- [ ] Mostrar códigos de erro específicos para suporte técnico
- [ ] Melhorar feedback visual de erros (ícones, cores, etc)

**Arquivos afetados**:
- `src/components/marketing/*.tsx`
- `src/pages/admin/SocialMediaMarketing.tsx`

---

#### 2.3. Feedback Visual em Tempo Real
**Prioridade**: BAIXA

- [ ] Animações suaves durante transições
- [ ] Toast notifications mais informativos
- [ ] Highlight de itens recém-criados na galeria
- [ ] Indicadores visuais de status em tempo real

---

### 3. ⚡ **Melhorias de Performance**

#### 3.1. Otimização de Queries
**Prioridade**: MÉDIA

- [ ] Implementar paginação na galeria de assets (atualmente carrega todos)
- [ ] Lazy loading de imagens na galeria
- [ ] Cache de dados de analytics
- [ ] Debounce em filtros de busca

**Arquivos afetados**:
- `src/hooks/use-marketing-assets.ts`
- `src/components/marketing/MarketingAnalytics.tsx`
- `src/pages/admin/SocialMediaMarketing.tsx` (GalleryTab)

---

#### 3.2. Redução de Re-renders
**Prioridade**: BAIXA

- [ ] Usar `React.memo` em componentes pesados
- [ ] Otimizar `useEffect` dependencies
- [ ] Memoizar cálculos custosos com `useMemo`

---

### 4. 🚀 **Funcionalidades Adicionais**

#### 4.1. Filtros Avançados na Galeria
**Prioridade**: MÉDIA

**Status Atual**: Filtros básicos por tipo (imagem/vídeo) e provider existem, mas podem ser expandidos.

- [ ] Filtro por data (range de datas)
- [ ] Filtro por custo (range de custos)
- [ ] Filtro por modelo usado
- [ ] Busca por texto (buscar nos prompts)
- [ ] Ordenação (data, custo, nome)
- [ ] Tags/categorias para assets

**Arquivos afetados**:
- `src/pages/admin/SocialMediaMarketing.tsx` (GalleryTab)

---

#### 4.2. Preview de Assets Antes de Download
**Prioridade**: BAIXA

- [ ] Modal de preview em tela cheia
- [ ] Zoom em imagens
- [ ] Player de vídeo integrado no modal
- [ ] Informações detalhadas (metadata, prompt usado, custo, etc)

---

#### 4.3. Compartilhamento de Assets
**Prioridade**: BAIXA

- [ ] Gerar link compartilhável temporário
- [ ] Integração com redes sociais (copiar link, abrir app)
- [ ] Download direto de múltiplos assets (ZIP)

---

#### 4.4. Histórico de Edições
**Prioridade**: BAIXA

- [ ] Salvar histórico de versões de assets editados
- [ ] Comparar versões lado a lado
- [ ] Reverter para versão anterior

---

### 5. 🧪 **Testes Pendentes**

Conforme `docs/TODO_MARKETING_MODULE_COMPLETE.md`, ainda faltam testes manuais:

- [ ] 121. Testar geração de imagem (Gemini)
- [ ] 122. Testar geração de imagem (OpenAI)
- [ ] 123. Testar geração de vídeo (Gemini)
- [ ] 124. Testar geração de vídeo (OpenAI)
- [ ] 125. Testar expansão de prompts
- [ ] 126. Testar worker assíncrono
- [ ] 127. Testar tratamento de erros

**Prioridade**: ALTA (crítico para garantir funcionamento)

---

### 6. 📱 **Acessibilidade**

#### 6.1. Melhorias de Acessibilidade
**Prioridade**: MÉDIA

- [ ] Adicionar `aria-labels` em todos os botões e ações
- [ ] Melhorar contraste de cores
- [ ] Suporte a navegação por teclado completa
- [ ] Screen reader friendly
- [ ] Alt text descritivo em todas as imagens

---

### 7. 🔒 **Segurança e Validação**

#### 7.1. Validação de Inputs
**Prioridade**: MÉDIA

- [ ] Validação de tamanho de arquivos antes de upload
- [ ] Validação de formatos de imagem/vídeo suportados
- [ ] Sanitização de prompts (prevenir injection)
- [ ] Rate limiting mais granular (por usuário, não apenas por store)

---

### 8. 📊 **Analytics e Monitoramento**

#### 8.1. Métricas Adicionais
**Prioridade**: BAIXA

- [ ] Tempo médio de processamento por provider/modelo
- [ ] Taxa de sucesso vs falha
- [ ] Custo médio por tipo de conteúdo
- [ ] Uso por usuário individual
- [ ] Gráficos comparativos (provider vs provider)

---

### 9. 🎯 **Funcionalidades de Negócio**

#### 9.1. Integração com Campanhas
**Prioridade**: MÉDIA

- [ ] Associar assets gerados a campanhas WhatsApp
- [ ] Criar campanha diretamente a partir de asset gerado
- [ ] Agendar postagens em redes sociais (futuro)

---

#### 9.2. Aprovação de Conteúdo
**Prioridade**: BAIXA

- [ ] Workflow de aprovação antes de publicar
- [ ] Comentários e anotações em assets
- [ ] Status de aprovação (rascunho, pendente, aprovado, rejeitado)

---

## 🎯 **Priorização Sugerida**

### Sprint 1 (Urgente)
1. ⚠️ **Testes manuais** (121-127) - Crítico para validar funcionamento
2. 🔧 **TODO de cashback** - Completar funcionalidade iniciada
3. 🎨 **Loading states mais informativos** - Melhorar experiência

### Sprint 2 (Importante)
4. ⚡ **Otimização de queries** - Performance (paginação na galeria)
5. 🎨 **Mensagens de erro mais claras** - UX
6. 🚀 **Filtros avançados na galeria** - Funcionalidade útil

### Sprint 3 (Desejável)
7. 📱 **Acessibilidade** - Boas práticas
8. 🔒 **Validação de inputs** - Segurança
9. 🚀 **Preview de assets** - UX
10. 📊 **Métricas adicionais** - Analytics

---

## 📝 **Notas Adicionais**

### Código Limpo
- ✅ Estrutura modular bem organizada
- ✅ Separação de concerns clara
- ✅ TypeScript com tipagem forte
- ✅ Componentes reutilizáveis

### Pontos Fortes Atuais
- ✅ Sistema de prompts profissional implementado
- ✅ Suporte multi-provider (Gemini + OpenAI)
- ✅ Analytics básico funcionando
- ✅ Templates de prompts
- ✅ Image editing (inpainting) implementado

### Áreas de Atenção
- ⚠️ Paginação na galeria (pode ser lento com muitos assets)
- ⚠️ Testes manuais ainda pendentes
- ⚠️ Algumas funcionalidades podem precisar de refinamento baseado em uso real

---

**Última Atualização**: 2025-12-25

