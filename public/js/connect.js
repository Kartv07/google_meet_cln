let userId;
const meetingId = (new URL(window.location)).searchParams.get('id');
const socket = io();

const RTCConfiguration = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        },
        {
            urls: "stun:stun1.l.google.com:19302"
        },
        {
            urls: "stun:openrelay.metered.ca:80",
        },
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
    ]
}

const mediaConstraints = {
    audio: true,
    video: true
}

let connections = {};
let userGroup = {};
const myMedia = document.querySelector('#my-media');
const myContainer = document.querySelector('#my-container');
const userContainer = document.querySelector('#user-container');
const videoContainer = document.querySelector('#video-container');
let myStream;
const messageBox = document.querySelector('#message-box');
const otherUserContainer = document.querySelector('#other-user-container');
let audioTrackSent = {};
let videoTrackSent = {};
let numberOfUsers = 1;
let isMyMicOn = true;
let isMyVidOn = true;
let isScreenShareOn = false;
const closeUsernamePopupBtn = document.querySelector('#close-username-popup');
const usernamePopup = document.querySelector('#username-popup');
const micToggleBtn = document.querySelector('#mic-toggle');
const vidToggleBtn = document.querySelector('#video-toggle');
const screenShareToggleBtn = document.querySelector('#screen-share-toggle');
const whiteBoardBtn = document.querySelector('#whiteboard-toggle');
const endCallBtn = document.querySelector('#end-call');
const sendMsgBtn = document.querySelector('#send-msg-btn');
const msgTxtElement = document.querySelector('#msg-txt');
const msgContainer = document.querySelector('#msg-container');
const participantContainer = document.querySelector('#participant-container');
const whiteboardContainer = document.querySelector('#whiteboard-container');
const toggleWhiteBoardBtn = document.querySelector('#whiteboard-toggle');
const canvas = document.querySelector("#whiteboard");
const ctx = canvas.getContext('2d');
let isBoardVisible = false;
let isDrawing = 0;
let x = 0;
let y = 0;
let color = "black";
let drawSize = 3;
let colorRemote = "black";
let drawSizeRemote = 3;

closeUsernamePopupBtn.onclick = startCall;
fitToContainer(canvas);
userContainer.classList.toggle('hidden');
whiteboardContainer.classList.toggle('hidden');

socket.on('get canvas', url => {
    let img = new Image();
    img.onload = () => {
        ctx.drawImage(img, 0, 0);
    };

    img.src = url;
});

window.onresize = reportWindowSize;

socket.on('clear board', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
})

canvas.addEventListener('mousedown', e => {
    x = e.offsetX;
    y = e.offsetY;
    isDrawing = 1;
});

canvas.addEventListener('mousemove', e => {
    if (isDrawing) {
        draw(e.offsetX, e.offsetY, x, y);
        socket.emit('draw', e.offsetX, e.offsetY, x, y, color, drawSize);
        x = e.offsetX;
        y = e.offsetY;
    }
});

window.addEventListener('mouseup', e => {
    if (isDrawing) {
        isDrawing = 0;
    }
});

socket.on('draw', (newX, newY, prevX, prevY, color, size) => {
    colorRemote = color;
    drawSizeRemote = size;
    drawRemote(newX, newY, prevX, prevY);
});

socket.on('connect with these users present in meeting', handleConnectWithUserGroup);
socket.on('new icecandidate', handleNewIceCandidate);
socket.on('sdp offer', handleSDPOffer);
socket.on('sdp answer', handleSDPAnswer);
socket.on('remove user', handleRemoveUser);
socket.on('action', handleAction);
socket.on('new message', handleRecieveMsg);

endCallBtn.onclick = handleEndCall;
micToggleBtn.onclick = handleMicToggle;
vidToggleBtn.onclick = handleVidToggle;
sendMsgBtn.onclick = handleSendMsg;
screenShareToggleBtn.onclick = screenShareToggle;
whiteBoardBtn.onclick = toggleWhiteBoard;

function startCall() {
    // console.log('Starting Call');

    userId = document.querySelector('#username-popup input').value.trim();

    if (userId == '')
        window.location = '/';

    navigator.mediaDevices.getUserMedia(mediaConstraints).then(stream => {
        handleMyStream(stream);
    }).catch(handleMyMediaError);

    socket.emit('join request', userId, meetingId);
    usernamePopup.style.visibility = 'hidden';
}

function handleNewIceCandidate(socketId, candidate) {
    // console.log('New Ice candidate: ', candidate);
    let newIceCandidate = new RTCIceCandidate(candidate);
    connections[socketId].addIceCandidate(newIceCandidate).catch(e => console.log(e));
}

async function handleConnectWithUserGroup(userList) {

    // console.log('Got Users list to connect with.',userList);
    userGroup = userList;

    if (!myStream) {
        try {
            stream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
            handleMyStream(stream);
        }
        catch (e) {
            handleMyMediaError(e);
            return;
        }
    }

    for (let socketId in userGroup) {
        setupConnectionWith(socketId);
    }
}

function showMessage(title, msg) {
    messageBox.innerHTML = `<div class="p-6 bg-white text-neutral-600">
        <h2 class="mb-4 font-bold">${title}</h2>
        <p class="text-sm">${msg}</p>
        <div class="w-full flex justify-end mt-4 font-bold"><button id='close-message-btn' class="text-blue-600 p-2">Dismiss</button></div>
    </div>`;

    messageBox.style.visibility = 'visible';

    document.querySelector('#close-message-btn').onclick = () => {
        messageBox.style.visibility = 'hidden';
    }
}

async function handleSDPOffer(offer, socketId, userInfo) {
    userGroup[socketId] = userInfo;

    // console.log(`Offer Recieved from : ${socketId}`, offer);

    if (!myStream) {
        try {
            stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
            handleMyStream(stream);
        }
        catch (e) {
            handleMyMediaError(e);
            return;
        }
    }

    try {
        setupConnectionWith(socketId);
        let desc = new RTCSessionDescription(offer);
        await connections[socketId].setRemoteDescription(desc);
        let answer = await connections[socketId].createAnswer();
        await connections[socketId].setLocalDescription(answer);
        socket.emit('sdp answer', connections[socketId].localDescription, socketId);
    }
    catch (e) {
        console.log(e);
    }
}

function setupConnectionWith(socketId) {

    // console.log('Trying to connect with ', socketId);

    connections[socketId] = new RTCPeerConnection(RTCConfiguration);

    myStream.getTracks().forEach(track => {
        connections[socketId].addTrack(track, myStream);

        if (track.kind === 'audio') {
            audioTrackSent[socketId] = track;

            if (!isMyMicOn)
                audioTrackSent[socketId].enabled = false;
        }
        else {
            videoTrackSent[socketId] = track;

            if (!isMyVidOn)
                videoTrackSent[socketId].enabled = false
        }
    });

    connections[socketId].onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('new icecandidate', socketId, event.candidate);
        }
    }

    connections[socketId].ontrack = (event) => { handleNewTrack(event, socketId, userGroup[socketId].isMicOn, userGroup[socketId].isVidOn) };

    connections[socketId].onremovetrack = (event) => {
        if (document.getElementById(socketId)) {
            document.getElementById(socketId).remove();
            document.getElementById('participant_' + socketId).remove();
            --numberOfUsers;
            handleLayout();
        }
    }

    connections[socketId].onnegotiationneeded = () => {
        connections[socketId].createOffer()
            .then(offer => connections[socketId].setLocalDescription(offer))
            .then(() => socket.emit('sdp offer', connections[socketId].localDescription, socketId))
            .catch(e => console.log(e));
    };
}

function handleSDPAnswer(answer, socketId) {
    // console.log(`Answer recieved from ${socketId}`, answer);
    const ans = new RTCSessionDescription(answer);
    connections[socketId].setRemoteDescription(ans);
}

function handleRemoveUser(socketId) {
    let userContainer = document.getElementById(socketId);

    if (userContainer) {
        userContainer.remove();
        document.getElementById('participant_' + socketId).remove();
        --numberOfUsers;
        handleLayout();
    }

    // console.log(`Socket ${socket.id} disconnected`);

    delete connections[socketId];
    delete userGroup[socketId];
}

function handleNewTrack(event, socketId, isMicOn, isVidOn) {

    // console.log(`New Track Recieved from ${socketId}`);

    if (!document.getElementById(socketId)) {
        let videoFrameContainer = createVideoFrame(userGroup[socketId].userId, isMicOn, isVidOn, socketId);
        userContainer.append(videoFrameContainer);
        document.querySelector(`#video_${socketId}`).srcObject = event.streams[0];
        let participant = createNewParticipant(userGroup[socketId].userId, isMicOn, isVidOn, socketId, socketId);
        participantContainer.append(participant);
        ++numberOfUsers;
        handleLayout();
    }
}

function handleLayout() {
    let width = parseInt(getComputedStyle(videoContainer).width);
    let height = parseInt(getComputedStyle(videoContainer).height);

    if (numberOfUsers === 1) {
        userContainer.className = "w-full h-full flex justify-center items-center";
    }
    else if (width < 536) {
        userContainer.className = "w-full h-full flex flex-col flex-nowrap justify-center items-center";
    }
    else if (width < 800 || numberOfUsers <= 6) {
        if ((numberOfUsers == 3 || numberOfUsers == 4) & height >= 408)
            userContainer.className = "w-full h-full grid grid-rows-[50%_50%] grid-cols-[1fr_1fr]";
        else
            userContainer.className = "w-full h-full grid grid-flow-row grid-cols-[1fr_1fr] ";
    }
    else if (height < 600 || numberOfUsers > 9) {
        userContainer.className = "w-full h-full grid grid-flow-row grid-cols-[1fr_1fr_1fr]";
    }
    else {
        userContainer.className = "w-full h-full grid grid-rows-[33%_33%_33%] grid-cols-[1fr_1fr_1fr]";
    }
}

function handleEndCall() {
    window.location = '/';
}

function handleMicToggle() {
    isMyMicOn = !isMyMicOn;

    if (isMyMicOn) {
        for (let key in audioTrackSent) {
            audioTrackSent[key].enabled = true;
        }

        if (myStream) {
            myStream.getTracks().forEach(track => {
                if (track.kind === 'audio') {
                    track.enabled = true;
                }
            })
        }

        socket.emit('action', 'audio on');
        handleAudioOn();
    }
    else {

        for (let key in audioTrackSent) {
            audioTrackSent[key].enabled = false;
        }

        if (myStream) {
            myStream.getTracks().forEach(track => {
                if (track.kind === 'audio') {
                    track.enabled = false;
                }
            })
        }

        socket.emit('action', 'audio off');
        handleAudioOff();
    }
}

function handleVidToggle() {
    isMyVidOn = !isMyVidOn;

    if (isMyVidOn) {
        for (let key in videoTrackSent) {
            videoTrackSent[key].enabled = true;
        }

        if (myStream) {
            myStream.getTracks().forEach(track => {
                if (track.kind === 'video') {
                    track.enabled = true;
                }
            })
        }

        socket.emit('action', 'video on');
        handleVidOn();
    }
    else {
        for (let key in videoTrackSent) {
            videoTrackSent[key].enabled = false;
        }

        if (myStream) {
            myStream.getTracks().forEach(track => {
                if (track.kind === 'video') {
                    track.enabled = false;
                }
            })
        }

        socket.emit('action', 'video off');
        handleVidOff();
    }
}

function screenShareToggle() {
    let screenMediaPromise;

    if (!isScreenShareOn) {
        if (navigator.getDisplayMedia) {
            screenMediaPromise = navigator.getDisplayMedia({ video: true });
        } else if (navigator.mediaDevices.getDisplayMedia) {
            screenMediaPromise = navigator.mediaDevices.getDisplayMedia({ video: true });
        } else {
            screenMediaPromise = navigator.mediaDevices.getUserMedia({
                video: { mediaSource: "screen" },
            });
        }
    } else {
        screenMediaPromise = navigator.mediaDevices.getUserMedia({ video: true });
    }

    screenMediaPromise.then((myScreen) => {
        if (!isMyVidOn)
            vidToggleBtn.click();

        isScreenShareOn = !isScreenShareOn;

        for (let key in connections) {
            const sender = connections[key].getSenders().find((s) => (s.track ? s.track.kind === "video" : false));
            sender.replaceTrack(myScreen.getVideoTracks()[0]);
        }

        myScreen.getVideoTracks()[0].enabled = true;

        const newStream = new MediaStream([myScreen.getVideoTracks()[0]]);
        myMedia.srcObject = newStream;
        myMedia.muted = true;
        myStream = newStream;

        if (isScreenShareOn) {
            screenShareToggleBtn.classList.replace('bg-[#ffffff10]', 'bg-red-600');
            screenShareToggleBtn.classList.replace('hover:bg-[#ffffff30]', 'hover:bg-red-500');
        }
        else {
            screenShareToggleBtn.classList.replace('bg-red-600', 'bg-[#ffffff10]');
            screenShareToggleBtn.classList.replace('hover:bg-red-600', 'hover:bg-[#ffffff30]');
        }

        myScreen.getVideoTracks()[0].onended = function () {
            if (isScreenShareOn) screenShareToggle();
        };
    }).catch((e) => {
        showMessage('Unable To Share Screen', e.message);
        console.error(e);
    });
}

function toggleWhiteBoard() {
    isBoardVisible = !isBoardVisible;

    if (isBoardVisible) {
        toggleWhiteBoardBtn.classList.replace('bg-[#ffffff10]', 'bg-red-600');
        toggleWhiteBoardBtn.classList.replace('hover:bg-[#ffffff30]', 'hover:bg-red-500');
    }
    else {
        toggleWhiteBoardBtn.classList.replace('bg-red-600', 'bg-[#ffffff10]');
        toggleWhiteBoardBtn.classList.replace('hover:bg-red-600', 'hover:bg-[#ffffff30]');
    }

    userContainer.classList.toggle('hidden');
    whiteboardContainer.classList.toggle('hidden');
}


function handleAction(msg, socketId) {
    // console.log(`Action recieved from ${socketId}`, msg);

    if (msg == 'audio on') {
        document.querySelector(`#${socketId} .mic-icon`).style.visibility = 'hidden';
        document.querySelector(`#participant_${socketId}_mic`).classList.replace('fa-microphone-slash', 'fa-microphone');
        userGroup[socketId].isMicOn = true;
    }
    else if (msg == 'audio off') {
        document.querySelector(`#${socketId} .mic-icon`).style.visibility = 'visible';
        userGroup[socketId].isMicOn = false;
        document.querySelector(`#participant_${socketId}_mic`).classList.replace('fa-microphone', 'fa-microphone-slash');
    }
    else if (msg == 'video on') {
        document.querySelector(`#${socketId} .vid-icon`).style.visibility = 'hidden';
        userGroup[socketId].isVidOn = true;
        document.querySelector(`#participant_${socketId}_video`).classList.replace('fa-video-slash', 'fa-video');

    }
    else if (msg == 'video off') {
        document.querySelector(`#${socketId} .vid-icon`).style.visibility = 'visible';
        userGroup[socketId].isVidOn = false;
        document.querySelector(`#participant_${socketId}_video`).classList.replace('fa-video', 'fa-video-slash');
    }
}

function handleMyStream(stream) {
    myStream = stream;
    document.querySelector('#my-media').srcObject = myStream;
    handleVidOn();
    handleAudioOn();
}

function handleMyMediaError(err) {
    handleAudioOff();
    handleVidOff();

    switch (err.name) {
        case "NotFoundError":
        case "SecurityError":
            showMessage("Not Able to Find Your Camera / Microphone", err.message);
            break;

        case "NotAllowedError":
            showMessage("An Error Occured", "Please allow access to microphone and video. We can't connect you without this permission.");
            break;

        default:
            showMessage("An Error Occured", err.message);
    }
}

function handleVidOn() {
    vidToggleBtn.classList.add('bg-[#ffffff10]', 'hover:bg-[#ffffff30]');
    vidToggleBtn.classList.remove('bg-red-500', 'hover:bg-red-400');
    vidToggleBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
    document.querySelector('#my-container .vid-icon').style.visibility = 'hidden';
}

function handleVidOff() {
    vidToggleBtn.classList.remove('bg-[#ffffff10]', 'hover:bg-[#ffffff30]');
    vidToggleBtn.classList.add('bg-red-500', 'hover:bg-red-400');
    vidToggleBtn.innerHTML = '<i class="fa-solid fa-video-slash"></i>';
    document.querySelector('#my-container .vid-icon').style.visibility = 'visible';
}

function handleAudioOn() {
    micToggleBtn.classList.add('bg-[#ffffff10]', 'hover:bg-[#ffffff30]');
    micToggleBtn.classList.remove('bg-red-500', 'hover:bg-red-400');
    micToggleBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    document.querySelector('#my-container .mic-icon').style.visibility = 'hidden';
}

function handleAudioOff() {
    micToggleBtn.classList.remove('bg-[#ffffff10]', 'hover:bg-[#ffffff30]');
    micToggleBtn.classList.add('bg-red-500', 'hover:bg-red-400');
    micToggleBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
    document.querySelector('#my-container .mic-icon').style.visibility = 'visible';
}

function handleSendMsg() {
    let value = msgTxtElement.value.trim();

    if (value === '')
        return;

    msgTxtElement.value = '';
    msgContainer.append(createMsgElement('You', value));
    msgContainer.scrollTop = msgContainer.scrollHeight;
    socket.emit('new message', value);
}

function createMsgElement(name, value) {
    let currentTime = new Date();
    let hours = currentTime.getHours().toString().padStart(2, '0');
    let minutes = currentTime.getMinutes().toString().padStart(2, '0');

    let newMsgContainer = document.createElement('div');
    let msgHeader = document.createElement('header');
    msgHeader.className = "text-sm font-medium";
    msgHeader.innerHTML = `${name} <small class="mx-2 font-light">${hours}:${minutes}</small>`
    let msgBody = document.createElement('main');
    msgBody.className = "text-sm font-normal";
    msgBody.append(value);
    newMsgContainer.append(msgHeader, msgBody);
    return newMsgContainer;
}

function handleRecieveMsg(name, value) {
    messengerBtn.click();
    msgContainer.append(createMsgElement(name, value));
    msgContainer.scrollTop = msgContainer.scrollHeight;
}

function createNewParticipant(name, isMicOn, isVidOn, socketId) {

    let participant = document.createElement('div');
    participant.id = 'participant_' + socketId;
    participant.className = "hover:bg-white mx-2 px-2 py-4 flex flex-row flex-nowrap justify-between items-center gap-3";
    participant.innerHTML = `
            <div>
                <i class='fa-solid fa-circle-user fa-2xl'></i>
            </div>
            <div class='flex-auto'>${name}</div>
            <div class="flex flex-row flex-nowrap justify-center items-center gap-3">
                <i id='participant_${socketId}_video' class='fa-solid ${isVidOn ? 'fa-video' : 'fa-video-slash'} fa-lg'></i>
                <i id='participant_${socketId}_mic' class='fa-solid ${isMicOn ? 'fa-microphone' : 'fa-microphone-slash'} fa-lg'></i>
            </div>`;

    return participant;
}

function createVideoFrame(name, isMicOn, isVidOn, socketId) {

    let videoFrameContainer = document.createElement('div');
    videoFrameContainer.className = "min-w-[256px] min-h-48 bg-black relative";
    videoFrameContainer.id = socketId;

    let videoContainer = document.createElement('div');
    videoContainer.className = "w-full h-full flex items-center justify-center";
    let video = document.createElement('video');
    video.id = `video_${socketId}`;
    video.autoplay = true;
    video.playsInline = true;
    video.className = "w-full h-full"
    videoContainer.appendChild(video);
    let nameContainer = document.createElement('h3');
    nameContainer.className = "max-w-full absolute p-4 bottom-0 left-0 overflow-hidden text-ellipsis whitespace-nowrap";
    nameContainer.append(name);
    let micIconContainer = document.createElement('div');
    micIconContainer.className = "mic-icon absolute p-3 bottom-0 right-0 cursor-pointer text-red-600";
    let micIcon = document.createElement('i');
    micIcon.className = "fa-solid fa-microphone-slash";
    micIconContainer.appendChild(micIcon);
    let vidIconContainer = document.createElement('div');
    vidIconContainer.className = "vid-icon absolute top-[50%] left-[50%] [transform:translate(-50%,-50%)]";
    let vidIcon = document.createElement('i');
    vidIcon.className = "fa-solid fa-video-slash fa-5x";
    vidIconContainer.append(vidIcon);
    videoFrameContainer.append(videoContainer, nameContainer, micIconContainer, vidIconContainer);

    if (isMicOn)
        micIconContainer.style.visibility = 'hidden';

    if (isVidOn)
        vidIconContainer.style.visibility = 'hidden';

    return videoFrameContainer;
}

function setColor(newcolor) {
    color = newcolor;
    drawSize = 3;
}

function setEraser() {
    color = "white";
    drawSize = 10;
}

function reportWindowSize() {
    fitToContainer(canvas);
}

function clearBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('store canvas', canvas.toDataURL());
    socket.emit('clear board');
}

function draw(newx, newy, oldx, oldy) {
    ctx.strokeStyle = color;
    ctx.lineWidth = drawSize;
    ctx.beginPath();
    ctx.moveTo(oldx, oldy);
    ctx.lineTo(newx, newy);
    ctx.stroke();
    ctx.closePath();

    socket.emit('store canvas', canvas.toDataURL());

}

function drawRemote(newx, newy, oldx, oldy) {
    ctx.strokeStyle = colorRemote;
    ctx.lineWidth = drawSizeRemote;
    ctx.beginPath();
    ctx.moveTo(oldx, oldy);
    ctx.lineTo(newx, newy);
    ctx.stroke();
    ctx.closePath();

}

function fitToContainer(canvas) {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
