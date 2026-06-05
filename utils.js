export const terminal = document.getElementById('terminal');
export const statusText = document.getElementById('statusText');

export function logRaw(html) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = html;
    terminal.appendChild(entry);
    terminal.scrollTop = terminal.scrollHeight;
}

export function logInfo(label, value) {
    logRaw(`
        <div class="info-row">
            <div class="info-label">${label}</div>
            <div class="info-colon">:</div>
            <div class="info-value">${value}</div>
        </div>
    `);
}

export function setButtonsState(enabled) {
    // الأزرار التي يجب التحكم في حالتها أثناء تنفيذ العمليات (Busy State)
    const actionButtons = [
        'btnConnect', 'btnReadInfo', 'btnKnox', 'btnAppManager', 'btnFRP', 
        'btnReboot', 'btnDownload', 'btnFastboot', 'btnRecovery',
        'btnMTP', 'btnReadDownloadInfo', 'btnDownloadReboot',
        'btnApple', 'btnEnterRecovery', 'btnExitRecovery',
        'btnFastbootInfo', 'btnFastbootReboot', 'btnHonorInfo', 'btnHonorFRP',
        'btnADBMenu', 'btnRebootMenu', 'btnFastbootMenu',
        'btnDownloadMenu', 'btnAppleMenu', 'btnCustomAdbMenu',
        'btnExecuteCustomAdb', 'btnExecuteCustomFastboot', 'btnClear'
    ];
    
    actionButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = !enabled;
            if (enabled) btn.classList.remove('disabled-link');
            else btn.classList.add('disabled-link');
        }
    });
}

export function setActiveUsbDevice(device) {
    activeUsbDevice = device;
}

export let activeUsbDevice = null;
export async function getOrRequestDevice(filters) {
    // التحقق مما إذا كان الجهاز الحالي هو المطلوب ومفتوح بالفعل
    if (activeUsbDevice && activeUsbDevice.opened) {
        const isMatch = filters.some(f => f.vendorId === activeUsbDevice.vendorId && 
                        (!f.productId || f.productId === activeUsbDevice.productId));
        if (isMatch) return activeUsbDevice;
    }

    // إذا كان هناك جهاز مختلف مفتوح، نغلقه
    if (activeUsbDevice) {
        try { 
            if (activeUsbDevice.opened) await activeUsbDevice.close(); 
        } catch(e) {}
    }

    const pairedDevices = await navigator.usb.getDevices();
    let device = pairedDevices.find(d => filters.some(f => 
        f.vendorId === d.vendorId && (!f.productId || f.productId === d.productId)
    ));

    if (!device) device = await navigator.usb.requestDevice({ filters });
    
    await device.open();
    activeUsbDevice = device;
    return device;
}

export async function findInterfaceAndEndpoints(device, type = 'bulk') {
    try {
        if (!device.configuration) await device.selectConfiguration(1);
    } catch (e) { console.warn("Config error", e); }

    for (const iface of device.configuration.interfaces) {
        for (const alt of iface.alternates) {
            const outEp = alt.endpoints.find(e => e.direction === 'out' && e.type === type);
            const inEp = alt.endpoints.find(e => e.direction === 'in' && e.type === type);
            
            if (outEp && inEp) {
                try {
                    // التحقق مما إذا كانت الواجهة محجوزة بالفعل لتجنب خطأ State Change
                    if (!iface.claimed) {
                        await device.claimInterface(iface.interfaceNumber);
                    }
                    
                    // تحديد الوضع البديل فقط إذا لم يكن هو الوضع النشط حالياً
                    await device.selectAlternateInterface(iface.interfaceNumber, alt.alternateSetting);
                    
                    return {
                        interfaceNumber: iface.interfaceNumber,
                        endpointOut: outEp.endpointNumber,
                        endpointIn: inEp.endpointNumber
                    };
                } catch (e) {
                    console.warn(`Interface ${iface.interfaceNumber} busy, skipping...`);
                    continue;
                }
            }
        }
    }
    return null;
}

// وظيفة التحديث الدوري لحالة الجهاز
export async function autoDetectTask() {
    try {
        const devices = await navigator.usb.getDevices();
        if (devices.length > 0) {
            const dev = devices[0];
            const mode = dev.opened ? "Active" : "Ready";
            statusText.innerHTML = `Status: <span class="color-green">${dev.productName || 'Device'} [${mode}]</span>`;
        } else {
            // لا نغير حالة الأزرار هنا لنسمح بالاتصال التلقائي عند الضغط
            if (!statusText.innerText.includes("Error") && !statusText.innerText.includes("Reading")) {
                statusText.innerText = "Status: Waiting for device...";
            }
        }
    } catch (e) {}
}