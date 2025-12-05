import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Phone, Wifi, WifiOff, TestTube, Loader2, Lock, Sparkles, QrCode, Key } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { WhatsAppAuth } from "./WhatsAppAuth";

interface Store {
    id: string;
    name: string;
    uazapi_token: string | null;
    uazapi_instance_id: string | null;
    whatsapp_ativo: boolean;
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
    const [saving, setSaving] = useState<string | null>(null);
    const [testing, setTesting] = useState<string | null>(null);
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
            
            // Buscar assinatura do admin
            const { data: subscriptionData, error: subscriptionError } = await supabase
                .schema('sistemaretiradas')
                .from('admin_subscriptions')
                .select('plan_id, status')
                .eq('admin_id', profile.id)
                .eq('status', 'ACTIVE')
                .maybeSingle();

            console.log('[WhatsAppStoreConfig] 📊 Assinatura encontrada:', subscriptionData);
            console.log('[WhatsAppStoreConfig] ❌ Erro na query:', subscriptionError);

            if (subscriptionError) {
                console.error('[WhatsAppStoreConfig] Erro ao buscar assinatura:', subscriptionError);
                
                // Fallback: tentar sem JOIN
                const { data: fallbackSub, error: fallbackError } = await supabase
                    .schema('sistemaretiradas')
                    .from('admin_subscriptions')
                    .select('plan_id, status')
                    .eq('admin_id', profile.id)
                    .maybeSingle();

                if (fallbackError || !fallbackSub?.plan_id) {
                    console.warn('[WhatsAppStoreConfig] ⚠️ Nenhuma assinatura encontrada, usando Starter');
                    setAdminPlan({
                        plan_name: 'Starter',
                        can_use_own_whatsapp: false,
                    });
                    return;
                }

                // Buscar plano separadamente
                const { data: planData, error: planError } = await supabase
                    .schema('sistemaretiradas')
                    .from('subscription_plans')
                    .select('name, display_name, is_active')
                    .eq('id', fallbackSub.plan_id)
                    .maybeSingle();

                if (planError || !planData || !planData.is_active) {
                    console.warn('[WhatsAppStoreConfig] ⚠️ Plano não encontrado ou inativo');
                    setAdminPlan({
                        plan_name: 'Starter',
                        can_use_own_whatsapp: false,
                    });
                    return;
                }

                const planName = (planData.name || '').toUpperCase();
                const canUseOwnWhatsApp = planName === 'BUSINESS' || planName === 'ENTERPRISE';
                
                console.log('[WhatsAppStoreConfig] ✅ Plano encontrado (fallback):', planName, 'canUseOwnWhatsApp:', canUseOwnWhatsApp);

                setAdminPlan({
                    plan_name: planData.display_name || planData.name || 'Starter',
                    can_use_own_whatsapp: canUseOwnWhatsApp,
                });
                return;
            }

            if (!subscriptionData) {
                console.warn('[WhatsAppStoreConfig] ⚠️ Nenhuma assinatura ativa encontrada');
                setAdminPlan({
                    plan_name: 'Starter',
                    can_use_own_whatsapp: false,
                });
                return;
            }

            // Extrair dados do plano do JOIN
            const plan = (subscriptionData as any).subscription_plans;
            
            if (!plan || !plan.is_active) {
                console.warn('[WhatsAppStoreConfig] ⚠️ Plano não encontrado ou inativo no JOIN');
                setAdminPlan({
                    plan_name: 'Starter',
                    can_use_own_whatsapp: false,
                });
                return;
            }

            const planName = (plan.name || '').toUpperCase();
            const canUseOwnWhatsApp = planName === 'BUSINESS' || planName === 'ENTERPRISE';
            
            console.log('[WhatsAppStoreConfig] ✅ Plano encontrado:', planName);
            console.log('[WhatsAppStoreConfig] ✅ Pode usar WhatsApp próprio:', canUseOwnWhatsApp);

            setAdminPlan({
                plan_name: plan.display_name || plan.name || 'Starter',
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
                .select('id, name, uazapi_token, uazapi_instance_id, whatsapp_ativo, whatsapp_connection_status, whatsapp_connected_at')
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

    const updateStore = (storeId: string, field: keyof Store, value: any) => {
        setStores(prev => prev.map(store =>
            store.id === storeId ? { ...store, [field]: value } : store
        ));
    };

    const handleSave = async (store: Store) => {
        setSaving(store.id);
        try {
            const { error } = await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .update({
                    uazapi_token: store.uazapi_token || null,
                    uazapi_instance_id: store.uazapi_instance_id || null,
                    whatsapp_ativo: store.whatsapp_ativo,
                    whatsapp_connection_status: store.uazapi_token ? 'configured' : 'disconnected',
                })
                .eq('id', store.id);

            if (error) throw error;

            toast.success(`Configurações da loja ${store.name} salvas!`);
            await fetchStores();
        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            toast.error('Erro ao salvar configurações: ' + error.message);
        } finally {
            setSaving(null);
        }
    };

    const handleTest = async (store: Store) => {
        if (!store.uazapi_token) {
            toast.error('Configure o token UazAPI primeiro');
            return;
        }

        setTesting(store.id);
        try {
            // Enviar mensagem de teste
            const response = await fetch('/.netlify/functions/send-whatsapp-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: '5500000000000', // Número de teste
                    message: `🧪 Teste de conexão WhatsApp\n\nLoja: ${store.name}\nHorário: ${new Date().toLocaleString('pt-BR')}`,
                    store_id: store.id,
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Conexão testada com sucesso!');

                // Atualizar status da conexão
                await supabase
                    .schema('sistemaretiradas')
                    .from('stores')
                    .update({
                        whatsapp_connection_status: 'connected',
                        whatsapp_connected_at: new Date().toISOString(),
                    })
                    .eq('id', store.id);

                await fetchStores();
            } else {
                throw new Error(data.error || 'Erro desconhecido');
            }
        } catch (error: any) {
            console.error('Erro no teste:', error);
            toast.error('Erro ao testar: ' + error.message);

            // Atualizar status para erro
            await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .update({ whatsapp_connection_status: 'error' })
                .eq('id', store.id);

            await fetchStores();
        } finally {
            setTesting(null);
        }
    };

    const getStatusBadge = (store: Store) => {
        if (!store.whatsapp_ativo) {
            return <Badge variant="secondary">Desativado</Badge>;
        }

        switch (store.whatsapp_connection_status) {
            case 'connected':
                return (
                    <Badge className="bg-green-500 hover:bg-green-600">
                        <Wifi className="h-3 w-3 mr-1" />
                        Conectado
                    </Badge>
                );
            case 'configured':
                return (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        Configurado
                    </Badge>
                );
            case 'error':
                return (
                    <Badge variant="destructive">
                        <WifiOff className="h-3 w-3 mr-1" />
                        Erro
                    </Badge>
                );
            default:
                return (
                    <Badge variant="secondary">
                        <WifiOff className="h-3 w-3 mr-1" />
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
                    Configuração WhatsApp por Loja
                    {adminPlan.plan_name && (
                        <Badge variant="outline" className="ml-2">
                            Plano {adminPlan.plan_name}
                        </Badge>
                    )}
                </h2>
                <p className="text-muted-foreground mt-1">
                    Configure o WhatsApp para cada loja. Lojas sem configuração usarão o WhatsApp global.
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
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        {store.name}
                                        {getStatusBadge(store)}
                                    </CardTitle>
                                    <CardDescription>
                                        {store.whatsapp_connected_at && (
                                            <>Última conexão: {new Date(store.whatsapp_connected_at).toLocaleString('pt-BR')}</>
                                        )}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label htmlFor={`whatsapp-ativo-${store.id}`} className="text-sm">
                                        Ativar WhatsApp
                                    </Label>
                                    <Switch
                                        id={`whatsapp-ativo-${store.id}`}
                                        checked={store.whatsapp_ativo}
                                        onCheckedChange={(checked) => updateStore(store.id, 'whatsapp_ativo', checked)}
                                        disabled={!adminPlan.can_use_own_whatsapp}
                                    />
                                </div>
                            </div>
                        </CardHeader>

                        {store.whatsapp_ativo && (
                            <CardContent className="space-y-4">
                                <Tabs defaultValue="auth" className="w-full">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="auth" className="gap-2">
                                            <QrCode className="h-4 w-4" />
                                            Autenticação QR Code
                                        </TabsTrigger>
                                        <TabsTrigger value="manual" className="gap-2">
                                            <Key className="h-4 w-4" />
                                            Configuração Manual
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="auth" className="space-y-4">
                                        <WhatsAppAuth
                                            storeId={store.id}
                                            storeName={store.name}
                                            customerId={profile?.email || ''}
                                            siteSlug={store.name.toLowerCase().replace(/\s+/g, '-')}
                                            onAuthSuccess={() => {
                                                fetchStores();
                                                toast.success('WhatsApp conectado! As credenciais foram salvas automaticamente.');
                                            }}
                                        />
                                    </TabsContent>

                                    <TabsContent value="manual" className="space-y-4">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor={`token-${store.id}`}>
                                                    UazAPI Token *
                                                </Label>
                                                <Input
                                                    id={`token-${store.id}`}
                                                    type="password"
                                                    placeholder="Cole o token da UazAPI"
                                                    value={store.uazapi_token || ''}
                                                    onChange={(e) => updateStore(store.id, 'uazapi_token', e.target.value)}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Token de autenticação da API UazAPI
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor={`instance-${store.id}`}>
                                                    Instance ID (opcional)
                                                </Label>
                                                <Input
                                                    id={`instance-${store.id}`}
                                                    placeholder="ID da instância"
                                                    value={store.uazapi_instance_id || ''}
                                                    onChange={(e) => updateStore(store.id, 'uazapi_instance_id', e.target.value)}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    ID da instância do WhatsApp na UazAPI
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                onClick={() => handleSave(store)}
                                                disabled={saving === store.id}
                                                className="gap-2"
                                            >
                                                {saving === store.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Save className="h-4 w-4" />
                                                )}
                                                Salvar
                                            </Button>

                                            <Button
                                                variant="outline"
                                                onClick={() => handleTest(store)}
                                                disabled={testing === store.id || !store.uazapi_token}
                                                className="gap-2"
                                            >
                                                {testing === store.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <TestTube className="h-4 w-4" />
                                                )}
                                                Testar Conexão
                                            </Button>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        )}
                    </Card>
                ))
            )}

            <Card className="bg-muted/50">
                <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">ℹ️ Como funciona</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Se a loja tiver WhatsApp ativo e token configurado, as mensagens serão enviadas pelo número da loja</li>
                        <li>• Se a loja não tiver WhatsApp configurado, será usado o número global da Elevea</li>
                        <li>• Você pode obter o token UazAPI no painel de controle da sua conta UazAPI</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
};
