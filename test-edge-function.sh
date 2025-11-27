#!/bin/bash

# 🧪 Script de Teste para Edge Function sync-tiny-orders
# 
# Uso: ./test-edge-function.sh
# 
# IMPORTANTE: Configure as variáveis abaixo antes de executar!

# ⚙️ CONFIGURAÇÃO
SUPABASE_URL="https://kktsbnrnlnzyofupegjc.supabase.co"
EDGE_FUNCTION_NAME="sync-tiny-orders"
STORE_ID="cee7d359-0240-4131-87a2-21ae44bd1bb4"

# 🔑 Substitua pela sua ANON KEY
ANON_KEY="SUA_ANON_KEY_AQUI"

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Testando Edge Function: ${EDGE_FUNCTION_NAME}${NC}\n"

# Função para testar
test_function() {
    local test_name=$1
    local payload=$2
    local expected_keyword=$3
    
    echo -e "${YELLOW}📋 Teste: ${test_name}${NC}"
    echo -e "Payload: ${payload}\n"
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        "${SUPABASE_URL}/functions/v1/${EDGE_FUNCTION_NAME}" \
        -H "Authorization: Bearer ${ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d "${payload}")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    echo -e "Status HTTP: ${http_code}"
    echo -e "Resposta: ${body}\n"
    
    if [ "$http_code" == "200" ]; then
        if echo "$body" | grep -q "$expected_keyword"; then
            echo -e "${GREEN}✅ TESTE PASSOU!${NC}\n"
            return 0
        else
            echo -e "${RED}⚠️  TESTE PARCIAL: Status OK mas resposta não contém '${expected_keyword}'${NC}\n"
            return 1
        fi
    else
        echo -e "${RED}❌ TESTE FALHOU: Status HTTP ${http_code}${NC}\n"
        return 1
    fi
}

# Teste 1: Chamada sem parâmetros (sincronização automática)
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
test_function \
    "Sincronização Automática (sem parâmetros)" \
    '{}' \
    "success"

# Teste 2: Sincronização manual de pedidos
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
test_function \
    "Sincronização Manual - Pedidos (background)" \
    "{
        \"store_id\": \"${STORE_ID}\",
        \"sync_type\": \"ORDERS\",
        \"hard_sync\": false,
        \"limit\": 1,
        \"max_pages\": 1
    }" \
    "background"

# Teste 3: Sincronização manual de clientes
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
test_function \
    "Sincronização Manual - Clientes (background)" \
    "{
        \"store_id\": \"${STORE_ID}\",
        \"sync_type\": \"CONTACTS\",
        \"hard_sync\": false,
        \"limit\": 1,
        \"max_pages\": 1
    }" \
    "background"

# Resumo
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Testes concluídos!${NC}"
echo -e "\n📝 Verifique os logs em:"
echo -e "   https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions/${EDGE_FUNCTION_NAME}/logs\n"

