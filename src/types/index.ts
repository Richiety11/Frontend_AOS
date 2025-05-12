/**
 * Definiciones de tipos para el sistema de gestión de citas médicas
 * Centraliza todos los tipos utilizados en la aplicación frontend
 */

/**
 * Datos necesarios para iniciar sesión
 * @property email - Correo electrónico del usuario
 * @property password - Contraseña del usuario (no se almacena en frontend)
 */
export interface LoginData {
  email: string;
  password: string;
}

/**
 * Datos necesarios para registrar un nuevo usuario
 * @property email - Correo electrónico único del usuario
 * @property password - Contraseña para la cuenta
 * @property confirmPassword - Confirmación de contraseña (solo validación frontend)
 * @property name - Nombre completo del usuario
 * @property phoneNumber - Número telefónico de contacto
 * @property role - Rol del usuario (paciente o médico)
 * @property speciality - Especialidad médica (requerido solo para médicos)
 * @property licenseNumber - Número de licencia profesional (requerido solo para médicos)
 */
export interface RegisterData {
  email: string;
  password: string;
  confirmPassword?: string; // Opcional porque no se envía al backend
  name: string;
  phoneNumber: string;
  role: UserRole;
  speciality?: string; // Solo requerido para médicos
  licenseNumber?: string; // Solo requerido para médicos
}

/**
 * Roles disponibles en el sistema
 * Define los dos tipos de usuarios que pueden utilizar la plataforma
 */
export type UserRole = 'patient' | 'doctor';

/**
 * Estructura de datos de usuario
 * Contiene la información común para todos los usuarios, tanto pacientes como médicos
 * 
 * @property _id - Identificador único MongoDB
 * @property email - Correo electrónico único del usuario
 * @property name - Nombre completo del usuario
 * @property phoneNumber - Número de contacto
 * @property role - Rol del usuario (patient o doctor)
 * @property speciality - Especialidad médica (solo para médicos)
 * @property licenseNumber - Número de licencia (solo para médicos)
 * @property createdAt - Fecha de creación del usuario
 * @property updatedAt - Fecha de última actualización del usuario
 */
export interface User {
  _id: string;
  email: string;
  name: string;
  phoneNumber: string;
  role: UserRole;
  speciality?: string; // Solo para médicos
  licenseNumber?: string; // Solo para médicos
  createdAt: string;
  updatedAt: string;
}

/**
 * Respuesta de autenticación exitosa
 * Contiene todos los datos necesarios para mantener una sesión autenticada
 * 
 * @property user - Datos completos del usuario autenticado
 * @property token - Token JWT para autenticación de solicitudes
 * @property refreshToken - Token para renovar la sesión sin necesidad de credenciales
 * @property message - Mensaje descriptivo opcional del servidor
 */
export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  message?: string;
}

/**
 * Respuesta de renovación de token
 * Contiene los nuevos tokens generados al usar el refreshToken
 * 
 * @property token - Nuevo token JWT para autenticación
 * @property refreshToken - Nuevo token para futuras renovaciones
 */
export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

/**
 * Datos específicos de médicos
 * Extiende la interfaz User con campos adicionales específicos para médicos
 * 
 * @property speciality - Especialidad médica (requerida para médicos)
 * @property licenseNumber - Número de licencia profesional (requerida para médicos)
 * @property availability - Array con horarios disponibles por día de la semana
 * @property rating - Calificación promedio del médico (opcional)
 * @property reviews - Lista de evaluaciones de pacientes (opcional)
 */
export interface Doctor extends User {
  speciality: string; // Ahora es requerido (no opcional)
  licenseNumber: string; // Ahora es requerido (no opcional)
  availability: Availability[];
  rating?: number;
  reviews?: Review[];
}

/**
 * Estructura de disponibilidad horaria de un médico
 * Define los bloques de tiempo en que un médico atiende por día
 * 
 * @property day - Día de la semana
 * @property startTime - Hora de inicio de atención (formato HH:MM)
 * @property endTime - Hora de fin de atención (formato HH:MM)
 */
export interface Availability {
  day: DayOfWeek;
  startTime: string; // Formato HH:MM
  endTime: string; // Formato HH:MM
}

/**
 * Días de la semana disponibles para agendar citas
 * Usados para configurar la disponibilidad de los médicos
 */
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/**
 * Evaluación de un médico por parte de un paciente
 * 
 * @property _id - Identificador único de la evaluación
 * @property patient - Usuario que realizó la evaluación
 * @property rating - Calificación numérica (generalmente 1-5)
 * @property comment - Comentario textual sobre la atención
 * @property createdAt - Fecha de creación de la evaluación
 */
export interface Review {
  _id: string;
  patient: User;
  rating: number; // Generalmente en escala 1-5
  comment: string;
  createdAt: string;
}

/**
 * Estructura de datos para citas médicas
 * Elemento central del sistema que vincula médicos con pacientes
 * 
 * @property _id - Identificador único de la cita
 * @property doctor - Médico asignado (objeto completo o ID)
 * @property patient - Paciente asignado (objeto completo o ID)
 * @property date - Fecha de la cita (formato YYYY-MM-DD)
 * @property time - Hora de la cita (formato HH:MM)
 * @property reason - Motivo de la consulta
 * @property status - Estado actual de la cita
 * @property notes - Notas adicionales del médico (opcional)
 * @property isArchived - Indica si la cita está archivada
 * @property createdAt - Fecha de creación del registro
 * @property updatedAt - Fecha de última modificación del registro
 */
export interface Appointment {
  _id: string;
  doctor: Doctor | string; // Puede ser objeto completo o solo ID
  patient: User | string; // Puede ser objeto completo o solo ID
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  reason: string;
  status: AppointmentStatus;
  notes?: string; // Opcional, generalmente añadido por el médico
  isArchived: boolean; // Indica si la cita está en archivo histórico
  createdAt: string;
  updatedAt: string;
}

/**
 * Estados posibles de una cita médica
 * Define el ciclo de vida completo de una cita en el sistema
 * 
 * - pending: Cita solicitada pero pendiente de confirmación por el médico
 * - confirmed: Cita confirmada y programada
 * - cancelled: Cita cancelada por el médico o paciente
 * - completed: Cita que ya ocurrió y fue completada exitosamente
 * - archived: Cita histórica movida al archivo (deprecated, usar isArchived)
 * - no-show: Paciente no se presentó a la cita programada
 */
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'archived' | 'no-show';

/**
 * Estructura genérica para respuestas exitosas de la API
 * Proporciona un formato consistente para todas las respuestas exitosas
 * 
 * @template T - Tipo de datos devueltos en la respuesta
 * @property success - Indicador de éxito (true)
 * @property data - Datos solicitados, tipados según la operación
 * @property message - Mensaje descriptivo opcional
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Estructura para respuestas de error de la API
 * Proporciona información detallada sobre errores ocurridos
 * 
 * @property success - Indicador de éxito (false para errores)
 * @property message - Mensaje descriptivo del error
 * @property errors - Errores específicos por campo (validación)
 * @property lockUntil - Timestamp hasta cuando la cuenta está bloqueada
 */
export interface ApiError {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>; // Mapeo de campo a lista de errores
  lockUntil?: number; // Timestamp para bloqueo de cuenta por intentos fallidos
}