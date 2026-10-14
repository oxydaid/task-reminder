import pino from 'pino'
import { config } from '../config'

const isProduction = config.nodeEnv === 'production'

export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  transport: isProduction ? undefined : {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  },
  redact: {
    paths: [
      '*.password',
      '*.password_hash',
      '*.token',
      '*.session',
      '*.secret',
      '*.code',
      '*.code_hash',
      '*.whatsapp_number',
      'req.headers.authorization',
      'req.headers.cookie'
    ],
    censor: '[REDACTED]'
  }
})

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings)
}