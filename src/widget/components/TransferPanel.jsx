import React, { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import Spinner from '../ui/Spinner.jsx';
import { useDispatch } from 'react-redux';
import { taskAction, fetchTransferAgents, fetchTransferQueues } from '../store/callSlice.js';
import { TASK_ACTION, TRANSFER_DESTINATION_TYPE } from '../../shared/constants.js';
import SearchableSelect from '../ui/SearchableSelect.jsx';

// Blind transfer (task.transfer — no talk-first consult step), matching the
// ask: "transfer to an available agent or to a queue", same as WxCC Desktop's
// simple transfer. Replaces the Hold/Mute/End row in CallControls.jsx while open.
export default function TransferPanel({ taskId, onClose }) {
  const dispatch = useDispatch();
  const [destinationType, setDestinationType] = useState(TRANSFER_DESTINATION_TYPE.AGENT);
  const [to, setTo] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTo('');
    setLoading(true);
    const fetcher = destinationType === TRANSFER_DESTINATION_TYPE.AGENT ? fetchTransferAgents : fetchTransferQueues;
    dispatch(fetcher()).then((list) => {
      if (cancelled) return;
      setOptions((list || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [destinationType, dispatch]);

  function transfer() {
    if (!to) return;
    dispatch(taskAction(taskId, TASK_ACTION.TRANSFER, { to, destinationType }));
    onClose();
  }

  const isAgent = destinationType === TRANSFER_DESTINATION_TYPE.AGENT;

  return (
    <div className="ccc-transfer">
      <div className="ccc-transfer__tabs">
        <button
          type="button"
          className={`ccc-transfer__tab${isAgent ? ' is-active' : ''}`}
          onClick={() => setDestinationType(TRANSFER_DESTINATION_TYPE.AGENT)}
        >
          Agent
        </button>
        <button
          type="button"
          className={`ccc-transfer__tab${!isAgent ? ' is-active' : ''}`}
          onClick={() => setDestinationType(TRANSFER_DESTINATION_TYPE.QUEUE)}
        >
          Queue
        </button>
      </div>
      {loading ? (
        <div className="ccc-transfer__loading">
          <Spinner size={14} />
        </div>
      ) : (
        <SearchableSelect
          value={to}
          onChange={(id) => setTo(id || '')}
          options={options}
          placeholder={isAgent ? 'Select agent…' : 'Select queue…'}
          ariaLabel="Transfer destination"
          emptyText={isAgent ? 'No available agents' : 'No queues found'}
        />
      )}
      <div className="ccc-transfer__actions">
        <Button color="blue" size={28} disabled={!to} onClick={transfer}>
          Transfer
        </Button>
        <Button size={28} ghost onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
