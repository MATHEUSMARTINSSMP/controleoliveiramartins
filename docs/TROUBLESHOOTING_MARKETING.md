# 🔧 Guia de Troubleshooting - Módulo de Marketing

**Versão**: 1.0  
**Data**: 2025-12-24

---

## 📋 Índice

1. [Problemas Comuns](#problemas-comuns)
2. [Erros de Geração](#erros-de-geração)
3. [Problemas com Templates](#problemas-com-templates)
4. [Problemas com Galeria](#problemas-com-galeria)
5. [Problemas com Analytics](#problemas-com-analytics)
6. [Problemas de Performance](#problemas-de-performance)
7. [Contato e Suporte](#contato-e-suporte)

---

## 🚨 Problemas Comuns

### Job Fica "Na Fila" por Muito Tempo

**Sintomas**: Job criado mas não inicia processamento

**Possíveis Causas**:
1. Worker não está rodando
2. Muitos jobs na fila
3. Problema de conectividade com APIs

**Soluções**:
1. Aguarde alguns minutos (pode haver atraso)
2. Verifique se outros jobs estão processando
3. Tente cancelar e criar um novo job
4. Se persistir, contate o suporte

---

### Imagem/Vídeo Não Aparece na Galeria

**Sintomas**: Job mostra "Concluído" mas conteúdo não aparece

**Possíveis Causas**:
1. Erro no upload para storage
2. Problema com URL assinada
3. Cache do navegador

**Soluções**:
1. Recarregue a página (F5)
2. Limpe o cache do navegador
3. Verifique se o job realmente completou (veja mensagem de erro)
4. Tente gerar novamente

---

### Erro "Sessão Expirada"

**Sintomas**: Mensagem de erro ao tentar gerar conteúdo

**Solução**:
1. Faça logout e login novamente
2. Verifique se sua sessão não expirou
3. Tente novamente

---

### Quota Excedida

**Sintomas**: Erro ao tentar gerar: "Quota excedida"

**Solução**:
1. Verifique suas quotas em **Analytics**
2. Aguarde até o próximo período (dia/mês)
3. Entre em contato para aumentar limites

---

## 🎨 Erros de Geração

### Erro "Provider Error"

**Possíveis Causas**:
1. API do provider indisponível
2. Chave de API inválida
3. Modelo não disponível

**Soluções**:
1. Tente novamente em alguns minutos
2. Tente com outro provider
3. Verifique se o modelo selecionado está ativo

---

### Erro "Validation Error"

**Possíveis Causas**:
1. Prompt muito curto ou vazio
2. Imagem de entrada inválida
3. Máscara com formato incorreto

**Soluções**:
1. Verifique se o prompt tem pelo menos algumas palavras
2. Use imagens em formatos suportados (PNG, JPEG)
3. Para máscaras, use apenas PNG
4. Verifique tamanho das imagens (máx. 10MB recomendado)

---

### Erro "Rate Limit Exceeded"

**Sintomas**: Muitas requisições em pouco tempo

**Solução**:
1. Aguarde alguns minutos antes de tentar novamente
2. Reduza a frequência de gerações
3. Use templates para evitar múltiplas tentativas

---

### Imagem Gerada com Baixa Qualidade

**Possíveis Causas**:
1. Prompt muito vago
2. Modelo não adequado
3. Tamanho de saída pequeno

**Soluções**:
1. Use prompts mais detalhados
2. Tente o botão "Expandir Prompt"
3. Experimente diferentes modelos
4. Especifique "alta qualidade" ou "8K" no prompt

---

### Vídeo Não Completa

**Sintomas**: Job fica em "Processando" por muito tempo

**Possíveis Causas**:
1. Vídeos levam mais tempo (1-5 minutos)
2. Problema com polling do status
3. API do provider com atraso

**Soluções**:
1. Aguarde pelo menos 5 minutos para vídeos
2. Verifique o progresso na aba "Processamentos"
3. Se passar de 10 minutos, pode ser um problema - tente cancelar e recriar

---

## 📚 Problemas com Templates

### Template Não Aparece na Lista

**Possíveis Causas**:
1. Filtros aplicados
2. Template de outra loja (não público)
3. Problema de carregamento

**Soluções**:
1. Limpe os filtros de busca
2. Verifique se está na loja correta
3. Recarregue a página

---

### Erro ao Salvar Template

**Possíveis Causas**:
1. Nome ou prompt vazio
2. Problema de permissão
3. Erro de conexão

**Soluções**:
1. Preencha todos os campos obrigatórios (Nome e Prompt)
2. Verifique sua permissão na loja
3. Tente novamente

---

### Template Não Aplica Provider/Modelo

**Sintomas**: Template aplica prompt mas não muda provider/modelo

**Possíveis Causas**:
1. Template não tem provider/modelo salvo
2. Provider/modelo não está mais disponível

**Solução**:
1. Selecione manualmente o provider/modelo após aplicar template
2. Salve o template novamente com provider/modelo

---

## 🖼️ Problemas com Galeria

### Imagens Não Carregam

**Possíveis Causas**:
1. URL assinada expirou
2. Problema de conectividade
3. Arquivo corrompido

**Soluções**:
1. Clique em "Atualizar" ou recarregue a página
2. Verifique sua conexão de internet
3. Tente fazer download direto

---

### Filtros Não Funcionam

**Solução**:
1. Limpe os filtros e aplique novamente
2. Recarregue a página
3. Verifique se há conteúdos que correspondem aos filtros

---

### Download Não Funciona

**Possíveis Causas**:
1. Bloqueador de pop-ups
2. URL expirada
3. Problema de permissão

**Soluções**:
1. Desabilite bloqueador de pop-ups temporariamente
2. Tente clicar com botão direito → "Salvar link como"
3. Verifique permissões do navegador

---

## 📊 Problemas com Analytics

### Dados Não Aparecem

**Possíveis Causas**:
1. Nenhum conteúdo gerado ainda
2. Período selecionado sem dados
3. Problema de carregamento

**Soluções**:
1. Gere alguns conteúdos primeiro
2. Tente outro período (hoje, semana, mês)
3. Recarregue a página

---

### Quotas Mostram Zero

**Possíveis Causas**:
1. Sistema ainda não atualizou
2. Nenhum uso registrado
3. Problema de sincronização

**Solução**:
1. Aguarde alguns minutos após gerar conteúdo
2. Recarregue a página
3. Verifique se os jobs foram concluídos

---

## ⚡ Problemas de Performance

### Página Lenta

**Possíveis Causas**:
1. Muitos conteúdos na galeria
2. Cache do navegador
3. Conexão lenta

**Soluções**:
1. Use filtros para reduzir itens exibidos
2. Limpe cache do navegador
3. Verifique sua conexão de internet

---

### Jobs Não Atualizam Status

**Solução**:
1. Recarregue a página manualmente
2. A página atualiza automaticamente a cada 3 segundos
3. Se persistir, pode ser problema de conexão WebSocket

---

## 🔍 Diagnóstico Rápido

### Checklist Antes de Reportar Problema

- [ ] Recarregou a página (F5)?
- [ ] Limpou cache do navegador?
- [ ] Tentou fazer logout/login?
- [ ] Verificou sua conexão de internet?
- [ ] Tentou em outro navegador?
- [ ] Verificou se outros usuários têm o mesmo problema?

---

## 📞 Contato e Suporte

### Quando Contatar Suporte

Contate o suporte técnico se:
- Problema persiste após tentar todas as soluções acima
- Erro específico que não está nesta lista
- Problema afeta múltiplos usuários
- Suspeita de bug no sistema

### Informações para Reportar

Ao reportar um problema, inclua:
1. **Descrição do problema**: O que aconteceu?
2. **Passos para reproduzir**: Como reproduzir o erro?
3. **Mensagens de erro**: Copie mensagens exatas
4. **Navegador e versão**: Chrome, Firefox, Safari, etc.
5. **Screenshot**: Se possível, anexe screenshot
6. **Timestamp**: Data e hora do problema

### Canais de Suporte

- Email: suporte@exemplo.com
- Chat: Disponível no sistema
- Documentação: Consulte outros guias

---

## 🛠️ Soluções Técnicas Avançadas

### Limpar Cache do Navegador

**Chrome/Edge**:
1. Pressione `Ctrl+Shift+Delete` (Windows) ou `Cmd+Shift+Delete` (Mac)
2. Selecione "Imagens e arquivos em cache"
3. Clique em "Limpar dados"

**Firefox**:
1. Pressione `Ctrl+Shift+Delete`
2. Selecione "Cache"
3. Clique em "Limpar agora"

**Safari**:
1. Menu Safari → Preferências → Avançado
2. Marque "Mostrar menu Desenvolver"
3. Menu Desenvolver → Esvaziar Caches

---

### Verificar Console do Navegador

1. Pressione `F12` para abrir DevTools
2. Vá para a aba "Console"
3. Procure por erros em vermelho
4. Copie mensagens de erro para reportar

---

## 📝 Log de Mudanças

### Versão 1.0 (2025-12-24)
- Guia inicial de troubleshooting
- Problemas comuns documentados
- Soluções para erros de geração

---

**Última atualização**: 2025-12-24

