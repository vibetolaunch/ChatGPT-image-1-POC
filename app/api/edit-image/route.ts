import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import { useToken } from '../../../lib/tokenService';
import { featureFlags } from '../../../lib/config';

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
    const requestFormData = await request.formData();
    const imageFile = requestFormData.get('image') as File | null; // Allow null check
    const description = requestFormData.get('description') as string | null; // Allow null check
    const sessionId = requestFormData.get('sessionId') as string | null; // Get session ID

    if (!imageFile) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Only check tokens if the token purchase feature is enabled
    if (featureFlags.showTokenPurchase) {
      // Check if the user has available tokens
      const hasTokens = useToken(sessionId);
      if (!hasTokens) {
        return NextResponse.json({ 
          error: 'No tokens available. Please purchase tokens to use this feature.',
          needTokens: true 
        }, { status: 402 }); // 402 Payment Required
      }
    }

    // Log file size
    console.log(`Received image file size: ${imageFile.size} bytes`);

    // Check if the image is in a supported format
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/gif'].includes(imageFile.type)) {
      console.error(`Invalid file type: ${imageFile.type}. Only PNG, JPG/JPEG, and GIF are supported.`);
      return NextResponse.json({ error: 'Invalid file type. Only PNG, JPG/JPEG, and GIF are supported.' }, { status: 400 });
    }

    // Convert non-PNG images to PNG for OpenAI API
    let pngImageFile = imageFile;
    if (imageFile.type !== 'image/png') {
      console.log(`Converting ${imageFile.type} to PNG`);
      try {
        const arrayBuffer = await imageFile.arrayBuffer();
        const pngBuffer = await sharp(Buffer.from(arrayBuffer))
          .toFormat('png')
          .toBuffer();
        
        // Create a new File with PNG format
        const fileName = imageFile.name.replace(/\.[^/.]+$/, "") + ".png";
        pngImageFile = new File([pngBuffer], fileName, { type: 'image/png' });
        console.log(`Converted to PNG: ${pngImageFile.name}, size: ${pngImageFile.size} bytes`);
      } catch (err) {
        console.error('Error converting image to PNG:', err);
        return NextResponse.json({ error: 'Failed to process the image format' }, { status: 500 });
      }
    }

    console.log('Processed image:', { name: pngImageFile.name, type: pngImageFile.type, size: pngImageFile.size });
    console.log('Received description:', description);

    let result: OpenAI.Images.ImagesResponse;

    if (description && description.trim() !== "") {
      // --- Edit Image ---
      console.log(`Calling openai.images.edit with File object: ${pngImageFile.name}`);
      result = await openai.images.edit({
        model: "gpt-image-1",
        image: pngImageFile, // Use the PNG image
        prompt: description,
        n: 1,
        size: "1024x1024"
      });
      console.log("Image edit result received.");
      console.log("OpenAI API Result:", JSON.stringify(result, null, 2)); // Log the full result object
    } else {
      // --- Create Variation ---
      console.log(`Calling openai.images.createVariation with File object: ${pngImageFile.name}`);
      result = await openai.images.createVariation({
        image: pngImageFile, // Use the PNG image
        n: 1,
        size: "1024x1024", 
        response_format: 'b64_json'
      });
      console.log("Image variation result received.");
    }

    // Check if result is defined before accessing data
    if (!result) {
      console.error('OpenAI response object is undefined.');
      throw new Error('Failed to get response from OpenAI');
    }

    // Extract the base64 encoded image data
    const imageB64 = result.data?.[0]?.b64_json;

    if (!imageB64) {
      console.error('No base64 image data found in OpenAI response:', result);
      throw new Error('Failed to retrieve image data from OpenAI');
    }

    // Return the base64 string in the response
    return NextResponse.json({ editedImageB64: imageB64 });

  } catch (error: any) {
    console.error('Error processing image:', error);
    
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