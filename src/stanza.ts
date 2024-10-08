import type { Element } from '@xmpp/xml'
import { parse, JID } from '@xmpp/jid'

export type XMPPElementType = 'message' | 'iq' | 'presence'

abstract class Stanza {
  protected readonly xml: Element
  abstract readonly stanzaType: XMPPElementType
  readonly from: JID | null
  readonly to: JID | null
  readonly type: string | null

  constructor (xml: Element) {
    this.xml = xml

    this.from = xml.attrs.from ? parse(xml.attrs.from) : null
    this.to = xml.attrs.to ? parse(xml.attrs.to) : null
    this.type = xml.attrs.type ?? null
  }

  static parseIncoming (xml: Element): Stanza | null {
    switch (xml.name) {
      case 'message': return new MessageStanza(xml)
      case 'iq': return new IqStanza(xml)
      case 'presence': return new PresenceStanza(xml)
    }
    return null
  }

  public toString (): string {
    return JSON.stringify(this.dump())
  }

  public dump (): any {
    return {
      stanzaType: this.stanzaType,
      from: this.from?.toString(),
      to: this.to?.toString(),
      xml: this.xml.toString()
    }
  }
}

class MessageStanza extends Stanza {
  readonly stanzaType: XMPPElementType = 'message'

  /**
   * true if the message is delayed.
   * In other words: come from the muc history.
   */
  public isDelayed (): boolean {
    return !!this.xml.getChild('delay')
  }

  /**
   * Returns the message stanza-id, as defined by the MUC component.
   * See https://xmpp.org/extensions/xep-0359.html.
   * @returns The message id if present, null otherwise
   */
  public uniqueAndStableStanzaID (): string | null {
    return this.xml.getChild('stanza-id')?.attrs.id ?? null
  }

  /**
   * Returns the message occupant id, if available.
   */
  public occupantId (): string | null {
    return this.xml.getChild('occupant-id')?.attrs.id ?? null
  }

  /**
   * return the message body content as a string.
   */
  public body (): string | null {
    return this.xml.getChild('body')?.text() ?? null
  }

  /**
   * Indicate if one of these JIDs are mentionned in the message
   * @param jids one or many JID
   */
  public isMentionned (jids: JID[] | JID): boolean {
    if (!jids) { return false }
    if (!Array.isArray(jids)) {
      jids = [jids]
    }
    const jidsStrings = jids.map(jid => 'xmpp:' + jid.toString())

    const references = this.xml.getChildren('reference')
    for (const reference of references) {
      if (reference.attrs.type !== 'mention') { continue }
      if (jidsStrings.includes(reference.attrs.uri)) {
        return true
      }
      // Note: it seems that the nicknames can be html-encoded in reference.attrs.uri, and not in jid.toString().
      // So we must also check this:
      if (jidsStrings.includes(decodeURI(reference.attrs.uri))) {
        return true
      }
    }
    return false
  }
}

class IqStanza extends Stanza {
  readonly stanzaType: XMPPElementType = 'iq'
}

class PresenceStanza extends Stanza {
  readonly stanzaType: XMPPElementType = 'presence'
  private readonly _isMe: boolean
  private readonly _Role: string | undefined
  private readonly _Affiliation: string | undefined
  private readonly _IsNickNameChange: boolean = false
  private readonly _NewNickname: string | undefined

  constructor (xml: Element) {
    super(xml)

    const xElems = this.xml.getChildren('x')
    for (const x of xElems) {
      const statusElems = x.getChildren('status')
      for (const status of statusElems) {
        if (status.attrs.code === '110') {
          this._isMe = true
        }
        if (status.attrs.code === '303') {
          this._IsNickNameChange = true
        }
      }
      const itemsElems = x.getChildren('item')
      for (const item of itemsElems) {
        if (item.attrs.role) {
          this._Role = item.attrs.role
        }
        if (item.attrs.affiliation) {
          this._Affiliation = item.attrs.affiliation
        }
        if (this._IsNickNameChange && item.attrs.nick) {
          this._NewNickname = item.attrs.nick
        }
      }
    }
    this._isMe ??= false
  }

  /**
   * returns true if this presence stanza if for the current user.
   */
  public isMe (): boolean {
    return this._isMe
  }

  /**
   * If a role is in the stanza, returns it.
   * @returns the role or undefined
   */
  public role (): string | undefined {
    return this._Role
  }

  /**
   * If an affiliation is in the stanza, returns it.
   * @returns the affilation or undefined
   */
  public affiliation (): string | undefined {
    return this._Affiliation
  }

  /**
   * Indicate if the presence stanza is a nickname change.
   * If yes, returns the new nickname.
   * Else returns false.
   */
  public isNickNameChange (): string | false {
    if (!this._IsNickNameChange || this._NewNickname === undefined) {
      return false
    }
    return this._NewNickname
  }
}

export {
  Stanza,
  MessageStanza,
  IqStanza,
  PresenceStanza
}
