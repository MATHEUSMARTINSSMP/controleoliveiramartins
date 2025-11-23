/**
 * Helper para enviar mensagens WhatsApp
 */

interface SendWhatsAppParams {
  phone: string;
  message: string;
}

interface SendWhatsAppResponse {
  success: boolean;
  message?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Envia mensagem WhatsApp via função Netlify
 */
export async function sendWhatsAppMessage({
  phone,
  message,
}: SendWhatsAppParams): Promise<SendWhatsAppResponse> {
  try {
    console.log('📱 [sendWhatsAppMessage] Iniciando envio de WhatsApp...');
    console.log('📱 [sendWhatsAppMessage] Telefone:', phone);
    console.log('📱 [sendWhatsAppMessage] Mensagem (primeiros 100 chars):', message.substring(0, 100));
    
    // Detectar se está em desenvolvimento ou produção
    const isDevelopment = import.meta.env.DEV;
    const baseUrl = isDevelopment
      ? 'http://localhost:8888' // Netlify Dev local
      : window.location.origin; // Produção

    const functionUrl = `${baseUrl}/.netlify/functions/send-whatsapp-message`;
    console.log('📱 [sendWhatsAppMessage] URL da função Netlify:', functionUrl);
    console.log('📱 [sendWhatsAppMessage] Ambiente:', isDevelopment ? 'DESENVOLVIMENTO' : 'PRODUÇÃO');

    const payload = {
      phone,
      message,
    };

    console.log('📱 [sendWhatsAppMessage] Enviando requisição para Netlify Function...');
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('📱 [sendWhatsAppMessage] Resposta recebida. Status:', response.status, response.statusText);

    const data = await response.json();
    console.log('📱 [sendWhatsAppMessage] Dados da resposta:', data);

    if (!response.ok) {
      console.error('📱 [sendWhatsAppMessage] ❌ Erro na resposta:', data);
      throw new Error(data.error || 'Erro ao enviar mensagem WhatsApp');
    }

    console.log('📱 [sendWhatsAppMessage] ✅ Mensagem enviada com sucesso!');
    return data;
  } catch (error: any) {
    console.error('📱 [sendWhatsAppMessage] ❌ Erro ao enviar mensagem WhatsApp:', error);
    console.error('📱 [sendWhatsAppMessage] Stack:', error.stack);
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

/**
 * Formata mensagem de venda lançada (notificação para administrador)
 */
export function formatVendaMessage(params: {
  colaboradoraName: string;
  valor: number;
  qtdPecas: number;
  storeName?: string;
  dataVenda?: string;
  observacoes?: string | null;
}): string {
  const { colaboradoraName, valor, qtdPecas, storeName, dataVenda, observacoes } = params;
  
  const dataFormatada = dataVenda
    ? new Date(dataVenda).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'hoje';

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);

  // Formatar mensagem com quebras de linha usando \n
  // A Netlify Function vai escapar corretamente a mensagem antes de enviar para o n8n
  // Isso permite que o n8n use {{ $json.message }} sem quebrar o JSON
  let message = `🛒 *Nova Venda Lançada*\n\n`;
  
  message += `*Colaboradora:* ${colaboradoraName}\n`;
  
  if (storeName) {
    message += `*Loja:* ${storeName}\n`;
  }
  
  message += `*Valor:* ${valorFormatado}\n`;
  message += `*Quantidade de Peças:* ${qtdPecas}\n`;
  message += `*Data:* ${dataFormatada}\n`;
  
  // Adicionar observações se houver
  if (observacoes && observacoes.trim()) {
    message += `\n*Observações:*\n${observacoes.trim()}\n`;
  }
  
  message += `\nSistema EleveaOne 📊`;

  return message;
}

