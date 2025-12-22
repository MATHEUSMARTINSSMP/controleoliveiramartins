import type { BusinessType, ContentType, VoiceToneStyle } from "@/lib/site-builder-data";

export interface SiteData {
  id: string;
  slug: string;
  name: string;
  
  business_type: BusinessType;
  segment_id: string;
  segment_name: string;
  area_id: string | null;
  area_name: string | null;
  custom_area: string | null;
  content_type: ContentType;
  voice_tone: VoiceToneStyle;
  
  company_name: string;
  company_description: string | null;
  company_history: string | null;
  mission: string | null;
  vision: string | null;
  company_values: string | null;
  services_description: string | null;
  products_description: string | null;
  differentials: string | null;
  
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  youtube: string | null;
  linkedin: string | null;
  website: string | null;
  
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  address_full: string | null;
  google_maps_url: string | null;
  google_maps_embed: string | null;
  
  business_hours: Record<string, { open: string; close: string; closed?: boolean }>;
  
  logo_url: string | null;
  favicon_url: string | null;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  color_background: string;
  font_primary: string;
  font_secondary: string;
  visual_style: string;
  
  hero_image_url: string | null;
  about_image_url: string | null;
  gallery_images: string[];
  product_images: string[];
  ambient_images: string[];
  
  github_repo_id: number | null;
  github_full_name: string | null;
  github_url: string | null;
  github_branch: string;
  
  netlify_site_id: string | null;
  netlify_site_name: string | null;
  netlify_url: string | null;
  netlify_admin_url: string | null;
  netlify_deploy_hook: string | null;
  
  status: 'draft' | 'generating' | 'published' | 'error' | 'archived';
  current_version: number;
  last_published_at: string | null;
  
  created_at: string;
  updated_at: string;
  created_by: string | null;
  tenant_id: string | null;
  last_reset_at: string | null;
  
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  og_image_url: string | null;
  
  generated_content: {
    hero_title?: string;
    hero_subtitle?: string;
    about_text?: string;
    services_text?: string;
    products_text?: string;
    differentials?: string[];
    cta_text?: string;
  } | null;
}

export interface SiteFormData {
  business_type: BusinessType;
  segment_id: string;
  segment_name: string;
  area_id: string;
  area_name: string;
  custom_area: string;
  content_type: ContentType;
  voice_tone: VoiceToneStyle;
  
  company_name: string;
  company_description: string;
  company_history: string;
  mission: string;
  vision: string;
  company_values: string;
  services_description: string;
  products_description: string;
  differentials: string;
  
  whatsapp: string;
  phone: string;
  email: string;
  instagram: string;
  facebook: string;
  
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  
  business_hours: Record<string, { open: string; close: string; closed?: boolean }>;
  
  color_primary: string;
  color_secondary: string;
  color_accent: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'business-type',
    title: 'Tipo de Negócio',
    description: 'Físico ou Digital?',
    icon: 'Building2'
  },
  {
    id: 'segment',
    title: 'Segmento',
    description: 'Qual seu ramo de atuação?',
    icon: 'Tags'
  },
  {
    id: 'area',
    title: 'Área',
    description: 'Especifique sua área',
    icon: 'Target'
  },
  {
    id: 'details',
    title: 'Detalhes',
    description: 'Informações do negócio',
    icon: 'FileText'
  },
  {
    id: 'contact',
    title: 'Contato',
    description: 'WhatsApp e redes sociais',
    icon: 'Phone'
  },
  {
    id: 'visual',
    title: 'Visual',
    description: 'Cores e estilo',
    icon: 'Palette'
  },
  {
    id: 'review',
    title: 'Revisão',
    description: 'Confirmar e criar',
    icon: 'CheckCircle'
  }
];

export const DEFAULT_FORM_DATA: SiteFormData = {
  business_type: 'fisico',
  segment_id: '',
  segment_name: '',
  area_id: '',
  area_name: '',
  custom_area: '',
  content_type: 'misto',
  voice_tone: 'profissional',
  
  company_name: '',
  company_description: '',
  company_history: '',
  mission: '',
  vision: '',
  company_values: '',
  services_description: '',
  products_description: '',
  differentials: '',
  
  whatsapp: '',
  phone: '',
  email: '',
  instagram: '',
  facebook: '',
  
  address_street: '',
  address_number: '',
  address_complement: '',
  address_neighborhood: '',
  address_city: '',
  address_state: '',
  address_zip: '',
  
  business_hours: {
    monday: { open: '08:00', close: '18:00' },
    tuesday: { open: '08:00', close: '18:00' },
    wednesday: { open: '08:00', close: '18:00' },
    thursday: { open: '08:00', close: '18:00' },
    friday: { open: '08:00', close: '18:00' },
    saturday: { open: '08:00', close: '12:00' },
    sunday: { open: '00:00', close: '00:00', closed: true }
  },
  
  color_primary: '#8B5CF6',
  color_secondary: '#1F2937',
  color_accent: '#10B981'
};

export const BRAZILIAN_STATES = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' }
];

export const WEEKDAYS = [
  { id: 'monday', label: 'Segunda-feira' },
  { id: 'tuesday', label: 'Terça-feira' },
  { id: 'wednesday', label: 'Quarta-feira' },
  { id: 'thursday', label: 'Quinta-feira' },
  { id: 'friday', label: 'Sexta-feira' },
  { id: 'saturday', label: 'Sábado' },
  { id: 'sunday', label: 'Domingo' }
];
