const express = require("express");
const port = process.env.PORT || 3000;
const path = require('path');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

const io = (module.exports.io = require('socket.io')(server, {
    cors: {
        origin: '*',
    }
}));

let meetings = {};
let roomBoard = {};

io.on('connect', (socket) => {
    console.log(`Socket Id ${socket.id} connected.`);

    socket.on('join request', (userId, meetingId, isMicOn = true, isVidOn = true) => {
        console.log(`User ${userId} want to join in Meeting ${meetingId}`);
        socket.join(meetingId);
        socket.data.meetingId = meetingId;

        if (!meetings[meetingId])
            meetings[meetingId] = {};

        meetings[meetingId][socket.id] = {};
        meetings[meetingId][socket.id].userId = userId;
        meetings[meetingId][socket.id].isMicOn = isMicOn;
        meetings[meetingId][socket.id].isVidOn = isVidOn;

        if (!meetings[meetingId].userCount)
            meetings[meetingId].userCount = 1;
        else
            ++meetings[meetingId].userCount;

        if (meetings[meetingId].userCount > 1) {
            socket.emit('connect with these users present in meeting', meetings[meetingId]);
            console.log(`User List sent to socket ${socket.id}`, meetings[meetingId]);
        }
    });

    socket.on('new icecandidate', (socketId, candidate) => {
        console.log('new icecandidate recieved');
        socket.to(socketId).emit('new icecandidate', socket.id, candidate);
    });

    socket.on('sdp offer', (offer, socketId) => {
        console.log(`sdp offer recieved from ${socketId} in meeting ${socket.data.meetingId}`);
        socket.to(socketId).emit('sdp offer', offer, socket.id, meetings[socket.data.meetingId][socket.id]);
    });

    socket.on('sdp answer', (answer, socketId) => {
        console.log('sdp answer recived');
        socket.to(socketId).emit('sdp answer', answer, socket.id);
    });

    socket.on('action', msg => {
        if (msg == 'audio on')
            meetings[socket.data.meetingId][socket.id].isMicOn = true;
        else if (msg == 'audio off')
            meetings[socket.data.meetingId][socket.id].isMicOn = false;
        else if (msg == 'video on')
            meetings[socket.data.meetingId][socket.id].isVidOn = true;
        else if (msg == 'video off')
            meetings[socket.data.meetingId][socket.id].isVidOn = false;

        socket.to(socket.data.meetingId).emit('action', msg, socket.id);
    })

    socket.on('new message', (msg) => {
        console.log(`new message reieved from ${socket.id} : ${msg}`)
        socket.to(socket.data.meetingId).emit('new message', meetings[socket.data.meetingId][socket.id].userId, msg);
    });

    socket.on('get canvas', () => {
        if (roomBoard[socket.data.meetingId])
            socket.emit('get canvas', roomBoard[socket.data.meetingId]);
    });

    socket.on('draw', (newx, newy, prevx, prevy, color, size) => {
        socket.to(socket.data.meetingId).emit('draw', newx, newy, prevx, prevy, color, size);
    })

    socket.on('clear board', () => {
        socket.to(socket.data.meetingId).emit('clear board');
    });

    socket.on('store canvas', url => {
        roomBoard[socket.data.meetingId] = url;
    })

    socket.on('disconnecting', () => {
        socket.to(socket.data.meetingId).emit('remove user', socket.id);

        if (meetings[socket.data.meetingId]) {
            delete meetings[socket.data.meetingId][socket.id];
            if (--meetings[socket.data.meetingId].userCount === 0) {
                delete roomBoard[socket.data.meetingId];
                delete meetings[socket.data.meetingId];
            }
        }

        console.log(`${socket.id} disconnected.`);
    })
});

