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
    // Detectar se está em desenvolvimento ou produção
    const isDevelopment = import.meta.env.DEV;
    const baseUrl = isDevelopment
      ? 'http://localhost:8888' // Netlify Dev local
      : window.location.origin; // Produção

    const response = await fetch(`${baseUrl}/.netlify/functions/send-whatsapp-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone,
        message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao enviar mensagem WhatsApp');
    }

    return data;
  } catch (error: any) {
    console.error('Erro ao enviar mensagem WhatsApp:', error);
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
}): string {
  const { colaboradoraName, valor, qtdPecas, storeName, dataVenda } = params;
  
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

  let message = `🛒 *Nova Venda Lançada*\n\n`;
  message += `*Colaboradora:* ${colaboradoraName}\n`;
  
  if (storeName) {
    message += `*Loja:* ${storeName}\n`;
  }
  
  message += `*Valor:* ${valorFormatado}\n`;
  message += `*Quantidade de Peças:* ${qtdPecas}\n`;
  message += `*Data:* ${dataFormatada}\n\n`;
  message += `Sistema EleveaOne 📊`;

  return message;
}

