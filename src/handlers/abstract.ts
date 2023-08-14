import type { Room } from '../room'
import { Logger, wrapLogger } from '../logger'

export abstract class Handler {
  public readonly logger: Logger

  constructor (
    protected readonly room: Room
  ) {
    this.logger = wrapLogger(this.constructor.name, room.logger)
    this.room.attachHandler(this)
  }

  public abstract start (): void
  public abstract stop (): void
}
