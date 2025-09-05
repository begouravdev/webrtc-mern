import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function CallRoom({ roomId, serverUrl }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);

  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState('Idle');

  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { 
      urls: "turn:103.194.228.174:3478",
      username: "webrtcuser",
      credential: "webrtcpwd"
    }
  ]

  useEffect(() => {
    socketRef.current = io('http://103.194.228.174:4000', { transports: ['websocket'] });

    socketRef.current.on('connect', () => setStatus('Connected to signaling'));
    socketRef.current.on('peer-joined', async ({ socketId }) => {
      // We are the caller if a peer joins after us
      await createOffer(socketId);
    });

    socketRef.current.on('signal', async ({ from, data }) => {
      if (!pcRef.current) return;
      if (data.type === 'offer') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socketRef.current.emit('signal', { roomId, to: from, data: answer });
      } else if (data.type === 'answer') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
      } else if (data.candidate) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
      }
    });

    socketRef.current.on('peer-left', () => {
      setStatus('Peer left');
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [serverUrl, roomId]);

  async function initPeer() {
    pcRef.current = new RTCPeerConnection({ iceServers });
    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        // send ICE candidates via signaling
        socketRef.current.emit('signal', { roomId, to: 'broadcast', data: { candidate: event.candidate } });
      }
    };
    pcRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));
  }

  async function join() {
    if (joined) return;
    setStatus('Joining…');
    await initPeer();
    socketRef.current.emit('join', { roomId });
    setJoined(true);
    setStatus('Joined');
  }

  async function createOffer(targetSocketId) {
    setStatus('Creating offer…');
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);

    // If target is known, send directly; otherwise broadcast into room
    const data = offer;
    if (targetSocketId) {
      socketRef.current.emit('signal', { roomId, to: targetSocketId, data });
    } else {
      socketRef.current.emit('signal', { roomId, to: 'broadcast', data });
    }
  }

  function leave() {
    socketRef.current.emit('leave', { roomId });
    pcRef.current?.getSenders().forEach(s => s.track && s.track.stop());
    pcRef.current?.close();
    pcRef.current = null;
    setJoined(false);
    setStatus('Left');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {!joined ? (
          <button onClick={join}>Join</button>
        ) : (
          <>
            <button onClick={() => createOffer()}>Call</button>
            <button onClick={leave}>Leave</button>
          </>
        )}
        <span>{status}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <h3>Local</h3>
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', background: '#000' }} />
        </div>
        <div>
          <h3>Remote</h3>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', background: '#000' }} />
        </div>
      </div>
    </div>
  );
}