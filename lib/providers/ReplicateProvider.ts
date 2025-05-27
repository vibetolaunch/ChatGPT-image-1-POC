import Replicate from 'replicate';
import sharp from 'sharp';
import { createServerSupabaseClient } from '@/lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { imageModels } from '@/lib/config';
import { ImageProvider, ImageEditParams, ImageResult } from './types';

export class ReplicateProvider implements ImageProvider {
  private replicate: Replicate;
  private config: typeof imageModels.models.replicate;

  constructor() {
    this.config = imageModels.models.replicate;
    if (!this.config.apiKey) {
      throw new Error('Replicate API key is not configured');
    }
    
    this.replicate = new Replicate({
      auth: this.config.apiKey,
    });
  }

  async editImage(params: ImageEditParams): Promise<ImageResult[]> {
    const { image, mask, prompt, originalWidth, originalHeight, options } = params;

    console.log('Starting Replicate image edit process...');
    console.log('Using SDXL inpainting model:', this.config.model);

    // 1. Validate inputs
    await this.validateImage(image, originalWidth, originalHeight);
    await this.validateMask(mask, originalWidth, originalHeight);
    console.log('Input image and mask validated.');

    // 2. Prepare mask (ensure white = edit area, black = keep area)
    const processedMaskBuffer = await this.convertMaskForReplicate(mask);
    console.log('Mask prepared for Replicate (white = edit area).');

    // 3. Convert buffers to base64 for Replicate API
    const imageBase64 = `data:image/png;base64,${image.toString('base64')}`;
    const maskBase64 = `data:image/png;base64,${processedMaskBuffer.toString('base64')}`;

    // 4. Create prediction with SDXL inpainting
    console.log('Creating prediction with Replicate...');
    
    const input = {
      image: imageBase64,
      mask: maskBase64,
      prompt: prompt,
      num_outputs: this.config.maxImages || 1,
      guidance_scale: options?.cfgScale || 7.5,
      num_inference_steps: options?.steps || 25,
      ...(options?.seed && { seed: options.seed }),
      ...(options?.negativePrompt && { negative_prompt: options.negativePrompt }),
    };

    let prediction;
    try {
      prediction = await this.replicate.predictions.create({
        version: this.config.model.split(':')[1], // Extract version from model string
        input,
      });
    } catch (error) {
      console.error('Error creating prediction:', error);
      throw new Error(`Failed to create Replicate prediction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log('Prediction created:', prediction.id);

    // 5. Poll for completion
    const startTime = Date.now();
    const timeout = this.config.timeout || 60000; // 60 seconds default

    while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
      if (Date.now() - startTime > timeout) {
        throw new Error('Replicate prediction timed out after 60 seconds');
      }

      await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every second

      try {
        prediction = await this.replicate.predictions.get(prediction.id);
      } catch (error) {
        console.error('Error polling prediction:', error);
        throw new Error(`Failed to get prediction status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      console.log(`Prediction status: ${prediction.status}`);
    }

    if (prediction.status === 'failed') {
      throw new Error(`Replicate prediction failed: ${prediction.error || 'Unknown error'}`);
    }

    // 6. Process results
    const output = prediction.output as string | string[];
    const outputs = Array.isArray(output) ? output : [output];
    
    if (!outputs || outputs.length === 0) {
      throw new Error('No images returned from Replicate');
    }

    console.log(`Received ${outputs.length} image(s) from Replicate`);

    // 7. Download, composite, and upload results
    const processedResults: ImageResult[] = [];
    const supabase: SupabaseClient = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated for saving images.');
    }

    for (let i = 0; i < outputs.length; i++) {
      const resultUrl = outputs[i];
      
      try {
        // Download the result image
        console.log(`Downloading result image ${i + 1}...`);
        const response = await fetch(resultUrl);
        if (!response.ok) {
          throw new Error(`Failed to download result: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const editedImageBuffer = Buffer.from(arrayBuffer);

        // Composite with original image
        const finalImageBuffer = await this.compositeWithOriginal(
          image,
          editedImageBuffer,
          processedMaskBuffer,
          originalWidth,
          originalHeight
        );

        // Upload to Supabase
        const resultFileName = `${user.id}-result-replicate-${Date.now()}-option${i + 1}.png`;
        const { error: uploadError } = await supabase.storage
          .from('edited-images')
          .upload(resultFileName, finalImageBuffer, { contentType: 'image/png' });

        if (uploadError) {
          console.error(`Error uploading result image ${i + 1} to Supabase:`, uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('edited-images')
          .getPublicUrl(resultFileName);

        processedResults.push({
          editedImageB64: finalImageBuffer.toString('base64'),
          editedImageUrl: publicUrl,
          editedImagePath: resultFileName,
          optionNumber: i + 1,
        });

        console.log(`Replicate image ${i + 1} processed and uploaded successfully.`);
      } catch (error) {
        console.error(`Error processing result ${i + 1}:`, error);
      }
    }

    if (processedResults.length === 0) {
      throw new Error('No images were successfully processed by Replicate.');
    }

    return processedResults;
  }

  private async convertMaskForReplicate(rgbaMaskBuffer: Buffer): Promise<Buffer> {
    console.log('Converting mask for Replicate (white = edit area)...');
    
    // Get raw pixel data from the mask
    const { data: maskData, info } = await sharp(rgbaMaskBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { width, height, channels } = info;
    console.log(`Processing mask: ${width}x${height}, channels: ${channels}`);
    
    // Create binary mask where white = edit area, black = keep area
    const binaryMask = Buffer.alloc(width * height);
    
    for (let i = 0; i < width * height; i++) {
      const pixelIndex = i * channels;
      
      if (channels === 4) { // RGBA
        const alpha = maskData[pixelIndex + 3];
        // If alpha > 0, there's painted content (user wants to edit this area)
        // For Replicate: painted areas should be WHITE (255)
        binaryMask[i] = alpha > 0 ? 255 : 0;
      } else if (channels === 3) { // RGB
        const r = maskData[pixelIndex];
        const g = maskData[pixelIndex + 1];
        const b = maskData[pixelIndex + 2];
        // If it's dark (painted), make it white for editing
        const brightness = (r + g + b) / 3;
        binaryMask[i] = brightness < 128 ? 255 : 0;
      } else { // Grayscale
        const gray = maskData[pixelIndex];
        // If it's dark (painted), make it white for editing
        binaryMask[i] = gray < 128 ? 255 : 0;
      }
    }
    
    // Create final binary PNG mask
    const processedMask = await sharp(binaryMask, {
      raw: {
        width,
        height,
        channels: 1
      }
    })
    .png()
    .toBuffer();
    
    console.log('Mask conversion complete: painted areas -> white (edit), transparent -> black (keep)');
    
    return processedMask;
  }

  private async compositeWithOriginal(
    originalImage: Buffer,
    editedImage: Buffer,
    maskBuffer: Buffer,
    width: number,
    height: number
  ): Promise<Buffer> {
    console.log('Compositing Replicate result with original image...');

    // Ensure all images are the same size
    const [resizedOriginal, resizedEdited, resizedMask] = await Promise.all([
      sharp(originalImage).resize(width, height, { fit: 'fill' }).toBuffer(),
      sharp(editedImage).resize(width, height, { fit: 'fill' }).toBuffer(),
      sharp(maskBuffer).resize(width, height, { fit: 'fill' }).toBuffer()
    ]);

    // Get mask data to create alpha channels
    const { data: maskData } = await sharp(resizedMask)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Create alpha masks for compositing
    const alphaMaskForOriginal = Buffer.alloc(width * height);
    const alphaMaskForEdited = Buffer.alloc(width * height);

    for (let i = 0; i < maskData.length; i++) {
      // White pixel (255) = Edit area
      // Black pixel (0) = Keep area
      if (maskData[i] === 255) { // White pixel = Edit area
        alphaMaskForOriginal[i] = 0;   // Original transparent
        alphaMaskForEdited[i] = 255;   // Edited opaque
      } else { // Black pixel = Keep area
        alphaMaskForOriginal[i] = 255; // Original opaque
        alphaMaskForEdited[i] = 0;     // Edited transparent
      }
    }

    // Apply alpha masks to create compositable images
    const originalWithAlpha = await sharp(resizedOriginal)
      .ensureAlpha()
      .composite([{
        input: Buffer.from(alphaMaskForOriginal),
        raw: { width: width, height: height, channels: 1 },
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    const editedWithAlpha = await sharp(resizedEdited)
      .ensureAlpha()
      .composite([{
        input: Buffer.from(alphaMaskForEdited),
        raw: { width: width, height: height, channels: 1 },
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    // Composite the final result
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([
      { input: originalWithAlpha, blend: 'over' },
      { input: editedWithAlpha, blend: 'over' }
    ])
    .png()
    .toBuffer();
  }

  async validateImage(buffer: Buffer, width: number, height: number): Promise<boolean> {
    const metadata = await sharp(buffer).metadata();
    const fileSize = buffer.length;
    const imageWidth = metadata.width!;
    const imageHeight = metadata.height!;

    if (fileSize > this.config.maxFileSize) {
      throw new Error(`Image file size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed (${this.config.maxFileSize / 1024 / 1024}MB)`);
    }

    // Basic dimension checks
    if (imageWidth < 256 || imageHeight < 256) {
      throw new Error(`Image dimensions (${imageWidth}x${imageHeight}) must be at least 256px on each side.`);
    }

    if (imageWidth > 2048 || imageHeight > 2048) {
      throw new Error(`Image dimensions (${imageWidth}x${imageHeight}) exceed max allowed 2048px on a side.`);
    }

    return true;
  }

  async validateMask(buffer: Buffer, width: number, height: number): Promise<boolean> {
    const metadata = await sharp(buffer).metadata();
    const maskWidth = metadata.width!;
    const maskHeight = metadata.height!;

    // Basic validation - mask should have reasonable dimensions
    if (maskWidth < 1 || maskHeight < 1) {
      throw new Error('Invalid mask dimensions');
    }

    return true;
  }
}
