# Changelog

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
