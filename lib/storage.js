// ============================================================
// lib/storage.js — S3/Supabase Storage upload + CDN URL
// ============================================================
import { createClient } from '@supabase/supabase-js';

// Supabase Storage client (service role)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'jumbai-images';
const CDN_BASE_URL = process.env.CDN_BASE_URL || `https://${process.env.VERCEL_URL || 'jumbai.vercel.app'}`;

/**
 * Upload file binario a Supabase Storage
 * @param {Buffer|Uint8Array|Blob} fileData - Dati binari dell'immagine
 * @param {string} fileName - Nome file (es. 'user_123/gen_456.png')
 * @param {string} contentType - MIME type (default: 'image/png')
 * @returns {Promise<{url: string, path: string}>}
 */
export async function uploadToStorage(fileData, fileName, contentType = 'image/png') {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(fileName, fileData, {
        contentType,
        upsert: true,
        cacheControl: '31536000' // 1 year cache
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    // Genera URL pubblico permanente
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return {
      url: publicUrlData.publicUrl,
      path: data.path,
      cdnUrl: `${CDN_BASE_URL}/${fileName}` // URL tramite CDN se configurato
    };
  } catch (err) {
    console.error('uploadToStorage error:', err);
    throw err;
  }
}

/**
 * Download immagine da URL temporaneo e upload a storage permanente
 * @param {string} tempUrl - URL temporaneo da Civitai
 * @param {string} userId - ID utente per path
 * @param {string} generationId - ID generazione per nome file
 * @returns {Promise<{permanentUrl: string, storagePath: string}>}
 */
export async function copyToPermanentStorage(tempUrl, userId, generationId) {
  try {
    // Fetch immagine
    const response = await fetch(tempUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const imageBlob = await response.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Genera path univoco
    const fileName = `${userId}/${generationId}.png`;

    // Upload
    const result = await uploadToStorage(buffer, fileName, 'image/png');

    return {
      permanentUrl: result.cdnUrl || result.url,
      storagePath: result.path
    };
  } catch (err) {
    console.error('copyToPermanentStorage error:', err);
    throw err;
  }
}

/**
 * Elimina file da storage (cleanup)
 */
export async function deleteFromStorage(fileName) {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .remove([fileName]);
  
  if (error) console.error('Storage delete error:', error);
  return !error;
}