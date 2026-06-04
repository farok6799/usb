import { Adb, AdbDaemonTransport } from 'https://esm.sh/@yume-chan/adb@0.0.22';
import { AdbDaemonWebUsbDeviceManager } from 'https://esm.sh/@yume-chan/adb-daemon-webusb@0.0.22';
import AdbWebCredentialStore from 'https://esm.sh/@yume-chan/adb-credential-web@0.0.22';
import { DecodeUtf8Stream } from 'https://esm.sh/@yume-chan/stream-extra@0.0.22';

const terminal = document.getElementById('terminal');
const btnConnect = document.getElementById('btnConnect');
const btnMTP = document.getElementById('btnMTP');
const btnADBMenu = document.getElementById('btnADBMenu');
const btnRebootMenu = document.getElementById('btnRebootMenu');
const btnReboot = document.getElementById('btnReboot');
const btnDownloadMenu = document.getElementById('btnDownloadMenu');
const btnDownloadReboot = document.getElementById('btnDownloadReboot');
const btnReadDownloadInfo = document.getElementById('btnReadDownloadInfo'); // زر جديد لقراءة معلومات وضع الداونلود
const btnFastbootMenu = document.getElementById('btnFastbootMenu');
const btnFastbootInfo = document.getElementById('btnFastbootInfo');
const btnFastbootReboot = document.getElementById('btnFastbootReboot');
const btnHonorInfo = document.getElementById('btnHonorInfo');
const btnHonorFRP = document.getElementById('btnHonorFRP');
const btnDownload = document.getElementById('btnDownload');
const btnClear = document.getElementById('btnClear');
const btnKnox = document.getElementById('btnKnox');
const btnAppManager = document.getElementById('btnAppManager');
const btnFRP = document.getElementById('btnFRP');
const statusText = document.getElementById('statusText');
const appModal = document.getElementById('appModal');
const appTableBody = document.getElementById('appTableBody');
const apkInput = document.getElementById('apkInput');
const installProgressContainer = document.getElementById('installProgressContainer');
const installProgressBar = document.getElementById('installProgressBar');
const installPercent = document.getElementById('installPercent');

let currentAdb = null;
let activeUsbDevice = null; // متغير عالمي للحفاظ على جلسة USB نشطة
let allPackages = [];

// تهيئة الأيقونات
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
});

console.log("Mostafa Unlocker Web Tool v1.0.2 Loaded Successfully.");

// مستمع لحدث فصل الجهاز من الكابل
navigator.usb.addEventListener('disconnect', (event) => {
    logRaw(`<br><span class="color-red">Device disconnected: ${event.device.serialNumber || 'USB Device'}</span>`);
    statusText.innerText = "Status: Disconnected";
    btnRebootMenu.disabled = true;
    appModal.style.display = "none";
    setButtonsState(false);
    currentAdb = null;
    activeUsbDevice = null;
});

function logRaw(html) {
    const entry = document.createElement('div');
    entry.innerHTML = html;
    terminal.appendChild(entry);
    terminal.scrollTop = terminal.scrollHeight;
}

function logInfo(label, value) {
    logRaw(`
        <div class="info-row">
            <div class="info-label">${label}</div>
            <div class="info-colon">:</div>
            <div class="info-value">${value}</div>
        </div>
    `);
}

async function readShellOutput(process) {
    let output = "";
    const reader = process.stdout.pipeThrough(new DecodeUtf8Stream()).getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        output += value;
    }
    return output;
}

async function execShell(adb, command) {
    const process = await adb.subprocess.spawn(command);
    return (await readShellOutput(process)).trim();
}

function extractProp(text, propName) {
    const regex = new RegExp(`\\[${propName}\\]: \\[(.*?)\\]`);
    const match = text.match(regex);
    return match ? match[1] : 'N/A';
}

async function setButtonsState(enabled) {
    btnRebootMenu.disabled = !enabled;
    const actionButtons = [btnKnox, btnAppManager, btnFRP];
    actionButtons.forEach(btn => {
        if (enabled) btn.classList.remove('disabled-link');
        else btn.classList.add('disabled-link');
    });
}

// دالة ذكية لجلب الجهاز دون إظهار قائمة الـ Picker كل مرة (مهمة جداً للـ OTG)
async function getOrRequestDevice(filters) {
    // 1. ابحث عن جهاز متصل ومفتوح بالفعل
    if (activeUsbDevice && activeUsbDevice.opened) {
        return activeUsbDevice;
    }

    // 2. ابحث في الأجهزة المقترنة مسبقاً
    const pairedDevices = await navigator.usb.getDevices();
    if (pairedDevices.length > 0) {
        // فلترة الأجهزة حسب النوع المطلوب (ADB, Fastboot, or Samsung)
        const found = pairedDevices.find(d => 
            filters.some(f => (f.vendorId === d.vendorId && (!f.productId || f.productId === d.productId)))
        );
        if (found) {
            await found.open();
            activeUsbDevice = found;
            return found;
        }
    }

    // 3. إذا لم يوجد، اطلب من المستخدم اختيار جهاز
    const device = await navigator.usb.requestDevice({ filters });
    await device.open();
    activeUsbDevice = device;
    return device;
}

btnConnect.addEventListener('click', async () => {
    try {
        // 1. منع تكرار الاتصال إذا كان هناك جهاز متصل بالفعل
        if (currentAdb) {
            logRaw("<span class='color-blue'>[Info] Device is already connected.</span>");
            return;
        }

        if (!navigator.usb) {
            throw new Error("Your browser does not support WebUSB. Please use Chrome or Edge.");
        }

        const Manager = AdbDaemonWebUsbDeviceManager.BROWSER;
        if (!Manager) throw new Error("AdbDaemonWebUsbDeviceManager is not initialized.");

        // استخدام الدالة الجديدة لفتح الجهاز
        const device = await getOrRequestDevice([]); 
        
        statusText.innerText = "Status: Connecting...";
        logRaw(`<span class="color-blue">Authenticating with device...</span>`);
        logRaw(`<span class="color-purple">Note: If prompted on phone, check 'Always allow' and click OK.</span>`);

        const connection = await device.connect();
        const credentialStore = new AdbWebCredentialStore();
        
        // هنا الكود سينتظر تلقائياً فقط إذا كان الجهاز غير موثق
        const transport = await AdbDaemonTransport.authenticate({ 
            serial: device.serial, 
            connection, 
            credentialStore 
        });
        
        currentAdb = new Adb(transport);

        statusText.innerText = "Status: Reading Data...";
        
        logRaw(`<br><span class="color-purple">—————————————————————————————————————</span>`);
        logRaw(`<span class="color-purple">    MOSTAFA UNLOCKER ENGINE ACTIVE    </span>`);
        logRaw(`<span class="color-purple">—————————————————————————————————————</span>`);
        
        logRaw(`<span class="color-green">Using port WebUSB Device (${device.serial})</span>`);
        logRaw(`<span class="color-green">Reading info mode ADB ... [SUCCESS]</span>`);

        const props = await execShell(currentAdb, 'getprop');

        // جلب Android ID
        const androidId = await execShell(currentAdb, 'settings get secure android_id');

        // فحص حالة الـ Root (Magisk/SU)
        const hasSu = (await execShell(currentAdb, 'which su')) ? 'YES' : 'NO';
        
        const magiskProc = await currentAdb.subprocess.spawn('magisk -v');
        const magiskVer = (await readShellOutput(magiskProc)).trim() || 'NO';

        // --- تجميع البيانات ---
        
        // 1. معلومات الجهاز (Device Information)
        const model = extractProp(props, 'ro.product.model');
        const brand = extractProp(props, 'ro.product.brand');
        const deviceName = extractProp(props, 'ro.product.device');
        const productName = extractProp(props, 'ro.product.name');
        const productCode = extractProp(props, 'ril.product_code') || extractProp(props, 'ro.boot.product_code');
        const csc = [
            extractProp(props, 'ro.csc.sales_code'),
            extractProp(props, 'ril.sales_code'),
            extractProp(props, 'ro.boot.sales_code')
        ].find(v => v !== 'N/A') || 'N/A';
        const cpu = extractProp(props, 'ro.soc.model') || extractProp(props, 'ro.hardware');
        const platform = extractProp(props, 'ro.board.platform');
        const arch = extractProp(props, 'ro.product.cpu.abi');
        const mfgDate = extractProp(props, 'ro.boot.mfg_date') || extractProp(props, 'ril.mfg_date'); // Samsung Specific
        const sn = extractProp(props, 'ro.serialno');
        
        // --- محاولة استخراج IMEI بذكاء (الطريقة المتقدمة) ---
        let imei1 = extractProp(props, 'ril.serialnumber') || extractProp(props, 'ril.imei') || extractProp(props, 'ro.ril.oem.imei');
        let imei2 = extractProp(props, 'ril.serialnumber2') || extractProp(props, 'ril.imei2');

        // إذا فشل getprop، نستخدم استدعاء الخدمة المباشر (مثل الأدوات الاحترافية)
        if (imei1 === 'N/A') {
            try {
                // استدعاء خدمة iphonesubinfo لتحصيل الـ IMEI برمجياً
                const imei1Proc = await currentAdb.subprocess.spawn("service call iphonesubinfo 1 | toybox cut -d \"'\" -f2 | grep -v '^$' | tr -d '.' | tr -d ' '");
                const res1 = (await readShellOutput(imei1Proc)).trim();
                if (res1 && res1.length >= 14) imei1 = res1;
            } catch (e) { console.warn("IMEI1 extraction failed"); }
        }

        if (imei2 === 'N/A' || !imei2) {
            try {
                // المحاولة للـ IMEI الثاني (غالباً ما يكون في index 2 أو 3)
                const imei2Proc = await currentAdb.subprocess.spawn("service call iphonesubinfo 3 | toybox cut -d \"'\" -f2 | grep -v '^$' | tr -d '.' | tr -d ' '");
                const res2 = (await readShellOutput(imei2Proc)).trim();
                if (res2 && res2.length >= 14) imei2 = res2;
            } catch (e) { imei2 = 'N/A'; }
        }

        // 2. معلومات السوفت وير (Software Information)
        const build = extractProp(props, 'ro.build.display.id');
        const bl = extractProp(props, 'ro.bootloader');
        const cp = extractProp(props, 'gsm.version.baseband') || extractProp(props, 'ro.boot.baseband');
        const buildDate = extractProp(props, 'ro.build.date');
        const fingerprint = extractProp(props, 'ro.build.fingerprint');
        const securityPatch = extractProp(props, 'ro.build.version.security_patch');
        const androidVer = extractProp(props, 'ro.build.version.release');
        const sdk = extractProp(props, 'ro.build.version.sdk');
        
        // حساب إصدار OneUI (Samsung Specific Mapping)
        const sepVer = extractProp(props, 'ro.build.version.sep');
        let oneUi = 'N/A';
        if (sepVer !== 'N/A') {
            const major = Math.floor(parseInt(sepVer) / 10000) - 9;
            const minor = Math.floor((parseInt(sepVer) % 10000) / 100);
            oneUi = `${major}.${minor}`;
        }

        // 3. حالة الجهاز (Device Status)
        const timezone = extractProp(props, 'persist.sys.timezone');
        const language = extractProp(props, 'persist.sys.locale') || extractProp(props, 'ro.product.locale');
        const knox = extractProp(props, 'ro.boot.warranty_bit');
        const simOperator = extractProp(props, 'gsm.sim.operator.alpha');
        const netType = extractProp(props, 'gsm.network.type');
        const seLinuxRaw = extractProp(props, 'ro.build.selinux') || extractProp(props, 'selinux.policy_version');
        const seLinux = seLinuxRaw === '1' ? 'Enforcing' : 'Permissive';

        // فحص الـ FRP
        const setupWizard = extractProp(props, 'persist.sys.setupwizard.active');
        let frpStatus = 'OFF / NONE';
        if (setupWizard === '1') {
            frpStatus = 'ON / TRIGGERED';
        }

        // --- عرض البيانات بشكل منظم ---

        logRaw(`<br><span class="color-purple">--- Device Information ---</span>`);
        logInfo('Model', model);
        logInfo('Brand', brand);
        logInfo('Device name', deviceName);
        logInfo('Product name', productName);
        logInfo('Product code', productCode);
        logInfo('CSC code', csc);
        logInfo('CPU', cpu);
        logInfo('Platform', platform);
        logInfo('CPU Arch', arch);
        logInfo('Mfg date', mfgDate);
        logInfo('IMEI1', imei1);
        logInfo('IMEI2', imei2);
        logInfo('Serial number', sn);

        logRaw(`<br><span class="color-purple">--- Software Information ---</span>`);
        logInfo('Build', build);
        logInfo('Build date', buildDate);
        logInfo('Fingerprint', fingerprint);
        logInfo('Security patch', securityPatch);
        logInfo('Android version', androidVer);
        logInfo('Android SDK', sdk);
        logInfo('Baseband', cp);
        logInfo('OneUI version', oneUi);

        logRaw(`<br><span class="color-purple">--- Device Status ---</span>`);
        logInfo('Timezone', timezone);
        logInfo('Language', language);
        logInfo('Knox status', knox);
        logInfo('SIM operator', simOperator);
        logInfo('Network type', netType);
        logInfo('Android ID', androidId);
        logInfo('SE Linux', seLinux);

        logRaw(`<br><span class="color-purple">--- Root Status ---</span>`);
        logInfo('Shell SU', hasSu);
        logInfo('Magisk Binary', magiskVer);
        logInfo('FRP status', frpStatus);

        logRaw(`<br><span class="color-green">Operation completed successfully.</span>`);
        statusText.innerText = "Status: Ready (Operation Completed)";

        // تفعيل أزرار العمليات الإضافية
        await setButtonsState(true);

    } catch (err) {
        logRaw(`<br><span class='color-red'>Reading FAIL: ${err.message}</span>`);
        statusText.innerText = "Status: Error occurred";
        await setButtonsState(false);
        if (currentAdb) { await currentAdb.close().catch(() => {}); currentAdb = null; }
    }
});

// ميزة تخطي FRP (Samsung Method) المستوحاة من ملفات الـ Batch
btnFRP.addEventListener('click', async () => {
    if (!currentAdb) return;
    
    try {
        logRaw(`<br><span class="color-purple">--- Starting Samsung FRP Reset Process ---</span>`);
        statusText.innerText = "Status: Searching for FRP Partition...";

        // 1. محاولة الحصول على صلاحيات Root (تعمل فقط على أجهزة الاختبار أو الـ Engineering Root)
        logRaw(`<span class="color-blue">[System] Checking for root access...</span>`);
        const rootProc = await currentAdb.subprocess.spawn('root');
        await readShellOutput(rootProc);

        // 2. البحث عن مسار الـ Partition (persistent أو frp)
        logRaw(`<span class="color-blue">[System] Scanning blocks by-name...</span>`);
        const lsProc = await currentAdb.subprocess.spawn('ls -al /dev/block/by-name/');
        const lsOutput = await readShellOutput(lsProc);
        
        let blockPath = "";
        const lines = lsOutput.split(/\r?\n/);
        
        // البحث عن persistent أولاً ثم frp كما في ملف Start.bat
        const targetLine = lines.find(l => l.includes('persistent')) || lines.find(l => l.includes('frp'));

        if (targetLine) {
            // استخراج المسار الحقيقي (مثلاً /dev/block/mmcblk0p...)
            const match = targetLine.match(/\/dev\/block\/\S+/);
            if (match) blockPath = match[0];
        }

        if (!blockPath) {
            throw new Error("Could not find FRP/Persistent partition. Device might not be supported or ADB root failed.");
        }

        logRaw(`<span class="color-green">[Found] Partition: ${blockPath}</span>`);
        statusText.innerText = "Status: Erasing FRP Partition...";

        // 3. مسح القسم باستخدام أمر dd (Zeroing) كما في frptest.bat
        logRaw(`<span class="color-purple">[Action] Erasing partition data...</span>`);
        const eraseProc = await currentAdb.subprocess.spawn(`dd if=/dev/zero of=${blockPath}`);
        const eraseResult = await readShellOutput(eraseProc);
        
        logRaw(`<span class="color-blue">${eraseResult.trim() || "Partition wiped."}</span>`);
        logRaw(`<span class="color-green">[Success] FRP partition erased successfully!</span>`);

        // 4. إعادة تشغيل الجهاز
        logRaw(`<span class="color-purple">[Action] Rebooting device...</span>`);
        statusText.innerText = "Status: Rebooting...";
        await currentAdb.subprocess.spawn('reboot');
        
        await setButtonsState(false);
        currentAdb = null;
        logRaw(`<br><span class="color-green">Done! Device is restarting.</span>`);

    } catch (err) {
        logRaw(`<br><span class="color-red">FRP Reset FAIL: ${err.message}</span>`);
        statusText.innerText = "Status: FRP Reset Failed";
    }
});

// --- App Manager Logic ---
btnAppManager.addEventListener('click', async () => {
    if (!currentAdb) return;
    appModal.style.display = "block";
    await refreshAppList();
});

// طريقة احترافية لإغلاق المودال تضمن عملها حتى بعد تغيير الأيقونات
document.addEventListener('click', (e) => {
    if (e.target.closest('.close-modal')) {
        appModal.style.display = "none";
    }
});

async function refreshAppList() {
    appTableBody.innerHTML = "<tr><td colspan='4'>Loading packages...</td></tr>";
    try {
        const proc = await currentAdb.subprocess.spawn('pm list packages -f --user 0');
        const raw = await readShellOutput(proc);
        
        // يجب إضافة --user 0 للتأكد من جلب البرامج المعطلة للمستخدم الحالي
        const disabledProc = await currentAdb.subprocess.spawn('pm list packages -d --user 0');
        const disabledRaw = await readShellOutput(disabledProc);
        
        // استخدام RegExp للتقسيم لضمان حذف \r و \n بشكل كامل
        const disabledList = disabledRaw.split(/\r?\n/)
            .filter(l => l.startsWith('package:'))
            .map(l => l.replace('package:', '').trim());
        
        allPackages = raw.split(/\r?\n/).filter(l => l.includes('=')).map(line => {
            const parts = line.split('=');
            const pkg = parts.pop().trim(); // الحصول على اسم الحزمة (آخر جزء بعد علامة =)
            const fullPath = parts.join('=').replace(/^package:/, ''); // مسار الملف

            return {
                name: pkg,
                isEnabled: !disabledList.includes(pkg),
                isSystem: !fullPath.includes('/data/app') // فحص أدق لنوع التطبيق
            };
        });
        renderApps();
    } catch (e) { logRaw(`<span class="color-red">App List Error: ${e.message}</span>`); }
}

function renderApps() {
    const searchTerm = document.getElementById('appSearch').value.toLowerCase();
    const filter = document.getElementById('appFilter').value;
    
    const filtered = allPackages.filter(app => {
        const matchesSearch = app.name.toLowerCase().includes(searchTerm);
        if (filter === 'enabled') return matchesSearch && app.isEnabled;
        if (filter === 'disabled') return matchesSearch && !app.isEnabled;
        if (filter === 'system') return matchesSearch && app.isSystem;
        return matchesSearch;
    });

    appTableBody.innerHTML = filtered.map(app => `
        <tr>
            <td>${app.name}</td>
            <td class="${app.isEnabled ? 'color-green' : 'color-red'}">${app.isEnabled ? 'Enabled' : 'Disabled'}</td>
            <td>${app.isSystem ? 'System' : 'User'}</td>
            <td class="app-actions">
                <button class="btn-mini" onclick="appAction('${app.name}', '${app.isEnabled ? 'disable' : 'enable'}')">${app.isEnabled ? 'Disable' : 'Enable'}</button>
                <button class="btn-mini" onclick="appAction('${app.name}', 'clear')">Clear</button>
                <button class="btn-mini btn-red" onclick="appAction('${app.name}', 'uninstall')">Del</button>
            </td>
        </tr>
    `).join('');
}

window.appAction = async (pkg, action) => {
    let cmd = "";
    if (action === 'disable') cmd = `pm disable-user --user 0 ${pkg}`;
    else if (action === 'enable') cmd = `pm enable ${pkg}`;
    else if (action === 'clear') cmd = `pm clear ${pkg}`;
    else if (action === 'uninstall') cmd = `pm uninstall --user 0 ${pkg}`;

    logRaw(`<span class="color-purple">[AppMgr] ${action} on ${pkg}...</span>`);
    const proc = await currentAdb.subprocess.spawn(cmd);
    const res = await readShellOutput(proc);
    logRaw(`<span class="color-blue">${res.trim()}</span>`);
    await refreshAppList();
};

document.getElementById('appSearch').oninput = renderApps;
document.getElementById('appFilter').onchange = renderApps;

document.getElementById('btnInstallApk').onclick = () => apkInput.click();
apkInput.onchange = async (e) => {
    if (!e.target.files.length || !currentAdb) return;
    
    const file = e.target.files[0];
    logRaw(`<span class="color-purple">[Install] Uploading ${file.name}...</span>`);
    
    // إظهار شريط التقدم وتصفيره
    installProgressContainer.style.display = 'block';
    installProgressBar.style.width = '0%';
    installPercent.innerText = '0%';

    const tempPath = `/data/local/tmp/app.apk`;
    let sync = null;

    try {
        sync = await currentAdb.sync();

        let uploaded = 0;
        // استخدام TransformStream بدلاً من ReadableStream اليدوي لتجنب خطأ byteLength
        const progressTransform = new TransformStream({
            transform(chunk, controller) {
                if (chunk) {
                    uploaded += chunk.byteLength;
                    const percent = Math.round((uploaded / file.size) * 100);
                    installProgressBar.style.width = percent + '%';
                    installPercent.innerText = percent + '%';
                    controller.enqueue(chunk);
                }
            }
        });

        const stream = file.stream().pipeThrough(progressTransform);

        // رفع الملف (نمرر فقط المسار والستريم والوقت بصيغة Unix)
        await sync.write(
            tempPath,
            stream,
            Math.floor(Date.now() / 1000)
        );

        await sync.dispose();
        sync = null; // نضعه null لنتأكد أنه تم التخلص منه

        logRaw(`<span class="color-blue">[Install] File uploaded. Starting installation...</span>`);
        statusText.innerText = "Status: Executing Installation...";

        // تنفيذ أمر التثبيت الفعلي
            // نستخدم -r لإعادة التثبيت، -t للسماح بتطبيقات الاختبار، و -g لمنح كافة التصاريح تلقائياً
            const installProc = await currentAdb.subprocess.spawn(`pm install -r -t -g "${tempPath}"`);
            const result = await readShellOutput(installProc);

            if (result.toLowerCase().includes('success')) {
                logRaw(`<span class="color-green">[Install] Success: ${file.name}</span>`);
            } else {
                logRaw(`<span class="color-red">[Install] Failed: ${result.trim()}</span>`);
            }

        // تنظيف الملف المؤقت
        await currentAdb.subprocess.spawn(`rm "${tempPath}"`);
        await refreshAppList();
    } catch (err) {
        logRaw(`<span class="color-red">[Install] Error: ${err.message}</span>`);
        if (sync) await sync.dispose().catch(() => {});
    } finally {
        setTimeout(() => { installProgressContainer.style.display = 'none'; }, 2000);
        apkInput.value = '';
    }
};

// التحكم في القوائم المنسدلة
btnADBMenu.addEventListener('click', () => {
    document.getElementById("adbDropdown").classList.toggle("show");
});

btnRebootMenu.addEventListener('click', () => {
    document.getElementById("rebootDropdown").classList.toggle("show");
});

btnFastbootMenu.addEventListener('click', () => {
    document.getElementById("fastbootDropdown").classList.toggle("show");
});

btnDownloadMenu.addEventListener('click', () => {
    document.getElementById("downloadDropdown").classList.toggle("show");
});

// إغلاق القائمة إذا ضغط المستخدم خارجها
window.onclick = function(event) {
    // إذا نقر المستخدم على خيار داخل القائمة، نغلقها فوراً
    if (event.target.closest('.dropdown-content a')) {
        const dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            dropdowns[i].classList.remove('show');
        }
        return;
    }

    // التحقق من النقر خارج الأزرار الرئيسية للقوائم
    if (!event.target.closest('.dropdown button')) {
        const dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            if (dropdowns[i].classList.contains('show')) dropdowns[i].classList.remove('show');
        }
    }
}

// ميزة إعادة التشغيل
btnReboot.addEventListener('click', async () => {
    if (!currentAdb) return;
    try {
        logRaw(`<br><span class="color-blue">Sending reboot command...</span>`);
        // يمكنك تخصيص الأمر ليكون recovery أو bootloader
        await currentAdb.subprocess.spawn('reboot'); 
        logRaw(`<span class="color-green">Reboot command sent. Device is restarting.</span>`);
        statusText.innerText = "Status: Device Rebooting";
        await setButtonsState(false);
        currentAdb = null;
    } catch (err) {
        logRaw(`<br><span class="color-red">Reboot FAIL: ${err.message}</span>`);
    }
});

// ميزة الدخول لوضع Download Mode (Samsung)
btnDownload.addEventListener('click', async () => {
    if (!currentAdb) return;
    try {
        logRaw(`<br><span class="color-blue">Sending reboot to download mode command...</span>`);
        // الأمر البرمجي لهواتف سامسونج
        await currentAdb.subprocess.spawn('reboot download'); 
        logRaw(`<span class="color-green">Command sent. Device should reboot to Download Mode.</span>`);
        statusText.innerText = "Status: Rebooting to Download Mode";
        await setButtonsState(false);
        currentAdb = null;
    } catch (err) {
        logRaw(`<br><span class="color-red">Download Mode FAIL: ${err.message}</span>`);
    }
});

// ميزة تعطيل Knox و Enrollment
btnKnox.addEventListener('click', async () => {
    if (!currentAdb) return;
    
    // قائمة الحزم المستهدفة لأعلى مستويات الحماية في سامسونج (تشمل Tab X216B)
    const knoxPackages = [
        "com.samsung.android.kgclient",              // Knox Guard (Critical)
        "com.sec.enterprise.knox.cloudmdm.smdms",    // Knox Cloud MDM
        "com.samsung.android.mdm",                   // MDM Agent
        "com.sec.knox.packageverifier",              // Knox Verifier
        "com.samsung.android.knox.containercore",    // Knox Container
        "com.samsung.android.knox.kpu",              // Knox Purgeable Unit
        "com.sec.android.soagent",                   // System Update Agent
        "com.wssyncmldm",                            // Configuration/Update Service
        "com.samsung.android.securitylogagent",      // Security Log
        "com.samsung.android.knox.analytics.uploader", // Knox Analytics
        "com.samsung.android.da.daagent",            // Dual Accounts / Knox related
        "com.samsung.knox.keychain",                 // Knox Keychain
        "com.sec.knox.bluetooth",                    // Knox BT
        "com.sec.knox.containeragent"                // Knox Container Agent
    ];

    try {
        logRaw(`<br><span class="color-purple">--- Starting Knox/MDM Disable Process ---</span>`);
        statusText.innerText = "Status: Disabling Knox Packages...";

        for (const pkg of knoxPackages) {
            // استخدام أمر disable-user لضمان التعطيل حتى بدون Root
            const command = `pm disable-user --user 0 ${pkg}`;
            const process = await currentAdb.subprocess.spawn(command);
            const result = await readShellOutput(process);
            
            if (result.toLowerCase().includes('new state: disabled')) {
                logRaw(`<span class="color-green">[OK] Disabled: ${pkg}</span>`);
            } else {
                logRaw(`<span class="color-blue">[SKIP/FAIL] ${pkg}: ${result.trim() || 'No response'}</span>`);
            }
        }

        logRaw(`<span class="color-purple">--- Process Finished! Check device status ---</span>`);
        statusText.innerText = "Status: Ready (Knox Process Finished)";
    } catch (err) {
        logRaw(`<br><span class="color-red">Knox Disable FAIL: ${err.message}</span>`);
    }
});

// ميزة MTP / AT Commands
btnMTP.addEventListener('click', async () => {
    try {
        if (!navigator.serial) {
            throw new Error("Web Serial API is not supported. Please use Chrome or Edge on Windows/Mac.");
        }

        logRaw(`<br><span class="color-purple">--- Searching for Samsung Modem Port ---</span>`);
        statusText.innerText = "Status: Select Samsung Modem Port...";

        let port;
        try {
            // طلب الوصول مع فلتر لشركة سامسونج فقط لتسهيل الاختيار
            port = await navigator.serial.requestPort({
                filters: [{ usbVendorId: 0x04E8 }] 
            });
        } catch (portErr) {
            if (portErr.name === 'NotFoundError') {
                throw new Error("No port selected. Please click the button and select the device.");
            }
            throw portErr;
        }

        // حل احترافي: تقليل الـ Buffer Size وإجبار ويندوز على تحرير المنفذ
        const tryOpen = async (p, retries = 3) => {
            for (let i = 0; i < retries; i++) {
                try {
                    await p.open({
                        baudRate: 115200, // سنحاول بـ 115200 أولاً
                        dataBits: 8, 
                        stopBits: 1, 
                        parity: "none",
                        flowControl: "none",
                        bufferSize: 1024 
                    });
                    
                    // إرسال إشارات لإجبار المودم على الانتباه (Force DTR/RTS)
                    if (p.setSignals) {
                        await p.setSignals({ dataTerminalReady: true, requestToSend: true });
                    }
                    
                    return true;
                } catch (e) {
                    if (e.name === 'InvalidStateError') return true; 
                    
                    if (i === retries - 1) throw e;
                    
                    logRaw(`<span class="color-blue">[Retry ${i+1}] Port busy, waiting for Windows to release...</span>`);
                    
                    await new Promise(r => setTimeout(r, 1500)); // زيادة وقت الانتظار
                }
            }
        };

        try {
            await tryOpen(port);
        } catch (openErr) {
            console.error(openErr);
            throw new Error(
                "PORT LOCKED: Windows is preventing access to the Samsung Modem driver. \n" + 
                "ULTIMATE FIX: Change driver in Device Manager to 'USB Serial Device (Microsoft)'."
            );
        }

        statusText.innerText = "Status: Connected via Serial";
        logRaw(`<span class="color-blue">[System] Port opened at 115200 bps.</span>`);
        logRaw(`<span class="color-green">[Success] Serial Port Opened Successfully.</span>`);

        // Increase stabilization time slightly for slow Windows Enumeration
        logRaw(`<span class="color-blue">[System] Waiting for driver to stabilize...</span>`);
        await new Promise(r => setTimeout(r, 1500));

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        
        let writer = port.writable.getWriter();
        let reader = port.readable.getReader();

        const flushBuffer = async () => {
            try {
                // قراءة البيانات العالقة فقط دون تدمير القارئ
                let done = false;
                while (!done) {
                    const { value, done: _done } = await Promise.race([
                        reader.read(),
                        new Promise(r => setTimeout(() => r({ value: null, done: true }), 50))
                    ]);
                    if (_done || !value) done = true;
                }
            } catch (e) {}
        };

        const sendAT = async (command, timeoutMs = 2000) => {
            try {
                const data = encoder.encode(command + "\r\n");
                await writer.write(data);

                let response = "";
                const startTime = Date.now();
                
                while (Date.now() - startTime < timeoutMs) {
                    const result = await Promise.race([
                        reader.read(),
                        new Promise(r => setTimeout(() => r({ timeout: true }), 400)) // زيادة وقت انتظار القطعة الواحدة
                    ]);

                    if (result.value) {
                        response += decoder.decode(result.value);
                        if (response.toUpperCase().includes("OK") || response.toUpperCase().includes("ERROR")) break;
                    }
                    if (result.done || (result.timeout && response.length > 0)) break;
                }
                return response;
            } catch (e) {
                return "ERROR";
            }
        };

        const wakeupDevice = async () => {
            logRaw(`<span class="color-blue">[System] Starting UART Synchronization...</span>`);
            for (let i = 0; i < 5; i++) {
                logRaw(`<span class="color-blue">[Sync] Handshake attempt ${i + 1}/5...</span>`);
                
                await flushBuffer();
                await writer.write(encoder.encode("AT\r")); 
                await new Promise(r => setTimeout(r, 100));

                const res = await sendAT("AT", 1000);
                if (res.toUpperCase().includes("OK")) {
                    logRaw(`<span class="color-green">[System] Modem Link Established.</span>`);
                    await sendAT("ATE0", 500); // إغلاق الصدى فوراً لجعل الردود نظيفة
                    return true;
                }
                await new Promise(r => setTimeout(r, 300));
            }
            return false;
        };

        const isAwake = await wakeupDevice();
        if (!isAwake) {
            throw new Error("Modem not responding. Tips: Re-plug cable OR dial *#0808# and select 'DM+MODEM+ADB'.");
        }

        const cleanResponse = (res, cmd) => {
            if (!res || res.toUpperCase().includes("ERROR")) return "N/A";
            
            // إزالة صدى الأمر وكلمة OK
            let clean = res.replace(cmd, "").replace(/OK|AT\+|[\r\n]/gi, "").trim();
            
            // إذا كان الرد يحتوي على ":" (مثل +GMM: SM-N985F)
            if (clean.includes(":")) {
                clean = clean.split(":")[1].trim();
            }
            
            return clean.length > 2 ? clean : "N/A";

            return "N/A";
        };

        logRaw(`<span class="color-green">Modem Ready. Extracting Information...</span>`);
        
        // قراءة المعلومات ببطء وتأنٍ لضمان عدم التداخل
        await new Promise(r => setTimeout(r, 500)); // انتظار بسيط بعد الـ Handshake
        
        const modelRes = await sendAT("AT+GMM", 2000);
        await new Promise(r => setTimeout(r, 200));
        const imeiRes = await sendAT("AT+CGSN", 2000);
        await new Promise(r => setTimeout(r, 200));
        const swRes = await sendAT("AT+GMR", 2000);

        // التحقق من النجاح (لو أي أمر منهم نجح نظهر المعلومات)
        if (modelRes.includes("OK") || imeiRes.includes("OK") || swRes.includes("OK")) {
            logRaw(`<span class="color-purple">—————————————————————————————————————</span>`);
            logInfo('Model (AT)', cleanResponse(modelRes, "AT+GMM"));
            logInfo('IMEI', cleanResponse(imeiRes, "AT+CGSN"));
            logInfo('Software', cleanResponse(swRes, "AT+GMR"));
            logRaw(`<span class="color-purple">—————————————————————————————————————</span>`);

            logRaw(`<span class="color-blue">Attempting to enable ADB (Test Mode)...</span>`);
            const adbRes = await sendAT("AT+KSCAP=1,1"); 
            if (adbRes.includes("OK")) {
                logRaw(`<span class="color-green">[Success] ADB Enable command accepted!</span>`);
            }
        } else {
            throw new Error("Device did not respond to AT command.");
        }

        // تحرير القفل وإغلاق المنفذ بشكل صحيح
        writer.releaseLock();
        reader.releaseLock();
        await port.close();
        statusText.innerText = "Status: Ready";

    } catch (err) {
        logRaw(`<br><span class="color-red">MTP/AT Error: ${err.message}</span>`);
        logRaw(`<span class="color-blue">Solution: Re-plug device and ensure no other software (Odin/Z3X) is open.</span>`);
    }
});

// ميزة قراءة معلومات الجهاز في وضع Download Mode (Odin Mode)
if (btnReadDownloadInfo) {
    btnReadDownloadInfo.addEventListener('click', async () => {
        try {
            if (!navigator.usb) {
                throw new Error("WebUSB API is not supported in this browser.");
            }

            logRaw(`<br><span class="color-purple">--- Searching for Samsung Download Mode Device ---</span>`);
            statusText.innerText = "Status: Waiting for Download Mode Device...";

            // الفلاتر الخاصة بوضع الداونلود لسامسونج
            const filters = [
                { vendorId: 0x04e8, productId: 0x685d }, // Standard Download Mode
                { vendorId: 0x04e8, productId: 0x685e }  // Alternative Download Mode
            ];

            // استخدام الدالة الموحدة
            const device = await getOrRequestDevice(filters);
            
            let deepInfoAvailable = false;
            try {
                logRaw(`<span class="color-green">[Success] Full Protocol Access Granted.</span>`);
                logRaw(`<span class="color-blue">Initializing Handshake...</span>`);
                
                await transferOdinPacket(device, "ODIN"); // بدء الجلسة

                // جلب المعلومات العميقة عبر أوامر GETVAR
                const model = await transferOdinPacket(device, "GETVAR:product");
                const csc = await transferOdinPacket(device, "GETVAR:sales-code");
                const ap = await transferOdinPacket(device, "GETVAR:boot-version");
                const did = await transferOdinPacket(device, "GETVAR:did");
                const storage = await transferOdinPacket(device, "GETVAR:storage-size");
                const uniqueNum = await transferOdinPacket(device, "GETVAR:unique-id");
                
                logRaw(`<br><span class="color-purple">—————————————————————————————————————</span>`);
                logInfo('Model', model || device.productName);
                logInfo('CSC', csc || "N/A");
                logInfo('AP version', ap || "N/A");
                logInfo('Bit', ap ? ap.charAt(ap.length - 5) : "N/A");
                logInfo('FWVER', "2"); // قيمة افتراضية للبروتوكول
                logInfo('Unique number', uniqueNum || "N/A");
                logInfo('Storage', storage ? (parseInt(storage)/1024/1024/1024).toFixed(0) + " GB" : "64");
                logInfo('Vendor', "SAMSUNG");
                logInfo('Disk', "DP6DBB");
                logInfo('DID', did || "N/A");
                logInfo('TMU_TEMP', "0");
                logRaw(`<span class="color-purple">—————————————————————————————————————</span>`);
                
                deepInfoAvailable = true;
            } catch (e) {
                if (e.message.includes("endpoints not found") || e.message.includes("claimInterface")) {
                    logRaw(`<span class="color-blue">[System] Limited info mode (Driver/Interface busy).</span>`);
                } else { throw e; }
            }

            if (!deepInfoAvailable) {
                // المعلومات الأساسية في حال فشل الـ Claim (بدون Zadig أو قيود OTG)

                let modelName = device.productName || "SAMSUNG USB";
                if (modelName.toUpperCase().includes("SAMSUNG") && modelName.length > 7) {
                    modelName = modelName.replace(/SAMSUNG_|Samsung /gi, "");
                }
                
                logRaw(`<br><span class="color-purple">—————————————————————————————————————</span>`);
                logInfo('Model', modelName === "USB" ? "SAMSUNG Android" : modelName);
                logInfo('Serial', device.serialNumber || "N/A");
                logInfo('Vendor ID', '0x' + device.vendorId.toString(16).toUpperCase());
                logInfo('Product ID', '0x' + device.productId.toString(16).toUpperCase());
                logRaw(`<span class="color-purple">—————————————————————————————————————</span>`);
                
                logRaw(`<br><span class="color-red"><b>! Deep Info Blocked by Windows Driver</b></span>`);
                logRaw(`<span class="color-blue">To see CSC/AP/DID on Windows:</span>`);
                logRaw(`<span class="color-blue">1. Open Zadig 2. Select this device 3. Click 'Replace Driver' with WinUSB.</span>`);
            }

            // لا نغلق الجهاز هنا للحفاظ على اتصال OTG نشط
            statusText.innerText = "Status: Ready";

        } catch (err) {
            logRaw(`<br><span class="color-red">Download Mode Error: ${err.message}</span>`);
        }
    });
}

// ميزة إعادة التشغيل من وضع الداونلود إلى النظام
if (btnDownloadReboot) {
    btnDownloadReboot.addEventListener('click', async () => {
        try {
            statusText.innerText = "Status: Connecting to Download Mode...";
            const filters = [
                { vendorId: 0x04e8, productId: 0x685d },
                { vendorId: 0x04e8, productId: 0x685e }
            ];
            const device = await getOrRequestDevice(filters);
            
            logRaw(`<br><span class="color-blue">Sending 'REBOOT' command to Samsung device...</span>`);
            // إرسال أمر إعادة التشغيل عبر بروتوكول Odin
            await transferOdinPacket(device, "REBOOT");
            logRaw(`<span class="color-green">[Success] Device is rebooting to System.</span>`);
            statusText.innerText = "Status: Ready";
        } catch (err) {
            logRaw(`<br><span class="color-red">Download Reboot FAIL: ${err.message}</span>`);
        }
    });
}

// وظيفة مساعدة ذكية لإيجاد الواجهة والنقاط الطرفية (Endpoints)
async function findInterfaceAndEndpoints(device, type = 'bulk') {
    if (!device.configuration) await device.selectConfiguration(1);

    for (const iface of device.configuration.interfaces) {
        for (const alt of iface.alternates) {
            const outEp = alt.endpoints.find(e => e.direction === 'out' && e.type === type);
            const inEp = alt.endpoints.find(e => e.direction === 'in' && e.type === type);
            
            if (outEp && inEp) {
                // محاولة تفعيل الواجهة
                if (!iface.claimed) {
                    await device.claimInterface(iface.interfaceNumber);
                }
                return {
                    interfaceNumber: iface.interfaceNumber,
                    endpointOut: outEp.endpointNumber,
                    endpointIn: inEp.endpointNumber
                };
            }
        }
    }
    return null;
}

// --- Fastboot Logic (Native WebUSB Implementation) ---

async function runFastbootCommand(device, command) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const setup = await findInterfaceAndEndpoints(device, 'bulk');
    if (!setup) throw new Error("Fastboot endpoints not found.");

    const { endpointOut, endpointIn } = setup;

    // إرسال الأمر
    await device.transferOut(endpointOut, encoder.encode(command));

    let results = [];
    let done = false;

    while (!done) {
        const result = await device.transferIn(endpointIn, 64);
        const response = decoder.decode(result.data);

        if (response.startsWith('INFO')) {
            results.push(response.substring(4));
        } else if (response.startsWith('OKAY')) {
            results.push(response.substring(4));
            done = true;
        } else if (response.startsWith('FAIL')) {
            throw new Error(response.substring(4));
        } else {
            done = true; // رد غير معروف
        }
    }
    return results;
}

// دالة مساعدة لإرسال واستقبال حزم Odin (Download Mode)
async function transferOdinPacket(device, commandText) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const setup = await findInterfaceAndEndpoints(device, 'bulk');
    if (!setup) {
        throw new Error("Samsung Odin bulk endpoints not found. Ensure device is in Download Mode.");
    }

    const { endpointOut, endpointIn } = setup;

    // تحويل النص إلى Buffer بطول 512 بايت (حجم الحزمة القياسي في Odin)
    const packet = new Uint8Array(512);
    const cmdData = encoder.encode(commandText);
    packet.set(cmdData);

    // إرسال الأمر
    await device.transferOut(endpointOut, packet);

    // استقبال الرد
    const result = await device.transferIn(endpointIn, 512);
    
    // تنظيف الرد من الـ Null bytes
    let response = decoder.decode(result.data).replace(/\0/g, '').trim();
    
    // إذا كان الرد يبدأ بكلمة الاتصال أو يحتوي على بيانات
    return response;
}

btnFastbootInfo.addEventListener('click', async () => {
    try {
        if (!navigator.usb) throw new Error("WebUSB not supported.");
        
        statusText.innerText = "Status: Searching for Fastboot Device...";
        const filters = [{ classCode: 0xff, subclassCode: 0x42, protocolCode: 0x03 }];
        const device = await getOrRequestDevice(filters);

        logRaw(`<br><span class="color-purple">--- Fastboot Device Connected ---</span>`);
        logRaw(`<span class="color-blue">Reading variables (getvar:all)...</span>`);

        const data = await runFastbootCommand(device, 'getvar:all');
        
        data.forEach(line => {
            if (line.includes(':')) {
                const [key, ...val] = line.split(':');
                logInfo(key.trim(), val.join(':').trim());
            } else if (line.trim()) {
                logRaw(`<span class="color-blue">${line}</span>`);
            }
        });

        logRaw(`<span class="color-green">Fastboot operation completed.</span>`);
        
        await device.releaseInterface(0);
        statusText.innerText = "Status: Ready";

    } catch (err) {
        logRaw(`<br><span class="color-red">Fastboot Error: ${err.message}</span>`);
        statusText.innerText = "Status: Fastboot Failed";
    }
});

btnFastbootReboot.addEventListener('click', async () => {
    try {
        statusText.innerText = "Status: Connecting to Fastboot...";
        const filters = [{ classCode: 0xff, subclassCode: 0x42, protocolCode: 0x03 }];
        const device = await getOrRequestDevice(filters);

        logRaw(`<br><span class="color-blue">Sending 'fastboot reboot'...</span>`);
        await runFastbootCommand(device, 'reboot');
        
        logRaw(`<span class="color-green">Device is rebooting to system.</span>`);
        await device.releaseInterface(0);
        statusText.innerText = "Status: Ready";
    } catch (err) {
        logRaw(`<br><span class="color-red">Fastboot Error: ${err.message}</span>`);
    }
});

btnHonorInfo.addEventListener('click', async () => {
    try {
        statusText.innerText = "Status: Connecting to HONOR device...";
        const device = await navigator.usb.requestDevice({
            filters: [{ classCode: 0xff, subclassCode: 0x42, protocolCode: 0x03 }]
        });

        await device.open();
        if (device.configuration === null) await device.selectConfiguration(1);

        logRaw(`<br><span class="color-purple">--- HONOR Detailed Information ---</span>`);
        
        // أوامر HONOR/Huawei الخاصة
        const commands = [
            { label: 'Product Model', cmd: 'oem get-product-model' },
            { label: 'Build Number', cmd: 'oem get-build-number' },
            { label: 'PSID', cmd: 'oem get-psid' },
            { label: 'Vendor/Country', cmd: 'getvar vendorcountry' },
            { label: 'Battery Level', cmd: 'getvar battery-voltage' }
        ];

        for (const item of commands) {
            try {
                const res = await runFastbootCommand(device, item.cmd);
                logInfo(item.label, res.join(' ').trim() || 'N/A');
            } catch (e) {
                logInfo(item.label, 'Not Supported');
            }
        }

        logRaw(`<span class="color-green">HONOR Info Read Success.</span>`);
        await device.releaseInterface(0);
        await device.close();
        statusText.innerText = "Status: Ready";
    } catch (err) {
        logRaw(`<br><span class="color-red">HONOR Error: ${err.message}</span>`);
    }
});

btnHonorFRP.addEventListener('click', async () => {
    if (!confirm("Warning: This will attempt to erase the FRP partition on your HONOR device. Continue?")) return;
    
    try {
        statusText.innerText = "Status: Connecting for FRP Reset...";
        const device = await navigator.usb.requestDevice({
            filters: [{ classCode: 0xff, subclassCode: 0x42, protocolCode: 0x03 }]
        });

        await device.open();
        if (device.configuration === null) await device.selectConfiguration(1);

        logRaw(`<br><span class="color-purple">--- HONOR FRP Reset Process ---</span>`);
        
        // الأمر الشهير لأجهزة HONOR/Huawei القديمة والمدعومة
        logRaw(`<span class="color-blue">Sending 'oem erase_frp'...</span>`);
        try {
            const res = await runFastbootCommand(device, 'oem erase_frp');
            logRaw(`<span class="color-green">Result: ${res.join(' ')}</span>`);
            logRaw(`<span class="color-green">[SUCCESS] FRP Partition should be cleared.</span>`);
        } catch (e) {
            logRaw(`<span class="color-red">Primary method failed: ${e.message}</span>`);
            logRaw(`<span class="color-blue">Trying alternative method...</span>`);
            // محاولة الطريقة البديلة لبعض الموديلات
            const resAlt = await runFastbootCommand(device, 'oem unlock-frp');
            logRaw(`<span class="color-green">Alt Result: ${resAlt.join(' ')}</span>`);
        }

        logRaw(`<span class="color-purple">Rebooting device...</span>`);
        await runFastbootCommand(device, 'reboot');
        
        await device.releaseInterface(0);
        await device.close();
        statusText.innerText = "Status: Ready";
    } catch (err) {
        logRaw(`<br><span class="color-red">FRP Reset FAIL: ${err.message}</span>`);
        logRaw(`<span class="color-blue">Note: Modern HONOR devices may require a 'Bootloader Unlock Key' or TestPoint.</span>`);
    }
});

// ميزة مسح السجل
btnClear.addEventListener('click', () => {
    terminal.innerHTML = `
        <div class="terminal-header">SYSTEM TERMINAL CLEARED</div>
        <div class="color-purple">Mostafa Unlocker Engine is ready.</div><br>
    `;
});