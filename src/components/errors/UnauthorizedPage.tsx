import React from 'react';
import { Container, Paper, Typography, Button, Box } from '@mui/material';
import { LockOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleRedirect = () => {
    if (user) {
      navigate('/');
    } else {
      navigate('/login');
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 8, textAlign: 'center' }}>
        <Box sx={{ mb: 3 }}>
          <LockOutlined sx={{ fontSize: 60, color: 'error.main' }} />
        </Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Acceso No Autorizado
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          No tienes permisos para acceder a esta página. Por favor, verifica tus credenciales o contacta al administrador.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={handleRedirect}
          sx={{ mt: 2 }}
        >
          {user ? 'Ir al Inicio' : 'Iniciar Sesión'}
        </Button>
      </Paper>
    </Container>
  );
};