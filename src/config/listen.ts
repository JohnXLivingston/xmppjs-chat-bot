import { Logger, wrapLogger } from '../logger'
import { readRoomConf, RoomConf } from './read'
import fs from 'fs'
import path from 'path'

/**
 * Loads configuration from a directory (and not in sub-directories).
 * In this directory, each files should contains the configuration for one room.
 * File changes, addition, and deletion in this directory will be listened, and
 * the callback will automatically be called on any change, so that the bot can reload.
 * This function returns a callback that can be called to stop listening file changes.
 * Please note that the callback will also be called for each already existing files.
 * Filenames must end with '.json'.
 * @param bot the bot
 * @param dir path to a directory
 * @param callback the callback to call when there is a file change
 * @returns A callback function to call to stop listening file changes, or null if the folder does not exist.
 */
async function listenRoomConfDir (
  logger: Logger,
  dir: string,
  callback: (conf: RoomConf) => Promise<void>
): Promise<null | (() => void)> {
  logger = wrapLogger('listenRoomConfDir', logger)
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
    if (!filepath.endsWith('.json')) {
      logger.debug('Ignoring file ' + filepath + ', is not a .json file.')
      return
    }
    const stat = await fs.promises.stat(filepath)
    if (stat.isDirectory()) {
      logger.error(filepath + ' is a directory, can`t load as file')
      return
    }
    const conf = await readRoomConf(filepath, logger)
    if (conf) {
      logger.debug('Conf readed, we can call the callback')
      await callback(conf)
    } else {
      logger.error('Can\'t load ' + filepath + ' , seems not valid')
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

      const filepath = path.resolve(dir, filename)
      loadRoomConfFile(filepath).then(
        () => {
          logger.debug('New Conf loaded')
        },
        (err) => {
          logger.error(err ?? 'Failed loading new conf')
        })
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
