import readline from 'node:readline/promises'
import { createUser } from '../src/services/user-service.js'
import { db } from '../src/db/connection.js'
import { migrate } from '../src/db/migrate.js'

function hiddenQuestion(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    const stdout = process.stdout
    const ttyStdin = stdin as NodeJS.TtyReadStream
    const wasRaw = ttyStdin.isRaw

    stdout.write(query)
    if (ttyStdin.isTTY) {
      ttyStdin.setRawMode(true)
    }
    stdin.resume()

    const chunks: Buffer[] = []

    function cleanup() {
      stdin.removeListener('data', onData)
      if (ttyStdin.isTTY) {
        ttyStdin.setRawMode(!!wasRaw)
      }
      stdout.write('\n')
    }

    function onData(chunk: Buffer | string) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8')
      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i]
        if (char === 0x0d || char === 0x0a) {
          cleanup()
          resolve(Buffer.concat(chunks).toString('utf8'))
          return
        }
        if (char === 0x03) {
          cleanup()
          reject(new Error('Interrupted'))
          return
        }
        if (char === 0x04) {
          cleanup()
          resolve(Buffer.concat(chunks).toString('utf8'))
          return
        }
        if (char === 0x7f || char === 0x08) {
          chunks.pop()
          continue
        }
        chunks.push(Buffer.from([char]))
      }
    }

    stdin.on('data', onData)
  })
}

async function main() {
  let rl: readline.Interface | undefined
  try {
    migrate()
    rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const username = await rl.question('Username: ')
    rl.close()
    rl = undefined
    const password = await hiddenQuestion('Password: ')
    await createUser(username, password)
    console.log('Admin created')
  } catch (err) {
    console.error(err)
    process.exitCode = 1
  } finally {
    rl?.close()
    db.close()
  }
}

main()
