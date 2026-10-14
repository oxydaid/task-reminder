import { initializeDatabase, closeDatabase } from './index'
import { config } from '../config'

console.log('Running database migrations...')
console.log(`Database path: ${config.databasePath}`)

try {
  initializeDatabase()
  console.log('Database migrations completed successfully')
} catch (error) {
  console.error('Migration failed:', error)
  process.exit(1)
} finally {
  closeDatabase()
}