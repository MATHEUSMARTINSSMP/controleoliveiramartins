// Exportar componentes principais
export { CampaignCard } from './CampaignCard';
export { CampaignActions } from './CampaignActions';
export { CampaignMessages } from './CampaignMessages';
export { CampaignFilters } from './CampaignFilters';
export { CampaignDetailsModal } from './CampaignDetailsModal';
export { MessageDetailsModal } from './MessageDetailsModal';
export { EmptyState } from './EmptyState';
export { CampaignCardSkeleton, CampaignListSkeleton, MessageItemSkeleton, MessageListSkeleton } from './LoadingSkeleton';
export { AnalyticsMetrics } from './AnalyticsMetrics';
export { CampaignAnalyticsView } from './CampaignAnalyticsView';
export { CampaignCharts } from './CampaignCharts';
export { CampaignRecommendations } from './CampaignRecommendations';
export * from './useAnalytics';
export * from './useCampaignRecommendations';

// Exportar hooks
export { useCampaigns, useCampaignStats } from './useCampaigns';
export { useCampaignActions } from './useCampaignActions';

// Exportar tipos
export type { WhatsAppCampaign, CampaignStats } from './types';
