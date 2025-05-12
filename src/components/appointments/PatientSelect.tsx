/**
 * @file PatientSelect.tsx
 * @description Componente de selección de pacientes para citas médicas.
 * Permite a los médicos elegir un paciente de una lista desplegable de usuarios registrados.
 * Utiliza react-query para gestionar la obtención y caché de datos.
 * @author Equipo de Desarrollo
 * @version 1.0.0
 */

import React, { useState } from 'react';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  FormHelperText,
  CircularProgress,
  Box
} from '@mui/material';
import { useQuery } from 'react-query';
import { userService } from '../../services/api';
import { User } from '../../types';

/**
 * @interface PatientSelectProps
 * @description Props para el componente de selección de pacientes
 * @property {string} value - ID del paciente seleccionado actualmente
 * @property {Function} onChange - Función callback que se ejecuta cuando se selecciona un paciente
 * @property {string} [error] - Mensaje de error opcional para mostrar debajo del selector
 */
interface PatientSelectProps {
  value: string;
  onChange: (patientId: string) => void;
  error?: string;
}

/**
 * @component PatientSelect
 * @description Componente que muestra un selector con la lista de pacientes disponibles
 * @param {PatientSelectProps} props - Props del componente
 * @returns {JSX.Element} Componente de selección de pacientes
 */
const PatientSelect: React.FC<PatientSelectProps> = ({ value, onChange, error }) => {
  /**
   * @query patients
   * @description Consulta para obtener la lista de pacientes registrados
   * Implementa estrategia de caché y reintento con backoff exponencial
   * @returns {User[]} Lista de usuarios con rol de paciente
   */
  const { data: patients, isLoading } = useQuery<User[]>(
    ['patients'],
    async () => {
      return userService.getUsers({ role: 'patient' });
    },
    {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000), // Backoff exponencial
      staleTime: 1000 * 60 * 10, // 10 minutos - tiempo que los datos se consideran frescos
      cacheTime: 1000 * 60 * 15, // 15 minutos - tiempo que los datos permanecen en caché
      onError: (err: any) => {
        console.error('Error al cargar pacientes:', err);
      }
    }
  );

  /**
   * @render loading
   * @description Muestra un indicador de carga mientras se obtienen los datos de pacientes
   * @returns {JSX.Element} Componente de carga
   */
  if (isLoading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" my={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  /**
   * @render main
   * @description Renderiza el componente de selección con la lista de pacientes
   * @returns {JSX.Element} Componente select de Material-UI con los pacientes
   */
  return (
    <FormControl fullWidth error={!!error}>
      <InputLabel id="patient-select-label">Paciente</InputLabel>
      <Select
        labelId="patient-select-label"
        id="patient-select"
        value={value}
        label="Paciente"
        onChange={(e: SelectChangeEvent) => onChange(e.target.value as string)}
        data-testid="patient-select"
      >
        <MenuItem value="" disabled>
          Seleccione un paciente
        </MenuItem>
        {patients?.map((patient) => (
          <MenuItem key={patient._id} value={patient._id}>
            {patient.name}
          </MenuItem>
        ))}
      </Select>
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
};

export default PatientSelect;