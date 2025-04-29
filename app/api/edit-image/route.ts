import { NextResponse } from 'next/server';
import OpenAI from 'openai';

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

    if (!imageFile) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    // Log file size
    console.log(`Received image file size: ${imageFile.size} bytes`);

    // OpenAI API specifically requires PNG for edit/variation.
    // Check if the received file type is PNG and return error if not.
    if (imageFile.type !== 'image/png') {
        console.error(`Invalid file type: ${imageFile.type}. OpenAI requires image/png for variations/edits.`);
        // Reject non-PNG uploads upfront
        return NextResponse.json({ error: 'Invalid file type. Only image/png is supported.' }, { status: 400 });
    }

    console.log('Received image:', { name: imageFile.name, type: imageFile.type, size: imageFile.size });
    console.log('Received description:', description);

    let result: OpenAI.Images.ImagesResponse;

    if (description && description.trim() !== "") {
      // --- Edit Image ---
      console.log(`Calling openai.images.edit with File object: ${imageFile.name}`);
      result = await openai.images.edit({
        model: "gpt-image-1",
        image: imageFile, // Pass the File object directly
        prompt: description,
        n: 1,
        size: "1024x1024", 
      });
      console.log("Image edit result received.");
      console.log("OpenAI API Result:", JSON.stringify(result, null, 2)); // Log the full result object
    } else {
      // --- Create Variation ---
      console.log(`Calling openai.images.createVariation with File object: ${imageFile.name}`);
      result = await openai.images.createVariation({
        image: imageFile, // Pass the File object directly
        n: 1,
        size: "1024x1024", 
        response_format: 'b64_json',
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