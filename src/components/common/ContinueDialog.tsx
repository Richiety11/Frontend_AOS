import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material';

interface ContinueDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
}

/**
 * Componente de diálogo para confirmar la continuación de una acción
 * @param {ContinueDialogProps} props - Propiedades del componente
 */
const ContinueDialog: React.FC<ContinueDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title = '¿Desea continuar?',
  message = '¿Desea continuar con la iteración?'
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="continue-dialog-title"
      aria-describedby="continue-dialog-description"
    >
      <DialogTitle id="continue-dialog-title">
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="continue-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancelar
        </Button>
        <Button onClick={onConfirm} color="primary" variant="contained" autoFocus>
          Continuar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ContinueDialog;