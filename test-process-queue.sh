#!/bin/bash

# Script para testar processamento manual da fila de WhatsApp
# Uso: ./test-process-queue.sh

echo "🔍 Testando processamento da fila de WhatsApp..."
echo ""

# URL da função Netlify
NETLIFY_URL="https://eleveaone.com.br/.netlify/functions/process-whatsapp-queue"

echo "📡 Chamando: $NETLIFY_URL"
echo ""

# Fazer requisição POST
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$NETLIFY_URL" \
  -H "Content-Type: application/json" \
  -d '{}')

# Separar corpo da resposta e código HTTP
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📊 Status HTTP: $HTTP_CODE"
echo ""
echo "📦 Resposta:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Função executada com sucesso!"
    
    # Tentar extrair informações do JSON
    PROCESSED=$(echo "$BODY" | jq -r '.processed // "N/A"' 2>/dev/null)
    FAILED=$(echo "$BODY" | jq -r '.failed // "N/A"' 2>/dev/null)
    SKIPPED=$(echo "$BODY" | jq -r '.skipped // "N/A"' 2>/dev/null)
    
    if [ "$PROCESSED" != "N/A" ]; then
        echo ""
        echo "📈 Estatísticas:"
        echo "  - Processadas: $PROCESSED"
        echo "  - Falhas: $FAILED"
        echo "  - Puladas: $SKIPPED"
    fi
else
    echo "❌ Erro ao executar função (HTTP $HTTP_CODE)"
fi

echo ""
echo "💡 Dica: Verifique os logs no Netlify para mais detalhes"
echo "   https://app.netlify.com/sites/eleveaone/functions/process-whatsapp-queue"

