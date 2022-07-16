require('dotenv').config();
const express = require("express");
const port = process.env.PORT || 3000;
const path = require('path');
const app = express();
const cors = require('cors');
const cookie = require('cookie');
const cookieParser = require('cookie-parser');
const { OAuth2Client } = require('google-auth-library');
const clientId = process.env.CLIENT_ID;

if (!clientId) {
    console.log('Please set client id (Google OAuth 2.0) in .env file');
    process.exit();
}

const client = new OAuth2Client(clientId);
const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET_KEY;
const jwtCookie = process.env.JWT_COOKIE_NAME || 'jwt_cookie';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/login.html'));
});

let userData = {};

app.post('/auth/google', (req, res) => {
    client.verifyIdToken({
        idToken: req.body.credential,
        audience: clientId,
    }).then((ticket) => {
        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;
        const picture = payload.picture;
        const data = {
            name,
            email,
            picture,
        }

        userData[email] = {};
        userData[email].name = name;
        userData[email].picture = picture;

        const token = jwt.sign(data, secretKey);
        res.cookie(jwtCookie, token, {
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'lax'
        });

        if (req.query.id)
            res.redirect(`/meeting?id=${req.query.id}`);
        else
            res.redirect('/');
    }
    ).catch((e) => {
        res.status(401).send("Sorry! We are not able to sign you in. Please <a href='/login'>sign in</a> again");
    });
});

app.get('/meeting', (req, res) => {
    if (!req.query.id) {
        res.status(400).send('Meeting Id is missing. Please enter meeting id in <a href="/">home</a> or create a new meeting.');
    }

    let token = req.cookies[jwtCookie];

    if (!token)
        res.status(401).redirect(`/login?id=${req.query.id}`);
    else
        jwt.verify(token, secretKey, (err, data) => {
            if (err)
                res.status(401).redirect(`/login?id=${req.query.id}`);

            res.sendFile(path.join(__dirname, 'public/meeting.html'));
        });
});

app.use(express.static(path.join(__dirname, 'public')));

server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

const io = (module.exports.io = require('socket.io')(server, {
    cors: {
        origin: '*',
    }
}));

function isAuthenticated(socket) {
    const cookies = cookie.parse(socket.handshake.headers.cookie);
    const token = cookies[jwtCookie];
    let flag;

    jwt.verify(token, secretKey, (err, data) => {
        if (err) {
            flag = false;
            return;
        }

        console.log(data);
        socket.data.email = data.email;
        socket.data.name = data.name;
        socket.data.picture = data.picture;
        flag = true;
    });

    return flag;
}

io.use((socket, next) => {
    if (isAuthenticated(socket)) {
        next();
    }
    else {
        next(new Error("Authentication Error"));
    }
});

let meetings = {};
let roomBoard = {};

io.on('connect', (socket) => {
    console.log(`Socket Id ${socket.id} connected.`);
    socket.emit('name email picture', socket.data.name, socket.data.email, socket.data.picture);

    socket.on('join request', (meetingId, isMicOn = true, isVidOn = true) => {
        console.log(`User ${socket.data.name} want to join in Meeting ${meetingId}`);

        socket.join(meetingId);
        socket.data.meetingId = meetingId;

        if (!meetings[meetingId])
            meetings[meetingId] = {};

        meetings[meetingId][socket.id] = {};
        meetings[meetingId][socket.id].name = socket.data.name;
        meetings[meetingId][socket.id].email = socket.data.email;
        meetings[meetingId][socket.id].picture = socket.data.picture;
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
        socket.to(socket.data.meetingId).emit('new message', meetings[socket.data.meetingId][socket.id].name, msg);
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

