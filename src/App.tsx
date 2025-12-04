import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  SkeletonLojaDashboard,
  SkeletonColaboradoraDashboard,
  SkeletonAdminDashboard,
  LoadingSpinner,
} from "@/components/ui/skeleton-loaders";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ColaboradoraDashboard = lazy(() => import("./pages/ColaboradoraDashboard"));
const NovaCompra = lazy(() => import("./pages/NovaCompra"));
const NovoAdiantamento = lazy(() => import("./pages/NovoAdiantamento"));
const Adiantamentos = lazy(() => import("./pages/Adiantamentos"));
const SolicitarAdiantamento = lazy(() => import("./pages/SolicitarAdiantamento"));
const Lancamentos = lazy(() => import("./pages/Lancamentos"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Colaboradores = lazy(() => import("./pages/Colaboradores"));
const LojaDashboard = lazy(() => import("./pages/LojaDashboard"));
const MetasManagement = lazy(() => import("./components/MetasManagement"));
const BonusManagement = lazy(() => import("./components/BonusManagement"));
const BenchmarksManagement = lazy(() => import("./pages/BenchmarksManagement"));
const ERPIntegrationsConfig = lazy(() => import("./pages/ERPIntegrationsConfig"));
const ERPConfig = lazy(() => import("./pages/dev/ERPConfig"));
const DevLogin = lazy(() => import("./pages/dev/DevLogin"));
const ERPLogin = lazy(() => import("./pages/erp/ERPLogin"));
const ERPDashboard = lazy(() => import("./pages/erp/ERPDashboard"));
const CategoryReports = lazy(() => import("./pages/erp/CategoryReports"));
const ProductSalesIntelligence = lazy(() => import("./pages/erp/ProductSalesIntelligence"));
const CustomerIntelligence = lazy(() => import("./pages/erp/CustomerIntelligence"));
const CashbackManagement = lazy(() => import("./pages/erp/CashbackManagement"));
const Seed = lazy(() => import("./pages/Seed"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Landing = lazy(() => import("./pages/Landing"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
              <Route path="/admin/erp-integrations" element={<Suspense fallback={<PageLoader />}><ERPIntegrationsConfig /></Suspense>} />
              
              <Route path="/dev/login" element={<Suspense fallback={<PageLoader />}><DevLogin /></Suspense>} />
              <Route path="/dev/erp-config" element={<Suspense fallback={<PageLoader />}><ERPConfig /></Suspense>} />
              
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
  </QueryClientProvider>
);

export default App;
