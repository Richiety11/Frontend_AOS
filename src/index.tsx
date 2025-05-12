/**
 * @file index.tsx
 * @description Punto de entrada principal de la aplicación React
 * Configura el renderizado del componente raíz y proporciona los proveedores necesarios
 * @author Equipo de Desarrollo
 * @version 1.0.0
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { StyledEngineProvider } from '@mui/material/styles';

/**
 * @constant root
 * @description Crea el punto de montaje de React en el DOM
 * Utiliza la API createRoot de React 18 para renderizado concurrente
 */
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

/**
 * @function render
 * @description Renderiza la aplicación React en el DOM
 * Utiliza React.StrictMode para detectar problemas potenciales durante el desarrollo
 * StyledEngineProvider permite la sobrescritura de estilos de Material-UI
 */
root.render(
  <React.StrictMode>
    <StyledEngineProvider injectFirst>
      <App />
    </StyledEngineProvider>
  </React.StrictMode>
);

/**
 * @function reportWebVitals
 * @description Inicializa la medición de métricas de rendimiento web
 * 
 * Recopila y reporta métricas web vitales como:
 * - FCP (First Contentful Paint): tiempo hasta que el navegador renderiza el primer contenido
 * - LCP (Largest Contentful Paint): tiempo hasta que se renderiza el elemento visible más grande
 * - FID (First Input Delay): tiempo que tarda en responder a la primera interacción
 * - CLS (Cumulative Layout Shift): medida de estabilidad visual
 * - TTFB (Time to First Byte): tiempo de respuesta inicial del servidor
 *
 * Para enviar métricas a un servicio de análisis, se puede modificar esta función
 * Por ejemplo: reportWebVitals(console.log) o reportWebVitals(sendToAnalytics)
 * @see https://bit.ly/CRA-vitals
 */
reportWebVitals();
