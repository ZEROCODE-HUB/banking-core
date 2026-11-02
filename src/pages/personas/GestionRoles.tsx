import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  ROLES,
  ROLE_LABELS,
  getRoleLabel,
  normalizeRole,
  type Role,
} from "@/auth/roles";
import {
  actualizarRolUsuario,
  obtenerAuditoriaRoles,
  obtenerPerfilesRoles,
} from "@/supabase/database";

interface Perfil {
  id: string;
  email?: string;
  display_name?: string;
  nombre?: string;
  role?: string | null;
  user_type?: string | null;
  verification_status?: string | null;
  confirmacion_verificado?: boolean | null;
}

interface Auditoria {
  id: string;
  actor_id: string | null;
  target_id: string;
  previous_role: string | null;
  new_role: string;
  created_at: string;
}

const roleOptions: Role[] = [
  ROLES.CRM_SUPERADMIN,
  ROLES.ADMIN,
  ROLES.SUPERVISOR,
  ROLES.CUSTOMER,
];

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function GestionRoles() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [auditoria, setAuditoria] = useState<Auditoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const [nuevosPerfiles, nuevosCambios] = await Promise.all([
        obtenerPerfilesRoles(),
        obtenerAuditoriaRoles(),
      ]);
      setPerfiles(nuevosPerfiles as Perfil[]);
      setAuditoria(nuevosCambios as Auditoria[]);
    } catch {
      console.error("Error al cargar roles y permisos");
      toast({
        title: "Error",
        description: "No se pudieron cargar los roles",
        variant: "destructive",
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const nombres = useMemo(
    () =>
      Object.fromEntries(
        perfiles.map((perfil) => [
          perfil.id,
          perfil.display_name || perfil.nombre || perfil.email || perfil.id,
        ]),
      ),
    [perfiles],
  );

  const cambiarRol = async (perfil: Perfil, nuevoRol: Role) => {
    const anterior = normalizeRole(perfil.role ?? perfil.user_type);
    if (anterior === nuevoRol) return;

    // Nunca dejar el sistema sin un superadministrador.
    if (anterior === ROLES.CRM_SUPERADMIN && nuevoRol !== ROLES.CRM_SUPERADMIN) {
      const otros = perfiles.filter(
        (candidato) =>
          candidato.id !== perfil.id &&
          normalizeRole(candidato.role ?? candidato.user_type) === ROLES.CRM_SUPERADMIN,
      ).length;
      if (otros === 0) {
        toast({
          title: "Cambio bloqueado",
          description: "Debe existir al menos un CRM SuperAdmin.",
          variant: "destructive",
        });
        return;
      }
    }

    setGuardandoId(perfil.id);
    try {
      await actualizarRolUsuario({
        targetId: perfil.id,
        newRole: nuevoRol,
        previousRole: anterior,
        actorId: user?.uid ?? null,
      });
      toast({
        title: "Rol actualizado",
        description: `${nombres[perfil.id] || perfil.email || "Usuario"}: ${ROLE_LABELS[nuevoRol]}`,
      });
      await cargar();
    } catch {
      console.error("Error al actualizar el rol");
      toast({
        title: "Error",
        description: "No se pudo actualizar el rol",
        variant: "destructive",
      });
    } finally {
      setGuardandoId(null);
    }
  };

  return (
    <MainLayout sidebarType="personas">
      <Card className="bg-card border-border mb-6">
        <CardContent className="p-6">
          <PageHeader title="Roles y permisos" showMenuButton={false} />
          <p className="text-sm text-muted-foreground mb-6">
            Solo el CRM SuperAdmin puede cambiar roles. Cada cambio queda registrado
            con el usuario que lo autorizó y la fecha.
          </p>

          {cargando ? (
            <p className="text-sm text-muted-foreground">Cargando roles...</p>
          ) : perfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay perfiles para mostrar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-3 pr-4 font-medium">Usuario</th>
                    <th className="py-3 pr-4 font-medium">Rol actual</th>
                    <th className="py-3 font-medium">Asignar rol</th>
                  </tr>
                </thead>
                <tbody>
                  {perfiles.map((perfil) => {
                    const rol = normalizeRole(perfil.role ?? perfil.user_type);
                    return (
                      <tr key={perfil.id} className="border-b border-border/60">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-foreground">
                            {perfil.display_name || perfil.nombre || "Sin nombre"}
                          </p>
                          <p className="text-xs text-muted-foreground">{perfil.email}</p>
                        </td>
                        <td className="py-3 pr-4 text-foreground">
                          {rol ? ROLE_LABELS[rol] : "Sin rol"}
                        </td>
                        <td className="py-3">
                          <Select
                            value={rol ?? undefined}
                            onValueChange={(value) => cambiarRol(perfil, value as Role)}
                            disabled={guardandoId === perfil.id}
                          >
                            <SelectTrigger className="w-[190px] bg-background">
                              <SelectValue placeholder="Sin rol" />
                            </SelectTrigger>
                            <SelectContent>
                              {roleOptions.map((opcion) => (
                                <SelectItem key={opcion} value={opcion}>
                                  {ROLE_LABELS[opcion]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Cambios recientes
          </h2>
          {auditoria.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay cambios de rol registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-3 pr-4 font-medium">Fecha</th>
                    <th className="py-3 pr-4 font-medium">Autorizó</th>
                    <th className="py-3 pr-4 font-medium">Usuario</th>
                    <th className="py-3 font-medium">Cambio</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoria.map((cambio) => (
                    <tr key={cambio.id} className="border-b border-border/60">
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatDate(cambio.created_at)}
                      </td>
                      <td className="py-3 pr-4 text-foreground">
                        {cambio.actor_id ? nombres[cambio.actor_id] || cambio.actor_id : "Sistema"}
                      </td>
                      <td className="py-3 pr-4 text-foreground">
                        {nombres[cambio.target_id] || cambio.target_id}
                      </td>
                      <td className="py-3 text-foreground">
                        {cambio.previous_role
                          ? `${getRoleLabel(cambio.previous_role)} → `
                          : "Sin rol → "}
                        {getRoleLabel(cambio.new_role)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
