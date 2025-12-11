#!/bin/bash

# =====================================================
# Script de Teste: Edge Function de Notificações de Ponto
# =====================================================

echo "🧪 Testando Edge Function: process-time-clock-notifications"
echo ""

# Variáveis
SUPABASE_URL="https://kktsbnrnlnzyofupegjc.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s"
EDGE_FUNCTION_URL="${SUPABASE_URL}/functions/v1/process-time-clock-notifications"

echo "📡 Fazendo requisição para: ${EDGE_FUNCTION_URL}"
echo ""

# Fazer requisição
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST "${EDGE_FUNCTION_URL}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')

# Separar body e status code
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

echo "📥 Resposta:"
echo "HTTP Status: ${HTTP_CODE}"
echo ""
echo "Body:"
echo "${BODY}" | jq '.' 2>/dev/null || echo "${BODY}"

echo ""
echo "✅ Teste concluído!"
echo ""

# Verificar resultado
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Edge Function respondeu com sucesso!"
    PROCESSED=$(echo "${BODY}" | jq -r '.processed // 0' 2>/dev/null)
    SENT=$(echo "${BODY}" | jq -r '.sent // 0' 2>/dev/null)
    FAILED=$(echo "${BODY}" | jq -r '.failed // 0' 2>/dev/null)
    
    echo "📊 Estatísticas:"
    echo "   - Processadas: ${PROCESSED}"
    echo "   - Enviadas: ${SENT}"
    echo "   - Falhadas: ${FAILED}"
else
    echo "❌ Edge Function retornou erro (HTTP ${HTTP_CODE})"
    echo "   Verifique os logs no Supabase Dashboard"
fi

