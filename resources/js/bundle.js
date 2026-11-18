// The built chat this package serves (dist/aparte.js): the package's script, with the chat's own
// words in the languages aparté speaks. An app that builds the chat with its own Vite imports
// aparte.js instead, and adds the languages with useLocales() if it wants them.
import * as locales from '@aparte/locales';
import { useLocales } from './aparte.js';

useLocales(locales);

export * from './aparte.js';
