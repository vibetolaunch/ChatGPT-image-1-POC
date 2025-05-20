'use client';

import RiveAnimation from './RiveAnimation';

interface FloatingCharacterProps {
  src: string;
  stateMachineName?: string;
  animationName?: string;
  height?: number;
  width?: number;
  className?: string;
}

export default function FloatingCharacter({
  src,
  stateMachineName,
  animationName,
  height = 200,
  width = 200,
  className = '',
}: FloatingCharacterProps) {
  return (
    <RiveAnimation
      src={src}
      stateMachineName={stateMachineName}
      animationName={animationName}
      height={height}
      width={width}
      className={className}
    />
  );
} 