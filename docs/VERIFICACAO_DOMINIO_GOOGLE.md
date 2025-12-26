# Verificação de Domínio no Google Cloud Console

## 📋 Problema

O Google está reclamando que:
1. O domínio `eleveaone.com.br` não está verificado como seu
2. A página inicial não tem link para a Política de Privacidade

## ✅ Solução

### Passo 1: Verificar o Domínio no Google Search Console

1. **Acesse o Google Search Console:**
   - https://search.google.com/search-console

2. **Adicione uma propriedade:**
   - Clique em "Adicionar propriedade"
   - Selecione "Prefixo de URL"
   - Digite: `https://eleveaone.com.br`
   - Clique em "Continuar"

3. **Verifique a propriedade:**
   O Google oferece várias opções de verificação. A mais comum é via **arquivo HTML**:

   **Opção A: Arquivo HTML (Recomendado)**
   - Baixe o arquivo HTML fornecido pelo Google
   - Faça upload na raiz do seu site (`/public/` no Netlify)
   - O arquivo deve estar acessível em: `https://eleveaone.com.br/google[hash].html`
   - Clique em "Verificar" no Google Search Console

   **Opção B: Meta Tag HTML**
   - Copie a meta tag fornecida pelo Google
   - Adicione no `<head>` do `index.html`
   - Clique em "Verificar" no Google Search Console

   **Opção C: Google Analytics ou Google Tag Manager**
   - Se você já tem GA ou GTM configurado, pode usar essa opção

4. **Aguarde a verificação:**
   - Pode levar alguns minutos
   - Após verificado, o domínio aparecerá como "Verificado" no Google Search Console

### Passo 2: Adicionar Domínio no Google Cloud Console

1. **Acesse o OAuth Consent Screen:**
   - https://console.cloud.google.com/apis/credentials/consent?project=cosmic-sensor-473804-k9
   - **Project ID**: `cosmic-sensor-473804-k9`

2. **Vá para a seção "Domínios autorizados":**
   - Role até "Domínios autorizados"
   - Adicione: `eleveaone.com.br`
   - Clique em "Salvar"

3. **Verifique se o domínio aparece como verificado:**
   - Após adicionar, o Google pode pedir verificação adicional
   - Se pedir, use o Google Search Console (Passo 1)

### Passo 3: Verificar Link da Política de Privacidade na Página Inicial

✅ **Já corrigido!** Os links no footer da página Landing agora apontam para:
- `/privacy` ou `/politicas` - Política de Privacidade
- `/terms` ou `/termos` - Termos de Serviço

**Verifique se está funcionando:**
1. Acesse: https://eleveaone.com.br
2. Role até o footer
3. Clique em "Privacidade" - deve abrir a página de política de privacidade
4. Clique em "Termos de Uso" - deve abrir a página de termos de serviço

### Passo 4: Atualizar OAuth Consent Screen

1. **Acesse o OAuth Consent Screen:**
   - https://console.cloud.google.com/apis/credentials/consent?project=cosmic-sensor-473804-k9
   - **Project ID**: `cosmic-sensor-473804-k9`

2. **Verifique os campos:**
   - **Página inicial**: `https://eleveaone.com.br` (sem barra no final)
   - **Política de Privacidade**: `https://eleveaone.com.br/privacy`
   - **Termos de Serviço**: `https://eleveaone.com.br/terms`

3. **Clique em "Salvar"**

4. **Aguarde alguns minutos** para as mudanças entrarem em vigor

### Passo 5: Reenviar para Verificação

1. **Acesse o OAuth Consent Screen:**
   - https://console.cloud.google.com/apis/credentials/consent?project=cosmic-sensor-473804-k9
   - **Project ID**: `cosmic-sensor-473804-k9`

2. **Clique em "Preparar para verificação"** (no final da página)

3. **Revise todas as informações**

4. **Clique em "Enviar para verificação"**

## 🔍 Verificação Rápida

Antes de reenviar, verifique:

- [ ] Domínio `eleveaone.com.br` verificado no Google Search Console
- [ ] Domínio `eleveaone.com.br` adicionado em "Domínios autorizados" no OAuth Consent Screen
- [ ] Página inicial (`https://eleveaone.com.br`) acessível sem login
- [ ] Link para Política de Privacidade visível no footer da página inicial
- [ ] Política de Privacidade acessível em `https://eleveaone.com.br/privacy`
- [ ] Termos de Serviço acessíveis em `https://eleveaone.com.br/terms`
- [ ] URLs no OAuth Consent Screen sem barra no final (ex: `https://eleveaone.com.br` e não `https://eleveaone.com.br/`)

## 📚 Referências

- [Google Search Console](https://search.google.com/search-console)
- [Google Cloud Console - OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
- [Documentação Google - App Homepage](https://support.google.com/cloud/answer/13807376?hl=pt-BR)

## ⚠️ Notas Importantes

1. **Não use URLs encurtadas** (ex: bit.ly, tinyurl)
2. **Não use redirecionamentos** - a URL deve ser estática
3. **Não coloque a página atrás de login** - deve ser acessível publicamente
4. **A página inicial deve explicar o propósito do app** e como usa os dados do Google
5. **O link da política de privacidade deve estar visível** na página inicial (não escondido)

## 🆘 Troubleshooting

### "Domínio não verificado"
- Verifique se o domínio está no Google Search Console
- Aguarde até 24 horas após adicionar no Search Console
- Tente verificar novamente no OAuth Consent Screen

### "Link da política não encontrado"
- Verifique se o link está funcionando: `https://eleveaone.com.br/privacy`
- Certifique-se de que o link está visível no footer (não escondido)
- Teste em modo anônimo/privado do navegador

### "Página inicial não acessível"
- Verifique se o site está online
- Teste em modo anônimo/privado
- Certifique-se de que não requer login para ver informações básicas

