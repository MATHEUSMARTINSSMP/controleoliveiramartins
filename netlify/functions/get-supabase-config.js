/**
 * Netlify Function para retornar configuração do Supabase
 * Isso permite que o frontend busque a chave em runtime, sem incluí-la no bundle
 */

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Retorna apenas a chave pública (não é um secret)
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      url: process.env.VITE_SUPABASE_URL || '',
      publishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    }),
  };
};

