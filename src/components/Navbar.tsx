/**
 * @file Navbar.tsx
 * @description Barra de navegación principal de la aplicación
 * Implementa una interfaz adaptativa que muestra diferentes opciones según
 * el rol del usuario, el estado de autenticación y el tamaño de pantalla
 * @author Equipo de Desarrollo
 * @version 1.5.0
 */

import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Menu,
  MenuItem,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle,
  EventNote,
  Schedule,
  ExitToApp,
  Person,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * @component Navbar
 * @description Barra de navegación responsiva que adapta su presentación según
 * el tipo de dispositivo y rol del usuario. Incluye menú lateral para móviles
 * y menú desplegable para escritorio.
 * @returns {JSX.Element} Componente de navegación principal
 */
export const Navbar: React.FC = () => {
  // Hooks para acceder al contexto de autenticación y navegación
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Estados para control de menús
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  /**
   * @function handleMenu
   * @description Gestiona la apertura del menú desplegable
   * @param {React.MouseEvent<HTMLElement>} event - Evento de click que desencadena la acción
   */
  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  /**
   * @function handleClose
   * @description Cierra el menú desplegable
   */
  const handleClose = () => {
    setAnchorEl(null);
  };

  /**
   * @function handleDrawerToggle
   * @description Alterna la visibilidad del menú lateral en dispositivos móviles
   */
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  /**
   * @function handleLogout
   * @description Cierra la sesión del usuario y redirecciona a la página de login
   */
  const handleLogout = () => {
    logout();
    navigate('/login');
    handleClose();
  };

  /**
   * @constant menuItems
   * @description Define las opciones de navegación disponibles con sus respectivos iconos,
   * rutas de destino y roles de usuario que pueden acceder a ellas
   */
  const menuItems = [
    {
      text: 'Mis Citas',
      icon: <EventNote />,
      onClick: () => navigate('/appointments'),
      roles: ['patient', 'doctor'],
    },
    {
      text: 'Gestionar Disponibilidad',
      icon: <Schedule />,
      onClick: () => navigate('/availability'),
      roles: ['doctor'],
    },
  ];

  /**
   * @constant filteredMenuItems
   * @description Filtra las opciones de menú según el rol del usuario actual
   * Solo muestra las opciones que corresponden al rol del usuario o las que no tienen restricción
   */
  const filteredMenuItems = menuItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  const drawer = (
    <Box sx={{ width: 250 }} role="presentation">
      {user ? (
        <>
          <Box sx={{ p: 2, bgcolor: 'background.default' }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <AccountCircle fontSize="large" color="primary" />
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" noWrap>
                  {user.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {user.email}
                </Typography>
                <Typography variant="caption" color="primary" sx={{ display: 'block' }}>
                  {user.role === 'doctor' ? 'Médico' : 'Paciente'}
                </Typography>
              </Box>
            </Box>
          </Box>
          <Divider />
          <List>
            {filteredMenuItems.map((item) => (
              <ListItem
                button
                key={item.text}
                onClick={() => {
                  item.onClick();
                  setMobileOpen(false);
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}
            <ListItem button onClick={handleLogout}>
              <ListItemIcon>
                <ExitToApp />
              </ListItemIcon>
              <ListItemText primary="Cerrar Sesión" />
            </ListItem>
          </List>
        </>
      ) : (
        <List>
          <ListItem button onClick={() => navigate('/login')}>
            <ListItemIcon>
              <Person />
            </ListItemIcon>
            <ListItemText primary="Iniciar Sesión" />
          </ListItem>
        </List>
      )}
    </Box>
  );

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="abrir menú"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            Sistema de Citas Médicas
          </Typography>

          {!isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {user ? (
                <>
                  {filteredMenuItems.map((item) => (
                    <Button
                      key={item.text}
                      color="inherit"
                      startIcon={item.icon}
                      onClick={item.onClick}
                      sx={{ ml: 1 }}
                    >
                      {item.text}
                    </Button>
                  ))}
                  <IconButton
                    size="large"
                    aria-label={`cuenta de ${user.name}`}
                    aria-controls="menu-appbar"
                    aria-haspopup="true"
                    onClick={handleMenu}
                    color="inherit"
                    title={`Hola, ${user.name}`}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      }
                    }}
                  >
                    <AccountCircle />
                  </IconButton>
                  <Menu
                    id="menu-appbar"
                    anchorEl={anchorEl}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'right',
                    }}
                    keepMounted
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    open={Boolean(anchorEl)}
                    onClose={handleClose}
                  >
                    <MenuItem disabled>
                      <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight="bold">{user.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                        <Typography variant="caption" color="primary">
                          {user.role === 'doctor' ? 'Médico' : 'Paciente'}
                        </Typography>
                      </Box>
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={handleLogout}>Cerrar Sesión</MenuItem>
                  </Menu>
                </>
              ) : (
                <Button color="inherit" onClick={() => navigate('/login')}>
                  Iniciar Sesión
                </Button>
              )}
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Mejor rendimiento en móviles
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
};