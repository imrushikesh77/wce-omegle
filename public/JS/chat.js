const FORM_INPUT_DISABLED_COLOR = '#000000';
const FORM_INPUT_MSG_COLOR = '#ffffff';
const FORM_INPUT_SEND_COLOR = '#f6166c';
const MSG_MINE_COLOR = 'linear-gradient(to bottom, #ff99ff 0%, #ff0066 100%)';
const MSG_PARTNER_COLOR = 'linear-gradient(to bottom left, #33ccff 0%, #3333cc 100%)';

let socket = io('/');

let timeout;
let partner_id = null;
let my_id;
let audio = new Audio('../assets/sounds/notif.mp3');

document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
document.getElementById("m").style.pointerEvents = "none";
document.getElementById("m").style.background = FORM_INPUT_DISABLED_COLOR;
document.getElementById("submitButton").style.pointerEvents = "none";
document.getElementById("submitButton").style.background = FORM_INPUT_DISABLED_COLOR;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let peerConnection;

const constraints = {
    video: true,
    audio: true
};

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
    ]
};

const messagesDiv = document.getElementById("messages");

navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localVideo.srcObject = stream;
        localStream = stream;

        socket.emit('join-room', 'room1');

        socket.on('user-connected', userId => {
            if (!partner_id) {
                console.log('User connected: ', userId);
                callUser(userId);
            }
        });

        socket.on('signal-receive', async (data) => {
            if (data.signal.type === 'offer') {
                await answerCall(data);
            } else if (data.signal.type === 'answer') {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
            } else if (data.signal.candidate) {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
                } catch (err) {
                    console.error('Error adding received ICE candidate', err);
                }
            }
        });
    })
    .catch(error => console.error('Error accessing media devices.', error));

function isTyping() {
    socket.emit('typing', true);
    clearTimeout(timeout);
    timeout = setTimeout(() => socket.emit('typing', false), 1000);
}

function submitForm() {
    var msg = document.getElementById("m").value.trim();
    if (msg !== '') {
        socket.emit('chat message', { msg: msg, target: partner_id });
    }
    document.getElementById("m").value = '';
    return false;
}

socket.on('init', function (data) {
    my_id = data.my_id;
});

socket.on('chat message mine', function (msg) {
    let meDiv = document.createElement('div');
    meDiv.className = 'me';
    meDiv.style.background = MSG_MINE_COLOR;
    meDiv.innerHTML = msg;
    messagesDiv.appendChild(meDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

socket.on('chat message partner', function (msg) {
    audio.play();
    let partnerDiv = document.createElement('div');
    partnerDiv.className = 'partner';
    partnerDiv.style.background = MSG_PARTNER_COLOR;
    partnerDiv.innerHTML = msg;
    messagesDiv.appendChild(partnerDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

socket.on('disconnecting now', function (msg) {
    messagesDiv.innerHTML += '<div class="partner">' + msg + "</div>";
    alert("Oops! your partner has disconnected, refreshing please wait.");
    remoteVideo.srcObject = null;
    window.location.reload();
});

socket.on('disconnect', function () {
    remoteVideo.srcObject = null;
    partner_id = null;
});

socket.on('partner', function (partner_data) {
    if (!partner_id) {
        partner_id = partner_data.id;
        document.getElementById("m").style.pointerEvents = "auto";
        document.getElementById("m").style.background = FORM_INPUT_MSG_COLOR;
        document.getElementById("submitButton").style.pointerEvents = "auto";
        document.getElementById("submitButton").style.background = FORM_INPUT_SEND_COLOR;
        messagesDiv.innerHTML += '<div class="partner">You are paired</div>';
        socket.emit('partner', { target: partner_id, data: { id: socket.id } });
    } else {
        console.log('Partner already set. Ignoring new partner data.');
    }
});

function callUser(userId) {
    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('send-signal', {
                signal: { candidate: event.candidate.toJSON() },
                to: userId,
                from: socket.id
            });
        }
    };
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            socket.emit('send-signal', {
                signal: peerConnection.localDescription,
                to: userId,
                from: socket.id
            });
        })
        .catch(error => console.error('Error creating offer.', error));
}

async function answerCall(data) {
    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('send-signal', {
                signal: { candidate: event.candidate.toJSON() },
                to: data.from,
                from: socket.id
            });
        }
    };
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('send-signal', {
        signal: peerConnection.localDescription,
        to: data.from,
        from: socket.id
    });
}

document.addEventListener('DOMContentLoaded', function () {
    const msgInput = document.getElementById("m");
    msgInput.emojioneArea({
        saveEmojisAs: 'shortname',
        events: {
            keyup: function (editor, event) {
                if (event.which === 13) {
                    document.getElementById("msgform").submit();
                } else {
                    isTyping();
                }
            }
        }
    });
});
