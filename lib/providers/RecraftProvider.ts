import sharp from 'sharp';
import { createServerSupabaseClient } from '@/lib/supabase';
import { imageModels } from '@/lib/config';
import { ImageProvider, ImageEditParams, ImageResult, RecraftResponse } from './types';

export class RecraftProvider implements ImageProvider {
  private config = imageModels.models.recraft;

  async editImage(params: ImageEditParams): Promise<ImageResult[]> {
    const { image, mask, prompt, originalWidth, originalHeight, options } = params;

    if (!this.config.apiKey) {
      throw new Error('Recraft API key is not configured');
    }

    console.log('Starting Recraft image edit process...');

    // Validate inputs
    await this.validateImage(image, originalWidth, originalHeight);
    await this.validateMask(mask, originalWidth, originalHeight);

    // Convert mask from RGBA (OpenAI format) to grayscale (Recraft format)
    const grayscaleMask = await this.convertMaskToGrayscale(mask);
    console.log('Converted mask to grayscale format for Recraft');

    // Determine optimal size for Recraft
    const targetSize = this.getOptimalSize(originalWidth, originalHeight);
    console.log(`Using Recraft size: ${targetSize}`);

    // Resize image and mask to target size while maintaining aspect ratio
    const { resizedImage, resizedMask, scalingInfo } = await this.resizeForRecraft(
      image, 
      grayscaleMask, 
      originalWidth, 
      originalHeight, 
      targetSize
    );

    // Create FormData for Recraft API
    const formData = new FormData();
    formData.append('image', new Blob([resizedImage], { type: 'image/png' }), 'image.png');
    formData.append('mask', new Blob([resizedMask], { type: 'image/png' }), 'mask.png'); // Changed to PNG
    formData.append('prompt', prompt);
    formData.append('style', options?.style || this.config.defaultStyle);
    formData.append('model', options?.model || 'recraftv3');
    formData.append('response_format', 'url');

    if (options?.substyle) {
      formData.append('substyle', options.substyle);
    }
    if (options?.negativePrompt) {
      formData.append('negative_prompt', options.negativePrompt);
    }

    console.log('Calling Recraft API...');

    // Call Recraft API
    const response = await fetch(`${this.config.endpoint}/images/inpaint`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`
        // Don't set Content-Type - let browser handle multipart/form-data
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Recraft API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Recraft API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result: RecraftResponse = await response.json();
    console.log('Received response from Recraft API');

    if (!result.data || result.data.length === 0) {
      throw new Error('No images returned from Recraft API');
    }

    // Process the result
    return await this.processRecraftResponse(
      result, 
      image, 
      grayscaleMask, 
      originalWidth, 
      originalHeight,
      scalingInfo
    );
  }

  private async convertMaskToGrayscale(rgbaMaskBuffer: Buffer): Promise<Buffer> {
    console.log('Converting RGBA mask to grayscale JPEG for Recraft...');
    
    // Get the metadata to understand what we're working with
    const metadata = await sharp(rgbaMaskBuffer).metadata();
    console.log('Input mask metadata:', metadata);
    
    // Simple approach: convert the RGBA mask to RGB first, then to grayscale JPEG
    // This creates a standard grayscale image that should be universally accepted
    const binaryPngBuffer = await sharp(rgbaMaskBuffer)
      // .flatten({ background: { r: 0, g: 0, b: 0 } }) // Intentionally removed
      .grayscale() // Convert RGBA to grayscale
      .threshold() // Threshold to pure 0 or 255
      .png()       // Output as a binary PNG
      .toBuffer();

    // Verify the output
    const outputMetadata = await sharp(binaryPngBuffer).metadata();
    console.log('Output mask (binary PNG) metadata:', outputMetadata);
    
    return binaryPngBuffer;
  }

  private getOptimalSize(width: number, height: number): string {
    const aspectRatio = width / height;
    const maxDimension = Math.max(width, height);
    
    // Find the best matching size from Recraft's supported sizes
    const supportedSizes = this.config.supportedSizes;
    
    // Default to 1024x1024 if no better match
    let bestSize = '1024x1024';
    let bestScore = Infinity;
    
    for (const size of supportedSizes) {
      const [w, h] = size.split('x').map(Number);
      const sizeAspectRatio = w / h;
      const sizeDimension = Math.max(w, h);
      
      // Score based on aspect ratio match and size appropriateness
      const aspectScore = Math.abs(aspectRatio - sizeAspectRatio);
      const sizeScore = Math.abs(maxDimension - sizeDimension) / maxDimension;
      const totalScore = aspectScore + sizeScore;
      
      if (totalScore < bestScore) {
        bestScore = totalScore;
        bestSize = size;
      }
    }
    
    return bestSize;
  }

  private async resizeForRecraft(
    image: Buffer, 
    mask: Buffer, 
    originalWidth: number, 
    originalHeight: number, 
    targetSize: string
  ) {
    const [targetWidth, targetHeight] = targetSize.split('x').map(Number);
    
    console.log(`Resizing from ${originalWidth}x${originalHeight} to ${targetWidth}x${targetHeight}`);
    
    // Resize image maintaining aspect ratio, fitting within target dimensions
    const resizedImage = await sharp(image)
      .resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: false,
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      })
      .png()
      .toBuffer();

    // Resize mask with same parameters, using nearest neighbor to preserve binary values
    const resizedMask = await sharp(mask)
      .resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: false,
        kernel: sharp.kernel.nearest,
        background: { r: 0, g: 0, b: 0 } // Removed alpha
      })
      // .toColourspace('b-w') // Removed to see if direct PNG encoding of binary data is cleaner
      // .threshold() // Removed as it's now done in convertMaskToGrayscale
      .png({
        compressionLevel: 9, // Max compression, lossless
        palette: true,        // Attempt to use a palette (good for binary images)
        colours: 2,           // Explicitly aim for 2 colors (black and white)
        colors: 2             // Alias for colours
      })
      .toBuffer();

    // Get actual dimensions after resize
    const imageMetadata = await sharp(resizedImage).metadata();
    const actualWidth = imageMetadata.width!;
    const actualHeight = imageMetadata.height!;

    return {
      resizedImage,
      resizedMask,
      scalingInfo: {
        originalWidth,
        originalHeight,
        targetWidth,
        targetHeight,
        actualWidth,
        actualHeight,
        scaleX: actualWidth / originalWidth,
        scaleY: actualHeight / originalHeight
      }
    };
  }

  private async processRecraftResponse(
    result: RecraftResponse,
    originalImage: Buffer,
    originalMask: Buffer,
    originalWidth: number,
    originalHeight: number,
    scalingInfo: any
  ): Promise<ImageResult[]> {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const processedImages: ImageResult[] = [];

    for (let i = 0; i < result.data.length; i++) {
      const imageData = result.data[i];
      const imageUrl = imageData?.url;
      const imageB64Json = imageData?.b64_json;

      let recraftResultBuffer: Buffer;

      if (imageB64Json) {
        console.log(`Processing base64 image ${i + 1} from Recraft`);
        recraftResultBuffer = Buffer.from(imageB64Json, 'base64');
      } else if (imageUrl) {
        console.log(`Processing URL image ${i + 1} from Recraft`);
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch edited image ${i + 1} from Recraft`);
        }
        const resultBuffer = await imageResponse.arrayBuffer();
        recraftResultBuffer = Buffer.from(resultBuffer);
      } else {
        console.error(`No image URL or base64 data found in Recraft response for image ${i + 1}`);
        continue;
      }

      // Resize Recraft result back to original dimensions
      const resizedResult = await sharp(recraftResultBuffer)
        .resize(originalWidth, originalHeight, {
          fit: 'fill',
          kernel: sharp.kernel.lanczos3
        })
        .png()
        .toBuffer();

      // Composite with original image using the mask
      const finalResult = await this.compositeWithOriginal(
        originalImage,
        resizedResult,
        originalMask,
        originalWidth,
        originalHeight
      );

      // Save result to Supabase
      const resultFileName = `${user.id}-recraft-result-${Date.now()}-option${i + 1}.png`;
      const { error: uploadError } = await supabase.storage
        .from('edited-images')
        .upload(resultFileName, finalResult);

      if (uploadError) {
        console.error(`Error uploading result image ${i + 1}:`, uploadError);
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('edited-images')
        .getPublicUrl(resultFileName);

      // Convert to base64
      const imageB64 = finalResult.toString('base64');

      processedImages.push({
        editedImageB64: imageB64,
        editedImageUrl: publicUrl,
        editedImagePath: resultFileName,
        optionNumber: i + 1
      });

      console.log(`Recraft image ${i + 1} processed successfully`);
    }

    return processedImages;
  }

  private async compositeWithOriginal(
    originalImage: Buffer,
    editedImage: Buffer,
    grayscaleMask: Buffer,
    width: number,
    height: number
  ): Promise<Buffer> {
    console.log('Compositing Recraft result with original image...');

    // Convert grayscale mask back to alpha mask for compositing
    // White pixels in grayscale mask (edit areas) should become transparent in alpha mask
    // Black pixels in grayscale mask (keep areas) should become opaque in alpha mask
    const { data: maskData } = await sharp(grayscaleMask)
      .resize(width, height, { fit: 'fill', kernel: sharp.kernel.nearest })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const alphaMask = Buffer.alloc(width * height);
    for (let i = 0; i < maskData.length; i++) {
      // White (255) in grayscale -> transparent (0) in alpha (show edited)
      // Black (0) in grayscale -> opaque (255) in alpha (show original)
      alphaMask[i] = maskData[i] === 255 ? 0 : 255;
    }

    // Apply alpha mask to original image (keep areas)
    const originalWithMask = await sharp(originalImage)
      .resize(width, height, { fit: 'fill' })
      .ensureAlpha()
      .composite([{
        input: alphaMask,
        blend: 'dest-in'
      }])
      .toBuffer();

    // Apply inverted alpha mask to edited image (edit areas)
    const invertedAlphaMask = Buffer.alloc(width * height);
    for (let i = 0; i < alphaMask.length; i++) {
      invertedAlphaMask[i] = 255 - alphaMask[i];
    }

    const editedWithMask = await sharp(editedImage)
      .resize(width, height, { fit: 'fill' })
      .ensureAlpha()
      .composite([{
        input: invertedAlphaMask,
        blend: 'dest-in'
      }])
      .toBuffer();

    // Composite both images together
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([
      { input: originalWithMask, blend: 'over' },
      { input: editedWithMask, blend: 'over' }
    ])
    .png()
    .toBuffer();
  }

  async validateImage(buffer: Buffer, width: number, height: number): Promise<boolean> {
    const metadata = await sharp(buffer).metadata();
    const fileSize = buffer.length;
    const resolution = (metadata.width || 0) * (metadata.height || 0);

    if (fileSize > this.config.maxFileSize) {
      throw new Error(`Image file size (${fileSize} bytes) exceeds maximum allowed (${this.config.maxFileSize} bytes)`);
    }

    if (resolution > this.config.maxResolution) {
      throw new Error(`Image resolution (${resolution} pixels) exceeds maximum allowed (${this.config.maxResolution} pixels)`);
    }

    if ((metadata.width || 0) > this.config.maxDimension || (metadata.height || 0) > this.config.maxDimension) {
      throw new Error(`Image dimensions exceed maximum allowed (${this.config.maxDimension}px)`);
    }

    if ((metadata.width || 0) < this.config.minDimension || (metadata.height || 0) < this.config.minDimension) {
      throw new Error(`Image dimensions below minimum required (${this.config.minDimension}px)`);
    }

    return true;
  }

  async validateMask(buffer: Buffer, width: number, height: number): Promise<boolean> {
    // Same validation as image for Recraft
    return this.validateImage(buffer, width, height);
  }
}
