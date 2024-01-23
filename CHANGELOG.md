# Changelog

## ??? (Not Released Yet)

* Handling nickname changes (first experimental version). New room_nickname_changed event.
* Exporting NickNameChangeHandler.
* New room_roster_initialized event.

## 0.2.10

* Fix NPM build

## 0.2.9

* Room: new getOnlineUsers method.
* npm dependencies security updates.

## 0.2.8

* Moderate handler: string regexp are made case insensitive (/i modifier).

## 0.2.7

* Fix moderate handler applyToModerators option on startup.

## 0.2.6

* Moderate handler: option to also apply to moderators.

## 0.2.5

* Fix message moderation, when not used as a component.

## 0.2.4

* Fix CLI exit.

## 0.2.3

* Fix the CLI connection process.
* Adding bot.waitOnline() method.

## 0.2.2

* Fix missing exported type Config.

## 0.2.1

* Fix bad type import syntax, that breaks some builds.

## 0.2.0

* Breaking change: Quotes delay are now in seconds.
* Breaking change: Renaming global option `debug` to `xmpp_debug`.
* Fix: only load and listen for filenames ending with '.json', to ignore VIM temporary files.
* Fix: missing exported TS types

## 0.1.0

* Complete rewrite of the bot.
