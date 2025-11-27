#!/bin/bash

# Script de Teste para Netlify Functions de Sincronização
# 
# Este script testa as funções de sincronização de pedidos e contatos
# 
# Uso:
#   ./test-sync-functions.sh <store_id> [tipo]
# 
# Exemplos:
#   ./test-sync-functions.sh <uuid> orders    # Testar sincronização de pedidos
#   ./test-sync-functions.sh <uuid> contacts  # Testar sincronização de contatos
#   ./test-sync-functions.sh <uuid>           # Testar ambas

set -e

STORE_ID=$1
TIPO=${2:-"both"}
NETLIFY_URL=${NETLIFY_URL:-"https://eleveaone.com.br"}

if [ -z "$STORE_ID" ]; then
  echo "❌ Erro: store_id é obrigatório"
  echo "Uso: $0 <store_id> [orders|contacts|both]"
  exit 1
fi

echo "🧪 Testando sincronização para loja: $STORE_ID"
echo "📡 URL: $NETLIFY_URL"
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para testar sincronização de pedidos
test_orders() {
  echo -e "${YELLOW}📦 Testando sincronização de pedidos...${NC}"
  
  RESPONSE=$(curl -s -X POST "${NETLIFY_URL}/.netlify/functions/sync-tiny-orders-background" \
    -H "Content-Type: application/json" \
    -d "{
      \"store_id\": \"${STORE_ID}\",
      \"incremental\": true,
      \"limit\": 10,
      \"max_pages\": 1
    }")
  
  if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Sincronização de pedidos: SUCESSO${NC}"
    echo "$RESPONSE" | jq '.'
    return 0
  else
    echo -e "${RED}❌ Sincronização de pedidos: FALHOU${NC}"
    echo "$RESPONSE"
    return 1
  fi
}

# Função para testar sincronização de contatos
test_contacts() {
  echo -e "${YELLOW}👤 Testando sincronização de contatos...${NC}"
  
  RESPONSE=$(curl -s -X POST "${NETLIFY_URL}/.netlify/functions/sync-tiny-contacts-background" \
    -H "Content-Type: application/json" \
    -d "{
      \"store_id\": \"${STORE_ID}\",
      \"limit\": 10,
      \"max_pages\": 1
    }")
  
  if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Sincronização de contatos: SUCESSO${NC}"
    echo "$RESPONSE" | jq '.'
    return 0
  else
    echo -e "${RED}❌ Sincronização de contatos: FALHOU${NC}"
    echo "$RESPONSE"
    return 1
  fi
}

# Executar testes
SUCCESS=0

if [ "$TIPO" = "orders" ] || [ "$TIPO" = "both" ]; then
  if test_orders; then
    SUCCESS=$((SUCCESS + 1))
  fi
  echo ""
fi

if [ "$TIPO" = "contacts" ] || [ "$TIPO" = "both" ]; then
  if test_contacts; then
    SUCCESS=$((SUCCESS + 1))
  fi
  echo ""
fi

# Resultado final
if [ "$TIPO" = "both" ]; then
  if [ $SUCCESS -eq 2 ]; then
    echo -e "${GREEN}✅ Todos os testes passaram!${NC}"
    exit 0
  else
    echo -e "${RED}❌ Alguns testes falharam${NC}"
    exit 1
  fi
else
  if [ $SUCCESS -eq 1 ]; then
    echo -e "${GREEN}✅ Teste passou!${NC}"
    exit 0
  else
    echo -e "${RED}❌ Teste falhou${NC}"
    exit 1
  fi
fi

