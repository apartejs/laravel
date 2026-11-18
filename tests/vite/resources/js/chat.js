// The README's example, word for word.
import { onAparteSetup, useLocales } from '../../vendor/apartejs/laravel/resources/js/aparte.js';
import 'katex/dist/katex.min.css';
import { setupKatex } from '@aparte/plugin-katex';
import * as locales from '@aparte/locales';

onAparteSetup((config) => setupKatex({}, config));
useLocales(locales);
