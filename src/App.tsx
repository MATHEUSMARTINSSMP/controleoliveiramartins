import { lazy, Suspense, ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import {
  SkeletonLojaDashboard,
  SkeletonColaboradoraDashboard,
  SkeletonAdminDashboard,
  LoadingSpinner,
} from "@/components/ui/skeleton-loaders";

function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(() =>
    componentImport().catch((error) => {
      console.error("Chunk load failed, attempting reload...", error);
      const hasReloaded = sessionStorage.getItem("chunk_reload_attempted");
      if (!hasReloaded) {
        sessionStorage.setItem("chunk_reload_attempted", "true");
        window.location.reload();
      }
      sessionStorage.removeItem("chunk_reload_attempted");
      return { default: (() => null) as unknown as T };
    })
  );
}

const Index = lazyWithRetry(() => import("./pages/Index"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const AdminDashboard = lazyWithRetry(() => import("./pages/AdminDashboard"));
const ColaboradoraDashboard = lazyWithRetry(() => import("./pages/ColaboradoraDashboard"));
const NovaCompra = lazyWithRetry(() => import("./pages/NovaCompra"));
const NovoAdiantamento = lazyWithRetry(() => import("./pages/NovoAdiantamento"));
const Adiantamentos = lazyWithRetry(() => import("./pages/Adiantamentos"));
const SolicitarAdiantamento = lazyWithRetry(() => import("./pages/SolicitarAdiantamento"));
const Lancamentos = lazyWithRetry(() => import("./pages/Lancamentos"));
const Relatorios = lazyWithRetry(() => import("./pages/Relatorios"));
const Colaboradores = lazyWithRetry(() => import("./pages/Colaboradores"));
const LojaDashboard = lazyWithRetry(() => import("./pages/LojaDashboard"));
const MetasManagement = lazyWithRetry(() => import("./components/MetasManagement"));
const BonusManagement = lazyWithRetry(() => import("./components/BonusManagement"));
const BenchmarksManagement = lazyWithRetry(() => import("./pages/BenchmarksManagement"));
const ERPIntegrationsConfig = lazyWithRetry(() => import("./pages/ERPIntegrationsConfig"));
const ERPConfig = lazyWithRetry(() => import("./pages/dev/ERPConfig"));
const SuperAdmin = lazyWithRetry(() => import("./pages/dev/SuperAdmin"));
const DevLogin = lazyWithRetry(() => import("./pages/dev/DevLogin"));
const ERPLogin = lazyWithRetry(() => import("./pages/erp/ERPLogin"));
const ERPDashboard = lazyWithRetry(() => import("./pages/erp/ERPDashboard"));
const CategoryReports = lazyWithRetry(() => import("./pages/erp/CategoryReports"));
const ProductSalesIntelligence = lazyWithRetry(() => import("./pages/erp/ProductSalesIntelligence"));
const CustomerIntelligence = lazyWithRetry(() => import("./pages/erp/CustomerIntelligence"));
const CashbackManagement = lazyWithRetry(() => import("./pages/erp/CashbackManagement"));
const GestaoDRE = lazyWithRetry(() => import("./pages/admin/GestaoDRE"));
const Seed = lazyWithRetry(() => import("./pages/Seed"));
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"));
const Landing = lazyWithRetry(() => import("./pages/Landing"));
const LandingPage = lazyWithRetry(() => import("./pages/LandingPage"));
const Onboarding = lazyWithRetry(() => import("./pages/Onboarding"));
const CaktoAccess = lazyWithRetry(() => import("./pages/CaktoAccess"));
const CaktoAccessTest = lazyWithRetry(() => import("./pages/CaktoAccessTest"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const ERPVendorMapping = lazyWithRetry(() => import("./pages/ERPVendorMapping"));
const WhatsAppBulkSend = lazyWithRetry(() => import("./pages/admin/WhatsAppBulkSend"));
const WhatsAppCampaigns = lazyWithRetry(() => import("./pages/admin/WhatsAppCampaigns"));
const WhatsAppAnalytics = lazyWithRetry(() => import("./pages/admin/WhatsAppAnalytics"));
const Campanhas = lazyWithRetry(() => import("./pages/admin/Campanhas"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <div className="flex flex-col items-center gap-4">
        <img src="/elevea.png" alt="EleveaOne" className="h-12 w-auto animate-pulse" />
        <LoadingSpinner size="lg" />
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="elevea-ui-theme">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary level="page">
              <Routes>
                <Route path="/" element={<Suspense fallback={<PageLoader />}><Auth /></Suspense>} />
                <Route path="/home" element={<Suspense fallback={<PageLoader />}><Index /></Suspense>} />
                <Route path="/landing" element={<Suspense fallback={<PageLoader />}><Landing /></Suspense>} />
                <Route path="/landingteste" element={<Suspense fallback={<PageLoader />}><LandingPage /></Suspense>} />
                <Route path="/seed" element={<Suspense fallback={<PageLoader />}><Seed /></Suspense>} />
                <Route path="/forgot-password" element={<Suspense fallback={<PageLoader />}><ForgotPassword /></Suspense>} />
                <Route path="/obrigado" element={<Suspense fallback={<PageLoader />}><Onboarding /></Suspense>} />
                <Route path="/acesso" element={<Suspense fallback={<PageLoader />}><CaktoAccess /></Suspense>} />
                <Route path="/acesso-test" element={<Suspense fallback={<PageLoader />}><CaktoAccessTest /></Suspense>} />

                <Route path="/admin" element={<Suspense fallback={<SkeletonAdminDashboard />}><AdminDashboard /></Suspense>} />
                <Route path="/admin/nova-compra" element={<Suspense fallback={<PageLoader />}><NovaCompra /></Suspense>} />
                <Route path="/admin/novo-adiantamento" element={<Suspense fallback={<PageLoader />}><NovoAdiantamento /></Suspense>} />
                <Route path="/admin/adiantamentos" element={<Suspense fallback={<PageLoader />}><Adiantamentos /></Suspense>} />
                <Route path="/admin/lancamentos" element={<Suspense fallback={<PageLoader />}><Lancamentos /></Suspense>} />
                <Route path="/admin/relatorios" element={<Suspense fallback={<PageLoader />}><Relatorios /></Suspense>} />
                <Route path="/admin/colaboradores" element={<Suspense fallback={<PageLoader />}><Colaboradores /></Suspense>} />
                <Route path="/admin/metas" element={<Suspense fallback={<PageLoader />}><MetasManagement /></Suspense>} />
                <Route path="/admin/bonus" element={<Suspense fallback={<PageLoader />}><BonusManagement /></Suspense>} />
                <Route path="/admin/benchmarks" element={<Suspense fallback={<PageLoader />}><BenchmarksManagement /></Suspense>} />
                <Route path="/admin/dre" element={<Suspense fallback={<PageLoader />}><GestaoDRE /></Suspense>} />
                <Route path="/admin/erp-integrations" element={<Suspense fallback={<PageLoader />}><ERPIntegrationsConfig /></Suspense>} />
                <Route path="/admin/erp-mapping" element={<Suspense fallback={<PageLoader />}><ERPVendorMapping /></Suspense>} />
                <Route path="/admin/campanhas" element={<Suspense fallback={<PageLoader />}><Campanhas /></Suspense>} />
                <Route path="/admin/whatsapp-bulk-send" element={<Suspense fallback={<PageLoader />}><WhatsAppBulkSend /></Suspense>} />
                <Route path="/admin/whatsapp-campaigns" element={<Suspense fallback={<PageLoader />}><WhatsAppCampaigns /></Suspense>} />
                <Route path="/admin/whatsapp-analytics" element={<Suspense fallback={<PageLoader />}><WhatsAppAnalytics /></Suspense>} />

                <Route path="/dev/login" element={<Suspense fallback={<PageLoader />}><DevLogin /></Suspense>} />
                <Route path="/dev/erp-config" element={<Suspense fallback={<PageLoader />}><ERPConfig /></Suspense>} />
                <Route path="/dev/superadm" element={<Suspense fallback={<PageLoader />}><SuperAdmin /></Suspense>} />

                <Route path="/erp/login" element={<Suspense fallback={<PageLoader />}><ERPLogin /></Suspense>} />
                <Route path="/erp/dashboard" element={<Suspense fallback={<PageLoader />}><ERPDashboard /></Suspense>} />
                <Route path="/erp/category-reports" element={<Suspense fallback={<PageLoader />}><CategoryReports /></Suspense>} />
                <Route path="/erp/product-intelligence" element={<Suspense fallback={<PageLoader />}><ProductSalesIntelligence /></Suspense>} />
                <Route path="/erp/customer-intelligence" element={<Suspense fallback={<PageLoader />}><CustomerIntelligence /></Suspense>} />
                <Route path="/erp/cashback-management" element={<Suspense fallback={<PageLoader />}><CashbackManagement /></Suspense>} />

                <Route path="/loja" element={<Suspense fallback={<SkeletonLojaDashboard />}><LojaDashboard /></Suspense>} />
                <Route path="/me" element={<Suspense fallback={<SkeletonColaboradoraDashboard />}><ColaboradoraDashboard /></Suspense>} />
                <Route path="/solicitar-adiantamento" element={<Suspense fallback={<PageLoader />}><SolicitarAdiantamento /></Suspense>} />

                <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
