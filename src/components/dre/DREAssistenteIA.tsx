/**
 * Assistente IA para DRE
 * Interface de chat para fazer perguntas sobre DRE
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sparkles, Send, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import * as dre from '@/lib/n8n-dre'
import type { DRERespostaIA } from '@/types/dre'

interface Message {
    type: 'user' | 'ai'
    content: string
    calculos?: Array<{
        label: string
        formula: string
        valor: number
    }>
}

interface Props {
    storeId?: string
}

export default function DREAssistenteIA({ storeId }: Props) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)

    const perguntasSugeridas = [
        'Qual minha margem de contribuição?',
        'Qual minha margem bruta?',
        'Qual minha margem líquida?',
        'Quanto gastei com pessoal este mês?',
        'Qual minha receita média mensal?',
        'Qual categoria tem mais despesas?'
    ]

    const handlePergunta = async (pergunta: string) => {
        if (!pergunta.trim()) return

        // Adicionar pergunta do usuário
        setMessages(prev => [...prev, { type: 'user', content: pergunta }])
        setInput('')
        setLoading(true)

        try {
            const resposta = await dre.perguntarDRE({ 
                pergunta,
                store_id: storeId && storeId !== 'all' ? storeId : undefined
            })

            // Se N8N não está configurado, mostrar mensagem informativa
            if (!resposta || (resposta as any).error?.includes('N8N não configurado')) {
                setMessages(prev => [...prev, {
                    type: 'ai',
                    content: 'Assistente IA não está configurado. Configure VITE_N8N_BASE_URL para usar esta funcionalidade.'
                }])
            } else {
                // Adicionar resposta da IA
                setMessages(prev => [...prev, {
                    type: 'ai',
                    content: resposta.resposta,
                    calculos: resposta.calculos
                }])
            }
        } catch (err: any) {
            const errorMsg = err.message || 'Erro desconhecido'
            // Não mostrar toast se for erro de N8N não configurado (já mostramos mensagem na UI)
            if (!errorMsg.includes('N8N não configurado')) {
                toast.error('Erro ao processar pergunta: ' + errorMsg)
            }
            setMessages(prev => [...prev, {
                type: 'ai',
                content: errorMsg.includes('N8N não configurado') 
                    ? 'Assistente IA não está configurado. Configure VITE_N8N_BASE_URL para usar esta funcionalidade.'
                    : 'Desculpe, não consegui processar sua pergunta. Tente novamente.'
            }])
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        handlePergunta(input)
    }

    return (
        <Card className="h-[600px] flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Assistente Financeiro IA
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Faça perguntas sobre seu DRE e obtenha respostas inteligentes
                </p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
                {/* Aviso se nenhuma loja selecionada */}
                {!storeId && (
                    <Alert className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Selecione uma loja específica no seletor acima para usar o Assistente IA.
                            A opção "Todas as Lojas (Consolidado)" não é suportada.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Perguntas Sugeridas */}
                {messages.length === 0 && storeId && (
                    <div className="mb-4">
                        <p className="text-sm font-medium mb-2">Perguntas sugeridas:</p>
                        <div className="flex flex-wrap gap-2">
                            {perguntasSugeridas.map((p, i) => (
                                <Button
                                    key={i}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePergunta(p)}
                                    disabled={loading || !storeId}
                                >
                                    {p}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Histórico de Mensagens */}
                <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg p-4 ${msg.type === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap">{msg.content}</p>

                                {/* Cálculos (se houver) */}
                                {msg.calculos && msg.calculos.length > 0 && (
                                    <div className="mt-4 space-y-2 border-t pt-3">
                                        <p className="text-sm font-semibold">Cálculos:</p>
                                        {msg.calculos.map((calc, j) => (
                                            <div key={j} className="text-sm">
                                                <p className="font-medium">{calc.label}</p>
                                                <p className="text-muted-foreground">{calc.formula}</p>
                                                <p className="font-bold">
                                                    R$ {calc.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-muted rounded-lg p-4">
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                    <span className="text-sm">Pensando...</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Digite sua pergunta..."
                        disabled={loading}
                    />
                    <Button type="submit" disabled={loading || !input.trim() || !storeId}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
