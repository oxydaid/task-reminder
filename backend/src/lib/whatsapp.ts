import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  type WASocket
} from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import pino from 'pino'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { config } from '../config'
import { logger } from './logger'
import { normalizePhoneNumber } from './auth'
import { appSettingsRepository } from '../db/repositories/appSettings'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

let sock: WASocket | null = null
let connectionState: ConnectionStatus = 'disconnected'
let qrCodeDataUrl: string | null = null
let botNumber: string | null = null
let isInitializing = false
let reconnectTimeout: NodeJS.Timeout | null = null

// Resolvers waiting for QR code generation
const qrResolvers: Array<(qr: string | null) => void> = []

// Message queue mutex to prevent race conditions during message dispatch
const messageQueue: Array<() => Promise<void>> = []
let isProcessingQueue = false

async function processQueue() {
  if (isProcessingQueue) return
  isProcessingQueue = true

  while (messageQueue.length > 0) {
    const job = messageQueue.shift()
    if (job) {
      try {
        await job()
      } catch (err) {
        logger.error({ err }, 'Error executing WhatsApp message queue job')
      }
      // Delay 1.2s between messages to avoid WhatsApp rate limit & socket write race conditions
      await new Promise(r => setTimeout(r, 1200))
    }
  }

  isProcessingQueue = false
}

// Credential save lock to prevent corrupted concurrent writes
let saveCredsQueue: Promise<void> = Promise.resolve()

function safeSaveCreds(saveFn: () => Promise<void>) {
  saveCredsQueue = saveCredsQueue.then(async () => {
    try {
      await saveFn()
    } catch (err) {
      logger.error({ err }, 'Failed to save WhatsApp credentials to disk')
    }
  })
  return saveCredsQueue
}

export function hasSavedSession(): boolean {
  try {
    const credsPath = join(config.whatsappAuthDir, 'creds.json')
    return existsSync(credsPath)
  } catch {
    return false
  }
}

export async function initializeWhatsApp(forceNew = false): Promise<void> {
  // If no saved session exists and not explicitly requested via Web QR button, do not spin up
  if (!forceNew && !hasSavedSession()) {
    logger.debug('No saved WhatsApp credentials. Skipping auto-initialization until requested.')
    connectionState = 'disconnected'
    qrCodeDataUrl = null
    return
  }

  if (isInitializing && !forceNew) {
    logger.debug('WhatsApp initialization already in progress, skipping duplicate call')
    return
  }

  isInitializing = true
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }

  try {
    // 1. Ensure auth storage directory exists
    if (!existsSync(config.whatsappAuthDir)) {
      mkdirSync(config.whatsappAuthDir, { recursive: true })
    }

    // 2. Load auth state with caching to prevent I/O bottlenecks
    const { state, saveCreds } = await useMultiFileAuthState(config.whatsappAuthDir)

    // 3. Fetch latest WhatsApp Web version with safe fallback
    let version: [number, number, number] = [2, 3000, 1015901307]
    try {
      const v = await fetchLatestBaileysVersion()
      if (v?.version) {
        version = v.version
      }
    } catch (err) {
      logger.warn('Using fallback WhatsApp Web protocol version')
    }

    // 4. Safely clean up previous socket if any exists
    if (sock) {
      try {
        sock.ev.removeAllListeners('connection.update')
        sock.ev.removeAllListeners('creds.update')
        sock.end(undefined)
      } catch {}
      sock = null
    }

    // 5. Create new Baileys socket with standardized browser signature & timeout settings
    const pinoSilent = pino({ level: 'silent' })
    sock = makeWASocket({
      version,
      logger: pinoSilent,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pinoSilent)
      },
      browser: Browsers.ubuntu('Chrome'),
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
      syncFullHistory: false,
      markOnlineOnConnect: true
    })

    // Listen to credentials update with sequential write lock
    sock.ev.on('creds.update', () => {
      safeSaveCreds(saveCreds)
    })

    // Listen to connection lifecycle events
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      // Handle QR code generation
      if (qr) {
        connectionState = 'connecting'
        try {
          qrCodeDataUrl = await QRCode.toDataURL(qr, { scale: 8, margin: 2 })
          logger.info('New WhatsApp QR Code generated, waiting for scan via Web')

          // Notify any waiting HTTP requests
          while (qrResolvers.length > 0) {
            const resolver = qrResolvers.shift()
            if (resolver) resolver(qrCodeDataUrl)
          }
        } catch (err) {
          logger.error({ err }, 'Failed to convert QR code to data URL')
        }
      }

      // Handle successful connection
      if (connection === 'open') {
        connectionState = 'connected'
        qrCodeDataUrl = null
        botNumber = sock?.user?.id ? sock.user.id.split(':')[0].split('@')[0] : null
        appSettingsRepository.setWhatsAppConnected(true)
        logger.info({ botNumber }, 'WhatsApp Baileys client connected successfully')

        while (qrResolvers.length > 0) {
          const resolver = qrResolvers.shift()
          if (resolver) resolver(null)
        }
      }

      // Handle connection close / error
      if (connection === 'close') {
        while (qrResolvers.length > 0) {
          const resolver = qrResolvers.shift()
          if (resolver) resolver(null)
        }

        const error = lastDisconnect?.error as any
        const statusCode = error?.output?.statusCode
        const isLoggedOut = statusCode === DisconnectReason.loggedOut
        const isRestartRequired = statusCode === DisconnectReason.restartRequired

        connectionState = 'disconnected'
        appSettingsRepository.setWhatsAppConnected(false)
        logger.warn({ statusCode, isRestartRequired, isLoggedOut }, 'WhatsApp connection closed')

        if (isRestartRequired) {
          // Restart immediately after QR scan / handshake without wiping session creds
          logger.info('WhatsApp requires restart after initial handshake, reconnecting immediately...')
          isInitializing = false
          initializeWhatsApp(true)
        } else if (isLoggedOut) {
          // User logged out from WhatsApp mobile -> wipe saved session files and wait for user to request new QR
          logger.warn('WhatsApp session logged out from device. Resetting credentials.')
          qrCodeDataUrl = null
          botNumber = null
          try {
            if (existsSync(config.whatsappAuthDir)) {
              rmSync(config.whatsappAuthDir, { recursive: true, force: true })
            }
          } catch (e) {
            logger.error({ e }, 'Failed to delete old auth directory')
          }
          isInitializing = false
        } else if (statusCode === DisconnectReason.connectionReplaced) {
          logger.warn('WhatsApp connection replaced by another session. Halting automatic reconnect.')
          isInitializing = false
        } else if (hasSavedSession()) {
          // Disconnected due to network timeout but session exists -> reconnect with backoff
          logger.info('Transient WhatsApp disconnect. Reconnecting in 4 seconds...')
          isInitializing = false
          reconnectTimeout = setTimeout(() => initializeWhatsApp(), 4000)
        } else {
          isInitializing = false
        }
      }
    })
  } catch (err) {
    logger.error({ err }, 'Failed to initialize WhatsApp Baileys')
    connectionState = 'disconnected'
  } finally {
    isInitializing = false
  }
}

export async function requestQRCode(): Promise<{ status: ConnectionStatus; qrCode: string | null; botNumber: string | null }> {
  // If already connected, return connected status
  if (connectionState === 'connected') {
    return { status: 'connected', qrCode: null, botNumber }
  }

  // Force socket recreation to generate a fresh QR code
  qrCodeDataUrl = null
  connectionState = 'connecting'

  const qrPromise = new Promise<string | null>((resolve) => {
    const timeout = setTimeout(() => {
      resolve(qrCodeDataUrl)
    }, 20_000)

    qrResolvers.push((qr) => {
      clearTimeout(timeout)
      resolve(qr)
    })
  })

  // Start initialization explicitly with forceNew = true
  initializeWhatsApp(true).catch(err => {
    logger.error({ err }, 'Error during WhatsApp QR request')
  })

  const generated = await qrPromise

  return {
    status: connectionState,
    qrCode: generated || qrCodeDataUrl,
    botNumber
  }
}

export async function sendMessage(to: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    messageQueue.push(async () => {
      if (!sock || connectionState !== 'connected') {
        logger.warn({ to }, 'Cannot send message: WhatsApp bot is not connected')
        resolve(false)
        return
      }

      try {
        const normalized = normalizePhoneNumber(to)
        const jid = `${normalized}@s.whatsapp.net`
        await sock.sendMessage(jid, { text: message })
        logger.info({ to: normalized, length: message.length }, 'WhatsApp notification message sent successfully')
        resolve(true)
      } catch (err) {
        logger.error({ err, to }, 'Failed to send WhatsApp message via Baileys')
        resolve(false)
      }
    })

    processQueue().catch((err) => {
      logger.error({ err }, 'Error in message queue processing')
    })
  })
}

export function getConnectionState(): ConnectionStatus {
  return connectionState
}

export function getQRCode(): string | null {
  return qrCodeDataUrl
}

export function getBotNumber(): string | null {
  return botNumber
}

export async function logoutWhatsApp(): Promise<void> {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }

  try {
    if (sock) {
      await sock.logout().catch(() => {})
      try {
        sock.ev.removeAllListeners('connection.update')
        sock.ev.removeAllListeners('creds.update')
        sock.end(undefined)
      } catch {}
      sock = null
    }

    connectionState = 'disconnected'
    qrCodeDataUrl = null
    botNumber = null
    appSettingsRepository.setWhatsAppConnected(false)

    if (existsSync(config.whatsappAuthDir)) {
      rmSync(config.whatsappAuthDir, { recursive: true, force: true })
    }

    logger.info('WhatsApp session logged out and cleaned up')
  } catch (error) {
    logger.error({ error }, 'Error during WhatsApp logout')
  }
}

export async function restartWhatsApp(): Promise<void> {
  await logoutWhatsApp()
  await requestQRCode()
}
