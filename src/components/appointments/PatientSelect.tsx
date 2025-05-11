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

interface PatientSelectProps {
  value: string;
  onChange: (patientId: string) => void;
  error?: string;
}

const PatientSelect: React.FC<PatientSelectProps> = ({ value, onChange, error }) => {
  const { data: patients, isLoading } = useQuery<User[]>(
    ['patients'],
    async () => {
      return userService.getUsers({ role: 'patient' });
    },
    {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000), // Backoff exponencial
      staleTime: 1000 * 60 * 10, // 10 minutos
      cacheTime: 1000 * 60 * 15, // 15 minutos
      onError: (err: any) => {
        console.error('Error al cargar pacientes:', err);
      }
    }
  );

  if (isLoading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" my={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <FormControl fullWidth error={!!error}>
      <InputLabel id="patient-select-label">Paciente</InputLabel>
      <Select
        labelId="patient-select-label"
        id="patient-select"
        value={value}
        label="Paciente"
        onChange={(e: SelectChangeEvent) => onChange(e.target.value as string)}
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