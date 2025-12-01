import { useEffect, useRef } from 'react';

export function MouseTrackingBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gradientRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!gradientRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate percentage position
      const xPercent = (x / rect.width) * 100;
      const yPercent = (y / rect.height) * 100;

      // Move gradient based on mouse position
      gradientRef.current.style.background = `radial-gradient(
        circle at ${xPercent}% ${yPercent}%,
        rgba(168, 85, 247, 0.15) 0%,
        rgba(168, 85, 247, 0.05) 25%,
        transparent 50%
      )`;
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 pointer-events-none"
    >
      <div
        ref={gradientRef}
        className="absolute inset-0 transition-all duration-100"
      />
    </div>
  );
}
