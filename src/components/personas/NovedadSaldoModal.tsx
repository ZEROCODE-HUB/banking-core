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
import { solicitarOtpNovedad, enviarConfirmacionTransaccion } from "@/utils/sendgrid";
import { verificarOtpNovedad, aplicarNovedadSaldo } from "@/supabase/database";
import { useAuth } from "@/contexts/AuthContext";

interface NovedadSaldoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  accountType: string;
  currentBalance: string;
  ahorroSeleccionado?: {
    id: string;
    SavingsType: string;
    montoTotal: number;
  };
  onApplied?: () => void | Promise<void>;
}

type ModalStep = "edit" | "summary" | "otp" | "validated" | "success";

export function NovedadSaldoModal({ 
  open, 
  onOpenChange, 
  userName, 
  accountType, 
  currentBalance,
  ahorroSeleccionado,
  onApplied
}: NovedadSaldoModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [step, setStep] = useState<ModalStep>("edit");
  const [operationType, setOperationType] = useState<"add" | "debit">("add");
  const [amount, setAmount] = useState("");
  const [detail, setDetail] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(59);
  const [novedadId, setNovedadId] = useState("");
  const [novedadReference, setNovedadReference] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
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

  const getCurrentDate = (): string => {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getErrorMessage = (error: unknown, fallback: string): string => {
    return error instanceof Error && error.message ? error.message : fallback;
  };

  const resetModal = () => {
    setStep("edit");
    setOperationType("add");
    setAmount("");
    setDetail("");
    setOtpCode(["", "", "", "", "", ""]);
    setNovedadId("");
    setNovedadReference("");
    setIdempotencyKey("");
    setExecutionDate("");
  };

  const handleClose = () => {
    if (isProcessing) return;
    resetModal();
    onOpenChange(false);
  };

  const handleSave = () => {
    if (!amount || amount.trim() === '') {
      toast({ title: "Monto inválido", description: "Por favor ingrese un monto válido", variant: "destructive" });
      return;
    }

    const numericAmount = parseInt(getNumericValue(amount));
    if (numericAmount <= 0) {
      toast({ title: "Monto inválido", description: "El monto debe ser mayor a 0", variant: "destructive" });
      return;
    }

    if (!detail || detail.trim() === '') {
      toast({ title: "Detalle requerido", description: "Por favor ingrese un detalle", variant: "destructive" });
      return;
    }

    setIdempotencyKey(crypto.randomUUID());
    setNovedadId("");
    setNovedadReference("");
    setExecutionDate(getCurrentDate());
    setStep("summary");
  };

  const handleOtpAuthorization = async () => {
    if (isProcessing) return;

    if (!user?.uid) {
      toast({
        title: "Sesión no disponible",
        description: "Vuelve a iniciar sesión para autorizar la novedad.",
        variant: "destructive",
      });
      return;
    }

    if (!ahorroSeleccionado?.id) {
      toast({
        title: "Error",
        description: "Datos de la cuenta de ahorro no disponibles",
        variant: "destructive",
      });
      return;
    }

    const numericAmount = parseInt(getNumericValue(amount), 10);
    if (!numericAmount || numericAmount <= 0) {
      toast({
        title: "Monto inválido",
        description: "El monto debe ser mayor a 0",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await solicitarOtpNovedad({
        ahorrosId: ahorroSeleccionado.id,
        operationType,
        amount: numericAmount,
        detail,
        idempotencyKey: idempotencyKey || undefined,
        novedadId: novedadId || undefined,
      });

      if (!result.success) {
        toast({
          title: "No se pudo enviar el código",
          description: result.error || "Intente nuevamente.",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      setNovedadId(result.novedadId);
      setNovedadReference(result.reference || "");
      setOtpCode(["", "", "", "", "", ""]);
      setStep("otp");
      setCountdown(59);

      toast({
        title: "Código OTP enviado",
        description: "El código se envió al buzón de operaciones. Tiene 10 minutos para usarlo.",
        duration: 5000,
      });
    } catch (error) {
      console.error("Error solicitando el OTP de la novedad");
      toast({
        title: "Error al enviar código",
        description: getErrorMessage(error, "No se pudo enviar el código OTP. Intente nuevamente."),
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidateCode = async () => {
    if (isProcessing) return;

    const enteredOtp = otpCode.join('');
    if (enteredOtp.length !== 6) {
      toast({
        title: "Código incompleto",
        description: "Ingresa los seis dígitos del código.",
        variant: "destructive",
      });
      return;
    }

    if (!novedadId) {
      toast({
        title: "Solicitud no disponible",
        description: "Vuelve a solicitar el código OTP.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await verificarOtpNovedad(novedadId, enteredOtp);

      if (result?.ok) {
        setStep("validated");
        return;
      }

      const remaining = typeof result?.attempts_remaining === 'number'
        ? ` Intentos restantes: ${result.attempts_remaining}.`
        : '';

      toast({
        title: result?.code === 'expired' || result?.code === 'locked'
          ? "Código no válido"
          : "Código incorrecto",
        description: `${result?.message || 'Verifica el código e intente nuevamente.'}${remaining}`,
        variant: "destructive",
        duration: 5000,
      });
      setOtpCode(["", "", "", "", "", ""]);
    } catch (error) {
      console.error("Error verificando el OTP de la novedad");
      toast({
        title: "Error al validar código",
        description: getErrorMessage(error, "No se pudo validar el código. Intente nuevamente."),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalize = async () => {
    if (isProcessing) return;

    if (!novedadId) {
      toast({
        title: "Solicitud no disponible",
        description: "Vuelve a iniciar la novedad de saldo.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await aplicarNovedadSaldo(novedadId);

      if (!result?.ok) {
        throw new Error(result?.message || 'No se pudo aplicar la novedad.');
      }

      setNovedadReference(result.reference || novedadReference);
      setStep("success");

      // La novedad ya quedó aplicada en la base. Un fallo del correo de
      // confirmación o del refresco no revierte el movimiento ni debe
      // mostrarse como un error de la operación.
      try {
        await enviarConfirmacionTransaccion({ novedadId });
      } catch {
        console.error("No se pudo enviar la confirmación de la novedad");
      }

      try {
        await onApplied?.();
      } catch {
        console.error("No se pudo refrescar el detalle del cliente");
      }
    } catch (error) {
      console.error("Error al aplicar la novedad de saldo");
      toast({
        title: "Error",
        description: getErrorMessage(error, "Error al procesar la novedad de saldo. Intente nuevamente."),
        variant: "destructive",
        duration: 6000,
      });
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
    if (isProcessing) return;

    if (!ahorroSeleccionado?.id) {
      toast({
        title: "Error",
        description: "Datos de la cuenta de ahorro no disponibles",
        variant: "destructive",
      });
      return;
    }

    const numericAmount = parseInt(getNumericValue(amount), 10);

    setIsProcessing(true);
    try {
      const result = await solicitarOtpNovedad({
        ahorrosId: ahorroSeleccionado.id,
        operationType,
        amount: numericAmount,
        detail,
        idempotencyKey: idempotencyKey || undefined,
        novedadId: novedadId || undefined,
      });

      if (!result.success) {
        toast({
          title: "No se pudo reenviar el código",
          description: result.error || "Intente nuevamente.",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      setNovedadId(result.novedadId);
      setNovedadReference(result.reference || novedadReference);
      setCountdown(59);
      setOtpCode(["", "", "", "", "", ""]);

      toast({
        title: "Código reenviado",
        description: "Hemos reenviado un nuevo código al buzón de operaciones.",
        duration: 4000,
      });
    } catch (error) {
      console.error("Error reenviando el OTP de la novedad");
      toast({
        title: "Error al reenviar código",
        description: getErrorMessage(error, "No se pudo reenviar el código OTP. Intente nuevamente."),
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
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
          <p className="text-muted-foreground text-sm mb-2">
            Los cambios se han guardado correctamente.
          </p>
          {novedadReference && (
            <p className="text-sm text-foreground mb-8">
              Referencia: <span className="font-semibold">{novedadReference}</span>
            </p>
          )}
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
            aria-label="Cerrar"
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
                    <p className="text-xs text-muted-foreground mb-1">Referencia</p>
                    <p className="text-sm font-medium text-foreground">{novedadReference || 'Se asigna al autorizar'}</p>
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
            <>
              <p className="text-xs text-center text-muted-foreground">
                Solicitud registrada por {user?.display_name || user?.email || "la sesión actual"}
              </p>
              <Button
                onClick={handleOtpAuthorization}
                disabled={isProcessing}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full py-6 text-base font-medium disabled:opacity-60"
              >
                {isProcessing ? "Enviando código..." : "Autorización OTP"}
              </Button>
            </>
          )}

          {step === "otp" && (
            <Button
              onClick={handleValidateCode}
              disabled={isProcessing}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full py-6 text-base font-medium disabled:opacity-60"
            >
              {isProcessing ? "Validando..." : "Validar código"}
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