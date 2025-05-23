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

    // Ensure mask has the same dimensions as the original image
    const processedMaskBuffer = await sharp(maskBuffer)
      .resize(originalWidth, originalHeight, { 
        fit: 'fill',
        kernel: sharp.kernel.nearest 
      })
      .toFormat('png')
      .toBuffer();

    // Create File objects for OpenAI API
    const imageFile = new File([imageBuffer], 'image.png', { type: 'image/png' });
    const maskFile = new File([processedMaskBuffer], 'mask.png', { type: 'image/png' });

    console.log('Calling OpenAI API with masked image edit...');
    
    // Call OpenAI API to edit the image with the mask
    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      mask: maskFile,
      prompt: prompt,
      n: 1,
      size: "1024x1024"
    });

    // Check if result is defined before accessing data
    if (!result) {
      console.error('OpenAI response object is undefined.');
      throw new Error('Failed to get response from OpenAI');
    }

    // Extract the image data from the response (handle both URL and base64 formats)
    const imageUrl = result.data?.[0]?.url;
    const imageB64Json = result.data?.[0]?.b64_json;

    let openaiResultBuffer: Buffer;

    if (imageB64Json) {
      // Handle base64 response
      console.log('Processing base64 image response from OpenAI');
      openaiResultBuffer = Buffer.from(imageB64Json, 'base64');
    } else if (imageUrl) {
      // Handle URL response
      console.log('Processing URL image response from OpenAI');
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error('Failed to fetch the edited image from OpenAI');
      }
      
      const resultBuffer = await imageResponse.arrayBuffer();
      openaiResultBuffer = Buffer.from(resultBuffer);
    } else {
      console.error('No image URL or base64 data found in OpenAI response:', result);
      throw new Error('Failed to retrieve image data from OpenAI');
    }

    console.log('Compositing OpenAI result with original image...');
    
    // Composite the OpenAI result with the original image using the mask
    // Step 1: Resize OpenAI result to match original image dimensions
    const resizedOpenaiResult = await sharp(openaiResultBuffer)
      .resize(originalWidth, originalHeight, { 
        fit: 'fill',
        kernel: sharp.kernel.lanczos3 
      })
      .toFormat('png')
      .toBuffer();

    // Step 2: Use the mask as an alpha channel to composite the images
    // Convert mask to grayscale and use it as alpha channel for the OpenAI result
    const maskAsAlpha = await sharp(processedMaskBuffer)
      .greyscale()
      .toBuffer();

    // Step 3: Create RGBA version of OpenAI result with mask as alpha channel
    const openaiWithAlpha = await sharp(resizedOpenaiResult)
      .ensureAlpha()
      .composite([{
        input: maskAsAlpha,
        blend: 'dest-in'
      }])
      .toBuffer();

    // Step 4: Composite the masked OpenAI result over the original image
    const resultBufferNode = await sharp(imageBuffer)
      .composite([{
        input: openaiWithAlpha,
        blend: 'over'
      }])
      .toFormat('png')
      .toBuffer();

    console.log('Image compositing completed successfully');

    // Save the mask image to Supabase Storage
    const maskFileName = `${user.id}-mask-${Date.now()}.png`;
    const { error: maskUploadError } = await supabase.storage
      .from('masks')
      .upload(maskFileName, processedMaskBuffer);

    if (maskUploadError) {
      console.error('Error uploading mask:', maskUploadError);
      // Continue even if mask upload fails
    }

    // Save the result image to Supabase Storage
    const resultFileName = `${user.id}-result-${Date.now()}.png`;
    const { error: resultUploadError } = await supabase.storage
      .from('edited-images')
      .upload(resultFileName, resultBufferNode);

    if (resultUploadError) {
      console.error('Error uploading result image:', resultUploadError);
      throw new Error('Failed to save the edited image');
    }

    // Get the public URL for the result image
    const { data: { publicUrl: resultPublicUrl } } = supabase.storage
      .from('edited-images')
      .getPublicUrl(resultFileName);

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

    // Save the edit record to the database
    const { error: dbError } = await supabase
      .from('image_edits')
      .insert([
        {
          user_id: user.id,
          original_image_id: originalImageData?.id || null,
          mask_storage_path: maskFileName,
          result_storage_path: resultFileName,
          prompt: prompt
        }
      ]);

    if (dbError) {
      console.error('Error saving edit record:', dbError);
      // Continue even if database record fails
    }

    // Convert buffer to base64 for backward compatibility
    const imageB64 = resultBufferNode.toString('base64');

    // Return the result
    return NextResponse.json({
      editedImageB64: imageB64,
      editedImageUrl: resultPublicUrl,
      editedImagePath: resultFileName
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
