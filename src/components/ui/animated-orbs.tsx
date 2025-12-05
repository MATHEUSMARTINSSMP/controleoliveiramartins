import { motion } from "framer-motion";

export function AnimatedOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <motion.div
        animate={{
          x: [0, 40, 0],
          y: [0, -30, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-[10%] left-[5%] w-[500px] h-[500px] bg-amber-500/10 dark:bg-violet-500/15 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, -30, 0],
          y: [0, 40, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute bottom-[15%] right-[5%] w-[600px] h-[600px] bg-orange-400/8 dark:bg-purple-500/12 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, 20, 0],
          y: [0, 20, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-[40%] left-[40%] w-[400px] h-[400px] bg-yellow-500/6 dark:bg-indigo-500/10 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, -25, 0],
          y: [0, -20, 0],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-[60%] left-[20%] w-[350px] h-[350px] bg-amber-400/8 dark:bg-violet-400/10 rounded-full blur-3xl"
      />
    </div>
  );
}
