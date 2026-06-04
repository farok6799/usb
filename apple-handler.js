import { logRaw, logInfo, statusText, setActiveUsbDevice } from './utils.js';

export async function readAppleInfo() {
    try {
        if (!navigator.usb) throw new Error("WebUSB not supported.");

        statusText.innerText = "Status: Searching for Apple Device...";
        
        // فلتر خاص بأجهزة Apple في الوضع العادي
        const device = await navigator.usb.requestDevice({
            filters: [{ vendorId: 0x05ac }]
        });

        await device.open();
        setActiveUsbDevice(device);

        logRaw(`<br><span class="color-purple">—————————————————————————————————————</span>`);
        logRaw(`<span class="color-purple">    APPLE DEVICE IDENTIFIER ACTIVE    </span>`);
        logRaw(`<span class="color-purple">—————————————————————————————————————</span>`);
        
        const isNormalMode = device.productId === 0x12a8 || device.productId === 0x12a0;
        const isRecoveryMode = device.productId === 0x1281;
        const modeName = isNormalMode ? "Normal Mode" : (isRecoveryMode ? "Recovery Mode" : "Technical Mode");

        logRaw(`<span class="color-green">Device Connected: ${device.productName || 'Apple Device'} (${modeName})</span>`);

        let udid = device.serialNumber;
        
        logRaw(`<br><span class="color-purple">--- Apple Device Info ---</span>`);
        logInfo('Device', device.productName || 'iPhone / iPad');
        logInfo('Mode', modeName);

        // تحويل وتفكيك بيانات الـ Recovery المعقدة
        if (isRecoveryMode && udid.includes('CPID')) {
            const parts = udid.split(' ');
            const info = {};
            parts.forEach(p => {
                const [k, v] = p.split(':');
                if (k && v) info[k] = v.replace('[', '').replace(']', '');
            });
            
            logInfo('Model ID (CPID)', info.CPID || 'N/A');
            logInfo('ECID (Hex)', info.ECID || 'N/A');
            logInfo('Serial (SRNM)', info.SRNM || 'N/A');
            logInfo('Board ID (BDID)', info.BDID || 'N/A');
        } else {
            logInfo('UDID / Serial', udid);
        }

        logInfo('USB Version', `${device.usbVersionMajor}.${device.usbVersionMinor}`);
        logInfo('Vendor ID', '0x' + device.vendorId.toString(16).toUpperCase());
        logInfo('Product ID', '0x' + device.productId.toString(16).toUpperCase());

        if (isNormalMode) {
            logRaw(`<br><span class="color-blue"><b>[Note]</b> Browser security prevents deep reading in Normal Mode even with 'Trust'.</span>`);
            logRaw(`<span class="color-blue">To see IMEI/iOS Version: Put device into <b>Recovery Mode</b>.</span>`);
        } else {
            logRaw(`<br><span class="color-green">Device is in technical mode. Deep scanning available.</span>`);
        }

        logRaw(`<br><span class="color-green">Apple info read successfully.</span>`);

        statusText.innerText = "Status: Ready";
        
        // تحرير الجهاز لضمان عدم تعليقه
        await device.close().catch(() => {});
        setActiveUsbDevice(null);

    } catch (e) {
        logRaw(`<br><span class="color-red">Apple Read Error: ${e.message}</span>`);
        logRaw(`<span class="color-blue">Note: If device is not detected, try closing iTunes or any Apple tools.</span>`);
        statusText.innerText = "Status: Error";
    }
}

export async function exitAppleRecovery() {
    try {
        if (!navigator.usb) throw new Error("WebUSB not supported.");

        statusText.innerText = "Status: Searching for Apple Recovery Device...";
        
        // Product ID 0x1281 هو المعرف القياسي لوضع الـ Recovery في Apple
        const device = await navigator.usb.requestDevice({
            filters: [{ vendorId: 0x05ac, productId: 0x1281 }]
        });

        await device.open();
        
        // خطوة حاسمة: التأكد من اختيار الـ Configuration قبل الـ Claim
        if (device.configuration === null) await device.selectConfiguration(1);
        
        setActiveUsbDevice(device);

        logRaw(`<br><span class="color-purple">—————————————————————————————————————</span>`);
        logRaw(`<span class="color-purple">    APPLE RECOVERY CONTROL ACTIVE     </span>`);
        logRaw(`<span class="color-purple">—————————————————————————————————————</span>`);

        logRaw(`<span class="color-blue">[Action] Sending Reboot command to exit Recovery...</span>`);

        // المطالبة بالواجهة رقم 0 (الخاصة بـ iRecovery)
        await device.claimInterface(0);

        const encoder = new TextEncoder();
        const data = encoder.encode("reboot\0"); // الأمر القياسي لإعادة التشغيل في iRecovery

        // إرسال الأمر عبر Control Transfer (Vendor Request)
        await device.controlTransferOut({
            requestType: 'vendor',
            recipient: 'device',
            request: 0,
            value: 0,
            index: 0
        }, data);

        // إرسال طلب تصفير الحالة لضمان تنفيذ الأمر
        await device.controlTransferOut({
            requestType: 'vendor',
            recipient: 'device',
            request: 0,
            value: 0,
            index: 0
        }, new Uint8Array(0));

        logRaw(`<span class="color-green">[Success] Exit Recovery command sent. Device is restarting.</span>`);
        statusText.innerText = "Status: Ready";

        await device.close().catch(() => {});
        setActiveUsbDevice(null);

    } catch (e) {
        logRaw(`<br><span class="color-red"><b>Error:</b> ${e.message}</span>`);
        logRaw(`<span class="color-blue"><b>Solution for Windows:</b><br>1. Open Zadig<br>2. Select 'Apple Mobile Device (Recovery Mode)'<br>3. Replace driver with <b>WinUSB</b> and try again.</span>`);
        statusText.innerText = "Status: Error";
    }
}