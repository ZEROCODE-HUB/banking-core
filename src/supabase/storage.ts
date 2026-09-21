import { supabase } from './config';

// Reemplaza src/firebase/storage.js
// Firebase: ref(storage, `users/${ruta}/uploads/${file}`) -> Supabase Storage buckets

const BUCKET_UPLOADS = 'uploads'; // crea bucket 'uploads' en Supabase Storage (privado)
const BUCKET_ARCHIVOS = 'archivos'; // bucket 'archivos' para PDFs

export const subirArchivo = async (file: File, rutaCarpeta: string, nombrePersonalizado: string | null = null) => {
  if (!file || file.size === 0) throw new Error('El archivo está vacío o no es válido');

  const timestamp = Date.now();
  const fileName = nombrePersonalizado || `${timestamp}_${file.name}`;
  const fullPath = `users/${rutaCarpeta}/uploads/${fileName}`;

  const { data, error } = await supabase.storage.from(BUCKET_UPLOADS).upload(fullPath, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET_UPLOADS).getPublicUrl(data.path);
  // Si bucket es privado, usar createSignedUrl en lugar de getPublicUrl
  return {
    url: urlData.publicUrl,
    fileName,
    fullPath: data.path,
  };
};

export const convertirArchivoABase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const subirArchivoConFallback = async (file: File, rutaCarpeta: string, nombrePersonalizado: string | null = null) => {
  console.log(`Subiendo archivo: ${file.name} (${Math.round(file.size / 1024)} KB)`);
  try {
    const resultado = await subirArchivo(file, rutaCarpeta, nombrePersonalizado);
    console.log('Archivo subido a Supabase Storage:', resultado.fileName);
    return { ...resultado, isBase64: false, isLocalFallback: false };
  } catch (error: any) {
    console.warn('Supabase Storage falló, usando fallback base64...', error.message);
    try {
      const timestamp = Date.now() + Math.floor(Math.random() * 1000);
      const fileName = nombrePersonalizado || `${timestamp}_${file.name}`;
      const base64Data = await convertirArchivoABase64(file);
      const base64String = base64Data.split(',')[1];
      const storageKey = `fallback_archivo_${timestamp}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify({ fileName, originalName: file.name, size: file.size, type: file.type, base64: base64String, timestamp }));
      } catch {}
      return {
        url: `FALLBACK_${fileName}`,
        fileName,
        fullPath: `fallback/${fileName}`,
        isBase64: true,
        isLocalFallback: true,
        storageKey,
        originalFile: file.name,
      };
    } catch (fallbackError: any) {
      return {
        url: `ERROR_FALLBACK_${file.name}`,
        fileName: `ERROR_${Date.now()}_${file.name}`,
        fullPath: `error/${file.name}`,
        isBase64: false,
        isLocalFallback: false,
        hasError: true,
        error: fallbackError.message,
      };
    }
  }
};

export const subirPDF = async (pdfBlob: Blob, nombreArchivo: string, carpetaUsuario: string) => {
  if (!pdfBlob || pdfBlob.size === 0) throw new Error('El PDF está vacío o no es válido');
  const fullPath = `archivos/${nombreArchivo}`;
  try {
    const { data, error } = await supabase.storage.from(BUCKET_ARCHIVOS).upload(fullPath, pdfBlob, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: true,
    });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(BUCKET_ARCHIVOS).getPublicUrl(data.path);
    return { url: urlData.publicUrl, fileName: nombreArchivo, fullPath: data.path, isBase64: false, isLocalFallback: false };
  } catch (error: any) {
    console.warn('Error subiendo PDF a Supabase Storage:', error.message);
    try {
      const base64Data: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });
      const base64String = (base64Data as string).split(',')[1];
      const storageKey = `fallback_pdf_${Date.now()}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify({ fileName: nombreArchivo, size: pdfBlob.size, type: pdfBlob.type, base64: base64String, timestamp: Date.now() }));
      } catch {}
      return { url: `FALLBACK_PDF_${nombreArchivo}`, fileName: nombreArchivo, fullPath: `fallback/${nombreArchivo}`, isBase64: true, isLocalFallback: true, storageKey };
    } catch (fallbackError: any) {
      return { url: `ERROR_PDF_${nombreArchivo}`, fileName: nombreArchivo, fullPath: `error/${nombreArchivo}`, isBase64: false, isLocalFallback: false, hasError: true, error: fallbackError.message };
    }
  }
};
