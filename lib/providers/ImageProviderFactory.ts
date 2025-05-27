import { ImageProvider } from './types';
import { StabilityAiProvider } from './StabilityAiProvider';
import { ReplicateProvider } from './ReplicateProvider';
import { imageModels } from '@/lib/config';

export class ImageProviderFactory {
  static getProvider(modelName?: string): ImageProvider {
    // Use default model if none specified
    const selectedModel = modelName || imageModels.default;
    
    if (selectedModel === 'stabilityai') {
      return new StabilityAiProvider();
    } else if (selectedModel === 'replicate') {
      return new ReplicateProvider();
    } else if (selectedModel === 'openai') {
      // OpenAI provider not yet implemented
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
