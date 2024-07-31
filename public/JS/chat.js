const FORM_INPUT_DISABLED_COLOR = '#000000';
const FORM_INPUT_MSG_COLOR = '#ffffff';
const FORM_INPUT_SEND_COLOR = '#f6166c';
const MSG_MINE_COLOR = 'linear-gradient(to bottom, #ff99ff 0%, #ff0066 100%)';
const MSG_PARTNER_COLOR = 'linear-gradient(to bottom left, #33ccff 0%, #3333cc 100%)';

let socket = io('/');

let timeout;
let partner_id, my_id;
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

let partnerMessage = '<div class="partner">You are with partner' + '</div>';

navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localVideo.srcObject = stream;
        localStream = stream;

        socket.emit('join-room', 'room1');

        socket.on('user-connected', userId => {
            console.log('User connected: ', userId);
            callUser(userId);
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

socket.on('typing', function (data) {
    const istypingLabel = document.getElementById("istyping");
    if (data) {
        istypingLabel.style.visibility = "visible";
    } else {
        istypingLabel.style.visibility = "hidden";
    }
});

function submitForm() {
    console.log('Form submitted!');
    var msg = document.getElementById("m").value.trim();

    if (msg != '') {
        socket.emit('chat message', { msg: msg, target: partner_id });
    }

    document.getElementById("m").value = '';

    return false;
}

socket.on('init', function (data) {
    my_id = data.my_id;
    // document.getElementById("myname").innerHTML = socket.username;
});

socket.on('chat message mine', function (msg) {
    // console.log('Message sent from me: ' + msg);
    let output_msg = msg;
    let meDiv = document.createElement('div');
    meDiv.className = 'me';
    meDiv.style.display = 'none';
    meDiv.style.background = MSG_MINE_COLOR;
    meDiv.innerHTML = output_msg;
    messagesDiv.appendChild(meDiv);
    meDiv.style.display = 'block';
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

socket.on('chat message partner', function (msg) {
    console.log('Message received from partner: ' + msg);
    audio.play();
    let output_msg = msg;
    let partnerDiv = document.createElement('div');
    partnerDiv.className = 'partner';
    partnerDiv.style.display = 'none';
    partnerDiv.style.background = MSG_PARTNER_COLOR;
    partnerDiv.innerHTML = output_msg;
    messagesDiv.appendChild(partnerDiv);
    partnerDiv.style.display = 'block';
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// Consolidate disconnection handling into one event
socket.on('partner', function (partner_data) {
    if (partner_id == null) {
        partner_id = partner_data.id;
        document.getElementById("m").style.pointerEvents = "auto";
        document.getElementById("m").style.background = FORM_INPUT_MSG_COLOR;
        document.getElementById("submitButton").style.pointerEvents = "auto";
        document.getElementById("submitButton").style.background = FORM_INPUT_SEND_COLOR;
        document.getElementById("m").placeholder = "Type to send a message";

        let partnerMessage = '<div class="partner">You are paired ' + '</div>';
        messagesDiv.innerHTML += partnerMessage;

        socket.emit('partner', {
            target: partner_id,
            data: {
                id: socket.id,
            }
        });
    } else {
        console.log('Partner already set. Ignoring new partner data.');
    }
});

// Cleanup on disconnect
socket.on('disconnecting now', function (msg) {
    messagesDiv.innerHTML += '<div class="partner">' + msg + "</div>";
    remoteVideo.srcObject = null;
    partner_id = null;

    document.getElementById("m").style.pointerEvents = "none";
    document.getElementById("m").style.background = FORM_INPUT_DISABLED_COLOR;
    document.getElementById("submitButton").style.pointerEvents = "none";
    document.getElementById("submitButton").style.background = FORM_INPUT_DISABLED_COLOR;
    document.getElementById("m").placeholder = "";

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    window.location.reload();
});

socket.on('disconnect', function () {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    remoteVideo.srcObject = null;
    partner_id = null;
});



function callUser(userId) {
    if (!peerConnection) {
        peerConnection = new RTCPeerConnection(configuration);

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('send-signal', {
                    signal: {
                        candidate: event.candidate.toJSON()
                    },
                    to: userId,
                    from: socket.id
                });
            }
        };

        peerConnection.ontrack = event => {
            console.log('Received remote stream');
            remoteVideo.srcObject = event.streams[0];
        };

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.createOffer()
            .then(offer => {
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                socket.emit('send-signal', {
                    signal: peerConnection.localDescription,
                    to: userId,
                    from: socket.id
                });
            })
            .catch(error => console.error('Error creating offer.', error));
    }
}

async function answerCall(data) {
    if (!peerConnection) {
        peerConnection = new RTCPeerConnection(configuration);

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('send-signal', {
                    signal: {
                        candidate: event.candidate.toJSON()
                    },
                    to: data.from,
                    from: socket.id
                });
            }
        };

        peerConnection.ontrack = event => {
            console.log('Received remote stream');
            remoteVideo.srcObject = event.streams[0];
        };

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            socket.emit('send-signal', {
                signal: peerConnection.localDescription,
                to: data.from,
                from: socket.id
            });
        } catch (error) {
            console.error('Error during answering call.', error);
        }
    }
}

socket.on('signal-receive', async (data) => {
    if (peerConnection) {
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
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const msgInput = document.getElementById("m");
    msgInput.emojioneArea({
        saveEmojisAs: 'shortname',
        events: {
            keyup: function (editor, event) {
                if (event.which == 13) {
                    document.getElementById("msgform").submit();
                } else {
                    isTyping();
                }
            }
        }
    });
});
