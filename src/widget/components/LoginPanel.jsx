import React from 'react';
import Button from '../ui/Button.jsx';
import Spinner from '../ui/Spinner.jsx';
import { useDispatch, useSelector } from 'react-redux';
import { login } from '../store/callSlice.js';
import useT from '../i18n/useT.js';

export default function LoginPanel() {
  const t = useT();
  const dispatch = useDispatch();
  const loading = useSelector((s) => s.call.loading);

  return (
    <div className="ccc-panel__section ccc-login">
      <p className="ccc-muted">{t('login.prompt')}</p>
      <Button color="blue" size={28} onClick={() => dispatch(login())} disabled={loading}>
        {loading ? <Spinner size={16} /> : t('login.signIn')}
      </Button>
    </div>
  );
}
