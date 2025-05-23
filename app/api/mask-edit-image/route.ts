import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import { createServerSupabaseClient } from '@/lib/supabase';
import { useToken } from '@/lib/tokenService';
import { featureFlags } from '@/lib/config';

// Instantiate OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  if (!openai.apiKey) {
    console.error('OPENAI_API_KEY is not set.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const imagePath = formData.get('imagePath') as string | null;
    const maskData = formData.get('maskData') as string | null;
    const prompt = formData.get('prompt') as string | null;
    const sessionId = formData.get('sessionId') as string | null;

    // Validate required fields
    if (!imagePath) {
      return NextResponse.json({ error: 'Image path is required' }, { status: 400 });
    }
    if (!maskData) {
      return NextResponse.json({ error: 'Mask data is required' }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }
    if (!sessionId && featureFlags.showTokenPurchase) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Check token availability if token purchase feature is enabled
    if (featureFlags.showTokenPurchase) {
      const hasTokens = useToken(sessionId!);
      if (!hasTokens) {
        return NextResponse.json({ 
          error: 'No tokens available. Please purchase tokens to use this feature.',
          needTokens: true 
        }, { status: 402 }); // 402 Payment Required
      }
    }

    // Initialize Supabase client
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Fetch the original image from Supabase Storage
    const { data: imageData, error: imageError } = await supabase.storage
      .from('images')
      .download(imagePath);

    if (imageError || !imageData) {
      console.error('Error fetching original image:', imageError);
      return NextResponse.json({ error: 'Failed to fetch the original image' }, { status: 500 });
    }

    // Convert the image to PNG format for OpenAI API
    const imageBuffer = await sharp(await imageData.arrayBuffer())
      .toFormat('png')
      .toBuffer();

    // Convert the mask data URL to a buffer
    const maskBase64 = maskData.replace(/^data:image\/png;base64,/, '');
    const maskBuffer = Buffer.from(maskBase64, 'base64');

    // Get original image dimensions
    const imageMetadata = await sharp(await imageData.arrayBuffer()).metadata();
    const originalWidth = imageMetadata.width;
    const originalHeight = imageMetadata.height;

    if (!originalWidth || !originalHeight) {
      return NextResponse.json({ error: 'Could not determine image dimensions' }, { status: 400 });
    }

    console.log(`Original image dimensions: ${originalWidth}x${originalHeight}`);

    // For OpenAI API, we need to use one of the supported sizes: 256x256, 512x512, or 1024x1024
    // We'll choose the size that best fits while maintaining aspect ratio
    const maxDimension = Math.max(originalWidth, originalHeight);
    let targetSize: 256 | 512 | 1024;
    let sizeParam: "256x256" | "512x512" | "1024x1024";

    if (maxDimension <= 256) {
      targetSize = 256;
      sizeParam = "256x256";
    } else if (maxDimension <= 512) {
      targetSize = 512;
      sizeParam = "512x512";
    } else {
      targetSize = 1024;
      sizeParam = "1024x1024";
    }

    console.log(`Using OpenAI size: ${sizeParam}`);

    // Create a square canvas with the target size and place the image in the center
    // This preserves the original aspect ratio and scale relationship
    const aspectRatio = originalWidth / originalHeight;
    let scaledWidth: number, scaledHeight: number;

    if (aspectRatio >= 1) {
      // Landscape or square
      scaledWidth = targetSize;
      scaledHeight = Math.round(targetSize / aspectRatio);
    } else {
      // Portrait
      scaledHeight = targetSize;
      scaledWidth = Math.round(targetSize * aspectRatio);
    }

    // Calculate positioning to center the image
    const offsetX = Math.round((targetSize - scaledWidth) / 2);
    const offsetY = Math.round((targetSize - scaledHeight) / 2);

    console.log(`Scaled dimensions: ${scaledWidth}x${scaledHeight}, offset: ${offsetX},${offsetY}`);

    // Create a square canvas with black background and place the resized image in the center
    const squareImageBuffer = await sharp({
      create: {
        width: targetSize,
        height: targetSize,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    })
    .composite([{
      input: await sharp(imageBuffer)
        .resize(scaledWidth, scaledHeight, { 
          fit: 'fill',
          kernel: sharp.kernel.lanczos3 
        })
        .toBuffer(),
      left: offsetX,
      top: offsetY
    }])
    .png()
    .toBuffer();

    // Create a corresponding square mask with the same positioning
    const squareMaskBuffer = await sharp({
      create: {
        width: targetSize,
        height: targetSize,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    })
    .composite([{
      input: await sharp(maskBuffer)
        .resize(scaledWidth, scaledHeight, { 
          fit: 'fill',
          kernel: sharp.kernel.nearest 
        })
        .toBuffer(),
      left: offsetX,
      top: offsetY
    }])
    .png()
    .toBuffer();

    // Create File objects for OpenAI API
    const imageFile = new File([squareImageBuffer], 'image.png', { type: 'image/png' });
    const maskFile = new File([squareMaskBuffer], 'mask.png', { type: 'image/png' });

    console.log('Calling OpenAI API with masked image edit...');
    
    // Call OpenAI API to edit the image with the mask - generate 3 options
    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      mask: maskFile,
      prompt: prompt,
      n: 3, // Generate 3 options
      size: sizeParam,
      quality: "low" // Use low quality for faster generation
    });

    // Check if result is defined before accessing data
    if (!result || !result.data || result.data.length === 0) {
      console.error('OpenAI response object is undefined or empty.');
      throw new Error('Failed to get response from OpenAI');
    }

    console.log(`Processing ${result.data.length} images from OpenAI...`);

    // Process all images from the response
    const processedImages = [];
    
    // Create original-sized mask for compositing
    const originalSizedMaskBuffer = await sharp(maskBuffer)
      .resize(originalWidth, originalHeight, { 
        fit: 'fill',
        kernel: sharp.kernel.nearest 
      })
      .toFormat('png')
      .toBuffer();

    // Convert original-sized mask to grayscale for compositing
    const maskAsAlpha = await sharp(originalSizedMaskBuffer)
      .greyscale()
      .toBuffer();

    for (let i = 0; i < result.data.length; i++) {
      const imageData = result.data[i];
      const imageUrl = imageData?.url;
      const imageB64Json = imageData?.b64_json;

      let openaiResultBuffer: Buffer;

      if (imageB64Json) {
        // Handle base64 response
        console.log(`Processing base64 image ${i + 1} response from OpenAI`);
        openaiResultBuffer = Buffer.from(imageB64Json, 'base64');
      } else if (imageUrl) {
        // Handle URL response
        console.log(`Processing URL image ${i + 1} response from OpenAI`);
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch edited image ${i + 1} from OpenAI`);
        }
        
        const resultBuffer = await imageResponse.arrayBuffer();
        openaiResultBuffer = Buffer.from(resultBuffer);
      } else {
        console.error(`No image URL or base64 data found in OpenAI response for image ${i + 1}:`, imageData);
        continue; // Skip this image and continue with others
      }

      console.log(`Compositing OpenAI result ${i + 1} with original image...`);
      
      // Extract the relevant portion from the square OpenAI result
      const croppedOpenaiResult = await sharp(openaiResultBuffer)
        .extract({
          left: offsetX,
          top: offsetY,
          width: scaledWidth,
          height: scaledHeight
        })
        .resize(originalWidth, originalHeight, { 
          fit: 'fill',
          kernel: sharp.kernel.lanczos3 
        })
        .toFormat('png')
        .toBuffer();

      // Step 2: Create RGBA version of OpenAI result with mask as alpha channel
      const openaiWithAlpha = await sharp(croppedOpenaiResult)
        .ensureAlpha()
        .composite([{
          input: maskAsAlpha,
          blend: 'dest-in'
        }])
        .toBuffer();

      // Step 3: Composite the masked OpenAI result over the original image
      const resultBufferNode = await sharp(imageBuffer)
        .composite([{
          input: openaiWithAlpha,
          blend: 'over'
        }])
        .toFormat('png')
        .toBuffer();

      // Save the result image to Supabase Storage
      const resultFileName = `${user.id}-result-${Date.now()}-option${i + 1}.png`;
      const { error: resultUploadError } = await supabase.storage
        .from('edited-images')
        .upload(resultFileName, resultBufferNode);

      if (resultUploadError) {
        console.error(`Error uploading result image ${i + 1}:`, resultUploadError);
        continue; // Skip this image and continue with others
      }

      // Get the public URL for the result image
      const { data: { publicUrl: resultPublicUrl } } = supabase.storage
        .from('edited-images')
        .getPublicUrl(resultFileName);

      // Convert buffer to base64
      const imageB64 = resultBufferNode.toString('base64');

      processedImages.push({
        editedImageB64: imageB64,
        editedImageUrl: resultPublicUrl,
        editedImagePath: resultFileName,
        optionNumber: i + 1
      });

      console.log(`Image ${i + 1} compositing completed successfully`);
    }

    if (processedImages.length === 0) {
      throw new Error('Failed to process any images from OpenAI response');
    }

    // Save the mask image to Supabase Storage (save the original-sized mask)
    const maskFileName = `${user.id}-mask-${Date.now()}.png`;
    const { error: maskUploadError } = await supabase.storage
      .from('masks')
      .upload(maskFileName, originalSizedMaskBuffer);

    if (maskUploadError) {
      console.error('Error uploading mask:', maskUploadError);
      // Continue even if mask upload fails
    }

    // Get the original image ID from the database using the storage path
    const { data: originalImageData, error: originalImageError } = await supabase
      .from('images')
      .select('id')
      .eq('storage_path', imagePath)
      .single();

    if (originalImageError) {
      console.error('Error fetching original image ID:', originalImageError);
      // Continue even if we can't get the original image ID
    }

    // Save edit records to the database for each processed image
    const editRecords = processedImages.map(img => ({
      user_id: user.id,
      original_image_id: originalImageData?.id || null,
      mask_storage_path: maskFileName,
      result_storage_path: img.editedImagePath,
      prompt: prompt
    }));

    const { error: dbError } = await supabase
      .from('image_edits')
      .insert(editRecords);

    if (dbError) {
      console.error('Error saving edit records:', dbError);
      // Continue even if database record fails
    }

    // Return all processed images
    return NextResponse.json({
      images: processedImages,
      maskPath: maskFileName,
      totalOptions: processedImages.length
    });

  } catch (error: any) {
    console.error('Error processing masked image:', error);
    
    if (error instanceof OpenAI.APIError) {
      console.error('OpenAI API Error Details:', {
        status: error.status,
        code: error.code,
        type: error.type,
        message: error.message,
        headers: error.headers
      });
    }
    
    const errorMessage = error.message || 'Failed to process image';
    const errorStatus = error instanceof OpenAI.APIError ? (error.status || 500) : 500;

    return NextResponse.json(
      { error: errorMessage },
      { status: errorStatus }
    );
  }
}
