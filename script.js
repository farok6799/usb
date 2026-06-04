import { logRaw, terminal, statusText, setButtonsState, setActiveUsbDevice } from './utils.js';
import * as adb from './adb-handler.js';
import * as samsung from './samsung-handler.js';
import * as fastboot from './fastboot-handler.js';

document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    console.log("Mostafa Unlocker Web Tool v1.0.3 Modular Loaded.");
});

navigator.usb.addEventListener('disconnect', (event) => {
    logRaw(`<br><span class="color-red">Device disconnected: ${event.device.serialNumber || 'USB Device'}</span>`);
    statusText.innerText = "Status: Disconnected";
    document.getElementById('appModal').style.display = "none";
    setButtonsState(false);
    adb.resetAdbState();
    setActiveUsbDevice(null);
});

// وظيفة مساعدة لمنع السلوك الافتراضي وتنفيذ الأوامر
const bindAction = (id, action) => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('click', async (e) => {
            e.preventDefault();
            await action();
        });
    }
};

// ADB Actions
bindAction('btnConnect', adb.connectADB);
bindAction('btnFRP', adb.resetFRP);
bindAction('btnKnox', adb.disableKnox);
bindAction('btnReboot', () => adb.adbReboot(''));
bindAction('btnDownload', () => adb.adbReboot('download'));
bindAction('btnFastboot', () => adb.adbReboot('bootloader'));
bindAction('btnRecovery', () => adb.adbReboot('recovery'));

// Samsung & Serial Actions
bindAction('btnMTP', samsung.handleMTP);
bindAction('btnReadDownloadInfo', samsung.readDownloadInfo);
bindAction('btnDownloadReboot', samsung.odinReboot);

// Fastboot & Honor Actions
bindAction('btnFastbootInfo', fastboot.fastbootInfo);
bindAction('btnFastbootReboot', fastboot.fastbootReboot);
bindAction('btnHonorInfo', fastboot.honorInfo);
bindAction('btnHonorFRP', fastboot.honorFRP);

// App Manager UI Logic
bindAction('btnAppManager', () => {
    document.getElementById('appModal').style.display = "block";
    adb.refreshAppList();
});

document.getElementById('appSearch').oninput = adb.renderApps;
document.getElementById('appFilter').onchange = adb.renderApps;

document.getElementById('btnInstallApk').onclick = (e) => {
    e.preventDefault();
    document.getElementById('apkInput').click();
};

document.getElementById('apkInput').onchange = (e) => {
    if (e.target.files.length) adb.installApk(e.target.files[0]);
};

// Menu Toggles
['btnADBMenu', 'btnRebootMenu', 'btnFastbootMenu', 'btnDownloadMenu'].forEach(id => {
    document.getElementById(id).onclick = (e) => {
        const dropId = id.replace('btn', '').replace('Menu', '').toLowerCase() + "Dropdown";
        document.getElementById(dropId).classList.toggle("show");
        e.stopPropagation();
    };
});

window.onclick = (event) => {
    if (event.target.closest('.close-modal')) document.getElementById('appModal').style.display = "none";
    if (!event.target.closest('.dropdown')) {
        document.querySelectorAll(".dropdown-content").forEach(d => d.classList.remove('show'));
    }
};

document.getElementById('btnClear').onclick = () => {
    terminal.innerHTML = `
        <div class="terminal-header">SYSTEM TERMINAL CLEARED</div>
        <div class="color-purple">Mostafa Unlocker Engine is ready.</div><br>
    `;
};