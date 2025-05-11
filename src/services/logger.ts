/**
 * Definición de los niveles de log disponibles
 * debug: Para información detallada de desarrollo
 * info: Para información general del sistema
 * warn: Para advertencias que no son errores críticos
 * error: Para errores que requieren atención
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Interfaz que define la estructura de una entrada de log
 */
interface LogEntry {
  timestamp: string;  // Marca de tiempo ISO
  level: LogLevel;    // Nivel del log
  message: string;    // Mensaje principal
  data?: any;         // Datos adicionales opcionales
}

/**
 * Clase Logger implementada como Singleton para manejar los logs de la aplicación
 * Utiliza el patrón Singleton para asegurar una única instancia en toda la aplicación
 */
class Logger {
  private static instance: Logger;
  private isProduction = process.env.NODE_ENV === 'production';

  private constructor() {}

  /**
   * Obtiene la instancia única del logger
   * @returns La instancia del logger
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Formatea una entrada de log
   * @param level Nivel del log
   * @param message Mensaje a registrar
   * @param data Datos adicionales opcionales
   * @returns Entrada de log formateada
   */
  private formatLog(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
  }

  /**
   * Persiste una entrada de log según el entorno
   * En producción: guarda en localStorage (temporal, podría cambiarse a un servicio externo)
   * En desarrollo: muestra en consola con colores
   * @param logEntry Entrada de log a persistir
   */
  private persistLog(logEntry: LogEntry): void {
    if (this.isProduction) {
      // Almacenamiento de logs en producción
      const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
      logs.push(logEntry);
      // Mantener solo los últimos 100 logs para evitar saturar el localStorage
      localStorage.setItem('app_logs', JSON.stringify(logs.slice(-100)));
    }
    
    // Visualización de logs en desarrollo con colores
    if (!this.isProduction) {
      const color = {
        debug: '#7f8c8d', // Gris para debug
        info: '#2ecc71',  // Verde para info
        warn: '#f1c40f',  // Amarillo para advertencias
        error: '#e74c3c'  // Rojo para errores
      }[logEntry.level];

      console.log(
        `%c${logEntry.timestamp} [${logEntry.level.toUpperCase()}] ${logEntry.message}`,
        `color: ${color}`,
        logEntry.data || ''
      );
    }
  }

  /**
   * Registra un mensaje de nivel debug (solo en desarrollo)
   * @param message Mensaje a registrar
   * @param data Datos adicionales opcionales
   */
  debug(message: string, data?: any): void {
    if (!this.isProduction) {
      this.persistLog(this.formatLog('debug', message, data));
    }
  }

  /**
   * Registra un mensaje de nivel info
   * @param message Mensaje a registrar
   * @param data Datos adicionales opcionales
   */
  info(message: string, data?: any): void {
    this.persistLog(this.formatLog('info', message, data));
  }

  /**
   * Registra un mensaje de nivel warn
   * @param message Mensaje a registrar
   * @param data Datos adicionales opcionales
   */
  warn(message: string, data?: any): void {
    this.persistLog(this.formatLog('warn', message, data));
  }

  /**
   * Registra un mensaje de nivel error
   * @param message Mensaje a registrar
   * @param data Datos adicionales opcionales
   */
  error(message: string, data?: any): void {
    this.persistLog(this.formatLog('error', message, data));
  }

  /**
   * Obtiene todos los logs almacenados
   * @returns Array de entradas de log
   */
  getLogs(): LogEntry[] {
    return JSON.parse(localStorage.getItem('app_logs') || '[]');
  }

  /**
   * Limpia todos los logs almacenados
   */
  clearLogs(): void {
    localStorage.removeItem('app_logs');
  }
}

// Exportamos la instancia única del logger
export const logger = Logger.getInstance();