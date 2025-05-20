'use client';

import { useRive, useStateMachineInput } from '@rive-app/react-canvas';
import { useEffect, useState } from 'react';

interface RiveAnimationProps {
  src: string;
  stateMachineName?: string;
  animationName?: string;
  className?: string;
  height?: number;
  width?: number;
  autoplay?: boolean;
}

export default function RiveAnimation({
  src,
  stateMachineName,
  animationName,
  className = '',
  height = 300,
  width = 300,
  autoplay = true,
}: RiveAnimationProps) {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const { RiveComponent, rive } = useRive({
    src,
    stateMachines: stateMachineName ? [stateMachineName] : undefined,
    animations: animationName ? [animationName] : undefined,
    autoplay,
  });

  if (!isClient) {
    return null;
  }

  return (
    <div className={className} style={{ height, width }}>
      <RiveComponent />
    </div>
  );
} 