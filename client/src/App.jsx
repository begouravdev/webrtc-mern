import React, { useState } from 'react';
import CallRoom from './components/CallRoom.jsx';

export default function App() {
  const [roomId, setRoomId] = useState('demo');
  const [serverUrl, setServerUrl] = useState('http://localhost:6000');

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h1>WebRTC 1:1 Starter</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="room id" />
        <input value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="signaling url" />
      </div>
      <CallRoom roomId={roomId} serverUrl={serverUrl} />
    </div>
  );
}