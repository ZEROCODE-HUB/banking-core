import { supabase } from '@/supabase/config';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const texto = (value) => (value === null || value === undefined ? '' : String(value));

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

/**
 * Genera un reporte completo de usuarios con transacciones en Excel
 * @param {string|null} cc - Cédula del usuario (null para todos los usuarios)
 * @param {string|null} nombre - Nombre del usuario (parámetro legacy, no se usa)
 * @param {Date|null} fechainicial - Fecha inicial para filtrar transacciones
 * @param {Date|null} fechafinal - Fecha final para filtrar transacciones
 * @param {function} onProgress - Callback para reportar progreso (opcional)
 */
export async function excelreporte(cc = null, nombre = null, fechainicial = null, fechafinal = null, onProgress = null) {
  try {

    if (onProgress) onProgress(5, 'Iniciando generación...');

    if (fechainicial && fechafinal && fechainicial > fechafinal) {
      throw new Error('La fecha inicial no puede ser posterior a la fecha final');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    if (onProgress) onProgress(10, 'Configurando formato...');

    const formatoFecha = (fecha) => {
      const d = parseFecha(fecha);
      if (!d) return '';
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      return `${dia}/${mes}/${anio}`;
    };

    const fechaInicialStr = fechainicial ? formatoFecha(fechainicial) : 'TODAS LAS FECHAS';
    const fechaFinalStr = fechafinal ? formatoFecha(fechafinal) : formatoFecha(new Date());

    configurarEncabezadoExcel(worksheet, cc ?? 'TODOS', fechaInicialStr, fechaFinalStr);

    if (onProgress) onProgress(15, 'Obteniendo usuarios...');

    let usuariosAProcesar = [];

    if (!cc || cc.trim() === '') {
      usuariosAProcesar = await obtenerTodosLosUsuarios();
    } else {
      const usuario = await obtenerUsuarioPorCC(cc.trim());
      if (usuario) {
        usuariosAProcesar.push(usuario);
      }
    }

    if (usuariosAProcesar.length === 0) {
      throw new Error('No se encontraron usuarios para procesar');
    }

    if (onProgress) onProgress(25, `${usuariosAProcesar.length} usuarios encontrados`);

    if (onProgress) onProgress(30, 'Obteniendo datos de ahorros...');
    const todosLosAhorrosMap = await obtenerTodosLosAhorrosOptimizado();

    if (onProgress) onProgress(40, 'Obteniendo datos de transacciones...');
    const todasLasTransaccionesMap = await obtenerTodasLasTransaccionesOptimizado();

    if (onProgress) onProgress(50, 'Datos cargados, procesando usuarios...');

    const erroresUsuarios = [];
    const erroresCuentas = [];
    const advertencias = [];

    let currentRow = 3; // Fila 1: info, Fila 2: vacía, Fila 3: headers
    let primerUsuario = true;

    for (let i = 0; i < usuariosAProcesar.length; i++) {
      const usuario = usuariosAProcesar[i];

      const progressPercent = 50 + Math.floor((i / usuariosAProcesar.length) * 35); // 50% a 85%
      if (onProgress) onProgress(progressPercent, `Procesando ${i + 1}/${usuariosAProcesar.length}: ${usuario.nombre}`);

      try {
        const resultado = await procesarUsuarioOptimizado(
          worksheet,
          usuario,
          currentRow,
          fechainicial,
          fechafinal,
          formatoFecha,
          erroresCuentas,
          advertencias,
          primerUsuario,
          todosLosAhorrosMap,
          todasLasTransaccionesMap
        );
        currentRow = resultado.row;
        primerUsuario = false;
      } catch (e) {
        const errorMsg = `Usuario ${usuario.nit} (${usuario.nombre}): ${e.message}`;
        erroresUsuarios.push(errorMsg);
        console.error("ERROR procesando usuario");
        agregarFilaError(worksheet, usuario, currentRow, e.message);
        currentRow++;
        primerUsuario = false;
        continue;
      }
    }

    if (onProgress) onProgress(90, 'Generando archivo...');

    await generarArchivoExcel(
      workbook,
      usuariosAProcesar.length > 1 ? 'TODOS' : usuariosAProcesar[0].nit
    );

    if (onProgress) onProgress(95, 'Archivo generado exitosamente');
  } catch (e) {
    console.error("ERROR CRITICO en excelreporte");
    throw e;
  }
}

/**
 * Obtiene TODOS los ahorros firmados de una vez, agrupados por `user_ref`
 */
async function obtenerTodosLosAhorrosOptimizado() {
  try {
    const { data, error } = await supabase
      .from('ahorros')
      .select('id, user_ref, savings_type, ahorros_doc_pdf1, transactions');

    if (error) throw error;

    const ahorrosMap = new Map();

    for (const ahorroData of data ?? []) {
      const userId = ahorroData.user_ref;

      const ahorrosDocPdf1 = texto(ahorroData.ahorros_doc_pdf1);
      if (userId && ahorrosDocPdf1.trim() !== '') {
        if (!ahorrosMap.has(userId)) {
          ahorrosMap.set(userId, []);
        }
        ahorrosMap.get(userId).push({ id: ahorroData.id, data: ahorroData });
      }
    }

    return ahorrosMap;
  } catch (e) {
    console.error("ERROR en obtenerTodosLosAhorrosOptimizado");
    return new Map();
  }
}

/**
 * Obtiene TODAS las transacciones APPROVED de una vez, agrupadas por `ahorros_id`
 */
async function obtenerTodasLasTransaccionesOptimizado() {
  try {
    const transaccionesMap = new Map();
    let offset = 0;

    // PostgREST limita las filas por respuesta: paginamos hasta agotar la tabla.
    for (;;) {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, ahorros_id, amount, status, transaction_type, firebase_date, is_ahorro_cdat, is_novedad_saldo, chanel_pay')
        .eq('status', 'APPROVED')
        .not('ahorros_id', 'is', null)
        .range(offset, offset + 999);

      if (error) throw error;

      const filas = data ?? [];

      for (const transactionData of filas) {
        const ahorrosId = transactionData.ahorros_id;
        if (!ahorrosId) continue;

        if (!transaccionesMap.has(ahorrosId)) {
          transaccionesMap.set(ahorrosId, []);
        }
        transaccionesMap.get(ahorrosId).push({ id: transactionData.id, data: transactionData });
      }

      if (filas.length < 1000) break;
      offset += 1000;
    }

    return transaccionesMap;
  } catch (e) {
    console.error("ERROR en obtenerTodasLasTransaccionesOptimizado");
    return new Map();
  }
}

/**
 * Procesa un usuario usando datos precargados
 */
async function procesarUsuarioOptimizado(
  worksheet,
  usuario,
  startRow,
  fechainicial,
  fechafinal,
  formatoFecha,
  erroresCuentas,
  advertencias,
  primerUsuario,
  todosLosAhorrosMap,
  todasLasTransaccionesMap
) {
  let currentRow = startRow;

  const userId = usuario.id;
  const cuentasUsuario = todosLosAhorrosMap.get(userId) || [];

  if (cuentasUsuario.length === 0) {
    advertencias.push(
      `Usuario ${usuario.nit} (${usuario.nombre}): No tiene cuentas válidas`
    );
    return { row: currentRow };
  }

  let totalTransaccionesUsuario = 0;
  for (const cuenta of cuentasUsuario) {
    const transaccionesCuenta = todasLasTransaccionesMap.get(cuenta.id) || [];

    const transaccionesValidas = transaccionesCuenta.filter(t => {
      const transactionDate = parseFecha(t.data.firebase_date);
      if (!transactionDate) return false;
      if (fechainicial && transactionDate < fechainicial) return false;
      if (fechafinal && transactionDate > fechafinal) return false;
      return true;
    });

    totalTransaccionesUsuario += transaccionesValidas.length;
  }

  if (!primerUsuario && totalTransaccionesUsuario > 0) {
    currentRow = agregarSeparadorUsuario(worksheet, currentRow);
  }

  if (totalTransaccionesUsuario === 0) {
    return { row: currentRow };
  }

  for (const cuenta of cuentasUsuario) {
    try {
      const resultado = procesarCuentaAhorrosOptimizada(
        worksheet,
        usuario,
        cuenta,
        currentRow,
        fechainicial,
        fechafinal,
        formatoFecha,
        erroresCuentas,
        todasLasTransaccionesMap
      );
      currentRow = resultado.row;
    } catch (e) {
      const errorMsg = `Usuario ${usuario.nit} - Cuenta ${cuenta.id}: ${e.message}`;
      erroresCuentas.push(errorMsg);
      agregarFilaErrorCuenta(worksheet, usuario, cuenta.id, currentRow, e.message);
      currentRow++;
      continue;
    }
  }

  return { row: currentRow };
}

/**
 * Procesa una cuenta de ahorros usando datos precargados
 */
function procesarCuentaAhorrosOptimizada(
  worksheet,
  usuario,
  cuenta,
  startRow,
  fechainicial,
  fechafinal,
  formatoFecha,
  erroresCuentas,
  todasLasTransaccionesMap
) {
  const ahorroData = cuenta.data;
  const cuentaId = cuenta.id;
  const tipoAhorro = texto(ahorroData.savings_type) || 'TIPO DESCONOCIDO';

  let currentRow = startRow;

  // Obtener transacciones de la cuenta desde el Map precargado
  const transaccionesCuenta = todasLasTransaccionesMap.get(cuentaId) || [];

  // Filtrar transacciones por rango de fechas
  const transactionsDocs = transaccionesCuenta.filter(t => {
    const transactionDate = parseFecha(t.data.firebase_date);
    if (!transactionDate) return false;
    if (fechainicial && transactionDate < fechainicial) return false;
    if (fechafinal && transactionDate > fechafinal) return false;
    return true;
  });

  if (transactionsDocs.length === 0) {
    return { row: currentRow };
  }

  // CALCULAR EL MONTO TOTAL REAL DE LA CUENTA (usando todas las transacciones)
  let totalDepositos = 0.0;
  let totalRetiros = 0.0;
  let totalBeneficios = 0.0;

  for (const transaccion of transaccionesCuenta) {
    const data = transaccion.data;
    const type = texto(data.transaction_type);
    const amount = parseToDouble(data.amount);

    if (type === 'Depositado') {
      totalDepositos += amount;
    } else if (type === 'Withdrawal') {
      totalRetiros += amount;
    }
  }

  // SUMAR BENEFICIOS DEL ARRAY `transactions` (jsonb) EN ahorros
  try {
    const beneficiosArrayRaw = ahorroData.transactions;
    if (Array.isArray(beneficiosArrayRaw)) {
      for (const beneficio of beneficiosArrayRaw) {
        if (typeof beneficio === 'object' && beneficio !== null) {
          totalBeneficios += parseToDouble(beneficio.taxedBenefit);
        }
      }
    }
  } catch (e) {
    console.error("Error procesando beneficios del array en ahorros");
  }

  const montoTotalReal = totalDepositos - totalRetiros + totalBeneficios;

  // Ordenar transacciones por fecha (más reciente primero para mostrar)
  const transactions = [...transactionsDocs];
  transactions.sort((a, b) => {
    const dateA = parseFecha(a.data.firebase_date);
    const dateB = parseFecha(b.data.firebase_date);
    if (!dateA || !dateB) return 0;
    return dateB - dateA;
  });

  // OBTENER Y ORDENAR ARRAY DE BENEFICIOS
  let transactionsBeneficios = [];
  try {
    const beneficiosRaw = ahorroData.transactions;
    if (Array.isArray(beneficiosRaw)) {
      transactionsBeneficios = beneficiosRaw.filter(b => typeof b === 'object' && b !== null);
    }

    transactionsBeneficios.sort((a, b) => {
      const dateA = parseDateFromBeneficio(a);
      const dateB = parseDateFromBeneficio(b);
      if (!dateA || !dateB) return 0;
      return dateA - dateB;
    });
  } catch (e) {
    console.error("Error ordenando beneficios");
    transactionsBeneficios = [];
  }

  // Crear lista cronológica de transacciones
  const transactionsChronological = [...transactions];
  transactionsChronological.sort((a, b) => {
    const dateA = parseFecha(a.data.firebase_date);
    const dateB = parseFecha(b.data.firebase_date);
    if (!dateA || !dateB) return 0;
    return dateA - dateB;
  });

  // CALCULAR SALDOS Y BENEFICIOS ACUMULADOS
  const saldosAcumulados = {};
  const beneficiosAcumulados = {};
  const indicesTransacciones = {};
  let saldoActual = 0.0;
  let beneficioAcumulado = 0.0;

  for (let i = 0; i < transactionsChronological.length; i++) {
    const transaction = transactionsChronological[i];
    const transactionData = transaction.data;

    const transactionType = texto(transactionData.transaction_type);
    const amount = parseToDouble(transactionData.amount);

    saldosAcumulados[transaction.id] = saldoActual;
    beneficiosAcumulados[transaction.id] = beneficioAcumulado;
    indicesTransacciones[transaction.id] = i;

    if (transactionType === 'Depositado') {
      saldoActual += amount;

      if (i < transactionsBeneficios.length) {
        beneficioAcumulado += parseToDouble(transactionsBeneficios[i].taxedBenefit);
      }
    } else if (transactionType === 'Withdrawal') {
      saldoActual -= amount;
    }
  }

  // PROCESAR CADA TRANSACCIÓN PARA EL EXCEL
  for (const transaction of transactions) {
    const transactionData = transaction.data;

    try {
      const transactionType = texto(transactionData.transaction_type);
      const amount = parseToDouble(transactionData.amount);
      const transactionDate = parseFecha(transactionData.firebase_date);

      if (!transactionDate) continue;

      const transactionIndex = indicesTransacciones[transaction.id] ?? 0;
      const ahorroAnterior = saldosAcumulados[transaction.id] ?? 0.0;
      const beneficioAnterior = beneficiosAcumulados[transaction.id] ?? 0.0;

      let beneficioTransaccion = 0.0;
      if (transactionIndex >= 0 && transactionIndex < transactionsBeneficios.length) {
        beneficioTransaccion = parseToDouble(transactionsBeneficios[transactionIndex].taxedBenefit);
      }

      let saldoDespues = ahorroAnterior;
      if (transactionType === 'Depositado') {
        saldoDespues += amount;
      } else if (transactionType === 'Withdrawal') {
        saldoDespues -= amount;
      }

      const totalAhorroInteres = montoTotalReal;

      const isAhorroCdat = transactionData.is_ahorro_cdat === true;
      const isNovedadSaldo = transactionData.is_novedad_saldo === true;
      const chanelPay = texto(transactionData.chanel_pay);

      let tipo = '';
      let transaccion = '';
      let fechaDeposito = '';
      let fechaRetiro = '';
      let valorRetiro = 0.0;
      let ahorroActual = 0.0;
      let canalPago = '';

      if (transactionType === 'Depositado') {
        tipo = 'Deposito';
        transaccion = isNovedadSaldo ? 'Alianza interno' : 'PSE';
        fechaDeposito = formatoFecha(transactionDate);
        ahorroActual = amount;
      } else if (transactionType === 'Withdrawal') {
        tipo = 'Debito';

        if (isAhorroCdat) {
          transaccion = 'Inversion CDAT';
        } else if (isNovedadSaldo) {
          transaccion = 'Alianza interno';
        } else {
          transaccion = 'ACH';
        }

        fechaRetiro = formatoFecha(transactionDate);
        valorRetiro = amount;
        ahorroActual = 0.0;
        canalPago = chanelPay;
      } else {
        continue;
      }

      const rowData = [
        usuario.nit,
        usuario.nombre,
        tipo,
        transaccion,
        tipoAhorro,
        formatoFecha(transactionDate),
        ahorroAnterior > 0 ? ahorroAnterior : null,
        beneficioAnterior > 0 ? beneficioAnterior : null,
        fechaDeposito || null,
        ahorroActual > 0 ? ahorroActual : null,
        beneficioTransaccion > 0 ? beneficioTransaccion : null,
        saldoDespues > 0 ? saldoDespues : null,
        fechaRetiro || null,
        valorRetiro > 0 ? valorRetiro : null,
        totalAhorroInteres > 0 ? totalAhorroInteres : null,
        canalPago || null
      ];

      agregarFilaExcelConEstilo(worksheet, rowData, currentRow, transactionType);
      currentRow++;
    } catch (e) {
      console.error("ERROR procesando transaccion");
      continue;
    }
  }

  return { row: currentRow };
}

async function obtenerTodosLosUsuarios() {
  try {
    const usuarios = [];

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, nit, nro_documento, display_name, email');

    if (error) throw error;

    for (const userData of data ?? []) {
      const nit = texto(userData.nit) || texto(userData.nro_documento);
      if (nit.trim() === '') continue;

      const displayName = texto(userData.display_name);
      const email = texto(userData.email);

      usuarios.push({
        id: userData.id,
        nit: nit.trim(),
        nombre: displayName.trim() !== ''
          ? displayName.trim()
          : (email.trim() !== '' ? email.trim() : 'SIN NOMBRE'),
        data: userData
      });
    }

    return usuarios;
  } catch (e) {
    console.error("ERROR en obtenerTodosLosUsuarios");
    throw e;
  }
}

async function obtenerUsuarioPorCC(cc) {
  try {
    const columnas = 'id, nit, nro_documento, display_name, email';

    const { data: porNit, error: errorNit } = await supabase
      .from('user_profiles')
      .select(columnas)
      .eq('nit', cc)
      .limit(1)
      .maybeSingle();
    if (errorNit) throw errorNit;

    let userData = porNit;

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

    const nit = texto(userData.nit) || texto(userData.nro_documento) || cc;
    const displayName = texto(userData.display_name);
    const email = texto(userData.email);

    return {
      id: userData.id,
      nit: nit.trim(),
      nombre: displayName.trim() !== ''
        ? displayName.trim()
        : (email.trim() !== '' ? email.trim() : 'SIN NOMBRE'),
      data: userData
    };
  } catch (e) {
    console.error("ERROR en obtenerUsuarioPorCC");
    throw e;
  }
}

function configurarEncabezadoExcel(worksheet, cc, fechaInicial, fechaFinal) {
  // Fila 1 - Información de filtros
  worksheet.getCell('B1').value = 'CC';
  worksheet.getCell('C1').value = cc;
  worksheet.getCell('B1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFF00' }
  };
  worksheet.getCell('B1').font = { bold: true };

  worksheet.getCell('E1').value = 'FECHA INICIAL';
  worksheet.getCell('F1').value = fechaInicial;
  worksheet.getCell('E1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFA500' }
  };
  worksheet.getCell('E1').font = { bold: true };

  worksheet.getCell('J1').value = 'FECHA FIN';
  worksheet.getCell('K1').value = fechaFinal;
  worksheet.getCell('J1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFA500' }
  };
  worksheet.getCell('J1').font = { bold: true };

  worksheet.getCell('L1').value = 'BUSCAR';
  worksheet.getCell('L1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' }
  };
  worksheet.getCell('L1').font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Fila 3 - Headers de columnas
  const headers = [
    'CC',
    'NOMBRE',
    'TIPO',
    'TRANSACCION',
    'PRODUCTO',
    'FECHA APERTURA',
    'AHORRO ANTERIOR',
    'BENEFICIO ANTERIOR',
    'FECHA DEPOSITO',
    'AHORRO ACTUAL',
    'BENEFICIO',
    'AHORRO TOTAL',
    'FECHA RETIRO',
    'VALOR RETIRO',
    'TOTAL AHORRO + INTERES',
    'CANAL DE PAGO'
  ];

  const headerRow = worksheet.getRow(3);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 2); // Columna B = index 2
    cell.value = header;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F81BD' }
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });
}

function agregarSeparadorUsuario(worksheet, currentRow) {
  try {
    const row = worksheet.getRow(currentRow);
    for (let i = 2; i <= 17; i++) {
      const cell = row.getCell(i);
      cell.value = '';
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    }
    return currentRow + 1;
  } catch (e) {
    console.error("ERROR agregando separador");
    return currentRow + 1;
  }
}

function agregarFilaError(worksheet, usuario, rowIndex, error) {
  try {
    const row = worksheet.getRow(rowIndex);
    row.getCell(2).value = usuario.nit;
    row.getCell(3).value = usuario.nombre;
    row.getCell(4).value = `ERROR: ${error.length > 50 ? error.substring(0, 50) + '...' : error}`;

    for (let i = 2; i <= 17; i++) {
      const cell = row.getCell(i);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFCCCC' }
      };
      cell.font = { color: { argb: 'FFCC0000' } };
    }
  } catch (e) {
    console.error("ERROR agregando fila de error");
  }
}

function agregarFilaErrorCuenta(worksheet, usuario, cuentaId, rowIndex, error) {
  try {
    const row = worksheet.getRow(rowIndex);
    row.getCell(2).value = usuario.nit;
    row.getCell(3).value = usuario.nombre;
    row.getCell(4).value = `ERROR CUENTA ${cuentaId}: ${error.length > 30 ? error.substring(0, 30) + '...' : error}`;
  } catch (e) {
    console.error("ERROR agregando fila de error de cuenta");
  }
}

function parseDateFromBeneficio(beneficio) {
  try {
    const dateValue = beneficio.date ?? beneficio.createdAt;
    if (!dateValue) return null;
    return parseFecha(dateValue);
  } catch (e) {
    console.error("Error parseando fecha del beneficio");
    return null;
  }
}

function agregarFilaExcelConEstilo(worksheet, rowData, rowIndex, transactionType) {
  try {
    const row = worksheet.getRow(rowIndex);

    rowData.forEach((value, index) => {
      const cell = row.getCell(index + 2); // Empieza en columna B (index 2)
      if (value !== null && value !== undefined) {
        cell.value = value;
      }

      if (transactionType === 'Depositado') {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE6FFE6' }
        };
        cell.font = { color: { argb: 'FF006600' } };
      } else if (transactionType === 'Withdrawal') {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE6E6' }
        };
        cell.font = { color: { argb: 'FFCC0000' } };
      }
    });
  } catch (e) {
    console.error("ERROR agregando fila con estilo");
  }
}

function parseToDouble(value) {
  try {
    if (value === null || value === undefined) return 0.0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      return parseFloat(value) || 0.0;
    }
    return 0.0;
  } catch (e) {
    return 0.0;
  }
}

async function generarArchivoExcel(workbook, identificador) {
  const fileName = `reporte_${identificador}_${Date.now()}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  saveAs(blob, fileName);
}
