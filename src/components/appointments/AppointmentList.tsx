import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Chip,
  FormHelperText,
  Box,
  CircularProgress,
} from '@mui/material';
import CustomAlert from '../common/CustomAlert';
import { Delete, Edit, Add } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import dayjs, { Dayjs } from 'dayjs';
import { appointmentService, doctorService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Appointment, Doctor } from '../../types';
import ContinueDialog from '../common/ContinueDialog';

export const AppointmentList: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [confirmCancelDialog, setConfirmCancelDialog] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [selectedTime, setSelectedTime] = useState<dayjs.Dayjs | null>(null);
  const [formData, setFormData] = useState({
    doctorId: '',
    reason: '',
  });
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [error, setError] = useState<{
    general?: string;
    date?: string;
    time?: string;
    reason?: string;
  }>({});
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [confirmActionDialog, setConfirmActionDialog] = useState(false);
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [currentAction, setCurrentAction] = useState<() => void>(() => {});

  // Obtener citas filtradas según el rol del usuario
  const { data: appointments, isLoading: loadingAppointments } = useQuery<Appointment[]>(
    ['appointments', user?._id, user?.role],
    async () => {
      // Verificación de seguridad para asegurarnos de que user existe
      if (!user || !user._id) {
        console.error('Usuario no disponible para la consulta de citas');
        return []; // Devolver un array vacío en vez de lanzar error
      }
      
      console.log('Solicitando citas para el usuario:', {
        id: user._id,
        role: user?.role || 'sin rol'
      });
      
      try {
        // Agregar filtros explícitos según el rol del usuario
        const params: Record<string, string> = {};
        
        // El backend ya hace el filtrado por rol automáticamente,
        // pero agregamos estos parámetros de manera explícita para mayor seguridad
        if (user.role === 'doctor') {
          params.doctorId = user._id;
        } else {
          params.patientId = user._id;
        }
        
        const result = await appointmentService.getAppointments(params);
        return Array.isArray(result) ? result : [];
      } catch (error) {
        console.error('Error al obtener citas para el usuario', user._id, error);
        return []; // Devolver un array vacío en caso de error
      }
    },
    {
      // No ejecutar la consulta hasta que tengamos información del usuario
      enabled: Boolean(user && user._id),
      // Mostrar mensaje de error si la consulta falla
      onError: (error) => {
        console.error('Error al obtener citas:', error);
        setError({ general: 'Error al cargar las citas. Por favor, intente de nuevo.' });
      }
    }
  );

  // Obtener médicos
  const { data: doctors } = useQuery<Doctor[]>('doctors', () =>
    doctorService.getDoctors()
  );

  // Efecto para preseleccionar el doctor si el usuario es médico
  useEffect(() => {
    if (user && user.role === 'doctor' && user._id && formData.doctorId === '') {
      try {
        setFormData(prev => ({
          ...prev,
          doctorId: user._id
        }));
        console.log('Doctor preseleccionado automáticamente:', user._id);
      } catch (error) {
        console.error('Error al preseleccionar doctor:', error);
      }
    }
  }, [user, openDialog, formData.doctorId]);

  // Efecto para actualizar el médico seleccionado
  useEffect(() => {
    if (formData.doctorId && doctors) {
      const doctor = doctors.find(d => d._id === formData.doctorId);
      setSelectedDoctor(doctor || null);
    } else {
      setSelectedDoctor(null);
    }
  }, [formData.doctorId, doctors]);

  // Efecto para calcular horarios disponibles
  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      const dayOfWeek = selectedDate.format('dddd').toLowerCase();
      const availability = selectedDoctor.availability.find(a => a.day === dayOfWeek);
      
      if (availability) {
        const times: string[] = [];
        const start = dayjs(availability.startTime, 'HH:mm');
        const end = dayjs(availability.endTime, 'HH:mm');
        
        let current = start;
        while (current.isBefore(end)) {
          const timeStr = current.format('HH:mm');
          
          // Verificar si ya existe una cita en este horario
          const hasAppointment = appointments?.some(app => 
            dayjs(app.date).format('YYYY-MM-DD') === selectedDate.format('YYYY-MM-DD') &&
            app.time === timeStr &&
            app.status !== 'cancelled' &&
            (typeof app.doctor === 'string' ? 
              app.doctor === selectedDoctor._id : 
              app.doctor._id === selectedDoctor._id)
          );

          if (!hasAppointment && 
              current.hour() >= 8 && 
              current.hour() < 17) {
            times.push(timeStr);
          }
          
          current = current.add(30, 'minute');
        }
        
        setAvailableTimes(times);
      } else {
        setAvailableTimes([]);
      }
    } else {
      setAvailableTimes([]);
    }
  }, [selectedDoctor, selectedDate, appointments]);

  // Mutación para crear cita con mejor manejo de errores
  const createAppointment = useMutation(
    (data: any) => appointmentService.createAppointment(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('appointments');
        handleCloseDialog();
        setError({});
      },
      onError: (err: any) => {
        console.error('Error completo:', err); // Debug
        const errorResponse = err.response?.data || err;
        const errorMessage = errorResponse?.details || errorResponse?.message || err.message;
        
        if (typeof errorMessage === 'string') {
          setError({ general: errorMessage });
        } else if (typeof errorMessage === 'object') {
          // Mapear errores específicos a los campos correspondientes
          const newErrors: Record<string, string> = {};
          Object.entries(errorMessage).forEach(([key, value]) => {
            if (key === 'doctorId') newErrors.general = value as string;
            else if (['date', 'time', 'reason'].includes(key)) {
              newErrors[key] = value as string;
            }
          });
          setError(newErrors);
        } else {
          setError({ general: 'Error al crear la cita' });
        }
      },
    }
  );

  // Mutación para actualizar cita con mejor manejo de errores
  const updateAppointment = useMutation(
    (data: { id: string, appointment: Partial<Appointment> }) => 
      appointmentService.updateAppointment(data.id, data.appointment),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('appointments');
        handleCloseDialog();
        setError({});
      },
      onError: (err: any) => {
        const errorMessage = err.response?.data?.details || err.response?.data?.message || err.message;
        if (typeof errorMessage === 'object') {
          setError(errorMessage);
        } else {
          setError({ general: errorMessage });
        }
      },
    }
  );

  // Mutación para cancelar cita con mejor manejo de errores
  const cancelAppointment = useMutation(
    (id: string) => appointmentService.cancelAppointment(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('appointments');
      },
      onError: (err: any) => {
        const errorMessage = err.response?.data?.message || err.message;
        // Mostrar error en un Alert temporal
        setError({ general: errorMessage });
        setTimeout(() => setError({}), 5000);
      },
    }
  );

  const validateForm = (): boolean => {
    const newErrors: typeof error = {};
    
    // Si el usuario es doctor, asegurar que su ID está seleccionado
    if (user?.role === 'doctor' && user?._id) {
      // Asegurar que el doctorId esté establecido al ID del usuario médico
      if (formData.doctorId !== user._id) {
        setFormData(prev => ({
          ...prev,
          doctorId: user._id
        }));
      }
    } else if (!formData.doctorId) {
      newErrors.general = 'Debe seleccionar un médico';
      return false;
    }

    if (!selectedDate) {
      newErrors.date = 'La fecha es requerida';
    } else {
      // Validar fecha no pasada
      if (selectedDate.isBefore(dayjs(), 'day')) {
        newErrors.date = 'No se pueden agendar citas en fechas pasadas';
      }
      // Si es hoy, validar que la hora no haya pasado
      if (selectedDate.isSame(dayjs(), 'day') && selectedTime) {
        if (selectedTime.isBefore(dayjs())) {
          newErrors.time = 'No se pueden agendar citas en horas pasadas';
        }
      }
    }

    if (!selectedTime) {
      newErrors.time = 'La hora es requerida';
    } else {
      const hour = selectedTime.hour();
      const minute = selectedTime.minute();
      
      // Validar horario de atención (8:00 AM - 5:00 PM)
      if (hour < 8 || hour >= 17) {
        newErrors.time = 'El horario de atención es de 8:00 AM a 5:00 PM';
      }
      
      // Validar que los minutos sean múltiplos de 30
      if (minute % 30 !== 0) {
        newErrors.time = 'Las citas deben programarse en intervalos de 30 minutos';
      }
    }

    if (!formData.reason.trim()) {
      newErrors.reason = 'El motivo es requerido';
    } else if (formData.reason.length < 10) {
      newErrors.reason = 'El motivo debe tener al menos 10 caracteres';
    } else if (formData.reason.length > 500) {
      newErrors.reason = 'El motivo no puede exceder los 500 caracteres';
    }

    setError(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    // Solo mostrar confirmación si hay cambios sin guardar
    if (formData.doctorId || formData.reason || selectedDate || selectedTime) {
      setConfirmActionDialog(true); // Mostrar diálogo de confirmación antes de cerrar
    } else {
      // Si no hay cambios, cerrar directamente
      closeDialogAndReset();
    }
  };

  const closeDialogAndReset = () => {
    setOpenDialog(false);
    setSelectedDate(null);
    setSelectedTime(null);
    setFormData({ doctorId: '', reason: '' });
    setEditingAppointment(null);
    setError({});
    setConfirmActionDialog(false);
  };

  const handleEdit = (appointment: Appointment) => {
    try {
      setEditingAppointment(appointment);
      setSelectedDate(dayjs(appointment.date));
      setSelectedTime(dayjs(appointment.time, 'HH:mm'));
      
      // Manejo seguro del ID del doctor
      let doctorId = '';
      if (typeof appointment.doctor === 'string') {
        doctorId = appointment.doctor;
      } else if (appointment.doctor && appointment.doctor._id) {
        doctorId = appointment.doctor._id;
      } else {
        console.error('Doctor no disponible en la cita:', appointment);
        doctorId = user?.role === 'doctor' ? user._id : '';
      }
      
      setFormData({
        doctorId,
        reason: appointment.reason || '',
      });
      setOpenDialog(true);
    } catch (error) {
      console.error('Error al editar cita:', error);
      setError({ general: 'Error al cargar los datos de la cita para edición' });
    }
  };

  const handleCancelClick = (appointment: Appointment) => {
    setAppointmentToCancel(appointment);
    setConfirmCancelDialog(true);
  };

  const handleConfirmCancel = () => {
    if (appointmentToCancel) {
      cancelAppointment.mutate(appointmentToCancel._id);
    }
    setConfirmCancelDialog(false);
    setAppointmentToCancel(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError({});

    if (!validateForm()) {
      return;
    }

    try {
      // Asegurarnos que la hora esté en formato HH:mm
      const formattedTime = selectedTime ? 
        selectedTime.format('HH:mm') : 
        null;

      const appointmentData = {
        doctorId: formData.doctorId,
        reason: formData.reason.trim(),
        date: selectedDate?.format('YYYY-MM-DD'),
        time: formattedTime || undefined,
      };

      // Validación adicional del formato de hora
      if (!formattedTime || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(formattedTime)) {
        setError({ time: 'Formato de hora inválido. Debe ser HH:mm' });
        return;
      }

      console.log('Enviando datos de cita:', appointmentData); // Debug

      if (editingAppointment) {
        updateAppointment.mutate({
          id: editingAppointment._id,
          appointment: appointmentData,
        });
      } else {
        createAppointment.mutate(appointmentData);
      }
    } catch (err) {
      console.error('Error al preparar datos:', err);
      setError({ general: 'Error al preparar los datos de la cita' });
    }
  };

  const getStatusChipColor = (status: Appointment['status']) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'confirmed':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'completed':
        return 'default';
      default:
        return 'default';
    }
  };

  const getConfirmationMessage = (type: 'edit' | 'delete' | 'discard') => {
    switch (type) {
      case 'edit':
        return {
          title: '¿Desea continuar con la iteración?',
          message: 'Los cambios que no se guarden se perderán.',
          confirmButton: 'Sí, continuar'
        };
      case 'delete':
        return {
          title: '¿Desea eliminar esta cita?',
          message: '¿Está seguro que desea eliminar esta cita? Esta acción no se puede deshacer.',
          confirmButton: 'Sí, eliminar'
        };
      case 'discard':
        return {
          title: '¿Desea continuar con la iteración?',
          message: 'Los cambios que no se guarden se perderán.',
          confirmButton: 'Sí, continuar'
        };
      default:
        return {
          title: '¿Desea continuar?',
          message: '¿Está seguro que desea continuar con esta acción?',
          confirmButton: 'Continuar'
        };
    }
  };

  // Gestionar acciones con confirmación
  const handleActionWithConfirmation = (action: () => void) => {
    setCurrentAction(() => action);
    setShowContinueDialog(true);
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars

  const handleConfirm = () => {
    currentAction();
    setShowContinueDialog(false);
  };

  return (
    <Container>

      <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
        <Grid container justifyContent="space-between" alignItems="center" mb={3}>
          <Grid item>
            <Typography variant="h5" component="h2">
              {user?.role === 'doctor' ? 'Citas de Mis Pacientes' : 'Mis Citas Médicas'}
            </Typography>
            <Typography variant="subtitle2" color="text.secondary">
              {user?.role === 'doctor' 
                ? 'Gestiona las citas con tus pacientes' 
                : 'Administra tus citas con especialistas médicos'}
            </Typography>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleOpenDialog}
              disabled={loadingAppointments || !user}
            >
              Nueva Cita
            </Button>
          </Grid>
        </Grid>

        {error.general && (
          <CustomAlert message={error.general} severity="error" sx={{ mb: 2 }} onClose={() => setError({})} />
        )}
        
        {loadingAppointments && (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
            <Typography variant="body1" ml={2}>Cargando citas...</Typography>
          </Box>
        )}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Hora</TableCell>
                {user?.role === 'doctor' ? (
                  <TableCell>Paciente</TableCell>
                ) : (
                  <TableCell>Médico</TableCell>
                )}
                <TableCell>Motivo</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loadingAppointments && (!appointments || appointments.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body1" sx={{ py: 2 }}>
                      No hay citas disponibles.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : !loadingAppointments && Array.isArray(appointments) ? (
                appointments.map((appointment) => (
                  <TableRow key={appointment._id}>
                    <TableCell>
                      {dayjs(appointment.date).format('DD/MM/YYYY')}
                    </TableCell>
                    <TableCell>{appointment.time}</TableCell>
                    <TableCell>
                      {user?.role === 'doctor' ? (
                        // Si es médico, mostrar el nombre del paciente
                        typeof appointment.patient === 'object' && appointment.patient
                          ? appointment.patient.name || 'Paciente sin nombre'
                          : 'Cargando información...'
                      ) : (
                        // Si es paciente, mostrar el nombre del médico
                        typeof appointment.doctor === 'object' && appointment.doctor
                          ? appointment.doctor.name || 'Médico sin nombre'
                          : 'Cargando información...'
                      )}
                    </TableCell>
                    <TableCell>{appointment.reason}</TableCell>
                    <TableCell>
                      <Chip
                        label={appointment.status}
                        color={getStatusChipColor(appointment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {appointment.status === 'pending' && (
                        <>
                          <IconButton
                            color="primary"
                            onClick={() => handleEdit(appointment)}
                            title="Editar cita"
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            color="error"
                            onClick={() => handleCancelClick(appointment)}
                            title="Cancelar cita"
                          >
                            <Delete />
                          </IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Diálogo para crear cita */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {editingAppointment ? 'Editar Cita Médica' : 'Nueva Cita Médica'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Médico"
                  value={formData.doctorId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev) => ({
                      ...prev,
                      doctorId: e.target.value,
                    }))
                  }
                  required
                  error={!!error.general}
                  helperText={error.general}
                  disabled={user?.role === 'doctor'} // Desactivar la selección si es médico
                >
                  {/* Si es médico, solo mostrar su propio perfil */}
                  {user?.role === 'doctor' && user?._id ? (
                    <MenuItem key={user._id} value={user._id}>
                      {user.name || 'Mi perfil'} {user.speciality ? `- ${user.speciality}` : '(Médico)'}
                    </MenuItem>
                  ) : Array.isArray(doctors) && doctors.length > 0 ? (
                    // Si es paciente, mostrar todos los médicos disponibles
                    doctors.map((doctor: Doctor) => (
                      <MenuItem key={doctor._id} value={doctor._id}>
                        {doctor.name || 'Doctor'} - {doctor.speciality || 'Especialidad no especificada'}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>No hay médicos disponibles</MenuItem>
                  )}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Fecha"
                  value={selectedDate}
                  onChange={(newValue) => setSelectedDate(newValue)}
                  disablePast
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      error: !!error.date,
                      helperText: error.date
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TimePicker
                  label="Hora"
                  value={selectedTime}
                  onChange={(newValue) => setSelectedTime(newValue)}
                  shouldDisableTime={(value: Dayjs, type) => {
                    const timeValue = type === 'hours' ? value.hour() : value.minute();
                    if (type === 'hours' && (timeValue < 8 || timeValue >= 17)) {
                      return true;
                    }
                    if (type === 'minutes' && timeValue % 30 !== 0) {
                      return true;
                    }
                    
                    // Deshabilitar horarios no disponibles
                    const timeStr = value.format('HH:mm');
                    
                    return !availableTimes.includes(timeStr);
                  }}
                  views={['hours', 'minutes']}
                  ampm={false}
                  minTime={dayjs().hour(8).minute(0)}
                  maxTime={dayjs().hour(17).minute(0)}
                  skipDisabled
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      error: !!error.time,
                      helperText: error.time || (
                        availableTimes.length === 0 ? 
                          'No hay horarios disponibles para este día' : 
                          'Horario: 8:00 - 17:00, intervalos de 30 min'
                      )
                    }
                  }}
                />
                {formData.doctorId && !selectedDoctor?.availability.some(a => 
                  a.day === selectedDate?.format('dddd').toLowerCase()
                ) && (
                  <FormHelperText error>
                    El médico no atiende este día
                  </FormHelperText>
                )}
              </Grid>
                <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Motivo de la consulta"
                  multiline
                  rows={3}
                  value={formData.reason}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                  setFormData((prev: { doctorId: string; reason: string }) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                  }
                  required
                  error={!!error.reason}
                  helperText={error.reason}
                />
                </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createAppointment.isLoading || updateAppointment.isLoading}
            >
              {createAppointment.isLoading || updateAppointment.isLoading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Diálogo de confirmación para cancelar cita */}
      <Dialog
        open={confirmCancelDialog}
        onClose={() => setConfirmCancelDialog(false)}
      >
        <DialogTitle>
          <Typography variant="h6" color="error">
            Confirmación de Cancelación
          </Typography>
        </DialogTitle>
        <DialogContent>
          <CustomAlert 
            message="Esta acción no se puede deshacer. La cita quedará cancelada permanentemente."
            severity="warning" 
            sx={{ mb: 2 }} 
          />
          {appointmentToCancel && (
            <Box mt={2}>
              <Typography variant="subtitle1" gutterBottom>
                Detalles de la cita a cancelar:
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Fecha:</strong> {dayjs(appointmentToCancel.date).format('DD/MM/YYYY')}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Hora:</strong> {appointmentToCancel.time}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Médico:</strong> {typeof appointmentToCancel.doctor === 'object' && appointmentToCancel.doctor
                  ? appointmentToCancel.doctor.name || 'Sin nombre'
                  : 'Cargando...'}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Motivo:</strong> {appointmentToCancel.reason}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setConfirmCancelDialog(false)}
            variant="outlined"
          >
            Mantener Cita
          </Button>
          <Button 
            onClick={handleConfirmCancel}
            color="error"
            variant="contained"
            disabled={cancelAppointment.isLoading}
            startIcon={<Delete />}
          >
            {cancelAppointment.isLoading ? 'Cancelando...' : 'Cancelar Cita'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de confirmación para salir sin guardar */}
      <Dialog
        open={confirmActionDialog}
        onClose={() => setConfirmActionDialog(false)}
      >
        <DialogTitle>
          {getConfirmationMessage('discard').title}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {getConfirmationMessage('discard').message}
          </Typography>
          {formData.doctorId && selectedDate && selectedTime && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Médico: {doctors?.find(d => d._id === formData.doctorId)?.name || (user?.role === 'doctor' ? user.name : 'No seleccionado')}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                Fecha: {selectedDate.format('DD/MM/YYYY')}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                Hora: {selectedTime.format('HH:mm')}
              </Typography>
              {formData.reason && (
                <Typography variant="subtitle2" color="text.secondary">
                  Motivo: {formData.reason}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmActionDialog(false)}>
            Cancelar
          </Button>
          <Button
            onClick={closeDialogAndReset}
            variant="contained"
          >
            {getConfirmationMessage('discard').confirmButton}
          </Button>
        </DialogActions>
      </Dialog>

      <ContinueDialog
        open={showContinueDialog}
        onClose={() => setShowContinueDialog(false)}
        onConfirm={handleConfirm}
      />
    </Container>
  );
};

export default AppointmentList;