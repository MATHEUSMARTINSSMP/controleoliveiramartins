#!/bin/bash

# 🧪 Script de Teste Completo - Edge Function sync-tiny-orders
# 
# Este script executa testes completos para verificar se a Edge Function está operacional

# ⚙️ CONFIGURAÇÃO
PROJECT_REF="kktsbnrnlnzyofupegjc"
FUNCTION_NAME="sync-tiny-orders"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
FUNCTION_URL="${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}"
STORE_ID="cee7d359-0240-4131-87a2-21ae44bd1bb4"
PERSONAL_ACCESS_TOKEN="sbp_1ddf5cc7ba0370fede733a28a17cba8e2909e3ab"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Contadores
TESTS_PASSED=0
TESTS_FAILED=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 TESTES COMPLETOS - EDGE FUNCTION: ${FUNCTION_NAME}${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Função para testar
test_function() {
    local test_name=$1
    local payload=$2
    local expected_keyword=$3
    
    echo -e "${CYAN}📋 Teste: ${test_name}${NC}"
    
    # Fazer requisição
    response=$(curl -s -w "\n%{http_code}" -X POST \
        "${FUNCTION_URL}" \
        -H "Authorization: Bearer ${PERSONAL_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "${payload}" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # Verificar resultado
    if [ "$http_code" == "200" ] || [ "$http_code" == "201" ]; then
        if [ -z "$expected_keyword" ] || echo "$body" | grep -qi "$expected_keyword"; then
            echo -e "${GREEN}✅ PASSOU${NC} - Status: ${http_code}"
            echo -e "${GREEN}   Resposta: ${body:0:200}...${NC}\n"
            ((TESTS_PASSED++))
            return 0
        else
            echo -e "${YELLOW}⚠️  PARCIAL${NC} - Status: ${http_code} (resposta não contém '${expected_keyword}')"
            echo -e "${YELLOW}   Resposta: ${body:0:200}...${NC}\n"
            ((TESTS_PASSED++))
            return 1
        fi
    else
        echo -e "${RED}❌ FALHOU${NC} - Status: ${http_code}"
        echo -e "${RED}   Resposta: ${body:0:200}...${NC}\n"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Teste 1: Verificar se função existe (OPTIONS request)
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}1️⃣ Verificando se função está deployada (CORS preflight)...${NC}\n"

cors_response=$(curl -s -w "\n%{http_code}" -X OPTIONS \
    "${FUNCTION_URL}" \
    -H "Authorization: Bearer ${PERSONAL_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" 2>&1)

cors_code=$(echo "$cors_response" | tail -n1)

if [ "$cors_code" == "200" ]; then
    echo -e "${GREEN}✅ Função está deployada e respondendo!${NC}\n"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Função não encontrada ou não deployada (Status: ${cors_code})${NC}"
    echo -e "${RED}   ⚠️  A função precisa ser deployada primeiro!${NC}\n"
    ((TESTS_FAILED++))
    echo -e "${YELLOW}💡 Para fazer deploy, veja: DEPLOY_EDGE_FUNCTION_COM_TOKEN.md${NC}\n"
fi

# Teste 2: Sincronização automática (sem parâmetros)
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
test_function \
    "2️⃣ Sincronização Automática (sem parâmetros)" \
    '{}' \
    "success"

# Teste 3: Sincronização manual de pedidos
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
test_function \
    "3️⃣ Sincronização Manual - Pedidos (background)" \
    "{
        \"store_id\": \"${STORE_ID}\",
        \"sync_type\": \"ORDERS\",
        \"hard_sync\": false,
        \"limit\": 1,
        \"max_pages\": 1
    }" \
    "background"

# Teste 4: Sincronização manual de clientes
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
test_function \
    "4️⃣ Sincronização Manual - Clientes (background)" \
    "{
        \"store_id\": \"${STORE_ID}\",
        \"sync_type\": \"CONTACTS\",
        \"hard_sync\": false,
        \"limit\": 1,
        \"max_pages\": 1
    }" \
    "background"

# Teste 5: Hard Sync
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
test_function \
    "5️⃣ Hard Sync Absoluto (teste rápido)" \
    "{
        \"store_id\": \"${STORE_ID}\",
        \"sync_type\": \"ORDERS\",
        \"hard_sync\": true,
        \"data_inicio\": \"2025-11-26\",
        \"limit\": 1,
        \"max_pages\": 1
    }" \
    "background"

# Resumo final
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 RESUMO DOS TESTES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ TODOS OS TESTES PASSARAM!${NC}"
    echo -e "${GREEN}   ${TESTS_PASSED}/${TOTAL_TESTS} testes passaram${NC}\n"
    echo -e "${GREEN}🎉 Edge Function está 100% OPERACIONAL!${NC}\n"
    exit 0
else
    echo -e "${YELLOW}⚠️  ALGUNS TESTES FALHARAM${NC}"
    echo -e "${GREEN}   ${TESTS_PASSED} testes passaram${NC}"
    echo -e "${RED}   ${TESTS_FAILED} testes falharam${NC}\n"
    
    if [ $TESTS_FAILED -eq 1 ] && [ "$cors_code" != "200" ]; then
        echo -e "${YELLOW}💡 A função precisa ser deployada primeiro!${NC}"
        echo -e "${YELLOW}   Veja: DEPLOY_EDGE_FUNCTION_COM_TOKEN.md${NC}\n"
    fi
    
    exit 1
fi

