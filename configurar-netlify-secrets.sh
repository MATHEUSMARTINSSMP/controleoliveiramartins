#!/bin/bash

# Script para configurar secrets scanning no Netlify via CLI
# Execute: bash configurar-netlify-secrets.sh

echo "🔧 Configurando Secrets Scanning no Netlify..."
echo ""

# Verificar se netlify CLI está instalado
if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI não está instalado."
    echo "📦 Instale com: npm install -g netlify-cli"
    echo "🔗 Ou acesse: https://app.netlify.com/sites/eleveaone/configuration/env"
    exit 1
fi

# Verificar se está logado
if ! netlify status &> /dev/null; then
    echo "🔐 Faça login no Netlify CLI:"
    netlify login
fi

echo "✅ Configurando variáveis de ambiente..."

# Configurar SECRETS_SCAN_OMIT_KEYS
echo "📝 Configurando SECRETS_SCAN_OMIT_KEYS..."
netlify env:set SECRETS_SCAN_OMIT_KEYS "SUPABASE_ANON_KEY,VITE_SUPABASE_ANON_KEY,VITE_SUPABASE_PUBLISHABLE_KEY" --context production --context deploy-preview --context branch-deploy

# Configurar SECRETS_SCAN_OMIT_PATHS
echo "📝 Configurando SECRETS_SCAN_OMIT_PATHS..."
netlify env:set SECRETS_SCAN_OMIT_PATHS "dist/**,attached_assets/**,sql_migrations_archive/**,*verificar*.js,*test*.js,*check*.js,*varredura*.js,*verify*.js" --context production --context deploy-preview --context branch-deploy

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "🔄 Agora faça um novo deploy:"
echo "   - Vá em: https://app.netlify.com/sites/eleveaone/deploys"
echo "   - Clique em 'Trigger deploy' > 'Deploy site'"
echo ""
echo "📋 Ou verifique as variáveis em:"
echo "   https://app.netlify.com/sites/eleveaone/configuration/env"

