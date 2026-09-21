import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/supabase/config'; // Ajusta la ruta según tu configuración
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Genera un reporte de usuarios en Excel con información de ahorro
 * @param {string|null} cc - Cédula del usuario (null para todos los usuarios)
 * @param {string|null} nombre - Nombre del usuario (parámetro legacy, no se usa)
 * @param {Date|null} fechainicial - Fecha inicial (parámetro legacy, no se usa)
 * @param {Date|null} fechafinal - Fecha final (parámetro legacy, no se usa)
 * @param {function} onProgress - Callback para reportar progreso (opcional)
 */
export async function excelreporteCopy(cc = null, nombre = null, fechainicial = null, fechafinal = null, onProgress = null) {
  try {
    console.log('=== INICIO GENERACION REPORTE DE USUARIOS ===');
    console.log('Parametros recibidos:');
    console.log('CC:', cc ?? 'TODOS');
    console.log('Nota: Se mostraran TODOS los usuarios tipo "Basic User"');

    // Reportar progreso inicial
    if (onProgress) onProgress(5, 'Iniciando generación...');

    // Crear Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    console.log('Configurando encabezado...');
    configurarEncabezadoUsuarios(worksheet);
    
    if (onProgress) onProgress(10, 'Encabezado configurado');

    // Obtener usuarios según el filtro
    let usuariosAProcesar = [];

    if (!cc || cc.trim() === '') {
      // OPCIÓN 1: Traer TODOS los usuarios
      console.log('Generando reporte de TODOS los usuarios tipo "Basic User"');
      if (onProgress) onProgress(15, 'Obteniendo usuarios...');
      usuariosAProcesar = await obtenerTodosLosUsuariosCompleto();
    } else {
      // OPCIÓN 2: Traer UN usuario específico
      console.log('Generando reporte del usuario con CC:', cc);
      if (onProgress) onProgress(15, `Obteniendo usuario ${cc}...`);
      const usuario = await obtenerUsuarioPorCCCompleto(cc.trim());
      if (usuario) {
        usuariosAProcesar.push(usuario);
      } else {
        throw new Error(`No se encontro usuario con CC: ${cc}`);
      }
    }

    if (usuariosAProcesar.length === 0) {
      console.error('ERROR: No se encontraron usuarios tipo "Basic User" para procesar');
      throw new Error('No se encontraron usuarios tipo "Basic User" para procesar');
    }

    console.log('Total usuarios a procesar:', usuariosAProcesar.length);
    if (onProgress) onProgress(25, `${usuariosAProcesar.length} usuarios encontrados`);

    // ✅ OPTIMIZACIÓN: Obtener TODOS los ahorros de una vez
    console.log('Obteniendo TODOS los ahorros para optimizar consultas...');
    if (onProgress) onProgress(30, 'Obteniendo datos de ahorros...');
    const todosLosAhorros = await obtenerTodosLosAhorros();
    if (onProgress) onProgress(40, 'Procesando usuarios...');

    // Estadísticas
    let usuariosExitosos = 0;
    let usuariosSinLineas = 0;
    let usuariosConError = 0;
    const errores = [];

    let filaActual = 2; // Fila 1 es el header (Excel empieza en 1)

    // Procesar cada usuario
    for (let i = 0; i < usuariosAProcesar.length; i++) {
      const usuario = usuariosAProcesar[i];
      console.log(`--- Procesando usuario ${i + 1}/${usuariosAProcesar.length} ---`);
      console.log('NIT:', usuario.nit);
      console.log('Nombre:', usuario.nombre);
      
      // ✅ REPORTAR PROGRESO de procesamiento
      const progressPercent = 40 + Math.floor((i / usuariosAProcesar.length) * 40); // 40% a 80%
      if (onProgress) onProgress(progressPercent, `Procesando ${i + 1}/${usuariosAProcesar.length}: ${usuario.nombre}`);

      try {
        // ✅ OPTIMIZACIÓN: Usar datos precargados en lugar de consulta individual
        console.log('Obteniendo info de ahorros optimizada...');
        const infoAhorros = obtenerInformacionAhorrosOptimizada(usuario.reference, todosLosAhorros);

        console.log('Lineas encontradas:', infoAhorros.lineas || 'Sin líneas');
        console.log('Empresa:', infoAhorros.empresa || 'Sin empresa');

        // ✅ CAMBIO: INCLUIR TODOS LOS USUARIOS (con y sin líneas firmadas)
        const lineasTexto = infoAhorros.lineas && infoAhorros.lineas.trim() !== '' 
          ? infoAhorros.lineas 
          : 'Sin líneas firmadas';

        if (!infoAhorros.lineas || infoAhorros.lineas.trim() === '') {
          console.log('⚠️ Usuario sin lineas de ahorro firmadas, pero SE INCLUIRÁ en el reporte');
          usuariosSinLineas++;
        }

        // Agregar fila al Excel
        agregarFilaUsuarioCompleta(
          worksheet,
          usuario,
          filaActual,
          lineasTexto,
          infoAhorros.empresa
        );

        filaActual++;

        // ✅ Agregar fila de separación (vacía) después de cada usuario
        // Solo si NO es el último usuario
        if (i < usuariosAProcesar.length - 1) {
          agregarFilaSeparador(worksheet, filaActual);
          filaActual++;
        }

        usuariosExitosos++;
        console.log('✓ Usuario procesado exitosamente');
      } catch (e) {
        console.error(`✗ ERROR procesando usuario ${usuario.nit}:`, e);
        usuariosConError++;
        errores.push(`Usuario ${usuario.nit} (${usuario.nombre}): ${e.message}`);

        // Agregar fila con error
        agregarFilaUsuarioConError(worksheet, usuario, filaActual, e.message);

        filaActual++;

        // Agregar separador después del error también
        if (i < usuariosAProcesar.length - 1) {
          agregarFilaSeparador(worksheet, filaActual);
          filaActual++;
        }
      }
    }

    // Validar que al menos un usuario fue agregado
    if (usuariosExitosos === 0) {
      console.warn('ADVERTENCIA: No se pudieron procesar usuarios');
      throw new Error('No se pudieron procesar usuarios para generar el reporte');
    }

    // Generar archivo
    console.log('Generando archivo Excel...');
    if (onProgress) onProgress(85, 'Generando archivo Excel...');
    await generarArchivoExcelUsuarios(workbook, cc ?? 'TODOS');
    if (onProgress) onProgress(95, 'Archivo generado exitosamente');

    // Resumen final
    console.log('\n=== RESUMEN FINAL ===');
    console.log('Total usuarios procesados:', usuariosAProcesar.length);
    console.log('Incluidos en Excel:', usuariosExitosos);
    console.log('Sin lineas firmadas (incluidos):', usuariosSinLineas);
    console.log('Con error:', usuariosConError);

    if (errores.length > 0) {
      console.log('\nERRORES ENCONTRADOS:');
      errores.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    console.log('=== EXCEL GENERADO EXITOSAMENTE ===');
  } catch (e) {
    console.error('ERROR CRITICO en excelreporteCopy:', e);
    throw e;
  }
}

/**
 * Obtiene todos los usuarios de la colección 'user' que sean tipo "Basic User"
 */
async function obtenerTodosLosUsuariosCompleto() {
  try {
    console.log('Consultando coleccion user en Firestore...');
    const usersRef = collection(db, 'user');
    const usersSnapshot = await getDocs(usersRef);

    console.log('Total documentos encontrados:', usersSnapshot.size);

    const usuarios = [];
    let usuariosFiltradosPorTipo = 0;

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();

        // ✅ FILTRO 1: Solo usuarios tipo "Basic User"
        const userType = userData.userType?.toString() ?? '';
        if (userType !== 'Basic User') {
          console.log(`Usuario ${userDoc.id} con tipo "${userType}", saltando...`);
          usuariosFiltradosPorTipo++;
          continue;
        }

        // ✅ CAMBIO: Buscar NIT en múltiples campos
        const nit = userData.nit?.toString() 
          || userData.nroDocumento?.toString() 
          || userDoc.id?.toString() 
          || '';

        const displayName = userData.display_name?.toString() ?? '';
        const email = userData.email?.toString() ?? '';
        const userEmail = userData.UserEmail?.toString() ?? '';
        const phoneNumber = userData.phone_number?.toString() ?? '';

        // ⭐ NUEVOS CAMPOS: Fechas
        let fechaNacimiento = null;
        let fechaExpedicion = null;

        try {
          // Intentar obtener fecha de nacimiento
          if (userData.fecha_nacimiento) {
            if (userData.fecha_nacimiento.toDate) {
              // Es un Timestamp de Firestore
              fechaNacimiento = userData.fecha_nacimiento.toDate();
            } else if (typeof userData.fecha_nacimiento === 'string') {
              // Es un string
              fechaNacimiento = new Date(userData.fecha_nacimiento);
            } else if (userData.fecha_nacimiento instanceof Date) {
              fechaNacimiento = userData.fecha_nacimiento;
            }
          }
        } catch (e) {
          console.error('Error parseando fecha_nacimiento:', e);
        }

        try {
          // Intentar obtener fecha de expedición
          if (userData.fechaExpedicion) {
            if (userData.fechaExpedicion.toDate) {
              fechaExpedicion = userData.fechaExpedicion.toDate();
            } else if (typeof userData.fechaExpedicion === 'string') {
              fechaExpedicion = new Date(userData.fechaExpedicion);
            } else if (userData.fechaExpedicion instanceof Date) {
              fechaExpedicion = userData.fechaExpedicion;
            }
          }
        } catch (e) {
          console.error('Error parseando fechaExpedicion:', e);
        }

        // ✅ CAMBIO: Ya no validar que tenga NIT, siempre tendrá uno de los 3 campos
        if (!nit || nit.trim() === '') {
          console.warn(`ADVERTENCIA: Usuario ${userDoc.id} sin NIT/nroDocumento/id válido, saltando...`);
          continue;
        }

        // Determinar correo (prioridad a UserEmail)
        const correoFinal = userEmail.trim() !== '' ? userEmail.trim() : email.trim();

        // Determinar nombre
        const nombreFinal = displayName.trim() !== ''
          ? displayName.trim()
          : (email.trim() !== '' ? email.trim() : 'SIN NOMBRE');

        usuarios.push({
          id: userDoc.id,
          reference: userDoc.ref,
          nit: nit.trim(),
          nombre: nombreFinal,
          fechaNacimiento: fechaNacimiento,
          fechaExpedicion: fechaExpedicion,
          correo: correoFinal,
          telefono: phoneNumber.trim(),
        });

        console.log('Usuario valido agregado:', nit.trim(), '-', nombreFinal);
        if (fechaNacimiento) console.log('  - Fecha nacimiento:', fechaNacimiento.toString());
        if (fechaExpedicion) console.log('  - Fecha expedicion:', fechaExpedicion.toString());
      } catch (e) {
        console.error(`ERROR procesando documento ${userDoc.id}:`, e);
        continue;
      }
    }

    console.log('Total usuarios validos tipo "Basic User":', usuarios.length);
    console.log('Usuarios filtrados por tipo diferente:', usuariosFiltradosPorTipo);
    return usuarios;
  } catch (e) {
    console.error('ERROR en obtenerTodosLosUsuariosCompleto:', e);
    throw e;
  }
}

/**
 * Obtiene un usuario específico por su cédula
 */
async function obtenerUsuarioPorCCCompleto(cc) {
  try {
    console.log('Buscando usuario con CC:', cc);

    const usersRef = collection(db, 'user');
    
    // ✅ CAMBIO: Buscar en múltiples campos
    let userDoc = null;
    let userData = null;

    // Intentar buscar por nit
    let q = query(usersRef, where('nit', '==', cc), limit(1));
    let userSnapshot = await getDocs(q);
    
    if (!userSnapshot.empty) {
      userDoc = userSnapshot.docs[0];
      userData = userDoc.data();
    } else {
      // Si no se encuentra por nit, intentar por nroDocumento
      q = query(usersRef, where('nroDocumento', '==', cc), limit(1));
      userSnapshot = await getDocs(q);
      
      if (!userSnapshot.empty) {
        userDoc = userSnapshot.docs[0];
        userData = userDoc.data();
      }
    }

    if (!userDoc || !userData) {
      console.log('No se encontro usuario con CC:', cc);
      return null;
    }

    // ✅ FILTRO: Verificar que sea "Basic User"
    const userType = userData.userType?.toString() ?? '';
    if (userType !== 'Basic User') {
      console.log(`Usuario encontrado pero es tipo "${userType}", no "Basic User"`);
      return null;
    }

    const nit = userData.nit?.toString() 
      || userData.nroDocumento?.toString() 
      || userDoc.id?.toString() 
      || cc;

    const displayName = userData.display_name?.toString() ?? '';
    const email = userData.email?.toString() ?? '';
    const userEmail = userData.UserEmail?.toString() ?? '';
    const phoneNumber = userData.phone_number?.toString() ?? '';

    // ⭐ NUEVOS CAMPOS: Fechas
    let fechaNacimiento = null;
    let fechaExpedicion = null;

    try {
      if (userData.fecha_nacimiento) {
        if (userData.fecha_nacimiento.toDate) {
          fechaNacimiento = userData.fecha_nacimiento.toDate();
        } else if (typeof userData.fecha_nacimiento === 'string') {
          fechaNacimiento = new Date(userData.fecha_nacimiento);
        } else if (userData.fecha_nacimiento instanceof Date) {
          fechaNacimiento = userData.fecha_nacimiento;
        }
      }
    } catch (e) {
      console.error('Error parseando fecha_nacimiento:', e);
    }

    try {
      if (userData.fechaExpedicion) {
        if (userData.fechaExpedicion.toDate) {
          fechaExpedicion = userData.fechaExpedicion.toDate();
        } else if (typeof userData.fechaExpedicion === 'string') {
          fechaExpedicion = new Date(userData.fechaExpedicion);
        } else if (userData.fechaExpedicion instanceof Date) {
          fechaExpedicion = userData.fechaExpedicion;
        }
      }
    } catch (e) {
      console.error('Error parseando fechaExpedicion:', e);
    }

    const correoFinal = userEmail.trim() !== '' ? userEmail.trim() : email.trim();
    const nombreFinal = displayName.trim() !== ''
      ? displayName.trim()
      : (email.trim() !== '' ? email.trim() : 'SIN NOMBRE');

    const usuario = {
      id: userDoc.id,
      reference: userDoc.ref,
      nit: nit.trim(),
      nombre: nombreFinal,
      fechaNacimiento: fechaNacimiento,
      fechaExpedicion: fechaExpedicion,
      correo: correoFinal,
      telefono: phoneNumber.trim(),
    };

    console.log('Usuario encontrado:', usuario.nit, '-', usuario.nombre);
    console.log('Correo:', usuario.correo);
    console.log('Telefono:', usuario.telefono);
    if (fechaNacimiento) console.log('Fecha nacimiento:', fechaNacimiento.toString());
    if (fechaExpedicion) console.log('Fecha expedicion:', fechaExpedicion.toString());

    return usuario;
  } catch (e) {
    console.error('ERROR en obtenerUsuarioPorCCCompleto:', e);
    throw e;
  }
}

/**
 * ✅ NUEVA FUNCIÓN OPTIMIZADA: Obtiene TODOS los ahorros de una vez
 */
async function obtenerTodosLosAhorros() {
  try {
    console.log('Obteniendo TODOS los ahorros de una vez...');
    const ahorrosRef = collection(db, 'ahorros');
    const ahorrosSnapshot = await getDocs(ahorrosRef);
    
    console.log('Total ahorros encontrados:', ahorrosSnapshot.size);
    
    const ahorrosMap = new Map();
    
    for (const ahorroDoc of ahorrosSnapshot.docs) {
      const ahorroData = ahorroDoc.data();
      const userId = ahorroData.user?.id || ahorroData.user?.path?.split('/').pop();
      
      if (userId) {
        if (!ahorrosMap.has(userId)) {
          ahorrosMap.set(userId, []);
        }
        ahorrosMap.get(userId).push({
          id: ahorroDoc.id,
          data: ahorroData
        });
      }
    }
    
    console.log('Ahorros organizados por usuario:', ahorrosMap.size, 'usuarios con ahorros');
    return ahorrosMap;
  } catch (e) {
    console.error('ERROR en obtenerTodosLosAhorros:', e);
    return new Map();
  }
}

/**
 * ✅ NUEVA FUNCIÓN OPTIMIZADA: Procesa ahorros sin hacer consulta individual
 */
function obtenerInformacionAhorrosOptimizada(userRef, todosLosAhorros) {
  try {
    const userId = userRef.id || userRef.path?.split('/').pop();
    const ahorrosUsuario = todosLosAhorros.get(userId) || [];
    
    console.log(`Usuario ${userId}: ${ahorrosUsuario.length} cuentas encontradas`);
    
    const lineasAhorro = [];
    let empresaNomina = '';
    let cuentasFirmadas = 0;
    
    for (const ahorroItem of ahorrosUsuario) {
      const ahorroData = ahorroItem.data;
      
      // Verificar si tiene documento firmado
      const ahorrosDocPdf1 = ahorroData.AhorrosDocPdf1?.toString();
      
      if (ahorrosDocPdf1 && ahorrosDocPdf1.trim() !== '') {
        cuentasFirmadas++;
        
        const savingsType = ahorroData.SavingsType?.toString() ?? '';
        
        console.log('Cuenta firmada encontrada:', ahorroItem.id);
        console.log('Tipo:', savingsType);
        
        // Agregar tipo de ahorro si no está duplicado
        if (savingsType !== '' && !lineasAhorro.includes(savingsType)) {
          lineasAhorro.push(savingsType);
        }
        
        // Si es línea de nómina, obtener empresa
        if (savingsType === 'Linea de Ahorro de nómina') {
          const companyName = ahorroData.CompayName?.toString() ?? '';
          if (companyName !== '' && empresaNomina === '') {
            empresaNomina = companyName;
            console.log('Empresa de nomina:', companyName);
          }
        }
      } else {
        console.log('Cuenta', ahorroItem.id, 'sin documento firmado, saltando...');
      }
    }
    
    const lineasStr = lineasAhorro.join(', ');
    
    console.log('Resumen cuentas:');
    console.log('- Total:', ahorrosUsuario.length);
    console.log('- Firmadas:', cuentasFirmadas);
    console.log('- Lineas:', lineasStr || 'Ninguna');
    console.log('- Empresa:', empresaNomina === '' ? 'Ninguna' : empresaNomina);
    
    return {
      lineas: lineasStr,
      empresa: empresaNomina,
    };
  } catch (e) {
    console.error('ERROR en obtenerInformacionAhorrosOptimizada:', e);
    return {
      lineas: '',
      empresa: '',
    };
  }
}

/**
 * Configura el encabezado del Excel
 */
function configurarEncabezadoUsuarios(worksheet) {
  console.log('Configurando encabezado del Excel...');

  try {
    const headers = [
      'ID',
      'NOMBRE',
      'FECHA DE NACIMIENTO',
      'FECHA EXPEDICIÓN CÉDULA',
      'CORREO',
      'TELÉFONO',
      'LÍNEAS DE AHORRO',
      'EMPRESA'
    ];

    worksheet.columns = headers.map((header, index) => ({
      header: header,
      key: `col${index}`,
      width: 20
    }));

    // Aplicar estilos al encabezado
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F81BD' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    console.log('Encabezado configurado con', headers.length, 'columnas');
  } catch (e) {
    console.error('ERROR configurando encabezado:', e);
    throw e;
  }
}

/**
 * Agrega una fila con datos de usuario al Excel
 */
function agregarFilaUsuarioCompleta(worksheet, usuario, rowIndex, lineasAhorro, empresa) {
  try {
    const formatoFecha = (fecha) => {
      if (!fecha) return '';
      const d = new Date(fecha);
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      return `${dia}/${mes}/${anio}`;
    };

    const row = worksheet.getRow(rowIndex);
    row.values = [
      usuario.nit,
      usuario.nombre,
      formatoFecha(usuario.fechaNacimiento),
      formatoFecha(usuario.fechaExpedicion),
      usuario.correo,
      usuario.telefono || '',
      lineasAhorro,
      empresa || ''
    ];

    console.log(`Fila ${rowIndex} agregada: ${usuario.nit} - ${usuario.nombre}`);
  } catch (e) {
    console.error('ERROR agregando fila usuario:', e);
    throw e;
  }
}

/**
 * Agrega una fila separadora vacía con fondo gris
 */
function agregarFilaSeparador(worksheet, rowIndex) {
  try {
    console.log('Agregando fila separadora en fila:', rowIndex);

    const row = worksheet.getRow(rowIndex);
    row.values = ['', '', '', '', '', '', '', ''];
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' }
    };

    console.log('Fila separadora agregada exitosamente');
  } catch (e) {
    console.error('ERROR agregando fila separadora:', e);
  }
}

/**
 * Agrega una fila con error
 */
function agregarFilaUsuarioConError(worksheet, usuario, rowIndex, error) {
  try {
    console.log('Agregando fila de error para usuario:', usuario.nit);

    const errorTexto = error.length > 50 ? error.substring(0, 50) + '...' : error;

    const row = worksheet.getRow(rowIndex);
    row.values = [
      usuario.nit,
      usuario.nombre,
      '',
      '',
      usuario.correo,
      usuario.telefono,
      'ERROR',
      errorTexto
    ];

    // Aplicar estilo de error
    row.font = { color: { argb: 'FFCC0000' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFCCCC' }
    };

    console.log('Fila de error agregada exitosamente');
  } catch (e) {
    console.error('ERROR agregando fila de error:', e);
  }
}

/**
 * Genera y descarga el archivo Excel
 */
async function generarArchivoExcelUsuarios(workbook, identificador) {
  try {
    const timestamp = Date.now();
    const fileName = `reporte_usuarios_${identificador}_${timestamp}.xlsx`;

    console.log('Nombre del archivo:', fileName);
    console.log('Codificando Excel...');

    const buffer = await workbook.xlsx.writeBuffer();

    console.log('Archivo codificado exitosamente. Tamaño:', buffer.byteLength, 'bytes');

    // Descargar en navegador
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(blob, fileName);

    console.log('Descarga iniciada en navegador');
    console.log('Archivo generado exitosamente');
  } catch (e) {
    console.error('ERROR generando archivo Excel:', e);
    throw e;
  }
}