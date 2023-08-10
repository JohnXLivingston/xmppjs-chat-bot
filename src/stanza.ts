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
   * return the message body as a string.
   */
  public body (): string | null {
    return this.xml.getChild('body')?.toString() ?? null
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
    }
    return false
  }
}

class IqStanza extends Stanza {
  readonly stanzaType: XMPPElementType = 'iq'
}

class PresenceStanza extends Stanza {
  readonly stanzaType: XMPPElementType = 'presence'

  /**
   * returns true if this presence stanza if for the current user.
   */
  public isMe (): boolean {
    const xElems = this.xml.getChildren('x')
    for (const x of xElems) {
      const statusElems = x.getChildren('status')
      for (const status of statusElems) {
        if (status.attrs.code === '110') {
          return true
        }
      }
    }
    return false
  }
}

export {
  Stanza,
  MessageStanza,
  IqStanza,
  PresenceStanza
}
