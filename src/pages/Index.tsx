import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles } from "lucide-react";

const Index = () => {
  const { profile, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/", { replace: true });
      return;
    }

    if (profile) {
      const targetPath = profile.role === "LOJA" 
        ? "/loja" 
        : profile.role === "ADMIN" 
          ? "/admin" 
          : "/me";
      
      navigate(targetPath, { replace: true });
    }
  }, [profile, loading, user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="text-center space-y-6">
        <div className="relative">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center animate-pulse">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-violet-500 to-purple-600 animate-ping opacity-20" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Carregando...</h2>
          <p className="text-slate-400">Preparando seu painel</p>
        </div>
        <div className="flex justify-center gap-1">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
};

export default Index;
