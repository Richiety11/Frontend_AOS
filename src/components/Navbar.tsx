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

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleClose();
  };

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