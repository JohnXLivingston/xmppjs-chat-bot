import type { Room, RoomMessage } from '../room'
import type { RoomUser } from '../user'
import type { Logger } from '../logger'
import { EventEmitter } from 'events'

export declare interface Handler {
  on: (
    ((event: 'room_joined', listener: (user: RoomUser) => void) => this) &
    ((event: 'room_parted', listener: (user: RoomUser) => void) => this) &
    ((event: 'room_message', listener: (message: RoomMessage) => void) => this)
  )
  emit: (
    ((event: 'room_joined', user: RoomUser) => boolean) &
    ((event: 'room_parted', user: RoomUser) => boolean) &
    ((event: 'room_message', message: RoomMessage) => boolean)
  )
}

export abstract class Handler extends EventEmitter {
  public readonly logger: Logger

  constructor (
    protected readonly room: Room
  ) {
    super()
    this.logger = room.logger
  }

  public abstract start (): this
  public abstract stop (): this
}
