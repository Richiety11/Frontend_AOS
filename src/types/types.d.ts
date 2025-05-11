declare module '../../types' {
  export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  
  export interface Availability {
    day: DayOfWeek;
    startTime: string;
    endTime: string;
  }
  
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
}
