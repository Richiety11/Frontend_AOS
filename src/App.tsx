/**
 * @file App.tsx
 * @description Componente principal de la aplicación de gestión de citas médicas.
 * Configura los proveedores de contexto, temas, rutas y estructura principal de la aplicación.
 * @author Equipo de Desarrollo
 * @version 2.0.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { AuthProvider } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { AppointmentList } from './components/appointments/AppointmentList';
import { ArchivedAppointmentList } from './components/appointments/ArchivedAppointmentList';
import AvailabilityManager from './components/doctors/AvailabilityManager';
import { UnauthorizedPage } from './components/errors/UnauthorizedPage';
import { ErrorBoundary } from './components/errors/ErrorBoundary';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

/**
 * @constant queryClient
 * @description Cliente de React Query con configuración personalizada para optimizar el rendimiento
 * y la experiencia de usuario. Implementa políticas de caché, reintentos y manejo de errores.
 * 
 * Configuración:
 * - No actualiza datos cuando la ventana recupera el foco (mejor UX)
 * - Implementa política de reintentos inteligente según el código de error
 * - Gestiona tiempo de frescura (staleTime) y tiempo de caché para optimizar peticiones
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // No refrescar datos cuando la ventana recupera el foco
      retry: (failureCount, error: any) => {
        // No reintentar para errores 404 (no encontrado) o 401 (no autorizado)
        if (error?.response?.status === 404 || error?.response?.status === 401) {
          return false;
        }
        return failureCount < 3; // Máximo 3 reintentos para otros errores
      },
      staleTime: 5 * 60 * 1000, // Datos considerados frescos por 5 minutos
      cacheTime: 30 * 60 * 1000, // Datos en caché por 30 minutos
    },
  },
});

/**
 * @constant theme
 * @description Tema personalizado de Material-UI para toda la aplicación.
 * Define la paleta de colores, estilos de componentes y sobrescrituras de estilo
 * para mantener una apariencia coherente en toda la aplicación.
 * 
 * Características:
 * - Paleta de color principal azul (#1976d2) para elementos principales
 * - Paleta secundaria rojo (#dc004e) para acciones destructivas o importantes
 * - Colores semánticos para estados (error, advertencia, éxito, etc.)
 * - Personalización de componentes específicos (AppBar, Button, Paper)
 */
const theme = createTheme({
  palette: {
    // Colores principales
    primary: {
      main: '#1976d2',      // Azul principal
      dark: '#115293',      // Variante oscura para hover/active
      light: '#4791db',     // Variante clara para fondos/disabled
      contrastText: '#000000', // Texto sobre fondo primary
    },
    secondary: {
      main: '#dc004e',      // Rojo secundario
      dark: '#9a0036',
      light: '#e33371',
      contrastText: '#ffffff',
    },
    // Estados semánticos
    error: {
      main: '#f44336',      // Rojo para errores
    },
    warning: {
      main: '#ff9800',      // Naranja para advertencias
    },
    info: {
      main: '#2196f3',      // Azul claro para información
    },
    success: {
      main: '#4caf50',      // Verde para éxito
    },
    // Fondos
    background: {
      default: '#f5f5f5',   // Gris claro para el fondo general
      paper: '#ffffff',     // Blanco para tarjetas y superficies elevadas
    },
  },
  // Personalizaciones de componentes específicos
  components: {
    // Barra de navegación
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1976d2',
          '& .MuiIconButton-root': {
            color: '#000000',
          },
          '& .MuiButton-root': {
            color: '#000000',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
            },
          },
        },
      },
    },
    // Botones sin mayúsculas
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', // Evita texto en mayúsculas
        },
      },
    },
    // Tarjetas sin gradientes de fondo
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Elimina imágenes de fondo
        },
      },
    },
  },
});

/**
 * @component App
 * @description Componente raíz de la aplicación que configura todos los proveedores necesarios
 * y define la estructura básica de la aplicación y sus rutas.
 * Implementa:
 * - Manejo de errores global con ErrorBoundary
 * - Gestión de estado con React Query
 * - Tema visual consistente con ThemeProvider
 * - Localización de fechas con LocalizationProvider
 * - Autenticación con AuthProvider
 * - Enrutamiento con BrowserRouter
 * @returns {JSX.Element} Aplicación configurada con todos sus proveedores y rutas
 */
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <CssBaseline />
            <AuthProvider>
              <BrowserRouter>
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                  <Navbar />
                  <main style={{ flex: 1, padding: '20px' }}>
                    <Routes>
                      {/* 
                       * @routes Públicas
                       * @description Rutas accesibles para usuarios no autenticados
                       * Utilizan ProtectedRoute con requireAuth=false para evitar acceso
                       * a usuarios ya autenticados
                       */}
                      <Route
                        path="/login"
                        element={
                          <ProtectedRoute requireAuth={false}>
                            <LoginForm />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/register"
                        element={
                          <ProtectedRoute requireAuth={false}>
                            <RegisterForm />
                          </ProtectedRoute>
                        }
                      />

                      {/* 
                       * @routes Protegidas
                       * @description Rutas accesibles solo para usuarios autenticados
                       * Utilizan ProtectedRoute sin parámetros adicionales para
                       * requerir autenticación de cualquier tipo de usuario
                       */}
                      <Route
                        path="/appointments"
                        element={
                          <ProtectedRoute>
                            <AppointmentList />
                          </ProtectedRoute>
                        }
                      />

                      {/* 
                       * @routes Específicas por rol - Doctor
                       * @description Rutas accesibles solo para médicos
                       * Utilizan ProtectedRoute con parámetro roles para restringir el acceso
                       */}
                      <Route
                        path="/availability"
                        element={
                          <ProtectedRoute roles={['doctor']}>
                            <AvailabilityManager />
                          </ProtectedRoute>
                        }
                      />
                      
                      {/* Ruta para citas archivadas */}
                      <Route
                        path="/appointments/archived"
                        element={
                          <ProtectedRoute>
                            <ErrorBoundary
                              fallback={
                                <div style={{ padding: '2rem', textAlign: 'center' }}>
                                  <h2>Ha ocurrido un error al cargar las citas archivadas</h2>
                                  <p>No se pudieron cargar correctamente algunos datos.</p>
                                  <button
                                    style={{
                                      padding: '8px 16px',
                                      backgroundColor: '#1976d2',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      marginTop: '1rem',
                                    }}
                                    onClick={() => window.location.href = '/appointments'}
                                  >
                                    Volver a citas activas
                                  </button>
                                </div>
                              }
                            >
                              <ArchivedAppointmentList />
                            </ErrorBoundary>
                          </ProtectedRoute>
                        }
                      />

                      {/* 
                       * @route Página de error - No autorizado
                       * @description Muestra mensaje de acceso denegado
                       * Esta ruta se carga cuando el usuario intenta acceder a una página
                       * para la cual no tiene permisos
                       */}
                      <Route path="/unauthorized" element={<UnauthorizedPage />} />

                      {/* 
                       * @route Ruta predeterminada - Home
                       * @description Redirección por defecto a la lista de citas
                       * Se activa cuando el usuario accede a la raíz del sitio
                       */}
                      <Route
                        path="/"
                        element={
                          <ProtectedRoute>
                            <AppointmentList />
                          </ProtectedRoute>
                        }
                      />
                    </Routes>
                  </main>
                </div>
              </BrowserRouter>
            </AuthProvider>
          </LocalizationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

/**
 * Exporta el componente principal de la aplicación para su uso en index.tsx
 */
export default App;
