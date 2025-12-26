# ✅ Checklist Completo - Verificação Google OAuth

## 📋 Informações do Projeto

- **Project ID**: `cosmic-sensor-473804-k9`
- **Client ID**: `[SEU_CLIENT_ID]` (obtenha no Google Cloud Console)
- **Client Secret**: `[SEU_CLIENT_SECRET]` (obtenha no Google Cloud Console)
- **Domínio Principal**: `eleveaone.com.br`

## 🔗 Links Rápidos

- **OAuth Consent Screen**: https://console.cloud.google.com/apis/credentials/consent?project=cosmic-sensor-473804-k9
- **OAuth Client Config**: https://console.cloud.google.com/apis/credentials?project=cosmic-sensor-473804-k9
- **Branding**: https://console.cloud.google.com/auth/branding?project=cosmic-sensor-473804-k9
- **Google Search Console**: https://search.google.com/search-console

## ✅ Checklist de Verificação

### 1. Verificação de Domínio

- [ ] Domínio `eleveaone.com.br` adicionado no Google Search Console
- [ ] Domínio verificado no Google Search Console (arquivo HTML, meta tag ou Google Analytics)
- [ ] Domínio `eleveaone.com.br` adicionado em "Domínios autorizados" no OAuth Consent Screen
- [ ] Domínio aparece como "Verificado" no Google Cloud Console

**Como verificar:**
1. Acesse: https://search.google.com/search-console
2. Adicione propriedade: `https://eleveaone.com.br`
3. Siga o processo de verificação
4. Depois, adicione em: https://console.cloud.google.com/apis/credentials/consent?project=cosmic-sensor-473804-k9

### 2. Página Inicial (Homepage)

- [ ] URL da página inicial: `https://eleveaone.com.br` (sem barra no final)
- [ ] Página acessível sem login
- [ ] Página explica o propósito do aplicativo
- [ ] Página explica como usa os dados do Google
- [ ] Link para Política de Privacidade visível no footer
- [ ] Link da Política de Privacidade funciona: `https://eleveaone.com.br/privacy`

**Verificar:**
- Acesse: https://eleveaone.com.br
- Role até o footer
- Clique em "Privacidade" - deve abrir `/privacy`
- Certifique-se de que a página não requer login

### 3. Política de Privacidade

- [ ] URL da Política: `https://eleveaone.com.br/privacy` ou `https://eleveaone.com.br/politicas`
- [ ] Página acessível publicamente
- [ ] Política explica como os dados do Google são usados
- [ ] Link visível na página inicial (footer)
- [ ] URL no OAuth Consent Screen corresponde ao link na homepage

**Verificar:**
- Acesse: https://eleveaone.com.br/privacy
- Deve carregar sem erro
- Deve explicar uso de dados do Google OAuth

### 4. Termos de Serviço

- [ ] URL dos Termos: `https://eleveaone.com.br/terms` ou `https://eleveaone.com.br/termos`
- [ ] Página acessível publicamente
- [ ] URL no OAuth Consent Screen configurada

**Verificar:**
- Acesse: https://eleveaone.com.br/terms
- Deve carregar sem erro

### 5. OAuth Consent Screen - Branding

- [ ] Nome do app: `ELEVEA`
- [ ] E-mail de suporte: `mathmartins@gmail.com`
- [ ] Logo carregada (120x120px, JPG/PNG/BMP)
- [ ] Página inicial: `https://eleveaone.com.br`
- [ ] Política de Privacidade: `https://eleveaone.com.br/privacy`
- [ ] Termos de Serviço: `https://eleveaone.com.br/terms`
- [ ] Domínios autorizados incluem: `eleveaone.com.br`

**Acessar:** https://console.cloud.google.com/auth/branding?project=cosmic-sensor-473804-k9

### 6. OAuth Client - URIs

- [ ] Origens JavaScript autorizadas:
  - [ ] `https://eleveaagencia.netlify.app`
  - [ ] `https://fluxos.eleveaagencia.com.br`
  - [ ] `https://eleveaone.com.br`
- [ ] URIs de redirecionamento:
  - [ ] `https://fluxos.eleveaagencia.com.br/webhook/api/auth/google/callback`

**Acessar:** https://console.cloud.google.com/apis/credentials?project=cosmic-sensor-473804-k9

### 7. Requisitos da Página Inicial (Google)

Conforme [documentação do Google](https://support.google.com/cloud/answer/13807376?hl=pt-BR):

- [ ] ✅ Representa e identifica seu app/marca
- [ ] ✅ Descreve completamente a funcionalidade do app
- [ ] ✅ Explica com transparência o propósito do uso de dados do Google
- [ ] ✅ Hospedado em domínio verificado que você possui
- [ ] ✅ Inclui link para Política de Privacidade (visível, não escondido)
- [ ] ✅ Visível sem requerer login

### 8. Teste do Fluxo OAuth

- [ ] Endpoint de start funciona: `https://fluxos.eleveaagencia.com.br/webhook/api/auth/google/start?customerId=TEST&siteSlug=test`
- [ ] Retorna `authUrl` corretamente
- [ ] `authUrl` abre a tela de consentimento do Google
- [ ] Após autorizar, redireciona para callback
- [ ] Callback processa corretamente
- [ ] Tokens são salvos no banco de dados

## 🚨 Problemas Comuns e Soluções

### "Domínio não verificado"
**Solução:**
1. Verifique no Google Search Console
2. Aguarde até 24 horas após adicionar
3. Adicione em "Domínios autorizados" no OAuth Consent Screen

### "Link da política não encontrado"
**Solução:**
1. Verifique se `/privacy` está acessível
2. Certifique-se de que o link está visível no footer
3. Teste em modo anônimo/privado

### "Página inicial não acessível"
**Solução:**
1. Verifique se o site está online
2. Teste sem login
3. Certifique-se de que não requer autenticação para ver informações básicas

### "Página inicial não explica uso de dados"
**Solução:**
1. Adicione uma seção explicando:
   - Por que você solicita dados do Google
   - Como os dados são usados
   - Para que finalidade (ex: integração com Google My Business)

## 📝 Próximos Passos

Após completar todos os itens:

1. **Revisar tudo no OAuth Consent Screen:**
   - https://console.cloud.google.com/apis/credentials/consent?project=cosmic-sensor-473804-k9

2. **Clicar em "Preparar para verificação"**

3. **Revisar todas as informações**

4. **Clicar em "Enviar para verificação"**

5. **Aguardar resposta do Google** (pode levar alguns dias)

## 📚 Documentação de Referência

- [Google - App Homepage Requirements](https://support.google.com/cloud/answer/13807376?hl=pt-BR)
- [Google Search Console](https://search.google.com/search-console)
- [Google Cloud Console - OAuth](https://console.cloud.google.com/apis/credentials/consent?project=cosmic-sensor-473804-k9)

