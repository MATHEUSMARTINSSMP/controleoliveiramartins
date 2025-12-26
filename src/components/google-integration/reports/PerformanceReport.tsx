import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Mail, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function PerformanceReport() {
    const handleExportPDF = () => {
        toast.success("Relatório completo exportado com sucesso! (Simulação)");
    };

    const handleSendEmail = () => {
        toast.success("Relatório enviado por e-mail! (Simulação)");
    };

    return (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                        <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <CardTitle>Relatório de Performance Completo</CardTitle>
                        <CardDescription>
                            Gere um relatório detalhado com todas as métricas do seu perfil.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground">O relatório inclui:</h4>
                        <ul className="grid grid-cols-1 gap-2">
                            <li className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" /> Análise de Saúde do Perfil
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" /> Métricas de Avaliações e Respostas
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" /> Insights de Tráfego e Interações
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" /> Performance de Postagens e Mídias
                            </li>
                        </ul>
                    </div>
                    <div className="flex flex-col justify-center gap-3">
                        <Button onClick={handleExportPDF} className="w-full">
                            <Download className="h-4 w-4 mr-2" />
                            Baixar PDF Completo
                        </Button>
                        <Button variant="outline" onClick={handleSendEmail} className="w-full">
                            <Mail className="h-4 w-4 mr-2" />
                            Enviar por E-mail
                        </Button>
                        <p className="text-xs text-center text-muted-foreground mt-2">
                            Última geração: 26/12/2025
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
