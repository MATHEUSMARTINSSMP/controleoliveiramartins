# 🧪 Guia de Testes - Módulo de Marketing

**Versão**: 1.0  
**Data**: 2025-12-24

---

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Testes de Geração de Imagem](#testes-de-geração-de-imagem)
3. [Testes de Geração de Vídeo](#testes-de-geração-de-vídeo)
4. [Testes de Expansão de Prompts](#testes-de-expansão-de-prompts)
5. [Testes do Worker Assíncrono](#testes-do-worker-assíncrono)
6. [Testes de Tratamento de Erros](#testes-de-tratamento-de-erros)
7. [Checklist de Validação](#checklist-de-validação)

---

## ✅ Pré-requisitos

Antes de executar os testes, certifique-se de que:

- [ ] Variáveis de ambiente configuradas:
  - `GEMINI_API_KEY`
  - `OPENAI_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Banco de dados com migrations aplicadas
- [ ] Supabase Storage configurado
- [ ] Usuário de teste com `store_id` válido
- [ ] Navegador atualizado (Chrome, Firefox, ou Safari)

---

## 🖼️ Testes de Geração de Imagem

### Teste 1: Geração de Imagem com Gemini

**Objetivo**: Validar geração de imagem usando Google Gemini

**Passos**:
1. Acesse a aba "Gerar Conteúdo"
2. Selecione tipo: **Imagem**
3. Selecione provider: **Google Gemini**
4. Modelo deve ser: `gemini-2.5-flash-image`
5. Digite o prompt: `"Uma imagem minimalista de uma casa na árvore moderna, cores suaves pastéis, estilo clean"`
6. Clique em **"Gerar Imagem"**
7. Aguarde redirecionamento para "Processamentos"

**Resultado Esperado**:
- ✅ Job criado com status "queued" ou "processing"
- ✅ Redirecionamento automático para aba "Processamentos"
- ✅ Job aparece na lista "Em Processamento"
- ✅ Após 10-30 segundos, job muda para "done"
- ✅ Redirecionamento automático para "Galeria"
- ✅ Nova imagem aparece destacada na galeria
- ✅ Imagem pode ser visualizada e baixada

**Validações**:
- [ ] Job criado no banco (`marketing_jobs`)
- [ ] Asset criado no banco (`marketing_assets`)
- [ ] Arquivo salvo no Supabase Storage
- [ ] URL assinada gerada corretamente
- [ ] Uso registrado em `marketing_usage`

---

### Teste 2: Geração de Imagem com OpenAI

**Objetivo**: Validar geração de imagem usando OpenAI

**Passos**:
1. Acesse a aba "Gerar Conteúdo"
2. Selecione tipo: **Imagem**
3. Selecione provider: **OpenAI**
4. Modelo deve ser: `gpt-image-001`
5. Digite o prompt: `"Uma imagem profissional de um escritório moderno, iluminação natural, estilo corporativo"`
6. Clique em **"Gerar Imagem"**

**Resultado Esperado**:
- ✅ Mesmo comportamento do Teste 1
- ✅ Imagem gerada com qualidade adequada

**Validações**:
- [ ] Mesmas validações do Teste 1
- [ ] Provider correto registrado no job

---

### Teste 3: Geração de Imagem com Referência

**Objetivo**: Validar geração usando imagem de referência

**Passos**:
1. Prepare uma imagem de referência (PNG ou JPEG)
2. Acesse "Gerar Conteúdo"
3. Selecione tipo: **Imagem**
4. Clique em **"Adicionar"** em "Imagens de Referência"
5. Selecione a imagem preparada
6. Digite prompt: `"Aplique o estilo desta imagem em uma nova composição com um pôr do sol"`
7. Clique em **"Gerar Imagem"**

**Resultado Esperado**:
- ✅ Imagem de referência aparece no preview
- ✅ Job criado com `input_images` no JSON
- ✅ Imagem gerada mantém estilo similar à referência

**Validações**:
- [ ] Imagem de referência convertida para base64
- [ ] Base64 enviado no campo `inputImages` do job
- [ ] Provider recebe imagem corretamente

---

### Teste 4: Edição de Imagem (Inpainting)

**Objetivo**: Validar edição de imagem com máscara

**Passos**:
1. Adicione uma imagem de referência
2. Clique em **"Adicionar Máscara"**
3. Faça upload de um PNG com áreas transparentes
4. Digite prompt: `"Substitua a área da máscara por um céu azul com nuvens"`
5. Clique em **"Gerar Imagem"**

**Resultado Esperado**:
- ✅ Preview combinado mostra imagem + máscara
- ✅ Job criado com `mask` no JSON
- ✅ Imagem gerada com edição na área da máscara

**Validações**:
- [ ] Máscara convertida para base64
- [ ] Base64 enviado no campo `mask` do job
- [ ] Apenas OpenAI suporta inpainting (validar erro se usar Gemini)

---

## 🎬 Testes de Geração de Vídeo

### Teste 5: Geração de Vídeo com Gemini (Veo)

**Objetivo**: Validar geração de vídeo usando Google Gemini Veo

**Passos**:
1. Acesse "Gerar Conteúdo"
2. Selecione tipo: **Vídeo**
3. Selecione provider: **Google Gemini**
4. Modelo deve ser: `veo-2.0-generate-001` ou similar
5. Digite prompt: `"Um vídeo curto de uma praia ao pôr do sol, ondas suaves, cores vibrantes, duração 8 segundos"`
6. Clique em **"Gerar Vídeo"**

**Resultado Esperado**:
- ✅ Job criado com status "queued"
- ✅ Após alguns segundos, status muda para "processing"
- ✅ Barra de progresso aparece e atualiza
- ✅ Após 1-5 minutos, job completa
- ✅ Vídeo aparece na galeria
- ✅ Vídeo pode ser reproduzido e baixado

**Validações**:
- [ ] Job criado com `type: "video"`
- [ ] `provider_ref` salvo para polling
- [ ] Worker faz polling corretamente
- [ ] Vídeo baixado e salvo no Storage
- [ ] Asset criado com tipo "video"

---

### Teste 6: Geração de Vídeo com OpenAI (Sora)

**Objetivo**: Validar geração de vídeo usando OpenAI Sora

**Passos**:
1. Acesse "Gerar Conteúdo"
2. Selecione tipo: **Vídeo**
3. Selecione provider: **OpenAI**
4. Modelo deve ser: `sora-2-pro`
5. Digite prompt: `"Um vídeo de uma cidade futurista à noite, luzes neon, movimento suave, 10 segundos"`
6. Clique em **"Gerar Vídeo"**

**Resultado Esperado**:
- ✅ Mesmo comportamento do Teste 5
- ✅ Vídeo gerado com qualidade adequada

**Validações**:
- [ ] Mesmas validações do Teste 5
- [ ] Provider correto registrado

---

## ✨ Testes de Expansão de Prompts

### Teste 7: Expansão de Prompt Básico

**Objetivo**: Validar geração de alternativas de prompts

**Passos**:
1. Acesse "Gerar Conteúdo"
2. Clique em **"Começar com IA"**
3. Digite: `"quero uma casa na árvore"`
4. Aguarde processamento (5-10 segundos)
5. Visualize as 5 alternativas geradas

**Resultado Esperado**:
- ✅ 5 prompts alternativos aparecem
- ✅ Cada prompt é mais detalhado que o original
- ✅ Prompts são profissionais e específicos
- ✅ Pode selecionar um prompt
- ✅ Prompt selecionado preenche o campo

**Validações**:
- [ ] Requisição enviada para `/marketing-prompt-expand`
- [ ] Resposta contém array de 5 alternativas
- [ ] Prompts incluem contexto da loja (se disponível)
- [ ] Cores da marca aplicadas (se configuradas)

---

### Teste 8: Expansão com Contexto da Loja

**Objetivo**: Validar que expansão usa informações da loja

**Pré-requisito**: Loja deve ter `brand_colors` configurado

**Passos**:
1. Configure cores da marca na loja
2. Execute Teste 7
3. Verifique se prompts mencionam as cores

**Resultado Esperado**:
- ✅ Prompts gerados mencionam cores da marca
- ✅ Contexto da loja é incorporado

**Validações**:
- [ ] `store_id` enviado no contexto
- [ ] `brand_colors` extraído corretamente
- [ ] Prompts refletem identidade visual

---

## ⚙️ Testes do Worker Assíncrono

### Teste 9: Processamento de Job na Fila

**Objetivo**: Validar que worker processa jobs automaticamente

**Passos**:
1. Crie um job de imagem (Teste 1)
2. Verifique no banco que job está com `status = 'queued'`
3. Aguarde 30-60 segundos
4. Verifique que worker processou o job

**Resultado Esperado**:
- ✅ Worker encontra job na fila
- ✅ Worker chama adapter correto
- ✅ Job muda para "processing"
- ✅ Após geração, job muda para "done"
- ✅ Asset criado e linkado ao job

**Validações** (via banco de dados):
```sql
-- Verificar jobs na fila
SELECT * FROM marketing_jobs 
WHERE status IN ('queued', 'processing')
ORDER BY created_at DESC;

-- Verificar assets criados
SELECT * FROM marketing_assets 
WHERE job_id IS NOT NULL
ORDER BY created_at DESC;

-- Verificar uso registrado
SELECT * FROM marketing_usage 
WHERE store_id = 'SEU_STORE_ID'
ORDER BY period_start DESC;
```

---

### Teste 10: Polling de Vídeo

**Objetivo**: Validar polling assíncrono para vídeos

**Passos**:
1. Crie um job de vídeo (Teste 5)
2. Verifique no banco que `provider_ref` foi salvo
3. Monitore logs do worker
4. Aguarde conclusão

**Resultado Esperado**:
- ✅ Worker salva `provider_ref` do provider
- ✅ Worker faz polling a cada X segundos
- ✅ Status atualiza progressivamente
- ✅ Quando completo, vídeo é baixado

**Validações**:
- [ ] `provider_ref` não é NULL
- [ ] Worker faz requisições de polling
- [ ] Progresso atualiza no job
- [ ] Vídeo baixado quando status = "done"

---

## 🚨 Testes de Tratamento de Erros

### Teste 11: Erro de API Indisponível

**Objetivo**: Validar tratamento quando API do provider falha

**Passos**:
1. Temporariamente desconfigure API key (ou use chave inválida)
2. Tente gerar uma imagem
3. Observe comportamento

**Resultado Esperado**:
- ✅ Job criado com status "queued"
- ✅ Worker tenta processar
- ✅ Erro capturado e registrado
- ✅ Job muda para "failed"
- ✅ Mensagem de erro salva em `error_message`
- ✅ Código de erro salvo em `error_code`

**Validações**:
- [ ] Erro não quebra o sistema
- [ ] Mensagem de erro é clara
- [ ] Job pode ser visualizado na aba "Processamentos"
- [ ] Erro aparece na UI

---

### Teste 12: Erro de Validação

**Objetivo**: Validar validação de entrada

**Cenários**:
1. **Prompt vazio**: Tentar gerar sem prompt
2. **Imagem muito grande**: Upload de imagem > 10MB
3. **Formato inválido**: Upload de arquivo não-imagem como máscara

**Resultado Esperado**:
- ✅ Erro de validação retornado antes de criar job
- ✅ Mensagem clara sobre o problema
- ✅ Job não é criado

**Validações**:
- [ ] Validação no frontend (feedback imediato)
- [ ] Validação no backend (segurança)
- [ ] Mensagens de erro claras

---

### Teste 13: Erro de Quota Excedida

**Objetivo**: Validar bloqueio quando quota é excedida

**Passos**:
1. Configure quota baixa (ex: 1 por dia)
2. Gere um conteúdo
3. Tente gerar outro imediatamente

**Resultado Esperado**:
- ✅ Primeira geração funciona
- ✅ Segunda geração bloqueada
- ✅ Mensagem: "Quota excedida"
- ✅ Job não é criado

**Validações**:
- [ ] Verificação de quota antes de criar job
- [ ] Mensagem clara sobre limite
- [ ] Analytics mostra uso correto

---

### Teste 14: Cancelamento de Job

**Objetivo**: Validar cancelamento de job em processamento

**Passos**:
1. Crie um job de vídeo (leva mais tempo)
2. Enquanto processando, clique em **"Cancelar"**
3. Verifique status

**Resultado Esperado**:
- ✅ Job muda para "canceled"
- ✅ Processamento para (se possível)
- ✅ Job aparece na seção "Falhas"

**Validações**:
- [ ] Status atualizado no banco
- [ ] UI atualiza corretamente
- [ ] Worker respeita cancelamento

---

## ✅ Checklist de Validação Completa

### Funcionalidades Básicas
- [ ] Geração de imagem (Gemini) funciona
- [ ] Geração de imagem (OpenAI) funciona
- [ ] Geração de vídeo (Gemini) funciona
- [ ] Geração de vídeo (OpenAI) funciona
- [ ] Expansão de prompts funciona
- [ ] Templates podem ser salvos e usados
- [ ] Galeria exibe todos os conteúdos
- [ ] Analytics mostra dados corretos

### Funcionalidades Avançadas
- [ ] Imagens de referência funcionam
- [ ] Inpainting com máscara funciona
- [ ] Múltiplas imagens de referência funcionam
- [ ] Filtros na galeria funcionam
- [ ] Favoritar templates funciona
- [ ] Busca de templates funciona

### Worker e Assíncrono
- [ ] Worker processa jobs automaticamente
- [ ] Polling de vídeos funciona
- [ ] Retry em caso de falha funciona
- [ ] Uso é registrado corretamente

### Tratamento de Erros
- [ ] Erros de API são tratados
- [ ] Validações funcionam
- [ ] Quotas são respeitadas
- [ ] Cancelamento funciona
- [ ] Mensagens de erro são claras

### Performance
- [ ] Página carrega em tempo razoável
- [ ] Galeria com muitos itens funciona
- [ ] Polling não sobrecarrega sistema
- [ ] Imagens/vídeos carregam rapidamente

---

## 📊 Relatório de Testes

Após executar todos os testes, preencha:

**Data**: _______________  
**Testador**: _______________  
**Ambiente**: [ ] Desenvolvimento [ ] Staging [ ] Produção

**Resultados**:
- Testes Passaram: ___ / 14
- Testes Falharam: ___ / 14
- Bloqueadores: ___

**Observações**:
_________________________________________________
_________________________________________________
_________________________________________________

---

## 🔧 Troubleshooting de Testes

### Worker não processa jobs

**Verificar**:
1. Worker está rodando? (Netlify Scheduled Function)
2. Logs do worker mostram erros?
3. Jobs estão realmente na fila?

**Solução**:
- Verificar configuração do Netlify Cron
- Verificar logs em Netlify Dashboard
- Executar worker manualmente se necessário

### Prompts não expandem

**Verificar**:
1. API keys configuradas?
2. Endpoint `/marketing-prompt-expand` acessível?
3. Console do navegador mostra erros?

**Solução**:
- Verificar variáveis de ambiente
- Testar endpoint diretamente
- Verificar CORS headers

### Vídeos não completam

**Verificar**:
1. Polling está funcionando?
2. `provider_ref` está salvo?
3. Provider retorna status correto?

**Solução**:
- Verificar logs do worker
- Testar polling manualmente
- Verificar documentação do provider

---

**Última atualização**: 2025-12-24

