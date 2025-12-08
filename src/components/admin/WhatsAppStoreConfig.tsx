import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Save, Phone, Wifi, WifiOff, TestTube, Loader2, Lock, Sparkles, RefreshCw, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWhatsAppStatus, connectWhatsApp, isTerminalStatus, type WhatsAppStatusResponse } from "@/lib/whatsapp";

interface Store {
    id: string;
    name: string;
    slug: string;
    whatsapp_ativo: boolean;
}

interface WhatsAppCredential {
    customer_id: string;
    site_slug: string;
    uazapi_instance_id: string | null;
    uazapi_token: string | null;
    uazapi_phone_number: string | null;
    uazapi_qr_code: string | null;
    uazapi_status: string | null;
    whatsapp_instance_name: string | null;
    chatwoot_base_url: string | null;
    chatwoot_account_id: number | null;
    chatwoot_access_token: string | null;
    chatwoot_inbox_id: number | null;
    status: string;
    updated_at: string | null;
}

interface StoreWithCredentials extends Store {
    credentials: WhatsAppCredential | null;
}

interface AdminPlan {
    plan_name: string | null;
    can_use_own_whatsapp: boolean;
}

const generateSlug = (name: string): string => {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/(^_|_$)/g, '')
        .replace(/_+/g, '_');
};

export const WhatsAppStoreConfig = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [testing, setTesting] = useState<string | null>(null);
    const [storesWithCredentials, setStoresWithCredentials] = useState<StoreWithCredentials[]>([]);
    const [adminPlan, setAdminPlan] = useState<AdminPlan>({ plan_name: null, can_use_own_whatsapp: false });
    const [localCredentials, setLocalCredentials] = useState<Record<string, Partial<WhatsAppCredential>>>({});
    
    // Status polling state
    const [statusMap, setStatusMap] = useState<Record<string, WhatsAppStatusResponse | null>>({});
    const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
    const [pollingStores, setPollingStores] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (profile && profile.role === 'ADMIN') {
            fetchAdminPlan();
            fetchStoresAndCredentials();
        }
    }, [profile?.id]); // So recarregar se o ID do profile mudar

    // Funcao para verificar status de uma loja via N8N
    const handleCheckStatus = useCallback(async (store: StoreWithCredentials) => {
        if (!profile?.email) return;

        setCheckingStatus(store.slug);
        toast.info(`Verificando status de ${store.name}...`);

        try {
            const status = await fetchWhatsAppStatus({
                siteSlug: store.slug,
                customerId: profile.email,
            });

            setStatusMap(prev => ({ ...prev, [store.slug]: status }));

            // Atualizar credenciais locais com status do N8N
            setStoresWithCredentials(prev =>
                prev.map(s => s.slug === store.slug ? {
                    ...s,
                    credentials: {
                        ...s.credentials,
                        uazapi_status: status.status,
                        uazapi_qr_code: status.qrCode,
                        uazapi_phone_number: status.phoneNumber || s.credentials?.uazapi_phone_number,
                        updated_at: new Date().toISOString(),
                    } as WhatsAppCredential
                } : s)
            );

            // Salvar status no Supabase para persistencia
            await saveStatusToSupabase(store.slug, status.status, status.phoneNumber, status.qrCode);

            // Se nao e terminal, iniciar polling
            if (!isTerminalStatus(status.status)) {
                setPollingStores(prev => new Set(prev).add(store.slug));
                startPollingForStore(store);
            } else {
                setPollingStores(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(store.slug);
                    return newSet;
                });
            }

            if (status.connected) {
                toast.success(`${store.name} esta conectado!`);
            } else if (status.status === 'qr_required') {
                toast.info(`${store.name}: Escaneie o QR Code para conectar`);
            } else if (status.status === 'error') {
                toast.error(`${store.name}: Erro na conexao`);
            } else {
                toast.info(`${store.name}: Status: ${status.status}`);
            }
        } catch (error: any) {
            console.error('Erro ao verificar status:', error);
            toast.error('Erro ao verificar status: ' + error.message);
        } finally {
            setCheckingStatus(null);
        }
    }, [profile?.email]);

    // Funcao para GERAR novo QR Code (iniciar conexao)
    const handleGenerateQRCode = useCallback(async (store: StoreWithCredentials) => {
        if (!profile?.email) return;

        setCheckingStatus(store.slug);
        toast.info(`Gerando QR Code para ${store.name}...`);

        try {
            const result = await connectWhatsApp({
                siteSlug: store.slug,
                customerId: profile.email,
            });

            console.log('[WhatsApp] Resultado conexao:', result);

            if (result.qrCode) {
                setStoresWithCredentials(prev =>
                    prev.map(s => s.slug === store.slug ? {
                        ...s,
                        credentials: {
                            ...s.credentials,
                            uazapi_status: 'qr_required',
                            uazapi_qr_code: result.qrCode,
                            updated_at: new Date().toISOString(),
                        } as WhatsAppCredential
                    } : s)
                );

                setPollingStores(prev => new Set(prev).add(store.slug));
                startPollingForStore(store);
                toast.success(`QR Code gerado! Escaneie para conectar ${store.name}`);
            } else if (result.error) {
                toast.error(`Erro ao gerar QR Code: ${result.error}`);
            } else {
                toast.info(`Aguardando resposta do servidor...`);
                setPollingStores(prev => new Set(prev).add(store.slug));
                startPollingForStore(store);
            }
        } catch (error: any) {
            console.error('Erro ao gerar QR Code:', error);
            toast.error('Erro ao gerar QR Code: ' + error.message);
        } finally {
            setCheckingStatus(null);
        }
    }, [profile?.email]);

    // Polling automatico para lojas em estados de transicao
    const startPollingForStore = useCallback((store: StoreWithCredentials) => {
        if (!profile?.email) return;

        const pollInterval = setInterval(async () => {
            try {
                const status = await fetchWhatsAppStatus({
                    siteSlug: store.slug,
                    customerId: profile.email!,
                });

                setStatusMap(prev => ({ ...prev, [store.slug]: status }));

                // Atualizar UI
                setStoresWithCredentials(prev =>
                    prev.map(s => s.slug === store.slug ? {
                        ...s,
                        credentials: {
                            ...s.credentials,
                            uazapi_status: status.status,
                            uazapi_qr_code: status.qrCode,
                            uazapi_phone_number: status.phoneNumber || s.credentials?.uazapi_phone_number,
                            updated_at: new Date().toISOString(),
                        } as WhatsAppCredential
                    } : s)
                );

                // Se atingiu status terminal, parar polling e salvar no Supabase
                if (isTerminalStatus(status.status)) {
                    clearInterval(pollInterval);
                    setPollingStores(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(store.slug);
                        return newSet;
                    });

                    // Salvar status final no Supabase para persistencia
                    await supabase
                        .schema('sistemaretiradas')
                        .from('whatsapp_credentials')
                        .update({
                            uazapi_status: status.status,
                            uazapi_phone_number: status.phoneNumber || null,
                            uazapi_qr_code: null,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('customer_id', profile.email!)
                        .eq('site_slug', store.slug);

                    if (status.connected) {
                        toast.success(`${store.name} conectado com sucesso!`);
                    }
                }
            } catch (error) {
                console.error('Erro no polling:', error);
            }
        }, 12000); // 12 segundos

        // Limpar apos 2 minutos
        setTimeout(() => {
            clearInterval(pollInterval);
            setPollingStores(prev => {
                const newSet = new Set(prev);
                newSet.delete(store.slug);
                return newSet;
            });
        }, 120000);
    }, [profile?.email]);

    const fetchAdminPlan = async () => {
        if (!profile) return;

        console.log('[fetchAdminPlan] Buscando plano para admin_id:', profile.id);

        try {
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('admin_subscriptions')
                .select(`
                    plan_id,
                    status,
                    subscription_plans:plan_id (
                        name,
                        display_name
                    )
                `)
                .eq('admin_id', profile.id)
                .ilike('status', 'active')
                .maybeSingle();

            console.log('[fetchAdminPlan] Resultado da query:', { data, error });

            if (error) {
                console.error('[fetchAdminPlan] Erro ao buscar plano:', error);
                return;
            }

            if (data && data.subscription_plans) {
                const plan = data.subscription_plans as any;
                const planName = plan.name?.toUpperCase() || '';
                const canUseOwnWhatsApp = planName === 'BUSINESS' || planName === 'ENTERPRISE';

                console.log('[fetchAdminPlan] Plano encontrado:', { planName, canUseOwnWhatsApp, plan });

                setAdminPlan({
                    plan_name: plan.display_name || plan.name,
                    can_use_own_whatsapp: canUseOwnWhatsApp,
                });
            } else {
                console.warn('[fetchAdminPlan] Nenhum plano ativo encontrado, usando Starter');
                setAdminPlan({
                    plan_name: 'Starter',
                    can_use_own_whatsapp: false,
                });
            }
        } catch (error: any) {
            console.error('[fetchAdminPlan] Erro ao buscar plano do admin:', error);
        }
    };

    const fetchStoresAndCredentials = async () => {
        if (!profile || !profile.email) return;

        setLoading(true);
        try {
            const { data: stores, error: storesError } = await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .select('id, name, whatsapp_ativo')
                .eq('admin_id', profile.id)
                .eq('active', true)
                .order('name', { ascending: true });

            if (storesError) throw storesError;

            if (!stores || stores.length === 0) {
                setStoresWithCredentials([]);
                setLoading(false);
                return;
            }

            const storesWithSlugs = stores.map(store => ({
                ...store,
                slug: generateSlug(store.name)
            }));

            const slugs = storesWithSlugs.map(s => s.slug);

            const { data: credentials, error: credError } = await supabase
                .schema('sistemaretiradas')
                .from('whatsapp_credentials')
                .select('*')
                .eq('customer_id', profile.email)
                .in('site_slug', slugs);

            if (credError) {
                console.error('Erro ao buscar credenciais:', credError);
            }

            const credentialsBySlug: Record<string, WhatsAppCredential> = {};
            if (credentials) {
                credentials.forEach((cred: any) => {
                    credentialsBySlug[cred.site_slug] = cred;
                });
            }

            const combined: StoreWithCredentials[] = storesWithSlugs.map(store => ({
                ...store,
                credentials: credentialsBySlug[store.slug] || null
            }));

            setStoresWithCredentials(combined);

            const initialLocal: Record<string, Partial<WhatsAppCredential>> = {};
            combined.forEach(store => {
                initialLocal[store.slug] = {
                    uazapi_token: store.credentials?.uazapi_token || '',
                    uazapi_instance_id: store.credentials?.uazapi_instance_id || '',
                    uazapi_phone_number: store.credentials?.uazapi_phone_number || '',
                    whatsapp_instance_name: store.credentials?.whatsapp_instance_name || '',
                };
            });
            setLocalCredentials(initialLocal);

            // Verificar status real via N8N para TODAS as lojas com WhatsApp ativado
            // Isso garante que lojas conectadas no N8N sejam detectadas mesmo sem instance_id local
            const storesToCheck = combined.filter(s => s.whatsapp_ativo);
            if (storesToCheck.length > 0 && profile?.email) {
                console.log('[fetchStoresAndCredentials] Verificando status de', storesToCheck.length, 'lojas com WhatsApp ativado...');
                
                for (const store of storesToCheck) {
                    try {
                        const status = await fetchWhatsAppStatus({
                            siteSlug: store.slug,
                            customerId: profile.email,
                        });
                        
                        // Atualizar estado local
                        setStoresWithCredentials(prev =>
                            prev.map(s => s.slug === store.slug ? {
                                ...s,
                                credentials: {
                                    ...s.credentials,
                                    uazapi_status: status.status,
                                    uazapi_phone_number: status.phoneNumber || s.credentials?.uazapi_phone_number,
                                } as WhatsAppCredential
                            } : s)
                        );
                        
                        // Salvar no Supabase se status diferente ou se encontrou dados novos
                        const hasStatusChange = status.status !== store.credentials?.uazapi_status;
                        const hasNewInstanceId = status.instanceId && !store.credentials?.uazapi_instance_id;
                        const hasNewPhone = status.phoneNumber && !store.credentials?.uazapi_phone_number;
                        
                        if (hasStatusChange || hasNewInstanceId || hasNewPhone) {
                            // Usar UPSERT para criar registro se nao existir
                            const upsertData: Record<string, any> = {
                                customer_id: profile.email,
                                site_slug: store.slug,
                                uazapi_status: status.status,
                                updated_at: new Date().toISOString(),
                                status: 'active',
                            };
                            
                            if (status.phoneNumber) {
                                upsertData.uazapi_phone_number = status.phoneNumber;
                            }
                            if (status.instanceId) {
                                upsertData.uazapi_instance_id = status.instanceId;
                            }
                            
                            await supabase
                                .schema('sistemaretiradas')
                                .from('whatsapp_credentials')
                                .upsert(upsertData, {
                                    onConflict: 'customer_id,site_slug'
                                });
                                
                            console.log('[fetchStoresAndCredentials] Status atualizado para', store.slug, ':', status.status, 'instanceId:', status.instanceId);
                            
                            // Atualizar estado local com instanceId se encontrado
                            if (status.instanceId) {
                                setStoresWithCredentials(prev =>
                                    prev.map(s => s.slug === store.slug ? {
                                        ...s,
                                        credentials: {
                                            ...s.credentials,
                                            uazapi_instance_id: status.instanceId,
                                        } as WhatsAppCredential
                                    } : s)
                                );
                            }
                        }
                    } catch (err) {
                        console.error('[fetchStoresAndCredentials] Erro ao verificar status de', store.slug, ':', err);
                    }
                }
            }

        } catch (error: any) {
            console.error('Erro ao buscar lojas:', error);
            toast.error('Erro ao carregar lojas');
        } finally {
            setLoading(false);
        }
    };

    const updateLocalCredential = (slug: string, field: keyof WhatsAppCredential, value: any) => {
        setLocalCredentials(prev => ({
            ...prev,
            [slug]: {
                ...prev[slug],
                [field]: value
            }
        }));
    };

    const saveStatusToSupabase = async (slug: string, status: string, phoneNumber?: string | null, qrCode?: string | null) => {
        if (!profile?.email) return;
        
        try {
            const updateData: Record<string, any> = {
                uazapi_status: status,
                updated_at: new Date().toISOString(),
            };
            
            if (phoneNumber) {
                updateData.uazapi_phone_number = phoneNumber;
            }
            
            if (qrCode !== undefined) {
                updateData.uazapi_qr_code = qrCode;
            }
            
            const { error } = await supabase
                .schema('sistemaretiradas')
                .from('whatsapp_credentials')
                .update(updateData)
                .eq('customer_id', profile.email)
                .eq('site_slug', slug);
                
            if (error) {
                console.error('[saveStatusToSupabase] Erro ao salvar status:', error);
            } else {
                console.log('[saveStatusToSupabase] Status salvo no Supabase:', { slug, status });
            }
        } catch (error) {
            console.error('[saveStatusToSupabase] Erro:', error);
        }
    };

    const updateStoreWhatsAppAtivo = async (storeId: string, whatsapp_ativo: boolean) => {
        try {
            const { error } = await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .update({ whatsapp_ativo })
                .eq('id', storeId);

            if (error) throw error;

            setStoresWithCredentials(prev => 
                prev.map(s => s.id === storeId ? { ...s, whatsapp_ativo } : s)
            );
        } catch (error: any) {
            console.error('Erro ao atualizar status:', error);
            toast.error('Erro ao atualizar status do WhatsApp');
        }
    };

    const handleSave = async (store: StoreWithCredentials) => {
        if (!profile?.email) return;

        setSaving(store.id);
        try {
            const local = localCredentials[store.slug] || {};

            const { error } = await supabase
                .schema('sistemaretiradas')
                .from('whatsapp_credentials')
                .upsert({
                    customer_id: profile.email,
                    site_slug: store.slug,
                    uazapi_token: local.uazapi_token || null,
                    uazapi_instance_id: local.uazapi_instance_id || null,
                    uazapi_phone_number: local.uazapi_phone_number || null,
                    whatsapp_instance_name: local.whatsapp_instance_name || store.slug,
                    uazapi_status: local.uazapi_token ? 'configured' : 'disconnected',
                    status: 'active',
                }, {
                    onConflict: 'customer_id,site_slug'
                });

            if (error) throw error;

            toast.success(`Credenciais da loja ${store.name} salvas!`);
            
            // Atualizar apenas localmente sem refetch
            setStoresWithCredentials(prev => 
                prev.map(s => s.slug === store.slug ? {
                    ...s,
                    credentials: {
                        ...s.credentials,
                        uazapi_token: local.uazapi_token,
                        uazapi_instance_id: local.uazapi_instance_id,
                        uazapi_phone_number: local.uazapi_phone_number,
                        whatsapp_instance_name: local.whatsapp_instance_name,
                        uazapi_status: local.uazapi_token ? 'configured' : 'disconnected',
                        updated_at: new Date().toISOString(),
                    } as WhatsAppCredential
                } : s)
            );
        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            toast.error('Erro ao salvar credenciais: ' + error.message);
        } finally {
            setSaving(null);
        }
    };

    const handleTest = async (store: StoreWithCredentials) => {
        const local = localCredentials[store.slug];
        if (!local?.uazapi_token) {
            toast.error('Configure o token UazAPI primeiro');
            return;
        }

        setTesting(store.id);
        try {
            const response = await fetch('/.netlify/functions/send-whatsapp-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: '5500000000000',
                    message: `Teste de conexao WhatsApp\n\nLoja: ${store.name}\nHorario: ${new Date().toLocaleString('pt-BR')}`,
                    store_id: store.id,
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Conexao testada com sucesso!');

                // Atualizar apenas localmente
                setStoresWithCredentials(prev => 
                    prev.map(s => s.slug === store.slug ? {
                        ...s,
                        credentials: {
                            ...s.credentials,
                            uazapi_status: 'connected',
                            updated_at: new Date().toISOString(),
                        } as WhatsAppCredential
                    } : s)
                );
            } else {
                throw new Error(data.error || 'Erro desconhecido');
            }
        } catch (error: any) {
            console.error('Erro no teste:', error);
            toast.error('Erro ao testar: ' + error.message);

            // Atualizar apenas localmente
            setStoresWithCredentials(prev => 
                prev.map(s => s.slug === store.slug ? {
                    ...s,
                    credentials: {
                        ...s.credentials,
                        uazapi_status: 'error',
                        updated_at: new Date().toISOString(),
                    } as WhatsAppCredential
                } : s)
            );
        } finally {
            setTesting(null);
        }
    };

    const getStatusBadge = (store: StoreWithCredentials) => {
        if (!store.whatsapp_ativo) {
            return <Badge variant="secondary">Desativado</Badge>;
        }

        const status = store.credentials?.uazapi_status;

        switch (status) {
            case 'connected':
                return (
                    <Badge className="bg-green-600/80 dark:bg-green-500/80">
                        <Wifi className="h-3 w-3 mr-1" />
                        Conectado
                    </Badge>
                );
            case 'configured':
                return (
                    <Badge variant="outline" className="text-amber-600 border-amber-600 dark:text-amber-400 dark:border-amber-400">
                        Configurado
                    </Badge>
                );
            case 'connecting':
                return (
                    <Badge variant="outline" className="text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400">
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Conectando
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
                        Nao Configurado
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
                        <p className="text-muted-foreground">Carregando configuracoes...</p>
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
                    Configuracao WhatsApp por Loja
                    {adminPlan.plan_name && (
                        <Badge variant="outline" className="ml-2">
                            Plano {adminPlan.plan_name}
                        </Badge>
                    )}
                </h2>
                <p className="text-muted-foreground mt-1">
                    Conecte o WhatsApp de cada loja para envio automatico de mensagens.
                </p>
            </div>

            {!adminPlan.can_use_own_whatsapp && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                    <Lock className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-700 dark:text-amber-400">
                        Recurso disponivel nos planos Business e Enterprise
                    </AlertTitle>
                    <AlertDescription className="text-amber-600 dark:text-amber-300">
                        <p className="mb-3">
                            O WhatsApp personalizado por loja esta disponivel a partir do plano <strong>Business</strong>.
                            No plano atual, suas mensagens sao enviadas pelo WhatsApp global da Elevea.
                        </p>
                        <Button
                            size="sm"
                            className="bg-gradient-to-r from-violet-600 to-fuchsia-600"
                            onClick={() => window.open('/landing#pricing', '_blank')}
                        >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Fazer Upgrade
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {storesWithCredentials.length === 0 ? (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">
                            Nenhuma loja encontrada.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                storesWithCredentials.map((store) => {
                    const local = localCredentials[store.slug] || {};

                    return (
                        <Card key={store.id} data-testid={`card-store-whatsapp-${store.id}`}>
                            <CardHeader>
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 flex-wrap">
                                            {store.name}
                                            {getStatusBadge(store)}
                                        </CardTitle>
                                        <CardDescription>
                                            Slug: <code className="text-xs bg-muted px-1 py-0.5 rounded">{store.slug}</code>
                                            {store.credentials?.updated_at && (
                                                <span className="ml-2">
                                                    | Atualizado: {new Date(store.credentials.updated_at).toLocaleString('pt-BR')}
                                                </span>
                                            )}
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor={`whatsapp-ativo-${store.id}`} className="text-sm">
                                            Ativar WhatsApp
                                        </Label>
                                        <Switch
                                            id={`whatsapp-ativo-${store.id}`}
                                            data-testid={`switch-whatsapp-${store.id}`}
                                            checked={store.whatsapp_ativo}
                                            onCheckedChange={(checked) => updateStoreWhatsAppAtivo(store.id, checked)}
                                            disabled={!adminPlan.can_use_own_whatsapp}
                                        />
                                    </div>
                                </div>
                            </CardHeader>

                            {store.whatsapp_ativo && (
                                <CardContent className="space-y-4">
                                    {store.credentials?.uazapi_qr_code ? (
                                        <div className="p-6 bg-muted rounded-lg text-center">
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Escaneie o QR Code abaixo com o WhatsApp para conectar
                                            </p>
                                            <img 
                                                src={store.credentials.uazapi_qr_code} 
                                                alt="QR Code WhatsApp" 
                                                className="max-w-[250px] mx-auto rounded-lg"
                                                data-testid={`qrcode-${store.id}`}
                                            />
                                            <p className="text-xs text-muted-foreground mt-4">
                                                Abra o WhatsApp no celular, va em Configuracoes, Dispositivos Conectados e escaneie
                                            </p>
                                            <div className="flex gap-2 justify-center mt-4">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setPollingStores(prev => {
                                                            const newSet = new Set(prev);
                                                            newSet.delete(store.slug);
                                                            return newSet;
                                                        });
                                                        setStoresWithCredentials(prev =>
                                                            prev.map(s => s.slug === store.slug ? {
                                                                ...s,
                                                                credentials: {
                                                                    ...s.credentials,
                                                                    uazapi_qr_code: null,
                                                                    uazapi_status: 'disconnected',
                                                                } as WhatsAppCredential
                                                            } : s)
                                                        );
                                                        toast.info('Operacao cancelada');
                                                    }}
                                                    data-testid={`button-cancel-qr-${store.id}`}
                                                >
                                                    <X className="h-4 w-4 mr-1" />
                                                    Cancelar
                                                </Button>
                                                <Button
                                                    onClick={() => handleGenerateQRCode(store)}
                                                    disabled={checkingStatus === store.slug}
                                                    data-testid={`button-refresh-qr-${store.id}`}
                                                >
                                                    {checkingStatus === store.slug ? (
                                                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                    ) : (
                                                        <RefreshCw className="h-4 w-4 mr-1" />
                                                    )}
                                                    Gerar Novo QR Code
                                                </Button>
                                            </div>
                                        </div>
                                    ) : store.credentials?.uazapi_status === 'connected' ? (
                                        <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                                            <Wifi className="h-12 w-12 mx-auto text-green-500 mb-2" />
                                            <p className="text-lg font-medium text-green-700 dark:text-green-400">
                                                WhatsApp Conectado
                                            </p>
                                            {store.credentials?.uazapi_phone_number && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Numero: {store.credentials.uazapi_phone_number}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-6 bg-muted rounded-lg text-center">
                                            <WifiOff className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                                            <p className="text-sm text-muted-foreground">
                                                Clique em "Gerar QR Code" para conectar o WhatsApp desta loja
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex gap-2 justify-center flex-wrap">
                                        <Button
                                            onClick={() => handleGenerateQRCode(store)}
                                            disabled={checkingStatus === store.slug || pollingStores.has(store.slug)}
                                            className="gap-2"
                                            data-testid={`button-generate-qr-${store.id}`}
                                        >
                                            {checkingStatus === store.slug || pollingStores.has(store.slug) ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-4 w-4" />
                                            )}
                                            {pollingStores.has(store.slug) ? 'Conectando...' : 'Gerar QR Code'}
                                        </Button>
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    );
                })
            )}

        </div>
    );
};
