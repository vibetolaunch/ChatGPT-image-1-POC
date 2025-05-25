// Types for image provider system

export interface ImageEditParams {
  image: Buffer;
  mask: Buffer;
  prompt: string;
  originalWidth: number;
  originalHeight: number;
  options?: {
    style?: string; // Could map to style_preset for Stability
    substyle?: string; // May not be directly applicable
    negativePrompt?: string;
    model?: string; // Could be engine_id for Stability, or internal model name
    // Stability AI specific options
    cfgScale?: number;
    samples?: number; // Number of images to generate
    steps?: number;
    seed?: number;
    // Add any other common Stability AI params you want to control
  };
}

export interface ImageResult {
  editedImageB64: string;
  editedImageUrl: string;
  editedImagePath: string;
  optionNumber: number;
}

export interface ImageProvider {
  editImage(params: ImageEditParams): Promise<ImageResult[]>;
  validateImage(buffer: Buffer, width: number, height: number): Promise<boolean>;
  validateMask(buffer: Buffer, width: number, height: number): Promise<boolean>;
}

export interface ProviderResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

export interface RecraftResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
}
