/**
 * Componente para visualizar y gestionar las citas archivadas
 * Permite a médicos y pacientes ver las citas que han sido completadas, canceladas o marcadas como no tomadas
 */
import React, { useState, useEffect } from 'react'; // Importación de React y hooks básicos
import {
  Container, // Contenedor principal con márgenes responsivos
  Paper, // Elemento de superficie elevada para contener la lista
  Typography, // Componente para texto con estilos coherentes 
  Table, // Componente de tabla para mostrar datos estructurados
  TableBody, // Cuerpo de la tabla
  TableCell, // Celda individual de la tabla
  TableContainer, // Contenedor con scrolling para tablas
  TableHead, // Cabecera de la tabla
  TableRow, // Fila de la tabla
  TextField, // Campo de entrada para búsqueda
  Box, // Contenedor flexible para layout
  CircularProgress, // Indicador de carga circular
  Chip, // Elemento compacto para mostrar estado con color
  Grid, // Sistema de rejilla para layout responsivo
  MenuItem, // Elemento individual de menú desplegable
  FormControl, // Contenedor para controles de formulario
  InputLabel, // Etiqueta para controles de formulario
  Select, // Control desplegable para selección
  SelectChangeEvent, // Tipo para eventos de cambio en Select
  Divider, // Separador visual
  Button, // Botón interactivo
  Alert // Componente para mostrar mensajes importantes
} from '@mui/material'; // Biblioteca de componentes UI
import { useQuery, useQueryClient } from 'react-query'; // Hooks para gestión de peticiones y caché
import dayjs from 'dayjs'; // Biblioteca para manipulación de fechas
import { appointmentService, userService } from '../../services/api'; // Servicios para comunicación con API
import { logger } from '../../services/logger'; // Utilidad para registro de eventos
import { useAuth } from '../../contexts/AuthContext'; // Contexto de autenticación
import { Appointment, User, Doctor } from '../../types'; // Tipos de datos
import CustomAlert from '../common/CustomAlert'; // Componente personalizado de alerta

/**
 * Mapeo de colores para los diferentes estados de citas
 * Permite visualización consistente del estado mediante chips de color
 */
const statusColors = {
  completed: 'success', // Verde para citas completadas exitosamente
  cancelled: 'error',   // Rojo para citas canceladas
  'no-show': 'error'    // Rojo para pacientes que no asistieron
};

/**
 * Etiquetas en español para los diferentes estados de citas
 * Mejora la experiencia de usuario con terminología localizada
 */
const statusLabels = {
  completed: 'Completada',
  cancelled: 'Cancelada',
  'no-show': 'No Tomada'
};

/**
 * Componente principal para la lista de citas archivadas
 * Permite visualizar y filtrar citas completadas, canceladas o no tomadas
 */
export const ArchivedAppointmentList: React.FC = () => {
  // Acceso al contexto de autenticación para obtener información del usuario actual
  const { user, checkAuth } = useAuth();
  // Cliente de consulta para gestionar caché y recargar datos
  const queryClient = useQueryClient();
  
  // Estados para gestionar la interfaz y filtros
  const [searchTerm, setSearchTerm] = useState(''); // Término de búsqueda para filtrar citas
  const [selectedPatient, setSelectedPatient] = useState<string>(''); // ID de paciente seleccionado (para médicos)
  const [error, setError] = useState<string | null>(null); // Mensajes de error
  const [isRetrying, setIsRetrying] = useState(false); // Indicador de intento de reconexión
  const [loadingUser, setLoadingUser] = useState(false); // Indicador de carga de datos de usuario
  
  // Verificar si el usuario es un médico para mostrar funcionalidades específicas
  const isDoctor = user?.role === 'doctor';
  
  /**
   * Función para verificar la autenticación e intentar reconectar con el servidor
   * - Se utiliza cuando ocurren errores de autenticación o conexión
   * - Intenta revalidar el token del usuario y recargar los datos
   * - Actualiza la interfaz para mostrar el estado del proceso
   */
  const retryConnection = async () => {
    setIsRetrying(true); // Indicar que se está intentando reconectar
    setError(null); // Limpiar mensajes de error previos
    
    try {
      // Verificar la autenticación y capturar el resultado
      const success = await checkAuth();
      
      if (success) {
        logger.info('Reconexión exitosa, recargando datos');
        // Invalidar consultas en caché para forzar una recarga fresca
        queryClient.invalidateQueries('archivedAppointments');
        queryClient.invalidateQueries('patients');
        
        // Recargar datos explícitamente con un pequeño retraso
        // para asegurar que las invalidaciones de caché se procesen
        setTimeout(() => {
          refetch(); // Función proporcionada por useQuery
        }, 1000);
      } else {
        // Mostrar mensaje si la autenticación falló
        setError('No se pudo verificar su identidad. Por favor, refresque la página o inicie sesión nuevamente.');
        logger.error('checkAuth retornó false durante la reconexión');
      }
    } catch (err) {
      // Capturar errores en el proceso de reconexión
      setError('No se pudo restaurar la conexión. Por favor, inicie sesión nuevamente.');
      logger.error('Error al intentar reconectar:', err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      // Siempre restablecer el estado de reconexión cuando termina
      setIsRetrying(false);
    }
  };

  /**
   * Efecto para asegurar que el usuario esté autenticado antes de cargar datos
   * - Ejecuta la verificación de autenticación si no hay usuario en el contexto
   * - Evita múltiples verificaciones simultáneas con estado loadingUser
   * - Limpia correctamente al desmontar el componente para evitar actualizaciones en componentes desmontados
   */
  useEffect(() => {
    let isMounted = true; // Flag para evitar actualizaciones en componente desmontado
    
    // Si no hay usuario pero no se está verificando actualmente
    if (!user && !loadingUser) {
      setLoadingUser(true);
      // Intentar verificar autenticación
      checkAuth().then(() => {
        // Actualizar estado solo si el componente sigue montado
        if (isMounted) {
          setLoadingUser(false);
        }
      });
    }
    
    // Función de limpieza para cuando el componente se desmonte
    return () => {
      isMounted = false;
    };
  }, [user, loadingUser, checkAuth]);

  /**
   * Consulta para obtener las citas archivadas del servidor
   * - Usa react-query para gestionar caché, recargas y estado de carga
   * - Se vuelve a ejecutar cuando cambia el paciente seleccionado
   * - Incluye manejo robusto de errores y transformación de tipos
   */
  const { data: archivedAppointments, isLoading: loadingAppointments, refetch } = useQuery<Appointment[]>(
    ['archivedAppointments', selectedPatient], // Clave de caché que incluye el filtro de paciente
    async () => {
      try {
        // Preparar parámetros para la petición API
        const params: any = {};
        // Solo añadir filtro de paciente si es un médico y ha seleccionado uno
        if (selectedPatient && isDoctor) {
          params.patientId = selectedPatient;
        }
        
        // Realizar petición al servidor
        const results = await appointmentService.getArchivedAppointments(params);
        
        // Validación defensiva: asegurar que los resultados son un array
        if (!Array.isArray(results)) {
          logger.warn('La respuesta de citas archivadas no es un array', { results });
          return [] as Appointment[];
        }
        
        /**
         * Transformación de datos para asegurar tipos correctos
         * - Maneja tanto referencias por ID como objetos completos
         * - Gestiona valores nulos o indefinidos para evitar errores en renderizado
         * - Asegura la consistencia de tipos para el resto del componente
         */
        const typedAppointments: Appointment[] = results.map(appointment => {
          // Desestructurar para manejar por separado patient/doctor que pueden ser objetos o IDs
          const { patient, doctor, ...rest } = appointment;
          
          // Determinar el tipo adecuado para el paciente con comprobaciones de seguridad
          let patientValue: User | string;
          if (typeof patient === 'object' && patient) {
            patientValue = patient as User; // Es un objeto User completo
          } else {
            // Si no es un objeto o es null, usar un valor seguro
            patientValue = String(patient || 'unknown');
          }
          
          // Determinar el tipo adecuado para el doctor con comprobaciones de seguridad
          let doctorValue: Doctor | string;
          if (typeof doctor === 'object' && doctor) {
            doctorValue = doctor as Doctor; // Es un objeto Doctor completo
          } else {
            // Si no es un objeto o es null, usar un valor seguro
            doctorValue = String(doctor || 'unknown');
          }
          
          // Reconstruir la cita con tipos correctos
          return {
            ...rest,
            patient: patientValue,
            doctor: doctorValue
          } as Appointment;
        });
        
        return typedAppointments;
      } catch (err) {
        // Registrar errores pero no romper la UI
        logger.error('Error en la función de consulta:', err);
        return [];
      }
    },
    {
      /**
       * Opciones de configuración para la consulta de citas archivadas
       * - Control preciso del comportamiento de caché, recarga y manejo de errores
       */
      enabled: Boolean(user?._id) && !loadingUser, // Solo ejecutar cuando hay usuario autenticado
      retry: 2, // Realizar hasta 2 reintentos automáticos en caso de error temporal
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Retardo exponencial entre reintentos (max 10s)
      
      /**
       * Callback ejecutado cuando la consulta se completa (con éxito o error)
       * - Detecta y registra situaciones anómalas como recibir datos parciales durante errores
       */
      onSettled: (data, error: any) => {
        // Situación inusual: recibir datos a pesar de un error
        if (data && error) {
          logger.warn('Situación inusual: datos recibidos a pesar del error', {
            dataLength: Array.isArray(data) ? data.length : 0, // Cantidad de datos recibidos
            error: error?.message || 'Error desconocido' // Descripción del error
          });
        }
      },
      
      /**
       * Callback para manejar errores de la consulta
       * - Implementa estrategias específicas según el tipo de error
       * - Incluye mecanismos de reconexión automática para problemas de autenticación
       * - Proporciona mensajes descriptivos al usuario
       */
      onError: (err: any) => {
        logger.error('Error al cargar citas archivadas:', err);
        
        // Estrategias específicas según el tipo de error
        if (err.response?.status === 404) {
          // Discriminar entre diferentes tipos de errores 404
          const isUserCurrentError = err.config?.url?.includes('/users/current');
          
          if (isUserCurrentError) {
            // Error de autenticación - el endpoint de usuario actual no respondió
            setError('Error de autenticación: Verificando credenciales...');
            
            // Intentar reconexión con retraso para evitar peticiones excesivas
            setTimeout(() => {
              retryConnection();
            }, 1000);
          } else {
            // Otro tipo de error 404 - recurso no encontrado
            setError('No se pudo cargar las citas archivadas. La función puede estar temporalmente no disponible.');
          }
        } else if (err.response?.status === 401) {
          // Error de autorización - token expirado o inválido
          setError('Su sesión necesita revalidación. Intentando reconectar automáticamente...');
          
          // Proceso de reconexión con manejo de redirección si falla
          setTimeout(() => {
            retryConnection();
            
            // Guardar ruta actual para volver después del login
            localStorage.setItem('redirectAfterLogin', window.location.pathname);
            
            // Verificar si el error persiste después de un tiempo y redirigir si es necesario
            const errorCheckTimer = setTimeout(() => {
              // Comprobar si todavía hay un error visible en la UI
              if (document.querySelector('.error-boundary-container')) {
                window.location.href = '/login'; // Redirección a login si persiste el error
              }
            }, 3000);
            
            // Limpieza para evitar memory leaks si el componente se desmonta
            return () => clearTimeout(errorCheckTimer);
          }, 1000);
        } else if (err.message === 'Network Error') {
          // Error de red - problemas de conectividad
          setError('Error de conexión. Verifique su conexión a Internet e intente nuevamente.');
        } else {
          // Cualquier otro tipo de error
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
