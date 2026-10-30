import { supabase } from '@/supabase/config';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const CHUNK_SIZE = 100;

const dividirEnChunks = (items, size = CHUNK_SIZE) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const parseFecha = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    try {
      const fecha = value.toDate();
      return isNaN(fecha.getTime()) ? null : fecha;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  const fecha = new Date(value);
  return isNaN(fecha.getTime()) ? null : fecha;
};

const texto = (value) => (value === null || value === undefined ? '' : String(value));

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

    // Reportar progreso inicial
    if (onProgress) onProgress(5, 'Iniciando generación...');

    // Crear Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    configurarEncabezadoUsuarios(worksheet);

    if (onProgress) onProgress(10, 'Encabezado configurado');

    // Obtener usuarios según el filtro
    let usuariosAProcesar = [];

    if (!cc || cc.trim() === '') {
      if (onProgress) onProgress(15, 'Obteniendo usuarios...');
      usuariosAProcesar = await obtenerTodosLosUsuariosCompleto();
    } else {
      if (onProgress) onProgress(15, `Obteniendo usuario ${cc}...`);
      const usuario = await obtenerUsuarioPorCCCompleto(cc.trim());
      if (usuario) {
        usuariosAProcesar.push(usuario);
      } else {
        throw new Error(`No se encontro usuario con CC: ${cc}`);
      }
    }

    if (usuariosAProcesar.length === 0) {
      throw new Error('No se encontraron usuarios tipo "Basic User" para procesar');
    }

    if (onProgress) onProgress(25, `${usuariosAProcesar.length} usuarios encontrados`);

    // Obtener TODOS los ahorros de una vez
    if (onProgress) onProgress(30, 'Obteniendo datos de ahorros...');
    const todosLosAhorros = await obtenerTodosLosAhorros();
    if (onProgress) onProgress(40, 'Procesando usuarios...');

    let usuariosExitosos = 0;
    let usuariosSinLineas = 0;
    let usuariosConError = 0;
    const errores = [];

    let filaActual = 2; // Fila 1 es el header (Excel empieza en 1)

    for (let i = 0; i < usuariosAProcesar.length; i++) {
      const usuario = usuariosAProcesar[i];

      const progressPercent = 40 + Math.floor((i / usuariosAProcesar.length) * 40); // 40% a 80%
      if (onProgress) onProgress(progressPercent, `Procesando ${i + 1}/${usuariosAProcesar.length}: ${usuario.nombre}`);

      try {
        const infoAhorros = obtenerInformacionAhorrosOptimizada(usuario.id, todosLosAhorros);

        const lineasTexto = infoAhorros.lineas && infoAhorros.lineas.trim() !== ''
          ? infoAhorros.lineas
          : 'Sin líneas firmadas';

        if (!infoAhorros.lineas || infoAhorros.lineas.trim() === '') {
          usuariosSinLineas++;
        }

        agregarFilaUsuarioCompleta(worksheet, usuario, filaActual, lineasTexto, infoAhorros.empresa);
        filaActual++;

        if (i < usuariosAProcesar.length - 1) {
          agregarFilaSeparador(worksheet, filaActual);
          filaActual++;
        }

        usuariosExitosos++;
      } catch (e) {
        console.error("ERROR procesando usuario");
        usuariosConError++;
        errores.push(`Usuario ${usuario.nit} (${usuario.nombre}): ${e.message}`);

        agregarFilaUsuarioConError(worksheet, usuario, filaActual, e.message);
        filaActual++;

        if (i < usuariosAProcesar.length - 1) {
          agregarFilaSeparador(worksheet, filaActual);
          filaActual++;
        }
      }
    }

    if (usuariosExitosos === 0) {
      throw new Error('No se pudieron procesar usuarios para generar el reporte');
    }

    if (onProgress) onProgress(85, 'Generando archivo Excel...');
    await generarArchivoExcelUsuarios(workbook, cc ?? 'TODOS');
    if (onProgress) onProgress(95, 'Archivo generado exitosamente');
  } catch (e) {
    console.error("ERROR CRITICO en excelreporteCopy");
    throw e;
  }
}

/**
 * Obtiene todos los usuarios de `user_profiles` que sean tipo "Basic User"
 */
async function obtenerTodosLosUsuariosCompleto() {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, nit, nro_documento, display_name, email, phone_number, fecha_nacimiento, fecha_expedicion, user_type')
      .eq('user_type', 'Basic User');

    if (error) throw error;

    const usuarios = [];

    for (const userData of data ?? []) {
      const nit = texto(userData.nit) || texto(userData.nro_documento) || texto(userData.id);
      if (!nit.trim()) continue;

      const displayName = texto(userData.display_name);
      const email = texto(userData.email);

      usuarios.push({
        id: userData.id,
        nit: nit.trim(),
        nombre: displayName.trim() !== '' ? displayName.trim() : (email.trim() !== '' ? email.trim() : 'SIN NOMBRE'),
        fechaNacimiento: parseFecha(userData.fecha_nacimiento),
        fechaExpedicion: parseFecha(userData.fecha_expedicion),
        correo: email.trim(),
        telefono: texto(userData.phone_number).trim(),
      });
    }

    return usuarios;
  } catch (e) {
    console.error("ERROR en obtenerTodosLosUsuariosCompleto");
    throw e;
  }
}

/**
 * Obtiene un usuario específico por su cédula
 */
async function obtenerUsuarioPorCCCompleto(cc) {
  try {
    const columnas = 'id, nit, nro_documento, display_name, email, phone_number, fecha_nacimiento, fecha_expedicion, user_type';
    let userData = null;

    const { data: porNit, error: errorNit } = await supabase
      .from('user_profiles')
      .select(columnas)
      .eq('nit', cc)
      .limit(1)
      .maybeSingle();
    if (errorNit) throw errorNit;

    userData = porNit;

    if (!userData) {
      const { data: porDocumento, error: errorDocumento } = await supabase
        .from('user_profiles')
        .select(columnas)
        .eq('nro_documento', cc)
        .limit(1)
        .maybeSingle();
      if (errorDocumento) throw errorDocumento;
      userData = porDocumento;
    }

    if (!userData) {
      return null;
    }

    if (texto(userData.user_type) !== 'Basic User') {
      return null;
    }

    const nit = texto(userData.nit) || texto(userData.nro_documento) || texto(userData.id) || cc;
    const displayName = texto(userData.display_name);
    const email = texto(userData.email);
    const nombreFinal = displayName.trim() !== ''
      ? displayName.trim()
      : (email.trim() !== '' ? email.trim() : 'SIN NOMBRE');

    return {
      id: userData.id,
      nit: nit.trim(),
      nombre: nombreFinal,
      fechaNacimiento: parseFecha(userData.fecha_nacimiento),
      fechaExpedicion: parseFecha(userData.fecha_expedicion),
      correo: email.trim(),
      telefono: texto(userData.phone_number).trim(),
    };
  } catch (e) {
    console.error("ERROR en obtenerUsuarioPorCCCompleto");
    throw e;
  }
}

/**
 * Obtiene TODOS los ahorros de una vez, agrupados por `user_ref`
 */
async function obtenerTodosLosAhorros() {
  try {
    const { data, error } = await supabase
      .from('ahorros')
      .select('id, user_ref, savings_type, ahorros_doc_pdf1, compay_name');

    if (error) throw error;

    const ahorrosMap = new Map();

    for (const ahorroData of data ?? []) {
      const userId = ahorroData.user_ref;
      if (!userId) continue;

      if (!ahorrosMap.has(userId)) {
        ahorrosMap.set(userId, []);
      }
      ahorrosMap.get(userId).push({ id: ahorroData.id, data: ahorroData });
    }

    return ahorrosMap;
  } catch (e) {
    console.error("ERROR en obtenerTodosLosAhorros");
    return new Map();
  }
}

/**
 * Procesa los ahorros precargados de un usuario
 */
function obtenerInformacionAhorrosOptimizada(userId, todosLosAhorros) {
  try {
    const ahorrosUsuario = todosLosAhorros.get(userId) || [];

    const lineasAhorro = [];
    let empresaNomina = '';

    for (const ahorroItem of ahorrosUsuario) {
      const ahorroData = ahorroItem.data;

      const ahorrosDocPdf1 = texto(ahorroData.ahorros_doc_pdf1);

      if (ahorrosDocPdf1.trim() !== '') {
        const savingsType = texto(ahorroData.savings_type);

        if (savingsType !== '' && !lineasAhorro.includes(savingsType)) {
          lineasAhorro.push(savingsType);
        }

        if (savingsType === 'Linea de Ahorro de nómina') {
          const companyName = texto(ahorroData.compay_name);
          if (companyName !== '' && empresaNomina === '') {
            empresaNomina = companyName;
          }
        }
      }
    }

    return {
      lineas: lineasAhorro.join(', '),
      empresa: empresaNomina,
    };
  } catch (e) {
    console.error("ERROR en obtenerInformacionAhorrosOptimizada");
    return { lineas: '', empresa: '' };
  }
}

/**
 * Configura el encabezado del Excel
 */
function configurarEncabezadoUsuarios(worksheet) {
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
    header,
    key: `col${index}`,
    width: 20
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
}

/**
 * Agrega una fila con datos de usuario al Excel
 */
function agregarFilaUsuarioCompleta(worksheet, usuario, rowIndex, lineasAhorro, empresa) {
  const formatoFecha = (fecha) => {
    const d = parseFecha(fecha);
    if (!d) return '';
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
}

/**
 * Agrega una fila separadora vacía con fondo gris
 */
function agregarFilaSeparador(worksheet, rowIndex) {
  const row = worksheet.getRow(rowIndex);
  row.values = ['', '', '', '', '', '', '', ''];
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F0F0' }
  };
}

/**
 * Agrega una fila con error
 */
function agregarFilaUsuarioConError(worksheet, usuario, rowIndex, error) {
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

  row.font = { color: { argb: 'FFCC0000' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFCCCC' }
  };
}

/**
 * Genera y descarga el archivo Excel
 */
async function generarArchivoExcelUsuarios(workbook, identificador) {
  const timestamp = Date.now();
  const fileName = `reporte_usuarios_${identificador}_${timestamp}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  saveAs(blob, fileName);
}
