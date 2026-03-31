import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export async function uploadProductImage(uri: string): Promise<string> {
  const filename = `product-${Date.now()}.jpg`;

  let fileData: ArrayBuffer | Blob;

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    fileData = await response.blob();
  } else {
    // React Native: read as base64 then convert to ArrayBuffer
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    fileData = bytes.buffer;
  }

  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(filename, fileData, { contentType: 'image/jpeg', upsert: true });

  if (error) throw new Error(`Error al subir imagen: ${error.message}`);

  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(data.path);

  return publicUrl;
}
