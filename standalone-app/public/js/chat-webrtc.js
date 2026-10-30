// Real-Time Chat & WebRTC Audio/Video Calling Module
// Powered by Socket.io and native WebRTC (navigator.mediaDevices & RTCPeerConnection)

let socket = null;
let activePeerConnection = null;
let localMediaStream = null;
let currentChatTargetId = null;
let currentChatTargetName = 'User';
let activeCallTargetId = null;
let isAudioMuted = false;
let isVideoDisabled = false;
let pendingCallSignal = null;
let pendingCallerId = null;
let pendingCallType = 'video';

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Initialize Socket connection
function initSocket(userId) {
  if (typeof io === 'undefined') {
    console.warn('Socket.io library not loaded.');
    return;
  }

  socket = io();

  socket.on('connect', () => {
    socket.emit('user-online', userId);
  });

  // Handle incoming real-time in-app notification
  socket.on('notification', (data) => {
    if (typeof loadUnreadNotificationCount === 'function') {
      loadUnreadNotificationCount();
    }
    showToast(`🔔 <strong>${escapeHtml(data.title)}</strong><br>${escapeHtml(data.message)}`, 'info');
  });

  // Handle incoming real-time text message
  socket.on('receive-message', (msg) => {
    if (currentChatTargetId && (msg.sender === currentChatTargetId || msg.recipient === currentChatTargetId)) {
      appendChatMessage(msg, false);
      scrollChatToBottom();
    } else {
      showToast(`New message received!`, 'info');
    }
  });

  socket.on('message-sent', (msg) => {
    appendChatMessage(msg, true);
    scrollChatToBottom();
  });

  // WebRTC Signaling: Incoming Call
  socket.on('incoming-call', (data) => {
    pendingCallSignal = data.signal;
    pendingCallerId = data.from;
    pendingCallType = data.callType || 'video';

    // Show incoming call modal
    const callerNameElem = document.getElementById('incoming-caller-name');
    const callTypeElem = document.getElementById('incoming-call-type');
    if (callerNameElem) callerNameElem.textContent = data.callerName || 'Medical Contact';
    if (callTypeElem) callTypeElem.textContent = data.callType === 'audio' ? 'Voice Call' : 'Video Call';

    const incomingModal = new bootstrap.Modal(document.getElementById('incomingCallModal'));
    incomingModal.show();
  });

  // WebRTC Signaling: Caller receives answer
  socket.on('call-accepted', async (data) => {
    if (activePeerConnection) {
      await activePeerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
      updateCallStatus('Connected');
    }
  });

  // WebRTC Signaling: ICE Candidate received
  socket.on('ice-candidate', async (data) => {
    if (activePeerConnection && data.candidate) {
      try {
        await activePeerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    }
  });

  // WebRTC Signaling: Call ended by peer
  socket.on('call-ended', () => {
    showToast('Call ended by other party.', 'info');
    terminateActiveCall(false);
  });

  // WebRTC Signaling: Call rejected by peer
  socket.on('call-rejected', () => {
    showToast('Call was declined.', 'warning');
    terminateActiveCall(false);
  });
}

// Open Chat Interface with a user
async function openChat(targetUserId, targetUserName, userRole) {
  currentChatTargetId = targetUserId;
  currentChatTargetName = targetUserName;

  const chatModalElem = document.getElementById('chatModal');
  if (!chatModalElem) return;

  const chatModal = new bootstrap.Modal(chatModalElem);
  document.getElementById('chat-header-name').textContent = targetUserName;
  document.getElementById('chat-header-role').textContent = userRole || '';
  
  const messagesBox = document.getElementById('chat-messages-container');
  messagesBox.innerHTML = '<div class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Loading message history...</div>';
  
  chatModal.show();

  // Load chat history via REST API
  try {
    const res = await fetch(`/api/chat/${targetUserId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      messagesBox.innerHTML = '';
      if (data.messages.length === 0) {
        messagesBox.innerHTML = '<div class="text-center py-5 text-muted small"><i class="bi bi-chat-dots fs-3 d-block mb-2"></i>No previous messages. Say hello to begin consultation.</div>';
      } else {
        const myId = getCurrentUser().id;
        data.messages.forEach((msg) => {
          appendChatMessage(msg, msg.sender === myId);
        });
        scrollChatToBottom();
      }
    } else {
      messagesBox.innerHTML = `<div class="alert alert-warning py-2 small">${data.message}</div>`;
    }
  } catch (err) {
    messagesBox.innerHTML = '<div class="alert alert-danger py-2 small">Failed to load chat history.</div>';
  }
}

// Send chat message
async function sendCurrentChatMessage() {
  const input = document.getElementById('chat-input-field');
  if (!input) return;
  const text = input.value.trim();
  if (!text || !currentChatTargetId) return;

  input.value = '';

  const myId = getCurrentUser().id;

  if (socket && socket.connected) {
    socket.emit('send-message', {
      senderId: myId,
      recipientId: currentChatTargetId,
      text: text
    });
  } else {
    // REST API fallback
    try {
      const res = await fetch(`/api/chat/${currentChatTargetId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.success) {
        appendChatMessage(data.message, true);
        scrollChatToBottom();
      }
    } catch (err) {
      showToast('Message sending failed.', 'danger');
    }
  }
}

// Append message item to container
function appendChatMessage(msg, isSelf) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  // Clear empty state if present
  if (container.querySelector('.bi-chat-dots')) {
    container.innerHTML = '';
  }

  const timeStr = new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const bubbleHtml = `
    <div class="d-flex mb-2 ${isSelf ? 'justify-content-end' : 'justify-content-start'}">
      <div class="p-3 rounded-3 shadow-xs" style="max-width: 75%; background-color: ${isSelf ? '#0d9488' : '#ffffff'}; color: ${isSelf ? '#ffffff' : '#0f172a'}; border: ${isSelf ? 'none' : '1px solid #e2e8f0'};">
        <div class="small" style="word-break: break-word;">${escapeHtml(msg.text)}</div>
        <div class="text-end mt-1" style="font-size: 0.7rem; opacity: 0.75;">${timeStr}</div>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', bubbleHtml);
}

function scrollChatToBottom() {
  const container = document.getElementById('chat-messages-container');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// ==========================================
// WebRTC AUDIO / VIDEO CALLING LOGIC
// ==========================================

// Initiate a Call (Caller)
async function startCall(targetUserId, targetUserName, callType = 'video') {
  activeCallTargetId = targetUserId;
  const modal = new bootstrap.Modal(document.getElementById('activeCallModal'));
  
  document.getElementById('active-call-user-name').textContent = targetUserName;
  document.getElementById('active-call-type-badge').textContent = callType === 'audio' ? 'Voice Call' : 'HD Video Call';
  updateCallStatus('Ringing...');

  // Configure UI for audio vs video
  const remoteVideo = document.getElementById('remote-video');
  const localVideo = document.getElementById('local-video');
  const avatarPlaceholder = document.getElementById('call-avatar-placeholder');

  if (callType === 'audio') {
    remoteVideo.style.display = 'none';
    localVideo.style.display = 'none';
    avatarPlaceholder.style.display = 'flex';
  } else {
    remoteVideo.style.display = 'block';
    localVideo.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
  }

  modal.show();

  try {
    // 1. Get user media (camera/microphone)
    localMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video'
    });
    if (localVideo && callType === 'video') {
      localVideo.srcObject = localMediaStream;
    }

    // 2. Create Peer Connection
    activePeerConnection = new RTCPeerConnection(rtcConfig);

    // Add local tracks to connection
    localMediaStream.getTracks().forEach((track) => {
      activePeerConnection.addTrack(track, localMediaStream);
    });

    // Handle remote track
    activePeerConnection.ontrack = (event) => {
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    activePeerConnection.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          target: targetUserId,
          candidate: event.candidate
        });
      }
    };

    // 3. Create Offer
    const offer = await activePeerConnection.createOffer();
    await activePeerConnection.setLocalDescription(offer);

    // 4. Emit Call Offer via Socket
    socket.emit('call-user', {
      userToCall: targetUserId,
      signalData: offer,
      from: getCurrentUser().id,
      callerName: getCurrentUser().name,
      callType: callType
    });
  } catch (err) {
    console.error('Call initialization error:', err);
    showToast('Could not access microphone or camera. Please check permissions.', 'danger');
    terminateActiveCall(false);
  }
}

// Answer Incoming Call (Callee)
async function answerIncomingCall() {
  const incomingModal = bootstrap.Modal.getInstance(document.getElementById('incomingCallModal'));
  if (incomingModal) incomingModal.hide();

  activeCallTargetId = pendingCallerId;
  const activeModal = new bootstrap.Modal(document.getElementById('activeCallModal'));
  document.getElementById('active-call-user-name').textContent = 'Medical Consultation';
  document.getElementById('active-call-type-badge').textContent = pendingCallType === 'audio' ? 'Voice Call' : 'HD Video Call';
  updateCallStatus('Connecting...');

  const remoteVideo = document.getElementById('remote-video');
  const localVideo = document.getElementById('local-video');
  const avatarPlaceholder = document.getElementById('call-avatar-placeholder');

  if (pendingCallType === 'audio') {
    remoteVideo.style.display = 'none';
    localVideo.style.display = 'none';
    avatarPlaceholder.style.display = 'flex';
  } else {
    remoteVideo.style.display = 'block';
    localVideo.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
  }

  activeModal.show();

  try {
    localMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: pendingCallType === 'video'
    });
    if (localVideo && pendingCallType === 'video') {
      localVideo.srcObject = localMediaStream;
    }

    activePeerConnection = new RTCPeerConnection(rtcConfig);

    localMediaStream.getTracks().forEach((track) => {
      activePeerConnection.addTrack(track, localMediaStream);
    });

    activePeerConnection.ontrack = (event) => {
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
      }
    };

    activePeerConnection.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          target: pendingCallerId,
          candidate: event.candidate
        });
      }
    };

    await activePeerConnection.setRemoteDescription(new RTCSessionDescription(pendingCallSignal));
    const answer = await activePeerConnection.createAnswer();
    await activePeerConnection.setLocalDescription(answer);

    socket.emit('answer-call', {
      to: pendingCallerId,
      signal: answer
    });

    updateCallStatus('Connected');
  } catch (err) {
    console.error('Answer call error:', err);
    showToast('Failed to connect call.', 'danger');
    terminateActiveCall(false);
  }
}

// Reject Incoming Call
function rejectIncomingCall() {
  const incomingModal = bootstrap.Modal.getInstance(document.getElementById('incomingCallModal'));
  if (incomingModal) incomingModal.hide();

  if (socket && pendingCallerId) {
    socket.emit('reject-call', { to: pendingCallerId });
  }
  pendingCallSignal = null;
  pendingCallerId = null;
}

// End or Terminate Call
function endCall() {
  if (socket && activeCallTargetId) {
    socket.emit('end-call', { to: activeCallTargetId });
  }
  terminateActiveCall(true);
}

function terminateActiveCall(notifyUser = true) {
  if (localMediaStream) {
    localMediaStream.getTracks().forEach((track) => track.stop());
    localMediaStream = null;
  }
  if (activePeerConnection) {
    activePeerConnection.close();
    activePeerConnection = null;
  }
  activeCallTargetId = null;

  const modalElem = document.getElementById('activeCallModal');
  if (modalElem) {
    const modal = bootstrap.Modal.getInstance(modalElem);
    if (modal) modal.hide();
  }

  if (notifyUser) {
    showToast('Call ended.', 'info');
  }
}

// Toggle Mute Audio
function toggleCallAudio() {
  if (localMediaStream) {
    const audioTrack = localMediaStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isAudioMuted = !audioTrack.enabled;
      const btn = document.getElementById('btn-call-mute');
      if (btn) {
        btn.className = `btn btn-lg rounded-circle ${isAudioMuted ? 'btn-danger' : 'btn-light'}`;
        btn.innerHTML = `<i class="bi ${isAudioMuted ? 'bi-mic-mute-fill' : 'bi-mic-fill'}"></i>`;
      }
    }
  }
}

// Toggle Video Camera
function toggleCallVideo() {
  if (localMediaStream) {
    const videoTrack = localMediaStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      isVideoDisabled = !videoTrack.enabled;
      const btn = document.getElementById('btn-call-video');
      if (btn) {
        btn.className = `btn btn-lg rounded-circle ${isVideoDisabled ? 'btn-danger' : 'btn-light'}`;
        btn.innerHTML = `<i class="bi ${isVideoDisabled ? 'bi-camera-video-off-fill' : 'bi-camera-video-fill'}"></i>`;
      }
    }
  }
}

function updateCallStatus(text) {
  const statusElem = document.getElementById('active-call-status');
  if (statusElem) statusElem.textContent = text;
}
