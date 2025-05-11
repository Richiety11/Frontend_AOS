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

// Cliente de React Query con configuración mejorada
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 404 || error?.response?.status === 401) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000,
      cacheTime: 30 * 60 * 1000,
    },
  },
});

// Tema personalizado
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      dark: '#115293',
      light: '#4791db',
      contrastText: '#000000',
    },
    secondary: {
      main: '#dc004e',
      dark: '#9a0036',
      light: '#e33371',
      contrastText: '#ffffff',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
    },
    success: {
      main: '#4caf50',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  components: {
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
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

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
                      {/* Rutas públicas */}
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

                      {/* Rutas protegidas */}
                      <Route
                        path="/appointments"
                        element={
                          <ProtectedRoute>
                            <AppointmentList />
                          </ProtectedRoute>
                        }
                      />

                      {/* Rutas solo para médicos */}
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

                      {/* Página de no autorizado */}
                      <Route path="/unauthorized" element={<UnauthorizedPage />} />

                      {/* Redirección por defecto */}
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

export default App;
