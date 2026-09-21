import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Minus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { enviarCodigoOTP, enviarConfirmacionTransaccion } from "@/utils/sendgrid";
import { crearTransaccionNovedadSaldo, actualizarSaldoCuentaAhorro } from "@/supabase/database";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/supabase/config";

interface NovedadSaldoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  accountType: string;
  currentBalance: string;
  userData?: {
    uid?: string;
    email?: string;
    display_name?: string;
    numeroDocumento?: string;
    tipoDocumento?: string;
    [key: string]: any;
  };
  authenticatedUser?: {
    display_name?: string;
    [key: string]: any;
  };
  ahorroSeleccionado?: {
    id: string;
    SavingsType: string;
    montoTotal: number;
    [key: string]: any;
  };
}

type ModalStep = "edit" | "summary" | "otp" | "validated" | "success";

export function NovedadSaldoModal({ 
  open, 
  onOpenChange, 
  userName, 
  accountType, 
  currentBalance,
  userData,
  authenticatedUser,
  ahorroSeleccionado
}: NovedadSaldoModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<ModalStep>("edit");
  const [operationType, setOperationType] = useState<"add" | "debit">("add");
  const [amount, setAmount] = useState("");
  const [detail, setDetail] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [countdown, setCountdown] = useState(59);
  const [transactionId, setTransactionId] = useState("");
  const [executionDate, setExecutionDate] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);

  const formatNumber = (value: string): string => {
    const numericValue = value.replace(/[^\d]/g, '');
    if (!numericValue) return '';
    return new Intl.NumberFormat('es-CO').format(parseInt(numericValue));
  };

  const getNumericValue = (value: string): string => {
    return value.replace(/[^\d]/g, '');
  };

  const generateTransactionId = (): string => {
    const min = 3000000;
    const max = 3999999;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  };

  const getCurrentDate = (): string => {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const generateOtp = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const sendOtpEmailToUser = async (otp: string) => {
    const emailDestino = "novedaddesaldo@alianzacapital.co";
    console.log('📧 ✨ EMAIL CORPORATIVO PARA REGISTRO:', emailDestino);
    console.log('📋 IMPORTANTE: Email requerido para auditoría y documentación');
    
    console.log('🔍 DEBUG - userData disponible:', {
      uid: userData?.uid,
      numeroDocumento: userData?.numeroDocumento,
      id: userData?.id
    });
    
    const datosTransaccion = {
      userId: userData?.uid || authenticatedUser?.uid || 'sistema-admin',
      email: emailDestino,
      nombreUsuario: userData?.display_name || userName || 'Usuario', // ✅ CORREGIDO
      tipoOperacion: operationType === 'add' ? 'Deposito' : 'Debito',
      valorTransaccion: `$${formatNumber(amount)}`,
      idTransaccion: transactionId,
      detallesTransaccion: detail,
      otp: otp
    };

    try {
      console.log('🚀 Enviando email para registro documentado...');
      const result = await enviarCodigoOTP(datosTransaccion);
      
      if (result.success) {
        console.log('✅ EMAIL ENVIADO - Registro documentado creado');
        return true;
      } else {
        console.error('❌ EMAIL FALLÓ - Sin registro documentado');
        console.error('🔍 Error:', result.error);
        return false; 
      }
    } catch (error) {
      console.error('❌ Error crítico enviando email:', error);
      return false;
    }
  };

  const resetModal = () => {
    setStep("edit");
    setOperationType("add");
    setAmount("");
    setDetail("");
    setOtpCode(["", "", "", "", "", ""]);
    setGeneratedOtp("");
    setTransactionId("");
    setExecutionDate("");
  };

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  const handleSave = () => {
    if (!amount || amount.trim() === '') {
      alert('Por favor ingrese un monto válido');
      return;
    }

    const numericAmount = parseInt(getNumericValue(amount));
    if (numericAmount <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }

    if (!detail || detail.trim() === '') {
      alert('Por favor ingrese un detalle');
      return;
    }

    const newTransactionId = generateTransactionId();
    const currentDate = getCurrentDate();
    
    setTransactionId(newTransactionId);
    setExecutionDate(currentDate);
    setStep("summary");
  };

  const handleOtpAuthorization = async () => {
    console.clear();
    console.log('🚀 ============================================');
    console.log('🚀 INICIANDO PROCESO DE AUTORIZACIÓN OTP');
    console.log('🚀 ============================================');
    
    try {
      const otp = generateOtp();
      setGeneratedOtp(otp);
      console.log('🔐 CÓDIGO OTP GENERADO:', otp);
      console.log('💡 USA ESTE CÓDIGO EN EL MODAL:', otp);
      console.log('🎯 ✨ CÓDIGO PARA COPIAR:', otp);
      console.log('📋 ↑ ↑ ↑ COPIA EL CÓDIGO DE ARRIBA ↑ ↑ ↑');
      
      console.log('📧 Iniciando envío de email para registro documentado...');
      const result = await sendOtpEmailToUser(otp);
      
      if (result) {
        toast({
          title: "Código OTP enviado",
          description: "Email enviado exitosamente. Revisa tu correo para el registro documentado.",
          duration: 4000,
        });
      } else {
        // ✅ CORREGIDO: Ya no cancela, solo muestra advertencia y avanza igual
        toast({
          title: "Código OTP generado",
          description: "No se pudo enviar el email. Revisa la consola para el código.",
          variant: "destructive",
          duration: 4000,
        });
      }

      // Siempre avanza al paso OTP
      setStep("otp");
      setCountdown(59);

    } catch (error) {
      console.error('Error enviando OTP:', error);
      toast({
        title: "Error al enviar código",
        description: "No se pudo enviar el código OTP. Intente nuevamente.",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const handleValidateCode = () => {
    const enteredOtp = otpCode.join(''); 
    
    if (enteredOtp === generatedOtp) {
      setStep("validated");
    } else {
      alert('Código OTP incorrecto. Verifique e intente nuevamente.');
      setOtpCode(["", "", "", "", "", ""]);
    }
  };

  const handleFinalize = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      if (!userData?.uid || !ahorroSeleccionado?.id) {
        alert('Error: Datos de usuario o cuenta no disponibles');
        return;
      }

      console.log('🔍 userData completo:', userData);
      console.log('🔍 userData.empresaref:', userData.empresaref);
      console.log('🔍 userData.empresaId:', userData.empresaId);
      console.log('🔍 userData.empresaId?.referencePath:', userData.empresaId?.referencePath);
      console.log('🔍 ahorroSeleccionado completo:', ahorroSeleccionado);

      const numericAmount = parseInt(getNumericValue(amount));
      
      const transactionData = {
        amount: numericAmount,
        authorization: transactionId,
        transactionType: operationType === 'add' ? 'Depositado' : 'Withdrawal',
        userRef: userData.uid,
        message: detail,
        savingtipe: ahorroSeleccionado.SavingsType || "Linea de Ahorro",
        ahorrosRef: `/ahorros/${ahorroSeleccionado.id}`,
        ahorrosId: ahorroSeleccionado.id,
        amountFromTotal: numericAmount,
        empresaId: ahorroSeleccionado.company?.id || userData.empresaref?.id || "",
        userEmail: userData.email || "",
        userName: userData.display_name || userData.name || "",
        userPhone: userData.phone_number || userData.phone || "",
        userIdNumber: userData.numeroDocumento || userData.document_number || userData.dni || userData.numero_documento || userData.id || "",
        withdrawalInfo: {
          accountNumber: (userData.numeroDocumento || userData.document_number || userData.dni || userData.numero_documento || userData.id) + "-0",
          accountType: ahorroSeleccionado.SavingsType,
          bankName: "Alianza Capital"
        }
      };

      console.log('🔍 transactionData final:', transactionData);

      await crearTransaccionNovedadSaldo(transactionData);

      await actualizarSaldoCuentaAhorro(
        ahorroSeleccionado.id, 
        numericAmount, 
        operationType
      );

      await enviarConfirmacionTransaccion({
        userId: userData?.uid || authenticatedUser?.uid || 'sistema-admin',
        email: userData?.email || "",
        tipoMovimiento: operationType === 'add' ? 'Deposito' : 'Debito',
        valorTransaccion: `$${formatNumber(amount)}`,
        idTransaccion: transactionId,
        detallesTransaccion: detail
      });

      setStep("success");
      
      console.log('✅ Novedad de saldo procesada exitosamente');

      setTimeout(() => {
        resetModal();
        onOpenChange(false);
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('❌ Error al finalizar novedad:', error);
      alert('Error al procesar la novedad de saldo. Intente nuevamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (step === "otp" && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prevCountdown) => prevCountdown - 1);
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [step, countdown]);

  const handleResendOtp = async () => {
    try {
      const otp = generateOtp();
      setGeneratedOtp(otp);
      await sendOtpEmailToUser(otp);
      toast({
        title: "Código reenviado",
        description: "Hemos reenviado un nuevo código de verificación a tu correo.",
        duration: 4000,
      });
      setCountdown(59);
      setOtpCode(["", "", "", "", "", ""]);
    } catch (error) {
      console.error('Error reenviando OTP:', error);
      toast({
        title: "Error al reenviar código",
        description: "No se pudo reenviar el código OTP. Intente nuevamente.",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const handleAccept = () => {
    handleClose();
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length <= 1) {
      const newCode = [...otpCode];
      newCode[index] = value;
      setOtpCode(newCode);
      
      if (value && index < 5) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const renderContent = () => {
    if (step === "success") {
      return (
        <div className="flex flex-col items-center justify-center py-10 px-6 bg-card rounded-2xl">
          <div className="w-16 h-16 rounded-xl bg-green-100 flex items-center justify-center mb-6">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Novedad ejecutada exitosamente
          </h3>
          <p className="text-muted-foreground text-sm mb-8">
            Los cambios se han guardado correctamente.
          </p>
          <Button 
            onClick={handleAccept}
            className="w-56 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full py-6"
          >
            Aceptar
          </Button>
        </div>
      );
    }

    return (
      <div className="bg-card rounded-2xl">
        <DialogHeader className="p-6 pb-4 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-xl font-semibold text-foreground">Novedad de saldo</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Gestiona operaciones de depósito y débito en la cuenta de ahorro
            </DialogDescription>
          </div>
          <button 
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </DialogHeader>
        
        <div className="px-6 pb-6 space-y-5">
          <div className="bg-[#F5F5F7] rounded-xl p-5 text-center">
            <p className="text-sm text-muted-foreground mb-1">Mi saldo</p>
            <p className="text-2xl font-bold text-foreground">{currentBalance}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Datos de usuario</h4>
            <div className="bg-[#F5F5F7] rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Nombres y Apellidos</p>
                  <p className="text-sm font-medium text-foreground">{userName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tipo de cuenta</p>
                  <p className="text-sm font-medium text-foreground">{accountType}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#F0F0F2] rounded-full p-1.5 flex gap-1">
            <button
              onClick={() => step === "edit" && setOperationType("add")}
              disabled={step !== "edit"}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full transition-all font-medium text-sm",
                operationType === "add"
                  ? "bg-card text-green-600 shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
                step !== "edit" && "cursor-default"
              )}
            >
              Agregar saldo 
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center",
                operationType === "add" ? "bg-green-600" : "bg-muted-foreground"
              )}>
                <Plus size={12} className="text-white" />
              </div>
            </button>
            <button
              onClick={() => step === "edit" && setOperationType("debit")}
              disabled={step !== "edit"}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full transition-all font-medium text-sm",
                operationType === "debit"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
                step !== "edit" && "cursor-default"
              )}
            >
              Debitar saldo 
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center",
                operationType === "debit" ? "bg-foreground" : "bg-muted-foreground"
              )}>
                <Minus size={12} className="text-white" />
              </div>
            </button>
          </div>

          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Detalle de transacción</h4>
            <div className="bg-[#F5F5F7] rounded-xl p-5">
              <div className="text-center">
                {step === "edit" ? (
                  <div className="flex items-center justify-center mb-2">
                    <span className="text-[24px] font-bold mr-1 text-foreground" style={{ fontWeight: 700 }}>
                      {operationType === "add" ? "+" : "-"} $
                    </span>
                    <Input
                      value={formatNumber(amount)}
                      onChange={(e) => {
                        const numericValue = getNumericValue(e.target.value);
                        setAmount(numericValue);
                      }}
                      className="w-32 text-[24px] text-center border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                      style={{ fontWeight: 700 }}
                      placeholder="0"
                    />
                  </div>
                ) : (
                  <p className="text-[24px] text-foreground mb-2" style={{ fontWeight: 700 }}>
                    {operationType === "add" ? "+" : "-"} $ {formatNumber(amount) || '0'}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">Valor</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Detalle</h4>
            <div className="bg-[#F5F5F7] rounded-xl p-4">
              {step === "edit" ? (
                <div className="flex items-center justify-between">
                  <Input
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    placeholder="Ingrese el detalle"
                    className="flex-1 border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-sm"
                  />
                  <Button 
                    onClick={handleSave}
                    variant="ghost" 
                    className="text-primary hover:text-primary/80 font-medium text-sm h-auto p-0"
                  >
                    Guardar
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-foreground">{detail}</p>
              )}
            </div>
          </div>

          {step !== "edit" && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">Datos bancarios</h4>
              <div className="bg-[#F5F5F7] rounded-xl p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Banco</p>
                    <p className="text-sm font-medium text-foreground">Alianza Capital</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">ID de Transacción</p>
                    <p className="text-sm font-medium text-foreground">{transactionId || 'Generando...'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Fecha de ejecución</p>
                    <p className="text-sm font-medium text-foreground">{executionDate || 'Generando...'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(step === "otp" || step === "validated") && (
            <div>
              {step === "otp" && (
                <h4 className="text-sm font-medium text-foreground mb-3">Validación de transacción</h4>
              )}
              <div className={cn(
                "rounded-xl p-5",
                step === "validated" ? "bg-card" : "bg-[#F5F5F7]"
              )}>
                <div className="flex justify-center gap-2 mb-4">
                  {otpCode.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      disabled={step === "validated"}
                      className={cn(
                        "w-11 h-12 text-center text-lg font-medium rounded-lg border transition-colors",
                        step === "validated" 
                          ? "border-border bg-card" 
                          : "border-border focus:border-primary focus:ring-1 focus:ring-primary bg-card"
                      )}
                      maxLength={1}
                    />
                  ))}
                </div>
                
                {step === "otp" && (
                  <p className="text-center text-sm text-muted-foreground">
                    {countdown > 0 ? (
                      <>
                        Código enviado. Reenviar código en{" "}
                        <span className="font-medium text-foreground">{countdown}s</span>
                      </>
                    ) : (
                      <>
                        ¿No te llegó ningún código?{" "}
                        <button 
                          onClick={handleResendOtp}
                          className="text-primary font-medium underline hover:text-primary/80"
                        >
                          Reenviar código
                        </button>
                      </>
                    )}
                  </p>
                )}

                {step === "validated" && (
                  <p className="text-center text-sm font-medium text-foreground">
                    Código exitoso
                  </p>
                )}
              </div>
            </div>
          )}

          {step === "summary" && (
            <Button 
              onClick={handleOtpAuthorization}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full py-6 text-base font-medium"
            >
              Autorización OTP
            </Button>
          )}

          {step === "otp" && (
            <Button 
              onClick={handleValidateCode}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full py-6 text-base font-medium"
            >
              Validar código
            </Button>
          )}

          {step === "validated" && (
            <Button 
              onClick={handleFinalize}
              disabled={isProcessing}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full py-6 text-base font-medium disabled:opacity-60"
            >
              {isProcessing ? "Procesando..." : "Finalizar novedad"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-w-xl max-h-[90vh] overflow-y-auto p-0 bg-card border-0",
      )}>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}