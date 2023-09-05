import type { Bot } from '../bot'
import { wrapLogger } from '../logger'
import { readRoomConf } from './read'
import fs from 'fs'
import path from 'path'

/**
 * Loads configuration from a directory (and not in sub-directories).
 * In this directory, each files contains the configuration for one room.
 * File changes, addition, and deletion in this directory will be listened, and
 * the bot will automatically be reloaded.
 * This function returns a callback that can be called to stop listening file changes.
 * @param bot the bot
 * @param dir path to a directory
 * @param defaults the defaults values
 * @returns A callback function to call to stop listening file changes, or null if the folder does not exist.
 */
async function listenRoomConfDir (bot: Bot, dir: string): Promise<null | (() => void)> {
  const logger = wrapLogger('listenRoomConfDir', bot.logger)
  const delays = new Map<string, NodeJS.Timeout>()

  if (!fs.existsSync(dir)) {
    logger.error('The directory we want to listen for does not exists')
    return null
  }
  const stat = await fs.promises.stat(dir)
  if (!stat.isDirectory()) {
    logger.error('The path we want to listen for room configurations is not a directory')
    return null
  }

  const loadRoomConfFile = async (filepath: string): Promise<void> => {
    const stat = await fs.promises.stat(filepath)
    if (stat.isDirectory()) { return }
    const conf = await readRoomConf(filepath)
    if (conf) {
      await bot.loadRoomConf(conf)
    }
  }

  const w = fs.watch(dir, {
    persistent: false,
    recursive: false
  }, (event, filename) => {
    logger.debug('Change ' + event + ' on ' + filename)
    // de-bouncing by adding a 100ms delay.
    if (delays.has(filename)) { return }
    delays.set(filename, setTimeout(() => {
      delays.delete(filename)
      logger.debug('Handling change on ' + filename)

      loadRoomConfFile(filename).then(() => {}, () => {})
    }, 100))
  })

  // Now we must load all existing files
  logger.debug('Loading all existing conf files...')
  const files = await fs.promises.readdir(dir)
  for (const file of files) {
    const fp = path.resolve(dir, file)
    logger.debug('Loading file ' + fp)
    await loadRoomConfFile(fp)
  }

  return () => {
    w.close()
  }
}

export {
  listenRoomConfDir
}
