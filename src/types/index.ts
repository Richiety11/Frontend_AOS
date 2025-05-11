// Tipos de autenticación
export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword?: string; // Opcional porque no se envía al backend
  name: string;
  phoneNumber: string;
  role: UserRole;
  speciality?: string;
  licenseNumber?: string;
}

// Tipos de usuario
export type UserRole = 'patient' | 'doctor';

export interface User {
  _id: string;
  email: string;
  name: string;
  phoneNumber: string;
  role: UserRole;
  speciality?: string;
  licenseNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  message?: string;
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

// Tipos de doctor
export interface Doctor extends User {
  speciality: string;
  licenseNumber: string;
  availability: Availability[];
  rating?: number;
  reviews?: Review[];
}

export interface Availability {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface Review {
  _id: string;
  patient: User;
  rating: number;
  comment: string;
  createdAt: string;
}

// Tipos de cita
export interface Appointment {
  _id: string;
  doctor: Doctor | string;
  patient: User | string;
  date: string;
  time: string;
  reason: string;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

// Tipos de respuesta de API
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  lockUntil?: number; // Para bloqueo de cuenta por intentos fallidos
}