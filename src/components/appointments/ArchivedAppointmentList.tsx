import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Box,
  CircularProgress,
  Chip,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Divider,
  Button,
  Alert
} from '@mui/material';
import { useQuery, useQueryClient } from 'react-query';
import dayjs from 'dayjs';
import { appointmentService, userService } from '../../services/api';
import { logger } from '../../services/logger';
import { useAuth } from '../../contexts/AuthContext';
import { Appointment, User, Doctor } from '../../types';
import CustomAlert from '../common/CustomAlert';

const statusColors = {
  completed: 'success',
  cancelled: 'error',
  'no-show': 'error'
};

const statusLabels = {
  completed: 'Completada',
  cancelled: 'Cancelada',
  'no-show': 'No Tomada'
};

export const ArchivedAppointmentList: React.FC = () => {
  const { user, checkAuth } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const isDoctor = user?.role === 'doctor';
  
  // Función para verificar la autenticación e intentar reconectar
  const retryConnection = async () => {
    setIsRetrying(true);
    setError(null);
    try {
      // Verificar la autenticación y capturar el resultado
      const success = await checkAuth();
      
      if (success) {
        logger.info('Reconexión exitosa, recargando datos');
        // Invalidar consultas para forzar una recarga
        queryClient.invalidateQueries('archivedAppointments');
        queryClient.invalidateQueries('patients');
        
        // Recargar datos explícitamente
        setTimeout(() => {
          refetch();
        }, 1000);
      } else {
        setError('No se pudo verificar su identidad. Por favor, refresque la página o inicie sesión nuevamente.');
        logger.error('checkAuth retornó false durante la reconexión');
      }
    } catch (err) {
      setError('No se pudo restaurar la conexión. Por favor, inicie sesión nuevamente.');
      logger.error('Error al intentar reconectar:', err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsRetrying(false);
    }
  };

  // Verificar que el usuario esté cargado correctamente antes de intentar cargar citas
  useEffect(() => {
    let isMounted = true;
    if (!user && !loadingUser) {
      setLoadingUser(true);
      checkAuth().then(() => {
        if (isMounted) {
          setLoadingUser(false);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [user, loadingUser, checkAuth]);

  // Obtener citas archivadas
  const { data: archivedAppointments, isLoading: loadingAppointments, refetch } = useQuery<Appointment[]>(
    ['archivedAppointments', selectedPatient],
    async () => {
      try {
        const params: any = {};
        if (selectedPatient && isDoctor) {
          params.patientId = selectedPatient;
        }
        const results = await appointmentService.getArchivedAppointments(params);
        
        // Validar que los resultados sean un array para evitar errores
        if (!Array.isArray(results)) {
          logger.warn('La respuesta de citas archivadas no es un array', { results });
          return [] as Appointment[];
        }
        
        // Crear citas correctamente tipadas
        const typedAppointments: Appointment[] = results.map(appointment => {
          // Extraer las propiedades existentes primero
          const { patient, doctor, ...rest } = appointment;
          
          // Determinar el tipo adecuado para el paciente
          let patientValue: User | string;
          if (typeof patient === 'object' && patient) {
            patientValue = patient as User;
          } else {
            // Si no es un objeto, mantenerlo como string (id)
            patientValue = String(patient || 'unknown');
          }
          
          // Determinar el tipo adecuado para el doctor
          let doctorValue: Doctor | string;
          if (typeof doctor === 'object' && doctor) {
            doctorValue = doctor as Doctor;
          } else {
            // Si no es un objeto, mantenerlo como string (id)
            doctorValue = String(doctor || 'unknown');
          }
          
          // Crear y devolver una cita correctamente tipada
          return {
            ...rest,
            patient: patientValue,
            doctor: doctorValue
          } as Appointment;
        });
        
        return typedAppointments;
      } catch (err) {
        logger.error('Error en la función de consulta:', err);
        return [];
      }
    },
    {
      enabled: Boolean(user?._id) && !loadingUser,
      retry: 2, // Aumentar a 2 reintentos en caso de error temporal
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Backoff exponencial
      onSettled: (data, error: any) => {
        // Si hay datos pero también hubo un error, loggear esta situación inusual
        if (data && error) {
          logger.warn('Situación inusual: datos recibidos a pesar del error', {
            dataLength: Array.isArray(data) ? data.length : 0,
            error: error?.message || 'Error desconocido'
          });
        }
      },
      onError: (err: any) => {
        console.error('Error al cargar citas archivadas:', err);
        
        // Mensajes más descriptivos según el tipo de error
        if (err.response?.status === 404) {
          // Discriminar entre errores 404 específicos
          const isUserCurrentError = err.config?.url?.includes('/users/current');
          if (isUserCurrentError) {
            setError('Error de autenticación: Verificando credenciales...');
            
            // Usar una función auxiliar segura para intentar reconectar
            setTimeout(() => {
              retryConnection();
            }, 1000);
          } else {
            setError('No se pudo cargar las citas archivadas. La función puede estar temporalmente no disponible.');
          }
        } else if (err.response?.status === 401) {
          setError('Su sesión necesita revalidación. Intentando reconectar automáticamente...');
          
          // Utilizar nuestra función auxiliar segura para manejar la reconexión
          setTimeout(() => {
            retryConnection();
            
            // Almacenar la ubicación actual para redirigir de vuelta después del login
            localStorage.setItem('redirectAfterLogin', window.location.pathname);
            
            // Si el error persiste después de algunos segundos, redirigir al login
            const errorCheckTimer = setTimeout(() => {
              // Comprobar si todavía hay un error en el estado
              if (document.querySelector('.error-boundary-container')) {
                window.location.href = '/login';
              }
            }, 3000);
            
            // Limpiar el timer si el componente se desmonta
            return () => clearTimeout(errorCheckTimer);
          }, 1000);
        } else if (err.message === 'Network Error') {
          setError('Error de conexión. Verifique su conexión a Internet e intente nuevamente.');
        } else {
          setError(err.message || 'Error al cargar las citas archivadas');
        }
      }
    }
  );

  // Obtener lista de pacientes (solo para doctores)
  const { data: patients, isLoading: loadingPatients } = useQuery<User[]>(
    ['patients'],
    async () => {
      return userService.getUsers({ role: 'patient' });
    },
    {
      enabled: Boolean(user?.role === 'doctor'),
      onError: (err: any) => {
        setError(err.message || 'Error al cargar la lista de pacientes');
      }
    }
  );

  // Filtrar citas por término de búsqueda
  const filteredAppointments = React.useMemo(() => {
    if (!archivedAppointments) return [];
    
    // Verificar que archivedAppointments sea un array
    if (!Array.isArray(archivedAppointments)) {
      logger.warn('archivedAppointments no es un array en la función de filtrado', { 
        archivedAppointmentsType: typeof archivedAppointments
      });
      return [];
    }
    
    // Filtrar con manejo de errores
    try {
      return archivedAppointments.filter(appointment => {
        if (!appointment) return false;
        
        // Protección adicional para acceder a propiedades de objetos potencialmente nulos o sin poblar
        let patientName = '';
        try {
          patientName = (
            typeof appointment.patient === 'object' && 
            appointment.patient !== null && 
            'name' in appointment.patient
          ) ? String(appointment.patient.name) : '';
        } catch (e) {
          logger.warn('Error al acceder a patient.name', { error: e });
          patientName = '';
        }
        
        let doctorName = '';
        try {
          doctorName = (
            typeof appointment.doctor === 'object' && 
            appointment.doctor !== null && 
            'name' in appointment.doctor
          ) ? String(appointment.doctor.name) : '';
        } catch (e) {
          logger.warn('Error al acceder a doctor.name', { error: e });
          doctorName = '';
        }
        
        const reason = appointment.reason || '';
        const notes = appointment.notes || '';
        
        // Convertir searchTerm a minúsculas para comparación insensible a mayúsculas/minúsculas
        // Protección adicional: asegurar que searchTerm es un string
        const searchTermLower = String(searchTerm || '').toLowerCase();
        
        return (
          patientName.toLowerCase().includes(searchTermLower) ||
          doctorName.toLowerCase().includes(searchTermLower) ||
          reason.toLowerCase().includes(searchTermLower) ||
          notes.toLowerCase().includes(searchTermLower)
        );
      });
    } catch (error) {
      logger.error('Error durante el filtrado de citas', { error });
      return [];
    }
  }, [archivedAppointments, searchTerm]);

  const handleChangePatient = (event: SelectChangeEvent<string>) => {
    setSelectedPatient(event.target.value);
  };

  return (
    <Container maxWidth="lg">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Grid container justifyContent="space-between" alignItems="center">
          <Grid item>
            <Typography variant="h5" component="h2" gutterBottom>
              Citas Archivadas
            </Typography>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              onClick={() => window.location.href = '/appointments'}
            >
              Volver a Citas Activas
            </Button>
          </Grid>
        </Grid>
        <Divider sx={{ my: 2 }} />

        {error && (
          <Box sx={{ mb: 3 }}>
            <Alert 
              severity="error"
              onClose={() => setError(null)}
              action={
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={retryConnection}
                  disabled={isRetrying}
                >
                  {isRetrying ? 'Reconectando...' : 'Reintentar'}
                </Button>
              }
            >
              {error}
            </Alert>
            {error.includes('sesión') && (
              <Box display="flex" justifyContent="center" mt={2}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => window.location.href = '/login'}
                >
                  Ir a Iniciar Sesión
                </Button>
              </Box>
            )}
          </Box>
        )}

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={isDoctor ? 6 : 12}>
            <TextField
              label="Buscar"
              variant="outlined"
              fullWidth
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, razón, etc..."
            />
          </Grid>
          
          {isDoctor && (
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="patient-select-label">Filtrar por Paciente</InputLabel>
                <Select
                  labelId="patient-select-label"
                  value={selectedPatient}
                  label="Filtrar por Paciente"
                  onChange={handleChangePatient}
                >
                  <MenuItem value="">Todos los pacientes</MenuItem>
                  {patients?.map((patient) => (
                    <MenuItem key={patient._id} value={patient._id}>
                      {patient.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>

        {loadingAppointments ? (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        ) : filteredAppointments && filteredAppointments.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Hora</TableCell>
                  {isDoctor && <TableCell>Paciente</TableCell>}
                  {!isDoctor && <TableCell>Doctor</TableCell>}
                  <TableCell>Motivo</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Notas</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAppointments.map((appointment) => (
                  <TableRow key={appointment._id}>
                    <TableCell>
                      {dayjs(appointment.date).format('DD/MM/YYYY')}
                    </TableCell>
                    <TableCell>{appointment.time}</TableCell>
                    {isDoctor && (
                      <TableCell>
                        {(() => {
                          try {
                            if (typeof appointment.patient === 'object' && appointment.patient) {
                              return (appointment.patient as User).name || 'Paciente';
                            }
                            return 'Paciente';
                          } catch (e) {
                            return 'Paciente';
                          }
                        })()}
                      </TableCell>
                    )}
                    {!isDoctor && (
                      <TableCell>
                        {(() => {
                          try {
                            if (typeof appointment.doctor === 'object' && appointment.doctor) {
                              return (appointment.doctor as Doctor).name || 'Doctor';
                            }
                            return 'Doctor';
                          } catch (e) {
                            return 'Doctor';
                          }
                        })()}
                      </TableCell>
                    )}
                    <TableCell>{appointment.reason}</TableCell>
                    <TableCell>
                      <Chip
                        label={
                          statusLabels[
                            appointment.status as keyof typeof statusLabels
                          ] || appointment.status
                        }
                        color={
                          statusColors[
                            appointment.status as keyof typeof statusColors
                          ] as any
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {appointment.notes || 'Sin notas'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="subtitle1" align="center" sx={{ my: 4 }}>
            No hay citas archivadas {selectedPatient && 'para este paciente'}
          </Typography>
        )}
      </Paper>
    </Container>
  );
};

export default ArchivedAppointmentList;
