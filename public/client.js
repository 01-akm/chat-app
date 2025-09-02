const socket = io();

// Username section elements
const usernameContainer = document.getElementById('username-container');
const usernameForm = document.getElementById('username-form');
const usernameInput = document.getElementById('username-input');

// Main app elements
const appContainer = document.getElementById('app-container');
const userList = document.getElementById('user-list');
const voiceChatContainer = document.getElementById('voice-chat-container');
const voiceChatStatus = document.getElementById('voice-chat-status');
const callInfo = document.getElementById('call-info');
const muteButton = document.getElementById('mute-button');
const hangUpButton = document.getElementById('hang-up-button');
const incomingCallContainer = document.getElementById('incoming-call-container');
const incomingCallInfo = document.getElementById('incoming-call-info');
const acceptCallButton = document.getElementById('accept-call-button');
const declineCallButton = document.getElementById('decline-call-button');

// --- New Video Elements ---
const videoContainer = document.getElementById('video-container');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

// Chat section elements
const chatContainer = document.getElementById('chat-container');
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const typingIndicator = document.getElementById('typing-indicator');
const fileButton = document.getElementById('file-button');
const fileInput = document.getElementById('file-input');
const privateMessageIndicator = document.getElementById('private-message-indicator');
const privateMessageInfo = document.getElementById('private-message-info');
const clearPrivateChat = document.getElementById('clear-private-chat');

let username = '';
let privateMessageTarget = null;
let localStream;
const peers = {};
let incomingCallData = null;

usernameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (usernameInput.value) {
        username = usernameInput.value.trim();
        socket.emit('set username', username);
        usernameContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        input.focus();

        // --- Request Camera and Microphone ---
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                localStream = stream;
                localVideo.srcObject = stream; // Display self-view
            })
            .catch(err => {
                console.error("Error accessing media devices:", err);
                alert("You must allow camera and microphone access to use video chat.");
            });
    }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value) {
    if (privateMessageTarget) {
        socket.emit('private message', { to: privateMessageTarget, text: input.value });
    } else {
        socket.emit('chat message', { text: input.value });
    }
    input.value = '';
  }
});

function displayNotification(message) {
    const item = document.createElement('li');
    item.className = 'notification';
    item.textContent = message;
    messages.appendChild(item);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

socket.on('user joined', (user) => {
    displayNotification(`${user} has joined the chat`);
});

socket.on('user left', (user) => {
    displayNotification(`${user} has left the chat`);
});

socket.on('chat message', (data) => {
  const item = document.createElement('li');
  const userElement = document.createElement('strong');
  userElement.textContent = data.user;
  const textElement = document.createElement('span');
  textElement.textContent = data.text;
  item.appendChild(userElement);
  item.appendChild(textElement);
  if (data.user === username) {
      item.classList.add('my-message');
  }
  messages.appendChild(item);
  chatContainer.scrollTop = chatContainer.scrollHeight;
});

socket.on('file message', (data) => {
    const item = document.createElement('li');
    const userElement = document.createElement('strong');
    userElement.textContent = data.user;
    const imageElement = document.createElement('img');
    imageElement.src = data.file.data;
    imageElement.alt = data.file.name;
    item.appendChild(userElement);
    item.appendChild(imageElement);
    if (data.user === username) {
        item.classList.add('my-message');
    }
    messages.appendChild(item);
    chatContainer.scrollTop = chatContainer.scrollHeight;
});

socket.on('private message', (data) => {
    const item = document.createElement('li');
    item.classList.add('private-message');
    const userElement = document.createElement('strong');
    userElement.textContent = data.from;
    const textElement = document.createElement('span');
    textElement.textContent = data.text;
    item.appendChild(userElement);
    item.appendChild(textElement);
    if (data.from === username) {
        item.classList.add('my-message');
    }
    messages.appendChild(item);
    chatContainer.scrollTop = chatContainer.scrollHeight;
});


socket.on('update user list', (users) => {
    userList.innerHTML = '';
    users.forEach(user => {
        if (user === username) return;

        const item = document.createElement('li');
        const usernameSpan = document.createElement('span');
        usernameSpan.textContent = user;
        usernameSpan.style.flexGrow = '1';

        item.onclick = () => {
            privateMessageTarget = user;
            privateMessageInfo.textContent = `Private message to: ${user}`;
            privateMessageIndicator.classList.remove('hidden');
            input.focus();
        };

        item.appendChild(usernameSpan);

        const callButton = document.createElement('button');
        callButton.textContent = 'Call';
        callButton.className = 'call-button';
        callButton.onclick = (e) => {
            e.stopPropagation();
            startCall(user);
        };

        item.appendChild(callButton);
        userList.appendChild(item);
    });
});

clearPrivateChat.addEventListener('click', () => {
    privateMessageTarget = null;
    privateMessageIndicator.classList.add('hidden');
    input.focus();
});

fileButton.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Please select an image file.');
    const reader = new FileReader();
    reader.onload = () => {
        socket.emit('upload file', { name: file.name, type: file.type, data: reader.result });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});

// --- WebRTC Video Chat Functions ---

function startCall(userToCall) {
    if (!localStream) { return alert("Media devices not ready."); }
    if (Object.keys(peers).length > 0) { return alert("You are already in a call."); }
    const peer = new SimplePeer({ initiator: true, trickle: false, stream: localStream });
    peers[userToCall] = peer;
    peer.on('signal', signalData => { socket.emit('call user', { userToCall: userToCall, signalData: signalData }); });
    peer.on('stream', stream => handleRemoteStream(stream, userToCall));
    peer.on('close', () => handlePeerClose(userToCall));
    peer.on('error', (err) => { console.error("Peer connection error:", err); handlePeerClose(userToCall); });
}
socket.on('call received', (data) => {
    if (Object.keys(peers).length > 0 || incomingCallData) { return; }
    incomingCallData = data;
    incomingCallInfo.textContent = `Incoming call from ${data.from.username}...`;
    incomingCallContainer.classList.remove('hidden');
});
acceptCallButton.addEventListener('click', () => {
    if (!incomingCallData || !localStream) return;
    const data = incomingCallData;
    incomingCallContainer.classList.add('hidden');
    incomingCallData = null;
    const peer = new SimplePeer({ initiator: false, trickle: false, stream: localStream });
    peers[data.from.username] = peer;
    peer.on('signal', signalData => { socket.emit('answer call', { signal: signalData, to: data.from.id }); });
    peer.signal(data.signal);
    peer.on('stream', stream => handleRemoteStream(stream, data.from.username));
    peer.on('close', () => handlePeerClose(data.from.username));
    peer.on('error', (err) => { console.error("Peer connection error:", err); handlePeerClose(data.from.username); });
});
declineCallButton.addEventListener('click', () => {
    incomingCallContainer.classList.add('hidden');
    incomingCallData = null;
});
socket.on('call answered', (signal) => {
    const userToAnswer = Object.keys(peers).find(key => peers[key].initiator);
    if (userToAnswer) {
        peers[userToAnswer].signal(signal);
    }
});
socket.on('call ended', () => {
    for (const user in peers) {
        if (peers[user]) {
            peers[user].destroy();
        }
    }
});

// --- Updated to Handle Video Stream ---
function handleRemoteStream(stream, user) {
    remoteVideo.srcObject = stream;
    videoContainer.classList.remove('hidden');
    voiceChatStatus.classList.remove('hidden');
    callInfo.textContent = `In call with ${user}`;
}

// --- Updated to Hide Video ---
function handlePeerClose(user) {
    if (peers[user]) delete peers[user];
    videoContainer.classList.add('hidden');
    remoteVideo.srcObject = null;
    voiceChatStatus.classList.add('hidden');
    callInfo.textContent = '';
    muteButton.textContent = 'Mute';
}
muteButton.addEventListener('click', () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(track => { track.enabled = !track.enabled; });
    muteButton.textContent = muteButton.textContent === 'Mute' ? 'Unmute' : 'Mute';
});
hangUpButton.addEventListener('click', () => {
    for (const user in peers) {
        if (peers[user]) {
            socket.emit('hang up', { user: user });
            peers[user].destroy();
        }
    }
});

