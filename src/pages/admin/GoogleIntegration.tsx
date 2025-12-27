import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { useGoogleReviews } from "@/hooks/use-google-reviews";
import { useDebounce } from "@/hooks/use-debounce";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BarChart3, MessageSquare, MapPin, Activity, Settings, RefreshCw, Image as ImageIcon, MessageCircleQuestion, Search, Store } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ConnectionStatus,
  ReviewsFilters,
  ReviewsList,
  ReviewsHeader,
  GoogleLocations,
  LocationMapping,
  ProfileHealth,
  GoogleNotifications,
  GoogleSettings
} from "@/components/google-integration";
import { GoogleStats } from "@/components/google-integration/GoogleStats";
import { GooglePostsManager } from "@/components/google-integration/posts/GooglePostsManager";
import { MediaManager } from "@/components/google-integration/media/MediaManager";
import { QuestionsManager } from "@/components/google-integration/questions/QuestionsManager";
import { useGoogleSync } from "@/hooks/use-google-sync";
import { Button } from "@/components/ui/button";

interface GoogleIntegrationProps {
  embedded?: boolean;
}

export default function GoogleIntegration({ embedded = false }: GoogleIntegrationProps) {
  const { user, profile } = useAuth();
  const { startAuth, checkStatus, disconnect, getProfileInfo: getProfileInfoFromHook, loading: authLoading } = useGoogleAuth();
  const {
    reviews,
    loading: reviewsLoading,
    fetchReviews,
    fetchStats,
    markAsRead,
    markAllAsRead,
    unreadCount,
    fetchUnreadCount,
  } = useGoogleReviews();

  const { syncReviews, syncing, getLastSyncLabel } = useGoogleSync();

  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    expiresAt?: string;
    hasRefreshToken: boolean;
    scopes?: string;
    email?: string;
    profilePictureUrl?: string;
  } | null>(null);
  const [stores, setStores] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [siteSlug, setSiteSlug] = useState<string>("elevea");
  const [statsPeriod, setStatsPeriod] = useState<string>("30d");
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // Filtros de reviews
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [filterDateRange, setFilterDateRange] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "responded" | "unresponded" | "unread">("all");
  const [searchText, setSearchText] = useState("");
  const debouncedSearchText = useDebounce(searchText, 300);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const reviewsPerPage = 10;

  // Buscar lojas do admin
  useEffect(() => {
    const fetchStores = async () => {
      if (!profile?.id) return;

      try {
        const { data: storesData, error } = await supabase
          .schema("sistemaretiradas")
          .from("stores")
          .select("id, name, site_slug")
          .eq("admin_id", profile.id)
          .eq("active", true)
          .order("name");

        if (error) throw error;

        if (storesData && storesData.length > 0) {
          // Mapear site_slug para slug para manter compatibilidade
          const mappedStores = storesData.map(store => ({
            id: store.id,
            name: store.name,
            slug: store.site_slug || store.id,
          }));
          setStores(mappedStores);
          // Se não tem loja selecionada, selecionar a primeira
          if (!selectedStoreId) {
            setSelectedStoreId(mappedStores[0].id);
            setSiteSlug(mappedStores[0].slug || mappedStores[0].id);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar lojas:", error);
        toast.error("Erro ao carregar lojas");
      }
    };

    fetchStores();
  }, [profile?.id]);

  // Atualizar siteSlug quando loja selecionada mudar
  useEffect(() => {
    if (selectedStoreId && stores.length > 0) {
      const selectedStore = stores.find(s => s.id === selectedStoreId);
      if (selectedStore) {
        // selectedStore.slug já foi mapeado de site_slug
        setSiteSlug(selectedStore.slug || selectedStore.id);
      }
    }
  }, [selectedStoreId, stores]);

  // Verificar status da conexão
  useEffect(() => {
    if (!user?.email || !siteSlug) return;

    const check = async () => {
      const status = await checkStatus(siteSlug);
      if (status) {
        // Buscar email do usuário
        const profileInfo = await getProfileInfoFromHook();

        setConnectionStatus({
          ...status,
          email: profileInfo?.email,
          profilePictureUrl: status.profilePictureUrl,
        });

        if (status.connected) {
          fetchReviews(siteSlug);
          fetchStats(siteSlug, statsPeriod);
          fetchUnreadCount(siteSlug);
        }
      }
    };

    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, siteSlug]);

  // Verificar se veio do callback do Google
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const gmb = urlParams.get("gmb");
    const error = urlParams.get("error");

    if (error) {
      if (error === "access_denied") {
        toast.error("Acesso negado pelo usuário.");
      } else {
        toast.error(`Erro na autenticação: ${error}`);
      }
      // Limpar URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (gmb === "ok" && user?.email && siteSlug) {
      setTimeout(() => {
        checkStatus(siteSlug).then((status) => {
          if (status) {
            setConnectionStatus({
              ...status,
              email: user.email, // Fallback
            });
            fetchReviews(siteSlug);
            fetchStats(siteSlug, statsPeriod);
            fetchUnreadCount(siteSlug);

            // Limpar URL
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        });
      }, 2000);
    }
  }, [user?.email, siteSlug, checkStatus, fetchReviews, fetchStats, statsPeriod]);

  const handleConnect = async () => {
    if (!user?.email || !siteSlug) return;
    await startAuth(siteSlug);
  };

  const confirmDisconnect = async () => {
    if (!siteSlug) return;
    setShowDisconnectDialog(false);
    const success = await disconnect(siteSlug);
    if (success) {
      setConnectionStatus({ connected: false, hasRefreshToken: false });
    }
  };

  const handleRefresh = async () => {
    if (!siteSlug) return;
    await fetchReviews(siteSlug);
    await fetchStats(siteSlug, statsPeriod);
    await fetchUnreadCount(siteSlug);
  };

  const handleExportCSV = () => {
    if (filteredAndSortedReviews.length === 0) {
      toast.error("Nenhum review para exportar");
      return;
    }

    const headers = {
      author_name: "Autor",
      rating: "Avaliação",
      comment: "Comentário",
      review_date: "Data",
      reply: "Resposta",
      is_read: "Lida",
    };

    const csvHeaders = Object.values(headers).join(",");
    const csvRows = filteredAndSortedReviews.map((review) => {
      const row = [
        `"${(review.author_name || "Anônimo").replace(/"/g, '""')}"`,
        review.rating.toString(),
        `"${(review.comment || "").replace(/"/g, '""')}"`,
        review.review_date
          ? format(new Date(review.review_date), "dd/MM/yyyy HH:mm", { locale: ptBR })
          : "",
        `"${(review.reply || "").replace(/"/g, '""')}"`,
        review.is_read ? "Sim" : "Não",
      ];
      return row.join(",");
    });

    const csvContent = [csvHeaders, ...csvRows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `google_reviews_${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Reviews exportados com sucesso");
  };

  // Filtrar e ordenar reviews
  const filteredAndSortedReviews = useMemo(() => {
    let filtered = [...reviews];

    // Filtro por rating
    if (filterRating !== null) {
      filtered = filtered.filter((r) => r.rating === filterRating);
    }

    // Filtro por data
    if (filterDateRange !== "all") {
      const now = new Date();
      const daysAgo =
        filterDateRange === "7d"
          ? 7
          : filterDateRange === "30d"
            ? 30
            : filterDateRange === "90d"
              ? 90
              : 365;
      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((r) => {
        if (!r.review_date) return false;
        return new Date(r.review_date) >= cutoffDate;
      });
    }

    // Filtro por status
    if (filterStatus === "responded") {
      filtered = filtered.filter((r) => r.reply && r.reply.trim().length > 0);
    } else if (filterStatus === "unresponded") {
      filtered = filtered.filter((r) => !r.reply || r.reply.trim().length === 0);
    } else if (filterStatus === "unread") {
      filtered = filtered.filter((r) => !r.is_read);
    }

    // Busca por texto (usando valor com debounce)
    if (debouncedSearchText.trim()) {
      const searchLower = debouncedSearchText.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.comment?.toLowerCase().includes(searchLower) ||
          r.author_name?.toLowerCase().includes(searchLower) ||
          r.reply?.toLowerCase().includes(searchLower)
      );
    }

    // Ordenação
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (
            new Date(b.review_date || 0).getTime() -
            new Date(a.review_date || 0).getTime()
          );
        case "oldest":
          return (
            new Date(a.review_date || 0).getTime() -
            new Date(b.review_date || 0).getTime()
          );
        case "highest":
          return b.rating - a.rating;
        case "lowest":
          return a.rating - b.rating;
        default:
          return 0;
      }
    });

    return filtered;
  }, [reviews, filterRating, filterDateRange, filterStatus, debouncedSearchText, sortBy]);

  // Paginação
  const totalPages = Math.ceil(filteredAndSortedReviews.length / reviewsPerPage);
  const paginatedReviews = filteredAndSortedReviews.slice(
    (currentPage - 1) * reviewsPerPage,
    currentPage * reviewsPerPage
  );

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [filterRating, filterDateRange, filterStatus, debouncedSearchText, sortBy]);

  const hasFilters =
    filterRating !== null ||
    filterDateRange !== "all" ||
    filterStatus !== "all" ||
    searchText.trim() !== "";

  const handleClearFilters = () => {
    setFilterRating(null);
    setFilterDateRange("all");
    setFilterStatus("all");
    setSearchText("");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Integração Google My Business
            </div>
            {connectionStatus?.connected && (
              <GoogleNotifications
                unreadCount={unreadCount}
                reviews={reviews}
                onMarkAllAsRead={() => siteSlug && markAllAsRead(siteSlug)}
                onMarkAsRead={(reviewId) => siteSlug && markAsRead(siteSlug, reviewId)}
              />
            )}
            {connectionStatus?.connected && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline-block">
                  {getLastSyncLabel()}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await syncReviews();
                    handleRefresh();
                  }}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Sincronizando..." : "Sincronizar"}
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Seletor de Loja */}
      {stores.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Selecionar Loja
            </CardTitle>
            <CardDescription>
              Escolha qual loja você deseja gerenciar no Google My Business
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="store-select">Loja</Label>
              <Select
                value={selectedStoreId}
                onValueChange={(value) => setSelectedStoreId(value)}
              >
                <SelectTrigger id="store-select">
                  <SelectValue placeholder="Selecione uma loja" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status da Conexão */}
      <ConnectionStatus
        connected={connectionStatus?.connected || false}
        email={connectionStatus?.email}
        scopes={connectionStatus?.scopes}
        profilePicture={connectionStatus?.profilePictureUrl}
        authLoading={authLoading}
        onConnect={handleConnect}
        onDisconnect={confirmDisconnect}
        showDisconnectDialog={showDisconnectDialog}
        setShowDisconnectDialog={setShowDisconnectDialog}
      />

      {/* Mapeamento de Locations (quando há múltiplas locations e está conectado) */}
      {connectionStatus?.connected && user?.email && (
        <LocationMapping
          customerId={user.email}
          siteSlug={siteSlug}
          onMappingComplete={() => {
            // Recarregar dados após mapeamento
            if (siteSlug) {
              fetchReviews(siteSlug);
              fetchStats(siteSlug, statsPeriod);
            }
          }}
        />
      )}

      {/* Conteúdo principal - apenas se conectado */}
      {connectionStatus?.connected && (
        <Tabs defaultValue="reviews" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="reviews">
              <MessageSquare className="h-4 w-4 mr-2" />
              Reviews
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="h-4 w-4 mr-2" />
              Estatísticas
            </TabsTrigger>
            <TabsTrigger value="locations">
              <MapPin className="h-4 w-4 mr-2" />
              Locais
            </TabsTrigger>
            <TabsTrigger value="health">
              <Activity className="h-4 w-4 mr-2" />
              Saúde do Perfil
            </TabsTrigger>
            <TabsTrigger value="posts">
              <MessageSquare className="h-4 w-4 mr-2" />
              Postagens
            </TabsTrigger>
            <TabsTrigger value="media">
              <ImageIcon className="h-4 w-4 mr-2" />
              Mídias
            </TabsTrigger>
            <TabsTrigger value="questions">
              <MessageCircleQuestion className="h-4 w-4 mr-2" />
              Perguntas
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </TabsTrigger>
          </TabsList>

          {/* Tab: Reviews */}
          <TabsContent value="reviews" className="space-y-4">
            <ReviewsHeader
              reviewsCount={filteredAndSortedReviews.length}
              loading={reviewsLoading}
              reviews={filteredAndSortedReviews}
              onExport={handleExportCSV}
              onRefresh={handleRefresh}
            />

            <ReviewsFilters
              searchText={searchText}
              setSearchText={setSearchText}
              filterRating={filterRating}
              setFilterRating={setFilterRating}
              filterDateRange={filterDateRange}
              setFilterDateRange={setFilterDateRange}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              sortBy={sortBy}
              setSortBy={setSortBy}
              hasFilters={hasFilters}
              onClearFilters={handleClearFilters}
            />

            <ReviewsList
              reviews={reviews}
              paginatedReviews={paginatedReviews}
              currentPage={currentPage}
              totalPages={totalPages}
              reviewsPerPage={reviewsPerPage}
              loading={reviewsLoading}
              siteSlug={siteSlug}
              onPageChange={setCurrentPage}
              onMarkAsRead={markAsRead}
              hasFilters={hasFilters}
              onClearFilters={handleClearFilters}
            />
          </TabsContent>

          {/* Tab: Estatísticas */}
          <TabsContent value="stats">
            <GoogleStats siteSlug={siteSlug} />
          </TabsContent>

          {/* Tab: Locations */}
          <TabsContent value="locations">
            <GoogleLocations siteSlug={siteSlug} />
          </TabsContent>

          {/* Tab: Health */}
          <TabsContent value="health">
            <ProfileHealth siteSlug={siteSlug} />
          </TabsContent>

          {/* Tab: Postagens */}
          <TabsContent value="posts">
            <GooglePostsManager locationId={reviews[0]?.location_id || undefined} />
          </TabsContent>

          {/* Tab: Mídias */}
          <TabsContent value="media">
            <MediaManager siteSlug={siteSlug} />
          </TabsContent>

          {/* Tab: Perguntas */}
          <TabsContent value="questions">
            <QuestionsManager />
          </TabsContent>

          {/* Tab: Configurações */}
          <TabsContent value="settings">
            <GoogleSettings siteSlug={siteSlug} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
