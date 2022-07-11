document.querySelector('#show-link').innerHTML = window.location;
const messenger = document.querySelector('#messenger');
const meetingInfo = document.querySelector('#meeting_info');
const participantsList = document.querySelector('#participants_list');
const meetingInfoBtn = document.querySelector('#show_meeting_info');
const participantsListBtn = document.querySelector('#show_participants_list');
const messengerBtn = document.querySelector('#show_messenger');
const sideBar = document.querySelector('#sidebar');
let selectedComponent = meetingInfo;
let selectedBtn = meetingInfoBtn;
markActive(selectedBtn);

messengerBtn.onclick = () => {
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

meetingInfoBtn.onclick = () => {
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

participantsListBtn.onclick = () => {
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

document.querySelectorAll('.close-btn').forEach((btn) => {
    btn.onclick = () => {
        hideSideBar();
        markUnactive(selectedBtn);
        selectedBtn = null;
    }
});

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

const copyLinkBtn = document.querySelector('#copy_link_button');
copyLinkBtn.onclick = () => {
    navigator.clipboard.writeText(window.location).then(() => {
        copyLinkBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copied';
        setTimeout(() => { copyLinkBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Link' }, 2000);
    });
}

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
