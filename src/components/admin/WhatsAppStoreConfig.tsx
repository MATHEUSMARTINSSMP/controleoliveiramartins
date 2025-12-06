import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Phone, Loader2, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { WhatsAppAuth } from "./WhatsAppAuth";

interface Store {
    id: string;
    name: string;
    site_slug: string | null;
    whatsapp_connection_status: string | null;
    whatsapp_connected_at: string | null;
}

interface AdminPlan {
    plan_name: string | null;
    can_use_own_whatsapp: boolean;
}

export const WhatsAppStoreConfig = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stores, setStores] = useState<Store[]>([]);
    const [adminPlan, setAdminPlan] = useState<AdminPlan>({ plan_name: null, can_use_own_whatsapp: false });

    useEffect(() => {
        if (profile && profile.role === 'ADMIN') {
            fetchAdminPlan();
            fetchStores();
        }
    }, [profile]);

    const fetchAdminPlan = async () => {
        if (!profile) return;

        try {
            console.log('[WhatsAppStoreConfig] 🔍 Buscando plano para admin:', profile.id);
            
            const { data: allSubscriptions, error: allSubError } = await supabase
                .schema('sistemaretiradas')
                .from('admin_subscriptions')
                .select('plan_id, status')
                .eq('admin_id', profile.id)
                .maybeSingle();

            if (allSubError || !allSubscriptions || !allSubscriptions.plan_id) {
                setAdminPlan({
                    plan_name: 'Starter',
                    can_use_own_whatsapp: false,
                });
                return;
            }

            const { data: planData, error: planError } = await supabase
                .schema('sistemaretiradas')
                .from('subscription_plans')
                .select('name, display_name, is_active')
                .eq('id', allSubscriptions.plan_id)
                .maybeSingle();

            if (planError || !planData || !planData.is_active) {
                setAdminPlan({
                    plan_name: 'Starter',
                    can_use_own_whatsapp: false,
                });
                return;
            }

            const planName = (planData.name || '').toUpperCase().trim();
            const canUseOwnWhatsApp = planName === 'BUSINESS' || planName === 'ENTERPRISE';

            setAdminPlan({
                plan_name: planData.display_name || planData.name || 'Starter',
                can_use_own_whatsapp: canUseOwnWhatsApp,
            });
        } catch (error: any) {
            console.error('[WhatsAppStoreConfig] ❌ Erro ao buscar plano do admin:', error);
            setAdminPlan({
                plan_name: 'Starter',
                can_use_own_whatsapp: false,
            });
        }
    };

    const fetchStores = async () => {
        if (!profile) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .select('id, name, site_slug, whatsapp_connection_status, whatsapp_connected_at')
                .eq('admin_id', profile.id)
                .eq('active', true)
                .order('name', { ascending: true });

            if (error) throw error;
            setStores(data || []);
        } catch (error: any) {
            console.error('Erro ao buscar lojas:', error);
            toast.error('Erro ao carregar lojas');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (store: Store) => {
        switch (store.whatsapp_connection_status) {
            case 'connected':
                return (
                    <Badge className="bg-green-500 hover:bg-green-600">
                        Conectado
                    </Badge>
                );
            case 'connecting':
                return (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        Conectando...
                    </Badge>
                );
            case 'error':
                return (
                    <Badge variant="destructive">
                        Erro
                    </Badge>
                );
            default:
                return (
                    <Badge variant="secondary">
                        Não Configurado
                    </Badge>
                );
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <p className="text-muted-foreground">Carregando configurações...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Phone className="h-6 w-6" />
                    WhatsApp por Loja
                    {adminPlan.plan_name && (
                        <Badge variant="outline" className="ml-2">
                            Plano {adminPlan.plan_name}
                        </Badge>
                    )}
                </h2>
                <p className="text-muted-foreground mt-1">
                    Configure o WhatsApp para cada loja através do QR Code. Configurações técnicas estão disponíveis no painel dev.
                </p>
            </div>

            {/* Alerta para planos que não permitem WhatsApp próprio */}
            {!adminPlan.can_use_own_whatsapp && (
                <Alert className="border-yellow-500/50 bg-yellow-500/10">
                    <Lock className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-yellow-700 dark:text-yellow-400">
                        Recurso disponível nos planos Business e Enterprise
                    </AlertTitle>
                    <AlertDescription className="text-yellow-600 dark:text-yellow-300">
                        <p className="mb-3">
                            O WhatsApp personalizado por loja está disponível a partir do plano <strong>Business</strong>.
                            No plano atual, suas mensagens são enviadas pelo WhatsApp global da Elevea.
                        </p>
                        <Button
                            size="sm"
                            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                            onClick={() => window.open('/landing#pricing', '_blank')}
                        >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Fazer Upgrade
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {stores.length === 0 ? (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">
                            Nenhuma loja encontrada.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                stores.map((store) => (
                    <Card key={store.id}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {store.name}
                                {getStatusBadge(store)}
                            </CardTitle>
                            <CardDescription>
                                {store.whatsapp_connected_at && (
                                    <>Última conexão: {new Date(store.whatsapp_connected_at).toLocaleString('pt-BR')}</>
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <WhatsAppAuth
                                storeId={store.id}
                                storeName={store.name}
                                customerId={profile?.email || ''}
                                siteSlug={store.site_slug || store.name.toLowerCase().replace(/\s+/g, '-')}
                                onAuthSuccess={() => {
                                    fetchStores();
                                }}
                            />
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
    );
};
