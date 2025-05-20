'use client';

import { useEffect, useState, useRef } from 'react';
import FloatingCharacter from '../components/FloatingCharacter';

export default function ClientWrapper() {
  const [scrollY, setScrollY] = useState(0);
  const targetPositionRef = useRef(0);
  const currentPositionRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  
  // Smooth animation function
  const animate = () => {
    // Ease towards target position
    const easing = 0.07; // Lower for smoother, higher for quicker response
    const diff = targetPositionRef.current - currentPositionRef.current;
    
    if (Math.abs(diff) > 0.1) {
      currentPositionRef.current += diff * easing;
      // Force re-render with new position
      setScrollY(prev => prev + 0.01);
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  };
  
  // Update scroll position
  useEffect(() => {
    const handleScroll = () => {
      // Update target position based on scroll
      targetPositionRef.current = window.scrollY;
      
      // Start animation if not already running
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Clean up animation frame
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  
  // Calculate position based on scroll
  const calculateStyle = () => {
    // Start with the buddy at 40% from the bottom of the viewport
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const initialBottomPercentage = 40; // 40% from bottom
    const baseBottom = viewportHeight * (initialBottomPercentage / 100);
    
    // Determine the scroll ratio based on max page scroll
    // This ensures a tight connection with the comparison slider
    const pageHeight = document.documentElement.scrollHeight - viewportHeight;
    const scrollRatio = pageHeight > 0 ? currentPositionRef.current / pageHeight : 0;
    
    // Calculate movement range - from initial position down to 20px from bottom
    const maxMovement = baseBottom - 20;
    const offset = maxMovement * scrollRatio;
    
    return {
      bottom: `${baseBottom - offset}px`, // Move down from initial position
      right: '16px', // 4rem (right-4)
    };
  };
  
  return (
    <div 
      style={calculateStyle()} 
      className="fixed z-50 hover:scale-110"
    >
      <FloatingCharacter 
        src="/buddy.riv"
        height={325}
        width={325}
      />
    </div>
  );
} 