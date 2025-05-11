import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Container,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { RegisterData } from '../../types';

export const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<RegisterData>({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phoneNumber: '',
    role: 'patient',
    speciality: '',
    licenseNumber: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Validación de correo electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Ingresa un correo electrónico válido';
    }

    // Validación de contraseña
    if (formData.password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])/.test(formData.password)) {
      newErrors.password = 'La contraseña debe contener mayúsculas, minúsculas, números y caracteres especiales';
    }

    // Validación de confirmación de contraseña
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    // Validación de teléfono
    const phoneRegex = /^\+?[0-9]{10,12}$/;
    if (!phoneRegex.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Ingresa un número de teléfono válido (10-12 dígitos)';
    }

    // Validaciones específicas para médicos
    if (formData.role === 'doctor') {
      if (!formData.speciality) {
        newErrors.speciality = 'La especialidad es requerida';
      }
      if (!formData.licenseNumber) {
        newErrors.licenseNumber = 'El número de licencia es requerido';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTextFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Verificar si el email no es demasiado largo para evitar errores 431
      if (formData.email.length > 50) {
        setError('Por favor, use un correo electrónico más corto (máximo 50 caracteres)');
        setLoading(false);
        return;
      }

      // Eliminar campos innecesarios y preparar datos para registro
      const { confirmPassword, ...registerData } = formData;
      
      // Configurar un timeout para la operación
      const registerPromise = register(registerData);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tiempo de espera agotado')), 10000);
      });
      
      // Ejecutar registro con timeout
      await Promise.race([registerPromise, timeoutPromise]);
      
      // Redireccionar tras éxito con pequeña pausa para asegurar almacenamiento del token
      setTimeout(() => {
        navigate('/appointments');
      }, 300);
    } catch (err: any) {
      console.error("Error de registro:", err);
      
      // Manejo específico para diferentes tipos de errores
      if (err.message === 'Tiempo de espera agotado') {
        setError('El servidor tarda en responder. Por favor, intente más tarde.');
      } else if (err.message === 'Network Error') {
        setError('No se puede conectar al servidor. Revise su conexión a internet.');
      } else if (err.response?.status === 409) {
        setError('El correo electrónico ya está registrado.');
      } else if (err.response?.status === 431) {
        setError('Error en la comunicación con el servidor. Intente con un correo más corto.');
      } else {
        // Mensaje de error desde el backend o genérico
        setError(err.response?.data?.message || err.message || 'Error al registrarse');
      }
    } finally {
      setLoading(false);
    }
  };

    const handleChange = (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent
    ) => {
        const { name, value } = event.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <form onSubmit={handleSubmit}>
          <Typography variant="h5" component="h1" gutterBottom align="center">
            Registro
          </Typography>

          {error && (
            <Box sx={{ mb: 2 }}>
              <Typography color="error">{error}</Typography>
            </Box>
          )}

          <TextField
            fullWidth
            sx={{ mt: 2 }}
            label="Nombre Completo"
            name="name"
            required
            value={formData.name}
            onChange={handleTextFieldChange}
            error={!!errors.name}
            helperText={errors.name}
          />

          <TextField
            fullWidth
            sx={{ mt: 2 }}
            label="Correo Electrónico"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleChange}
            error={!!errors.email}
            helperText={errors.email}
          />

          <TextField
            fullWidth
            sx={{ mt: 2 }}
            label="Contraseña"
            name="password"
            type="password"
            required
            value={formData.password}
            onChange={handleChange}
            error={!!errors.password}
            helperText={errors.password}
          />

          <TextField
            fullWidth
            sx={{ mt: 2 }}
            label="Confirmar Contraseña"
            name="confirmPassword"
            type="password"
            required
            value={formData.confirmPassword}
            onChange={handleChange}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
          />

          <TextField
            fullWidth
            sx={{ mt: 2 }}
            label="Teléfono"
            name="phoneNumber"
            required
            value={formData.phoneNumber}
            onChange={handleChange}
            error={!!errors.phoneNumber}
            helperText={errors.phoneNumber}
          />

          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="role-label">Tipo de Usuario</InputLabel>
            <Select
              labelId="role-label"
              value={formData.role || 'patient'}
              label="Tipo de Usuario"
              onChange={(e) => {
                setFormData({
                  ...formData,
                  role: e.target.value as 'patient' | 'doctor'
                });
              }}
            >
              <MenuItem value="patient">Paciente</MenuItem>
              <MenuItem value="doctor">Médico</MenuItem>
            </Select>
          </FormControl>

          {formData.role === 'doctor' && (
            <>
              <TextField
                fullWidth
                sx={{ mt: 2 }}
                label="Especialidad"
                name="speciality"
                required
                value={formData.speciality}
                onChange={handleChange}
                error={!!errors.speciality}
                helperText={errors.speciality}
              />

              <TextField
                fullWidth
                sx={{ mt: 2 }}
                label="Número de Licencia"
                name="licenseNumber"
                required
                value={formData.licenseNumber}
                onChange={handleChange}
                error={!!errors.licenseNumber}
                helperText={errors.licenseNumber}
              />
            </>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            sx={{ mt: 3 }}
            disabled={loading}
          >
            {loading ? 'Registrando...' : 'Registrarse'}
          </Button>

          <Button
            fullWidth
            variant="text"
            sx={{ mt: 1 }}
            onClick={() => navigate('/login')}
          >
            ¿Ya tienes cuenta? Inicia sesión
          </Button>
        </form>
      </Paper>
    </Container>
  );
};