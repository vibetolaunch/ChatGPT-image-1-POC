import { ImageProvider } from './types';
import { RecraftProvider } from './RecraftProvider';
import { StabilityAiProvider } from './StabilityAiProvider'; // Import StabilityAiProvider
import { imageModels } from '@/lib/config';

export class ImageProviderFactory {
  static getProvider(modelName?: string): ImageProvider {
    // Use default model if none specified
    const selectedModel = modelName || imageModels.default;
    
    if (selectedModel === 'recraft') {
      return new RecraftProvider();
    } else if (selectedModel === 'stabilityai') { // Add Stability AI case
      return new StabilityAiProvider();
    } else if (selectedModel === 'openai') {
      // For now, we'll throw an error since we're focusing on Recraft
      // This can be implemented later if needed
      throw new Error('OpenAI provider not yet implemented in new architecture');
    } else {
      throw new Error(`Unknown model: ${selectedModel}`);
    }
  }

  static getDefaultProvider(): ImageProvider {
    return this.getProvider(imageModels.default);
  }

  static getSupportedModels(): string[] {
    return Object.keys(imageModels.models);
  }

  static getModelConfig(modelName: string) {
    const modelKey = modelName as keyof typeof imageModels.models;
    if (imageModels.models[modelKey]) {
      return imageModels.models[modelKey];
    } else {
      throw new Error(`Unknown model: ${modelName}`);
    }
  }
}
