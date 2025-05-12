/**
 * @file AuthContext.tsx
 * @description Contexto de autenticación para la aplicación
 * Implementa la gestión global del estado de autenticación, incluyendo
 * login, registro, verificación de tokens y cierre de sesión
 * @author Equipo de Desarrollo
 * @version 2.1.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthResponse, LoginData, RegisterData } from '../types';
import { authService, userService } from '../services/api';
import { logger } from '../services/logger';

/**
 * @interface AuthContextType
 * @description Define la estructura e interfaces del contexto de autenticación
 * @property {AuthResponse['user'] | null} user - Usuario autenticado actualmente o null si no hay sesión
 * @property {boolean} loading - Indica si hay operaciones de autenticación en proceso
 * @property {string | null} error - Mensaje de error de la última operación o null si no hay errores
 * @property {Function} login - Función para iniciar sesión con credenciales
 * @property {Function} register - Función para registrar nuevos usuarios
 * @property {Function} logout - Función para cerrar sesión
 * @property {Function} clearError - Función para limpiar mensajes de error
 * @property {Function} checkAuth - Función para verificar la validez del token actual
 */
interface AuthContextType {
  user: AuthResponse['user'] | null;
  loading: boolean;
  error: string | null;
  login: (data: LoginData) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  checkAuth: () => Promise<boolean>;
}

/**
 * @constant AuthContext
 * @description Contexto de React para gestionar el estado de autenticación a nivel global
 * Inicialmente undefined, se poblará con los valores del proveedor
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * @component AuthProvider
 * @description Proveedor de contexto de autenticación que gestiona:
 * - Estado de autenticación del usuario
 * - Operaciones de autenticación (login, registro, logout)
 * - Verificación automática de sesiones
 * - Persistencia y validación de tokens
 * @param {object} props - Props del componente
 * @param {React.ReactNode} props.children - Componentes hijos que tendrán acceso al contexto
 * @returns {JSX.Element} Proveedor de contexto de autenticación
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estado para almacenar la información del usuario autenticado
  const [user, setUser] = useState<AuthResponse['user'] | null>(null);
  // Estado para indicar si hay operaciones de autenticación en curso
  const [loading, setLoading] = useState(true);
  // Estado para almacenar mensajes de error de autenticación
  const [error, setError] = useState<string | null>(null);

  // Implementar la función checkAuth a nivel de componente para poder exportarla
  const checkAuth = async (): Promise<boolean> => {
    try {
      // Verificar si hay un token y si es válido
      const token = localStorage.getItem('token');
      
      // Si no hay token, simplemente terminamos
      if (!token) {
        logger.debug('No se encontró token en localStorage');
        setLoading(false);
        return false;
      }
      
      // Si el token es excesivamente grande o mal formateado, podría ser corrupto
      if (token.length > 2000 || !token.includes('.')) {
        logger.warn('Token demasiado grande o mal formateado, posiblemente corrupto');
        localStorage.removeItem('token');
        setError('Sesión inválida. Por favor, inicie sesión nuevamente.');
        setLoading(false);
        return false;
      }
      
      // Intentar decodificar el token para verificar su formato y fecha de expiración
      try {
        const tokenParts = token.split('.');
        const payload = JSON.parse(atob(tokenParts[1]));
        const expiration = payload.exp * 1000; // Convertir a milisegundos
        
        if (Date.now() >= expiration) {
          logger.warn('Token expirado', { exp: new Date(expiration).toISOString() });
          localStorage.removeItem('token');
          setError('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
          setLoading(false);
          return false;
        }
        
        logger.info('Token válido hasta', { exp: new Date(expiration).toISOString() });
        
        // Almacenar el ID del usuario extraído del token para uso en rutas alternativas
        const userId = payload.sub || payload.id;
        if (userId) {
          localStorage.setItem('userId', userId.toString());
        }
      } catch (tokenError) {
        logger.error('Error al decodificar token', { 
          error: tokenError instanceof Error ? tokenError.message : 'Error desconocido'
        });
        // Continuar de todos modos, el backend validará
      }
      
      try {
        logger.debug('Verificando autenticación con token existente');
        
        // Configurar un timeout para la verificación
        const verifyPromise = userService.getCurrentUser();
        const timeoutPromise = new Promise<AuthResponse>((_, reject) => {
          setTimeout(() => reject(new Error('Tiempo de espera agotado')), 8000); // Aumentado a 8 segundos
        });
        
        // Ejecutar verificación con timeout y manejar reintentos
        let retryCount = 0;
        const maxRetries = 2;
        let lastError: Error | null = null;
        
        while (retryCount <= maxRetries) {
          try {
            // Ejecutar verificación con timeout
            const response = await Promise.race([verifyPromise, timeoutPromise]);
            
            if (!response || !response.user) {
              throw new Error('Respuesta de verificación inválida');
            }
            
            // Almacenar el token actualizado si está presente
            if (response.token) {
              localStorage.setItem('token', response.token);
              logger.debug('Token actualizado en localStorage');
            }
            
            // Almacenar el rol del usuario para futuras referencias
            if (response.user?.role) {
              localStorage.setItem('userRole', response.user.role);
            }
            
            setUser(response.user);
            logger.info('Sesión restaurada exitosamente', { 
              userId: response.user._id,
              role: response.user.role 
            });
            
            setLoading(false);
            return true;
          } catch (error: any) {
            lastError = error;
            
            // Si es un error 404 específico en la ruta users/current, intentar ruta alternativa
            if (error.response?.status === 404 && error.config?.url?.includes('/users/current')) {
              logger.warn('Ruta /users/current no disponible, intentando ruta alternativa');
              
              try {
                // Intentar obtener usuario por ID directamente del token
                const userId = localStorage.getItem('userId');
                if (!userId) {
                  throw new Error('ID de usuario no disponible en localStorage');
                }
                
                const alternativeResponse = await userService.getUserById(userId);
                if (!alternativeResponse) {
                  throw new Error('No se encontró el usuario por ID');
                }
                
                // Crear un AuthResponse ficticio con el usuario obtenido
                const authResponse: AuthResponse = {
                  user: alternativeResponse,
                  token,
                  refreshToken: ''
                };
                
                setUser(alternativeResponse);
                logger.info('Sesión restaurada mediante ruta alternativa', { 
                  userId: alternativeResponse._id 
                });
                
                setLoading(false);
                return true;
              } catch (altError) {
                logger.error('Error en ruta alternativa', {
                  error: altError instanceof Error ? altError.message : 'Error desconocido'
                });
              }
            }
            
            // Para errores de red o timeout, intentar nuevamente
            if (retryCount < maxRetries && !error.response) {
              const delay = Math.min(1000 * 2 ** retryCount, 5000);
              logger.debug(`Reintentando checkAuth en ${delay}ms (intento ${retryCount + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              retryCount++;
            } else {
              break;
            }
          }
        }
        
        // Si llegamos aquí, todos los intentos fallaron
        if (lastError) {
          logger.error('Error al restaurar sesión después de reintentos', { 
            error: lastError instanceof Error ? lastError.message : 'Error desconocido',
            retries: retryCount
          });
        }
        
        setLoading(false);
        return false;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
        logger.error('Error en checkAuth', { error: errorMessage });
        setUser(null);
        setLoading(false);
        return false;
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
      logger.error('Error general en checkAuth', { error: errorMessage });
      setUser(null);
      setLoading(false);
      return false;
    }
  };

  useEffect(() => {
    // Al iniciar el componente, verificamos la autenticación
    checkAuth();
  }, []);

  const login = async (data: LoginData) => {
    try {
      setLoading(true);
      setError(null);
      
      // Limpiar el almacenamiento local, pero preservar la URL de redirección
      const redirectUrl = localStorage.getItem('redirectAfterLogin');
      localStorage.clear();
      if (redirectUrl) {
        localStorage.setItem('redirectAfterLogin', redirectUrl);
      }
      
      // Validar los datos de entrada
      if (!data.email || !data.password) {
        setError('Correo y contraseña son requeridos');
        setLoading(false); // Importante establecer loading a false antes de lanzar error
        throw new Error('Correo y contraseña son requeridos');
      }
      
      if (data.email.length > 50) {
        setError('El correo electrónico es demasiado largo (máx. 50 caracteres)');
        setLoading(false); // Importante establecer loading a false antes de lanzar error
        throw new Error('El correo electrónico es demasiado largo');
      }
      
      // Intentar la autenticación con manejo optimizado
      const response = await authService.login({
        email: data.email.trim().toLowerCase(),
        password: data.password
      });
      
      // Procesar la respuesta exitosa
      if (response && response.token && response.user) {
        localStorage.setItem('token', response.token);
        // Almacenar también información adicional del usuario para acceso rápido
        localStorage.setItem('userId', response.user._id);
        localStorage.setItem('userRole', response.user.role);
        
        setUser(response.user);
        logger.info('Login exitoso', { 
          userId: response.user._id,
          userRole: response.user.role,
          userName: response.user.name
        });
      } else {
        throw new Error('La respuesta del servidor es inválida');
      }
      
      return response; // Retornar la respuesta para poder usarla en componentes
    } catch (err: any) {
      // Manejar errores específicos
      if (err.response?.status === 401) {
        setError('Credenciales incorrectas');
      } else if (err.response?.status === 429) {
        setError('Demasiados intentos fallidos. Intente más tarde.');
      } else if (err.response?.status === 431) {
        setError('Error de comunicación con el servidor. Por favor use un correo más corto.');
      } else {
        const errorMessage = err.response?.data?.message || err.message || 'Error al iniciar sesión';
        setError(errorMessage);
      }
      
      logger.error('Error de autenticación:', err);
      throw err; // Re-lanzar el error para que pueda ser manejado por los componentes
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    try {
      setLoading(true);
      setError(null);
      
      // Limpiar el almacenamiento local
      localStorage.clear();
      
      // Validaciones básicas
      if (!data.email || !data.password || !data.name) {
        setError('Todos los campos obligatorios deben ser completados');
        setLoading(false); // Importante establecer loading a false antes de lanzar error
        throw new Error('Campos obligatorios incompletos');
      }
      
      // Validar longitud de email
      if (data.email.length > 50) {
        setError('El correo electrónico es demasiado largo (máx. 50 caracteres)');
        setLoading(false);
        throw new Error('El correo electrónico es demasiado largo');
      }
      
      // Normalizar datos
      const normalizedData = {
        ...data,
        email: data.email.trim().toLowerCase(),
        name: data.name.trim()
      };
      
      // Realizar registro
      const response = await authService.register(normalizedData);
      
      if (response && response.token && response.user) {
        localStorage.setItem('token', response.token);
        setUser(response.user);
        logger.info('Registro exitoso', { userId: response.user._id });
      } else {
        throw new Error('Respuesta de registro inválida');
      }
    } catch (err: any) {
      // Manejar errores específicos
      if (err.response?.status === 401) {
        setError('No autorizado para registrarse');
      } else if (err.response?.status === 409) {
        setError('El correo electrónico ya está registrado');
      } else if (err.response?.status === 431) {
        setError('Error de comunicación con el servidor. Por favor use un correo más corto.');
      } else {
        const errorMessage = err.response?.data?.message || err.message || 'Error al registrarse';
        setError(errorMessage);
      }
      
      logger.error('Error en registro', { error: err.message });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    logger.debug('Iniciando proceso de logout');
    localStorage.removeItem('token');
    setUser(null);
    setError(null);
    logger.info('Logout exitoso');
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        clearError,
        checkAuth, // Exportar la función checkAuth en el contexto
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};