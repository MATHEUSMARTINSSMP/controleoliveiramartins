import { useEffect, useState } from 'react';

export function AnimatedCounter({ 
  end, 
  duration = 2000, 
  prefix = '', 
  suffix = '' 
}: { 
  end: number; 
  duration?: number; 
  prefix?: string; 
  suffix?: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      setCount(Math.floor(end * progress));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [end, duration]);

  return <>{prefix}{count}{suffix}</>;
}
