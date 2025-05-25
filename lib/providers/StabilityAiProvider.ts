import sharp from 'sharp';
import { createServerSupabaseClient } from '@/lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { imageModels } from '@/lib/config';
import { ImageProvider, ImageEditParams, ImageResult, ProviderResponse } from './types'; // Assuming ProviderResponse might be useful, or define a StabilitySpecificResponse

// Helper function to create a FormData object, as it's not globally available in all Node.js environments
// without specific imports or polyfills. For server-side, 'form-data' package is common.
// However, Next.js API routes can handle native FormData from fetch.
// For now, we assume global FormData is available or polyfilled if needed for direct API calls.
// If not, we'd import 'form-data'.

export class StabilityAiProvider implements ImageProvider {
  private config: typeof imageModels.models.stabilityai;

  constructor() {
    this.config = imageModels.models.stabilityai;
    if (!this.config.apiKey) {
      throw new Error('Stability AI API key is not configured');
    }
  }

  async editImage(params: ImageEditParams): Promise<ImageResult[]> {
    const { image, mask, prompt, originalWidth, originalHeight, options } = params;

    if (!this.config.apiKey) {
      throw new Error('Stability AI API key is not configured.');
    }
    
    console.log('Starting Stability AI image edit process...');
    console.log('Received options:', options);

    // 1. Validate inputs
    await this.validateImage(image, originalWidth, originalHeight);
    await this.validateMask(mask, originalWidth, originalHeight);
    console.log('Input image and mask validated.');

    // 2. Mask Preparation
    // Assuming MASK_IMAGE_WHITE: white areas in the mask are inpainted.
    // Our current client-side mask drawing usually means drawn areas (e.g., black brush) are to be inpainted.
    // If client sends mask where black = edit area, white = keep area:
    // convertMaskToGrayscaleForStability needs to produce a mask where white = edit area.
    // The current `convertMaskToGrayscaleForStability` assumes transparent from RGBA becomes white (edit area).
    // Let's assume the mask from params.mask is RGBA where alpha channel indicates masked area.
    const processedMaskBuffer = await this.convertMaskToGrayscaleForStability(mask, 'MASK_IMAGE_WHITE');
    console.log('Mask prepared for Stability AI.');

    // 3. Image and Mask Resizing
    const { resizedBuffer: resizedImageBuffer, width: finalImageWidth, height: finalImageHeight } = await this.resizeImageForStability(image);
    const { resizedBuffer: resizedMaskBuffer } = await this.resizeImageForStability(processedMaskBuffer, true); // Resize mask to same dimensions
    console.log(`Image and mask resized to ${finalImageWidth}x${finalImageHeight}`);

    // 4. API Call
    const formData = new FormData();
    formData.append('init_image', new Blob([resizedImageBuffer], { type: 'image/png' }), 'init_image.png');
    formData.append('mask_image', new Blob([resizedMaskBuffer], { type: 'image/png' }), 'mask_image.png');
    formData.append('mask_source', 'MASK_IMAGE_WHITE'); // White pixels in mask_image are inpainted
    formData.append('text_prompts[0][text]', prompt);
    formData.append('text_prompts[0][weight]', '1'); // Positive prompt weight

    if (options?.negativePrompt) {
      formData.append('text_prompts[1][text]', options.negativePrompt);
      formData.append('text_prompts[1][weight]', '-1'); // Negative prompt weight
    }

    formData.append('cfg_scale', (options?.cfgScale || 7).toString()); // Default 7
    formData.append('samples', (options?.samples || this.config.maxImages || 1).toString()); // Default 1, or from config
    formData.append('steps', (options?.steps || 30).toString()); // Default 30, common range 30-50
    
    if (options?.seed) {
      formData.append('seed', options.seed.toString());
    }
    if (options?.style && this.config.supportedStylePresets.includes(options.style as any)) {
      formData.append('style_preset', options.style);
    } else if (this.config.defaultStylePreset) {
      formData.append('style_preset', this.config.defaultStylePreset);
    }
    // Add other Stability AI parameters as needed, e.g., sampler

    const apiEndpoint = `${this.config.endpoint}/v1/generation/${this.config.engineId}/image-to-image/masking`;
    console.log(`Calling Stability AI API: ${apiEndpoint}`);

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json', // Stability AI returns JSON
        'Authorization': `Bearer ${this.config.apiKey}`,
        // 'Content-Type': 'multipart/form-data' // Let browser/fetch set this with boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Stability AI API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Stability AI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const resultJson: { artifacts: Array<{ base64: string; seed: number; finishReason: string }> } = await response.json();
    console.log('Received response from Stability AI API.');

    if (!resultJson.artifacts || resultJson.artifacts.length === 0) {
      throw new Error('No images returned from Stability AI API');
    }

    // 5. Response Processing
    const processedResults: ImageResult[] = [];
    const supabase: SupabaseClient = await createServerSupabaseClient(); // Initialize and await here
    const { data: { user } } = await supabase.auth.getUser(); // Get user for naming files
     if (!user) {
      throw new Error('User not authenticated for saving images.');
    }


    for (let i = 0; i < resultJson.artifacts.length; i++) {
      const artifact = resultJson.artifacts[i];
      if (artifact.finishReason === 'SUCCESS') {
        const editedImageBuffer = Buffer.from(artifact.base64, 'base64');

        // Composite the edited part with the original image
        // The mask used for compositing should be the one that aligns with original dimensions
        // and has white for edit area, black for keep area.
        // The `processedMaskBuffer` is already in this format (grayscale, white=edit).
        // We need to resize it back to original dimensions for compositing.
        const compositingMask = await sharp(processedMaskBuffer)
            .resize(originalWidth, originalHeight, { fit: 'fill', kernel: sharp.kernel.nearest })
            .toBuffer();

        const finalImageBuffer = await this.compositeWithOriginal(
          image, // Original image buffer (before Stability-specific resizing)
          editedImageBuffer, // Result from Stability (already at Stability's processed dimensions)
          compositingMask, // Mask aligned with original dimensions
          originalWidth,
          originalHeight
        );
        
        // Adjusted filename to match RLS policy: {user_id}-result-{rest_of_filename}
        const resultFileName = `${user.id}-result-stability-${this.config.engineId}-${Date.now()}-option${i + 1}.png`;
        const { error: uploadError } = await supabase.storage // use local supabase const
          .from('edited-images') // Make sure this bucket exists and has correct policies
          .upload(resultFileName, finalImageBuffer, { contentType: 'image/png' });

        if (uploadError) {
          console.error(`Error uploading result image ${i + 1} to Supabase:`, uploadError);
          // Decide if we should skip this result or throw
          continue; 
        }

        const { data: { publicUrl } } = supabase.storage // use local supabase const
          .from('edited-images')
          .getPublicUrl(resultFileName);

        processedResults.push({
          editedImageB64: finalImageBuffer.toString('base64'),
          editedImageUrl: publicUrl,
          editedImagePath: resultFileName,
          optionNumber: i + 1,
        });
        console.log(`Stability AI image ${i + 1} processed and uploaded successfully.`);
      } else {
        console.warn(`Artifact ${i+1} from Stability AI did not succeed: ${artifact.finishReason}`);
      }
    }
    
    if (processedResults.length === 0) {
        throw new Error('No images were successfully processed by Stability AI.');
    }

    return processedResults;
  }

  private async convertMaskToGrayscaleForStability(
    rgbaMaskBuffer: Buffer,
    maskSourceType: 'MASK_IMAGE_WHITE' | 'MASK_IMAGE_BLACK' = 'MASK_IMAGE_WHITE' // Default: white is area to edit
  ): Promise<Buffer> {
    console.log(`Converting RGBA mask to grayscale for Stability AI (mask source: ${maskSourceType})...`);
    
    let sharpInstance = sharp(rgbaMaskBuffer).grayscale(); // Convert to grayscale first

    // If white is the edit area (transparent in original RGBA becomes white in grayscale)
    // and black is the keep area (opaque in original RGBA becomes black in grayscale)
    // The default grayscale conversion might be okay if alpha was handled correctly before this.
    // Typically, for inpainting, white pixels in the mask denote the area to be inpainted.
    // If MASK_IMAGE_WHITE: areas to change are white.
    // If MASK_IMAGE_BLACK: areas to change are black.
    
    // Assuming the input RGBA mask has transparency for areas to edit:
    // Transparent (alpha=0) areas should become WHITE if maskSourceType is MASK_IMAGE_WHITE
    // Opaque (alpha=255) areas should become BLACK if maskSourceType is MASK_IMAGE_WHITE

    // To ensure pure black and white, we can threshold.
    // The threshold value depends on how the initial grayscale conversion handles alpha.
    // If transparent becomes white-ish and opaque becomes black-ish:
    // A threshold around 128 would make light grays white and dark grays black.

    // Let's assume the mask from the client (after TLDRAW or Canvas)
    // has black for masked (edit) areas and white (or transparent) for unmasked.
    // If mask is black (0) for edit, white (255) for keep:
    //  - For MASK_IMAGE_WHITE: need to invert: black -> white, white -> black
    //  - For MASK_IMAGE_BLACK: keep as is.

    // The RecraftProvider's convertMaskToGrayscale does:
    // .grayscale().threshold().png()
    // This results in a binary image. We need to know if 0 is black or white.
    // Sharp's threshold defaults to 127, values <= 127 become black (0), > 127 become white (255).

    // Let's assume our input mask (e.g. from drawing tool) uses:
    // - Opaque color (e.g. black) for areas to KEEP.
    // - Transparent for areas to EDIT.
    // When converted to grayscale:
    // - Opaque black -> 0 (black)
    // - Transparent -> 255 (white) (if background for flatten is white, or if alpha is treated as white)
    // So, white (255) is the edit area. This matches MASK_IMAGE_WHITE.

    const processedMask = await sharpInstance
      .threshold() // Ensure binary black/white
      .png() // Output as PNG
      .toBuffer();
    
    const outputMetadata = await sharp(processedMask).metadata();
    console.log('Output mask for Stability (binary PNG) metadata:', outputMetadata);
    
    return processedMask;
  }
  
  private async resizeImageForStability(
    imageBuffer: Buffer,
    isMask: boolean = false
  ): Promise<{ resizedBuffer: Buffer; width: number; height: number }> {
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width!;
    const originalHeight = metadata.height!;
    const aspectRatio = originalWidth / originalHeight;

    const { pixelMultiple, minResolution, maxResolution, minDimension, maxDimension } = this.config;

    let targetWidth: number;
    let targetHeight: number;

    // Initial scaling to fit within maxResolution while maintaining aspect ratio
    if (originalWidth * originalHeight > maxResolution) {
      targetHeight = Math.sqrt(maxResolution / aspectRatio);
      targetWidth = targetHeight * aspectRatio;
    } else if (originalWidth * originalHeight < minResolution) {
      // Scale up to minResolution if too small (though API might handle this, good to be explicit)
      targetHeight = Math.sqrt(minResolution / aspectRatio);
      targetWidth = targetHeight * aspectRatio;
    }
     else {
      targetWidth = originalWidth;
      targetHeight = originalHeight;
    }

    // Adjust to be multiples of pixelMultiple (64)
    // Round to the nearest multiple, then check constraints.
    targetWidth = Math.round(targetWidth / pixelMultiple) * pixelMultiple;
    targetHeight = Math.round(targetHeight / pixelMultiple) * pixelMultiple;
    
    // Ensure dimensions are not zero after rounding
    if (targetWidth === 0) targetWidth = pixelMultiple;
    if (targetHeight === 0) targetHeight = pixelMultiple;

    // Iteratively adjust if current resolution exceeds maxResolution after rounding to pixelMultiple
    while (targetWidth * targetHeight > maxResolution) {
      if (targetWidth > targetHeight && targetWidth > pixelMultiple) {
        targetWidth -= pixelMultiple;
      } else if (targetHeight > pixelMultiple) {
        targetHeight -= pixelMultiple;
      } else {
        // Both are at their minimum multiple, but still too large (shouldn't happen if maxResolution is reasonable)
        break; 
      }
    }
    
    // Ensure dimensions are not zero after adjustment
    if (targetWidth === 0) targetWidth = pixelMultiple;
    if (targetHeight === 0) targetHeight = pixelMultiple;

    // Check against minResolution again after adjustments
    // If it fell below minResolution due to fitting maxResolution and pixelMultiple, try to upscale slightly if possible
    // This part can be tricky; for now, prioritize maxResolution and pixelMultiple.
    // The API will error if it's still too small.

    // Clamp to configured min/max individual dimensions
    targetWidth = Math.max(minDimension, Math.min(targetWidth, maxDimension));
    targetHeight = Math.max(minDimension, Math.min(targetHeight, maxDimension));

    // Final pass to ensure multiple of 64 after clamping (as clamping might break it)
    targetWidth = Math.round(targetWidth / pixelMultiple) * pixelMultiple;
    targetHeight = Math.round(targetHeight / pixelMultiple) * pixelMultiple;
    if (targetWidth === 0) targetWidth = pixelMultiple;
    if (targetHeight === 0) targetHeight = pixelMultiple;
    
    // One last check for maxResolution, and reduce if necessary
    while (targetWidth * targetHeight > maxResolution) {
        if (targetWidth > targetHeight && targetWidth > pixelMultiple) {
            targetWidth -= pixelMultiple;
        } else if (targetHeight > pixelMultiple) {
            targetHeight -= pixelMultiple;
        } else {
            break; 
        }
    }
    if (targetWidth === 0) targetWidth = pixelMultiple;
    if (targetHeight === 0) targetHeight = pixelMultiple;


    console.log(`Resizing for Stability: Original ${originalWidth}x${originalHeight} -> Target ${targetWidth}x${targetHeight}. Final Resolution: ${targetWidth * targetHeight}`);

    const resizedBuffer = await sharp(imageBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'contain', // Preserve aspect ratio, fit within target, background for letterboxing
        background: { r: 0, g: 0, b: 0, alpha: isMask ? 0 : 1 }, // Black background for image, transparent for mask
        kernel: isMask ? sharp.kernel.nearest : sharp.kernel.lanczos3,
      })
      .png() // Stability accepts PNG
      .toBuffer();
    
    const finalMetadata = await sharp(resizedBuffer).metadata();

    return { resizedBuffer, width: finalMetadata.width!, height: finalMetadata.height! };
  }

  // Reuse from RecraftProvider if possible, or adapt
  private async compositeWithOriginal(
    originalImage: Buffer,
    editedImage: Buffer,
    maskForCompositing: Buffer, // This should be the mask where white = edit, black = keep
    width: number,
    height: number
  ): Promise<Buffer> {
    console.log('Compositing Stability AI result with original image...');

    // Ensure mask is binary black/white for compositing logic
    const preparedMask = await sharp(maskForCompositing)
        .resize(width, height, { fit: 'fill', kernel: sharp.kernel.nearest })
        .threshold() // Ensure it's pure black and white
        .raw()
        .toBuffer({ resolveWithObject: true });

    const alphaMaskForOriginal = Buffer.alloc(width * height); // Opaque for original where mask is black
    const alphaMaskForEdited = Buffer.alloc(width * height);   // Opaque for edited where mask is white

    for (let i = 0; i < preparedMask.data.length; i++) {
        // Assuming mask data is single channel (grayscale)
        // If mask pixel is white (255), it's an edit area. Original is transparent, edited is opaque.
        // If mask pixel is black (0), it's a keep area. Original is opaque, edited is transparent.
        if (preparedMask.data[i] === 255) { // White pixel = Edit area
            alphaMaskForOriginal[i] = 0;   // Original transparent
            alphaMaskForEdited[i] = 255; // Edited opaque
        } else { // Black pixel = Keep area
            alphaMaskForOriginal[i] = 255; // Original opaque
            alphaMaskForEdited[i] = 0;   // Edited transparent
        }
    }
    
    const originalWithAlpha = await sharp(originalImage)
      .resize(width, height, { fit: 'fill' })
      .ensureAlpha()
      .composite([{
        input: Buffer.from(alphaMaskForOriginal), // Use Buffer.from for raw pixel data
        raw: { width: width, height: height, channels: 1 },
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    const editedWithAlpha = await sharp(editedImage)
      .resize(width, height, { fit: 'fill' })
      .ensureAlpha()
      .composite([{
        input: Buffer.from(alphaMaskForEdited), // Use Buffer.from for raw pixel data
        raw: { width: width, height: height, channels: 1 },
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Start with a transparent canvas
      }
    })
    .composite([
      { input: originalWithAlpha, blend: 'over' }, // Draw original (masked)
      { input: editedWithAlpha, blend: 'over' }    // Draw edited (masked) over it
    ])
    .png()
    .toBuffer();
  }


  async validateImage(buffer: Buffer, width: number, height: number): Promise<boolean> {
    const metadata = await sharp(buffer).metadata();
    const fileSize = buffer.length; // in bytes
    const imageWidth = metadata.width!;
    const imageHeight = metadata.height!;
    const resolution = imageWidth * imageHeight;

    if (fileSize > this.config.maxFileSize) {
      throw new Error(`Image file size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed (${this.config.maxFileSize / 1024 / 1024}MB)`);
    }
    // The resizeImageForStability method will handle scaling down to the API's maxResolution.
    // This initial validation can be for very large images if needed, or rely on maxFileSize.
    // For now, removing the strict check against API's target maxResolution for the *original* image.
    // if (resolution > this.config.maxResolution) {
    //   throw new Error(`Image resolution (${imageWidth}x${imageHeight}=${resolution} pixels) exceeds maximum allowed for API (${this.config.maxResolution} pixels), will be resized.`);
    // }
    if (resolution < this.config.minResolution) {
      // This check is still relevant, as an image too small might not be usable even after upscaling.
      throw new Error(`Image resolution (${imageWidth}x${imageHeight}=${resolution} pixels) is below minimum required (${this.config.minResolution} pixels)`);
    }
    if (imageWidth % this.config.pixelMultiple !== 0 || imageHeight % this.config.pixelMultiple !== 0) {
      // This validation should ideally happen AFTER resizing, or be a soft warning if applied to original.
      // For now, we'll validate the original dimensions against this rule strictly.
      // console.warn(`Image dimensions ${imageWidth}x${imageHeight} are not multiples of ${this.config.pixelMultiple}. Will be resized.`);
      // For strict validation on original:
      // throw new Error(`Image dimensions (${imageWidth}x${imageHeight}) must be multiples of ${this.config.pixelMultiple}.`);
    }
    if (imageWidth < this.config.minDimension || imageHeight < this.config.minDimension) {
        throw new Error(`Image dimensions (${imageWidth}x${imageHeight}) must be at least ${this.config.minDimension}px on each side.`);
    }
    if (imageWidth > this.config.maxDimension || imageHeight > this.config.maxDimension) {
        throw new Error(`Image dimensions (${imageWidth}x${imageHeight}) exceed max allowed ${this.config.maxDimension}px on a side.`);
    }
    return true;
  }

  async validateMask(buffer: Buffer, width: number, height: number): Promise<boolean> {
    // Mask validation can be similar to image validation for dimensions
    // Stability AI expects a grayscale image for the mask.
    // The content of the mask (black/white areas) is also critical.
    // For now, dimensional validation:
    const metadata = await sharp(buffer).metadata();
    const maskWidth = metadata.width!;
    const maskHeight = metadata.height!;

    if (maskWidth !== width || maskHeight !== height) {
      // This check might be too strict if we resize masks.
      // console.warn(`Mask dimensions (${maskWidth}x${maskHeight}) do not match original image (${width}x${height}). It will be resized.`);
      // For now, let's assume they should match the original image before internal resizing.
    }
    // Apply similar pixel multiple and resolution checks as image if mask is sent as-is before internal processing
    // If mask is processed (e.g. resized to match processed image), then this validation is on the raw mask.
    // For now, basic check:
    if (maskWidth % this.config.pixelMultiple !== 0 || maskHeight % this.config.pixelMultiple !== 0) {
       // console.warn(`Mask dimensions ${maskWidth}x${maskHeight} are not multiples of ${this.config.pixelMultiple}. Will be resized if necessary.`);
    }
    return true;
  }
}
