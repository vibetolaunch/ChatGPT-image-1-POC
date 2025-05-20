'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

interface ImageComparisonSliderProps {
  beforeImage: string
  afterImage: string
}

export default function ImageComparisonSlider({ beforeImage, afterImage }: ImageComparisonSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return

      const scrollPosition = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      
      // Calculate scroll progress as a percentage of the total scrollable area
      const scrollProgress = (scrollPosition / (documentHeight - windowHeight)) * 100
      const position = Math.min(Math.max(scrollProgress, 0), 100)
      setSliderPosition(position)
    }

    window.addEventListener('scroll', handleScroll)
    // Initial position calculation
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 w-full h-full"
    >
      {/* Before Image (Full height) */}
      <div className="absolute inset-0">
        <Image
          src={beforeImage}
          alt="Before"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* After Image (Fixed position with mask) */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 0 ${100 - sliderPosition}% 0)` }}
        >
          <Image
            src={afterImage}
            alt="After"
            fill
            className="object-cover"
            priority
          />
        </div>
      </div>

      {/* Slider Line */}
      <div 
        className="absolute left-0 right-0 h-2 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 backdrop-blur-sm overflow-hidden"
        style={{ 
          top: `${sliderPosition}%`,
          boxShadow: '0 0 10px 2px rgba(156, 39, 176, 0.7), 0 0 20px 4px rgba(32, 156, 238, 0.5)'
        }}
      >
        {/* Slider Handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center">
          <div className="w-6 h-6 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full" />
        </div>
      </div>
    </div>
  )
} 