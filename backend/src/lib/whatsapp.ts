import { config } from '../config'
import { logger } from './logger'
import { normalizePhoneNumber } from './auth'
import { appSettingsRepository } from '../db/repositories/appSettings'

let connectionState: 'disconnected' | 'connecting' | 'connected' | 'pairing' = 'disconnected'
let qrCode: string | null = null
let pairingCode: string | null = null

// Simulating WhatsApp provider or prepared for Baileys/Business API
export async function initializeWhatsApp(): Promise<void> {
  connectionState = 'connected'
  appSettingsRepository.setWhatsAppConnected(true)
  logger.info('WhatsApp service initialized (Ready for notifications)')
}

export async function sendMessage(to: string, message: string): Promise<boolean> {
  const normalizedTo = normalizePhoneNumber(to)
  logger.info({ to: normalizedTo, messageLength: message.length }, 'Simulated WhatsApp message sent')
  return true
}

export function getConnectionState(): typeof connectionState {
  return connectionState
}

export function getQRCode(): string | null {
  return qrCode
}

export function getPairingCode(): string | null {
  return pairingCode
}

export async function requestPairingCode(phoneNumber: string): Promise<string | null> {
  pairingCode = 'TR-' + Math.floor(100000 + Math.random() * 900000)
  return pairingCode
}

export async function logoutWhatsApp(): Promise<void> {
  connectionState = 'disconnected'
  appSettingsRepository.setWhatsAppConnected(false)
}