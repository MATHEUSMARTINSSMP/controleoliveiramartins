#!/bin/bash

# Script para testar endpoints do N8N WhatsApp
# Configurações
N8N_BASE_URL="https://fluxos.eleveaagencia.com.br"
N8N_WEBHOOK_AUTH="${N8N_WEBHOOK_AUTH:-}" # Definir via variável de ambiente ou descomentar abaixo
# N8N_WEBHOOK_AUTH="seu-token-aqui"

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Testes de Endpoints N8N WhatsApp${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Preparar headers
HEADERS=(-H "Content-Type: application/json" -H "Accept: application/json")
if [ ! -z "$N8N_WEBHOOK_AUTH" ]; then
    HEADERS+=(-H "x-app-key: $N8N_WEBHOOK_AUTH")
    echo -e "${GREEN}✓ Autenticação configurada${NC}"
else
    echo -e "${YELLOW}⚠ N8N_WEBHOOK_AUTH não configurado (alguns endpoints podem não funcionar)${NC}"
fi
echo ""

# ====================================================
# 1. TESTE: Status do WhatsApp (GET)
# ====================================================
echo -e "${BLUE}[1/4] Testando: Status do WhatsApp${NC}"
echo -e "${YELLOW}Endpoint: GET ${N8N_BASE_URL}/webhook/api/whatsapp/auth/status${NC}"

STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${HEADERS[@]}" \
    "${N8N_BASE_URL}/webhook/api/whatsapp/auth/status?siteSlug=mrkitsch&customerId=matheusmartinss@icloud.com")

HTTP_CODE=$(echo "$STATUS_RESPONSE" | tail -n1)
BODY=$(echo "$STATUS_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Status HTTP: $HTTP_CODE${NC}"
    echo -e "${GREEN}Resposta:${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ Status HTTP: $HTTP_CODE${NC}"
    echo -e "${RED}Resposta:${NC}"
    echo "$BODY"
fi
echo ""
echo ""

# ====================================================
# 2. TESTE: Conectar WhatsApp (POST)
# ====================================================
echo -e "${BLUE}[2/4] Testando: Conectar WhatsApp${NC}"
echo -e "${YELLOW}Endpoint: POST ${N8N_BASE_URL}/webhook/api/whatsapp/auth/connect${NC}"

CONNECT_PAYLOAD='{
  "siteSlug": "mrkitsch",
  "customerId": "matheusmartinss@icloud.com"
}'

CONNECT_RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${HEADERS[@]}" \
    -X POST \
    -d "$CONNECT_PAYLOAD" \
    "${N8N_BASE_URL}/webhook/api/whatsapp/auth/connect")

HTTP_CODE=$(echo "$CONNECT_RESPONSE" | tail -n1)
BODY=$(echo "$CONNECT_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Status HTTP: $HTTP_CODE${NC}"
    echo -e "${GREEN}Resposta:${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ Status HTTP: $HTTP_CODE${NC}"
    echo -e "${RED}Resposta:${NC}"
    echo "$BODY"
fi
echo ""
echo ""

# ====================================================
# 3. TESTE: Enviar Mensagem WhatsApp (POST)
# ====================================================
echo -e "${BLUE}[3/4] Testando: Enviar Mensagem WhatsApp${NC}"
echo -e "${YELLOW}Endpoint: POST ${N8N_BASE_URL}/webhook/api/whatsapp/send${NC}"

SEND_PAYLOAD='{
  "siteSlug": "mrkitsch",
  "customerId": "matheusmartinss@icloud.com",
  "phone_number": "559681032928",
  "message": "Teste de mensagem via curl - " $(date +%H:%M:%S)
}'

SEND_RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${HEADERS[@]}" \
    -X POST \
    -d "$SEND_PAYLOAD" \
    "${N8N_BASE_URL}/webhook/api/whatsapp/send")

HTTP_CODE=$(echo "$SEND_RESPONSE" | tail -n1)
BODY=$(echo "$SEND_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Status HTTP: $HTTP_CODE${NC}"
    echo -e "${GREEN}Resposta:${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ Status HTTP: $HTTP_CODE${NC}"
    echo -e "${RED}Resposta:${NC}"
    echo "$BODY"
fi
echo ""
echo ""

# ====================================================
# 4. TESTE: Status com número reserva (Backup)
# ====================================================
echo -e "${BLUE}[4/4] Testando: Status WhatsApp Backup${NC}"
echo -e "${YELLOW}Endpoint: GET ${N8N_BASE_URL}/webhook/api/whatsapp/auth/status (com whatsapp_account_id)${NC}"

# Nota: Para testar número reserva, precisamos do ID da conta backup
# Por enquanto, vamos apenas testar o endpoint normal novamente com diferentes parâmetros
BACKUP_STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${HEADERS[@]}" \
    "${N8N_BASE_URL}/webhook/api/whatsapp/auth/status?siteSlug=sacadaohboy&customerId=matheusmartinss@icloud.com")

HTTP_CODE=$(echo "$BACKUP_STATUS_RESPONSE" | tail -n1)
BODY=$(echo "$BACKUP_STATUS_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Status HTTP: $HTTP_CODE${NC}"
    echo -e "${GREEN}Resposta:${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ Status HTTP: $HTTP_CODE${NC}"
    echo -e "${RED}Resposta:${NC}"
    echo "$BODY"
fi
echo ""
echo ""

# ====================================================
# Resumo
# ====================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Testes Concluídos${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Notas:${NC}"
echo "- Para definir N8N_WEBHOOK_AUTH, execute: export N8N_WEBHOOK_AUTH='seu-token'"
echo "- Para testar com diferentes lojas, altere os parâmetros siteSlug e customerId"
echo "- Para testar número reserva, adicione: &whatsapp_account_id=UUID no endpoint de status"
echo ""

