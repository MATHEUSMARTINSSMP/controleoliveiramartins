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
    data: siteResult,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['site', tenantId],
    queryFn: async () => {
      if (!tenantId) return { site: null, archivedSite: null };
      
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sites')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const sites = data as unknown as SiteData[] || [];
      const activeSite = sites.find(s => s.status !== 'archived');
      const archivedSite = sites.find(s => s.status === 'archived');
      
      return { site: activeSite || null, archivedSite };
    },
    enabled: !!tenantId
  });
  
  const site = siteResult?.site || null;
  const archivedSite = siteResult?.archivedSite || null;
  
  const canReset = (): { allowed: boolean; daysRemaining: number } => {
    const lastResetAt = archivedSite?.last_reset_at;
    
    if (!lastResetAt) {
      return { allowed: true, daysRemaining: 0 };
    }
    
    const lastReset = new Date(lastResetAt);
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
      
      const { data: existingSites } = await supabase
        .schema('sistemaretiradas')
        .from('sites')
        .select('id, status')
        .eq('tenant_id', tenantId);
      
      const sites = existingSites as any[] || [];
      const activeSite = sites.find(s => s.status !== 'archived');
      
      if (activeSite) {
        throw new Error("Sua loja já possui um site ativo. Use a opção de resetar para criar um novo.");
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
        
        color_primary: formData.color_primary || '#8B5CF6',
        color_secondary: formData.color_secondary || '#1F2937',
        color_accent: formData.color_accent || '#10B981',
        color_background: '#FFFFFF',
        font_primary: 'Inter',
        font_secondary: 'Inter',
        visual_style: 'moderno',
        
        gallery_images: [],
        product_images: [],
        ambient_images: [],
        
        status: 'draft'
      };
      
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sites')
        .insert(siteData as any)
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          throw new Error("Já existe um site com esse nome. Por favor, escolha outro nome.");
        }
        throw error;
      }
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
      if (!site?.id || !tenantId) {
        throw new Error("Site não encontrado");
      }
      
      const { data: allSites, error: fetchError } = await supabase
        .schema('sistemaretiradas')
        .from('sites')
        .select('id, status, last_reset_at')
        .eq('tenant_id', tenantId);
      
      if (fetchError) {
        throw new Error("Erro ao verificar sites");
      }
      
      const sites = allSites as any[] || [];
      const archivedWithReset = sites.find(s => s.status === 'archived' && s.last_reset_at);
      
      if (archivedWithReset?.last_reset_at) {
        const lastReset = new Date(archivedWithReset.last_reset_at);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 30) {
          throw new Error(`Você só pode resetar o site novamente em ${30 - diffDays} dias.`);
        }
      }
      
      for (const s of sites) {
        if (s.status === 'archived') {
          await supabase
            .schema('sistemaretiradas')
            .from('sites')
            .delete()
            .eq('id', s.id as any);
        }
      }
      
      const { error: archiveError } = await supabase
        .schema('sistemaretiradas')
        .from('sites')
        .update({
          status: 'archived',
          last_reset_at: new Date().toISOString()
        } as any)
        .eq('id', site.id as any);
      
      if (archiveError) {
        throw new Error("Falha ao arquivar site: " + archiveError.message);
      }
      
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
      
      if (!webhookUrl) {
        throw new Error("Configuração de deploy não encontrada");
      }
      
      const response = await fetch(`${webhookUrl}/elevea-sites/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-APP-KEY': authHeader || ''
        },
        body: JSON.stringify({
          site_id: site.id,
          site_slug: site.slug,
          site_name: site.name,
          description: site.company_description || '',
          segment: site.segment_name,
          area: site.area_name,
          voice_tone: site.voice_tone,
          colors: {
            primary: site.color_primary,
            secondary: site.color_secondary,
            accent: site.color_accent
          },
          company_data: {
            name: site.company_name,
            whatsapp: site.whatsapp,
            email: site.email,
            instagram: site.instagram,
            address: site.business_type === 'fisico' ? {
              street: site.address_street,
              number: site.address_number,
              neighborhood: site.address_neighborhood,
              city: site.address_city,
              state: site.address_state
            } : null,
            business_hours: site.business_hours
          }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao iniciar deploy: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.github?.url || result.netlify?.url) {
        const { error: updateError } = await supabase
          .schema('sistemaretiradas')
          .from('sites')
          .update({
            github_url: result.github?.url || null,
            github_full_name: result.github?.full_name || null,
            netlify_url: result.netlify?.url || null,
            netlify_site_id: result.netlify?.site_id || null,
            netlify_admin_url: result.netlify?.admin_url || null,
            status: 'generating'
          } as any)
          .eq('id', site.id as any);
        
        if (updateError) {
          console.error('Erro ao atualizar URLs:', updateError);
        }
      }
      
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['site', tenantId] });
      toast({
        title: "Deploy iniciado",
        description: data.netlify?.url 
          ? `Site sendo configurado: ${data.netlify.url}` 
          : "Aguarde alguns minutos para o site ficar disponível."
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
  
  const generateContentMutation = useMutation({
    mutationFn: async () => {
      if (!site) {
        throw new Error("Site não encontrado");
      }
      
      const webhookUrl = import.meta.env.VITE_N8N_BASE_URL;
      const authHeader = import.meta.env.VITE_N8N_AUTH_HEADER;
      
      if (!webhookUrl) {
        throw new Error("Configuração de geração não encontrada");
      }
      
      await supabase
        .schema('sistemaretiradas')
        .from('sites')
        .update({ status: 'generating' } as any)
        .eq('id', site.id as any);
      
      const response = await fetch(`${webhookUrl}/elevea-sites/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-APP-KEY': authHeader || ''
        },
        body: JSON.stringify({
          site_slug: site.slug,
          business_type: site.business_type,
          segment_id: site.segment_id,
          segment_name: site.segment_name,
          area_id: site.area_id || '',
          area_name: site.area_name || '',
          custom_area: site.custom_area || '',
          content_type: site.content_type,
          voice_tone: site.voice_tone,
          company_name: site.company_name,
          company_description: site.company_description || '',
          company_history: site.company_history || '',
          mission: site.mission || '',
          vision: site.vision || '',
          company_values: site.company_values || '',
          services_description: site.services_description || '',
          products_description: site.products_description || '',
          differentials: site.differentials || '',
          whatsapp: site.whatsapp || '',
          phone: site.phone || '',
          email: site.email || '',
          instagram: site.instagram || '',
          facebook: site.facebook || '',
          address_street: site.address_street || '',
          address_number: site.address_number || '',
          address_complement: site.address_complement || '',
          address_neighborhood: site.address_neighborhood || '',
          address_city: site.address_city || '',
          address_state: site.address_state || '',
          address_zip: site.address_zip || '',
          business_hours: site.business_hours,
          color_primary: site.color_primary,
          color_secondary: site.color_secondary,
          color_accent: site.color_accent,
          github_owner: site.github_full_name?.split('/')[0] || 'eleveaone',
          github_repo: site.github_full_name?.split('/')[1] || site.slug
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        await supabase
          .schema('sistemaretiradas')
          .from('sites')
          .update({ status: 'error' } as any)
          .eq('id', site.id as any);
        throw new Error(`Falha ao gerar conteúdo: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        const { error: updateError } = await supabase
          .schema('sistemaretiradas')
          .from('sites')
          .update({
            status: 'published',
            generated_at: new Date().toISOString()
          } as any)
          .eq('id', site.id as any);
        
        if (updateError) {
          console.error('Erro ao atualizar status:', updateError);
        }
      }
      
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['site', tenantId] });
      toast({
        title: "Conteúdo gerado",
        description: data.netlify_url 
          ? `Site publicado: ${data.netlify_url}` 
          : "O site foi gerado com sucesso pela IA!"
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ['site', tenantId] });
      toast({
        title: "Erro na geração",
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
    generateContent: generateContentMutation.mutateAsync,
    isCreating: createSiteMutation.isPending,
    isUpdating: updateSiteMutation.isPending,
    isResetting: resetSiteMutation.isPending,
    isDeploying: triggerDeployMutation.isPending,
    isGenerating: generateContentMutation.isPending
  };
}
