# Changelog

## 0.7.0

* **BREAKING CHANGE:** Cancelling the use of RE2 RegExp.

It appears that node-re2 fails to install properly on some environments.
So we cancel the use of node-re2, and project using this chatbot are supposed to only allow regexp from trusted users
to avoid ReDOS attacks.

## 0.6.0

* Using RE2 RegExp engine to protect against ReDOS attacks. Regular RegExp object is still available using an option.
* Updating npm dependencies.

## 0.5.0

* New No-Duplicate handler, to prevent users from sending duplicate messages.
* Fix Quotes handler when passing undefined as delay.
* Fix Quotes handler delay refresh condition.

## 0.4.0

* New CLI option to load handlers by file path.
* New 'modifiers' option for Moderate handler regular expressions.
* Update dependencies.

## 0.3.0

* Handling nickname changes (first experimental version). New room_nickname_changed event.
* Exporting NickNameChangeHandler.
* New room_roster_initialized event.
* Fix room_joined event.

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
