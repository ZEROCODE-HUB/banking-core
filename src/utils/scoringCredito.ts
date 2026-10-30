// ============================================
// SISTEMA DE SCORING CREDITICIO
// ============================================

// Tipos
export interface DatosCredito {
  // Monto de solicitud
  montoSolicitud: number;
  mesesApagar: number;
  
  // Básica
  estadoCivil: string;
  personasDependientes: string;
  adultosAcargo: string;
  tiempoResidiendo: string;
  tipoVivienda: string;
  
  // Estabilidad laboral
  empresaNombre: string;
  tiempoEmpleo: string;
  tipodeContrato: string;
  interrupcionesLab: string;
  salarioBase: number;
  
  // Información financiera
  fuentesingreso: string;
  gastosFijos: number;
  promIngresos: number;
  
  // Información crediticia
  cuantoscreditos: string;
  retrasoPagos: string;
  tarjetasActivas: string;
  centralRiesgo: string;
  inversionActiva: string;
  creditoGota: string;
  pagoOtrasDeudas: number;
}

export interface ResultadoScoring {
  viabilidad: number; // Porcentaje final de viabilidad
  libre: number; // Porcentaje libre
  total: number; // Porcentaje total
  
  // Desglose por sección
  montoSolicitud: { puntaje: number; peso: number; resultado: number };
  basica: { puntaje: number; peso: number; resultado: number };
  estabilidadLaboral: { puntaje: number; peso: number; resultado: number };
  informacionFinanciera: { puntaje: number; peso: number; resultado: number };
  informacionCrediticia: { puntaje: number; peso: number; resultado: number };
}

// ============================================
// TABLAS DE PUNTAJES HARDCODEADAS
// ============================================

// ESTADO CIVIL
const puntajeEstadoCivil: Record<string, number> = {
  "Casado": 5,
  "Casado/a": 5,
  "CASADO/A": 5,
  "casado": 5,
  "Unión libre": 5,
  "Union libre": 5,
  "UNION LIBRE": 5,
  "union libre": 5,
  "Soltero": 3,
  "Soltero/a": 3,
  "SOLTERO/A": 3,
  "soltero": 3,
  "Divorciado": 3,
  "Divorciado/a": 3,
  "DIVORCIADO/A": 3,
  "divorciado": 3,
  "Viudo": 3,
  "Viudo/a": 3,
  "VIUDO/A": 3,
  "viudo": 3,
};

// DEPENDIENTES
const puntajeDependientes: Record<string, number> = {
  "0": 5,
  "0 - 1": 5,
  "0 - 1 ": 5,
  "0-1": 5,
  "0 -1": 5,
  "0- 1": 5,
  "1": 5,
  "2": 3,
  "3": 3,
  "4 o más": 1,
  "4 o mas": 1,
  "MAS DE 4": 1,
  "mas de 4": 1,
  "4+": 1,
};

// MENORES DE EDAD / ADULTOS MAYORES
const puntajeMenores: Record<string, number> = {
  "SI": 2,
  "Si": 2,
  "si": 2,
  "Sí": 2,
  "sí": 2,
  "NO": 5,
  "No": 5,
  "no": 5,
};

// TIEMPO RESIDIENDO
const puntajeTiempoResidiendo: Record<string, number> = {
  "Más de 24 meses": 5,
  "> 24 meses": 5,
  "Entre 6 y 24 meses": 3,
  "6-24 meses": 3,
  "Menos de 6 meses": 1,
  "< 6 meses": 1,
};

// TIPO VIVIENDA
const puntajeTipoVivienda: Record<string, number> = {
  "Propia": 5,
  "Familiar": 3,
  "Arrendada": 1,
};

// TIEMPO EMPLEO
const puntajeTiempoEmpleo: Record<string, number> = {
  "Más de 24 meses": 5,
  "> 24 meses": 5,
  "12-24 meses": 3,
  "12–24 meses": 3,
  "Entre 12 y 24 meses": 3,
  "Menos de 12 meses": 1,
  "< 12 meses": 1,
};

// TIPO CONTRATO
const puntajeTipoContrato: Record<string, number> = {
  "Indefinido": 5,
  "indefinido": 5,
  "Término fijo": 3,
  "Término fijo / Aprendiz": 3,
  "Aprendiz": 3,
  "Prestación de servicios / informal": 1,
  "Prestación de servicios": 1,
  "Informal": 1,
};

// INTERRUPCIONES LABORALES
const puntajeInterrupciones: Record<string, number> = {
  "SI": 2,
  "Si": 2,
  "NO": 5,
  "No": 5,
};

// OTRAS FUENTES INGRESO
const puntajeFuentesIngreso: Record<string, number> = {
  "SI": 5,
  "Si": 5,
  "NO": 2,
  "No": 2,
};

// CRÉDITOS ACTIVOS
const puntajeCreditosActivos: Record<string, number> = {
  "0": 5,
  "0 - 1": 5,
  "0 - 1 ": 5,
  "1": 5,
  "2": 3,
  "3": 3,
  "4 o más": 1,
};

// RETRASO PAGOS
const puntajeRetrasoPagos: Record<string, number> = {
  "SI": 1,
  "Si": 1,
  "NO": 5,
  "No": 5,
};

// TARJETAS CRÉDITO
const puntajeTarjetas: Record<string, number> = {
  "0": 5,
  "1": 5,
  "2": 3,
  "3": 3,
  "4 o más": 1,
};

// REPORTES CENTRALES RIESGO
const puntajeReportes: Record<string, number> = {
  "SI": 1,
  "Si": 1,
  "NO": 5,
  "No": 5,
  "Tuvo pero ya está al día": 3,
  "Tuvo, pero ya está al día": 3,
};

// INVERSIONES ACTIVAS
const puntajeInversiones: Record<string, number> = {
  "SI": 5,
  "Si": 5,
  "NO": 2,
  "No": 2,
};

// CRÉDITO GOTA A GOTA
const puntajeGota: Record<string, number> = {
  "SI": 2,
  "Si": 2,
  "NO": 5,
  "No": 5,
};

// ============================================
// FUNCIONES DE CÁLCULO
// ============================================

/**
 * Normaliza un texto para comparación
 * - Elimina espacios extras
 * - Convierte a minúsculas
 * - Elimina caracteres especiales
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // Reemplaza múltiples espacios por uno solo
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u");
}

/**
 * Obtiene el puntaje de una tabla, retorna 0 si no encuentra match
 * Hace búsqueda flexible (case-insensitive, sin espacios extra)
 */
function obtenerPuntaje(tabla: Record<string, number>, valor: string): number {
  if (!valor) return 0;
  
  // Intento 1: Búsqueda exacta
  if (tabla[valor] !== undefined) return tabla[valor];
  
  // Intento 2: Búsqueda normalizada
  const valorNormalizado = normalizar(valor);
  
  for (const [clave, puntaje] of Object.entries(tabla)) {
    if (normalizar(clave) === valorNormalizado) {
      return puntaje;
    }
  }
  
  // No encontrado
  console.warn("No se encontró puntaje para: \"");
  return 0;
}

/**
 * Calcula puntaje basado en porcentaje
 * @param porcentaje - Valor entre 0 y 100
 * @param rangos - Array de [limite, puntaje]
 */
function puntajePorPorcentaje(porcentaje: number, rangos: [number, number][]): number {
  for (const [limite, puntaje] of rangos) {
    if (porcentaje < limite) return puntaje;
  }
  return rangos[rangos.length - 1][1];
}

/**
 * Calcula el puntaje de la sección MONTO DE SOLICITUD (5%)
 */
function calcularMontoSolicitud(datos: DatosCredito): { puntaje: number; maximo: number } {
  let puntaje = 0;
  const maximo = 6; // 3 puntos monto + 3 puntos plazo
  
  // Puntaje monto (simplificado - 3 puntos siempre por ahora)
  puntaje += 3;
  
  // Puntaje plazo (simplificado - 3 puntos siempre por ahora)
  puntaje += 3;
  
  return { puntaje, maximo };
}

/**
 * Calcula el puntaje de la sección BÁSICA (15%)
 */
function calcularBasica(datos: DatosCredito): { puntaje: number; maximo: number } {
  let puntaje = 0;
  const maximo = 25; // 5 campos x 5 puntos máximo
  
  puntaje += obtenerPuntaje(puntajeEstadoCivil, datos.estadoCivil);
  puntaje += obtenerPuntaje(puntajeDependientes, datos.personasDependientes);
  puntaje += obtenerPuntaje(puntajeMenores, datos.adultosAcargo);
  puntaje += obtenerPuntaje(puntajeTiempoResidiendo, datos.tiempoResidiendo);
  puntaje += obtenerPuntaje(puntajeTipoVivienda, datos.tipoVivienda);
  
  return { puntaje, maximo };
}

/**
 * Calcula el puntaje de la sección ESTABILIDAD LABORAL (25%)
 */
function calcularEstabilidadLaboral(datos: DatosCredito): { puntaje: number; maximo: number } {
  let puntaje = 0;
  const maximo = 20; // 4 campos evaluables x 5 puntos máximo
  
  // Nombre empleador no suma puntos directamente
  puntaje += obtenerPuntaje(puntajeTiempoEmpleo, datos.tiempoEmpleo);
  puntaje += obtenerPuntaje(puntajeTipoContrato, datos.tipodeContrato);
  puntaje += obtenerPuntaje(puntajeInterrupciones, datos.interrupcionesLab);
  // Salario es informativo, no suma puntos directamente
  
  return { puntaje, maximo };
}

/**
 * Calcula el puntaje de la sección INFORMACIÓN FINANCIERA (25%)
 */
function calcularInformacionFinanciera(datos: DatosCredito): { puntaje: number; maximo: number } {
  let puntaje = 0;
  const maximo = 15; // 3 campos x 5 puntos máximo
  
  // Otras fuentes de ingreso
  puntaje += obtenerPuntaje(puntajeFuentesIngreso, datos.fuentesingreso);
  
  // Gastos mensuales (% del salario)
  if (datos.salarioBase > 0) {
    const porcentajeGastos = (datos.gastosFijos / datos.salarioBase) * 100;
    puntaje += puntajePorPorcentaje(porcentajeGastos, [
      [50, 5],
      [70, 3],
      [100, 1],
    ]);
  }
  
  // Promedio fuentes ingreso (informativo)
  puntaje += 5; // Por defecto damos puntos base
  
  return { puntaje, maximo };
}

/**
 * Calcula el puntaje de la sección INFORMACIÓN CREDITICIA (30%)
 */
function calcularInformacionCrediticia(datos: DatosCredito): { puntaje: number; maximo: number } {
  let puntaje = 0;
  const maximo = 35; // 7 campos x 5 puntos máximo
  
  puntaje += obtenerPuntaje(puntajeCreditosActivos, datos.cuantoscreditos);
  puntaje += obtenerPuntaje(puntajeRetrasoPagos, datos.retrasoPagos);
  puntaje += obtenerPuntaje(puntajeTarjetas, datos.tarjetasActivas);
  puntaje += obtenerPuntaje(puntajeReportes, datos.centralRiesgo);
  puntaje += obtenerPuntaje(puntajeInversiones, datos.inversionActiva);
  puntaje += obtenerPuntaje(puntajeGota, datos.creditoGota);
  
  // Pago otras deudas (% del salario)
  if (datos.salarioBase > 0) {
    const porcentajeDeudas = (datos.pagoOtrasDeudas / datos.salarioBase) * 100;
    puntaje += puntajePorPorcentaje(porcentajeDeudas, [
      [30, 5],
      [50, 3],
      [100, 1],
    ]);
  } else {
    puntaje += 5; // Si no hay salario, asumimos bajo
  }
  
  return { puntaje, maximo };
}

/**
 * Calcula % LIBRE
 * Fórmula: (Salario Disponible / Monto Solicitado) * 100
 */
function calcularLibre(datos: DatosCredito): number {
  const salarioDisponible = datos.salarioBase - datos.gastosFijos;
  if (datos.montoSolicitud === 0) return 0;
  return (salarioDisponible / datos.montoSolicitud) * 100;
}

/**
 * Calcula % TOTAL
 * Fórmula aproximada basada en capacidad de pago
 */
function calcularTotal(datos: DatosCredito): number {
  if (datos.salarioBase === 0) return 0;
  const capacidadPago = datos.salarioBase - datos.gastosFijos - datos.pagoOtrasDeudas;
  const cuotaMensual = datos.montoSolicitud / datos.mesesApagar;
  if (capacidadPago === 0) return 0;
  return (cuotaMensual / capacidadPago) * 100;
}

/**
 * FUNCIÓN PRINCIPAL: Calcula el scoring completo
 */
export function calcularScoring(datos: DatosCredito): ResultadoScoring {
  // Pesos de cada sección (%)
  const PESO_MONTO = 5;
  const PESO_BASICA = 15;
  const PESO_ESTABILIDAD = 25;
  const PESO_FINANCIERA = 25;
  const PESO_CREDITICIA = 30;
  
  // Calcular puntajes por sección
  const monto = calcularMontoSolicitud(datos);
  const basica = calcularBasica(datos);
  const estabilidad = calcularEstabilidadLaboral(datos);
  const financiera = calcularInformacionFinanciera(datos);
  const crediticia = calcularInformacionCrediticia(datos);
  
  // Calcular porcentaje de cada sección
  const pctMonto = monto.maximo > 0 ? (monto.puntaje / monto.maximo) : 0;
  const pctBasica = basica.maximo > 0 ? (basica.puntaje / basica.maximo) : 0;
  const pctEstabilidad = estabilidad.maximo > 0 ? (estabilidad.puntaje / estabilidad.maximo) : 0;
  const pctFinanciera = financiera.maximo > 0 ? (financiera.puntaje / financiera.maximo) : 0;
  const pctCrediticia = crediticia.maximo > 0 ? (crediticia.puntaje / crediticia.maximo) : 0;
  
  // Calcular resultado ponderado de cada sección
  const resultadoMonto = pctMonto * PESO_MONTO;
  const resultadoBasica = pctBasica * PESO_BASICA;
  const resultadoEstabilidad = pctEstabilidad * PESO_ESTABILIDAD;
  const resultadoFinanciera = pctFinanciera * PESO_FINANCIERA;
  const resultadoCrediticia = pctCrediticia * PESO_CREDITICIA;
  
  // VIABILIDAD TOTAL
  const viabilidad = 
    resultadoMonto + 
    resultadoBasica + 
    resultadoEstabilidad + 
    resultadoFinanciera + 
    resultadoCrediticia;
  
  // Calcular % libre y % total
  const libre = calcularLibre(datos);
  const total = calcularTotal(datos);
  
  return {
    viabilidad: Math.round(viabilidad * 100) / 100, // Redondear a 2 decimales
    libre: Math.round(libre * 100) / 100,
    total: Math.round(total * 100) / 100,
    
    montoSolicitud: {
      puntaje: monto.puntaje,
      peso: PESO_MONTO,
      resultado: Math.round(resultadoMonto * 100) / 100,
    },
    basica: {
      puntaje: basica.puntaje,
      peso: PESO_BASICA,
      resultado: Math.round(resultadoBasica * 100) / 100,
    },
    estabilidadLaboral: {
      puntaje: estabilidad.puntaje,
      peso: PESO_ESTABILIDAD,
      resultado: Math.round(resultadoEstabilidad * 100) / 100,
    },
    informacionFinanciera: {
      puntaje: financiera.puntaje,
      peso: PESO_FINANCIERA,
      resultado: Math.round(resultadoFinanciera * 100) / 100,
    },
    informacionCrediticia: {
      puntaje: crediticia.puntaje,
      peso: PESO_CREDITICIA,
      resultado: Math.round(resultadoCrediticia * 100) / 100,
    },
  };
}

/**
 * Obtiene la clasificación de viabilidad
 */
export function obtenerClasificacionViabilidad(viabilidad: number): {
  nivel: "alta" | "media" | "baja";
  color: string;
  mensaje: string;
} {
  if (viabilidad >= 80) {
    return {
      nivel: "alta",
      color: "#10B981",
      mensaje: "Alta viabilidad",
    };
  } else if (viabilidad >= 60) {
    return {
      nivel: "media",
      color: "#F59E0B",
      mensaje: "Viabilidad media (revisar alertas)",
    };
  } else {
    return {
      nivel: "baja",
      color: "#EF4444",
      mensaje: "Riesgo alto - no recomendable",
    };
  }
}