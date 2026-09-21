import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute, PublicRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ConsultarUsuarios from "./pages/personas/ConsultarUsuarios";
import ConsultarUsuarioDetalle from "./pages/personas/ConsultarUsuarioDetalle";
import Verificaciones from "./pages/personas/Verificaciones";
import VerificacionDetalle from "./pages/personas/VerificacionDetalle";
import SolicitudesFixed from "./pages/personas/SolicitudesFixed";
import FondosIndependientes from "./pages/fondos/FondosIndependientes";
import ContabilidadAhorro from "./pages/contabilidad/ContabilidadAhorro";
import ProductosPortafolio from "./pages/productos/PortafolioServicios";
import EstadoGeneral from "./pages/credito/EstadoGeneral";
import Cartera from "./pages/credito/Cartera";
import TestFirebase from './TestFirebase';
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Ruta pública - Login */}
            <Route path="/auth" element={
              <PublicRoute>
                <Auth />
              </PublicRoute>
            } />
            
            {/* Ruta raíz - Redirige al auth si no está logueado, sino al dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Rutas protegidas */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/personas/consultar" element={
              <ProtectedRoute>
                <ConsultarUsuarios />
              </ProtectedRoute>
            } />
            
            <Route path="/personas/consultar/detalle" element={
              <ProtectedRoute>
                <ConsultarUsuarioDetalle />
              </ProtectedRoute>
            } />
            
            <Route path="/personas/verificaciones" element={
              <ProtectedRoute>
                <Verificaciones />
              </ProtectedRoute>
            } />
            
            <Route path="/personas/verificaciones/detalle" element={
              <ProtectedRoute>
                <VerificacionDetalle />
              </ProtectedRoute>
            } />
            
            <Route path="/personas/solicitudes" element={
              <ProtectedRoute>
                <SolicitudesFixed />
              </ProtectedRoute>
            } />
            
            <Route path="/personas/retiro-ahorros" element={
              <ProtectedRoute>
                <SolicitudesFixed />
              </ProtectedRoute>
            } />
            
            <Route path="/personas/cdat" element={
              <ProtectedRoute>
                <SolicitudesFixed />
              </ProtectedRoute>
            } />
            
            <Route path="/personas/consultar-ahorros" element={
              <ProtectedRoute>
                <SolicitudesFixed />
              </ProtectedRoute>
            } />
            
            <Route path="/fondos/independientes" element={
              <ProtectedRoute>
                <FondosIndependientes />
              </ProtectedRoute>
            } />
            
            <Route path="/fondos/empleado" element={
              <ProtectedRoute>
                <FondosIndependientes />
              </ProtectedRoute>
            } />
            
            <Route path="/contabilidad/ahorro" element={
              <ProtectedRoute>
                <ContabilidadAhorro />
              </ProtectedRoute>
            } />
            
            <Route path="/productos/portafolio" element={
              <ProtectedRoute>
                <ProductosPortafolio />
              </ProtectedRoute>
            } />
            
            <Route path="/credito/estado-general" element={
              <ProtectedRoute>
                <EstadoGeneral />
              </ProtectedRoute>
            } />
            
            <Route path="/credito/cartera" element={
              <ProtectedRoute>
                <Cartera />
              </ProtectedRoute>
            } />
            
            <Route path="/test-firebase" element={
              <ProtectedRoute>
                <TestFirebase />
              </ProtectedRoute>
            } />
            
            {/* Ruta 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            44                       