#!/bin/bash

# 🔍 Script para Verificar e Testar Edge Function
# 
# Este script verifica se a Edge Function está deployada e operacional
# 
# Uso: ./VERIFICAR_EDGE_FUNCTION.sh

# ⚙️ CONFIGURAÇÃO
PROJECT_REF="kktsbnrnlnzyofupegjc"
FUNCTION_NAME="sync-tiny-orders"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
STORE_ID="cee7d359-0240-4131-87a2-21ae44bd1bb4"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 VERIFICAÇÃO DE EDGE FUNCTION: ${FUNCTION_NAME}${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# 1. Verificar se Supabase CLI está instalado
echo -e "${YELLOW}1️⃣ Verificando Supabase CLI...${NC}"
if command -v supabase &> /dev/null; then
    echo -e "${GREEN}✅ Supabase CLI instalado${NC}"
    supabase --version
else
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo -e "   Instale com: npm install -g supabase"
    echo -e "   Ou use o Personal Access Token para deploy via API\n"
fi

# 2. Verificar estrutura da função local
echo -e "\n${YELLOW}2️⃣ Verificando estrutura local da função...${NC}"
if [ -f "supabase/functions/${FUNCTION_NAME}/index.ts" ]; then
    echo -e "${GREEN}✅ Arquivo index.ts encontrado${NC}"
    if [ -f "supabase/functions/${FUNCTION_NAME}/deno.json" ]; then
        echo -e "${GREEN}✅ Arquivo deno.json encontrado${NC}"
    else
        echo -e "${RED}❌ Arquivo deno.json não encontrado${NC}"
    fi
else
    echo -e "${RED}❌ Arquivo index.ts não encontrado${NC}"
fi

# 3. Verificar URL da função
echo -e "\n${YELLOW}3️⃣ URL da Edge Function:${NC}"
echo -e "   ${BLUE}${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}${NC}"

# 4. Instruções de teste
echo -e "\n${YELLOW}4️⃣ Para testar a função, você pode:${NC}"
echo -e "\n${BLUE}a) Via Dashboard do Supabase:${NC}"
echo -e "   https://supabase.com/dashboard/project/${PROJECT_REF}/functions/${FUNCTION_NAME}"
echo -e "   Clique em 'Invoke Function' e use:"
echo -e "   ${GREEN}{${NC}"
echo -e "   ${GREEN}  \"store_id\": \"${STORE_ID}\",${NC}"
echo -e "   ${GREEN}  \"sync_type\": \"ORDERS\",${NC}"
echo -e "   ${GREEN}  \"hard_sync\": false,${NC}"
echo -e "   ${GREEN}  \"limit\": 1,${NC}"
echo -e "   ${GREEN}  \"max_pages\": 1${NC}"
echo -e "   ${GREEN}}${NC}"

echo -e "\n${BLUE}b) Via cURL (substitua ANON_KEY):${NC}"
echo -e "   ${GREEN}curl -X POST \\${NC}"
echo -e "   ${GREEN}  '${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}' \\${NC}"
echo -e "   ${GREEN}  -H 'Authorization: Bearer SEU_ANON_KEY' \\${NC}"
echo -e "   ${GREEN}  -H 'Content-Type: application/json' \\${NC}"
echo -e "   ${GREEN}  -d '{\"store_id\": \"${STORE_ID}\", \"sync_type\": \"ORDERS\", \"hard_sync\": false, \"limit\": 1, \"max_pages\": 1}'${NC}"

echo -e "\n${BLUE}c) Via Frontend (Console do Navegador):${NC}"
echo -e "   ${GREEN}const { data, error } = await supabase.functions.invoke('${FUNCTION_NAME}', {${NC}"
echo -e "   ${GREEN}  body: {${NC}"
echo -e "   ${GREEN}    store_id: '${STORE_ID}',${NC}"
echo -e "   ${GREEN}    sync_type: 'ORDERS',${NC}"
echo -e "   ${GREEN}    hard_sync: false,${NC}"
echo -e "   ${GREEN}    limit: 1,${NC}"
echo -e "   ${GREEN}    max_pages: 1${NC}"
echo -e "   ${GREEN}  }${NC}"
echo -e "   ${GREEN}});${NC}"

# 5. Verificar variáveis de ambiente necessárias
echo -e "\n${YELLOW}5️⃣ Variáveis de ambiente necessárias (verificar no Dashboard):${NC}"
echo -e "   ${BLUE}SUPABASE_URL${NC} - Já configurado automaticamente"
echo -e "   ${BLUE}SUPABASE_SERVICE_ROLE_KEY${NC} - Verificar em Settings > Edge Functions > Secrets"
echo -e "   ${BLUE}NETLIFY_FUNCTION_URL${NC} - Deve ser: https://eleveaone.com.br"

# 6. Links úteis
echo -e "\n${YELLOW}6️⃣ Links úteis:${NC}"
echo -e "   📊 Dashboard: ${BLUE}https://supabase.com/dashboard/project/${PROJECT_REF}${NC}"
echo -e "   🔧 Functions: ${BLUE}https://supabase.com/dashboard/project/${PROJECT_REF}/functions${NC}"
echo -e "   📝 Logs: ${BLUE}https://supabase.com/dashboard/project/${PROJECT_REF}/functions/${FUNCTION_NAME}/logs${NC}"
echo -e "   ⚙️  Settings: ${BLUE}https://supabase.com/dashboard/project/${PROJECT_REF}/settings/functions${NC}"

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

