import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/supabase/config'; // Ajusta la ruta según tu configuración
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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
    console.log('=== INICIO GENERACION EXCEL ===');
    console.log('Parametros recibidos:');
    console.log('CC:', cc);
    console.log('Nombre:', nombre);
    console.log('Fecha inicial:', fechainicial);
    console.log('Fecha final:', fechafinal);

    if (onProgress) onProgress(5, 'Iniciando generación...');

    if (fechainicial && fechafinal && fechainicial > fechafinal) {
      throw new Error('La fecha inicial no puede ser posterior a la fecha final');
    }

    // Crear Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    if (onProgress) onProgress(10, 'Configurando formato...');

    // Formatear fechas
    const formatoFecha = (fecha) => {
      if (!fecha) return '';
      const d = new Date(fecha);
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      return `${dia}/${mes}/${anio}`;
    };

    const fechaInicialStr = fechainicial 
      ? formatoFecha(fechainicial) 
      : 'TODAS LAS FECHAS';
    const fechaFinalStr = fechafinal 
      ? formatoFecha(fechafinal) 
      : formatoFecha(new Date());

    console.log(`Fechas procesadas - Inicial: ${fechaInicialStr}, Final: ${fechaFinalStr}`);

    configurarEncabezadoExcel(
      worksheet,
      cc ?? 'TODOS',
      fechaInicialStr,
      fechaFinalStr
    );

    if (onProgress) onProgress(15, 'Obteniendo usuarios...');

    // Obtener usuarios
    let usuariosAProcesar = [];

    if (!cc || cc.trim() === '') {
      console.log('CC vacio - Buscando todos los usuarios');
      usuariosAProcesar = await obtenerTodosLosUsuarios();
    } else {
      console.log('CC especifico proporcionado:', cc, '- Buscando usuario especifico');
      const usuario = await obtenerUsuarioPorCC(cc.trim());
      if (usuario) {
        usuariosAProcesar.push(usuario);
      }
    }

    if (usuariosAProcesar.length === 0) {
      throw new Error('No se encontraron usuarios para procesar');
    }

    console.log('Total usuarios a procesar:', usuariosAProcesar.length);
    if (onProgress) onProgress(25, `${usuariosAProcesar.length} usuarios encontrados`);

    // ✅ OPTIMIZACIÓN CRÍTICA: Obtener TODOS los ahorros y transacciones de una vez
    console.log('🚀 OPTIMIZANDO: Obteniendo TODOS los ahorros...');
    if (onProgress) onProgress(30, 'Obteniendo datos de ahorros...');
    const todosLosAhorrosMap = await obtenerTodosLosAhorrosOptimizado();
    
    console.log('🚀 OPTIMIZANDO: Obteniendo TODAS las transacciones...');
    if (onProgress) onProgress(40, 'Obteniendo datos de transacciones...');
    const todasLasTransaccionesMap = await obtenerTodasLasTransaccionesOptimizado();
    
    if (onProgress) onProgress(50, 'Datos cargados, procesando usuarios...');

    const erroresUsuarios = [];
    const erroresCuentas = [];
    const advertencias = [];

    let currentRow = 3; // Fila 0: info, Fila 1: vacía, Fila 2: headers
    let primerUsuario = true;

    for (let i = 0; i < usuariosAProcesar.length; i++) {
      const usuario = usuariosAProcesar[i];
      console.log(`PROCESANDO USUARIO ${i + 1}/${usuariosAProcesar.length}: ${usuario.nit}`);

      // Reportar progreso
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
        console.error('ERROR procesando usuario', usuario.nit, ':', e);
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

    imprimirResumenFinal(
      usuariosAProcesar.length,
      erroresUsuarios,
      erroresCuentas,
      advertencias
    );

    console.log('=== EXCEL GENERADO EXITOSAMENTE ===');
  } catch (e) {
    console.error('ERROR CRITICO en excelreporte:', e);
    throw e;
  }
}

/**
 * ✅ FUNCIÓN OPTIMIZADA: Obtiene TODOS los ahorros de una vez
 */
async function obtenerTodosLosAhorrosOptimizado() {
  try {
    console.log('🚀 Obteniendo TODOS los ahorros de una vez...');
    const ahorrosRef = collection(db, 'ahorros');
    const ahorrosSnapshot = await getDocs(ahorrosRef);
    
    console.log('📊 Total ahorros encontrados:', ahorrosSnapshot.size);
    
    const ahorrosMap = new Map();
    
    for (const ahorroDoc of ahorrosSnapshot.docs) {
      const ahorroData = ahorroDoc.data();
      const userId = ahorroData.user?.id || ahorroData.user?.path?.split('/').pop();
      
      // Solo incluir cuentas con documento firmado
      const ahorrosDocPdf1 = ahorroData.AhorrosDocPdf1?.toString();
      if (ahorrosDocPdf1 && ahorrosDocPdf1.trim() !== '') {
        if (!ahorrosMap.has(userId)) {
          ahorrosMap.set(userId, []);
        }
        ahorrosMap.get(userId).push({
          id: ahorroDoc.id,
          data: ahorroData,
          ref: ahorroDoc.ref
        });
      }
    }
    
    console.log('✅ Ahorros organizados por usuario:', ahorrosMap.size, 'usuarios con ahorros válidos');
    return ahorrosMap;
  } catch (e) {
    console.error('❌ ERROR en obtenerTodosLosAhorrosOptimizado:', e);
    return new Map();
  }
}

/**
 * ✅ FUNCIÓN OPTIMIZADA: Obtiene TODAS las transacciones de una vez
 */
async function obtenerTodasLasTransaccionesOptimizado() {
  try {
    console.log('🚀 Obteniendo TODAS las transacciones de una vez...');
    const transactionsRef = collection(db, 'transactions');
    const transactionsSnapshot = await getDocs(transactionsRef);
    
    console.log('📊 Total transacciones encontradas:', transactionsSnapshot.size);
    
    const transaccionesMap = new Map();
    
    for (const transactionDoc of transactionsSnapshot.docs) {
      const transactionData = transactionDoc.data();
      const ahorrosId = transactionData.ahorrosId;
      const status = transactionData.status?.toString();
      
      // Solo incluir transacciones APPROVED
      if (status === 'APPROVED' && ahorrosId) {
        if (!transaccionesMap.has(ahorrosId)) {
          transaccionesMap.set(ahorrosId, []);
        }
        transaccionesMap.get(ahorrosId).push({
          id: transactionDoc.id,
          data: transactionData
        });
      }
    }
    
    console.log('✅ Transacciones organizadas por cuenta:', transaccionesMap.size, 'cuentas con transacciones');
    return transaccionesMap;
  } catch (e) {
    console.error('❌ ERROR en obtenerTodasLasTransaccionesOptimizado:', e);
    return new Map();
  }
}

/**
 * ✅ FUNCIÓN OPTIMIZADA: Procesa usuario usando datos precargados
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

  try {
    const userId = usuario.id;
    const cuentasUsuario = todosLosAhorrosMap.get(userId) || [];

    if (cuentasUsuario.length === 0) {
      advertencias.push(
        `Usuario ${usuario.nit} (${usuario.nombre}): No tiene cuentas válidas`
      );
      return { row: currentRow };
    }

    // Contar transacciones válidas del usuario
    let totalTransaccionesUsuario = 0;
    for (const cuenta of cuentasUsuario) {
      const transaccionesCuenta = todasLasTransaccionesMap.get(cuenta.id) || [];
      
      // Filtrar por fechas
      const transaccionesValidas = transaccionesCuenta.filter(t => {
        try {
          if (fechainicial || fechafinal) {
            const transactionDate = t.data.firebaseDate?.toDate();
            if (!transactionDate) return false;
            
            if (fechainicial && transactionDate < fechainicial) return false;
            if (fechafinal && transactionDate > fechafinal) return false;
          }
          return true;
        } catch (e) {
          return false;
        }
      });
      
      totalTransaccionesUsuario += transaccionesValidas.length;
    }

    // Agregar separador si no es el primer usuario y tiene transacciones
    if (!primerUsuario && totalTransaccionesUsuario > 0) {
      currentRow = agregarSeparadorUsuario(worksheet, currentRow);
    }

    if (totalTransaccionesUsuario === 0) {
      return { row: currentRow };
    }

    // Procesar cada cuenta de ahorros
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
  } catch (e) {
    throw e;
  }
}

/**
 * ✅ FUNCIÓN OPTIMIZADA: Procesa cuenta de ahorros usando datos precargados
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
  const tipoAhorro = ahorroData.SavingsType?.toString() ?? 'TIPO DESCONOCIDO';

  let currentRow = startRow;

  try {
    // Obtener transacciones de la cuenta desde el Map precargado
    const transaccionesCuenta = todasLasTransaccionesMap.get(cuentaId) || [];

    // Filtrar transacciones por rango de fechas
    const transactionsDocs = transaccionesCuenta.filter(t => {
      try {
        if (fechainicial || fechafinal) {
          const transactionDate = t.data.firebaseDate?.toDate();
          if (!transactionDate) return false;

          if (fechainicial && transactionDate < fechainicial) return false;
          if (fechafinal && transactionDate > fechafinal) return false;
        }
        return true;
      } catch (e) {
        return false;
      }
    });

    if (transactionsDocs.length === 0) {
      return { row: currentRow };
    }

    // CALCULAR EL MONTO TOTAL REAL DE LA CUENTA (usando todas las transacciones)
    console.log('📊 Calculando monto total real para cuenta:', cuentaId);
    let totalDepositos = 0.0;
    let totalRetiros = 0.0;
    let totalBeneficios = 0.0;

    // Usar TODAS las transacciones de la cuenta (sin filtro de fecha para el cálculo total)
    for (const transaccion of transaccionesCuenta) {
      try {
        const data = transaccion.data;
        const type = data.transactionType?.toString() ?? '';
        const amount = parseToDouble(data.amount);
        const taxedBenefit = parseToDouble(data.taxedBenefit);

        if (type === 'Depositado') {
          totalDepositos += amount;
          totalBeneficios += taxedBenefit;
        } else if (type === 'Withdrawal') {
          totalRetiros += amount;
        }
      } catch (e) {
        console.error('⚠️ Error procesando transaccion en calculo total:', e);
        continue;
      }
    }

    // SUMAR BENEFICIOS DEL ARRAY transactions EN ahorros
    try {
      const beneficiosArrayRaw = ahorroData.transactions;
      if (Array.isArray(beneficiosArrayRaw)) {
        console.log('📊 Sumando beneficios del array transactions en ahorros...');
        for (const beneficio of beneficiosArrayRaw) {
          if (typeof beneficio === 'object' && beneficio !== null) {
            const taxedBenefitArray = parseToDouble(beneficio.taxedBenefit);
            totalBeneficios += taxedBenefitArray;
          }
        }
      }
    } catch (e) {
      console.error('⚠️ Error procesando beneficios del array en ahorros:', e);
    }

    const montoTotalReal = totalDepositos - totalRetiros + totalBeneficios;
    console.log(`💰 Monto total calculado: Depósitos=${totalDepositos} - Retiros=${totalRetiros} + Beneficios=${totalBeneficios} = ${montoTotalReal}`);

    // Ordenar transacciones por fecha (más reciente primero para mostrar)
    const transactions = [...transactionsDocs];
    transactions.sort((a, b) => {
      try {
        const dateA = a.data.firebaseDate?.toDate();
        const dateB = b.data.firebaseDate?.toDate();
        if (!dateA || !dateB) return 0;
        return dateB - dateA;
      } catch (e) {
        return 0;
      }
    });

    // OBTENER Y ORDENAR ARRAY DE BENEFICIOS
    let transactionsBeneficios = [];
    try {
      const beneficiosRaw = ahorroData.transactions;
      if (Array.isArray(beneficiosRaw)) {
        transactionsBeneficios = beneficiosRaw.filter(b => 
          typeof b === 'object' && b !== null
        );
      }

      // ORDENAR el array de beneficios por fecha
      transactionsBeneficios.sort((a, b) => {
        try {
          const dateA = parseDateFromBeneficio(a);
          const dateB = parseDateFromBeneficio(b);
          if (!dateA || !dateB) return 0;
          return dateA - dateB;
        } catch (e) {
          return 0;
        }
      });

      console.log('📊 Array de beneficios ordenado:', transactionsBeneficios.length, 'elementos');
    } catch (e) {
      console.error('⚠️ Error ordenando beneficios:', e);
      transactionsBeneficios = [];
    }

    // Crear lista cronológica de transacciones
    const transactionsChronological = [...transactions];
    transactionsChronological.sort((a, b) => {
      try {
        const dateA = a.data.firebaseDate?.toDate();
        const dateB = b.data.firebaseDate?.toDate();
        if (!dateA || !dateB) return 0;
        return dateA - dateB;
      } catch (e) {
        return 0;
      }
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

      const transactionType = transactionData.transactionType?.toString() ?? '';
      const amount = parseToDouble(transactionData.amount);

      // Guardar saldo y beneficio ANTES de esta transacción
      saldosAcumulados[transaction.id] = saldoActual;
      beneficiosAcumulados[transaction.id] = beneficioAcumulado;

      // Guardar índice cronológico
      indicesTransacciones[transaction.id] = i;

      // Actualizar saldo para la siguiente transacción
      if (transactionType === 'Depositado') {
        saldoActual += amount;

        // SUMAR BENEFICIOS
        const taxedBenefitTransaction = parseToDouble(transactionData.taxedBenefit);
        beneficioAcumulado += taxedBenefitTransaction;

        // Beneficio del array
        if (i < transactionsBeneficios.length) {
          const taxedBenefitArray = parseToDouble(transactionsBeneficios[i].taxedBenefit);
          beneficioAcumulado += taxedBenefitArray;
        }
      } else if (transactionType === 'Withdrawal') {
        saldoActual -= amount;
      }
    }

    console.log('✅ Saldos y beneficios acumulados calculados correctamente');

    // PROCESAR CADA TRANSACCIÓN PARA EL EXCEL
    for (const transaction of transactions) {
      const transactionData = transaction.data;

      try {
        const transactionType = transactionData.transactionType?.toString() ?? '';
        const amount = parseToDouble(transactionData.amount);
        const transactionDate = transactionData.firebaseDate?.toDate();

        if (!transactionDate) continue;

        // Obtener índice cronológico
        const transactionIndex = indicesTransacciones[transaction.id] ?? 0;

        // AHORRO ANTERIOR
        const ahorroAnterior = saldosAcumulados[transaction.id] ?? 0.0;

        // BENEFICIO ANTERIOR
        const beneficioAnterior = beneficiosAcumulados[transaction.id] ?? 0.0;

        // BENEFICIO ACTUAL
        let beneficioTransaccion = 0.0;
        if (transactionIndex >= 0 && transactionIndex < transactionsBeneficios.length) {
          beneficioTransaccion = parseToDouble(transactionsBeneficios[transactionIndex].taxedBenefit);
        }

        // Calcular saldo después
        let saldoDespues = ahorroAnterior;
        if (transactionType === 'Depositado') {
          saldoDespues += amount;
        } else if (transactionType === 'Withdrawal') {
          saldoDespues -= amount;
        }

        const totalAhorroInteres = montoTotalReal;

        const isAhorroCdat = transactionData.isAhorroCdat === true;
        const isNovedadSaldo = transactionData.isNovedadSaldo === true;
        const chanelPay = transactionData.chanelPay?.toString() ?? '';

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
        console.error('⚠️ ERROR procesando transaccion:', e);
        continue;
      }
    }

    return { row: currentRow };
  } catch (e) {
    console.error('❌ ERROR en procesarCuentaAhorrosOptimizada:', e);
    throw e;
  }
}

async function obtenerTodosLosUsuarios() {
  try {
    const usersRef = collection(db, 'user');
    const usersSnapshot = await getDocs(usersRef);

    console.log('Usuarios encontrados en BD:', usersSnapshot.size);

    const usuarios = [];

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();

        const nit = userData.nit?.toString() ?? '';
        const displayName = userData.display_name?.toString() ?? '';
        const email = userData.email?.toString() ?? '';

        if (!nit || nit.trim() === '') {
          console.warn(`ADVERTENCIA: Usuario ${userDoc.id} sin NIT valido, saltando...`);
          continue;
        }

        usuarios.push({
          id: userDoc.id,
          reference: userDoc.ref,
          nit: nit.trim(),
          nombre: displayName.trim() !== ''
            ? displayName.trim()
            : (email.trim() !== '' ? email.trim() : 'SIN NOMBRE'),
          data: userData
        });
      } catch (e) {
        console.error('ERROR procesando usuario', userDoc.id, ':', e);
        continue;
      }
    }

    console.log('Usuarios validos procesados:', usuarios.length);
    return usuarios;
  } catch (e) {
    console.error('ERROR en obtenerTodosLosUsuarios:', e);
    throw e;
  }
}

async function obtenerUsuarioPorCC(cc) {
  try {
    const usersRef = collection(db, 'user');
    const q = query(usersRef, where('nit', '==', cc), limit(1));
    const userSnapshot = await getDocs(q);

    if (userSnapshot.empty) {
      console.log('No se encontro usuario con CC:', cc);
      return null;
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    const nit = userData.nit?.toString() ?? cc;
    const displayName = userData.display_name?.toString() ?? '';
    const email = userData.email?.toString() ?? '';

    const usuario = {
      id: userDoc.id,
      reference: userDoc.ref,
      nit: nit.trim(),
      nombre: displayName.trim() !== ''
        ? displayName.trim()
        : (email.trim() !== '' ? email.trim() : 'SIN NOMBRE'),
      data: userData
    };

    console.log('Usuario especifico encontrado:', usuario.nit, '-', usuario.nombre);
    return usuario;
  } catch (e) {
    console.error('ERROR en obtenerUsuarioPorCC:', e);
    throw e;
  }
}

function configurarEncabezadoExcel(worksheet, cc, fechaInicial, fechaFinal) {
  console.log('Configurando encabezado Excel...');

  try {
    // Fila 0 - Información de filtros
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

    // Fila 2 - Headers de columnas
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

    console.log('Encabezado configurado correctamente');
  } catch (e) {
    console.error('ERROR configurando encabezado:', e);
    throw e;
  }
}

function agregarSeparadorUsuario(worksheet, currentRow) {
  try {
    const row = worksheet.getRow(currentRow);
    for (let i = 2; i <= 17; i++) { // Columnas B a Q (16 columnas)
      const cell = row.getCell(i);
      cell.value = '';
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    }
    console.log('Separador agregado en fila:', currentRow);
    return currentRow + 1;
  } catch (e) {
    console.error('ERROR agregando separador:', e);
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

    console.log('Fila de error agregada para usuario:', usuario.nit);
  } catch (e) {
    console.error('ERROR agregando fila de error:', e);
  }
}

async function procesarUsuario(
  worksheet,
  usuario,
  startRow,
  fechainicial,
  fechafinal,
  formatoFecha,
  erroresCuentas,
  advertencias,
  primerUsuario
) {
  let currentRow = startRow;

  try {
    if (!usuario.reference) {
      throw new Error('Referencia de usuario nula');
    }

    const ahorrosRef = collection(db, 'ahorros');
    const q = query(ahorrosRef, where('user', '==', usuario.reference));
    const ahorrosSnapshot = await getDocs(q);

    // Filtrar cuentas válidas (con documento firmado)
    const cuentasValidas = [];
    for (const ahorroDoc of ahorrosSnapshot.docs) {
      try {
        const ahorroData = ahorroDoc.data();
        const ahorrosDocPdf1 = ahorroData.AhorrosDocPdf1?.toString();

        if (ahorrosDocPdf1 && ahorrosDocPdf1.trim() !== '') {
          cuentasValidas.push(ahorroDoc);
        }
      } catch (e) {
        erroresCuentas.push(
          `Usuario ${usuario.nit} - Error validando cuenta ${ahorroDoc.id}: ${e.message}`
        );
        continue;
      }
    }

    if (cuentasValidas.length === 0) {
      advertencias.push(
        `Usuario ${usuario.nit} (${usuario.nombre}): No tiene cuentas validas`
      );
      return { row: currentRow };
    }

    // Contar transacciones válidas del usuario
    let totalTransaccionesUsuario = 0;
    for (const ahorroDoc of cuentasValidas) {
      try {
        const transactionsRef = collection(db, 'transactions');
        const q = query(transactionsRef, where('ahorrosId', '==', ahorroDoc.id));
        const transactionsSnapshot = await getDocs(q);

        const transaccionesValidas = transactionsSnapshot.docs.filter(doc => {
          try {
            const data = doc.data();

            if (data.status?.toString() !== 'APPROVED') return false;

            if (fechainicial || fechafinal) {
              try {
                const transactionDate = data.firebaseDate?.toDate();
                if (!transactionDate) return false;
                
                if (fechainicial && transactionDate < fechainicial) return false;
                if (fechafinal && transactionDate > fechafinal) return false;
              } catch (e) {
                return false;
              }
            }
            return true;
          } catch (e) {
            return false;
          }
        });

        totalTransaccionesUsuario += transaccionesValidas.length;
      } catch (e) {
        continue;
      }
    }

    // Agregar separador si no es el primer usuario y tiene transacciones
    if (!primerUsuario && totalTransaccionesUsuario > 0) {
      currentRow = agregarSeparadorUsuario(worksheet, currentRow);
    }

    if (totalTransaccionesUsuario === 0) {
      return { row: currentRow };
    }

    // Procesar cada cuenta de ahorros
    for (const ahorroDoc of cuentasValidas) {
      try {
        const resultado = await procesarCuentaAhorros(
          worksheet,
          usuario,
          ahorroDoc,
          currentRow,
          fechainicial,
          fechafinal,
          formatoFecha,
          erroresCuentas
        );
        currentRow = resultado.row;
      } catch (e) {
        const errorMsg = `Usuario ${usuario.nit} - Cuenta ${ahorroDoc.id}: ${e.message}`;
        erroresCuentas.push(errorMsg);
        agregarFilaErrorCuenta(worksheet, usuario, ahorroDoc.id, currentRow, e.message);
        currentRow++;
        continue;
      }
    }

    return { row: currentRow };
  } catch (e) {
    throw e;
  }
}

function agregarFilaErrorCuenta(worksheet, usuario, cuentaId, rowIndex, error) {
  try {
    const row = worksheet.getRow(rowIndex);
    row.getCell(2).value = usuario.nit;
    row.getCell(3).value = usuario.nombre;
    row.getCell(4).value = `ERROR CUENTA ${cuentaId}: ${error.length > 30 ? error.substring(0, 30) + '...' : error}`;

    console.log('Fila de error de cuenta agregada:', cuentaId);
  } catch (e) {
    console.error('ERROR agregando fila de error de cuenta:', e);
  }
}

async function procesarCuentaAhorros(
  worksheet,
  usuario,
  ahorroDoc,
  startRow,
  fechainicial,
  fechafinal,
  formatoFecha,
  erroresCuentas
) {
  const ahorroData = ahorroDoc.data();
  const cuentaId = ahorroDoc.id;
  const tipoAhorro = ahorroData.SavingsType?.toString() ?? 'TIPO DESCONOCIDO';

  let currentRow = startRow;

  try {
    // Obtener todas las transacciones de la cuenta
    const transactionsRef = collection(db, 'transactions');
    const q = query(transactionsRef, where('ahorrosId', '==', cuentaId));
    const transactionsSnapshot = await getDocs(q);

    // Filtrar transacciones APPROVED y por rango de fechas
    const transactionsDocs = transactionsSnapshot.docs.filter(doc => {
      try {
        const data = doc.data();

        const status = data.status?.toString() ?? '';
        if (status !== 'APPROVED') {
          return false;
        }

        if (fechainicial || fechafinal) {
          const transactionDate = data.firebaseDate?.toDate();
          if (!transactionDate) return false;

          if (fechainicial && transactionDate < fechainicial) {
            return false;
          }

          if (fechafinal && transactionDate > fechafinal) {
            return false;
          }
        }

        return true;
      } catch (e) {
        return false;
      }
    });

    if (transactionsDocs.length === 0) {
      return { row: currentRow };
    }

    // CALCULAR EL MONTO TOTAL REAL DE LA CUENTA
    console.log('Calculando monto total real para cuenta:', cuentaId);
    let totalDepositos = 0.0;
    let totalRetiros = 0.0;
    let totalBeneficios = 0.0;

    // Obtener TODAS las transacciones APPROVED (sin filtro de fecha)
    const allTransactionsRef = collection(db, 'transactions');
    const allQ = query(
      allTransactionsRef,
      where('ahorrosId', '==', cuentaId),
      where('status', '==', 'APPROVED')
    );
    const allTransactionsSnap = await getDocs(allQ);

    for (const doc of allTransactionsSnap.docs) {
      try {
        const data = doc.data();
        const type = data.transactionType?.toString() ?? '';
        const amount = parseToDouble(data.amount);
        const taxedBenefit = parseToDouble(data.taxedBenefit);

        if (type === 'Depositado') {
          totalDepositos += amount;
          totalBeneficios += taxedBenefit;
        } else if (type === 'Withdrawal') {
          totalRetiros += amount;
        }
      } catch (e) {
        console.error('Error procesando transaccion en calculo total:', e);
        continue;
      }
    }

    // SUMAR BENEFICIOS DEL ARRAY transactions EN ahorros
    try {
      const beneficiosArrayRaw = ahorroData.transactions;
      if (Array.isArray(beneficiosArrayRaw)) {
        console.log('Sumando beneficios del array transactions en ahorros...');
        for (const beneficio of beneficiosArrayRaw) {
          if (typeof beneficio === 'object' && beneficio !== null) {
            const taxedBenefitArray = parseToDouble(beneficio.taxedBenefit);
            totalBeneficios += taxedBenefitArray;
            console.log('Beneficio del array:', taxedBenefitArray);
          }
        }
      }
    } catch (e) {
      console.error('Error procesando beneficios del array en ahorros:', e);
    }

    const montoTotalReal = totalDepositos - totalRetiros + totalBeneficios;
    console.log(`Monto total calculado: Depositos=${totalDepositos} - Retiros=${totalRetiros} + Beneficios=${totalBeneficios} = ${montoTotalReal}`);

    // Ordenar transacciones por fecha (más reciente primero)
    const transactions = [...transactionsDocs];
    transactions.sort((a, b) => {
      try {
        const dateA = a.data().firebaseDate?.toDate();
        const dateB = b.data().firebaseDate?.toDate();
        if (!dateA || !dateB) return 0;
        return dateB - dateA;
      } catch (e) {
        return 0;
      }
    });

    // OBTENER Y ORDENAR ARRAY DE BENEFICIOS
    let transactionsBeneficios = [];
    try {
      const beneficiosRaw = ahorroData.transactions;
      if (Array.isArray(beneficiosRaw)) {
        transactionsBeneficios = beneficiosRaw.filter(b => 
          typeof b === 'object' && b !== null
        );
      }

      // ORDENAR el array de beneficios por fecha
      transactionsBeneficios.sort((a, b) => {
        try {
          const dateA = parseDateFromBeneficio(a);
          const dateB = parseDateFromBeneficio(b);
          if (!dateA || !dateB) return 0;
          return dateA - dateB;
        } catch (e) {
          return 0;
        }
      });

      console.log('Array de beneficios ordenado:', transactionsBeneficios.length, 'elementos');
    } catch (e) {
      console.error('Error ordenando beneficios:', e);
      transactionsBeneficios = [];
    }

    // Crear lista cronológica de transacciones
    const transactionsChronological = [...transactions];
    transactionsChronological.sort((a, b) => {
      try {
        const dateA = a.data().firebaseDate?.toDate();
        const dateB = b.data().firebaseDate?.toDate();
        if (!dateA || !dateB) return 0;
        return dateA - dateB;
      } catch (e) {
        return 0;
      }
    });

    // CALCULAR SALDOS Y BENEFICIOS ACUMULADOS
    const saldosAcumulados = {};
    const beneficiosAcumulados = {};
    const indicesTransacciones = {};
    let saldoActual = 0.0;
    let beneficioAcumulado = 0.0;

    for (let i = 0; i < transactionsChronological.length; i++) {
      const transaction = transactionsChronological[i];
      const transactionData = transaction.data();

      const transactionType = transactionData.transactionType?.toString() ?? '';
      const amount = parseToDouble(transactionData.amount);

      // Guardar saldo y beneficio ANTES de esta transacción
      saldosAcumulados[transaction.id] = saldoActual;
      beneficiosAcumulados[transaction.id] = beneficioAcumulado;

      // Guardar índice cronológico
      indicesTransacciones[transaction.id] = i;

      // Actualizar saldo para la siguiente transacción
      if (transactionType === 'Depositado') {
        saldoActual += amount;

        // SUMAR BENEFICIOS
        const taxedBenefitTransaction = parseToDouble(transactionData.taxedBenefit);
        beneficioAcumulado += taxedBenefitTransaction;

        // Beneficio del array
        if (i < transactionsBeneficios.length) {
          const taxedBenefitArray = parseToDouble(transactionsBeneficios[i].taxedBenefit);
          beneficioAcumulado += taxedBenefitArray;
        }
      } else if (transactionType === 'Withdrawal') {
        saldoActual -= amount;
      }
    }

    console.log('Saldos y beneficios acumulados calculados correctamente');

    // PROCESAR CADA TRANSACCIÓN PARA EL EXCEL
    for (const transaction of transactions) {
      const transactionData = transaction.data();

      try {
        const transactionType = transactionData.transactionType?.toString() ?? '';
        const amount = parseToDouble(transactionData.amount);
        const transactionDate = transactionData.firebaseDate?.toDate();

        if (!transactionDate) continue;

        // Obtener índice cronológico
        const transactionIndex = indicesTransacciones[transaction.id] ?? 0;

        // AHORRO ANTERIOR
        const ahorroAnterior = saldosAcumulados[transaction.id] ?? 0.0;

        // BENEFICIO ANTERIOR
        const beneficioAnterior = beneficiosAcumulados[transaction.id] ?? 0.0;

        console.log(`Transaccion ${transactionIndex + 1}:`);
        console.log('   Ahorro anterior:', ahorroAnterior);
        console.log('   Beneficio anterior (acumulado):', beneficioAnterior);

        // BENEFICIO ACTUAL
        let beneficioTransaccion = 0.0;
        if (transactionIndex >= 0 && transactionIndex < transactionsBeneficios.length) {
          beneficioTransaccion = parseToDouble(transactionsBeneficios[transactionIndex].taxedBenefit);
          console.log('   Beneficio actual:', beneficioTransaccion);
        }

        // Calcular saldo después
        let saldoDespues = ahorroAnterior;
        if (transactionType === 'Depositado') {
          saldoDespues += amount;
        } else if (transactionType === 'Withdrawal') {
          saldoDespues -= amount;
        }

        const totalAhorroInteres = montoTotalReal;

        const isAhorroCdat = transactionData.isAhorroCdat === true;
        const isNovedadSaldo = transactionData.isNovedadSaldo === true;
        const chanelPay = transactionData.chanelPay?.toString() ?? '';

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
        console.error('ERROR procesando transaccion:', e);
        continue;
      }
    }

    return { row: currentRow };
  } catch (e) {
    console.error('ERROR en procesarCuentaAhorros:', e);
    throw e;
  }
}

function parseDateFromBeneficio(beneficio) {
  try {
    if (beneficio.date) {
      const dateValue = beneficio.date;
      if (dateValue.toDate) {
        return dateValue.toDate();
      } else if (typeof dateValue === 'string') {
        return new Date(dateValue);
      }
    }

    if (beneficio.createdAt) {
      const dateValue = beneficio.createdAt;
      if (dateValue.toDate) {
        return dateValue.toDate();
      } else if (typeof dateValue === 'string') {
        return new Date(dateValue);
      }
    }

    return null;
  } catch (e) {
    console.error('Error parseando fecha del beneficio:', e);
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
    console.error('ERROR agregando fila con estilo:', e);
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

function imprimirResumenFinal(totalUsuarios, erroresUsuarios, erroresCuentas, advertencias) {
  console.log('\n' + '='.repeat(80));
  console.log('RESUMEN FINAL DEL PROCESAMIENTO');
  console.log('='.repeat(80));
  console.log('Total usuarios procesados:', totalUsuarios);
  console.log('Errores a nivel usuario:', erroresUsuarios.length);
  console.log('Errores a nivel cuenta:', erroresCuentas.length);
  console.log('Advertencias:', advertencias.length);
  console.log('='.repeat(80));

  if (erroresUsuarios.length > 0) {
    console.log('\nERRORES DE USUARIOS:');
    erroresUsuarios.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }

  if (erroresCuentas.length > 0) {
    console.log('\nERRORES DE CUENTAS:');
    erroresCuentas.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }

  if (advertencias.length > 0) {
    console.log('\nADVERTENCIAS:');
    advertencias.forEach((advertencia, index) => {
      console.log(`${index + 1}. ${advertencia}`);
    });
  }

  console.log('\n' + '='.repeat(80));
}

async function generarArchivoExcel(workbook, identificador) {
  try {
    const fileName = `reporte_${identificador}_${Date.now()}.xlsx`;
    console.log('Generando archivo:', fileName);

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(blob, fileName);

    console.log('Excel descargado exitosamente:', fileName);
  } catch (e) {
    console.error('ERROR generando archivo Excel:', e);
    throw e;
  }
}