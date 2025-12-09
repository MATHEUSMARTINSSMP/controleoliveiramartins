import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
    Search,
    Plus,
    Filter,
    FileText,
    Scissors,
    Calendar,
    MapPin,
    CheckCircle,
    XCircle,
    Clock,
    Truck,
    Package,
    Edit,
    Trash2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Types
interface Conditional {
    id: string;
    store_id: string;
    customer_name: string;
    customer_contact: string;
    customer_address: string;
    products: { description: string; price: number }[];
    date_generated: string;
    date_return: string | null;
    status: 'GERADA' | 'PREPARANDO' | 'PRONTA' | 'ROTA_ENTREGA' | 'ENTREGUE' | 'PRONTA_RETIRADA' | 'ROTA_DEVOLUCAO' | 'FINALIZADA';
    created_at: string;
}

interface Adjustment {
    id: string;
    store_id: string;
    customer_name: string;
    customer_contact: string;
    product: string;
    adjustment_description: string;
    payment_status: 'PAGO' | 'NAO_PAGO' | 'PARCIAL';
    payment_amount: number;
    date_generated: string;
    date_seamstress: string | null;
    date_delivery: string | null;
    time_delivery: string | null;
    status: 'GERADA' | 'PREPARANDO' | 'PRONTA' | 'ROTA_ENTREGA' | 'ENTREGUE' | 'PRONTA_RETIRADA' | 'ROTA_DEVOLUCAO' | 'FINALIZADA';
    delivery_method: 'LOJA' | 'CASA';
    delivery_address: string | null;
    created_at: string;
}

const STATUS_COLORS = {
    'GERADA': 'bg-gray-100 text-gray-800',
    'PREPARANDO': 'bg-blue-100 text-blue-800',
    'PRONTA': 'bg-purple-100 text-purple-800',
    'ROTA_ENTREGA': 'bg-yellow-100 text-yellow-800',
    'ENTREGUE': 'bg-green-100 text-green-800',
    'PRONTA_RETIRADA': 'bg-indigo-100 text-indigo-800',
    'ROTA_DEVOLUCAO': 'bg-orange-100 text-orange-800',
    'FINALIZADA': 'bg-slate-100 text-slate-800',
};

const STATUS_LABELS = {
    'GERADA': 'Gerada',
    'PREPARANDO': 'Preparando',
    'PRONTA': 'Pronta',
    'ROTA_ENTREGA': 'Em Rota de Entrega',
    'ENTREGUE': 'Entregue ao Cliente',
    'PRONTA_RETIRADA': 'Pronta para Retirada',
    'ROTA_DEVOLUCAO': 'Em Rota de Devolução',
    'FINALIZADA': 'Finalizada',
};

export const ConditionalsAdjustmentsManager = () => {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState("conditionals");
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [conditionals, setConditionals] = useState<Conditional[]>([]);
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);

    useEffect(() => {
        if (profile) {
            fetchData();
        }
    }, [profile, activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === "conditionals") {
                const { data, error } = await supabase
                    .schema('sistemaretiradas')
                    .from('conditionals')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setConditionals(data || []);
            } else {
                const { data, error } = await supabase
                    .schema('sistemaretiradas')
                    .from('adjustments')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setAdjustments(data || []);
            }
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
            toast.error('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Ajustes & Condicionais</h2>
                    <p className="text-muted-foreground">
                        Gerencie condicionais e ajustes de peças para clientes.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Nova {activeTab === "conditionals" ? "Condicional" : "Solicitação de Ajuste"}
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="conditionals" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="conditionals" className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Condicionais
                    </TabsTrigger>
                    <TabsTrigger value="adjustments" className="flex items-center gap-2">
                        <Scissors className="h-4 w-4" />
                        Ajustes
                    </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por cliente, produto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>

                <TabsContent value="conditionals" className="space-y-4">
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Produtos</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {conditionals.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                Nenhuma condicional encontrada
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        conditionals.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>{format(new Date(item.date_generated), 'dd/MM/yyyy')}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{item.customer_name}</span>
                                                        <span className="text-xs text-muted-foreground">{item.customer_contact}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className={STATUS_COLORS[item.status]}>
                                                        {STATUS_LABELS[item.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-muted-foreground">
                                                        {item.products.length} itens
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="adjustments" className="space-y-4">
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Produto</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Pagamento</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {adjustments.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                Nenhum ajuste encontrado
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        adjustments.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>{format(new Date(item.date_generated), 'dd/MM/yyyy')}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{item.customer_name}</span>
                                                        <span className="text-xs text-muted-foreground">{item.customer_contact}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{item.product}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className={STATUS_COLORS[item.status]}>
                                                        {STATUS_LABELS[item.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={item.payment_status === 'PAGO' ? 'default' : 'outline'}>
                                                        {item.payment_status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default ConditionalsAdjustmentsManager;
