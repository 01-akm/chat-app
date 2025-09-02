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
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');


// --- New Incoming Call Elements ---
const incomingCallContainer = document.getElementById('incoming-call-container');
const incomingCallInfo = document.getElementById('incoming-call-info');
const acceptCallButton = document.getElementById('accept-call-button');
const declineCallButton = document.getElementById('decline-call-button');

// Chat section elements
const chatContainer = document.getElementById('chat-container');
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const typingIndicator = document.getElementById('typing-indicator');
const fileButton = document.getElementById('file-button');
const fileInput = document.getElementById('file-input');

// --- Private Messaging Elements ---
const privateMessageIndicator = document.getElementById('private-message-indicator');
const privateMessageUser = document.getElementById('private-message-user');
const clearPrivateMessage = document.getElementById('clear-private-message');


let username = '';
let typingTimeout;
let privateRecipient = null; // Track who we are private messaging

// --- WebRTC Voice Chat Variables ---
let localStream;
const peers = {}; // key: username, value: peer object
let incomingCallData = null; // Store incoming call data temporarily

// Handle username submission
usernameForm.addEventListener('submit', (e) => {
    e.preventDefault(); 
    if (usernameInput.value) {
        username = usernameInput.value.trim();
        socket.emit('set username', username);

        // Hide username container and show the main app
        usernameContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        input.focus();

        // Get microphone and camera access
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                localStream = stream;
                localVideo.srcObject = stream;
            }).catch(err => {
                console.error("Error accessing media devices:", err);
                alert("You must allow microphone and camera access to use video chat.");
            });
    }
});

// Handle form submission for both public and private messages
form.addEventListener('submit', (e) => {
  e.preventDefault(); 
  if (input.value) {
    if (privateRecipient) {
        socket.emit('private message', { to: privateRecipient, text: input.value });
    } else {
        socket.emit('chat message', { text: input.value });
    }
    socket.emit('stop typing');
    input.value = '';
  }
});

// Helper function to create a message element
function createMessageElement(data, isPrivate = false) {
    const item = document.createElement('li');
    item.dataset.id = data.id; // Assign the message ID

    const userElement = document.createElement('strong');
    userElement.textContent = isPrivate ? `(Private) ${data.from}` : data.user;

    const textElement = document.createElement('span');
    textElement.textContent = data.text;

    item.appendChild(userElement);
    item.appendChild(textElement);

    const isMyMessage = isPrivate ? data.from === username : data.user === username;

    if (isMyMessage) {
        item.classList.add('my-message');
        
        // Add delete button for my messages
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '×';
        deleteButton.className = 'delete-button';
        deleteButton.onclick = () => {
            socket.emit('delete message', data.id);
        };
        item.appendChild(deleteButton);
    }
    
    if (isPrivate) {
        item.classList.add('private-message');
    }

    messages.appendChild(item);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Listen for 'chat message' events
socket.on('chat message', (data) => {
    createMessageElement(data, false);
});

// Listen for 'private message' events
socket.on('private message', (data) => {
    createMessageElement(data, true);
});

// Helper function for creating file message elements
function createFileMessageElement(data) {
    const item = document.createElement('li');
    item.dataset.id = data.id; // Assign message ID
    
    const userElement = document.createElement('strong');
    userElement.textContent = data.user;

    const imageElement = document.createElement('img');
    imageElement.src = data.file.data; 
    imageElement.alt = data.file.name;

    item.appendChild(userElement);
    item.appendChild(imageElement);

    if (data.user === username) {
        item.classList.add('my-message');

        // Add delete button for my files
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '×';
        deleteButton.className = 'delete-button';
        deleteButton.onclick = () => {
            socket.emit('delete message', data.id);
        };
        item.appendChild(deleteButton);
    }

    messages.appendChild(item);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

socket.on('file message', (data) => {
    createFileMessageElement(data);
});

// Listen for message deleted event
socket.on('message deleted', (messageId) => {
    const messageToDelete = document.querySelector(`li[data-id="${messageId}"]`);
    if (messageToDelete) {
        messageToDelete.remove();
    }
});

// --- User Notifications ---
function showNotification(message) {
    const item = document.createElement('li');
    item.className = 'notification';
    item.textContent = message;
    messages.appendChild(item);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

socket.on('user joined', (user) => {
    showNotification(`${user} has joined the chat.`);
});

socket.on('user left', (user) => {
    showNotification(`${user} has left the chat.`);
});

// --- Typing Indicator ---
input.addEventListener('input', () => {
    clearTimeout(typingTimeout);
    socket.emit('typing');
    typingTimeout = setTimeout(() => {
        socket.emit('stop typing');
    }, 2000);
});

socket.on('typing', (user) => {
    typingIndicator.textContent = `${user} is typing...`;
});

socket.on('stop typing', () => {
    typingIndicator.textContent = '';
});

// --- User List and Private Messaging Logic ---
socket.on('update user list', (users) => {
    userList.innerHTML = ''; 
    users.forEach(user => {
        if (user === username) return; 
        
        const item = document.createElement('li');

        const usernameSpan = document.createElement('span');
        usernameSpan.textContent = user;
        usernameSpan.className = 'username-clickable';
        usernameSpan.onclick = () => {
            privateRecipient = user;
            privateMessageUser.textContent = user;
            privateMessageIndicator.classList.remove('hidden');
            input.focus();
        };
        item.appendChild(usernameSpan);

        const callButton = document.createElement('button');
        callButton.textContent = 'Call';
        callButton.className = 'call-button';
        callButton.onclick = () => startCall(user);
        
        item.appendChild(callButton);
        userList.appendChild(item);
    });
});

clearPrivateMessage.addEventListener('click', () => {
    privateRecipient = null;
    privateMessageIndicator.classList.add('hidden');
});

// --- File Upload ---
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
    if (!localStream) {
        alert("Media devices not ready. Please allow camera and microphone access.");
        return;
    }
    if (Object.keys(peers).length > 0) {
        alert("You are already in a call.");
        return;
    }

    const peer = new SimplePeer({
        initiator: true, 
        trickle: false, 
        stream: localStream
    });

    peers[userToCall] = peer;

    peer.on('signal', signalData => {
        socket.emit('call user', {
            userToCall: userToCall,
            signalData: signalData,
        });
    });

    peer.on('stream', stream => handleRemoteStream(stream, userToCall));
    peer.on('close', () => handlePeerClose(userToCall));
    peer.on('error', (err) => {
        console.error("Peer connection error:", err);
        handlePeerClose(userToCall);
    });
}

socket.on('call received', (data) => {
    if (Object.keys(peers).length > 0 || incomingCallData) {
        return;
    }

    incomingCallData = data;
    incomingCallInfo.textContent = `Incoming call from ${data.from.username}...`;
    incomingCallContainer.classList.remove('hidden');
});

acceptCallButton.addEventListener('click', () => {
    if (!incomingCallData || !localStream) return;
    
    const data = incomingCallData;
    incomingCallContainer.classList.add('hidden');
    incomingCallData = null;

    const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream: localStream
    });

    peers[data.from.username] = peer;

    peer.on('signal', signalData => {
        socket.emit('answer call', { signal: signalData, to: data.from.id });
    });
    
    peer.signal(data.signal); 
    peer.on('stream', stream => handleRemoteStream(stream, data.from.username));
    peer.on('close', () => handlePeerClose(data.from.username));
    peer.on('error', (err) => {
        console.error("Peer connection error:", err);
        handlePeerClose(data.from.username);
    });
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

function handleRemoteStream(stream, user) {
    remoteVideo.srcObject = stream;
    remoteVideo.classList.remove('hidden');
    localVideo.classList.add('small'); // Make local video smaller

    voiceChatStatus.classList.remove('hidden');
    callInfo.textContent = `With ${user}`;
}

function handlePeerClose(user) {
    remoteVideo.srcObject = null;
    remoteVideo.classList.add('hidden');
    localVideo.classList.remove('small'); // Restore local video size

    if (peers[user]) {
       delete peers[user];
    }
    
    voiceChatStatus.classList.add('hidden');
    callInfo.textContent = '';
    muteButton.textContent = 'Mute';
}

muteButton.addEventListener('click', () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
    });
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

