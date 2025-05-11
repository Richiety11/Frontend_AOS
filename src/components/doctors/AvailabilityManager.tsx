import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
  FormHelperText,
  CircularProgress,
  SelectChangeEvent,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { doctorService, userService } from '../../services/api';
import { logger } from '../../services/logger';
import { useAuth } from '../../contexts/AuthContext';
import dayjs, { Dayjs } from 'dayjs';
import ContinueDialog from '../common/ContinueDialog';
import CustomAlert from '../common/CustomAlert';
import { useNavigate, useLocation } from 'react-router-dom';

// Define tipos y interfaces
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday'
];

const DAYS_SPANISH: Record<DayOfWeek, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo'
};

interface FieldErrors {
  day?: string;
  startTime?: string;
  endTime?: string;
}

interface AvailabilitySlot {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

export const AvailabilityManager: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('monday');
  const [startTime, setStartTime] = useState<Dayjs | null>(dayjs().hour(8).minute(0));
  const [endTime, setEndTime] = useState<Dayjs | null>(dayjs().hour(17).minute(0));
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const verifyUserAndLoadData = async () => {
      setInitialLoading(true);
      let currentUser = user;
      let doctorId: string | undefined;
      
      try {
        // Verificar token primero
        const token = localStorage.getItem('token');
        if (!token) {
          logger.error('No se encontró token de autenticación');
          setError('Su sesión ha expirado o no hay token disponible');
          // Guardar la ubicación actual antes de redireccionar
          localStorage.setItem('redirectAfterLogin', location.pathname);
          navigate('/login', { 
            state: { 
              from: location.pathname,
              message: 'Debe iniciar sesión para acceder a esta página'
            } 
          });
          return;
        }
        
        // Verificar si el token está expirado
        try {
          const tokenParts = token.split('.');
          const payload = JSON.parse(atob(tokenParts[1]));
          const expiration = payload.exp * 1000; // Convertir a milisegundos
          
          if (Date.now() >= expiration) {
            logger.warn('Token expirado', { exp: new Date(expiration).toISOString() });
            localStorage.removeItem('token');
            localStorage.setItem('redirectAfterLogin', location.pathname);
            navigate('/login', { 
              state: { 
                from: location.pathname,
                message: 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.'
              } 
            });
            return;
          }
        } catch (tokenError) {
          logger.error('Error al decodificar token', { error: tokenError });
          // Continuar de todos modos
        }
        
        // Si no tenemos información del usuario en el contexto, intentamos obtenerla
        if (!currentUser || !currentUser._id) {
          console.warn('Información de usuario no disponible en contexto, intentando recuperar...');
          try {
            console.log('Intentando recuperar información del usuario...');
            // Intento de recuperación de datos del usuario
            const userData = await userService.getCurrentUser();
            console.log('Respuesta de getCurrentUser:', userData);
            
            if (!userData || !userData.user) {
              throw new Error('No se pudo obtener información del usuario');
            }
            
            currentUser = userData.user;
            doctorId = currentUser._id;
            
            console.log('Información de usuario recuperada exitosamente:', {
              userId: currentUser._id,
              userRole: currentUser.role,
              userName: currentUser.name
            });
            
            // Verificar explícitamente que el usuario es un médico
            if (currentUser.role !== 'doctor') {
              console.error('El usuario no tiene rol de médico:', currentUser.role);
              throw new Error('Acceso denegado: Solo los médicos pueden acceder a esta página');
            }
          } catch (error: any) {
            console.error('Error al recuperar información del usuario:', error);
            
            // Manejo específico para error 403 (Forbidden)
            if (error.response && error.response.status === 403) {
              console.warn('Acceso denegado (403 Forbidden). El usuario no tiene los permisos necesarios.');
              navigate('/unauthorized', {
                state: {
                  message: 'No tiene permiso para acceder a esta sección. Esta área es solo para médicos.',
                  requiredRole: 'doctor'
                }
              });
              return;
            }
            
            // Para otros errores, redirigir al login
            localStorage.removeItem('token'); // Limpiar el token que podría estar causando problemas
            navigate('/login', { 
              state: { 
                from: location.pathname,
                message: 'Por favor inicie sesión nuevamente para continuar'
              } 
            });
            return;
          }
        } else {
          doctorId = currentUser._id;
          console.log('Información de usuario disponible en contexto:', {
            userId: currentUser._id,
            userRole: currentUser.role,
            userName: currentUser.name
          });
        }

        // Verificar rol explícitamente
        if (!currentUser || currentUser.role !== 'doctor') {
          console.warn('Acceso no autorizado - Usuario no es médico', { 
            userRole: currentUser?.role,
            userId: currentUser?._id,
            requiredRole: 'doctor' 
          });
          navigate('/unauthorized', { 
            state: { 
              message: 'Solo los médicos pueden acceder a esta página',
              requiredRole: 'doctor',
              currentRole: currentUser?.role || 'desconocido'
            } 
          });
          return;
        }

        // Cargar datos del doctor
        try {
          setLoading(true);
          setError(null);
          
          if (!doctorId) {
            throw new Error('ID del doctor no disponible');
          }
          
          console.log('Intentando cargar disponibilidad del doctor con ID:', doctorId);
          
          // Verificar que el token siga siendo válido
          if (!localStorage.getItem('token')) {
            throw new Error('Token no disponible al cargar datos del doctor');
          }
          
          const doctorData = await doctorService.getDoctor(doctorId);
          console.log('Datos del doctor recibidos:', doctorData ? 'OK' : 'No encontrados');
          
          if (!doctorData) {
            throw new Error('No se encontraron datos del médico');
          }
          
          console.log('Disponibilidad recibida:', doctorData.availability);
          setAvailability(doctorData.availability || []);
          console.log('Disponibilidad cargada exitosamente', {
            doctorId: doctorId,
            availabilityCount: doctorData.availability?.length || 0
          });
        } catch (error: any) {
          console.error('Error al cargar disponibilidad:', error);
          const errorMessage = error.message || 'Error desconocido';
          
          // Verificar si es un error de autenticación
          if (
            error.authError || 
            error.response?.status === 401 ||
            errorMessage.includes('401') || 
            errorMessage.includes('token') || 
            errorMessage.includes('autoriza')
          ) {
            console.warn('Error de autenticación detectado, redirigiendo a login');
            localStorage.removeItem('token'); // Eliminar token inválido
            navigate('/login', { 
              state: { 
                from: location.pathname,
                message: 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.'
              } 
            });
          } else {
            setError('Error al cargar la disponibilidad: ' + errorMessage);
          }
        }
      } catch (error) {
        logger.error('Error crítico en AvailabilityManager', {
          error: error instanceof Error ? error.message : error,
          userId: currentUser?._id,
          userRole: currentUser?.role
        });
        setError('Ocurrió un error inesperado. Por favor, intente nuevamente.');
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    };

    verifyUserAndLoadData();
  }, [user, navigate, location.pathname]);

  const confirmAction = (action: () => Promise<void>, message?: string) => {
    setPendingAction(() => action);
    setShowConfirmDialog(true);
  };

  const validateFields = (): boolean => {
    const errors: typeof fieldErrors = {};
    let isValid = true;

    if (!user?._id) {
      setError('Debe iniciar sesión como médico');
      return false;
    }

    if (!selectedDay) {
      errors.day = 'Debe seleccionar un día';
      isValid = false;
    }

    if (!startTime) {
      errors.startTime = 'Debe seleccionar una hora de inicio';
      isValid = false;
    }

    if (!endTime) {
      errors.endTime = 'Debe seleccionar una hora de fin';
      isValid = false;
    }

    if (startTime && endTime) {
      if (!endTime.isAfter(startTime)) {
        errors.endTime = 'La hora de fin debe ser posterior a la hora de inicio';
        isValid = false;
      }

      const startHour = startTime.hour();
      const endHour = endTime.hour();

      if (startHour < 8 || endHour > 17) {
        errors.startTime = 'El horario debe estar entre 8:00 y 17:00';
        isValid = false;
      }
    }

    setFieldErrors(errors);
    return isValid;
  };

  // Función auxiliar para manejar errores en las callbacks
  const handleFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((prev: FieldErrors) => ({ ...prev, [field]: undefined }));
  };

  // Función auxiliar para validar horario
  const validateTimeRange = (start: Dayjs | null, end: Dayjs | null): boolean => {
    if (!start || !end) return false;
    const startHour = start.hour();
    const endHour = end.hour();
    return startHour >= 8 && endHour <= 17 && end.isAfter(start);
  };

  // Actualizar los handlers con tipos
  const handleDayChange = (event: SelectChangeEvent<DayOfWeek>) => {
    setSelectedDay(event.target.value as DayOfWeek);
    handleFieldError('day');
  };

  const handleStartTimeChange = (newValue: Dayjs | null) => {
    setStartTime(newValue);
    handleFieldError('startTime');
  };

  const handleEndTimeChange = (newValue: Dayjs | null) => {
    setEndTime(newValue);
    handleFieldError('endTime');
  };

  const handleAddAvailability = async () => {
    if (!validateFields()) return;

    if (!startTime || !endTime) {
      setError('Las horas de inicio y fin son requeridas');
      return;
    }

    const newSlot: AvailabilitySlot = {
      day: selectedDay,
      startTime: startTime.format('HH:mm'),
      endTime: endTime.format('HH:mm')
    };

    const existingDay = availability.find((slot: AvailabilitySlot) => slot.day === selectedDay);

    if (existingDay) {
      confirmAction(async () => {
        await updateAvailabilitySlot(newSlot);
      }, `Ya existe disponibilidad para el ${DAYS_SPANISH[selectedDay]}. ¿Desea actualizarla?`);
    } else {
      confirmAction(async () => {
        await addAvailabilitySlot(newSlot);
      }, '¿Desea agregar este horario?');
    }
  };

  const updateAvailabilitySlot = async (newSlot: AvailabilitySlot) => {
    if (!user?._id) {
      logger.error('Intento de actualizar disponibilidad sin autenticación');
      setError('Usuario no autenticado. Por favor, inicie sesión nuevamente.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const updatedAvailability = availability.map((slot: AvailabilitySlot) =>
        slot.day === newSlot.day ? newSlot : slot
      );

      const updatedDoctor = await doctorService.updateAvailability(user._id, updatedAvailability);
      setAvailability(updatedDoctor.availability);
      setSuccess('Disponibilidad actualizada exitosamente');
    } catch (error) {
      handleError(error, 'Error al actualizar la disponibilidad');
    } finally {
      setLoading(false);
    }
  };

  const addAvailabilitySlot = async (newSlot: AvailabilitySlot) => {
    if (!user?._id) {
      logger.error('Intento de agregar disponibilidad sin autenticación');
      setError('Usuario no autenticado. Por favor, inicie sesión nuevamente.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const updatedDoctor = await doctorService.updateAvailability(user._id, [...availability, newSlot]);
      setAvailability(updatedDoctor.availability);
      setSuccess('Disponibilidad agregada exitosamente');
    } catch (error) {
      handleError(error, 'Error al agregar la disponibilidad');
    } finally {
      setLoading(false);
    }
  };

  const handleError = (error: unknown, defaultMessage: string) => {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    logger.error(defaultMessage, { error: errorMessage });
    setError(`${defaultMessage}. Por favor, intente nuevamente.`);
  };

  const handleRemoveAvailability = (dayToRemove: DayOfWeek) => {
    confirmAction(async () => {
      if (!user?.role || !user._id) {
        logger.error('Intento de eliminar disponibilidad sin autenticación válida');
        navigate('/login', { 
          state: { 
            from: location.pathname,
            message: 'Por favor, inicie sesión nuevamente para continuar'
          } 
        });
        return;
      }

      if (user.role !== 'doctor') {
        logger.error('Intento no autorizado de eliminar disponibilidad', { 
          userRole: user.role,
          userId: user._id,
          requiredRole: 'doctor'
        });
        navigate('/unauthorized', { 
          state: { 
            message: 'Solo los médicos pueden gestionar su disponibilidad',
            requiredRole: 'doctor',
            currentRole: user.role
          } 
        });
        return;
      }

      try {
        setLoading(true);
        setError(null);
        logger.debug('Eliminando disponibilidad', { 
          day: dayToRemove,
          doctorId: user._id 
        });

        const updatedAvailability = availability.filter(
          (slot: AvailabilitySlot) => slot.day !== dayToRemove
        );
        
        const updatedDoctor = await doctorService.updateAvailability(user._id, updatedAvailability);
        
        if (!updatedDoctor || !updatedDoctor.availability) {
          throw new Error('No se recibió una respuesta válida del servidor');
        }

        setAvailability(updatedDoctor.availability);
        setSuccess('Disponibilidad eliminada exitosamente');
      } catch (error) {
        handleError(error, 'Error al eliminar la disponibilidad');
      } finally {
        setLoading(false);
      }
    }, `¿Está seguro que desea eliminar la disponibilidad del ${DAYS_SPANISH[dayToRemove]}?`);
  };

    return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="md">
        <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h5">
              Gestión de Disponibilidad
            </Typography>
          </Box>

          {error && (
            <Box sx={{ mb: 2 }}>
              <CustomAlert 
                message={error}
                severity="error" 
                onClose={() => setError(null)}
                variant="filled"
                sx={{ display: 'flex', alignItems: 'center' }}
                action={
                  <Button color="inherit" size="small" onClick={() => setError(null)}>
                    OK
                  </Button>
                }
              />
            </Box>
          )}

          {success && (
            <Box sx={{ mb: 2 }}>
              <CustomAlert 
                message={success}
                severity="success"
                onClose={() => setSuccess(null)}
                variant="filled"
                sx={{ display: 'flex', alignItems: 'center' }}
                action={
                  <Button color="inherit" size="small" onClick={() => setSuccess(null)}>
                    OK
                  </Button>
                }
              />
            </Box>
          )}

        {initialLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth error={!!fieldErrors.day}>
                  <InputLabel>Día de la semana</InputLabel>
                  <Select<DayOfWeek>
                    value={selectedDay}
                    label="Día de la semana"
                    onChange={handleDayChange}
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <MenuItem key={day} value={day}>
                        {DAYS_SPANISH[day]}
                      </MenuItem>
                    ))}
                  </Select>
                  {fieldErrors.day && (
                    <FormHelperText>{fieldErrors.day}</FormHelperText>
                  )}
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <TimePicker
                  label="Hora de inicio"
                  value={startTime}
                  onChange={handleStartTimeChange}
                  views={['hours', 'minutes']}
                  ampm={false}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      error: !!fieldErrors.startTime,
                      helperText: fieldErrors.startTime
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TimePicker
                  label="Hora de fin"
                  value={endTime}
                  onChange={handleEndTimeChange}
                  views={['hours', 'minutes']}
                  ampm={false}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      error: !!fieldErrors.endTime,
                      helperText: fieldErrors.endTime
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} md={2}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleAddAvailability}
                  disabled={loading || !validateTimeRange(startTime, endTime)}
                  sx={{ height: '56px' }}
                >
                  {loading ? 'Agregando...' : 'Agregar'}
                </Button>
              </Grid>
            </Grid>

            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                Disponibilidad Actual
              </Typography>
              <Grid container spacing={2}>
                {availability.map((slot: AvailabilitySlot, index: number) => (
                  <Grid item xs={12} key={`${slot.day}-${index}`}>
                    <Paper elevation={1} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography>
                        {DAYS_SPANISH[slot.day]}: {slot.startTime} - {slot.endTime}
                      </Typography>
                      <Button
                        color="error"
                        onClick={() => handleRemoveAvailability(slot.day)}
                        disabled={loading}
                      >
                        Eliminar
                      </Button>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </>
        )}
      </Paper>

      <ContinueDialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={async () => {
          if (pendingAction) {
            await pendingAction();
            setShowConfirmDialog(false);
            setPendingAction(null);
          }
        }}
        title="Confirmar acción"
        message={
          pendingAction ? 
          "¿Está seguro que desea realizar esta acción?" : 
          "No hay acción pendiente"
        }
      />
      </Container>
    </LocalizationProvider>
  );
};

export default AvailabilityManager;
