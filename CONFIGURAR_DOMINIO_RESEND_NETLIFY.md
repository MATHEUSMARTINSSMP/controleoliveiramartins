# Como Configurar eleveaone.com.br no Resend (já está no Netlify)

## 📋 Passo a Passo

### 1. Adicionar Domínio no Resend

1. Acesse: https://resend.com/domains
2. Clique em **"+ Add domain"**
3. Digite: `eleveaone.com.br`
4. Escolha a região: **São Paulo (sa-east-1)**
5. Clique em **"Add"**

### 2. Configurar Registros DNS no Netlify

O Resend vai mostrar os registros DNS que você precisa adicionar. Siga estes passos:

#### No Netlify:

1. Acesse: https://app.netlify.com/projects/eleveaone/domain-management
2. Clique em **"eleveaone.com.br"** → **"Options"** → **"DNS"**
3. Ou acesse diretamente: https://app.netlify.com/projects/eleveaone/dns

#### Adicionar Registros:

**a) DKIM (Domain Verification):**
- **Tipo:** `TXT`
- **Nome:** `resend._domainkey`
- **Valor:** (copie do Resend - algo como `p=MIGfMAOGCSqGSIb3DQEB...`)
- **TTL:** Auto ou 3600

**b) SPF (Enable Sending):**
- **Tipo:** `TXT`
- **Nome:** `send`
- **Valor:** (copie do Resend - algo como `v=spf1 include:amazonses.com ~all`)
- **TTL:** 3600

**c) MX (Enable Sending - opcional):**
- **Tipo:** `MX`
- **Nome:** `send`
- **Valor:** (copie do Resend - algo como `feedback-smtp.sa-east-1.amazonses.com`)
- **Prioridade:** `10`
- **TTL:** 3600

**d) MX (Enable Receiving - opcional, só se quiser receber emails):**
- **Tipo:** `MX`
- **Nome:** `@` (ou deixe vazio)
- **Valor:** (copie do Resend - algo como `inbound-smtp.sa-east-1.amazonaws.com`)
- **Prioridade:** `10`
- **TTL:** 3600

### 3. Verificar no Resend

1. Volte para o Resend
2. Aguarde alguns minutos para propagação DNS
3. O status deve mudar de "Pending" para **"Verified"** ✅

### 4. Atualizar Código

Após verificar, atualize o código para usar `senhas@eleveaone.com.br` em vez de `senhas@eleveaagencia.com.br`.

## ⚠️ Importante

- **Netlify e Resend podem coexistir:** Netlify usa A/CNAME para o site, Resend usa TXT/MX para emails
- **Não remova os registros do Netlify:** Mantenha todos os registros existentes
- **Propagação DNS:** Pode levar de 5 minutos a 24 horas (geralmente 5-15 minutos)

## ✅ Vantagens

- ✅ Domínio do email corresponde ao domínio do link (`eleveaone.com.br`)
- ✅ Melhor deliverability (menos bounces)
- ✅ Mais profissional
- ✅ Resolve o alerta do Resend sobre "Link URLs match sending domain"

