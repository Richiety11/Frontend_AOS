import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthResponse, LoginData, RegisterData } from '../types';
import { authService, userService } from '../services/api';
import { logger } from '../services/logger';

interface AuthContextType {
  user: AuthResponse['user'] | null;
  loading: boolean;
  error: string | null;
  login: (data: LoginData) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthResponse['user'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Verificar si hay un token y si es válido
        const token = localStorage.getItem('token');
        
        // Si no hay token, simplemente terminamos
        if (!token) {
          logger.debug('No se encontró token en localStorage');
          setLoading(false);
          return;
        }
        
        // Si el token es excesivamente grande o mal formateado, podría ser corrupto
        if (token.length > 2000 || !token.includes('.')) {
          logger.warn('Token demasiado grande o mal formateado, posiblemente corrupto');
          localStorage.removeItem('token');
          setError('Sesión inválida. Por favor, inicie sesión nuevamente.');
          setLoading(false);
          return;
        }
        
        // Intentar decodificar el token para verificar si está expirado
        try {
          const tokenParts = token.split('.');
          const payload = JSON.parse(atob(tokenParts[1]));
          const expiration = payload.exp * 1000; // Convertir a milisegundos
          
          if (Date.now() >= expiration) {
            logger.warn('Token expirado', { exp: new Date(expiration).toISOString() });
            localStorage.removeItem('token');
            setError('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
            setLoading(false);
            return;
          }
          
          logger.info('Token válido hasta', { exp: new Date(expiration).toISOString() });
        } catch (tokenError) {
          logger.error('Error al decodificar token', { error: tokenError });
          // Continuar de todos modos, el backend validará
        }
        
        try {
          logger.debug('Verificando autenticación con token existente');
          
          // Configurar un timeout para la verificación
          const verifyPromise = userService.getCurrentUser();
          const timeoutPromise = new Promise<AuthResponse>((_, reject) => {
            setTimeout(() => reject(new Error('Tiempo de espera agotado')), 5000);
          });
          
          // Ejecutar verificación con timeout
          const response = await Promise.race([verifyPromise, timeoutPromise]);
          
          if (!response || !response.user) {
            throw new Error('Respuesta de verificación inválida');
          }
          
          setUser(response.user);
          logger.info('Sesión restaurada exitosamente', { userId: response.user._id });
        } catch (error) {
          logger.error('Error al restaurar sesión', { 
            error: error instanceof Error ? error.message : 'Error desconocido'
          });
          localStorage.removeItem('token');
          setError('La sesión ha expirado. Por favor, inicie sesión nuevamente.');
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
        logger.error('Error en checkAuth', { error: errorMessage });
        // En caso de error, limpiar todo para empezar de nuevo
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

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