/**
 * Servicio de API para gestionar todas las peticiones HTTP al backend
 * Implementa patrones singleton, interceptores y manejo centralizado de errores
 */
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'; // Cliente HTTP
// Sistema de registro para monitoreo y depuración
import { logger } from './logger';
// Tipos de datos para comunicación con el backend
import { AuthResponse, Appointment, Doctor, Availability, User } from '../types';

/**
 * Extensión del módulo axios para añadir metadata personalizada a las solicitudes
 * Permite registrar tiempos de inicio para medir rendimiento
 */
declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    metadata?: {
      startTime: number; // Timestamp del inicio de la solicitud
    };
  }
}

/**
 * Servicio principal de API implementado como Singleton
 * Gestiona todas las comunicaciones HTTP con el backend de forma centralizada
 */
class ApiService {
  private static instance: ApiService; // Instancia única (patrón Singleton)
  private api: AxiosInstance; // Cliente HTTP configurado

  /**
   * Constructor privado para implementar el patrón Singleton
   * Configura la instancia de Axios con todas las opciones necesarias
   */
  private constructor() {
    // Obtener URL base desde variables de entorno o usar valor por defecto
    let apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
    
    // Normalizar formato de URL base para evitar problemas de doble barra
    if (!apiBaseUrl.endsWith('/')) {
      apiBaseUrl = `${apiBaseUrl}/`;
    }
    
    logger.info('Inicializando ApiService con baseURL', { baseURL: apiBaseUrl });
    
    /**
     * Configuración avanzada de la instancia de Axios
     * - Incluye opciones para mejorar rendimiento, seguridad y robustez
     * - Personaliza manejo de errores y timeouts
     */
    this.api = axios.create({
      // Configuración básica
      baseURL: apiBaseUrl, // URL base completa para evitar problemas con proxies
      timeout: 15000, // Tiempo de espera ampliado (15s) para redes lentas o operaciones complejas
      
      // Cabeceras predeterminadas para todas las solicitudes
      headers: {
        'Content-Type': 'application/json', // Formato de envío de datos
        'Accept': 'application/json' // Formato esperado de respuesta
      },
      
      // Configuraciones de seguridad y rendimiento
      withCredentials: false, // No enviar cookies entre dominios (evita problemas CORS)
      maxContentLength: 5000000, // Límite de tamaño de respuesta (5MB)
      maxBodyLength: 5000000, // Límite de tamaño de envío (5MB)
      
      // Control personalizado de manejo de errores
      validateStatus: status => status < 500, // Tratar solo errores 500+ como errores de red
      
      // Transformadores personalizados para peticiones
      transformRequest: [
        (data, headers) => {
          // Eliminar cabeceras problemáticas que causan errores CORS
          if (headers) {
            // Accept-Encoding debe ser manejado por el navegador, no manualmente
            delete headers['Accept-Encoding'];
          }
          return data; // Devolver datos sin modificar
        }, 
        // Mantener los transformadores predeterminados de Axios
        ...axios.defaults.transformRequest as any
      ]
    });

    this.setupInterceptors();
  }

  /**
   * Método estático para acceder a la instancia única de ApiService (patrón Singleton)
   * Crea la instancia si no existe, o devuelve la existente
   * @returns La instancia única de ApiService
   */
  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  /**
   * Configura interceptores para peticiones y respuestas HTTP
   * - Gestiona autenticación automática
   * - Registra tiempos de peticiones
   * - Maneja errores comunes de forma centralizada
   */
  private setupInterceptors(): void {
    // Interceptor para todas las peticiones salientes
    this.api.interceptors.request.use(
      (config) => {
        // Determinar si es una ruta de autenticación que no requiere token
        const isLoginRoute = config.url?.includes('/login');
        const isRegisterRoute = config.url?.includes('/register');
        const isAuthRoute = isLoginRoute || isRegisterRoute;
        
        // Obtener token de autenticación almacenado
        const token = localStorage.getItem('token');
        
        // Registrar estado de autenticación para debugging
        logger.info('Estado de autenticación', {
          tokenExists: !!token,
          url: config.url
        });
        
        // Garantizar que el objeto headers existe
        config.headers = config.headers || {};
        
        // Eliminar cabeceras que causan problemas CORS
        delete config.headers['Accept-Encoding']; // Manejado por el navegador
        delete config.headers['X-XSRF-TOKEN']; // No utilizado en este backend
        
        // Gestión de token de autorización
        if (token && !isAuthRoute) {
          // Añadir token Bearer para rutas protegidas
          config.headers.Authorization = `Bearer ${token}`;
          
          // Validación básica de formato de token JWT (debe tener al menos 2 puntos)
          if (!token.includes('.')) {
            logger.warn('Formato de token inválido');
          }
        } else if (!isAuthRoute) {
          // Advertir si se intenta acceder a ruta protegida sin token
          logger.warn('No se encontró token para la solicitud', { 
            url: config.url 
          });
        }

        // Reducir el tamaño del log para evitar problemas
        logger.debug('Solicitud API saliente', {
          method: config.method?.toUpperCase(),
          url: config.url,
          hasAuth: config.headers?.Authorization ? 'Sí' : 'No'
        });

        const startTime = Date.now();
        config.metadata = { startTime };
        
        return config;
      },
      (error: AxiosError) => {
        logger.error('Error en la solicitud API', {
          error: error.message,
          config: error.config
        });
        return Promise.reject(error);
      }
    );

    // Interceptor de respuesta
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        const duration = Date.now() - (response.config.metadata?.startTime || 0);
        
        logger.debug('Respuesta API recibida', {
          status: response.status,
          url: response.config.url,
          duration: `${duration}ms`,
          data: response.data
        });

        return response;
      },
      (error: AxiosError) => {
        const duration = Date.now() - (error.config?.metadata?.startTime || 0);
        const baseURL = error.config?.baseURL || '';
        const url = error.config?.url || '';
        const fullUrl = url.startsWith('http') ? url : `${baseURL}${url}`;

        logger.error('Error en la respuesta API', {
          status: error.response?.status,
          url: fullUrl, // Registrar la URL completa para depuración
          method: error.config?.method?.toUpperCase(),
          duration: `${duration}ms`,
          error: error.message,
          response: error.response?.data
        });

        // Manejar errores específicos
        if (error.response?.status === 401) {
          // No redirigir automáticamente, simplemente limpiar el token
          // y dejar que los componentes manejen la redirección según el contexto
          logger.warn('Token expirado o no válido, limpiando almacenamiento local');
          localStorage.removeItem('token');
          
          // Agregar información sobre el error de autenticación al objeto de error
          const enhancedError: any = error;
          enhancedError.authError = true;
        }
        
        // Manejar el caso específico de error 404 en /users/current
        if (error.response?.status === 404 && error.config?.url?.includes('/users/current')) {
          logger.error(`Error 404: Ruta ${fullUrl} no encontrada`);
          
          // Registrar más detalles para la depuración
          logger.debug('Detalles de la configuración de la solicitud fallida', {
            headers: error.config?.headers,
            baseURL: error.config?.baseURL,
            fullPath: fullUrl
          });
          
          // Si estamos en desarrollo, ofrecer sugerencia específica para este problema
          if (process.env.NODE_ENV === 'development') {
            const enhancedError: any = error;
            enhancedError.message = 'Error en la configuración del servidor: Ruta de usuario actual no encontrada';
            enhancedError.suggestion = 'Verifica que la ruta /users/current esté definida antes de /users/:id en el archivo user.routes.js';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.api.get<T>(url, config);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
      throw error;
    }
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.api.post<T>(url, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
      throw error;
    }
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.api.put<T>(url, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
      throw error;
    }
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.api.delete<T>(url, config);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
      throw error;
    }
  }

  private handleError(error: AxiosError): void {
    const errorResponse = {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      }
    };

    logger.error('Error en la operación API', errorResponse);

    // Aquí podrías implementar lógica adicional de manejo de errores
    // como mostrar notificaciones, redirigir a páginas de error, etc.
  }
}

export const apiService = ApiService.getInstance();

// Interfaces
interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: 'patient' | 'doctor';
  speciality?: string;
  licenseNumber?: string;
}

// Auth Service - Implementación optimizada unificada
export const authService = {
  // Instancia optimizada de axios para autenticación
  _getAuthAxios() {
    // Usar la URL de la API configurada en variables de entorno o usar fallback seguro
    const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
    
    return axios.create({
      baseURL: apiBaseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
        // No incluir cabeceras restringidas como Accept-Encoding
      },
      // Configuraciones para evitar errores 431
      maxContentLength: 5000, 
      maxBodyLength: 5000,
      decompress: true // Habilitar descompresión para reducir tamaño de respuesta
    });
  },

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Limpiar almacenamiento local
      localStorage.clear();
      
      // Normalizar y limitar datos
      const simplifiedCredentials = {
        email: credentials.email.trim().toLowerCase().substring(0, 50),
        password: credentials.password
      };
      
      // Usar endpoint único de autenticación optimizado
      const resp = await this._getAuthAxios().post('/login', simplifiedCredentials);
      const response = resp.data as AuthResponse;
      
      // Verificar respuesta
      if (!response || !response.token || !response.user) {
        throw new Error('Respuesta de autenticación inválida');
      }
      
      // Almacenar token (manejo centralizado en AuthContext)
      logger.info('Login exitoso', { userId: response.user._id });
      
      return response;
    } catch (error: any) {
      // Log detallado pero seguro del error
      logger.error('Error de autenticación', { 
        status: error.response?.status,
        message: error.message
      });
      throw error;
    }
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      // Limpiar cualquier dato de sesión anterior
      localStorage.clear();
      
      // Asegurarse de que el correo está normalizado y limitado
      const optimizedData = {
        ...data,
        email: data.email.trim().toLowerCase().substring(0, 50),
        name: data.name.trim().substring(0, 100) // Limitar nombre también
      };
      
      // Usar endpoint optimizado para registro
      const resp = await this._getAuthAxios().post('/register', optimizedData);
      const response = resp.data as AuthResponse;
      
      if (!response || !response.token || !response.user) {
        throw new Error('Respuesta de registro inválida');
      }
      
      // No almacenar token aquí, lo manejará el AuthContext
      logger.info('Registro procesado exitosamente', { userId: response.user._id });
      
      return response;
    } catch (error: any) {
      logger.error('Error de registro:', { 
        status: error.response?.status,
        message: error.message
      });
      throw error;
    }
  },

  logout() {
    localStorage.removeItem('token');
    logger.info('User logged out');
  }
};

// User Service
export const userService = {
  async getUsers(params?: any) {
    try {
      const response = await apiService.get<User[]>('/users', { params });
      return response;
    } catch (error) {
      logger.error('Error al obtener usuarios:', error);
      throw error;
    }
  },

  async getUserById(id: string) {
    try {
      const response = await apiService.get<User>(`/users/${id}`);
      return response;
    } catch (error) {
      logger.error('Error al obtener usuario por ID:', error);
      throw error;
    }
  },

  async getCurrentUser() {
    try {
      // Verificamos si existe un token antes de hacer la solicitud
      const token = localStorage.getItem('token');
      if (!token) {
        logger.warn('Intentando obtener usuario actual sin token');
        throw new Error('No hay token de autenticación');
      }

      // Añadimos un registro adicional para depuración
      logger.info('Solicitando usuario actual', {
        tokenExists: true,
        tokenLength: token.length
      });
      
      // Usar la ruta exacta sin parámetros adicionales que podrían causar problemas
      const response = await apiService.get<AuthResponse>('/users/current');
      
      // Verificar que la respuesta sea válida
      if (!response || !response.user) {
        logger.error('Respuesta inválida al obtener usuario actual', { response });
        throw new Error('Respuesta inválida al obtener usuario actual');
      }
      
      return response;
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.error('Error 404: Ruta /users/current no encontrada');
        
        // Intentar una ruta alternativa como fallback
        try {
          const token = localStorage.getItem('token');
          if (!token) throw new Error('Token no disponible para ruta alternativa');
          
          logger.info('Intentando ruta alternativa para obtener usuario');
          
          // Extraer el ID de usuario del token para crear una URL alternativa
          const tokenParts = token.split('.');
          const payload = JSON.parse(atob(tokenParts[1]));
          const userId = payload.sub || payload.id;
          
          if (!userId) {
            throw new Error('No se pudo extraer ID del usuario del token');
          }
          
          // Intentar obtener el usuario por ID directamente
          const fallbackResponse = await apiService.get<User>(`/users/${userId}`);
          
          if (!fallbackResponse) {
            throw new Error('No se pudo obtener el usuario mediante ID');
          }
          
          // Crear un objeto de respuesta compatible con AuthResponse
          const authResponse: AuthResponse = {
            user: fallbackResponse,
            token,
            refreshToken: ''
          };
          
          logger.info('Usuario recuperado mediante ruta alternativa', { userId });
          return authResponse;
        } catch (fallbackError) {
          logger.error('Falló también la ruta alternativa', { 
            error: fallbackError instanceof Error ? fallbackError.message : 'Error desconocido' 
          });
          throw new Error('Error en la configuración del servidor: No se pudo acceder al usuario actual');
        }
      } else {
        logger.error('Error al obtener usuario actual:', error);
        throw error;
      }
    }
  }
};

// Doctor Service
export const doctorService = {
  async getDoctor(id: string) {
    try {
      logger.debug('Obteniendo información del doctor', { doctorId: id });
      const response = await apiService.get<Doctor>(`/doctors/${id}`);
      return response;
    } catch (error) {
      logger.error('Get doctor error:', error);
      throw error;
    }
  },

  async getDoctors(filters?: any) {
    try {
      const response = await apiService.get<Doctor[]>('/doctors', { params: filters });
      return response;
    } catch (error) {
      logger.error('Get doctors error:', error);
      throw error;
    }
  },

  async updateAvailability(doctorId: string, availability: Availability[]) {
    try {
      logger.debug('Actualizando disponibilidad del doctor', { doctorId, availability });
      const response = await apiService.put<Doctor>(`/doctors/${doctorId}/availability`, { availability });
      logger.info('Disponibilidad actualizada exitosamente', { doctorId });
      return response;
    } catch (error: any) {
      // Mejorar el manejo de errores para mostrar mensajes más específicos
      const errorMessage = error.response?.data?.message || error.message;
      logger.error('Error al actualizar disponibilidad', { error: errorMessage, doctorId });
      throw new Error(errorMessage);
    }
  },

  async getDoctorAvailability(doctorId: string) {
    try {
      logger.debug('Obteniendo disponibilidad del doctor', { doctorId });
      const response = await apiService.get<Doctor>(`/doctors/${doctorId}`);
      return response.availability || [];
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      logger.error('Error al obtener disponibilidad', { error: errorMessage, doctorId });
      throw new Error(errorMessage);
    }
  }
};

// Appointment Service
export const appointmentService = {
  async createAppointment(data: any) {
    try {
      const response = await apiService.post<Appointment>('/appointments', data);
      return response;
    } catch (error) {
      logger.error('Create appointment error:', error);
      throw error;
    }
  },

  async getAppointments(params?: any) {
    try {
      // Agregar log para verificar que el token está presente
      const token = localStorage.getItem('token');
      const userRole = localStorage.getItem('userRole');
      const userId = localStorage.getItem('userId');
      
      // Verificar si hay token antes de hacer la petición
      if (!token) {
        logger.warn('Intentando obtener citas sin token de autenticación');
        throw new Error('No hay token de autenticación. Por favor inicie sesión nuevamente.');
      }
      
      logger.info('Obteniendo citas con filtros', { 
        userRole, 
        hasToken: true,
        tokenLength: token.length,
        userId,
        params 
      });
      
      const response = await apiService.get<Appointment[]>('/appointments', { params });
      
      // Verificar que la respuesta es un array válido
      if (!Array.isArray(response)) {
        logger.warn('Respuesta de citas no es un array', { response });
        return [];
      }
      
      logger.info('Citas obtenidas correctamente', { 
        count: response.length,
        userRole
      });
      
      return response;
    } catch (error) {
      logger.error('Get appointments error:', error);
      // Retornar un array vacío para evitar errores en el componente
      return [];
    }
  },

  async getAppointment(id: string) {
    try {
      const response = await apiService.get<Appointment>(`/appointments/${id}`);
      return response;
    } catch (error) {
      logger.error('Get appointment error:', error);
      throw error;
    }
  },

  async updateAppointment(id: string, data: any) {
    try {
      const response = await apiService.put<Appointment>(`/appointments/${id}`, data);
      return response;
    } catch (error) {
      logger.error('Update appointment error:', error);
      throw error;
    }
  },

  async cancelAppointment(id: string) {
    try {
      const response = await apiService.put<Appointment>(`/appointments/${id}/cancel`);
      return response;
    } catch (error) {
      logger.error('Cancel appointment error:', error);
      throw error;
    }
  },

  async getArchivedAppointments(params?: any) {
    try {
      // Verificar que haya un token válido antes de intentar la petición
      const token = localStorage.getItem('token');
      if (!token) {
        logger.warn('Intentando obtener citas archivadas sin token');
        throw new Error('Sesión no válida. Por favor inicie sesión nuevamente.');
      }
      
      logger.info('Obteniendo citas archivadas con filtros', { params });
      
      const response = await apiService.get<Appointment[]>('/appointments/archived', { 
        params,
        timeout: 10000, // Aumentar timeout para esta solicitud específica
        headers: {
          'Cache-Control': 'no-cache' // Evitar problemas de caché
        }
      });
      
      // Verificar que la respuesta sea un array
      if (!Array.isArray(response)) {
        logger.warn('Respuesta de citas archivadas no es un array', { 
          responseType: typeof response,
          response 
        });
        return [];
      }
      
      // Verificar y normalizar cada cita para prevenir errores
      const normalizedAppointments = response.map(appointment => {
        try {
          // Asegurar que cada cita tenga una estructura básica
          return {
            ...appointment,
            _id: appointment._id || 'unknown',
            date: appointment.date || new Date().toISOString(),
            time: appointment.time || '00:00',
            reason: appointment.reason || 'Sin motivo',
            status: appointment.status || 'archived',
            // Normalizar los objetos doctor y patient
            doctor: typeof appointment.doctor === 'object' && appointment.doctor 
              ? appointment.doctor 
              : { _id: String(appointment.doctor || 'unknown'), name: 'Doctor' },
            patient: typeof appointment.patient === 'object' && appointment.patient 
              ? appointment.patient 
              : { _id: String(appointment.patient || 'unknown'), name: 'Paciente' }
          };
        } catch (e) {
          logger.error('Error al normalizar cita', { appointmentId: appointment?._id, error: e });
          // Devolver un objeto seguro con valores por defecto
          return {
            _id: 'error',
            date: new Date().toISOString(),
            time: '00:00',
            reason: 'Error al cargar datos',
            status: 'archived',
            doctor: { _id: 'unknown', name: 'Doctor' },
            patient: { _id: 'unknown', name: 'Paciente' },
            isArchived: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as Appointment;
        }
      });
      
      logger.info('Citas archivadas obtenidas y normalizadas correctamente', { 
        count: normalizedAppointments.length 
      });
      
      return normalizedAppointments;
    } catch (error: any) {
      // Mejorar el manejo del error
      if (error?.response?.status === 401) {
        logger.error('Error de autenticación al obtener citas archivadas', { 
          status: error.response?.status 
        });
        // Devolver un array vacío pero no lanzar error para permitir que la UI maneje esto
        return [];
      }
      
      logger.error('Error al obtener citas archivadas:', { 
        status: error?.response?.status,
        message: error?.message || 'Error desconocido',
        stack: error?.stack
      });
      
      // Por defecto, devolvemos un array vacío para evitar errores en la UI
      return [];
    }
  },

  async archiveAppointment(id: string) {
    try {
      const response = await apiService.put<Appointment>(`/appointments/${id}/archive`, {});
      logger.info('Cita archivada exitosamente', { id });
      return response;
    } catch (error: any) {
      logger.error('Error al archivar cita:', { 
        message: error?.message || 'Error desconocido',
        status: error?.response?.status
      });
      throw error;
    }
  },
};

export default apiService;
