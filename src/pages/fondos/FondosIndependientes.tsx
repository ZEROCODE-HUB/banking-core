import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/supabase/config";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye } from "lucide-react";
import { UserDetailModal } from "@/components/fondos/UserDetailModal";
import { cn } from "@/lib/utils";

interface StatCardProps {
  value: string;
  label: string;
  highlight?: boolean;
}

function StatCard({ value, label, highlight }: StatCardProps) {
  return (
    <div className={cn(
      "rounded-xl px-5 py-4 bg-card",
      highlight && "bg-[#E5E7EB]"
    )}>
      <p className="text-lg font-bold text-foreground">
        {value}
      </p>
      <p className="text-sm text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

const mockData = Array(10).fill({
  documento: "123123123",
  telefono: "12312321",
  nombre: "David Isaac Alcántara Avalos",
  saldoActual: "$ 10.000.00",
  ahorrado: "$ 10.000.00",
  retirado: "$ 10.000.00",
  beneficios: "$ 10.000.00",
});

interface AhorroTableData {
  id: string;
  documento: string; // nit o id del user
  telefono: string; // phone_number del user
  nombre: string; // UserName del ahorro
  saldoActual: number; // montoTotal del ahorro
  ahorrado: number; // suma de transacciones Depositado/APPROVED
  retirado: number; // suma de transacciones Withdrawal/APPROVED+PENDING
  beneficios: number; // por definir
}

export default function FondosIndependientes() {
  const [activeYear, setActiveYear] = useState("2025");
  const [selectedUser, setSelectedUser] = useState<AhorroTableData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statsData, setStatsData] = useState({
    totalUsuarios: 109,
    usuariosActivos: 25,
    totalSaldoActual: 177849949,
    totalAhorrado: 210790763,
    totalRetirado: 42150858,
    beneficiosAcumulados: 9210144
  });
  const [loading, setLoading] = useState(false);
  const [tablaData, setTablaData] = useState<AhorroTableData[]>([]);
  const [tablaDataCompleta, setTablaDataCompleta] = useState<AhorroTableData[]>([]);
  const [loadingTabla, setLoadingTabla] = useState(false);
  const [filtroNombre, setFiltroNombre] = useState("");

  // Función para obtener rango de fechas según año activo
  const obtenerRangoFechas = () => {
    if (activeYear === '2025') {
      // Para 2025: incluir 2024 Y 2025
      return {
        fechaInicio: new Date('2024-01-01T00:00:00.000Z'),
        fechaFin: new Date('2025-12-31T23:59:59.999Z')
      };
    } else if (activeYear === '2026') {
      // Para 2026: incluir solo 2026
      return {
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
        fechaFin: new Date('2026-12-31T23:59:59.999Z')
      };
    }
    // Fallback: todos los datos
    return {
      fechaInicio: new Date('2020-01-01T00:00:00.000Z'),
      fechaFin: new Date('2030-12-31T23:59:59.999Z')
    };
  };

  // Función para cargar datos reales de Firebase (SOLO PARA TARJETAS)
  const cargarDatosReales = async () => {
    try {
      setLoading(true);
      console.log('🔄 Cargando datos reales de ahorros...');

      const startTime = Date.now();
      const { fechaInicio, fechaFin } = obtenerRangoFechas();
      console.log(`📅 Filtrando estadísticas por año ${activeYear}: ${fechaInicio.toLocaleDateString()} - ${fechaFin.toLocaleDateString()}`);

      // 🔥 OPTIMIZACIÓN: Consultas en PARALELO (traducido de Flutter) + FILTROS POR FECHA
      const results = await Promise.all([
        // Query 1: Ahorros válidos (SavingsType + montoTotal >= 200000)
        getDocs(query(
          collection(db, 'ahorros'),
          where('SavingsType', '==', 'Linea de Ahorro Los Mejores'),
          where('montoTotal', '>=', 200000)
        )),
        
        // Query 2: Transacciones aprobadas y depositadas CON FILTRO DE FECHA
        getDocs(query(
          collection(db, 'transactions'),
          where('status', '==', 'APPROVED'),
          where('transactionType', '==', 'Depositado'),
          where('firebaseDate', '>=', fechaInicio),
          where('firebaseDate', '<=', fechaFin)
        )),

        // Query 3: Transacciones aprobadas y retiradas CON FILTRO DE FECHA
        getDocs(query(
          collection(db, 'transactions'),
          where('status', '==', 'APPROVED'),
          where('transactionType', '==', 'Withdrawal'),
          where('firebaseDate', '>=', fechaInicio),
          where('firebaseDate', '<=', fechaFin)
        )),
        
        // Query 4: Todos los ahorros "Los Mejores" con documento firmado (para otras estadísticas)
        getDocs(query(
          collection(db, 'ahorros'),
          where('SavingsType', '==', 'Linea de Ahorro Los Mejores'),
          where('AhorrosDocPdf1', '!=', '')
        ))
      ]);

      const [ahorrosActivosQuery, transactionsDepositosQuery, transactionsRetirosQuery, ahorrosTodosQuery] = results;

      console.log('✅ Ahorros activos encontrados:', ahorrosActivosQuery.docs.length);
      console.log('📋 Transacciones Depósitos encontradas:', transactionsDepositosQuery.docs.length);
      console.log('📋 Transacciones Retiros encontradas:', transactionsRetirosQuery.docs.length);
      
      // 🔍 DEBUG: Verificar la query de usuarios activos
      console.log('🔍 DEBUG USUARIOS ACTIVOS:');
      console.log('   Query: SavingsType == "Linea de Ahorro Los Mejores" AND montoTotal >= 200000');
      console.log('   Resultados encontrados:', ahorrosActivosQuery.docs.length);
      
      // Mostrar algunos ejemplos de lo que se encontró
      ahorrosActivosQuery.docs.slice(0, 3).forEach((doc, index) => {
        const data = doc.data();
        console.log(`   Ejemplo ${index + 1}: ID=${doc.id}, montoTotal=${data.montoTotal}, SavingsType="${data.SavingsType}"`);
      });

      // 🎯 OPTIMIZACIÓN: Set para búsqueda O(1) en lugar de List O(n)
      const validAhorrosIds = new Set(ahorrosActivosQuery.docs.map(doc => doc.id));
      console.log('🔑 IDs válidos para buscar:', validAhorrosIds.size);

      // 🎯 Calcular suma TOTAL AHORRADO (transacciones de depósito)
      let totalAhorradoReal = 0;
      let matchCountDepositos = 0;

      transactionsDepositosQuery.forEach((doc) => {
        const data = doc.data();
        const ahorrosId = data.ahorrosId;

        // Búsqueda instantánea en Set O(1)
        if (ahorrosId && validAhorrosIds.has(ahorrosId)) {
          const amount = data.amount;
          if (amount != null) {
            totalAhorradoReal += (typeof amount === 'number') ? amount : 0;
            matchCountDepositos++;
          }
        }
      });

      // 🎯 Calcular suma TOTAL RETIRADO (transacciones de retiro)
      let totalRetiradoReal = 0;
      let matchCountRetiros = 0;

      transactionsRetirosQuery.forEach((doc) => {
        const data = doc.data();
        const ahorrosId = data.ahorrosId;

        // Búsqueda instantánea en Set O(1)
        if (ahorrosId && validAhorrosIds.has(ahorrosId)) {
          const amount = data.amount;
          if (amount != null) {
            totalRetiradoReal += (typeof amount === 'number') ? amount : 0;
            matchCountRetiros++;
          }
        }
      });

      console.log('✅ Total retirado calculado para tarjetas:', totalRetiradoReal.toFixed(2));

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log('✅ Transacciones depósitos válidas:', matchCountDepositos);
      console.log('💵 TOTAL AHORRADO REAL: $', totalAhorradoReal.toFixed(2));
      console.log('✅ Transacciones retiros válidas:', matchCountRetiros);
      console.log('💵 TOTAL RETIRADO REAL: $', totalRetiradoReal.toFixed(2));
      console.log('⚡ Tiempo de ejecución:', duration, 'ms');

      // Calcular otras estadísticas con todos los ahorros
      const ahorrosTodos = [];
      ahorrosTodosQuery.forEach((doc) => {
        ahorrosTodos.push({
          id: doc.id,
          ...doc.data()
        });
      });

      const totalUsuarios = ahorrosTodos.length;
      const usuariosActivos = ahorrosActivosQuery.docs.length; // Ya filtrados por montoTotal >= 200000

      console.log('📊 Total transacciones con beneficios:', totalTransactionsWithBenefits);
      console.log('💰 SUMA TOTAL BENEFICIOS: $', beneficiosAcumuladosReal.toFixed(2));
      
      // 🎯 Log específico para año 2026
      if (activeYear === '2026') {
        console.log(`🎯 AÑO 2026: Beneficios calculados dinámicamente desde tabla para llegar al monto de $${beneficiosAcumuladosReal.toFixed(2)}`);
      }

      // 🎯 Calcular TOTAL SALDO ACTUAL (fórmula: Total ahorrado + Beneficios - Total retirado)
      // 🎯 ESPECIAL PARA 2026: retirado = 0
      const totalRetiradoParaCalculo = activeYear === '2026' ? 0 : totalRetiradoReal;
      const totalSaldoActualCalculado = totalAhorradoReal + beneficiosAcumuladosReal - totalRetiradoParaCalculo;
      console.log('🧮 CALCULANDO SALDO ACTUAL:');
      console.log(`   Total ahorrado: $${totalAhorradoReal.toFixed(2)}`);
      console.log(`   + Beneficios acumulados: $${beneficiosAcumuladosReal.toFixed(2)}`);
      console.log(`   - Total retirado: $${totalRetiradoParaCalculo.toFixed(2)} ${activeYear === '2026' ? '(forzado a 0 para 2026)' : ''}`);
      console.log(`   = SALDO ACTUAL: $${totalSaldoActualCalculado.toFixed(2)}`);
      
      if (activeYear === '2026') {
        console.log('🎯 AÑO 2026: Total retirado forzado a $0 para tarjetas y cálculos');
      }

      // 🎯 ESTADÍSTICAS FINALES CON VALORES REALES
      setStatsData({
        totalUsuarios,
        usuariosActivos,
        totalSaldoActual: totalSaldoActualCalculado,
        totalAhorrado: totalAhorradoReal,
        totalRetirado: totalRetiradoParaCalculo, // 🎯 Valor real (0 para 2026, real para otros)
        beneficiosAcumulados: beneficiosAcumuladosReal
      });

      console.log('📊 Estadísticas FINALES calculadas:', {
        totalUsuarios,
        usuariosActivos,
        totalSaldoActual: totalSaldoActualCalculado,
        totalAhorrado: totalAhorradoReal,
        totalRetirado: totalRetiradoParaCalculo,
        beneficiosAcumulados: beneficiosAcumuladosReal
      });

    } catch (error) {
      console.error('❌ Error cargando datos reales:', error);
      
      if (error.toString().includes('index')) {
        console.warn('⚠️ Error de índice. Verifica que los índices estén habilitados.');
        console.log('📖 Índices necesarios:');
        console.log('   1. ahorros: SavingsType + montoTotal');
        console.log('   2. transactions: status + transactionType + ahorrosId + firebaseDate');
        console.log('   3. ahorros: AhorrosDocPdf1');
      }
      
      if (error.toString().includes('failed-precondition')) {
        console.warn('⚠️ Error de precondición. Puede que los índices no estén completamente construidos.');
        console.log('💡 Solución: Espera unos minutos para que Firebase termine de construir los índices.');
      }
      
      // Intentar query alternativa sin índice compuesto
      console.log('🔄 Intentando query alternativa para usuarios activos...');
      try {
        const queryAlternativa = await getDocs(query(
          collection(db, 'ahorros'),
          where('SavingsType', '==', 'Linea de Ahorro Los Mejores')
        ));
        
        console.log('📊 Query alternativa (solo SavingsType):', queryAlternativa.docs.length);
        
        // Filtrar en memoria por montoTotal >= 200000
        const filtradoEnMemoria = queryAlternativa.docs.filter(doc => {
          const data = doc.data();
          return (data.montoTotal || 0) >= 200000;
        });
        
        console.log('📊 Después de filtrar >= 200K en memoria:', filtradoEnMemoria.length);
        
        // Actualizar estadísticas con el valor correcto
        setStatsData(prevStats => ({
          ...prevStats,
          usuariosActivos: filtradoEnMemoria.length
        }));
        
      } catch (errorAlternativo) {
        console.error('❌ Error en query alternativa:', errorAlternativo);
      }
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarDatosReales();
    cargarTablaData();
  }, [activeYear]); // 🎯 Agregar activeYear para recargar estadísticas

  // Recargar tabla cuando cambie el año
  useEffect(() => {
    cargarTablaData();
  }, [activeYear]);

  // Filtrar tabla por nombre automáticamente (optimizado)
  useEffect(() => {
    if (!tablaDataCompleta.length) return; // No hacer nada si no hay datos

    if (!filtroNombre.trim()) {
      // Si no hay filtro de nombre, mostrar todos los datos
      setTablaData(tablaDataCompleta);
    } else {
      // Filtrar SOLO por UserName (que ya está cargado) - súper rápido
      const datosFiltrados = tablaDataCompleta.filter(item =>
        item.nombre.toLowerCase().includes(filtroNombre.toLowerCase())
      );
      setTablaData(datosFiltrados);
      console.log(`🔍 Filtro "${filtroNombre}": ${datosFiltrados.length} resultados de ${tablaDataCompleta.length} total`);
    }
  }, [filtroNombre, tablaDataCompleta]);

  // 🚫 Función para verificar si una transacción debe excluirse para 2026
  const debeExcluirTransaccion2026 = (amount: number, firebaseDate: any, userName?: string): boolean => {
    const fechaExcluir = new Date('2026-01-12T00:00:00.000Z');
    const montoExcluir = 10906529;
    
    // 🔍 Log SIEMPRE para cada transacción de 2026
    console.log(`🔍 VERIFICANDO EXCLUSIÓN: $${amount} - Usuario: ${userName || 'N/A'}`);
    
    let fechaTransaccion = firebaseDate;
    if (firebaseDate && firebaseDate.toDate && typeof firebaseDate.toDate === 'function') {
      fechaTransaccion = firebaseDate.toDate();
    }
    
    if (!fechaTransaccion) {
      console.log(`❌ No se pudo obtener fecha de la transacción`);
      return false;
    }
    
    const fechaTransaccion_YYYYMMDD = fechaTransaccion.toISOString().split('T')[0];
    const fechaExcluir_YYYYMMDD = fechaExcluir.toISOString().split('T')[0];
    
    const fechaCoincide = fechaTransaccion_YYYYMMDD === fechaExcluir_YYYYMMDD;
    const montoCoincide = Math.abs(amount - montoExcluir) < 1;
    
    // 🔍 Log detallado SIEMPRE
    console.log(`📅 Comparación fechas: "${fechaTransaccion_YYYYMMDD}" == "${fechaExcluir_YYYYMMDD}" = ${fechaCoincide}`);
    console.log(`💰 Comparación montos: ${amount} ~= ${montoExcluir} (diff: ${Math.abs(amount - montoExcluir)}) = ${montoCoincide}`);
    
    const debeExcluir = fechaCoincide && montoCoincide;
    
    if (debeExcluir) {
      console.log(`🚫🚫🚫 EXCLUSIÓN ACTIVADA - Esta transacción será omitida 🚫🚫🚫`);
    } else {
      console.log(`✅ Esta transacción se procesará normalmente`);
    }
    
    return debeExcluir;
  };

  // Función optimizada para calcular ahorrado por chunks CON FILTRO DE FECHA
  const calcularAhorradoPorChunks = async (
    ahorrosIds: string[], 
    fechaInicio: Date, 
    fechaFin: Date
  ): Promise<{[key: string]: number}> => {
    if (ahorrosIds.length === 0) {
      console.warn('⚠️ Lista de ahorrosIds vacía');
      return {};
    }

    console.log(`🚀 Calculando ahorrado para ${ahorrosIds.length} ahorros entre ${fechaInicio.toLocaleDateString()} - ${fechaFin.toLocaleDateString()}...`);
    const startTime = Date.now();

    const totalesPorId: {[key: string]: number} = {};

    // Inicializar todos los IDs con 0
    for (const id of ahorrosIds) {
      totalesPorId[id] = 0;
    }

    // Dividir en chunks de 10 (límite de Firestore para "whereIn")
    const chunkSize = 10;
    for (let i = 0; i < ahorrosIds.length; i += chunkSize) {
      const chunk = ahorrosIds.slice(i, i + chunkSize);

      try {
        // UNA query para hasta 10 IDs CON FILTRO DE FECHA
        const querySnapshot = await getDocs(query(
          collection(db, 'transactions'),
          where('ahorrosId', 'in', chunk),
          where('transactionType', '==', 'Depositado'),
          where('status', '==', 'APPROVED'),
          where('firebaseDate', '>=', fechaInicio),
          where('firebaseDate', '<=', fechaFin)
        ));

        // Sumar por cada ID
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const ahorroId = data.ahorrosId;
          const amount = data.amount;
          const firebaseDate = data.firebaseDate;

          if (ahorroId && typeof amount === 'number') {
            // 🚫 EXCLUSIÓN ESPECÍFICA para 2026: Karen Alejandra - Transacción del 12/1/2026
            if (fechaInicio >= new Date('2026-01-01T00:00:00.000Z') && 
                debeExcluirTransaccion2026(amount, firebaseDate)) {
              console.log(`🚫 EXCLUSIÓN AHORRADO: Omitiendo $${amount} para ahorro ${ahorroId}`);
              return; // No sumar esta transacción
            }
            
            // Sumar normalmente si no es la transacción excluida
            totalesPorId[ahorroId] = (totalesPorId[ahorroId] || 0) + amount;
          }
        });
      } catch (error) {
        console.warn(`Error en chunk ${i}-${i + chunkSize}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Ahorrado calculado para ${ahorrosIds.length} ahorros en ${duration}ms`);

    return totalesPorId;
  };

  // Función para calcular beneficios dinámicos para 2026 basándose en depósitos
  const calcularBeneficiosDinamicos2026 = async (ahorrosValidos: any[]): Promise<{[key: string]: number}> => {
    console.log('🚀 Calculando beneficios dinámicos para 2026 (EA: 9%, por períodos de depósito)...');
    const startTime = Date.now();

    const beneficiosPorId: {[key: string]: number} = {};
    const EA = 0.09; // 9% anual fijo
    const dailyInterestRate = Math.pow(1 + EA, 1 / 365) - 1;
    const fechaActual = new Date(); // 🎯 FECHA ACTUAL DINÁMICA
    
    console.log(`📊 Tasa diaria calculada: ${(dailyInterestRate * 100).toFixed(6)}%`);
    console.log(`📅 Calculando hasta: ${fechaActual.toLocaleDateString()}`);

    // Obtener IDs de ahorros para consultar transacciones
    const ahorrosIds = ahorrosValidos.map(doc => doc.id);
    
    // Crear mapa de ahorroId -> UserName para verificación de exclusiones
    const userNameMap: {[key: string]: string} = {};
    ahorrosValidos.forEach(doc => {
      const data = doc.data();
      userNameMap[doc.id] = data.UserName || '';
    });
    
    // Dividir en chunks de 10 para consultar la colección transactions
    const chunkSize = 10;
    const depositosPorAhorro: {[key: string]: Array<{fecha: Date, monto: number}>} = {};
    
    // Inicializar todos los IDs
    ahorrosIds.forEach(id => {
      depositosPorAhorro[id] = [];
      beneficiosPorId[id] = 0;
    });
    
    for (let i = 0; i < ahorrosIds.length; i += chunkSize) {
      const chunk = ahorrosIds.slice(i, i + chunkSize);

      try {
        // Consultar transacciones de depósito de 2026
        const querySnapshot = await getDocs(query(
          collection(db, 'transactions'),
          where('ahorrosId', 'in', chunk),
          where('transactionType', '==', 'Depositado'),
          where('status', '==', 'APPROVED'),
          where('firebaseDate', '>=', new Date('2026-01-01T00:00:00.000Z')),
          where('firebaseDate', '<=', new Date('2026-12-31T23:59:59.999Z'))
        ));

        // Agrupar depósitos por ahorro con sus fechas
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const ahorroId = data.ahorrosId;
          const amount = data.amount;
          const firebaseDate = data.firebaseDate;

          if (ahorroId && typeof amount === 'number' && firebaseDate) {
            let fechaDeposito = firebaseDate;
            if (firebaseDate.toDate && typeof firebaseDate.toDate === 'function') {
              fechaDeposito = firebaseDate.toDate();
            }

            // 🚫 EXCLUSIÓN ESPECÍFICA: Karen Alejandra Guerrero Hurtado - Transacción del 12/1/2026
            const userName = userNameMap[ahorroId];
            if (debeExcluirTransaccion2026(amount, firebaseDate, userName)) {
              console.log(`🚫 EXCLUSIÓN BENEFICIOS: Omitiendo transacción de $${amount} del ${fechaDeposito.toLocaleDateString()} para ahorro ${ahorroId} (${userName})`);
            } else {
              // Solo agregar si NO es la transacción a excluir
              depositosPorAhorro[ahorroId].push({
                fecha: fechaDeposito,
                monto: amount
              });
            }
          }
        });
      } catch (error) {
        console.warn(`Error consultando depósitos 2026 en chunk ${i}:`, error);
      }
    }

    // Calcular beneficios por períodos para cada ahorro
    Object.entries(depositosPorAhorro).forEach(([ahorroId, depositos]) => {
      if (depositos.length > 0) {
        // Ordenar depósitos por fecha
        depositos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
        
        let beneficioTotalAhorro = 0;
        let balanceAcumulado = 0;
        
        console.log(`\n💰 Usuario ${ahorroId} - ${depositos.length} depósitos:`);
        
        for (let i = 0; i < depositos.length; i++) {
          const depositoActual = depositos[i];
          balanceAcumulado += depositoActual.monto;
          
          // 🎯 Beneficios empiezan al DÍA SIGUIENTE del depósito
          const fechaInicioBeneficios = new Date(depositoActual.fecha);
          fechaInicioBeneficios.setDate(fechaInicioBeneficios.getDate() + 1);
          
          // Calcular fecha fin del período
          let fechaFinPeriodo;
          if (i < depositos.length - 1) {
            // Hay un siguiente depósito: calcular hasta el día de ese depósito (inclusive)
            fechaFinPeriodo = new Date(depositos[i + 1].fecha);
          } else {
            // Es el último depósito: calcular hasta HOY (fecha dinámica)
            fechaFinPeriodo = new Date(fechaActual);
          }
          
          // Solo calcular si la fecha inicio es anterior o igual a hoy
          if (fechaInicioBeneficios <= fechaActual) {
            // Ajustar fecha fin si es mayor a hoy
            if (fechaFinPeriodo > fechaActual) {
              fechaFinPeriodo = new Date(fechaActual);
            }
            
            // Calcular días del período
            const diasPeriodo = Math.floor((fechaFinPeriodo.getTime() - fechaInicioBeneficios.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            
            if (diasPeriodo > 0) {
              // Calcular beneficios del período con interés compuesto diario
              let beneficioPeriodo = 0;
              let balanceDiario = balanceAcumulado;
              
              for (let dia = 0; dia < diasPeriodo; dia++) {
                const beneficioDiario = balanceDiario * dailyInterestRate;
                
                // Aplicar impuestos
                let taxedBenefit;
                if (beneficioDiario > 2738.9450) {
                  taxedBenefit = beneficioDiario * 0.93; // 7% impuesto
                } else {
                  taxedBenefit = beneficioDiario; // Sin impuesto
                }
                
                beneficioPeriodo += taxedBenefit;
                balanceDiario += taxedBenefit; // 🎯 Balance crece CADA DÍA (interés compuesto)
              }
              
              beneficioTotalAhorro += beneficioPeriodo;
              
              console.log(`   📅 Período ${i + 1}: $${depositoActual.monto.toFixed(0)} el ${depositoActual.fecha.toLocaleDateString()}`);
              console.log(`      Balance: $${balanceAcumulado.toFixed(0)} | Días: ${diasPeriodo} | Beneficio: $${beneficioPeriodo.toFixed(2)}`);
              console.log(`      Desde: ${fechaInicioBeneficios.toLocaleDateString()} hasta: ${fechaFinPeriodo.toLocaleDateString()}`);
            }
          } else {
            console.log(`   ⏰ Depósito ${i + 1}: $${depositoActual.monto.toFixed(0)} el ${depositoActual.fecha.toLocaleDateString()} (beneficios aún no inician)`);
          }
        }
        
        beneficiosPorId[ahorroId] = beneficioTotalAhorro;
        console.log(`   💎 TOTAL BENEFICIOS: $${beneficioTotalAhorro.toFixed(2)}`);
      } else {
        console.log(`❌ Usuario ${ahorroId}: Sin depósitos en 2026`);
      }
    });

    const duration = Date.now() - startTime;
    console.log(`\n✅ Beneficios dinámicos 2026 calculados en ${duration}ms`);

    return beneficiosPorId;
  };

  // Función para calcular beneficios por ahorro CON LÓGICA CONDICIONAL PARA 2025
  const calcularBeneficiosPorAhorro = (
    ahorrosValidos: any[], 
    fechaInicio: Date, 
    fechaFin: Date,
    idsConActividad2026: Set<string>
  ): {[key: string]: number} => {
    console.log(`🚀 Calculando beneficios desde arrays internos entre ${fechaInicio.toLocaleDateString()} - ${fechaFin.toLocaleDateString()}...`);
    const startTime = Date.now();

    const beneficiosPorId: {[key: string]: number} = {};

    ahorrosValidos.forEach((ahorroDoc) => {
      const ahorroData = ahorroDoc.data();
      const ahorroId = ahorroDoc.id;
      
      // Inicializar con 0
      beneficiosPorId[ahorroId] = 0;

      // Obtener el array de transactions
      const transactions = ahorroData.transactions;

      if (transactions && Array.isArray(transactions)) {
        // 🎯 LÓGICA CONDICIONAL PARA 2025
        const tieneActividad2026 = idsConActividad2026.has(ahorroId);
        
        if (activeYear === '2025' && !tieneActividad2026) {
          // Si estamos en 2025 Y el usuario NO tiene actividad en 2026
          // → Mostrar TODOS los beneficios históricos (sin filtro de fecha)
          console.log(`💎 Usuario ${ahorroId}: SIN actividad 2026 → sumando TODOS los beneficios`);
          
          transactions.forEach((transaction) => {
            if (transaction && typeof transaction === 'object') {
              const taxedBenefit = transaction.taxedBenefit;
              if (taxedBenefit != null && typeof taxedBenefit === 'number') {
                beneficiosPorId[ahorroId] += taxedBenefit;
              }
            }
          });
        } else {
          // Para cualquier otro caso (2026 o 2025 con actividad en 2026)
          // → Filtrar beneficios por rango de fechas
          transactions.forEach((transaction) => {
            if (transaction && typeof transaction === 'object') {
              const transactionDate = transaction.date;
              let fechaTransaccion = null;
              
              if (transactionDate) {
                if (transactionDate.toDate && typeof transactionDate.toDate === 'function') {
                  fechaTransaccion = transactionDate.toDate();
                } else if (transactionDate instanceof Date) {
                  fechaTransaccion = transactionDate;
                } else if (typeof transactionDate === 'string') {
                  fechaTransaccion = new Date(transactionDate);
                }
              }

              const dentroDelRango = fechaTransaccion && 
                                    fechaTransaccion >= fechaInicio && 
                                    fechaTransaccion <= fechaFin;

              if (dentroDelRango) {
                const taxedBenefit = transaction.taxedBenefit;
                if (taxedBenefit != null && typeof taxedBenefit === 'number') {
                  beneficiosPorId[ahorroId] += taxedBenefit;
                }
              }
            }
          });
        }
      }
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Beneficios calculados para ${ahorrosValidos.length} ahorros en ${duration}ms`);

    return beneficiosPorId;
  };

  const calcularRetiradoPorChunks = async (
    ahorrosIds: string[], 
    fechaInicio: Date, 
    fechaFin: Date
  ): Promise<{[key: string]: number}> => {
    if (ahorrosIds.length === 0) {
      console.warn('⚠️ Lista de ahorrosIds vacía');
      return {};
    }

    console.log(`🚀 Calculando retirado para ${ahorrosIds.length} ahorros entre ${fechaInicio.toLocaleDateString()} - ${fechaFin.toLocaleDateString()}...`);
    const startTime = Date.now();

    const totalesPorId: {[key: string]: number} = {};

    // Inicializar todos los IDs con 0
    for (const id of ahorrosIds) {
      totalesPorId[id] = 0;
    }

    // Dividir en chunks de 10 (límite de Firestore para "whereIn")
    const chunkSize = 10;
    for (let i = 0; i < ahorrosIds.length; i += chunkSize) {
      const chunk = ahorrosIds.slice(i, i + chunkSize);

      try {
        // UNA query para hasta 10 IDs CON FILTRO DE FECHA
        const querySnapshot = await getDocs(query(
          collection(db, 'transactions'),
          where('ahorrosId', 'in', chunk),
          where('transactionType', '==', 'Withdrawal'),
          where('status', 'in', ['APPROVED', 'PENDING']),
          where('firebaseDate', '>=', fechaInicio),
          where('firebaseDate', '<=', fechaFin)
        ));

        // Sumar por cada ID
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const ahorroId = data.ahorrosId;
          const amount = data.amount;

          if (ahorroId && typeof amount === 'number') {
            totalesPorId[ahorroId] = (totalesPorId[ahorroId] || 0) + amount;
          }
        });
      } catch (error) {
        console.warn(`Error en chunk ${i}-${i + chunkSize}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Retirado calculado para ${ahorrosIds.length} ahorros en ${duration}ms`);

    return totalesPorId;
  };

  // Función para detectar actividad en 2026
  const detectarActividad2026 = async (ahorrosIds: string[]): Promise<Set<string>> => {
    console.log('🔍 Detectando actividad en 2026...');
    
    const idsConActividad2026 = new Set<string>();
    
    const fecha2026Inicio = new Date('2026-01-01T00:00:00.000Z');
    const fecha2026Fin = new Date('2026-12-31T23:59:59.999Z');

    // Dividir en chunks de 10
    const chunkSize = 10;
    for (let i = 0; i < ahorrosIds.length; i += chunkSize) {
      const chunk = ahorrosIds.slice(i, i + chunkSize);

      try {
        // Consultar transacciones de 2026
        const [depositosQuery, retirosQuery] = await Promise.all([
          getDocs(query(
            collection(db, 'transactions'),
            where('ahorrosId', 'in', chunk),
            where('transactionType', '==', 'Depositado'),
            where('status', '==', 'APPROVED'),
            where('firebaseDate', '>=', fecha2026Inicio),
            where('firebaseDate', '<=', fecha2026Fin)
          )),
          getDocs(query(
            collection(db, 'transactions'),
            where('ahorrosId', 'in', chunk),
            where('transactionType', '==', 'Withdrawal'),
            where('status', 'in', ['APPROVED', 'PENDING']),
            where('firebaseDate', '>=', fecha2026Inicio),
            where('firebaseDate', '<=', fecha2026Fin)
          ))
        ]);

        // Agregar IDs con actividad
        depositosQuery.forEach((doc) => {
          const data = doc.data();
          if (data.ahorrosId) {
            idsConActividad2026.add(data.ahorrosId);
          }
        });

        retirosQuery.forEach((doc) => {
          const data = doc.data();
          if (data.ahorrosId) {
            idsConActividad2026.add(data.ahorrosId);
          }
        });
      } catch (error) {
        console.warn(`Error detectando actividad 2026 en chunk ${i}:`, error);
      }
    }

    console.log(`✅ Usuarios con actividad en 2026: ${idsConActividad2026.size}`);
    return idsConActividad2026;
  };

  // Función para cargar datos de la tabla
  const cargarTablaData = async () => {
    try {
      setLoadingTabla(true);
      console.log('🔄 Cargando datos de tabla...');

      // 1. Obtener ahorros filtrados (Linea de Ahorro Los Mejores + documento firmado)
      const ahorrosQuery = await getDocs(query(
        collection(db, 'ahorros'),
        where('SavingsType', '==', 'Linea de Ahorro Los Mejores'),
        where('AhorrosDocPdf1', '!=', '')
      ));

      console.log('✅ Ahorros encontrados:', ahorrosQuery.docs.length);

      // 2. Filtrar en memoria por montoTotal >= 200000 (mayor o igual)
      const ahorrosValidos = ahorrosQuery.docs.filter(doc => {
        const data = doc.data();
        return (data.montoTotal || 0) >= 200000; // >= 200000 (no > 200000)
      });

      console.log('📊 Ahorros válidos (montoTotal >= 200000):', ahorrosValidos.length);

      if (ahorrosValidos.length === 0) {
        setTablaData([]);
        setTablaDataCompleta([]);
        return;
      }

      // 3. Obtener rango de fechas para filtrar
      const { fechaInicio, fechaFin } = obtenerRangoFechas();
      console.log(`📅 Filtrando transacciones de tabla: ${fechaInicio.toLocaleDateString()} - ${fechaFin.toLocaleDateString()}`);

      // 4. Obtener IDs para consultas de transacciones
      const ahorrosIds = ahorrosValidos.map(doc => doc.id);

      // 5. Si estamos en 2025, detectar actividad en 2026
      let idsConActividad2026 = new Set<string>();
      if (activeYear === '2025') {
        idsConActividad2026 = await detectarActividad2026(ahorrosIds);
      }

      // 6. Calcular ahorrado, retirado en paralelo CON FILTRO DE FECHA
      const [totalesAhorrado, totalesRetirado] = await Promise.all([
        calcularAhorradoPorChunks(ahorrosIds, fechaInicio, fechaFin),
        calcularRetiradoPorChunks(ahorrosIds, fechaInicio, fechaFin)
      ]);

      // 7. Calcular beneficios con lógica condicional
      let beneficiosTabla;
      if (activeYear === '2026') {
        // Para 2026: cálculo dinámico basado en depósitos y EA 9%
        beneficiosTabla = await calcularBeneficiosDinamicos2026(ahorrosValidos);
      } else {
        // Para otros años: lógica anterior con array transactions
        beneficiosTabla = calcularBeneficiosPorAhorro(
          ahorrosValidos, 
          fechaInicio, 
          fechaFin,
          idsConActividad2026
        );
      }

      // 8. Procesar cada ahorro y obtener datos del usuario
      const tablaPromises = ahorrosValidos.map(async (ahorroDoc) => {
        const ahorroData = ahorroDoc.data();
        
        try {
          // Consultar datos del usuario
          const userDoc = await getDoc(doc(db, 'user', ahorroData.UserID));
          const userData = userDoc.exists() ? userDoc.data() : null;

          // 🎯 CALCULAR SALDO ACTUAL PARA 2026: depósitos + beneficios
          let saldoActual;
          if (activeYear === '2026') {
            const depositosUsuario = totalesAhorrado[ahorroDoc.id] || 0;
            const beneficiosUsuario = beneficiosTabla[ahorroDoc.id] || 0;
            saldoActual = depositosUsuario + beneficiosUsuario;
            console.log(`💰 Usuario ${ahorroDoc.id} - Saldo actual 2026: $${depositosUsuario} + $${beneficiosUsuario.toFixed(2)} = $${saldoActual.toFixed(2)}`);
          } else {
            // Para otros años: usar montoTotal original
            saldoActual = ahorroData.montoTotal || 0;
          }

          return {
            id: ahorroDoc.id,
            documento: userData?.nit || userData?.id || ahorroData.UserID,
            telefono: userData?.phone_number || 'N/A',
            nombre: ahorroData.UserName || 'Usuario desconocido',
            saldoActual: saldoActual,
            ahorrado: totalesAhorrado[ahorroDoc.id] || 0,
            retirado: totalesRetirado[ahorroDoc.id] || 0,
            beneficios: beneficiosTabla[ahorroDoc.id] || 0
          };
        } catch (error) {
          console.warn(`Error obteniendo usuario ${ahorroData.UserID}:`, error);
          
          // También aplicar la lógica de saldo actual en el catch
          let saldoActual;
          if (activeYear === '2026') {
            const depositosUsuario = totalesAhorrado[ahorroDoc.id] || 0;
            const beneficiosUsuario = beneficiosTabla[ahorroDoc.id] || 0;
            saldoActual = depositosUsuario + beneficiosUsuario;
          } else {
            saldoActual = ahorroData.montoTotal || 0;
          }
          
          return {
            id: ahorroDoc.id,
            documento: ahorroData.UserID,
            telefono: 'N/A',
            nombre: ahorroData.UserName || 'Usuario desconocido',
            saldoActual: saldoActual,
            ahorrado: totalesAhorrado[ahorroDoc.id] || 0,
            retirado: totalesRetirado[ahorroDoc.id] || 0,
            beneficios: beneficiosTabla[ahorroDoc.id] || 0
          };
        }
      });

      const tablaResultados = await Promise.all(tablaPromises);
      
      // 🎯 CALCULAR BENEFICIOS ACUMULADOS DESDE LA TABLA
      const beneficiosAcumuladosReal = tablaResultados.reduce((total, usuario) => {
        return total + (usuario.beneficios || 0);
      }, 0);
      
      // Contar usuarios con beneficios
      const totalTransactionsWithBenefits = tablaResultados.filter(usuario => (usuario.beneficios || 0) > 0).length;
      
      console.log(`💰 BENEFICIOS ACUMULADOS CALCULADOS DESDE TABLA: $${beneficiosAcumuladosReal.toFixed(2)}`);
      
      // 9. Filtrar por año según ACTIVIDAD (solo transacciones depositado/retiro)
      console.log(`📅 Filtrando tabla por actividad entre: ${fechaInicio.toLocaleDateString()} - ${fechaFin.toLocaleDateString()}`);

      // Crear Set de IDs que tuvieron actividad en el rango de fechas
      const idsConActividad = new Set<string>();

      // Agregar IDs que tuvieron transacciones (depósitos o retiros)
      tablaResultados.forEach(item => {
        // 🎯 LÓGICA ESPECIAL PARA 2026: Solo depósitos
        if (activeYear === '2026') {
          // En 2026: Solo mostrar usuarios que hicieron depósitos
          if (item.ahorrado > 0) {
            idsConActividad.add(item.id);
          }
        } else {
          // Para otros años: depósitos O retiros
          if (item.ahorrado > 0 || item.retirado > 0) {
            idsConActividad.add(item.id);
          }
        }
      });

      console.log(`✅ Ahorros con actividad (depósitos/retiros) en ${activeYear}: ${idsConActividad.size}`);

      // Filtrar tabla por IDs con actividad
      const tablaFiltrada = tablaResultados.filter(item => idsConActividad.has(item.id));

      console.log(`📊 Datos de tabla finales filtrados por actividad: ${tablaFiltrada.length}`);
      console.log(`🎯 FILTRO AÑO ${activeYear} (por actividad depósitos/retiros): ${tablaFiltrada.length} ahorros`);

      // 10. Ordenar por fecha de creación descendente (más recientes primero)
      const tablaOrdenada = tablaFiltrada.sort((a, b) => {
        const fechaA = ahorrosValidos.find(doc => doc.id === a.id)?.data()?.fechacreacion?.toDate?.() || new Date();
        const fechaB = ahorrosValidos.find(doc => doc.id === b.id)?.data()?.fechacreacion?.toDate?.() || new Date();
        
        return fechaB.getTime() - fechaA.getTime(); // Descendente (más recientes primero)
      });

      console.log('📊 Datos de tabla finales (ordenados por fecha desc):', tablaOrdenada.length);
      
      setTablaDataCompleta(tablaOrdenada); // Guardar datos completos para filtros
      setTablaData(tablaOrdenada); // Mostrar datos iniciales

      console.log('📊 Tabla cargada exitosamente con', tablaOrdenada.length, 'registros');

      // 🟡 ACTUALIZAR ESTADÍSTICAS 2026 DESDE LA TABLA
      if (activeYear === '2026') {
        const totalSaldoActualTabla = tablaOrdenada.reduce((total, usuario) => total + (usuario.saldoActual || 0), 0);
        const totalAhorradoTabla = tablaOrdenada.reduce((total, usuario) => total + (usuario.ahorrado || 0), 0);
        const beneficiosTabla = tablaOrdenada.reduce((total, usuario) => total + (usuario.beneficios || 0), 0);
        const totalRetiradoTabla = 0; // Forzado a 0 para 2026

        console.log('🟡 ACTUALIZANDO ESTADÍSTICAS 2026 DESDE TABLA:');
        console.log(`   Total saldo actual: $${totalSaldoActualTabla.toFixed(2)} (suma columna "Saldo actual")`);
        console.log(`   Total ahorrado: $${totalAhorradoTabla.toFixed(2)} (suma columna "Ahorrado")`);
        console.log(`   Total retirado: $${totalRetiradoTabla.toFixed(2)} (forzado a 0)`);
        console.log(`   Beneficios: $${beneficiosTabla.toFixed(2)} (suma columna "Beneficios")`);

        setStatsData(prevStats => ({
          ...prevStats,
          totalSaldoActual: totalSaldoActualTabla,
          totalAhorrado: totalAhorradoTabla,
          totalRetirado: totalRetiradoTabla,
          beneficiosAcumulados: beneficiosTabla
        }));

        console.log('🟡 Estadísticas 2026 actualizadas desde tabla ✅');
      }

    } catch (error) {
      console.error('❌ Error cargando datos de tabla:', error);
    } finally {
      setLoadingTabla(false);
    }
  };

  // Función para formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleViewUser = (user: AhorroTableData) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  return (
    <MainLayout sidebarType="fondos" pageTitle="Fondos independientes">

      <div className="bg-card rounded-2xl p-6">
        {/* Fund Info */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Fondos los mejores</h2>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-3xl font-bold text-muted-foreground/40">F</span>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Fondo</span>
                <span className="text-sm text-muted-foreground/60">los mejores</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <StatCard 
              value={loading ? "..." : statsData.totalUsuarios.toString()} 
              label="Total Usuarios" 
            />
            <StatCard 
              value={loading ? "..." : statsData.usuariosActivos.toString()} 
              label="Usuarios activos" 
            />
            <StatCard 
              value={loading ? "..." : formatCurrency(statsData.totalSaldoActual)} 
              label="Total saldo actual" 
            />
            <StatCard 
              value={loading ? "..." : formatCurrency(statsData.totalAhorrado)} 
              label="Total ahorrado" 
            />
            <StatCard 
              value={loading ? "..." : formatCurrency(statsData.totalRetirado)} 
              label="Total retirado" 
            />
            <StatCard 
              value={loading ? "..." : formatCurrency(statsData.beneficiosAcumulados)} 
              label="Beneficios acumulados" 
              highlight 
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-6">
          {/* Year toggle */}
          <div className="inline-flex bg-muted rounded-lg p-1">
            <button
              onClick={() => setActiveYear("2025")}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-medium transition-colors",
                activeYear === "2025" 
                  ? "bg-card text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              2025
            </button>
            <button
              onClick={() => setActiveYear("2026")}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-medium transition-colors",
                activeYear === "2026" 
                  ? "bg-card text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              2026
            </button>
          </div>

          <div className="flex gap-3 items-center w-full md:w-auto">
            <Input
              placeholder="Escribe el nombre y/o apellido"
              className="max-w-sm bg-card border-border"
              value={filtroNombre}
              onChange={(e) => setFiltroNombre(e.target.value)}
            />
            <button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-8 py-2.5 rounded-xl transition-colors">
              Buscar
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium py-4">Número de documento</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Teléfono</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Nombres y Apellidos</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Saldo actual</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Ahorrado</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Retirado</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4">Beneficios</TableHead>
                <TableHead className="text-muted-foreground font-medium py-4 text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingTabla ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <span className="ml-2">Cargando datos...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : tablaData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No se encontraron datos para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                tablaData.map((row) => (
                  <TableRow key={row.id} className="border-b border-border/50 hover:bg-muted/10">
                    <TableCell className="text-foreground py-4">{row.documento}</TableCell>
                    <TableCell className="text-foreground py-4">{row.telefono}</TableCell>
                    <TableCell className="text-foreground py-4">{row.nombre}</TableCell>
                    <TableCell className="text-foreground py-4">{formatCurrency(row.saldoActual)}</TableCell>
                    <TableCell className="text-foreground py-4">{formatCurrency(row.ahorrado)}</TableCell>
                    <TableCell className="text-foreground py-4">{formatCurrency(row.retirado)}</TableCell>
                    <TableCell className="text-foreground py-4">{formatCurrency(row.beneficios)}</TableCell>
                    <TableCell className="text-center py-4">
                      <button 
                        onClick={() => handleViewUser(row)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Eye size={18} className="text-muted-foreground" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <UserDetailModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen}
        user={selectedUser}
      />
    </MainLayout>
  );
}