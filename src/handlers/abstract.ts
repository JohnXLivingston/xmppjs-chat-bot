import type { Room } from '../room'
import { Logger, wrapLogger } from '../logger'

abstract class Handler {
  public readonly logger: Logger

  constructor (
    protected readonly room: Room,
    options?: any
  ) {
    this.logger = wrapLogger(this.constructor.name, room.logger)
    this.loadOptions(options ?? {})
    this.room.attachHandler(this)
  }

  public abstract start (): void
  public abstract stop (): void
  public abstract loadOptions (options: any): void
}

type HandlerDerivedClass = new (room: Room, options: any) => Handler

export {
  Handler,
  HandlerDerivedClass
}
