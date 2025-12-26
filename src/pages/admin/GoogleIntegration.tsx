import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { useGoogleReviews } from "@/hooks/use-google-reviews";
import { useDebounce } from "@/hooks/use-debounce";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ConnectionStatus,
  ReviewsFilters,
  ReviewsList,
  ReviewsHeader,
  StatsTab,
} from "@/components/google-integration";

interface GoogleIntegrationProps {
  embedded?: boolean;
}

export default function GoogleIntegration({ embedded = false }: GoogleIntegrationProps) {
  const { user, profile } = useAuth();
  const { startAuth, checkStatus, disconnect, getProfileInfo: getProfileInfoFromHook, loading: authLoading } = useGoogleAuth();
  const {
    reviews,
    stats,
    loading: reviewsLoading,
    fetchReviews,
    fetchStats,
    markAsRead,
  } = useGoogleReviews();

  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    expiresAt?: string;
    hasRefreshToken: boolean;
    scopes?: string;
    email?: string;
  } | null>(null);
  const [siteSlug, setSiteSlug] = useState<string>("elevea");
  const [statsPeriod, setStatsPeriod] = useState<string>("30d");
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // Filtros de reviews
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [filterDateRange, setFilterDateRange] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "responded" | "unresponded" | "unread">("all");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const reviewsPerPage = 10;

  // Buscar site_slug do perfil ou loja
  useEffect(() => {
    const fetchSiteSlug = async () => {
      if (!profile?.id) return;

      try {
        const { data: store } = await supabase
          .schema("sistemaretiradas")
          .from("stores")
          .select("slug")
          .eq("admin_id", profile.id)
          .eq("active", true)
          .limit(1)
          .single();

        if (store?.slug) {
          setSiteSlug(store.slug);
        }
      } catch (error) {
        console.error("Erro ao buscar site_slug:", error);
      }
    };

    fetchSiteSlug();
  }, [profile?.id]);

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
        });
        
        if (status.connected) {
          fetchReviews(siteSlug);
          fetchStats(siteSlug, statsPeriod);
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

    if (gmb === "ok" && user?.email && siteSlug) {
      setTimeout(() => {
        checkStatus(siteSlug).then((status) => {
          if (status) {
            setConnectionStatus(status);
            fetchReviews(siteSlug);
            fetchStats(siteSlug, statsPeriod);
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

  const handlePeriodChange = (period: string) => {
    if (!siteSlug) return;
    fetchStats(siteSlug, period);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Integração Google My Business
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Status da Conexão */}
      <ConnectionStatus
        connected={connectionStatus?.connected || false}
        email={connectionStatus?.email}
        scopes={connectionStatus?.scopes}
        authLoading={authLoading}
        onConnect={handleConnect}
        onDisconnect={confirmDisconnect}
        showDisconnectDialog={showDisconnectDialog}
        setShowDisconnectDialog={setShowDisconnectDialog}
      />

      {/* Conteúdo principal - apenas se conectado */}
      {connectionStatus?.connected && (
        <Tabs defaultValue="reviews" className="space-y-4">
          <TabsList>
            <TabsTrigger value="reviews">
              <MessageSquare className="h-4 w-4 mr-2" />
              Reviews
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="h-4 w-4 mr-2" />
              Estatísticas
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
            <StatsTab
              stats={stats}
              statsPeriod={statsPeriod}
              setStatsPeriod={setStatsPeriod}
              loading={reviewsLoading}
              reviews={reviews}
              onRefresh={handleRefresh}
              onPeriodChange={handlePeriodChange}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

