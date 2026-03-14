import { db } from '../index'

/**
 * Test Firestore database connection
 * @returns Promise<boolean> - true if connection successful, false if failed
 */
export async function testFirestoreConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('Testing Firestore connection...')
    
    // Simple connection test - try to get a document that likely doesn't exist
    await db.collection('_connection_test').doc('test').get()
    
    console.log('Firestore connection successful')
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown connection error'
    console.error('Firestore connection failed:', error)
    return { 
      success: false, 
      error: errorMessage 
    }
  }
}

/**
 * Test Firestore connection and throw if failed
 * @throws Error if connection fails
 */
export async function ensureFirestoreConnection(): Promise<void> {
  const result = await testFirestoreConnection()
  if (!result.success) {
    throw new Error(`Database connection failed: ${result.error}`)
  }
} 