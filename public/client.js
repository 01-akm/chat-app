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

let username = '';
let typingTimeout;

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

        // Get microphone access
        navigator.mediaDevices.getUserMedia({ video: false, audio: true })
            .then(stream => {
                localStream = stream;
            }).catch(err => {
                console.error("Error accessing microphone:", err);
                alert("You must allow microphone access to use voice chat.");
            });
    }
});

// Listen for the form submission event for text messages
form.addEventListener('submit', (e) => {
  e.preventDefault(); 
  if (input.value) {
    socket.emit('chat message', { text: input.value });
    socket.emit('stop typing');
    input.value = '';
  }
});

// Listen for 'chat message' events coming from the server
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

socket.on('typing', (user) => {
    typingIndicator.textContent = `${user} is typing...`;
});

socket.on('stop typing', () => {
    typingIndicator.textContent = '';
});

// Listen for the user list update and add call buttons
socket.on('update user list', (users) => {
    userList.innerHTML = ''; // Clear the current list
    users.forEach(user => {
        if (user === username) return; // Don't show myself in the list
        
        const item = document.createElement('li');
        item.textContent = user;

        const callButton = document.createElement('button');
        callButton.textContent = 'Call';
        callButton.className = 'call-button';
        callButton.onclick = () => startCall(user);
        
        item.appendChild(callButton);
        userList.appendChild(item);
    });
});

// Trigger the hidden file input when the paperclip button is clicked
fileButton.addEventListener('click', () => {
    fileInput.click();
});

// Handle the file selection and send the file to the server
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Please select an image file.');

    const reader = new FileReader();
    reader.onload = () => {
        socket.emit('upload file', { name: file.name, type: file.type, data: reader.result });
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset the input so the same file can be selected again
});

// --- WebRTC Voice Chat Functions ---

function startCall(userToCall) {
    if (!localStream) {
        alert("Microphone not ready. Please allow microphone access.");
        return;
    }
    // Prevent calling multiple people at once
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

// --- Modified 'call received' logic ---
socket.on('call received', (data) => {
    // If already in a call or being called, reject
    if (Object.keys(peers).length > 0 || incomingCallData) {
        return;
    }

    incomingCallData = data; // Store call data
    incomingCallInfo.textContent = `Incoming call from ${data.from.username}...`;
    incomingCallContainer.classList.remove('hidden');
});

acceptCallButton.addEventListener('click', () => {
    if (!incomingCallData || !localStream) return;
    
    const data = incomingCallData;
    incomingCallContainer.classList.add('hidden'); // Hide notification
    incomingCallData = null; // Clear stored data

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
    // We could add a signal here to tell the caller the call was declined
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
    let audio = document.querySelector(`audio[data-user="${user}"]`);
    if (!audio) {
        audio = document.createElement('audio');
        audio.setAttribute('data-user', user);
        audio.autoplay = true;
        voiceChatContainer.appendChild(audio);
    }
    audio.srcObject = stream;

    voiceChatStatus.classList.remove('hidden');
    callInfo.textContent = `With ${user}`;
}

function handlePeerClose(user) {
    const audio = document.querySelector(`audio[data-user="${user}"]`);
    if (audio) {
        audio.remove();
    }
    if (peers[user]) {
       delete peers[user];
    }
    
    voiceChatStatus.classList.add('hidden');
    callInfo.textContent = '';
    muteButton.textContent = 'Mute';
}

// --- Voice Chat UI Event Listeners ---
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
            // Tell the other user we are hanging up
            socket.emit('hang up', { user: user }); 
            peers[user].destroy(); // Destroy our local peer
        }
    }
});

