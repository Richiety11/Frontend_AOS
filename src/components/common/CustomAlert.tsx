import React from 'react';
import { 
  Alert as MuiAlert,
  AlertProps as MuiAlertProps,
  Typography
} from '@mui/material';

interface CustomAlertProps extends Omit<MuiAlertProps, 'children'> {
  message: string;
}

// Componente de alerta personalizado que resuelve los problemas de TypeScript
const CustomAlert: React.FC<CustomAlertProps> = ({ message, ...props }) => {
  return (
    <MuiAlert {...props}>
      <Typography>{message}</Typography>
    </MuiAlert>
  );
};

export default CustomAlert;
