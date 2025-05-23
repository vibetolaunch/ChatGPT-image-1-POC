'use client';

import { useState, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import MaskEditor from './components/MaskEditor';
import PromptInput from './components/PromptInput';
import ResultDisplay from './components/ResultDisplay';

// Define the steps in the editing workflow
enum EditorStep {
  UPLOAD,
  MASK,
  PROMPT,
  RESULT
}

// Define the types for our state
interface EditorState {
  originalImage?: {
    url: string;
    path: string;
    id: string;
  };
  maskImage?: {
    url: string;
    data: string; // base64 data for the mask
  };
  prompt?: string;
  resultImage?: {
    url: string;
    path: string;
  };
}

export default function ClientWrapper() {
  // Track the current step in the workflow
  const [currentStep, setCurrentStep] = useState<EditorStep>(EditorStep.UPLOAD);
  
  // State for the editor
  const [editorState, setEditorState] = useState<EditorState>({});
  
  // Loading state for async operations
  const [isLoading, setIsLoading] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);

  // Session ID state
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Initialize session on component mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem('imageEditorSessionId');
    
    if (savedSessionId) {
      setSessionId(savedSessionId);
    } else {
      // Create a new session
      fetch('/api/tokens')
        .then(response => response.json())
        .then(data => {
          if (data.sessionId) {
            setSessionId(data.sessionId);
            localStorage.setItem('imageEditorSessionId', data.sessionId);
          }
        })
        .catch(err => {
          console.error('Error creating session:', err);
          setError('Failed to initialize session');
        });
    }
  }, []);

  // Handle image upload completion
  const handleImageUploaded = (imageUrl: string, imagePath: string, imageId: string) => {
    setEditorState({
      ...editorState,
      originalImage: {
        url: imageUrl,
        path: imagePath,
        id: imageId
      }
    });
    setCurrentStep(EditorStep.MASK);
  };

  // Handle mask creation completion
  const handleMaskCreated = (maskImageData: string) => {
    setEditorState({
      ...editorState,
      maskImage: {
        url: maskImageData,
        data: maskImageData
      }
    });
    setCurrentStep(EditorStep.PROMPT);
  };

  // Handle prompt submission
  const handlePromptSubmitted = (prompt: string) => {
    setEditorState({
      ...editorState,
      prompt
    });
    setIsLoading(true);
    
    // Process the image with the mask and prompt
    processImageWithMask(
      editorState.originalImage!.path,
      editorState.maskImage!.data,
      prompt
    )
      .then(result => {
        setEditorState({
          ...editorState,
          prompt,
          resultImage: {
            url: result.url,
            path: result.path
          }
        });
        setCurrentStep(EditorStep.RESULT);
      })
      .catch(err => {
        setError(err.message || 'An error occurred while processing the image');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  // Reset the editor to start over
  const handleReset = () => {
    setEditorState({});
    setCurrentStep(EditorStep.UPLOAD);
    setError(null);
  };

  // Process the image with the mask and prompt
  const processImageWithMask = async (
    imagePath: string,
    maskData: string,
    prompt: string
  ) => {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      const formData = new FormData();
      formData.append('imagePath', imagePath);
      formData.append('maskData', maskData);
      formData.append('prompt', prompt);
      formData.append('sessionId', sessionId);
      
      const response = await fetch('/api/mask-edit-image', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process image');
      }
      
      const data = await response.json();
      return {
        url: data.editedImageUrl,
        path: data.editedImagePath
      };
    } catch (error: any) {
      console.error('Error processing image:', error);
      throw error;
    }
  };

  return (
    <div className="w-full">
      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-lg">
          <p>{error}</p>
          <button 
            onClick={() => setError(null)}
            className="mt-2 text-sm font-medium text-red-700 hover:text-red-900"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Step indicator */}
      <div className="mb-8">
        <nav className="flex items-center justify-center" aria-label="Progress">
          <ol className="flex items-center space-x-5">
            {[
              { id: EditorStep.UPLOAD, name: 'Upload' },
              { id: EditorStep.MASK, name: 'Mask' },
              { id: EditorStep.PROMPT, name: 'Prompt' },
              { id: EditorStep.RESULT, name: 'Result' }
            ].map((step) => (
              <li key={step.id}>
                <div className={`flex items-center ${currentStep >= step.id ? 'text-indigo-600' : 'text-gray-400'}`}>
                  <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border-2 ${
                    currentStep > step.id 
                      ? 'bg-indigo-600 border-indigo-600' 
                      : currentStep === step.id 
                        ? 'border-indigo-600' 
                        : 'border-gray-300'
                  }`}>
                    {currentStep > step.id ? (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span className={currentStep === step.id ? 'text-indigo-600' : 'text-gray-500'}>
                        {step.id + 1}
                      </span>
                    )}
                  </span>
                  <span className="ml-2 text-sm font-medium">{step.name}</span>
                </div>
              </li>
            ))}
          </ol>
        </nav>
      </div>
      
      {/* Content based on current step */}
      <div className="mt-4">
        {currentStep === EditorStep.UPLOAD && (
          <ImageUploader onImageUploaded={handleImageUploaded} />
        )}
        
        {currentStep === EditorStep.MASK && editorState.originalImage && (
          <MaskEditor 
            imageUrl={editorState.originalImage.url} 
            onMaskCreated={handleMaskCreated}
          />
        )}
        
        {currentStep === EditorStep.PROMPT && editorState.originalImage && editorState.maskImage && (
          <PromptInput 
            onPromptSubmitted={handlePromptSubmitted}
            isLoading={isLoading}
          />
        )}
        
        {currentStep === EditorStep.RESULT && editorState.originalImage && editorState.resultImage && (
          <ResultDisplay 
            originalImageUrl={editorState.originalImage.url}
            resultImageUrl={editorState.resultImage.url}
            prompt={editorState.prompt || ''}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
