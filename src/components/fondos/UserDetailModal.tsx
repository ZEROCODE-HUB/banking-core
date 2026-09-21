import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, CreditCard, Phone, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/supabase/config";

interface StatCardProps {
  value: string;
  label: string;
  highlight?: boolean;
}

function StatCard({ value, label, highlight }: StatCardProps) {
  return (
    <div className={cn(
      "rounded-xl px-5 py-4",
      highlight 
        ? "bg-sidebar text-sidebar-foreground" 
        : "bg-card border border-border"
    )}>
      <p className={cn(
        "text-lg font-bold",
        highlight ? "text-sidebar-foreground" : "text-foreground"
      )}>
        {value}
      </p>
      <p className={cn(
        "text-sm",
        highlight ? "text-sidebar-foreground/80" : "text-muted-foreground"
      )}>
        {label}
      </p>
    </div>
  );
}

interface Movement {
  date: string;
  amount: number;
  type: string;
  status: string;
  metodo: string;
}

const itemsPerPage = 10;

interface UserDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    documento: string;
    telefono: string;
    nombre: string;
    saldoActual: number;
    ahorrado: number;
    retirado: number;
    beneficios: number;
  } | null;
}

export function UserDetailModal({ open, onOpenChange, user }: UserDetailModalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [movimientosReales, setMovimientosReales] = useState<Movement[]>([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  
  // Función para formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Cargar movimientos de la colección transactions filtrado por ahorrosId
  const cargarMovimientos = async () => {
    if (!user?.id) return;

    try {
      setCargandoMovimientos(true);
      console.log('🔄 Cargando movimientos para ahorrosId:', user.id);

      // Query a la colección transactions filtrando por ahorrosId
      const transactionsRef = collection(db, 'transactions');
      const q = query(transactionsRef, where('ahorrosId', '==', user.id));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const transactions = [];
        querySnapshot.forEach((doc) => {
          transactions.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('✅ Transacciones encontradas:', transactions.length);
        console.log('🔍 Primera transacción:', transactions[0]);
        
        // Convertir transactions a formato Movement
        const movimientos: Movement[] = transactions.map((transaction, index) => {
          console.log(`🔄 Procesando transacción ${index}:`, transaction);
          
          // Convertir Firebase Timestamp a string solo fecha (d/M/y)
          let dateString = new Date().toLocaleDateString('es-CO');
          
          if (transaction.firebaseDate) {
            try {
              // Si es un Timestamp de Firebase
              if (transaction.firebaseDate.seconds) {
                const date = new Date(transaction.firebaseDate.seconds * 1000);
                dateString = date.toLocaleDateString('es-CO');
              }
              // Si ya es una fecha
              else if (transaction.firebaseDate instanceof Date) {
                dateString = transaction.firebaseDate.toLocaleDateString('es-CO');
              }
              // Si es un string
              else if (typeof transaction.firebaseDate === 'string') {
                dateString = transaction.firebaseDate;
              }
            } catch (error) {
              console.warn('Error procesando firebaseDate:', error);
              dateString = 'Fecha no disponible';
            }
          }

          // Determinar tipo basado en transactionType
          let tipo = 'Fallido'; // Por defecto si no es ninguna
          
          console.log('🏷️ transactionType:', transaction.transactionType);
          console.log('🔄 isNovedadSaldo:', transaction.isNovedadSaldo);
          console.log('💼 isAhorroCdat:', transaction.isAhorroCdat);
          
          if (transaction.transactionType === 'Withdrawal' && transaction.isNovedadSaldo === true) {
            tipo = 'Debitado';
          } else if (transaction.isAhorroCdat === true) {
            tipo = 'Inversión';
          } else if (transaction.transactionType === 'Withdrawal') {
            tipo = 'Debitado';
          } else if (transaction.transactionType === 'Depositado') {
            tipo = 'Depositado';
          }

          // Determinar estado basado en status
          let estado = 'Fallido'; // Por defecto
          if (transaction.status === 'PENDING') {
            estado = 'Pendiente';
          } else if (transaction.status === 'APPROVED') {
            estado = 'Exitoso';
          }

          // Determinar método de pago
          let metodo = 'N/A';
          if (transaction.transactionType === 'Depositado' && transaction.isNovedadSaldo !== true) {
            metodo = 'PSE';
          } else if (transaction.isNovedadSaldo === true) {
            metodo = 'Transferencia interna';
          } else if (transaction.isAhorroCdat === true) {
            metodo = 'CDAT';
          } else if (transaction.withdrawalInfo?.bankName) {
            metodo = transaction.withdrawalInfo.bankName;
          }

          const movimiento = {
            date: dateString,
            amount: transaction.amount || 0,
            type: tipo,
            status: estado,
            metodo: metodo
          };
          
          console.log('💰 Campo amount original:', transaction.amount);
          console.log('💰 Tipo de amount:', typeof transaction.amount);
          console.log('💰 Otros campos de monto posibles:');
          console.log('   - monto:', transaction.monto);
          console.log('   - value:', transaction.value);
          console.log('   - total:', transaction.total);
          console.log('   - quantity:', transaction.quantity);
          console.log('✅ Movimiento procesado:', movimiento);
          return movimiento;
        });

        // Ordenar por fecha descendente (más reciente primero)
        const movimientosOrdenados = movimientos.sort((a, b) => {
          const dateA = new Date(a.date.split('/').reverse().join('-')); // Convertir d/M/y a Date
          const dateB = new Date(b.date.split('/').reverse().join('-')); 
          return dateB.getTime() - dateA.getTime(); // Descendente
        });

        setMovimientosReales(movimientosOrdenados);
        console.log('📊 Movimientos totales procesados:', movimientosOrdenados.length);
      } else {
        console.log('⚠️ No hay transacciones para este ahorrosId');
        setMovimientosReales([]);
      }
    } catch (error) {
      console.error('❌ Error cargando movimientos:', error);
      setMovimientosReales([]);
    } finally {
      setCargandoMovimientos(false);
    }
  };

  // Cargar movimientos cuando abra el modal
  useEffect(() => {
    if (open && user) {
      cargarMovimientos();
    }
  }, [open, user]);

  // Filtrar movimientos según los filtros seleccionados
  const movimientosFiltrados = movimientosReales.filter(mov => {
    const pasaFiltroTipo = filtroTipo === 'todos' || 
      (filtroTipo === 'deposito' && mov.type === 'Depositado') ||
      (filtroTipo === 'beneficio' && (mov.type === 'Debitado' || mov.type === 'Inversión' || mov.type === 'Fallido'));
    
    const pasaFiltroEstado = filtroEstado === 'todos' || 
      (filtroEstado === 'exitoso' && mov.status === 'Exitoso') ||
      (filtroEstado === 'rechazado' && mov.status === 'Fallido');

    return pasaFiltroTipo && pasaFiltroEstado;
  });
  
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 bg-card">
        <DialogTitle className="sr-only">Detalles del usuario {user.nombre}</DialogTitle>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold text-foreground">{user.nombre}</h2>
            <button 
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* User Info */}
          <div className="bg-muted/50 rounded-xl p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center">
                  <Mail size={18} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Línea de ahorro</p>
                  <p className="text-sm font-semibold text-foreground">Ahorro los mejores</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center">
                  <CreditCard size={18} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Identificación</p>
                  <p className="text-sm font-semibold text-foreground">{user.documento}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center">
                  <Phone size={18} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Teléfono</p>
                  <p className="text-sm font-semibold text-foreground">{user.telefono}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard value={formatCurrency(user.saldoActual)} label="Saldo actual" />
            <StatCard value={formatCurrency(user.ahorrado)} label="Total ahorrado" />
            <StatCard value={formatCurrency(user.retirado)} label="Total retirado" />
            <StatCard value={formatCurrency(user.beneficios)} label="Beneficios acumulados" highlight />
          </div>

          {/* Movements */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">Movimientos</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Tipo</span>
                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger className="w-32 bg-card border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="deposito">Depósitos</SelectItem>
                      <SelectItem value="beneficio">Beneficios</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                    <SelectTrigger className="w-32 bg-card border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="exitoso">Exitoso</SelectItem>
                      <SelectItem value="rechazado">Rechazado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <p className="text-primary font-medium text-sm mb-3">Historial de transacciones</p>

            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-medium py-3">Fecha</TableHead>
                    <TableHead className="text-muted-foreground font-medium py-3">Monto</TableHead>
                    <TableHead className="text-muted-foreground font-medium py-3">Tipo</TableHead>
                    <TableHead className="text-muted-foreground font-medium py-3">Estado</TableHead>
                    <TableHead className="text-muted-foreground font-medium py-3">Método</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargandoMovimientos ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          Cargando movimientos...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : movimientosFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No hay movimientos disponibles
                      </TableCell>
                    </TableRow>
                  ) : (
                    movimientosFiltrados
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((mov, index) => (
                        <TableRow key={index} className="border-b border-border/50 hover:bg-muted/10">
                          <TableCell className="text-muted-foreground py-3 font-mono text-sm">
                            {mov.date}
                          </TableCell>
                          <TableCell className="font-semibold py-3">
                            <span className={cn(
                              mov.type === 'Depositado' 
                                ? "text-orange-600" 
                                : "text-foreground"
                            )}>
                              {mov.type !== 'Depositado' ? '-' : ''}{formatCurrency(Math.abs(mov.amount))}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className={cn(
                              "px-2 py-1 rounded-md text-xs font-medium",
                              mov.type === 'Depositado' 
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                                : mov.type === 'Debitado'
                                ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                : mov.type === 'Inversión'
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400"
                            )}>
                              {mov.type}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className={cn(
                              "px-2 py-1 rounded-md text-xs font-medium",
                              mov.status === "Exitoso" 
                                ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                : mov.status === "Pendiente"
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                            )}>
                              {mov.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-foreground py-3">
                            {mov.metodo}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {!cargandoMovimientos && movimientosFiltrados.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, movimientosFiltrados.length)} a{" "}
                  {Math.min(currentPage * itemsPerPage, movimientosFiltrados.length)} de{" "}
                  {movimientosFiltrados.length} movimientos
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  
                  {(() => {
                    const totalPages = Math.ceil(movimientosFiltrados.length / itemsPerPage);
                    const pages = [];
                    
                    if (totalPages <= 5) {
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      if (currentPage <= 3) {
                        pages.push(1, 2, 3, '...', totalPages);
                      } else if (currentPage >= totalPages - 2) {
                        pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
                      } else {
                        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
                      }
                    }
                    
                    return pages.map((page, index) => (
                      typeof page === 'number' ? (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium",
                            currentPage === page 
                              ? "bg-foreground text-background" 
                              : "border border-border hover:bg-muted"
                          )}
                        >
                          {page}
                        </button>
                      ) : (
                        <span key={`ellipsis-${index}`} className="text-muted-foreground px-2">
                          {page}
                        </span>
                      )
                    ));
                  })()}
                  
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(movimientosFiltrados.length / itemsPerPage), p + 1))}
                    disabled={currentPage * itemsPerPage >= movimientosFiltrados.length}
                    className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
