import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { SiteData, SiteFormData } from "./types";

export function useSiteData() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const tenantId = (profile as any)?.store_id;
  
  const {
    data: site,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['site', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sites')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      if (error) throw error;
      return data as unknown as SiteData | null;
    },
    enabled: !!tenantId
  });
  
  const canReset = (): { allowed: boolean; daysRemaining: number } => {
    if (!site?.last_reset_at) {
      return { allowed: true, daysRemaining: 0 };
    }
    
    const lastReset = new Date(site.last_reset_at);
    const now = new Date();
    const diffTime = now.getTime() - lastReset.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 30) {
      return { allowed: true, daysRemaining: 0 };
    }
    
    return { allowed: false, daysRemaining: 30 - diffDays };
  };
  
  const createSiteMutation = useMutation({
    mutationFn: async (formData: SiteFormData) => {
      if (!tenantId || !profile?.id) {
        throw new Error("Usuário não autenticado");
      }
      
      const slug = formData.company_name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      const siteData = {
        slug,
        name: formData.company_name,
        tenant_id: tenantId,
        created_by: profile.id,
        
        business_type: formData.business_type,
        segment_id: formData.segment_id,
        segment_name: formData.segment_name,
        area_id: formData.area_id || null,
        area_name: formData.area_name || null,
        custom_area: formData.custom_area || null,
        content_type: formData.content_type,
        voice_tone: formData.voice_tone,
        
        company_name: formData.company_name,
        company_description: formData.company_description || null,
        company_history: formData.company_history || null,
        mission: formData.mission || null,
        vision: formData.vision || null,
        company_values: formData.company_values || null,
        services_description: formData.services_description || null,
        products_description: formData.products_description || null,
        differentials: formData.differentials || null,
        
        whatsapp: formData.whatsapp || null,
        phone: formData.phone || null,
        email: formData.email || null,
        instagram: formData.instagram || null,
        facebook: formData.facebook || null,
        
        address_street: formData.address_street || null,
        address_number: formData.address_number || null,
        address_complement: formData.address_complement || null,
        address_neighborhood: formData.address_neighborhood || null,
        address_city: formData.address_city || null,
        address_state: formData.address_state || null,
        address_zip: formData.address_zip || null,
        
        business_hours: formData.business_hours,
        
        color_primary: formData.color_primary,
        color_secondary: formData.color_secondary,
        color_accent: formData.color_accent,
        
        status: 'draft'
      };
      
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sites')
        .insert(siteData as any)
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as SiteData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', tenantId] });
      toast({
        title: "Site criado",
        description: "Seu site foi criado com sucesso! Agora vamos gerar o conteúdo."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar site",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const updateSiteMutation = useMutation({
    mutationFn: async (updates: Partial<SiteFormData>) => {
      if (!site?.id) {
        throw new Error("Site não encontrado");
      }
      
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sites')
        .update(updates as any)
        .eq('id', site.id as any)
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as SiteData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', tenantId] });
      toast({
        title: "Site atualizado",
        description: "Alterações salvas com sucesso."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const resetSiteMutation = useMutation({
    mutationFn: async () => {
      if (!site?.id) {
        throw new Error("Site não encontrado");
      }
      
      const { allowed, daysRemaining } = canReset();
      if (!allowed) {
        throw new Error(`Você só pode resetar o site novamente em ${daysRemaining} dias.`);
      }
      
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('sites')
        .delete()
        .eq('id', site.id as any);
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', tenantId] });
      toast({
        title: "Site resetado",
        description: "Você pode criar um novo site agora."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao resetar",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const triggerDeployMutation = useMutation({
    mutationFn: async () => {
      if (!site) {
        throw new Error("Site não encontrado");
      }
      
      const webhookUrl = import.meta.env.VITE_N8N_BASE_URL;
      const authHeader = import.meta.env.VITE_N8N_AUTH_HEADER;
      
      const response = await fetch(`${webhookUrl}/elevea-sites/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-APP-KEY': authHeader
        },
        body: JSON.stringify({
          site_slug: site.slug,
          site_name: site.name,
          description: site.company_description || ''
        })
      });
      
      if (!response.ok) {
        throw new Error('Falha ao iniciar deploy');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['site', tenantId] });
      toast({
        title: "Deploy iniciado",
        description: `Site sendo configurado: ${data.netlify?.url || 'aguarde...'}`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no deploy",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  return {
    site,
    isLoading,
    error,
    hasSite: !!site,
    canReset: canReset(),
    refetch,
    createSite: createSiteMutation.mutateAsync,
    updateSite: updateSiteMutation.mutateAsync,
    resetSite: resetSiteMutation.mutateAsync,
    triggerDeploy: triggerDeployMutation.mutateAsync,
    isCreating: createSiteMutation.isPending,
    isUpdating: updateSiteMutation.isPending,
    isResetting: resetSiteMutation.isPending,
    isDeploying: triggerDeployMutation.isPending
  };
}
