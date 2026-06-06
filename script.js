import { logRaw, terminal, statusText, setButtonsState, setActiveUsbDevice, autoDetectTask } from './utils.js';
import * as adb from './adb-handler.js';
import * as samsung from './samsung-handler.js';
import * as fastboot from './fastboot-handler.js';
import * as apple from './apple-handler.js';

document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    console.log("Mostafa Unlocker Web Tool v1.0.3 Modular Loaded.");
    // بدء التحديث الدوري كل 2 ثانية
    setInterval(autoDetectTask, 2000);

    // تفعيل الأزرار فوراً عند تحميل الصفحة
    setButtonsState(true);

    // منطق التبديل بين الأقسام من القائمة الجانبية
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const sections = document.querySelectorAll('.card[id^="section-"]');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSection = item.getAttribute('data-section');

            // تحديث حالة الأزرار في السايدبار
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // إظهار/إخفاء الكروت
            sections.forEach(sec => {
                if (targetSection === 'all') {
                    sec.classList.remove('hidden-section');
                } else {
                    sec.id === `section-${targetSection}` ? sec.classList.remove('hidden-section') : sec.id !== 'terminal' && sec.classList.add('hidden-section');
                }
            });
        });
    });
});

navigator.usb.addEventListener('disconnect', (event) => {
    logRaw(`<br><span class="color-red">Device disconnected: ${event.device.serialNumber || 'USB Device'}</span>`);
    statusText.innerText = "Status: Disconnected";
    document.getElementById('appModal').style.display = "none";
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
bindAction('btnReadInfo', adb.readDeviceInfo); // أضف هذا الزر في الـ HTML إذا أردت قراءة البيانات لاحقاً
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

// Apple Actions
bindAction('btnApple', apple.readAppleInfo);
bindAction('btnEnterRecovery', apple.enterAppleRecovery);
bindAction('btnExitRecovery', apple.exitAppleRecovery);

// Fastboot & Honor Actions
bindAction('btnFastbootInfo', fastboot.fastbootInfo);
bindAction('btnFastbootReboot', fastboot.fastbootReboot);
bindAction('btnHonorInfo', fastboot.honorInfo);
bindAction('btnHonorFRP', fastboot.honorFRP);

// Custom ADB Command
bindAction('btnExecuteCustomAdb', async () => {
    const commandInput = document.getElementById('customAdbCommandInput');
    const command = commandInput.value.trim();
    if (command) {
        await adb.executeCustomCommand(command);
        commandInput.value = ''; // Clear input after sending
    } else {
        logRaw("<span class='color-red'>Please enter an ADB command to execute.</span>");
    }
});

// إضافة إمكانية الإرسال عند ضغط Enter لحقل ADB
const adbCommandInput = document.getElementById('customAdbCommandInput');
if (adbCommandInput) {
    adbCommandInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const command = adbCommandInput.value.trim();
            if (command) {
                await adb.executeCustomCommand(command);
                adbCommandInput.value = '';
            }
        }
    });
}

// Fastboot Custom Command
bindAction('btnExecuteCustomFastboot', async () => {
    const commandInput = document.getElementById('customFastbootCommandInput');
    const command = commandInput.value.trim();
    if (command) {
        await fastboot.executeCustomFastbootCommand(command);
        commandInput.value = ''; 
    } else {
        logRaw("<span class='color-red'>Please enter a Fastboot command.</span>");
    }
});

// إضافة إمكانية الإرسال عند ضغط Enter لحقل Fastboot
const fastbootCommandInput = document.getElementById('customFastbootCommandInput');
if (fastbootCommandInput) {
    fastbootCommandInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const command = fastbootCommandInput.value.trim();
            if (command) {
                await fastboot.executeCustomFastbootCommand(command);
                fastbootCommandInput.value = '';
            }
        }
    });
}

// App Manager UI Logic
bindAction('btnAppManager', async () => {
    // نستخدم ensureAdb للاتصال الصامت بدون قراءة بيانات الجهاز كاملة
    if (await adb.ensureAdb()) {
        document.getElementById('appModal').style.display = "block";
        await adb.refreshAppList();
    }
});

bindAction('btnAppManagerSidebar', async () => {
    if (await adb.ensureAdb()) {
        document.getElementById('appModal').style.display = "block";
        await adb.refreshAppList();
    }
});

// App Manager specific event listeners
const appSearchInput = document.getElementById('appSearch');
if (appSearchInput) appSearchInput.oninput = adb.renderApps;
const appFilterSelect = document.getElementById('appFilter');
if (appFilterSelect) appFilterSelect.onchange = adb.renderApps;
    // Mobile Menu Toggle Logic
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.onclick = (e) => {
            sidebar.classList.toggle('open');
            e.stopPropagation();
        };
    }

document.getElementById('btnInstallApk').onclick = (e) => {
    e.preventDefault();
    document.getElementById('apkInput').click();
};

document.getElementById('apkInput').onchange = (e) => {
    if (e.target.files.length) adb.installApk(e.target.files[0]);
};

window.onclick = (event) => {
    if (event.target.closest('.close-modal')) document.getElementById('appModal').style.display = "none";
    // إغلاق السايدبار عند الضغط في أي مكان آخر (للموبايل)
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !event.target.closest('.sidebar') && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
};

if (document.getElementById('btnClear')) {
    document.getElementById('btnClear').onclick = () => {
    terminal.innerHTML = `
        <div class="terminal-line info">>_ Terminal cleared. System ready.</div>
    `;
    };
}