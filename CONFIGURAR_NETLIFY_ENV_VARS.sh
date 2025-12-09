#!/bin/bash

# Script para configurar variáveis de ambiente no Netlify via CLI
# Execute: bash CONFIGURAR_NETLIFY_ENV_VARS.sh

echo "🔧 Configurando variáveis de ambiente no Netlify..."
echo ""

# Verificar se netlify CLI está instalado
if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI não está instalado."
    echo "   Instale com: npm install -g netlify-cli"
    echo ""
    echo "📝 OU configure manualmente no Netlify Dashboard:"
    echo "   https://app.netlify.com/sites/eleveaone/configuration/env"
    echo ""
    echo "   Adicione as seguintes variáveis:"
    echo "   - SECRETS_SCAN_OMIT_PATHS = attached_assets/**,sql_migrations_archive/**,dist/**,*verificar*.js,*test*.js,*check*.js,*varredura*.js,*verify*.js,processar-fila-whatsapp.js"
    echo "   - SECRETS_SCAN_OMIT_KEYS = SUPABASE_ANON_KEY,VITE_SUPABASE_ANON_KEY"
    exit 1
fi

# Configurar variáveis
echo "📝 Configurando SECRETS_SCAN_OMIT_PATHS..."
netlify env:set SECRETS_SCAN_OMIT_PATHS "attached_assets/**,sql_migrations_archive/**,dist/**,*verificar*.js,*test*.js,*check*.js,*varredura*.js,*verify*.js,processar-fila-whatsapp.js"

echo "📝 Configurando SECRETS_SCAN_OMIT_KEYS..."
netlify env:set SECRETS_SCAN_OMIT_KEYS "SUPABASE_ANON_KEY,VITE_SUPABASE_ANON_KEY"

echo ""
echo "✅ Variáveis configuradas com sucesso!"
echo "🔄 Faça um novo deploy para aplicar as mudanças."

