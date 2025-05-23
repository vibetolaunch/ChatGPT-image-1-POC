'use client'

import { useState } from 'react'
import Image from 'next/image'

interface ResultDisplayProps {
  originalImageUrl: string
  resultImageUrl: string
  prompt: string
  onReset: () => void
}

export default function ResultDisplay({
  originalImageUrl,
  resultImageUrl,
  prompt,
  onReset
}: ResultDisplayProps) {
  const [showOriginal, setShowOriginal] = useState(false)
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Result</h3>
        <p className="text-sm text-gray-500 mb-4">
          Your image has been processed with the prompt: <span className="font-medium italic">"{prompt}"</span>
        </p>
      </div>
      
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 relative">
          <div className="relative h-80 w-full">
            <Image
              src={showOriginal ? originalImageUrl : resultImageUrl}
              alt={showOriginal ? "Original Image" : "Edited Image"}
              fill
              className="object-contain rounded-lg"
            />
          </div>
          
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <button
              type="button"
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onMouseDown={() => setShowOriginal(true)}
              onMouseUp={() => setShowOriginal(false)}
              onMouseLeave={() => setShowOriginal(false)}
            >
              Hold to see original
            </button>
          </div>
        </div>
        
        <div className="flex-1 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Image Details</h4>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Prompt</dt>
                <dd className="mt-1 text-sm text-gray-900">{prompt}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Model</dt>
                <dd className="mt-1 text-sm text-gray-900">GPT-Image-1</dd>
              </div>
            </dl>
          </div>
          
          <div className="space-y-3">
            <a
              href={resultImageUrl}
              download="edited-image.png"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full justify-center"
            >
              Download Image
            </a>
            
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full justify-center"
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-green-50 border-l-4 border-green-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-green-700">
              Your image has been successfully processed! You can download it or start over with a new image.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}