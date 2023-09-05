import type { Room } from '../room'
import { Logger, wrapLogger } from '../logger'

abstract class Handler {
  public readonly id: string
  protected readonly room: Room
  public readonly logger: Logger

  constructor (
    id: string,
    room: Room,
    options?: any
  ) {
    this.id = id
    this.room = room
    this.logger = wrapLogger(this.constructor.name, room.logger)
    this.loadOptions(options ?? {})
    this.room.attachHandler(this)
  }

  public abstract start (): void
  public abstract stop (): void
  public abstract loadOptions (options: any): void
}

type HandlerDerivedClass = new (id: string, room: Room, options: any) => Handler

export {
  Handler,
  HandlerDerivedClass
}
