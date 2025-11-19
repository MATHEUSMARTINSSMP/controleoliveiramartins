#!/bin/bash

# Script para testar detalhadamente o schema do PostgREST
SUPABASE_URL="https://kktsbnrnlnzyofupegjc.supabase.co"
SUPABASE_ANON_KEY="sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp"
SCHEMA="sacadaohboy-mrkitsch-loungerie"

echo "=========================================="
echo "TESTE 1: Verificar se a tabela profiles existe no schema"
echo "=========================================="
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/profiles?select=count" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: ${SCHEMA}" \
  -H "Prefer: count=exact" | jq '.'

echo ""
echo "=========================================="
echo "TESTE 2: Buscar todos os profiles (sem filtro)"
echo "=========================================="
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/profiles?select=*&limit=5" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: ${SCHEMA}" | jq '.'

echo ""
echo "=========================================="
echo "TESTE 3: Buscar profiles com role ADMIN"
echo "=========================================="
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/profiles?select=id,name,email,role&role=eq.ADMIN&limit=5" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: ${SCHEMA}" | jq '.'

echo ""
echo "=========================================="
echo "TESTE 4: Buscar profiles com role COLABORADORA"
echo "=========================================="
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/profiles?select=id,name,email,role&role=eq.COLABORADORA&limit=5" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: ${SCHEMA}" | jq '.'

echo ""
echo "=========================================="
echo "TESTE 5: Verificar erro detalhado (sem Accept-Profile)"
echo "=========================================="
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/profiles?select=id,name&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "=========================================="
echo "TESTE 6: Testar outras tabelas no schema"
echo "=========================================="
echo "Testando purchases..."
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/purchases?select=id,item&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: ${SCHEMA}" | jq '.'

echo ""
echo "Testando parcelas..."
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/parcelas?select=id,valor_parcela&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: ${SCHEMA}" | jq '.'

echo ""
echo "=========================================="
echo "TESTE 7: Verificar se há problema de RLS (Row Level Security)"
echo "=========================================="
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: ${SCHEMA}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" | jq '.'

echo ""
echo "=========================================="
echo "TESTE 8: Verificar resposta com verbose para ver headers"
echo "=========================================="
curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/profiles?select=id,name&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: ${SCHEMA}" \
  -i 2>&1 | grep -E "(HTTP|content-profile|accept-profile|Content-Profile|Accept-Profile)" | head -10

echo ""
echo "=========================================="
echo "TESTES DETALHADOS CONCLUÍDOS"
echo "=========================================="

