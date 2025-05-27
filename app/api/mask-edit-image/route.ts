import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { createServerSupabaseClient } from '@/lib/supabase';
import { useToken } from '@/lib/tokenService';
import { featureFlags, imageModels } from '@/lib/config';
import { ImageProviderFactory } from '@/lib/providers/ImageProviderFactory';
import { ImageEditParams } from '@/lib/providers/types'; // Import ImageEditParams

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imagePath = formData.get('imagePath') as string | null;
    const maskData = formData.get('maskData') as string | null;
    const prompt = formData.get('prompt') as string | null;
    const sessionId = formData.get('sessionId') as string | null;
    const modelName = formData.get('model') as string | null; // Optional model selection

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

    // Get the selected model (defaults to Recraft)
    const selectedModel = modelName || imageModels.default;
    const modelConfig = ImageProviderFactory.getModelConfig(selectedModel);
    
    console.log(`Using model: ${selectedModel} (${modelConfig.name})`);

    // Get the appropriate provider
    const provider = ImageProviderFactory.getProvider(selectedModel);

    // All images now use the 'images' bucket since AI-generated images are converted to regular images when applied
    const bucket = 'images';
    
    // Function to try downloading with different extensions
    const tryDownload = async (path: string) => {
      const extensions = ['', '.png', '.jpg', '.jpeg', '.webp'];
      
      for (const ext of extensions) {
        const fullPath = path + ext;
        console.log('Attempting to download image from path:', fullPath, 'in bucket:', bucket);
        
        const { data, error } = await supabase.storage
          .from(bucket)
          .download(fullPath);
          
        if (!error && data) {
          console.log('Successfully downloaded from path:', fullPath);
          return { data, error: null, actualPath: fullPath };
        }
        
        console.log('Failed to download from path:', fullPath, 'Error:', error?.message);
      }
      
      return { data: null, error: new Error('File not found with any extension'), actualPath: null };
    };

    // Try to fetch the original image from Supabase Storage
    const { data: imageData, error: imageError, actualPath } = await tryDownload(imagePath);

    if (imageError || !imageData) {
      console.error('Error fetching original image:', {
        imagePath,
        bucket,
        error: imageError,
        errorMessage: imageError?.message
      });
      
      const errorMessage = `Failed to fetch the original image: ${imageError?.message || 'Unknown error'}`;
      
      return NextResponse.json({
        error: errorMessage,
        imagePath: imagePath,
        bucket: bucket
      }, { status: 500 });
    }
    
    console.log('Successfully fetched image from:', actualPath);

    // Convert the image to PNG format
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

    // Use the provider to edit the image
    let providerOptions: ImageEditParams['options'] = {
      negativePrompt: formData.get('negativePrompt') as string || undefined,
    };

    if (selectedModel === 'stabilityai') {
      providerOptions.style = formData.get('style') as string || undefined; // Will map to style_preset
      providerOptions.cfgScale = formData.get('cfgScale') ? parseFloat(formData.get('cfgScale') as string) : undefined;
      providerOptions.steps = formData.get('steps') ? parseInt(formData.get('steps') as string, 10) : undefined;
      providerOptions.samples = formData.get('samples') ? parseInt(formData.get('samples') as string, 10) : undefined;
      providerOptions.seed = formData.get('seed') ? parseInt(formData.get('seed') as string, 10) : undefined;
      // model option in ImageEditParams can be used for engineId if needed, but provider uses its own config.
    } else if (selectedModel === 'replicate') {
      providerOptions.cfgScale = formData.get('cfgScale') ? parseFloat(formData.get('cfgScale') as string) : undefined;
      providerOptions.steps = formData.get('steps') ? parseInt(formData.get('steps') as string, 10) : undefined;
      providerOptions.seed = formData.get('seed') ? parseInt(formData.get('seed') as string, 10) : undefined;
      providerOptions.negativePrompt = formData.get('negativePrompt') as string || undefined;
    }
    // For OpenAI, similar logic would apply if implemented

    console.log('Calling provider.editImage with:', {
      imageBufferSize: imageBuffer.length,
      maskBufferSize: maskBuffer.length,
      prompt: prompt,
      originalWidth: originalWidth,
      originalHeight: originalHeight,
      options: providerOptions,
      provider: selectedModel
    });

    const results = await provider.editImage({
      image: imageBuffer,
      mask: maskBuffer,
      prompt: prompt,
      originalWidth: originalWidth,
      originalHeight: originalHeight,
      options: providerOptions,
    });

    if (results.length === 0) {
      throw new Error(`No images returned from ${modelConfig.name}`);
    }

    console.log(`Successfully processed ${results.length} images using ${modelConfig.name}`);

    // Save the mask image to Supabase Storage for record keeping
    const maskFileName = `${user.id}-mask-${Date.now()}.png`;
    const { error: maskUploadError } = await supabase.storage
      .from('masks')
      .upload(maskFileName, maskBuffer);

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
    const editRecords = results.map(img => ({
      user_id: user.id,
      original_image_id: originalImageData?.id || null,
      mask_storage_path: maskFileName,
      result_storage_path: img.editedImagePath,
      prompt: prompt,
      model_used: selectedModel,
      model_version: selectedModel === 'stabilityai'
        ? (modelConfig as typeof imageModels.models.stabilityai).engineId
        : 'gpt-image-1' // Fallback for others
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
      images: results,
      maskPath: maskFileName,
      totalOptions: results.length,
      model: modelConfig.name,
      provider: modelConfig.provider
    });

  } catch (error: any) {
    console.error('Error processing masked image:', error);
    console.error('Error stack:', error.stack);
    
    // Enhanced error handling for different providers
    let errorMessage = error.message || 'Failed to process image';
    let errorStatus = 500;

    if (error.message?.includes('API key is not configured')) {
      errorMessage = 'Service configuration error. Please contact support.';
      errorStatus = 503;
    } else if (error.message?.includes('API error') || error.message?.includes('Stability AI API error')) {
      // Provide more specific error information for debugging
      errorMessage = `External service error: ${error.message}. Please try again.`;
      errorStatus = 502;
    } else if (error.message?.includes('file size') || error.message?.includes('resolution') || error.message?.includes('dimensions')) {
      errorStatus = 400;
    } else if (error.message?.includes('No images returned')) {
      errorMessage = 'No images were generated by the AI service. Please try a different prompt or image.';
      errorStatus = 422;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: errorStatus }
    );
  }
}
