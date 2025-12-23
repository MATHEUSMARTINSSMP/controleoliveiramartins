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
  
  const cleanImageUrl = (url: string | undefined | null): string | null => {
    if (!url) return null;
    if (url.startsWith('blob:')) return null;
    return url;
  };
  
  const sanitizeAssetsForStorage = (assets: SiteFormData['assets'] | undefined): any[] => {
    if (!assets || !Array.isArray(assets)) return [];
    return assets
      .filter(asset => {
        if (!asset.url) return false;
        if (asset.url.startsWith('blob:')) return false;
        return true;
      })
      .map(asset => ({
        id: asset.id,
        type: asset.type,
        url: asset.url,
        displayOrder: asset.displayOrder,
        metadata: asset.metadata
      }));
  };
  
  const extractLegacyImagesFromAssets = (assets: SiteFormData['assets'] | undefined) => {
    if (!assets || !Array.isArray(assets)) return {};
    
    const logo = assets.find(a => a.type === 'logo');
    const hero = assets.find(a => a.type === 'hero');
    const galleryAssets = assets.filter(a => a.type === 'gallery').slice(0, 4);
    
    return {
      logo_url: logo && !logo.url.startsWith('blob:') ? logo.url : null,
      hero_image_url: hero && !hero.url.startsWith('blob:') ? hero.url : null,
      gallery_images: galleryAssets
        .map(a => !a.url.startsWith('blob:') ? a.url : null)
        .filter(Boolean) as string[]
    };
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
        
        slogan: formData.slogan || null,
        tagline: formData.tagline || null,
        founding_year: formData.founding_year ? parseInt(formData.founding_year) : null,
        team_size: formData.team_size || null,
        awards: formData.awards || null,
        certifications: formData.certifications || null,
        
        featured_products: formData.featured_products || [],
        featured_services: formData.featured_services || [],
        special_offers: formData.special_offers || [],
        testimonials: formData.testimonials || [],
        
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
        google_maps_embed: formData.google_maps_embed || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        
        business_hours: formData.business_hours,
        
        color_primary: formData.color_primary || '#8B5CF6',
        color_secondary: formData.color_secondary || '#1F2937',
        color_accent: formData.color_accent || '#10B981',
        color_background: formData.color_background || '#FFFFFF',
        font_primary: 'Inter',
        font_secondary: 'Inter',
        visual_style: 'moderno',
        
        logo_url: cleanImageUrl(formData.logo_url) || extractLegacyImagesFromAssets(formData.assets).logo_url,
        hero_image_url: cleanImageUrl(formData.hero_image_url) || extractLegacyImagesFromAssets(formData.assets).hero_image_url,
        gallery_images: [
          cleanImageUrl(formData.gallery_image_1),
          cleanImageUrl(formData.gallery_image_2),
          cleanImageUrl(formData.gallery_image_3),
          cleanImageUrl(formData.gallery_image_4)
        ].filter(Boolean) as string[] || extractLegacyImagesFromAssets(formData.assets).gallery_images || [],
        product_images: (formData.assets || []).filter(a => a.type === 'product' && !a.url.startsWith('blob:')).map(a => a.url),
        ambient_images: (formData.assets || []).filter(a => a.type === 'ambient' && !a.url.startsWith('blob:')).map(a => a.url),
        assets: sanitizeAssetsForStorage(formData.assets),
        
        cta_button_text: formData.cta_button_text || null,
        cta_whatsapp_message: formData.cta_whatsapp_message || null,
        
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
      
      const sanitizedUpdates: Record<string, any> = {};
      const base64Keys = ['logo_base64', 'hero_image_base64', 'gallery_image_1_base64', 'gallery_image_2_base64', 'gallery_image_3_base64', 'gallery_image_4_base64'];
      const imageUrlKeys = ['logo_url', 'hero_image_url', 'gallery_image_1', 'gallery_image_2', 'gallery_image_3', 'gallery_image_4'];
      
      for (const [key, value] of Object.entries(updates)) {
        if (base64Keys.includes(key)) continue;
        if (key === 'assets') {
          const assets = value as SiteFormData['assets'];
          sanitizedUpdates[key] = sanitizeAssetsForStorage(assets);
          const legacyImages = extractLegacyImagesFromAssets(assets);
          if (legacyImages.logo_url) sanitizedUpdates.logo_url = legacyImages.logo_url;
          if (legacyImages.hero_image_url) sanitizedUpdates.hero_image_url = legacyImages.hero_image_url;
          if (legacyImages.gallery_images?.length) sanitizedUpdates.gallery_images = legacyImages.gallery_images;
          sanitizedUpdates.product_images = (assets || []).filter(a => a.type === 'product' && !a.url.startsWith('blob:')).map(a => a.url);
          sanitizedUpdates.ambient_images = (assets || []).filter(a => a.type === 'ambient' && !a.url.startsWith('blob:')).map(a => a.url);
        } else if (imageUrlKeys.includes(key)) {
          sanitizedUpdates[key] = cleanImageUrl(value as string);
        } else {
          sanitizedUpdates[key] = value;
        }
      }
      
      if (Object.keys(sanitizedUpdates).length === 0) {
        return site;
      }
      
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sites')
        .update(sanitizedUpdates as any)
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
    mutationFn: async (formData?: SiteFormData) => {
      if (!site) {
        throw new Error("Site nao encontrado");
      }
      
      const webhookUrl = import.meta.env.VITE_N8N_BASE_URL;
      const authHeader = import.meta.env.VITE_N8N_AUTH_HEADER;
      
      if (!webhookUrl) {
        throw new Error("Configuracao de geracao nao encontrada");
      }
      
      await supabase
        .schema('sistemaretiradas')
        .from('sites')
        .update({ status: 'generating' } as any)
        .eq('id', site.id as any);
      
      const addressFull = site.business_type === 'fisico' && site.address_street
        ? `${site.address_street}, ${site.address_number || 's/n'}${site.address_complement ? ` - ${site.address_complement}` : ''}, ${site.address_neighborhood || ''}, ${site.address_city || ''} - ${site.address_state || ''}, ${site.address_zip || ''}`
        : '';
      
      const getImageUrl = (formUrl: string | undefined, siteUrl: string | null) => {
        if (formUrl && !formUrl.startsWith('blob:')) return formUrl;
        if (siteUrl && !siteUrl.startsWith('blob:')) return siteUrl;
        return '';
      };
      
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
          
          slogan: site.slogan || '',
          tagline: site.tagline || '',
          founding_year: site.founding_year || null,
          team_size: site.team_size || '',
          awards: site.awards || '',
          certifications: site.certifications || '',
          
          featured_products: site.featured_products || [],
          featured_services: site.featured_services || [],
          special_offers: site.special_offers || [],
          testimonials: site.testimonials || [],
          
          whatsapp: site.whatsapp || '',
          phone: site.phone || '',
          email: site.email || '',
          instagram: site.instagram || '',
          facebook: site.facebook || '',
          tiktok: site.tiktok || '',
          youtube: site.youtube || '',
          linkedin: site.linkedin || '',
          website: site.website || '',
          
          address_street: site.address_street || '',
          address_number: site.address_number || '',
          address_complement: site.address_complement || '',
          address_neighborhood: site.address_neighborhood || '',
          address_city: site.address_city || '',
          address_state: site.address_state || '',
          address_zip: site.address_zip || '',
          address_full: addressFull,
          google_maps_embed: site.google_maps_embed || '',
          google_maps_url: site.google_maps_url || '',
          latitude: site.latitude || null,
          longitude: site.longitude || null,
          
          business_hours: site.business_hours,
          
          logo_url: getImageUrl(formData?.logo_url, site.logo_url),
          hero_image_url: getImageUrl(formData?.hero_image_url, site.hero_image_url),
          about_image_url: site.about_image_url || '',
          gallery_images: [
            getImageUrl(formData?.gallery_image_1, site.gallery_images?.[0] || null),
            getImageUrl(formData?.gallery_image_2, site.gallery_images?.[1] || null),
            getImageUrl(formData?.gallery_image_3, site.gallery_images?.[2] || null),
            getImageUrl(formData?.gallery_image_4, site.gallery_images?.[3] || null)
          ].filter(Boolean),
          product_images: site.product_images || [],
          ambient_images: site.ambient_images || [],
          
          images_base64: formData ? {
            logo: formData.logo_base64 ? { data: formData.logo_base64, filename: `${site.slug}-logo.png` } : null,
            hero: formData.hero_image_base64 ? { data: formData.hero_image_base64, filename: `${site.slug}-hero.jpg` } : null,
            gallery: [
              formData.gallery_image_1_base64 ? { data: formData.gallery_image_1_base64, filename: `${site.slug}-gallery-1.jpg` } : null,
              formData.gallery_image_2_base64 ? { data: formData.gallery_image_2_base64, filename: `${site.slug}-gallery-2.jpg` } : null,
              formData.gallery_image_3_base64 ? { data: formData.gallery_image_3_base64, filename: `${site.slug}-gallery-3.jpg` } : null,
              formData.gallery_image_4_base64 ? { data: formData.gallery_image_4_base64, filename: `${site.slug}-gallery-4.jpg` } : null
            ].filter(Boolean)
          } : null,
          
          assets: (() => {
            const sourceAssets = formData?.assets || site.assets || [];
            return sourceAssets.map((asset: any, index: number) => ({
              id: asset.id,
              type: asset.type,
              url: asset.url?.startsWith('blob:') ? '' : (asset.url || ''),
              filename: asset.base64 ? `${site.slug}-${asset.type}-${index + 1}.jpg` : (asset.url ? undefined : `${site.slug}-${asset.type}-${index + 1}.jpg`),
              base64: asset.base64 || undefined,
              metadata: asset.metadata || {},
              displayOrder: asset.displayOrder || index
            }));
          })(),
          
          color_primary: site.color_primary,
          color_secondary: site.color_secondary,
          color_accent: site.color_accent,
          color_background: site.color_background || '#FFFFFF',
          font_primary: site.font_primary || 'Inter',
          font_secondary: site.font_secondary || 'Inter',
          visual_style: site.visual_style || 'moderno',
          
          cta_button_text: site.cta_button_text || '',
          cta_whatsapp_message: site.cta_whatsapp_message || '',
          
          seo_title: site.seo_title || '',
          seo_description: site.seo_description || '',
          seo_keywords: site.seo_keywords || [],
          
          github_owner: site.github_full_name?.split('/')[0] || 'eleveaone',
          github_repo: site.github_full_name?.split('/')[1] || site.slug,
          github_branch: site.github_branch || 'main'
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
