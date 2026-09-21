// Utilidad para manejar archivos almacenados como base64 en Firestore
export const manejarArchivoFirestore = {
  
  // Verificar si es un archivo base64
  esBase64: (url) => {
    return typeof url === 'string' && url.startsWith('data:');
  },
  
  // Descargar archivo base64
  descargarBase64: (base64Data, nombreArchivo) => {
    try {
      const link = document.createElement('a');
      link.href = base64Data;
      link.download = nombreArchivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    } catch (error) {
      console.error('Error descargando archivo base64:', error);
      return false;
    }
  },
  
  // Obtener información del archivo base64
  obtenerInfoBase64: (base64Data) => {
    if (!base64Data || !base64Data.includes(',')) return null;
    
    const [header] = base64Data.split(',');
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'unknown';
    
    // Calcular tamaño aproximado
    const base64String = base64Data.split(',')[1];
    const sizeBytes = Math.round(base64String.length * 0.75);
    
    return {
      mimeType,
      size: sizeBytes,
      sizeFormatted: formatearTamaño(sizeBytes)
    };
  },
  
  // Crear vista previa de archivo base64 (para imágenes y PDFs)
  crearVistaPrevia: (base64Data, nombreArchivo) => {
    const info = manejarArchivoFirestore.obtenerInfoBase64(base64Data);
    if (!info) return null;
    
    if (info.mimeType.startsWith('image/')) {
      return {
        tipo: 'imagen',
        url: base64Data,
        nombre: nombreArchivo
      };
    } else if (info.mimeType === 'application/pdf') {
      return {
        tipo: 'pdf',
        url: base64Data,
        nombre: nombreArchivo
      };
    }
    
    return {
      tipo: 'archivo',
      url: base64Data,
      nombre: nombreArchivo
    };
  }
};

// Función auxiliar para formatear tamaño de archivo
const formatearTamaño = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default manejarArchivoFirestore;