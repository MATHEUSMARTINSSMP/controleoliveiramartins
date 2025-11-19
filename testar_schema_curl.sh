#!/bin/bash

# Script para testar o schema do PostgREST usando curl
# Execute: bash testar_schema_curl.sh

SUPABASE_URL="https://kktsbnrnlnzyofupegjc.supabase.co"
SUPABASE_ANON_KEY="sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp"
SCHEMA="sacadaohboy-mrkitsch-loungerie"

echo "=========================================="
echo "TESTE 1: Sem header Accept-Profile (deve usar public)"
echo "=========================================="
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/profiles?select=id,name&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" | jq '.' || echo "Erro ao fazer requisição"

echo ""
echo "=========================================="
echo "TESTE 2: Com header Accept-Profile: ${SCHEMA}"
echo "=========================================="
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/profiles?select=id,name&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: ${SCHEMA}" | jq '.' || echo "Erro ao fazer requisição"

echo ""
echo "=========================================="
echo "TESTE 3: Com header Accept-Profile e Content-Profile: ${SCHEMA}"
echo "=========================================="
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/profiles?select=id,name&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: ${SCHEMA}" \
  -H "Content-Profile: ${SCHEMA}" | jq '.' || echo "Erro ao fazer requisição"

echo ""
echo "=========================================="
echo "TESTE 4: Verificar schemas expostos (endpoint root)"
echo "=========================================="
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" | jq '.' || echo "Erro ao fazer requisição"

echo ""
echo "=========================================="
echo "TESTE 5: Query específica com filtro no schema ${SCHEMA}"
echo "=========================================="
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/profiles?select=id,name,email&role=eq.COLABORADORA&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: ${SCHEMA}" \
  -H "Content-Profile: ${SCHEMA}" | jq '.' || echo "Erro ao fazer requisição"

echo ""
echo "=========================================="
echo "TESTE 6: Verificar se o schema está na lista de schemas permitidos"
echo "=========================================="
curl -s -X OPTIONS \
  "${SUPABASE_URL}/rest/v1/profiles" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Accept-Profile: ${SCHEMA}" \
  -v 2>&1 | grep -i "accept-profile\|content-profile\|schema" || echo "Não encontrou headers relacionados"

echo ""
echo "=========================================="
echo "TESTE 7: Testar com Prefer header (PostgREST)"
echo "=========================================="
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/profiles?select=id,name&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: ${SCHEMA}" \
  -H "Prefer: return=representation" | jq '.' || echo "Erro ao fazer requisição"

echo ""
echo "=========================================="
echo "TESTE 8: Verificar resposta completa (com headers)"
echo "=========================================="
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/profiles?select=id,name&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: ${SCHEMA}" \
  -i | head -30

echo ""
echo "=========================================="
echo "TESTES CONCLUÍDOS"
echo "=========================================="

