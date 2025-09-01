const socket = io();

// Username section elements
const usernameContainer = document.getElementById('username-container');
const usernameForm = document.getElementById('username-form');
const usernameInput = document.getElementById('username-input');

// Main app elements
const appContainer = document.getElementById('app-container');
const userList = document.getElementById('user-list');

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
    }
});

// Listen for the form submission event
form.addEventListener('submit', (e) => {
  e.preventDefault(); 
  if (input.value) {
    socket.emit('chat message', { text: input.value });
    socket.emit('stop typing');
    input.value = '';
  }
});

// Listen for input events on the text field
input.addEventListener('input', () => {
  socket.emit('typing');
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stop typing');
  }, 1000);
});

// Listen for 'chat message' events coming from the server
socket.on('chat message', (data) => {
  const item = document.createElement('li');
  
  const userElement = document.createElement('strong');
  userElement.textContent = data.user;

  const textElement = document.createElement('span');
  textElement.textContent = `: ${data.text}`;

  item.appendChild(userElement);
  item.appendChild(textElement);
  
  if (data.user === username) {
      item.classList.add('my-message');
  }

  messages.appendChild(item);
  chatContainer.scrollTop = chatContainer.scrollHeight;
});

// Listen for 'typing' events from other users
socket.on('typing', (user) => {
    typingIndicator.textContent = `${user} is typing...`;
});

// Listen for 'stop typing' events from other users
socket.on('stop typing', () => {
    typingIndicator.textContent = '';
});

// Listen for the user list update
socket.on('update user list', (users) => {
    // Clear the current list
    userList.innerHTML = '';
    // Add each user to the list
    users.forEach(user => {
        const item = document.createElement('li');
        item.textContent = user;
        userList.appendChild(item);
    });
});

// Trigger the hidden file input when the paperclip button is clicked
fileButton.addEventListener('click', () => {
    fileInput.click();
});

// Handle the file selection
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
        return;
    }

    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const fileData = {
            name: file.name,
            type: file.type,
            data: reader.result // This is the base64 string
        };
        socket.emit('upload file', fileData);
    };
    reader.readAsDataURL(file);

    // Reset the input value so you can upload the same file again if needed
    e.target.value = '';
});

