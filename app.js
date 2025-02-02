const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');
const endCallButton = document.getElementById('endCall');
const chatDiv = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');
const sendMessageButton = document.getElementById('sendMessage');

let localStream;
let remoteStream;
let peerConnection;

const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' } // Google's public STUN server
  ]
};

startCallButton.onclick = startCall;
endCallButton.onclick = endCall;
sendMessageButton.onclick = sendMessage;

// Connect to the signaling server
const socket = io('http://localhost:3000');

// Handle incoming messages
socket.on('message', (message) => {
  const messageElement = document.createElement('div');
  messageElement.textContent = `> ${message}`;
  chatDiv.appendChild(messageElement);
  chatDiv.scrollTop = chatDiv.scrollHeight; // Auto-scroll to the latest message
});

// Send a message
function sendMessage() {
  const message = messageInput.value;
  if (message) {
    socket.emit('message', message); // Send the message to the server
    messageInput.value = ''; // Clear the input field
  }
}

// Allow pressing "Enter" to send a message
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

// WebRTC logic
async function startCall() {
  startCallButton.disabled = true;
  endCallButton.disabled = false;

  // Get local media (audio and video)
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  // Create a peer connection
  peerConnection = new RTCPeerConnection(servers);

  // Add local stream to peer connection
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  // Handle remote stream
  peerConnection.ontrack = event => {
    remoteStream = event.streams[0];
    remoteVideo.srcObject = remoteStream;
  };

  // Exchange ICE candidates
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('candidate', event.candidate); // Send the candidate to the other peer
    }
  };

  // Create an offer and set it as the local description
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', offer); // Send the offer to the other peer
}

function endCall() {
  peerConnection.close();
  localStream.getTracks().forEach(track => track.stop());
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  startCallButton.disabled = false;
  endCallButton.disabled = true;
}

// Handle WebRTC signaling
socket.on('offer', async (offer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer);
});

socket.on('answer', async (answer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('candidate', async (candidate) => {
  await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});