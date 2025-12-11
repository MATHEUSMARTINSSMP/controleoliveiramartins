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
import { Switch } from "@/components/ui/switch";
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
    Trash2,
    Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

// Types
interface Conditional {
    id: string;
    store_id: string;
    colaboradora_id: string | null;
    customer_name: string;
    customer_contact: string;
    customer_address: string;
    products: { description: string; price: number }[];
    date_generated: string;
    date_return: string | null;
    status: 'GERADA' | 'PREPARANDO' | 'PRONTA' | 'ROTA_ENTREGA' | 'ENTREGUE' | 'PRONTA_RETIRADA' | 'ROTA_DEVOLUCAO' | 'EM_LOJA' | 'CLIENTE_AVISADA' | 'FINALIZADA';
    notificar_cliente: boolean;
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
    status: 'AJUSTE_GERADO' | 'PRONTO_PARA_LEVAR' | 'ENTREGUE_COSTUREIRA' | 'RETIRADO_DA_COSTUREIRA' | 'AJUSTE_EM_LOJA' | 'CLIENTE_JA_AVISADA' | 'EM_ROTA_ENTREGA_CLIENTE' | 'CLIENTE_RETIROU' | 'AJUSTE_ENTREGUE';
    delivery_method: 'LOJA' | 'CASA';
    delivery_address: string | null;
    observacao: string | null;
    notificar_cliente: boolean;
    created_at: string;
}

// Cores para condicionais
const CONDITIONAL_STATUS_COLORS = {
    'GERADA': 'bg-gray-100 text-gray-800',
    'PREPARANDO': 'bg-blue-100 text-blue-800',
    'PRONTA': 'bg-purple-100 text-purple-800',
    'ROTA_ENTREGA': 'bg-yellow-100 text-yellow-800',
    'ENTREGUE': 'bg-green-100 text-green-800',
    'PRONTA_RETIRADA': 'bg-indigo-100 text-indigo-800',
    'ROTA_DEVOLUCAO': 'bg-orange-100 text-orange-800',
    'EM_LOJA': 'bg-cyan-100 text-cyan-800',
    'CLIENTE_AVISADA': 'bg-pink-100 text-pink-800',
    'FINALIZADA': 'bg-slate-100 text-slate-800',
};

// Cores para ajustes (novos status)
const ADJUSTMENT_STATUS_COLORS = {
    'AJUSTE_GERADO': 'bg-gray-100 text-gray-800',
    'PRONTO_PARA_LEVAR': 'bg-blue-100 text-blue-800',
    'ENTREGUE_COSTUREIRA': 'bg-purple-100 text-purple-800',
    'RETIRADO_DA_COSTUREIRA': 'bg-indigo-100 text-indigo-800',
    'AJUSTE_EM_LOJA': 'bg-cyan-100 text-cyan-800',
    'CLIENTE_JA_AVISADA': 'bg-pink-100 text-pink-800',
    'EM_ROTA_ENTREGA_CLIENTE': 'bg-yellow-100 text-yellow-800',
    'CLIENTE_RETIROU': 'bg-green-100 text-green-800',
    'AJUSTE_ENTREGUE': 'bg-emerald-100 text-emerald-800',
};

const CONDITIONAL_STATUS_LABELS = {
    'GERADA': 'Condicional Gerada',
    'PREPARANDO': 'Condicional Sendo Preparada',
    'PRONTA': 'Condicional Pronta',
    'ROTA_ENTREGA': 'Condicional Em Rota de Entrega',
    'ENTREGUE': 'Condicional Entregue para Cliente',
    'PRONTA_RETIRADA': 'Condicional Pronta para Retirada',
    'ROTA_DEVOLUCAO': 'Condicional Em Rota de Devolução',
    'EM_LOJA': 'Condicional em Loja',
    'CLIENTE_AVISADA': 'Cliente Avisada',
    'FINALIZADA': 'Finalizada',
};

const ADJUSTMENT_STATUS_LABELS = {
    'AJUSTE_GERADO': 'Ajuste Gerado',
    'PRONTO_PARA_LEVAR': 'Pronto para Levar',
    'ENTREGUE_COSTUREIRA': 'Entregue Costureira',
    'RETIRADO_DA_COSTUREIRA': 'Retirado da Costureira',
    'AJUSTE_EM_LOJA': 'Ajuste em Loja',
    'CLIENTE_JA_AVISADA': 'Cliente Já Avisada',
    'EM_ROTA_ENTREGA_CLIENTE': 'Em Rota de Entrega para Cliente',
    'CLIENTE_RETIROU': 'Cliente Retirou',
    'AJUSTE_ENTREGUE': 'Ajuste Entregue',
};

export const ConditionalsAdjustmentsManager = () => {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState("conditionals");
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [conditionals, setConditionals] = useState<Conditional[]>([]);
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
    const [productSearchTerm, setProductSearchTerm] = useState("");
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
    const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
    const [colaboradoras, setColaboradoras] = useState<{ id: string; name: string }[]>([]);
    
    // Estados para dialogs
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Conditional | Adjustment | null>(null);
    const [isConditional, setIsConditional] = useState(true);
    
    // Estados para formulário de condicional
    const [conditionalForm, setConditionalForm] = useState({
        colaboradora_id: '',
        customer_name: '',
        customer_contact: '',
        customer_address: '',
        products: [{ description: '', price: 0 }] as { description: string; price: number }[],
        date_generated: format(new Date(), 'yyyy-MM-dd'),
        date_return: '',
        status: 'GERADA' as Conditional['status'],
        notificar_cliente: false
    });
    
    // Estados para formulário de ajuste
    const [adjustmentForm, setAdjustmentForm] = useState({
        customer_name: '',
        customer_contact: '',
        product: '',
        adjustment_description: '',
        payment_status: 'NAO_PAGO' as Adjustment['payment_status'],
        payment_amount: 0,
        date_generated: format(new Date(), 'yyyy-MM-dd'),
        date_seamstress: '',
        date_delivery: '',
        time_delivery: '',
        status: 'AJUSTE_GERADO' as Adjustment['status'],
        delivery_method: 'LOJA' as Adjustment['delivery_method'],
        delivery_address: '',
        observacao: '',
        notificar_cliente: false
    });

    useEffect(() => {
        if (profile) {
            if (profile.role === 'ADMIN') {
                fetchStores();
            }
            fetchData();
        }
    }, [profile, activeTab]);

    useEffect(() => {
        if (selectedStoreId) {
            fetchColaboradoras();
        } else {
            setColaboradoras([]);
        }
    }, [selectedStoreId]);

    const fetchColaboradoras = async () => {
        if (!selectedStoreId) return;
        
        try {
            // Buscar colaboradoras ativas do store_id
            const { data: dataByStoreId, error: errorByStoreId } = await supabase
                .schema('sistemaretiradas')
                .from('profiles')
                .select('id, name')
                .eq('role', 'COLABORADORA')
                .eq('is_active', true) // ✅ FILTRO: apenas colaboradoras ATIVAS
                .eq('store_id', selectedStoreId)
                .order('name');
            
            if (errorByStoreId) throw errorByStoreId;
            
            // Buscar nome da loja para usar no store_default
            const { data: storeData } = await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .select('name')
                .eq('id', selectedStoreId)
                .single();
            
            const storeName = storeData?.name || null;
            
            // Buscar colaboradoras por store_default (se tiver nome da loja)
            let dataByStoreDefault: any[] = [];
            if (storeName) {
                const { data, error } = await supabase
                    .schema('sistemaretiradas')
                    .from('profiles')
                    .select('id, name')
                    .eq('role', 'COLABORADORA')
                    .eq('is_active', true) // ✅ FILTRO: apenas colaboradoras ATIVAS
                    .eq('store_default', storeName)
                    .order('name');
                
                if (!error && data) {
                    dataByStoreDefault = data;
                }
            }
            
            // Combinar resultados e remover duplicatas
            const allColaboradoras = [...(dataByStoreId || []), ...dataByStoreDefault];
            const uniqueColaboradoras = Array.from(
                new Map(allColaboradoras.map(colab => [colab.id, colab])).values()
            );
            
            // ✅ GARANTIR: filtrar novamente apenas colaboradoras ativas (segurança extra)
            const colaboradorasAtivas = uniqueColaboradoras.filter(colab => colab);
            setColaboradoras(colaboradorasAtivas);
        } catch (error) {
            console.error('Erro ao buscar colaboradoras:', error);
            setColaboradoras([]);
        }
    };

    const fetchStores = async () => {
        try {
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .select('id, name')
                .eq('admin_id', profile?.id)
                .eq('active', true)
                .order('name');
            
            if (error) throw error;
            setStores(data || []);
            if (data && data.length > 0 && !selectedStoreId) {
                setSelectedStoreId(data[0].id);
            }
        } catch (error) {
            console.error('Erro ao buscar lojas:', error);
        }
    };

    const openCreateDialog = (type: 'conditional' | 'adjustment') => {
        setIsConditional(type === 'conditional');
        setEditingItem(null);
        
        if (type === 'conditional') {
            setConditionalForm({
                colaboradora_id: '',
                customer_name: '',
                customer_contact: '',
                customer_address: '',
                products: [{ description: '', price: 0 }],
                date_generated: format(new Date(), 'yyyy-MM-dd'),
                date_return: '',
                status: 'GERADA',
                notificar_cliente: false
            });
        } else {
            setAdjustmentForm({
                customer_name: '',
                customer_contact: '',
                product: '',
                adjustment_description: '',
                payment_status: 'NAO_PAGO',
                payment_amount: 0,
                date_generated: format(new Date(), 'yyyy-MM-dd'),
                date_seamstress: '',
                date_delivery: '',
                time_delivery: '',
                status: 'AJUSTE_GERADO',
                delivery_method: 'LOJA',
                delivery_address: '',
                observacao: '',
                notificar_cliente: false
            });
        }
        
        setDialogOpen(true);
    };

    const openEditDialog = (item: Conditional | Adjustment, type: 'conditional' | 'adjustment') => {
        setIsConditional(type === 'conditional');
        setEditingItem(item);
        
        if (type === 'conditional') {
            const conditional = item as Conditional;
            setConditionalForm({
                colaboradora_id: conditional.colaboradora_id || '',
                customer_name: conditional.customer_name,
                customer_contact: conditional.customer_contact,
                customer_address: conditional.customer_address || '',
                products: conditional.products.length > 0 ? conditional.products : [{ description: '', price: 0 }],
                date_generated: conditional.date_generated,
                date_return: conditional.date_return || '',
                status: conditional.status,
                notificar_cliente: conditional.notificar_cliente || false
            });
        } else {
            const adjustment = item as Adjustment;
            setAdjustmentForm({
                customer_name: adjustment.customer_name,
                customer_contact: adjustment.customer_contact,
                product: adjustment.product,
                adjustment_description: adjustment.adjustment_description,
                payment_status: adjustment.payment_status,
                payment_amount: adjustment.payment_amount,
                date_generated: adjustment.date_generated,
                date_seamstress: adjustment.date_seamstress || '',
                date_delivery: adjustment.date_delivery || '',
                time_delivery: adjustment.time_delivery || '',
                status: adjustment.status,
                delivery_method: adjustment.delivery_method,
                delivery_address: adjustment.delivery_address || '',
                observacao: adjustment.observacao || '',
                notificar_cliente: adjustment.notificar_cliente || false
            });
        }
        
        setDialogOpen(true);
    };

    const handleSaveConditional = async () => {
        if (!conditionalForm.customer_name || !conditionalForm.customer_contact) {
            toast.error('Preencha nome e contato do cliente');
            return;
        }

        if (conditionalForm.products.length === 0 || conditionalForm.products.some(p => !p.description)) {
            toast.error('Adicione pelo menos um produto com descrição');
            return;
        }

        const storeIdToUse = profile?.role === 'LOJA' ? profile.store_id : selectedStoreId;
        if (!storeIdToUse) {
            toast.error('Selecione uma loja');
            return;
        }

        setLoading(true);
        try {
            const dataToSave = {
                store_id: storeIdToUse,
                colaboradora_id: conditionalForm.colaboradora_id || null,
                customer_name: conditionalForm.customer_name,
                customer_contact: conditionalForm.customer_contact,
                customer_address: conditionalForm.customer_address || null,
                products: conditionalForm.products.filter(p => p.description),
                date_generated: conditionalForm.date_generated,
                date_return: conditionalForm.date_return || null,
                status: conditionalForm.status,
                notificar_cliente: conditionalForm.notificar_cliente
            };

            const oldStatus = editingItem ? (editingItem as Conditional).status : null;
            const statusChanged = editingItem && oldStatus !== conditionalForm.status;

            if (editingItem) {
                const { error } = await supabase
                    .schema('sistemaretiradas')
                    .from('conditionals')
                    .update(dataToSave)
                    .eq('id', editingItem.id);

                if (error) throw error;
                toast.success('Condicional atualizada com sucesso');
            } else {
                const { error } = await supabase
                    .schema('sistemaretiradas')
                    .from('conditionals')
                    .insert(dataToSave);

                if (error) throw error;
                toast.success('Condicional criada com sucesso');
            }

            // Enviar notificações se o status mudou
            if (statusChanged || !editingItem) {
                try {
                    const statusLabel = CONDITIONAL_STATUS_LABELS[conditionalForm.status];
                    const productInfo = conditionalForm.products.map(p => p.description).join(', ');

                    // 1. Enviar mensagem ao cliente APENAS se notificar_cliente estiver ativado
                    if (conditionalForm.notificar_cliente && conditionalForm.customer_contact) {
                        try {
                            let customerMessage = '';
                            
                            if (conditionalForm.status === 'GERADA') {
                                const productsList = conditionalForm.products
                                    .map(p => `• ${p.description}${p.price > 0 ? ` - R$ ${p.price.toFixed(2)}` : ''}`)
                                    .join('\n');
                                customerMessage = `Olá ${conditionalForm.customer_name}! 👋\n\n*Nova Condicional Gerada*\n\n*Produtos:*\n${productsList}\n\n*Data de Geração:* ${format(new Date(conditionalForm.date_generated), 'dd/MM/yyyy')}`;
                                if (conditionalForm.date_return) {
                                    customerMessage += `\n*Data de Retorno:* ${format(new Date(conditionalForm.date_return), 'dd/MM/yyyy')}`;
                                }
                                if (conditionalForm.customer_address) {
                                    customerMessage += `\n*Endereço:* ${conditionalForm.customer_address}`;
                                }
                                customerMessage += `\n\nQualquer dúvida, estamos à disposição!\n\nEquipe EleveaOne 📦`;
                            } else {
                                customerMessage = `Olá ${conditionalForm.customer_name}! 👋\n\nSua condicional foi atualizada para: *${statusLabel}*\n\nProdutos: ${productInfo}\n\nQualquer dúvida, estamos à disposição!\n\nEquipe EleveaOne 📦`;
                            }

                            const phone = conditionalForm.customer_contact.replace(/\D/g, '');
                            if (phone.length >= 10) {
                                const result = await sendWhatsAppMessage({
                                    phone: phone,
                                    message: customerMessage,
                                    store_id: storeIdToUse
                                });

                                if (result.success) {
                                    console.log('✅ Mensagem enviada ao cliente');
                                }
                            }
                        } catch (customerError) {
                            console.error('Erro ao enviar mensagem ao cliente:', customerError);
                        }
                    }

                    // 2. Enviar notificação para números configurados
                    try {
                        const { data: notificationConfigs, error: configError } = await supabase
                            .schema('sistemaretiradas')
                            .from('whatsapp_notification_config')
                            .select('phone, name')
                            .eq('notification_type', 'AJUSTES_CONDICIONAIS')
                            .eq('store_id', storeIdToUse)
                            .eq('active', true);

                        if (!configError && notificationConfigs && notificationConfigs.length > 0) {
                            let adminMessage = '';
                            
                            if (conditionalForm.status === 'GERADA') {
                                const productsList = conditionalForm.products
                                    .map(p => `• ${p.description}${p.price > 0 ? ` - R$ ${p.price.toFixed(2)}` : ''}`)
                                    .join('\n');
                                adminMessage = `🔔 *Nova Condicional Gerada*\n\n` +
                                    `*Cliente:* ${conditionalForm.customer_name}\n` +
                                    `*Contato:* ${conditionalForm.customer_contact}\n` +
                                    `*Produtos:*\n${productsList}\n` +
                                    `*Data de Geração:* ${format(new Date(conditionalForm.date_generated), 'dd/MM/yyyy')}`;
                                if (conditionalForm.date_return) {
                                    adminMessage += `\n*Data de Retorno:* ${format(new Date(conditionalForm.date_return), 'dd/MM/yyyy')}`;
                                }
                                if (conditionalForm.customer_address) {
                                    adminMessage += `\n*Endereço:* ${conditionalForm.customer_address}`;
                                }
                                adminMessage += `\n\n*Status:* ${statusLabel}\n*Data/Hora:* ${format(new Date(), 'dd/MM/yyyy HH:mm')}\n\nEleveaOne 📦`;
                            } else {
                                adminMessage = `🔔 *Notificação de Condicional*\n\n` +
                                    `*Cliente:* ${conditionalForm.customer_name}\n` +
                                    `*Produtos:* ${productInfo}\n` +
                                    `*Status atualizado para:* ${statusLabel}\n` +
                                    `*Data:* ${format(new Date(), 'dd/MM/yyyy HH:mm')}\n\n` +
                                    `EleveaOne 📦`;
                            }

                            const sendPromises = notificationConfigs.map(async (config) => {
                                const normalizedPhone = config.phone.replace(/\D/g, '');
                                if (normalizedPhone.length >= 10) {
                                    return await sendWhatsAppMessage({
                                        phone: normalizedPhone,
                                        message: adminMessage,
                                        store_id: storeIdToUse
                                    });
                                }
                                return { success: false, error: 'Número inválido' };
                            });

                            await Promise.all(sendPromises);
                            console.log(`✅ Notificações enviadas para ${notificationConfigs.length} número(s) configurado(s)`);
                        }
                    } catch (notificationError) {
                        console.error('Erro ao enviar notificações configuradas:', notificationError);
                    }
                } catch (msgError) {
                    console.error('Erro ao enviar mensagens WhatsApp:', msgError);
                }
            }

            setDialogOpen(false);
            fetchData();
        } catch (error: any) {
            console.error('Erro ao salvar condicional:', error);
            toast.error(error.message || 'Erro ao salvar condicional');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAdjustment = async () => {
        if (!adjustmentForm.customer_name || !adjustmentForm.customer_contact || !adjustmentForm.product || !adjustmentForm.adjustment_description) {
            toast.error('Preencha todos os campos obrigatórios');
            return;
        }

        const storeIdToUse = profile?.role === 'LOJA' ? profile.store_id : selectedStoreId;
        if (!storeIdToUse) {
            toast.error('Selecione uma loja');
            return;
        }

        setLoading(true);
        try {
            const dataToSave = {
                store_id: storeIdToUse,
                customer_name: adjustmentForm.customer_name,
                customer_contact: adjustmentForm.customer_contact,
                product: adjustmentForm.product,
                adjustment_description: adjustmentForm.adjustment_description,
                payment_status: adjustmentForm.payment_status,
                payment_amount: adjustmentForm.payment_amount || 0,
                date_generated: adjustmentForm.date_generated,
                date_seamstress: adjustmentForm.date_seamstress || null,
                date_delivery: adjustmentForm.date_delivery || null,
                time_delivery: adjustmentForm.time_delivery || null,
                status: adjustmentForm.status,
                delivery_method: adjustmentForm.delivery_method,
                delivery_address: adjustmentForm.delivery_method === 'CASA' ? adjustmentForm.delivery_address : null,
                observacao: adjustmentForm.observacao || null,
                notificar_cliente: adjustmentForm.notificar_cliente
            };

            const oldStatus = editingItem ? (editingItem as Adjustment).status : null;
            const statusChanged = editingItem && oldStatus !== adjustmentForm.status;

            if (editingItem) {
                const { error } = await supabase
                    .schema('sistemaretiradas')
                    .from('adjustments')
                    .update(dataToSave)
                    .eq('id', editingItem.id);

                if (error) throw error;
                toast.success('Ajuste atualizado com sucesso');
            } else {
                const { error } = await supabase
                    .schema('sistemaretiradas')
                    .from('adjustments')
                    .insert(dataToSave);

                if (error) throw error;
                toast.success('Ajuste criado com sucesso');
            }

            // Enviar notificações se o status mudou
            if (statusChanged || !editingItem) {
                try {
                    const statusLabel = ADJUSTMENT_STATUS_LABELS[adjustmentForm.status];

                    // 1. Enviar mensagem ao cliente APENAS se notificar_cliente estiver ativado
                    if (adjustmentForm.notificar_cliente && adjustmentForm.customer_contact) {
                        try {
                            let customerMessage = '';
                            
                            if (adjustmentForm.status === 'AJUSTE_GERADO') {
                                const paymentStatusLabel = adjustmentForm.payment_status === 'PAGO' ? 'Pago' : 
                                                          adjustmentForm.payment_status === 'PARCIAL' ? 'Parcial' : 'Não Pago';
                                const deliveryMethodLabel = adjustmentForm.delivery_method === 'CASA' ? 'Casa do Cliente' : 'Na Loja';
                                customerMessage = `Olá ${adjustmentForm.customer_name}! 👋\n\n*Novo Ajuste Gerado*\n\n*Produto:* ${adjustmentForm.product}\n*Descrição do Ajuste:* ${adjustmentForm.adjustment_description}\n*Status Pagamento:* ${paymentStatusLabel}`;
                                if (adjustmentForm.payment_amount > 0) {
                                    customerMessage += ` - R$ ${adjustmentForm.payment_amount.toFixed(2)}`;
                                }
                                customerMessage += `\n*Data de Geração:* ${format(new Date(adjustmentForm.date_generated), 'dd/MM/yyyy')}`;
                                if (adjustmentForm.date_seamstress) {
                                    customerMessage += `\n*Data com Costureira:* ${format(new Date(adjustmentForm.date_seamstress), 'dd/MM/yyyy')}`;
                                }
                                if (adjustmentForm.date_delivery) {
                                    const timeStr = adjustmentForm.time_delivery ? ` às ${adjustmentForm.time_delivery.substring(0, 5)}` : '';
                                    customerMessage += `\n*Data de Entrega:* ${format(new Date(adjustmentForm.date_delivery), 'dd/MM/yyyy')}${timeStr}`;
                                }
                                customerMessage += `\n*Método de Entrega:* ${deliveryMethodLabel}`;
                                if (adjustmentForm.delivery_method === 'CASA' && adjustmentForm.delivery_address) {
                                    customerMessage += `\n*Endereço:* ${adjustmentForm.delivery_address}`;
                                }
                                if (adjustmentForm.observacao) {
                                    customerMessage += `\n*Observação:* ${adjustmentForm.observacao}`;
                                }
                                customerMessage += `\n\nQualquer dúvida, estamos à disposição!\n\nEquipe EleveaOne ✂️`;
                            } else {
                                customerMessage = `Olá ${adjustmentForm.customer_name}! 👋\n\nSeu ajuste foi atualizado para: *${statusLabel}*\n\nProduto: ${adjustmentForm.product}\n\nQualquer dúvida, estamos à disposição!\n\nEquipe EleveaOne ✂️`;
                            }

                            const phone = adjustmentForm.customer_contact.replace(/\D/g, '');
                            if (phone.length >= 10) {
                                const result = await sendWhatsAppMessage({
                                    phone: phone,
                                    message: customerMessage,
                                    store_id: storeIdToUse
                                });

                                if (result.success) {
                                    console.log('✅ Mensagem enviada ao cliente');
                                }
                            }
                        } catch (customerError) {
                            console.error('Erro ao enviar mensagem ao cliente:', customerError);
                        }
                    }

                    // 2. Enviar notificação para números configurados
                    try {
                        const { data: notificationConfigs, error: configError } = await supabase
                            .schema('sistemaretiradas')
                            .from('whatsapp_notification_config')
                            .select('phone, name')
                            .eq('notification_type', 'AJUSTES_CONDICIONAIS')
                            .eq('store_id', storeIdToUse)
                            .eq('active', true);

                        if (!configError && notificationConfigs && notificationConfigs.length > 0) {
                            let adminMessage = '';
                            
                            if (adjustmentForm.status === 'AJUSTE_GERADO') {
                                const paymentStatusLabel = adjustmentForm.payment_status === 'PAGO' ? 'Pago' : 
                                                          adjustmentForm.payment_status === 'PARCIAL' ? 'Parcial' : 'Não Pago';
                                const deliveryMethodLabel = adjustmentForm.delivery_method === 'CASA' ? 'Casa do Cliente' : 'Na Loja';
                                
                                adminMessage = `🔔 *Novo Ajuste Gerado*\n\n` +
                                    `*Cliente:* ${adjustmentForm.customer_name}\n` +
                                    `*Contato:* ${adjustmentForm.customer_contact}\n` +
                                    `*Produto:* ${adjustmentForm.product}\n` +
                                    `*Descrição do Ajuste:* ${adjustmentForm.adjustment_description}\n` +
                                    `*Status Pagamento:* ${paymentStatusLabel}`;
                                
                                if (adjustmentForm.payment_amount > 0) {
                                    adminMessage += ` - R$ ${adjustmentForm.payment_amount.toFixed(2)}`;
                                }
                                
                                adminMessage += `\n*Data Geração:* ${format(new Date(adjustmentForm.date_generated), 'dd/MM/yyyy')}`;
                                
                                if (adjustmentForm.date_seamstress) {
                                    adminMessage += `\n*Data Costureira:* ${format(new Date(adjustmentForm.date_seamstress), 'dd/MM/yyyy')}`;
                                }
                                
                                if (adjustmentForm.date_delivery) {
                                    const timeStr = adjustmentForm.time_delivery ? ` às ${adjustmentForm.time_delivery.substring(0, 5)}` : '';
                                    adminMessage += `\n*Data Entrega:* ${format(new Date(adjustmentForm.date_delivery), 'dd/MM/yyyy')}${timeStr}`;
                                }
                                
                                adminMessage += `\n*Método de Entrega:* ${deliveryMethodLabel}`;
                                
                                if (adjustmentForm.delivery_method === 'CASA' && adjustmentForm.delivery_address) {
                                    adminMessage += `\n*Endereço:* ${adjustmentForm.delivery_address}`;
                                }
                                
                                if (adjustmentForm.observacao) {
                                    adminMessage += `\n*Observação:* ${adjustmentForm.observacao}`;
                                }
                                
                                adminMessage += `\n\n*Status:* ${statusLabel}\n*Data/Hora:* ${format(new Date(), 'dd/MM/yyyy HH:mm')}\n\nEleveaOne ✂️`;
                            } else {
                                adminMessage = `🔔 *Notificação de Ajuste*\n\n` +
                                    `*Cliente:* ${adjustmentForm.customer_name}\n` +
                                    `*Produto:* ${adjustmentForm.product}\n` +
                                    `*Status atualizado para:* ${statusLabel}\n` +
                                    `*Data:* ${format(new Date(), 'dd/MM/yyyy HH:mm')}\n\n` +
                                    `EleveaOne ✂️`;
                            }

                            const sendPromises = notificationConfigs.map(async (config) => {
                                const normalizedPhone = config.phone.replace(/\D/g, '');
                                if (normalizedPhone.length >= 10) {
                                    return await sendWhatsAppMessage({
                                        phone: normalizedPhone,
                                        message: adminMessage,
                                        store_id: storeIdToUse
                                    });
                                }
                                return { success: false, error: 'Número inválido' };
                            });

                            await Promise.all(sendPromises);
                            console.log(`✅ Notificações enviadas para ${notificationConfigs.length} número(s) configurado(s)`);
                        }
                    } catch (notificationError) {
                        console.error('Erro ao enviar notificações configuradas:', notificationError);
                    }
                } catch (msgError) {
                    console.error('Erro ao enviar mensagens WhatsApp:', msgError);
                }
            }

            setDialogOpen(false);
            fetchData();
        } catch (error: any) {
            console.error('Erro ao salvar ajuste:', error);
            toast.error(error.message || 'Erro ao salvar ajuste');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, type: 'conditional' | 'adjustment') => {
        if (!confirm('Tem certeza que deseja excluir este registro?')) return;

        setLoading(true);
        try {
            const table = type === 'conditional' ? 'conditionals' : 'adjustments';
            const { error } = await supabase
                .schema('sistemaretiradas')
                .from(table)
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Registro excluído com sucesso');
            fetchData();
        } catch (error: any) {
            console.error('Erro ao excluir:', error);
            toast.error(error.message || 'Erro ao excluir registro');
        } finally {
            setLoading(false);
        }
    };

    const searchProducts = async () => {
        if (!selectedStoreId && profile?.role === 'ADMIN') {
            toast.error('Selecione uma loja para buscar');
            return;
        }

        const storeIdToSearch = profile?.role === 'LOJA' ? profile.store_id : selectedStoreId;
        if (!storeIdToSearch) {
            toast.error('Loja não identificada');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .rpc('search_products_out_of_store', {
                    p_store_id: storeIdToSearch,
                    p_search_term: productSearchTerm || null
                });

            if (error) throw error;
            setProductSearchResults(data || []);
        } catch (error) {
            console.error('Erro ao buscar produtos:', error);
            toast.error('Erro ao buscar produtos');
        } finally {
            setLoading(false);
        }
    };

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
                    {profile?.role === 'ADMIN' && stores.length > 0 && (
                        <Select value={selectedStoreId || ''} onValueChange={setSelectedStoreId}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Selecione a loja" />
                            </SelectTrigger>
                            <SelectContent>
                                {stores.map(store => (
                                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button onClick={() => openCreateDialog(activeTab === "conditionals" ? "conditional" : "adjustment")}>
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
                    <TabsTrigger value="search-products" className="flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        Buscar Produtos
                    </TabsTrigger>
                </TabsList>

                {activeTab !== 'search-products' && (
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
                )}

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
                                                    <Badge variant="secondary" className={CONDITIONAL_STATUS_COLORS[item.status]}>
                                                        {CONDITIONAL_STATUS_LABELS[item.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-muted-foreground">
                                                        {item.products.length} itens
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(item, 'conditional')}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id, 'conditional')}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
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
                                                    <Badge variant="secondary" className={ADJUSTMENT_STATUS_COLORS[item.status]}>
                                                        {ADJUSTMENT_STATUS_LABELS[item.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={item.payment_status === 'PAGO' ? 'default' : 'outline'}>
                                                        {item.payment_status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(item, 'adjustment')}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id, 'adjustment')}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="search-products" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Buscar Produtos Fora da Loja</CardTitle>
                            <CardDescription>
                                Busque produtos que estão em condicionais ou ajustes. Use busca aproximada (ex: digite "SALAMANCO" para encontrar "BLUSA ESTAMPADA SALAMANCO").
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {profile?.role === 'ADMIN' && (
                                <div className="space-y-2">
                                    <Label>Loja</Label>
                                    <Select value={selectedStoreId || ''} onValueChange={setSelectedStoreId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione uma loja" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {stores.map(store => (
                                                <SelectItem key={store.id} value={store.id}>
                                                    {store.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Digite o nome do produto (ex: SALAMANCO)..."
                                        value={productSearchTerm}
                                        onChange={(e) => setProductSearchTerm(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                searchProducts();
                                            }
                                        }}
                                        className="pl-8"
                                    />
                                </div>
                                <Button onClick={searchProducts} disabled={loading}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Buscando...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="mr-2 h-4 w-4" />
                                            Buscar
                                        </>
                                    )}
                                </Button>
                            </div>

                            {productSearchResults.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">
                                        {productSearchResults.length} produto(s) encontrado(s) fora da loja
                                    </p>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Tipo</TableHead>
                                                <TableHead>Produto</TableHead>
                                                <TableHead>Cliente</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Data</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {productSearchResults.map((item, index) => (
                                                <TableRow key={`${item.tipo}-${item.id}-${index}`}>
                                                    <TableCell>
                                                        <Badge variant={item.tipo === 'CONDICIONAL' ? 'default' : 'secondary'}>
                                                            {item.tipo}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-medium">{item.produto}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span>{item.cliente_nome}</span>
                                                            <span className="text-xs text-muted-foreground">{item.cliente_contato}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className={item.tipo === 'CONDICIONAL' 
                                                            ? CONDITIONAL_STATUS_COLORS[item.status as keyof typeof CONDITIONAL_STATUS_COLORS] || 'bg-gray-100 text-gray-800'
                                                            : ADJUSTMENT_STATUS_COLORS[item.status as keyof typeof ADJUSTMENT_STATUS_COLORS] || 'bg-gray-100 text-gray-800'
                                                        }>
                                                            {item.tipo === 'CONDICIONAL' ? CONDITIONAL_STATUS_LABELS[item.status as keyof typeof CONDITIONAL_STATUS_LABELS] : ADJUSTMENT_STATUS_LABELS[item.status as keyof typeof ADJUSTMENT_STATUS_LABELS]}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {format(new Date(item.data_geracao), 'dd/MM/yyyy')}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {productSearchTerm && productSearchResults.length === 0 && !loading && (
                                <div className="text-center py-8 text-muted-foreground">
                                    Nenhum produto encontrado com o termo "{productSearchTerm}"
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialog de Condicional */}
            <Dialog open={dialogOpen && isConditional} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingItem ? 'Editar Condicional' : 'Nova Condicional'}
                        </DialogTitle>
                        <DialogDescription>
                            Preencha os dados da condicional
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="colaboradora_id">Colaboradora Responsável *</Label>
                            <Select
                                value={conditionalForm.colaboradora_id}
                                onValueChange={(value) => setConditionalForm({ ...conditionalForm, colaboradora_id: value })}
                                disabled={!selectedStoreId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={selectedStoreId ? "Selecione a colaboradora" : "Selecione uma loja primeiro"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {colaboradoras.map((colab) => (
                                        <SelectItem key={colab.id} value={colab.id}>
                                            {colab.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="customer_name">Nome do Cliente *</Label>
                                <Input
                                    id="customer_name"
                                    value={conditionalForm.customer_name}
                                    onChange={(e) => setConditionalForm({ ...conditionalForm, customer_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="customer_contact">Contato *</Label>
                                <Input
                                    id="customer_contact"
                                    value={conditionalForm.customer_contact}
                                    onChange={(e) => setConditionalForm({ ...conditionalForm, customer_contact: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="customer_address">Endereço</Label>
                            <Textarea
                                id="customer_address"
                                value={conditionalForm.customer_address}
                                onChange={(e) => setConditionalForm({ ...conditionalForm, customer_address: e.target.value })}
                                rows={2}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Produtos *</Label>
                            {conditionalForm.products.map((product, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        placeholder="Descrição do produto"
                                        value={product.description}
                                        onChange={(e) => {
                                            const newProducts = [...conditionalForm.products];
                                            newProducts[index].description = e.target.value;
                                            setConditionalForm({ ...conditionalForm, products: newProducts });
                                        }}
                                    />
                                    <Input
                                        type="number"
                                        placeholder="Preço"
                                        value={product.price}
                                        onChange={(e) => {
                                            const newProducts = [...conditionalForm.products];
                                            newProducts[index].price = parseFloat(e.target.value) || 0;
                                            setConditionalForm({ ...conditionalForm, products: newProducts });
                                        }}
                                        className="w-32"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            const newProducts = conditionalForm.products.filter((_, i) => i !== index);
                                            setConditionalForm({ ...conditionalForm, products: newProducts.length > 0 ? newProducts : [{ description: '', price: 0 }] });
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConditionalForm({ ...conditionalForm, products: [...conditionalForm.products, { description: '', price: 0 }] })}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Adicionar Produto
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="date_generated">Data de Geração *</Label>
                                <Input
                                    id="date_generated"
                                    type="date"
                                    value={conditionalForm.date_generated}
                                    onChange={(e) => setConditionalForm({ ...conditionalForm, date_generated: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date_return">Data de Retorno</Label>
                                <Input
                                    id="date_return"
                                    type="date"
                                    value={conditionalForm.date_return}
                                    onChange={(e) => setConditionalForm({ ...conditionalForm, date_return: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                                value={conditionalForm.status}
                                onValueChange={(value) => setConditionalForm({ ...conditionalForm, status: value as Conditional['status'] })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(CONDITIONAL_STATUS_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="space-y-0.5">
                                <Label htmlFor="notificar_cliente_conditional_admin">Notificar Cliente</Label>
                                <p className="text-xs text-muted-foreground">
                                    Enviar notificações WhatsApp ao cliente sobre mudanças de status desta condicional
                                </p>
                            </div>
                            <Switch
                                id="notificar_cliente_conditional_admin"
                                checked={conditionalForm.notificar_cliente}
                                onCheckedChange={(checked) => setConditionalForm({ ...conditionalForm, notificar_cliente: checked })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveConditional} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingItem ? 'Atualizar' : 'Criar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de Ajuste */}
            <Dialog open={dialogOpen && !isConditional} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingItem ? 'Editar Ajuste' : 'Novo Ajuste'}
                        </DialogTitle>
                        <DialogDescription>
                            Preencha os dados do ajuste
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="adj_customer_name">Nome do Cliente *</Label>
                                <Input
                                    id="adj_customer_name"
                                    value={adjustmentForm.customer_name}
                                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, customer_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="adj_customer_contact">Contato *</Label>
                                <Input
                                    id="adj_customer_contact"
                                    value={adjustmentForm.customer_contact}
                                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, customer_contact: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="adj_product">Produto *</Label>
                            <Input
                                id="adj_product"
                                value={adjustmentForm.product}
                                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, product: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="adj_adjustment_description">Descrição do Ajuste *</Label>
                            <Textarea
                                id="adj_adjustment_description"
                                value={adjustmentForm.adjustment_description}
                                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustment_description: e.target.value })}
                                rows={3}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="adj_payment_status">Status Pagamento</Label>
                                <Select
                                    value={adjustmentForm.payment_status}
                                    onValueChange={(value) => setAdjustmentForm({ ...adjustmentForm, payment_status: value as Adjustment['payment_status'] })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NAO_PAGO">Não Pago</SelectItem>
                                        <SelectItem value="PAGO">Pago</SelectItem>
                                        <SelectItem value="PARCIAL">Parcial</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="adj_payment_amount">Valor Pago</Label>
                                <Input
                                    id="adj_payment_amount"
                                    type="number"
                                    step="0.01"
                                    value={adjustmentForm.payment_amount}
                                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, payment_amount: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="adj_status">Status</Label>
                                <Select
                                    value={adjustmentForm.status}
                                    onValueChange={(value) => setAdjustmentForm({ ...adjustmentForm, status: value as Adjustment['status'] })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(ADJUSTMENT_STATUS_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="adj_date_generated">Data de Geração *</Label>
                                <Input
                                    id="adj_date_generated"
                                    type="date"
                                    value={adjustmentForm.date_generated}
                                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, date_generated: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="adj_date_seamstress">Data com Costureira</Label>
                                <Input
                                    id="adj_date_seamstress"
                                    type="date"
                                    value={adjustmentForm.date_seamstress}
                                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, date_seamstress: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="adj_date_delivery">Data de Entrega</Label>
                                <Input
                                    id="adj_date_delivery"
                                    type="date"
                                    value={adjustmentForm.date_delivery}
                                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, date_delivery: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="adj_time_delivery">Hora de Entrega</Label>
                                <Input
                                    id="adj_time_delivery"
                                    type="time"
                                    value={adjustmentForm.time_delivery}
                                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, time_delivery: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="adj_delivery_method">Método de Entrega</Label>
                            <Select
                                value={adjustmentForm.delivery_method}
                                onValueChange={(value) => setAdjustmentForm({ ...adjustmentForm, delivery_method: value as Adjustment['delivery_method'] })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LOJA">Na Loja</SelectItem>
                                    <SelectItem value="CASA">Em Casa</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {adjustmentForm.delivery_method === 'CASA' && (
                            <div className="space-y-2">
                                <Label htmlFor="adj_delivery_address">Endereço de Entrega *</Label>
                                <Textarea
                                    id="adj_delivery_address"
                                    value={adjustmentForm.delivery_address}
                                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, delivery_address: e.target.value })}
                                    rows={2}
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="adj_observacao">Observação</Label>
                            <Textarea
                                id="adj_observacao"
                                value={adjustmentForm.observacao}
                                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, observacao: e.target.value })}
                                rows={3}
                                placeholder="Observações, notas ou informações adicionais sobre o ajuste..."
                            />
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="space-y-0.5">
                                <Label htmlFor="notificar_cliente_adjustment_admin">Notificar Cliente</Label>
                                <p className="text-xs text-muted-foreground">
                                    Enviar notificações WhatsApp ao cliente sobre mudanças de status deste ajuste
                                </p>
                            </div>
                            <Switch
                                id="notificar_cliente_adjustment_admin"
                                checked={adjustmentForm.notificar_cliente}
                                onCheckedChange={(checked) => setAdjustmentForm({ ...adjustmentForm, notificar_cliente: checked })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveAdjustment} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingItem ? 'Atualizar' : 'Criar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ConditionalsAdjustmentsManager;
