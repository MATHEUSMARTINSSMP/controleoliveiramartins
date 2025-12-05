import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface ConfettiPiece {
  id: number;
  x: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotation: number;
}

interface ConfettiProps {
  active: boolean;
  duration?: number;
  pieceCount?: number;
  className?: string;
}

const colors = [
  "hsl(262, 83%, 58%)",
  "hsl(280, 100%, 70%)",
  "hsl(270, 60%, 50%)",
  "hsl(142, 70%, 45%)",
  "hsl(38, 92%, 50%)",
  "#fff",
];

export function Confetti({ 
  active, 
  duration = 3000, 
  pieceCount = 50,
  className 
}: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (active) {
      const newPieces: ConfettiPiece[] = Array.from({ length: pieceCount }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
      }));
      setPieces(newPieces);
      setShow(true);

      const timer = setTimeout(() => {
        setShow(false);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [active, duration, pieceCount]);

  return (
    <AnimatePresence>
      {show && (
        <div className={cn("fixed inset-0 pointer-events-none z-50 overflow-hidden", className)}>
          {pieces.map((piece) => (
            <motion.div
              key={piece.id}
              initial={{ 
                x: `${piece.x}vw`, 
                y: -20, 
                rotate: 0,
                opacity: 1 
              }}
              animate={{ 
                y: "110vh", 
                rotate: piece.rotation + 720,
                opacity: [1, 1, 0]
              }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: piece.duration, 
                delay: piece.delay,
                ease: "linear"
              }}
              style={{
                position: "absolute",
                width: piece.size,
                height: piece.size,
                backgroundColor: piece.color,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

interface SparkleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  color?: string;
}

export function Sparkle({ className, size = "md", color = "hsl(280, 100%, 70%)" }: SparkleProps) {
  const sizes = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  return (
    <motion.div
      className={cn("relative", sizes[size], className)}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <svg viewBox="0 0 24 24" fill={color} className="w-full h-full">
        <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
      </svg>
    </motion.div>
  );
}

interface PulseRingProps {
  className?: string;
  color?: string;
  size?: number;
}

export function PulseRing({ className, color = "hsl(262, 83%, 58%)", size = 100 }: PulseRingProps) {
  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: color }}
          initial={{ scale: 0.5, opacity: 0.8 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{
            duration: 2,
            delay: i * 0.5,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

interface SuccessCheckmarkProps {
  className?: string;
  size?: number;
  show?: boolean;
}

export function SuccessCheckmark({ className, size = 80, show = true }: SuccessCheckmarkProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className={cn("relative flex items-center justify-center", className)}
          style={{ width: size, height: size }}
        >
          <motion.div 
            className="absolute inset-0 rounded-full bg-green-500/20"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <motion.div 
            className="w-full h-full rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg"
            initial={{ rotate: -45 }}
            animate={{ rotate: 0 }}
          >
            <motion.svg
              viewBox="0 0 24 24"
              className="w-1/2 h-1/2 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <motion.path
                d="M5 12l5 5L20 7"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />
            </motion.svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface GlowingBorderProps {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}

export function GlowingBorder({ children, className, active = true }: GlowingBorderProps) {
  return (
    <div className={cn("relative", className)}>
      {active && (
        <motion.div
          className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary via-purple-500 to-primary opacity-75 blur-sm"
          animate={{
            background: [
              "linear-gradient(90deg, hsl(262, 83%, 58%), hsl(280, 100%, 70%), hsl(262, 83%, 58%))",
              "linear-gradient(180deg, hsl(262, 83%, 58%), hsl(280, 100%, 70%), hsl(262, 83%, 58%))",
              "linear-gradient(270deg, hsl(262, 83%, 58%), hsl(280, 100%, 70%), hsl(262, 83%, 58%))",
              "linear-gradient(360deg, hsl(262, 83%, 58%), hsl(280, 100%, 70%), hsl(262, 83%, 58%))",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      )}
      <div className="relative bg-card rounded-xl">
        {children}
      </div>
    </div>
  );
}
