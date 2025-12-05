import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface GradientBackgroundProps {
  children: React.ReactNode;
  className?: string;
  variant?: "mesh" | "radial" | "linear" | "animated";
  overlay?: boolean;
}

export function GradientBackground({
  children,
  className,
  variant = "mesh",
  overlay = false,
}: GradientBackgroundProps) {
  const variants = {
    mesh: "gradient-mesh",
    radial: "bg-gradient-radial from-primary/10 via-transparent to-transparent",
    linear: "bg-gradient-to-br from-primary/5 via-transparent to-accent/5",
    animated: "animate-gradient bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10",
  };

  return (
    <div className={cn("relative min-h-screen", className)}>
      <div className={cn(
        "fixed inset-0 -z-10",
        variants[variant]
      )} />
      {overlay && (
        <div className="fixed inset-0 -z-10 bg-background/80 backdrop-blur-sm" />
      )}
      {children}
    </div>
  );
}

interface FloatingOrbProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  color?: "primary" | "accent" | "secondary";
  blur?: boolean;
  animate?: boolean;
}

export function FloatingOrb({
  className,
  size = "md",
  color = "primary",
  blur = true,
  animate = true,
}: FloatingOrbProps) {
  const sizeClasses = {
    sm: "w-32 h-32",
    md: "w-64 h-64",
    lg: "w-96 h-96",
    xl: "w-[500px] h-[500px]",
  };

  const colorClasses = {
    primary: "bg-primary/30",
    accent: "bg-accent/30",
    secondary: "bg-secondary/30",
  };

  return (
    <motion.div
      className={cn(
        "absolute rounded-full",
        sizeClasses[size],
        colorClasses[color],
        blur && "blur-3xl",
        animate && "animate-float-slow",
        className
      )}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: "easeOut" }}
    />
  );
}

interface ParticleFieldProps {
  count?: number;
  className?: string;
}

export function ParticleField({ count = 50, className }: ParticleFieldProps) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 2,
  }));

  return (
    <div className={cn("fixed inset-0 -z-10 overflow-hidden pointer-events-none", className)}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-primary/20"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
