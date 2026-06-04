export const terminal = document.getElementById('terminal');
export const statusText = document.getElementById('statusText');

export function logRaw(html) {
    const entry = document.createElement('div');
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

export async function setButtonsState(enabled) {
    const btnRebootMenu = document.getElementById('btnRebootMenu');
    if (btnRebootMenu) btnRebootMenu.disabled = !enabled;
    
    const actionButtons = [
        document.getElementById('btnKnox'),
        document.getElementById('btnAppManager'),
        document.getElementById('btnFRP')
    ];
    actionButtons.forEach(btn => {
        if (!btn) return;
        if (enabled) btn.classList.remove('disabled-link');
        else btn.classList.add('disabled-link');
    });
}

export function setActiveUsbDevice(device) {
    activeUsbDevice = device;
}

export let activeUsbDevice = null;
export async function getOrRequestDevice(filters) {
    // 1. البحث عن جهاز متصل ومفتوح بالفعل
    if (activeUsbDevice && activeUsbDevice.opened) return activeUsbDevice;

    // 2. ابحث في الأجهزة المقترنة مسبقاً
    const pairedDevices = await navigator.usb.getDevices();
    let device = pairedDevices.find(d =>
        filters.some(f => (f.vendorId === d.vendorId && (!f.productId || f.productId === d.productId)))
    );

    // 3. إذا لم يوجد، اطلب من المستخدم اختيار جهاز
    if (!device) {
        device = await navigator.usb.requestDevice({ filters });
    }
    
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
                    // خطوة حاسمة لـ OTG: المطالبة بالواجهة وتحديد الوضع البديل (كما في الملف القديم)
                    await device.claimInterface(iface.interfaceNumber);
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