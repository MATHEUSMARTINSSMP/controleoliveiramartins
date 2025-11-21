import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/AdminDashboard";
import ColaboradoraDashboard from "./pages/ColaboradoraDashboard";
import NovaCompra from "./pages/NovaCompra";
import NovoAdiantamento from "./pages/NovoAdiantamento";
import Adiantamentos from "./pages/Adiantamentos";
import SolicitarAdiantamento from "./pages/SolicitarAdiantamento";
import Lancamentos from "./pages/Lancamentos";
import Relatorios from "./pages/Relatorios";
import Colaboradores from "./pages/Colaboradores";
import LojaDashboard from "./pages/LojaDashboard";
import MetasManagement from "./components/MetasManagement";
import BonusManagement from "./components/BonusManagement";
import BenchmarksManagement from "./pages/BenchmarksManagement";
import WeeklyGoalsManagement from "./components/WeeklyGoalsManagement";
import Seed from "./pages/Seed";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/seed" element={<Seed />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/nova-compra" element={<NovaCompra />} />
            <Route path="/admin/novo-adiantamento" element={<NovoAdiantamento />} />
            <Route path="/admin/adiantamentos" element={<Adiantamentos />} />
            <Route path="/admin/lancamentos" element={<Lancamentos />} />
            <Route path="/admin/relatorios" element={<Relatorios />} />
            <Route path="/admin/colaboradores" element={<Colaboradores />} />
            <Route path="/admin/metas" element={<MetasManagement />} />
            <Route path="/admin/metas-semanais" element={<WeeklyGoalsManagement />} />
            <Route path="/admin/bonus" element={<BonusManagement />} />
            <Route path="/admin/benchmarks" element={<BenchmarksManagement />} />
            <Route path="/loja" element={<LojaDashboard />} />
            <Route path="/me" element={<ColaboradoraDashboard />} />
            <Route path="/solicitar-adiantamento" element={<SolicitarAdiantamento />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
