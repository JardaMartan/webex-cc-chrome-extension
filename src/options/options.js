import React from 'react';
import { createRoot } from 'react-dom/client';
import css from './options.css';
import { injectCss } from '../shared/injectCss.js';
import OptionsApp from './OptionsApp.jsx';

injectCss(document.head, css, 'ccc-options-css');
createRoot(document.getElementById('root')).render(<OptionsApp />);
