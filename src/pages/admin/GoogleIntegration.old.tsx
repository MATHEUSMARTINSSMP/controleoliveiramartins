import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { useGoogleReviews, GoogleReview } from "@/hooks/use-google-reviews";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ExternalLink, 
  Star, 
  MessageSquare, 
  BarChart3,
  RefreshCw,
  LogOut,
  LogIn
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, MapPin } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface GoogleIntegrationProps {
  embedded?: boolean;
}

export default function GoogleIntegration({ embedded = false }: GoogleIntegrationProps) {
  const { user, profile } = useAuth();
  const { startAuth, checkStatus, disconnect, loading: authLoading } = useGoogleAuth();
  const { 
    reviews, 
    stats, 
    loading: reviewsLoading, 
    fetchReviews, 
    fetchStats, 
    respondToReview 
  } = useGoogleReviews();

  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    expiresAt?: string;
    hasRefreshToken: boolean;
    scopes?: string;
  } | null>(null);
  const [siteSlug, setSiteSlug] = useState<string>("elevea");
  const [selectedReview, setSelectedReview] = useState<GoogleReview | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<string>("30d");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Templates de resposta pré-definidos
  const replyTemplates = [
    { id: "thank_you_5", label: "Agradecimento (5 estrelas)", text: "Obrigado pelo seu feedback positivo! Ficamos muito felizes em saber que você teve uma experiência excelente. Esperamos vê-lo novamente em breve!" },
    { id: "thank_you_4", label: "Agradecimento (4 estrelas)", text: "Obrigado pela sua avaliação! Ficamos contentes em saber que você gostou. Estamos sempre trabalhando para melhorar e adoraríamos ouvir suas sugestões." },
    { id: "apology_3", label: "Desculpas (3 estrelas)", text: "Lamentamos que sua experiência não tenha sido a melhor possível. Gostaríamos muito de conversar com você para entender melhor e melhorar nossos serviços. Entre em contato conosco!" },
    { id: "apology_1_2", label: "Desculpas + Contato (1-2 estrelas)", text: "Lamentamos profundamente que sua experiência não tenha sido positiva. Sua opinião é muito importante para nós. Por favor, entre em contato conosco para que possamos resolver esta situação." },
    { id: "custom", label: "Personalizado", text: "" },
  ];
  
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
        // Tentar buscar da loja associada
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
        setConnectionStatus(status);
        if (status.connected) {
          // Buscar reviews e stats automaticamente se conectado
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
      // Recarregar status após conexão bem-sucedida
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

  const handleDisconnect = async () => {
    if (!siteSlug) return;
    setShowDisconnectDialog(true);
  };

  const confirmDisconnect = async () => {
    if (!siteSlug) return;
    setShowDisconnectDialog(false);
    const success = await disconnect(siteSlug);
    if (success) {
      setConnectionStatus({ connected: false, hasRefreshToken: false });
      setReviews([]);
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
        review.review_date ? format(new Date(review.review_date), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
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

  const handleReply = async () => {
    if (!selectedReview || !replyText.trim() || !siteSlug) return;
    
    // Validações
    if (replyText.length > 4096) {
      toast.error("Resposta muito longa. Máximo 4096 caracteres.");
      return;
    }
    if (replyText.length < 10) {
      toast.error("Resposta muito curta. Mínimo 10 caracteres.");
      return;
    }

    setReplying(true);
    try {
      // Usar accountId e locationId do review se disponível, senão buscar do banco
      const success = await respondToReview(
        siteSlug,
        selectedReview.review_id_external,
        replyText,
        selectedReview.account_id,
        selectedReview.location_id
      );

      if (success) {
        setReplyText("");
        setSelectedReview(null);
        setSelectedTemplate("");
        setShowPreview(false);
      }
    } finally {
      setReplying(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        }`}
      />
    ));
  };

  // Filtrar e ordenar reviews
  const filteredAndSortedReviews = (() => {
    let filtered = [...reviews];

    // Filtro por rating
    if (filterRating !== null) {
      filtered = filtered.filter((r) => r.rating === filterRating);
    }

    // Filtro por data
    if (filterDateRange !== "all") {
      const now = new Date();
      const daysAgo = filterDateRange === "7d" ? 7 : filterDateRange === "30d" ? 30 : filterDateRange === "90d" ? 90 : 365;
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

    // Busca por texto
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
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
          return new Date(b.review_date || 0).getTime() - new Date(a.review_date || 0).getTime();
        case "oldest":
          return new Date(a.review_date || 0).getTime() - new Date(b.review_date || 0).getTime();
        case "highest":
          return b.rating - a.rating;
        case "lowest":
          return a.rating - b.rating;
        default:
          return 0;
      }
    });

    return filtered;
  })();

  // Paginação
  const totalPages = Math.ceil(filteredAndSortedReviews.length / reviewsPerPage);
  const paginatedReviews = filteredAndSortedReviews.slice(
    (currentPage - 1) * reviewsPerPage,
    currentPage * reviewsPerPage
  );

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [filterRating, filterDateRange, filterStatus, searchText, sortBy]);

  const scopesList = connectionStatus?.scopes
    ? connectionStatus.scopes.split(" ").filter((s) => s.trim())
    : [];

  return (
    <div className="space-y-6">
      {/* Status da Conexão */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Integração Google My Business
              </CardTitle>
              <CardDescription>
                Conecte sua conta Google para gerenciar reviews e informações do seu negócio
              </CardDescription>
            </div>
            {connectionStatus?.connected ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="h-3 w-3 mr-1" />
                Desconectado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectionStatus?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">Status da Conexão</p>
                  <p className="text-xs text-muted-foreground">
                    {connectionStatus.expiresAt
                      ? `Expira em ${formatDistanceToNow(new Date(connectionStatus.expiresAt), {
                          addSuffix: true,
                          locale: ptBR,
                        })}`
                      : "Sem data de expiração"}
                  </p>
                  {user?.email && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Conectado como: {user.email}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="h-4 w-4 mr-2" />
                      Desconectar
                    </>
                  )}
                </Button>
                <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desconectar conta Google?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja desconectar sua conta Google? Você precisará conectar novamente para gerenciar reviews e informações do seu negócio.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={confirmDisconnect}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Desconectar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {scopesList.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Escopos Autorizados</p>
                  <div className="flex flex-wrap gap-2">
                    {scopesList.map((scope, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {scope.includes("business.manage")
                          ? "Gerenciar Negócio"
                          : scope.includes("userinfo.email")
                          ? "Email"
                          : scope.includes("userinfo.profile")
                          ? "Perfil"
                          : scope === "openid"
                          ? "OpenID"
                          : scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {!connectionStatus.hasRefreshToken && (
                <Alert variant="warning">
                  <AlertDescription>
                    Sua conexão não possui refresh token. Você precisará reconectar quando o token expirar.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Alert>
                <AlertDescription>
                  Conecte sua conta Google para começar a gerenciar reviews e informações do seu negócio no Google My Business.
                </AlertDescription>
              </Alert>
              <Button
                onClick={handleConnect}
                disabled={authLoading}
                className="w-full"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Conectar com Google
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Reviews do Google</h3>
                <p className="text-sm text-muted-foreground">
                  Gerencie e responda às avaliações dos seus clientes
                </p>
              </div>
              <div className="flex items-center gap-2">
                {filteredAndSortedReviews.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    disabled={reviewsLoading}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={reviewsLoading}
                >
                  {reviewsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Atualizar
                    </>
                  )}
                </Button>
              </div>
            </div>

            {reviewsLoading && reviews.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ) : filteredAndSortedReviews.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {reviews.length === 0
                      ? "Nenhum review encontrado"
                      : "Nenhum review corresponde aos filtros selecionados"}
                  </p>
                  {reviews.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        setFilterRating(null);
                        setFilterDateRange("all");
                        setFilterStatus("all");
                        setSearchText("");
                      }}
                    >
                      Limpar filtros
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedReviews.map((review) => (
                  <Card key={review.review_id_external}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {renderStars(review.rating)}
                              <span className="text-sm font-medium">
                                {review.author_name || "Anônimo"}
                              </span>
                              {review.review_date && (
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(review.review_date), {
                                    addSuffix: true,
                                    locale: ptBR,
                                  })}
                                </span>
                              )}
                            </div>
                            {review.comment && (
                              <p className="text-sm text-muted-foreground mb-2 whitespace-pre-wrap">
                                {review.comment}
                              </p>
                            )}
                            {review.location_id && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(review.location_id)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
                              >
                                <MapPin className="h-3 w-3" />
                                Ver no Google Maps
                              </a>
                            )}
                            {review.reply && (
                              <div className="mt-3 p-3 bg-muted rounded-md">
                                <p className="text-xs font-medium mb-1">Sua resposta:</p>
                                <p className="text-sm">{review.reply}</p>
                              </div>
                            )}
                            {!review.is_read && (
                              <Badge variant="outline" className="mt-2 text-xs">
                                Nova
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!review.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await markAsRead(siteSlug, review.review_id_external);
                              }}
                            >
                              Marcar como lida
                            </Button>
                          )}
                          {!review.reply && (
                          <Dialog
                            onOpenChange={(open) => {
                              if (!open) {
                                setReplyText("");
                                setSelectedTemplate("");
                                setSelectedReview(null);
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedReview(review);
                                  setReplyText("");
                                  setSelectedTemplate("");
                                }}
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Responder
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Responder Review</DialogTitle>
                                <DialogDescription>
                                  Escreva uma resposta profissional para este review. Sua resposta será pública.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Review</Label>
                                  <div className="mt-1 p-3 bg-muted rounded-md">
                                    <div className="flex items-center gap-2 mb-2">
                                      {renderStars(review.rating)}
                                      <span className="text-sm font-medium">
                                        {review.author_name || "Anônimo"}
                                      </span>
                                    </div>
                                    {review.comment && (
                                      <p className="text-sm">{review.comment}</p>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <Label htmlFor="reply">Sua Resposta</Label>
                                    <span className={`text-xs ${replyText.length > 4096 ? 'text-red-500' : replyText.length > 3500 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                                      {replyText.length} / 4096 caracteres
                                    </span>
                                  </div>
                                  <div className="mb-2">
                                    <Label htmlFor="template" className="text-xs text-muted-foreground">Templates rápidos:</Label>
                                    <select
                                      id="template"
                                      value={selectedTemplate}
                                      onChange={(e) => {
                                        const template = replyTemplates.find(t => t.id === e.target.value);
                                        if (template && template.id !== "custom") {
                                          setReplyText(template.text);
                                        }
                                        setSelectedTemplate(e.target.value);
                                      }}
                                      className="mt-1 w-full px-3 py-2 text-sm border rounded-md"
                                    >
                                      <option value="">Selecione um template...</option>
                                      {replyTemplates.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <Textarea
                                    id="reply"
                                    value={replyText}
                                    onChange={(e) => {
                                      const text = e.target.value;
                                      if (text.length <= 4096) {
                                        setReplyText(text);
                                      }
                                    }}
                                    placeholder="Obrigado pelo seu feedback..."
                                    rows={4}
                                    className="mt-1"
                                    maxLength={4096}
                                  />
                                  {replyText.length < 10 && replyText.length > 0 && (
                                    <p className="text-xs text-yellow-600 mt-1">Resposta muito curta. Recomendamos pelo menos 10 caracteres.</p>
                                  )}
                                  {replyText.length > 4096 && (
                                    <p className="text-xs text-red-600 mt-1">Resposta muito longa. Máximo 4096 caracteres.</p>
                                  )}
                                </div>
                                {showPreview && replyText.trim() && (
                                  <div className="mt-4 p-4 bg-muted rounded-md border">
                                    <p className="text-sm font-medium mb-2">Preview da Resposta:</p>
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 mb-2">
                                        {selectedReview && renderStars(selectedReview.rating)}
                                        <span className="text-sm font-medium">
                                          {selectedReview?.author_name || "Anônimo"}
                                        </span>
                                      </div>
                                      <p className="text-sm whitespace-pre-wrap">{replyText}</p>
                                    </div>
                                  </div>
                                )}
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setReplyText("");
                                      setSelectedReview(null);
                                      setSelectedTemplate("");
                                      setShowPreview(false);
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                  {replyText.trim() && replyText.length >= 10 && replyText.length <= 4096 && (
                                    <Button
                                      variant="outline"
                                      onClick={() => setShowPreview(!showPreview)}
                                    >
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      {showPreview ? "Ocultar Preview" : "Ver Preview"}
                                    </Button>
                                  )}
                                  <Button
                                    onClick={handleReply}
                                    disabled={!replyText.trim() || replying || replyText.length > 4096 || replyText.length < 10}
                                  >
                                    {replying ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Enviando...
                                      </>
                                    ) : (
                                      "Enviar Resposta"
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  ))}
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <div className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="w-8 h-8 p-0"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Próxima
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Tab: Estatísticas */}
          <TabsContent value="stats" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Estatísticas de Reviews</h3>
                <p className="text-sm text-muted-foreground">
                  Análise de performance das suas avaliações
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={statsPeriod}
                  onChange={(e) => {
                    setStatsPeriod(e.target.value);
                    fetchStats(siteSlug, e.target.value);
                  }}
                  className="px-3 py-1.5 text-sm border rounded-md"
                >
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                  <option value="90d">Últimos 90 dias</option>
                  <option value="1y">Último ano</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchStats(siteSlug, statsPeriod)}
                  disabled={reviewsLoading}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {stats ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total de Reviews</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalReviews}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avaliação Média</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold">{stats.averageRating.toFixed(1)}</div>
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.responseRate.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.repliedReviews} de {stats.totalReviews} respondidos
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Período</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-medium">
                      {stats.period === "7d"
                        ? "7 dias"
                        : stats.period === "30d"
                        ? "30 dias"
                        : stats.period === "90d"
                        ? "90 dias"
                        : "1 ano"}
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2 lg:col-span-4">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Distribuição de Avaliações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[5, 4, 3, 2, 1].map((rating) => {
                        const count = stats.ratingDistribution[rating as keyof typeof stats.ratingDistribution];
                        const percentage =
                          stats.totalReviews > 0
                            ? (count / stats.totalReviews) * 100
                            : 0;
                        return (
                          <div key={rating} className="flex items-center gap-2">
                            <div className="flex items-center gap-1 w-16">
                              <span className="text-sm font-medium">{rating}</span>
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            </div>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-yellow-400 transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground w-12 text-right">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Gráfico de Pizza - Distribuição de Ratings */}
                <Card className="md:col-span-2 lg:col-span-4">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Distribuição de Ratings (Gráfico)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "5 estrelas", value: stats.ratingDistribution[5], color: "#10b981" },
                            { name: "4 estrelas", value: stats.ratingDistribution[4], color: "#3b82f6" },
                            { name: "3 estrelas", value: stats.ratingDistribution[3], color: "#f59e0b" },
                            { name: "2 estrelas", value: stats.ratingDistribution[2], color: "#ef4444" },
                            { name: "1 estrela", value: stats.ratingDistribution[1], color: "#dc2626" },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[
                            { name: "5 estrelas", value: stats.ratingDistribution[5], color: "#10b981" },
                            { name: "4 estrelas", value: stats.ratingDistribution[4], color: "#3b82f6" },
                            { name: "3 estrelas", value: stats.ratingDistribution[3], color: "#f59e0b" },
                            { name: "2 estrelas", value: stats.ratingDistribution[2], color: "#ef4444" },
                            { name: "1 estrela", value: stats.ratingDistribution[1], color: "#dc2626" },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Gráfico de Barras - Distribuição de Ratings */}
                <Card className="md:col-span-2 lg:col-span-4">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Distribuição de Ratings (Barras)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          { rating: "5 ⭐", count: stats.ratingDistribution[5], color: "#10b981" },
                          { rating: "4 ⭐", count: stats.ratingDistribution[4], color: "#3b82f6" },
                          { rating: "3 ⭐", count: stats.ratingDistribution[3], color: "#f59e0b" },
                          { rating: "2 ⭐", count: stats.ratingDistribution[2], color: "#ef4444" },
                          { rating: "1 ⭐", count: stats.ratingDistribution[1], color: "#dc2626" },
                        ]}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="rating" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#3b82f6">
                          {[
                            { rating: "5 ⭐", count: stats.ratingDistribution[5], color: "#10b981" },
                            { rating: "4 ⭐", count: stats.ratingDistribution[4], color: "#3b82f6" },
                            { rating: "3 ⭐", count: stats.ratingDistribution[3], color: "#f59e0b" },
                            { rating: "2 ⭐", count: stats.ratingDistribution[2], color: "#ef4444" },
                            { rating: "1 ⭐", count: stats.ratingDistribution[1], color: "#dc2626" },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {reviewsLoading ? "Carregando estatísticas..." : "Nenhuma estatística disponível"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

