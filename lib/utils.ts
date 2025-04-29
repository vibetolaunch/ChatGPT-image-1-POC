export async function convertFileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  // Determine the correct prefix based on the file type
  const prefix = `data:${file.type};base64,`;
  return prefix + base64;
} 