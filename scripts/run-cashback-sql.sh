#!/bin/bash

# Supabase credentials
SUPABASE_URL="https://kktsbnrnlnzyofupegjc.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s"

echo "🔧 Executando SQL de fix do cashback..."
echo ""

# Executar o SQL
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d @- << 'EOFSQL'
{
  "sql": "$(cat supabase/migrations/FIX_CASHBACK_COMPLETE.sql | sed 's/"/\\"/g' | tr '\n' ' ')"
}
EOFSQL

echo ""
echo "✅ Comando enviado!"
