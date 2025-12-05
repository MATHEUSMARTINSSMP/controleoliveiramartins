import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center space-y-6"
      >
        <div className="w-16 h-16 mx-auto rounded-xl bg-foreground flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-background" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Carregando
          </h2>
          <p className="text-sm text-muted-foreground">
            Preparando seu painel
          </p>
        </div>

        <div className="w-8 h-8 mx-auto border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </motion.div>
    </div>
  );
};

export default Index;
