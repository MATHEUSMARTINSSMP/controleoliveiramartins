import type { SiteData } from "@/components/admin/site-builder/types";
import { generateBaseHTML, type SiteContent } from "./base-template";

function parseStringToArray(value: string | null | undefined): string[] | undefined {
  if (!value) return undefined;
  return value.split('\n').map(s => s.trim()).filter(Boolean);
}

export function siteDataToContent(site: SiteData): SiteContent {
  const address = site.business_type === 'fisico' && site.address_street ? {
    street: site.address_street,
    number: site.address_number || '',
    complement: site.address_complement || undefined,
    neighborhood: site.address_neighborhood || '',
    city: site.address_city || '',
    state: site.address_state || '',
    zip: site.address_zip || undefined
  } : undefined;

  return {
    company_name: site.company_name || site.name,
    tagline: site.generated_content?.hero_title || undefined,
    description: site.company_description || site.generated_content?.hero_subtitle || undefined,
    about_text: site.generated_content?.about_text || site.company_history || undefined,
    services_text: site.services_description || site.generated_content?.services_text || undefined,
    products_text: site.products_description || site.generated_content?.products_text || undefined,
    differentials: parseStringToArray(site.differentials) || site.generated_content?.differentials || undefined,
    
    whatsapp: site.whatsapp || undefined,
    phone: site.phone || undefined,
    email: site.email || undefined,
    instagram: site.instagram || undefined,
    facebook: site.facebook || undefined,
    
    address,
    business_hours: site.business_hours as Record<string, { open: string; close: string } | null> || undefined,
    
    colors: {
      primary: site.color_primary || '#8B5CF6',
      secondary: site.color_secondary || '#1F2937',
      accent: site.color_accent || '#10B981',
      background: site.color_background || '#FFFFFF'
    },
    
    segment_name: site.segment_name || 'Negócio',
    area_name: site.area_name || undefined,
    business_type: site.business_type as 'fisico' | 'digital',
    content_type: site.content_type as 'produtos' | 'servicos' | 'misto',
    voice_tone: site.voice_tone || 'profissional'
  };
}

export function renderSiteHTML(site: SiteData): string {
  const content = siteDataToContent(site);
  return generateBaseHTML(content);
}

export function downloadHTML(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
