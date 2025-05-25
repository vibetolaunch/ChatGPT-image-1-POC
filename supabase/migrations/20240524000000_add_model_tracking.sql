-- Add model tracking columns to image_edits table
ALTER TABLE image_edits 
ADD COLUMN IF NOT EXISTS model_used VARCHAR(50) DEFAULT 'recraft',
ADD COLUMN IF NOT EXISTS model_version VARCHAR(20) DEFAULT 'v3';

-- Create index for better query performance on model_used
CREATE INDEX IF NOT EXISTS idx_image_edits_model_used ON image_edits(model_used);

-- Update existing records to have default values
UPDATE image_edits 
SET model_used = 'openai', model_version = 'gpt-image-1' 
WHERE model_used IS NULL;
