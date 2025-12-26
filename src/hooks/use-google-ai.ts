import { useState } from "react";
import { toast } from "sonner";

export function useGoogleAI() {
    const [generating, setGenerating] = useState(false);

    const generateReply = async (reviewContent: string, rating: number, tone: "formal" | "friendly" | "funny") => {
        setGenerating(true);

        // Simulação de chamada à API de IA
        await new Promise((resolve) => setTimeout(resolve, 1500));

        let reply = "";

        if (rating >= 4) {
            if (tone === "formal") {
                reply = `Prezado(a) cliente, agradecemos imensamente sua avaliação positiva. Ficamos honrados com sua preferência e esperamos vê-lo novamente em breve. Atenciosamente, Equipe.`;
            } else if (tone === "friendly") {
                reply = `Olá! Muito obrigado pelo carinho! 😍 Ficamos super felizes que você tenha gostado. Volte sempre!`;
            } else {
                reply = `Uau! Que notaça! 🎉 Ganhei o dia com esse review. Valeu demais!`;
            }
        } else {
            if (tone === "formal") {
                reply = `Prezado(a) cliente, lamentamos que sua experiência não tenha sido ideal. Gostaríamos de entender melhor o ocorrido para melhorarmos nossos serviços. Por favor, entre em contato conosco.`;
            } else if (tone === "friendly") {
                reply = `Poxa, sentimos muito que não tenha sido perfeito. 😔 Queremos muito melhorar! Pode nos chamar para conversarmos sobre o que houve?`;
            } else {
                reply = `Eita, pisamos na bola? 😬 Conta pra gente o que rolou pra gente consertar isso aí!`;
            }
        }

        setGenerating(false);
        toast.success("Resposta gerada com IA!");
        return reply;
    };

    return {
        generateReply,
        generating,
    };
}
