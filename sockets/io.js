let num_users = 0;
let waiting_list = [];
let pairs = new Set();

const ioHandler = (io) => {
    io.on('connection', (socket) => {
        num_users++;
        socket.partner = null;
        socket.emit("init", { my_id: socket.id });

        // Try to pair users from the waiting list
        const tryPairing = () => {
            // Pair users only if there are users in the waiting list
            while (waiting_list.length >= 2) {
                const user1 = waiting_list.shift();
                const user2 = waiting_list.shift();
                
                const socket1 = io.sockets.sockets.get(user1);
                const socket2 = io.sockets.sockets.get(user2);

                // Ensure both users are connected
                if (socket1 && socket1.connected && socket2 && socket2.connected) {
                    // Make sure these users are not already paired
                    if (pairs.has(user1) || pairs.has(user2)) {
                        waiting_list.push(user1);  // Push back the users to retry pairing later
                        waiting_list.push(user2);
                    } else {
                        socket1.partner = socket2.id;
                        socket2.partner = socket1.id;
                        pairs.add(socket1.id);
                        pairs.add(socket2.id);
                        socket1.emit("partner", { id: socket2.id });
                        socket2.emit("partner", { id: socket1.id });
                    }
                } else {
                    if (socket1 && socket1.connected) waiting_list.push(user1);
                    if (socket2 && socket2.connected) waiting_list.push(user2);
                }
            }
        };

        // Add the new user to the waiting list
        waiting_list.push(socket.id);
        tryPairing();

        console.log(`User connected: ${socket.id}. Active Users: ${num_users}, Waiting List Size: ${waiting_list.length}`);

        socket.on('chat message', (data) => {
            const { msg, target } = data;
            if (socket.partner === target) {
                socket.to(target).emit("chat message partner", msg);
                socket.emit("chat message mine", msg);
            }
        });

        socket.on('join-room', (roomId) => {
            socket.join(roomId);
            socket.to(roomId).emit('user-connected', socket.id);
        });

        socket.on('send-signal', (data) => {
            console.log(`Signal received from ${data.from} to ${data.to}`);
            io.to(data.to).emit('signal-receive', {
                signal: data.signal,
                from: data.from
            });
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            if (socket.partner !== null) {
                const partnerSocket = io.sockets.sockets.get(socket.partner);
                if (partnerSocket) {
                    partnerSocket.emit("typing", false);
                    partnerSocket.emit("disconnecting now", 'Your Partner has disconnected. Refresh the page to chat again');
                    partnerSocket.partner = null;
                    pairs.delete(partnerSocket.id);
                    if (partnerSocket.connected) {
                        waiting_list.push(partnerSocket.id);
                    }
                }
            } else {
                const index = waiting_list.indexOf(socket.id);
                if (index !== -1) {
                    waiting_list.splice(index, 1);
                }
            }
            num_users--;
            console.log(`Active Users: ${num_users}, Waiting List Size: ${waiting_list.length}`);
            tryPairing();
        });

        socket.on('typing', (data) => {
            if (socket.partner) {
                socket.to(socket.partner).emit("typing", data);
            }
        });
    });

    io.on('error', (err) => {
        console.log(`Socket.IO error: ${err.message}`);
    });
};

module.exports = {
    ioHandler,
    num_users
};
