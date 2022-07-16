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
let myMedia;
let myName;
let myEmail;
let myPicture;
const userContainer = document.querySelector('#user-container');
const videoContainer = document.querySelector('#video-container');
let myStream;
const messageBoxContainer = document.querySelector('#message-box');
const otherUserContainer = document.querySelector('#other-user-container');
let audioTrackSent = {};
let videoTrackSent = {};
let numberOfUsers = 1;
let isMyMicOn = true;
let isMyVidOn = true;
let isScreenShareOn = false;
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
const messenger = document.querySelector('#messenger');
const meetingInfo = document.querySelector('#meeting_info');
const participantsList = document.querySelector('#participants_list');
const meetingInfoBtn = document.querySelector('#show_meeting_info');
const participantsListBtn = document.querySelector('#show_participants_list');
const messengerBtn = document.querySelector('#show_messenger');
const sideBar = document.querySelector('#sidebar');
let selectedComponent = meetingInfo;
let selectedBtn = meetingInfoBtn;
const copyLinkBtn = document.querySelector('#copy_link_button');

markActive(selectedBtn);
document.querySelector('#show-link').innerHTML = window.location;

let currentTime = new Date();
let url = new URL(window.location);
let hours = currentTime.getHours().toString().padStart(2, '0');
let minutes = currentTime.getMinutes().toString().padStart(2, '0');
document.querySelector('#show-time').innerHTML = `${hours}:${minutes}`;
document.querySelector('#show-meeting-id').innerHTML = `${url.searchParams.get('id')}`;

setInterval(() => {
    currentTime = new Date();
    hours = currentTime.getHours().toString().padStart(2, '0');
    minutes = currentTime.getMinutes().toString().padStart(2, '0');
    document.querySelector('#show-time').innerHTML = `${hours}:${minutes}`;
    document.querySelector('#show-meeting-id').innerHTML = `${url.searchParams.get('id')}`;
}, 60000);

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
socket.on('connect_error', handleConnectError);
socket.once('name email picture', startCall);

endCallBtn.onclick = handleEndCall;
micToggleBtn.onclick = handleMicToggle;
vidToggleBtn.onclick = handleVidToggle;
sendMsgBtn.onclick = handleSendMsg;
screenShareToggleBtn.onclick = screenShareToggle;
whiteBoardBtn.onclick = toggleWhiteBoard;

messengerBtn.onclick = handleMessengerBtnClick;
meetingInfoBtn.onclick = handleMeetingInfoBtnClick;
participantsListBtn.onclick = handleParticipantsListBtnClick;

document.querySelectorAll('.close-btn').forEach((btn) => {
    btn.onclick = () => {
        hideSideBar();
        markUnactive(selectedBtn);
        selectedBtn = null;
    }
});

copyLinkBtn.onclick = handleCopyLinkBtn;

function handleMessengerBtnClick() {
    if (selectedBtn != messengerBtn) {
        displaySideBar();
        markUnactive(selectedBtn);
        selectedBtn = messengerBtn;
        markActive(selectedBtn);
        selectedComponent.classList.replace('flex', 'hidden');
        selectedComponent = messenger;
        messenger.classList.replace('hidden', 'flex');
    }
}

function handleMeetingInfoBtnClick() {
    if (selectedBtn != meetingInfoBtn) {
        displaySideBar();
        markUnactive(selectedBtn);
        selectedBtn = meetingInfoBtn;
        markActive(selectedBtn);
        selectedComponent.classList.replace('flex', 'hidden');
        selectedComponent = meetingInfo;
        meetingInfo.classList.replace('hidden', 'flex');
    }
}

function handleParticipantsListBtnClick() {
    if (selectedBtn != participantsListBtn) {
        displaySideBar();
        markUnactive(selectedBtn);
        selectedBtn = participantsListBtn;
        markActive(selectedBtn);
        selectedComponent.classList.replace('flex', 'hidden');
        selectedComponent = participantsList;
        participantsList.classList.replace('hidden', 'flex');
    }
}

function handleConnectError(err) {
    if (err.message === 'Authentication Error') {
        let callback = () => {
            window.location = '/login';
        }

        showMessage('Authentication Failed/Expired', 'You will need to login. Click ok to proceed', callback);
    }
}

function startCall(name, email, picture) {
    myName = name;
    myEmail = email;
    myPicture = picture;

    let participantMe = createNewParticipant(`${name} (You)`, isMyMicOn, isMyVidOn, 'me', myPicture);

    if (document.getElementById('participant_me'))
        document.getElementById('participant_me').remove();

    participantContainer.prepend(participantMe);

    let myVideoFrameContainer = createVideoFrame(`${name} (You)`, isMyMicOn, isMyVidOn, 'my_video_frame_container', picture);
    userContainer.prepend(myVideoFrameContainer);
    handleLayout();
    myMedia = document.querySelector('#video_my_video_frame_container');

    navigator.mediaDevices.getUserMedia(mediaConstraints).then(stream => {
        handleMyStream(stream);
    }).catch(handleMyMediaError);

    socket.emit('join request', meetingId, isMyMicOn, isMyVidOn);
}

function handleCopyLinkBtn() {
    navigator.clipboard.writeText(window.location).then(() => {
        copyLinkBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copied';
        setTimeout(() => { copyLinkBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Link' }, 2000);
    });
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

function showMessage(title, msg, callback) {
    let messageBox = document.createElement('div');
    messageBox.className = "p-6 bg-white text-neutral-600";
    let messageTitle = document.createElement('h2');
    messageTitle.className = 'mb-4 font-bold';
    messageTitle.innerHTML = title;
    let messageBody = document.createElement('p');
    messageBody.className = 'text-sm';
    messageBody.innerHTML = msg;
    let okBtnContainer = document.createElement('div');
    okBtnContainer.className = "w-full flex justify-end mt-4 font-bold text-blue-600";
    let okBtn = document.createElement('button');
    okBtn.innerHTML = 'OK';
    okBtnContainer.append(okBtn);
    messageBox.append(messageTitle, messageBody, okBtnContainer);
    messageBoxContainer.innerHTML = '';
    messageBoxContainer.append(messageBox);
    messageBoxContainer.style.visibility = 'visible';

    if (!callback) {
        okBtn.onclick = () => {
            messageBoxContainer.style.visibility = 'hidden';
        }
    }
    else
        okBtn.onclick = callback;
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
        let videoFrameContainer = createVideoFrame(userGroup[socketId].name, isMicOn, isVidOn, socketId, userGroup[socketId].picture);
        userContainer.append(videoFrameContainer);
        document.querySelector(`#video_${socketId}`).srcObject = event.streams[0];
        let participant = createNewParticipant(userGroup[socketId].name, isMicOn, isVidOn, socketId, userGroup[socketId].picture);
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
            screenShareToggleBtn.classList.replace('hover:bg-red-500', 'hover:bg-[#ffffff30]');
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
        toggleWhiteBoardBtn.classList.replace('hover:bg-red-500', 'hover:bg-[#ffffff30]');
    }

    userContainer.classList.toggle('hidden');
    whiteboardContainer.classList.toggle('hidden');
}


function handleAction(msg, socketId) {
    // console.log(`Action recieved from ${socketId}`, msg);

    if (msg == 'audio on') {
        document.querySelector(`#${socketId} .mic-icon`).style.display = 'none';
        document.querySelector(`#participant_${socketId}_mic`).classList.replace('fa-microphone-slash', 'fa-microphone');
        userGroup[socketId].isMicOn = true;
    }
    else if (msg == 'audio off') {
        document.querySelector(`#${socketId} .mic-icon`).style.display = 'block';
        userGroup[socketId].isMicOn = false;
        document.querySelector(`#participant_${socketId}_mic`).classList.replace('fa-microphone', 'fa-microphone-slash');
    }
    else if (msg == 'video on') {
        document.querySelector(`#${socketId} .vid-icon`).style.display = 'none';
        userGroup[socketId].isVidOn = true;
        document.querySelector(`#participant_${socketId}_video`).classList.replace('fa-video-slash', 'fa-video');
        document.querySelector(`#${socketId} .image`).style.display = 'none';
    }
    else if (msg == 'video off') {
        document.querySelector(`#${socketId} .vid-icon`).style.display = 'block';
        userGroup[socketId].isVidOn = false;
        document.querySelector(`#participant_${socketId}_video`).classList.replace('fa-video', 'fa-video-slash');
        document.querySelector(`#${socketId} .image`).style.display = 'block';
    }
}

function handleMyStream(stream) {
    myStream = stream;
    myMedia.srcObject = myStream;
    handleVidOn();
    handleAudioOn();
}

function handleMyMediaError(err) {
    handleAudioOff();
    handleVidOff();

    console.log(err);

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
    document.querySelector('#my_video_frame_container .vid-icon').style.display = 'none';
    document.querySelector('#participant_me #participant_me_video').className = 'fa-solid fa-video fa-lg';
    document.querySelector('#my_video_frame_container .image').style.display = 'none';
}

function handleVidOff() {
    vidToggleBtn.classList.remove('bg-[#ffffff10]', 'hover:bg-[#ffffff30]');
    vidToggleBtn.classList.add('bg-red-500', 'hover:bg-red-400');
    vidToggleBtn.innerHTML = '<i class="fa-solid fa-video-slash"></i>';
    document.querySelector('#my_video_frame_container .vid-icon').style.display = 'block';
    document.querySelector('#participant_me #participant_me_video').className = 'fa-solid fa-video-slash fa-lg';
    document.querySelector('#my_video_frame_container .image').style.display = 'block';
}

function handleAudioOn() {
    micToggleBtn.classList.add('bg-[#ffffff10]', 'hover:bg-[#ffffff30]');
    micToggleBtn.classList.remove('bg-red-500', 'hover:bg-red-400');
    micToggleBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    document.querySelector('#my_video_frame_container .mic-icon').style.display = 'none';
    document.querySelector('#participant_me #participant_me_mic').className = 'fa-solid fa-microphone fa-lg';
}

function handleAudioOff() {
    micToggleBtn.classList.remove('bg-[#ffffff10]', 'hover:bg-[#ffffff30]');
    micToggleBtn.classList.add('bg-red-500', 'hover:bg-red-400');
    micToggleBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
    document.querySelector('#my_video_frame_container .mic-icon').style.display = 'block';
    document.querySelector('#participant_me #participant_me_mic').className = 'fa-solid fa-microphone-slash fa-lg';
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

function createNewParticipant(name, isMicOn, isVidOn, id, imageLink) {

    let participant = document.createElement('div');
    participant.id = 'participant_' + id;
    participant.className = "hover:bg-white p-2 flex flex-row flex-nowrap justify-between items-center gap-3";
    participant.innerHTML = `
            <div>
                ${imageLink ? `<img src = '${imageLink}' height=42 width=42 class='rounded-full' alt='${name}'/>` : "<i class='fa-solid fa-circle-user fa-2xl'></i>"}
            </div>
            <div class='flex-auto'>${name}</div>
            <div class="flex flex-row flex-nowrap justify-center items-center gap-3">
            <div></div>
                <i id='participant_${id}_video' class='fa-solid ${isVidOn ? 'fa-video' : 'fa-video-slash'} fa-lg'></i>
                <i id='participant_${id}_mic' class='fa-solid ${isMicOn ? 'fa-microphone' : 'fa-microphone-slash'} fa-lg'></i>
            </div>`;

    return participant;
}

function createVideoFrame(name, isMicOn, isVidOn, id, imageLink) {

    let videoFrameContainer = document.createElement('div');
    videoFrameContainer.className = "min-w-[256px] min-h-48 bg-black relative";
    videoFrameContainer.id = id;

    let videoContainer = document.createElement('div');
    videoContainer.className = "w-full h-full flex items-center justify-center";
    let video = document.createElement('video');
    video.id = `video_${id}`;
    video.autoplay = true;
    video.playsInline = true;
    video.className = "w-full h-full"
    videoContainer.appendChild(video);
    let nameContainer = document.createElement('h3');
    nameContainer.className = "max-w-full absolute p-4 bottom-0 left-0 overflow-hidden text-ellipsis whitespace-nowrap";
    nameContainer.append(name);
    let iconContainer = document.createElement('div');
    iconContainer.className = "absolute p-4 bottom-0 right-0 cursor-pointer text-red-600 flex flex-row flex-nowrap gap-2";
    let micIcon = document.createElement('i');
    micIcon.className = "mic-icon fa-solid fa-microphone-slash";
    iconContainer.appendChild(micIcon);
    let vidIcon = document.createElement('i');
    vidIcon.className = "vid-icon fa-solid fa-video-slash";
    iconContainer.append(vidIcon);
    let image = document.createElement('img');
    image.src = imageLink;
    image.alt = name;
    image.width = 96;
    image.height = 96;
    image.className = "image block absolute top-[50%] left-[50%] [transform:translate(-50%,-50%)] rounded-full";

    videoFrameContainer.append(videoContainer, nameContainer, iconContainer, image);

    if (isMicOn)
        micIcon.style.display = 'none';

    if (isVidOn) {
        vidIcon.style.display = 'none';
        image.style.display = 'none';
    }

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

function markUnactive(btn) {
    if (btn) {
        btn.classList.remove('text-blue-600');
        btn.classList.add('hover:bg-[#ffffff30]');
        btn.classList.remove('cursor-default')
        btn.classList.add('cursor-pointer');
    }
}

function markActive(btn) {
    if (btn) {
        btn.classList.add('text-blue-600');
        btn.classList.remove('hover:bg-[#ffffff30]');
        btn.classList.remove('cursor-pointer');
        btn.classList.add('cursor-default')
    }
}

function hideSideBar() {
    sideBar.style.transform = 'translateX(100%)';
    sideBar.style.display = 'none';
}

function displaySideBar() {
    sideBar.style.display = 'block';
    sideBar.style.transform = 'translate(0)';
}
