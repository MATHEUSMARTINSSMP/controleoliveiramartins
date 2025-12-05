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
    <div className="page-container flex items-center justify-center">
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          className="floating-orb w-96 h-96 top-1/4 left-1/4"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="floating-orb-2 w-80 h-80 bottom-1/4 right-1/4"
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="floating-orb-3 w-[600px] h-[600px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          animate={{ 
            rotate: 360,
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative text-center space-y-8 z-10"
      >
        <motion.div 
          className="relative"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div 
            className="w-24 h-24 mx-auto rounded-2xl gradient-primary glow flex items-center justify-center shadow-2xl"
            animate={{ 
              boxShadow: [
                "var(--shadow-glow-sm)",
                "var(--shadow-glow)",
                "var(--shadow-glow-sm)",
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="w-12 h-12 text-primary-foreground" />
          </motion.div>
          <motion.div 
            className="absolute inset-0 w-24 h-24 mx-auto rounded-2xl gradient-primary"
            animate={{ 
              scale: [1, 1.5, 1],
              opacity: [0.4, 0, 0.4],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>

        <div className="space-y-3">
          <motion.h2 
            className="text-3xl font-bold text-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Carregando
          </motion.h2>
          <motion.p 
            className="text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Preparando seu painel
          </motion.p>
        </div>

        <motion.div 
          className="flex justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 rounded-full gradient-primary"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1,
                delay: i * 0.2,
                repeat: Infinity,
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Index;
