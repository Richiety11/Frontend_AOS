import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Container,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validaciones básicas del lado del cliente
      if (!formData.email.trim()) {
        setError('El correo electrónico es requerido');
        setLoading(false);
        return;
      }
      
      if (!formData.password) {
        setError('La contraseña es requerida');
        setLoading(false);
        return;
      }

      // Verificar longitud del email para evitar problemas de tamaño en headers
      if (formData.email.trim().length > 40) {
        setError('Por favor, use un correo electrónico más corto (máximo 40 caracteres)');
        setLoading(false);
        return;
      }
      
      // Validar formato de email con validación más estricta
      const emailRegex = /^[a-zA-Z0-9._%+-]{1,30}@[a-zA-Z0-9.-]{1,10}\.[a-zA-Z]{2,5}$/;
      if (!emailRegex.test(formData.email.trim())) {
        setError('Por favor, ingrese un correo electrónico válido con formato correcto');
        setLoading(false);
        return;
      }
      
      // Normalizar el email antes de enviarlo
      formData.email = formData.email.trim().toLowerCase();
      
      // Realizar el login con manejo de timeout
      const loginPromise = login({
        email: formData.email.trim().toLowerCase(),
        password: formData.password
      });
      
      // Establecer un timeout de 8 segundos
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tiempo de espera agotado')), 8000);
      });
      
      // Usar Promise.race para el timeout
      await Promise.race([loginPromise, timeoutPromise]);
      
      // Redireccionar - con pequeña pausa para asegurar que el token se almacene
      setTimeout(() => {
        // Verificar si hay una URL de redirección guardada
        const redirectUrl = localStorage.getItem('redirectAfterLogin');
        if (redirectUrl) {
          localStorage.removeItem('redirectAfterLogin'); // Limpiar después de usar
          navigate(redirectUrl);
        } else {
          // Siempre redirigir a la interfaz de citas, independientemente del rol del usuario
          navigate('/appointments');
        }
      }, 500); // Aumentar un poco el tiempo para asegurar
    } catch (err: any) {
      console.error("Error de inicio de sesión:", err);
      
      // Manejo específico para diferentes tipos de errores
      if (err.message === 'Tiempo de espera agotado') {
        setError('El servidor tarda en responder. Por favor, intente más tarde.');
      } else if (err.message === 'Network Error') {
        setError('No se puede conectar al servidor. Revise su conexión a internet.');
      } else if (err.response?.status === 401) {
        setError('Usuario o contraseña incorrectos.');
      } else if (err.response?.status === 429) {
        setError('Demasiados intentos fallidos. Por favor, intente más tarde.');
      } else if (err.response?.status === 431) {
        // Error específico para problemas con los headers
        setError('Error en la comunicación con el servidor. Intente con un correo más corto.');
      } else {
        // Mensaje de error genérico o personalizado desde el backend
        setError(err.response?.data?.message || err.message || 'Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Typography variant="h5" component="h1" gutterBottom align="center">
          Iniciar Sesión
        </Typography>

        {error && (
          <Box sx={{ mb: 2 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            sx={{ mt: 2 }}
            label="Correo Electrónico"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleChange}
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
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            sx={{ mt: 3 }}
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </Button>

          <Button
            fullWidth
            variant="text"
            sx={{ mt: 1 }}
            onClick={() => navigate('/register')}
          >
            ¿No tienes cuenta? Regístrate
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};