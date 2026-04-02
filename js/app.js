/**
 * Main Application Logic for GitHub Pages Frontend
 * Shirt Booking System - งานวันสหกรณ์แห่งชาติ
 * Updated: Support SS-7XL sizes and Sponsor Amount
 */

// ===== Global State =====
let allBookings = [];
let selectedColor = '';
let currentPaymentCoop = null;
let isAdmin = false;
let editingBookingId = null;
let pinAction = '';
let appSettings = {
    EVENT_NAME: 'งานวันสหกรณ์แห่งชาติ ประจำปี พ.ศ. 2569',
    IS_BOOKING_OPEN: true,
    SHIRT_PRICE: 300,
    FLOWER_PRICE: 600,
    TABLE_PRICE: 3000
};

let currentProofUrls = [];
let currentUrlIndex = 0;

let statusCurrentPage = 1;
let summaryCurrentPage = 1;
let paymentCurrentPage = 1;

let statusSearchQuery = '';
let summarySearchQuery = '';
let paymentSearchQuery = '';

const colorEmoji = { 'green': '🟢', 'blue': '🔵', 'purple': '🟣', 'pink': '💗' };
const colorName = { 'green': 'สีเขียว', 'blue': 'สีฟ้า', 'purple': 'สีม่วง', 'pink': 'สีชมพู' };
const searchColorMap = { 'green': 'เขียว', 'blue': 'ฟ้า', 'purple': 'ม่วง', 'pink': 'ชมพู' };

// ===== Initialization =====
async function init() {
    showLoading(true);
    try {
        const settingsResult = await ApiClient.getSettings();
        if (settingsResult.isOk) {
            appSettings = settingsResult.settings || {};
            // Dynamic data from relational schema
            window.activeEvent = settingsResult.activeEvent;
            window.availableActivities = settingsResult.activities || [];
            window.availableColors = settingsResult.colors || [];
            window.allEvents = settingsResult.allEvents || [];
        }
        
        const data = await ApiClient.getBookingData();
        applyConfig();
        onDataLoaded(data);
        renderDynamicForm(); // Generate the form fields dynamically
    } catch (error) {
        onLoadError(error);
    }
    checkAdminState();
}

function onDataLoaded(data) {
    showLoading(false);
    allBookings = data || [];
    updateSummaryTab();
    updatePublicStatusTable();
    updatePaymentTable();
    if (currentPaymentCoop && currentPaymentCoop.id) {
        loadPaymentInfo(currentPaymentCoop.id);
    }
}

function onLoadError(error) {
    showLoading(false);
    showToast('ไม่สามารถโหลดข้อมูลได้: ' + error.message, 'error');
}

function applyConfig() {
    const displayEventName = (window.activeEvent && window.activeEvent.name) || appSettings.EVENT_NAME || CONFIG.EVENT_NAME;
    document.getElementById('systemTitle').textContent = displayEventName;
    document.getElementById('eventName').textContent = CONFIG.SYSTEM_TITLE;
    
    // Update booking form visibility based on settings
    const bookingFormWrapper = document.getElementById('bookingFormWrapper');
    const bookingClosedDiv = document.getElementById('bookingClosedMessage');
    
    const isBookingOpen = appSettings.IS_BOOKING_OPEN === 'true' || appSettings.IS_BOOKING_OPEN === true;
    
    if (isBookingOpen || isAdmin) {
        if (bookingFormWrapper) bookingFormWrapper.classList.remove('hidden');
        if (bookingClosedDiv) bookingClosedDiv.classList.add('hidden');
    } else {
        if (bookingFormWrapper) bookingFormWrapper.classList.add('hidden');
        if (bookingClosedDiv) bookingClosedDiv.classList.remove('hidden');
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) overlay.classList.remove('hidden');
    else overlay.classList.add('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `${icon} ${message}`;
    document.body.appendChild(toast);
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-exit'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function showMessageModal(title, message, type = 'info') {
    const modal = document.getElementById('messageModal');
    const titleEl = document.getElementById('msgModalTitle');
    const bodyEl = document.getElementById('msgModalBody');
    const iconEl = document.getElementById('msgModalIcon');

    titleEl.textContent = title;
    bodyEl.innerHTML = message; // Allow HTML for breaks

    // Style based on type
    if (type === 'error') {
        iconEl.className = 'mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4 text-red-600';
        iconEl.innerHTML = '<span class="text-3xl">🚫</span>';
    } else if (type === 'success') {
        iconEl.className = 'mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4 text-green-600';
        iconEl.innerHTML = '<span class="text-3xl">✅</span>';
    } else {
        iconEl.className = 'mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4 text-blue-600';
        iconEl.innerHTML = '<span class="text-3xl">ℹ️</span>';
    }

    modal.classList.remove('hidden');
}

// ===== Admin Logic =====
let footerClickCount = 0;
let footerClickTimer = null;

function handleFooterClick() {
    footerClickCount++;
    if (footerClickTimer) clearTimeout(footerClickTimer);
    footerClickTimer = setTimeout(() => { footerClickCount = 0; }, 1000);
    if (footerClickCount >= 5) { toggleAdmin(); footerClickCount = 0; }
}

function toggleAdmin() {
    if (isAdmin) {
        isAdmin = false;
        localStorage.setItem('isAdmin', 'false');
        showToast('ออกจากระบบ Admin แล้ว');
        updateAdminUI();
    } else {
        document.getElementById('adminLoginModal').classList.remove('hidden');
    }
}

async function checkAdminPin() {
    const pin = document.getElementById('adminPin').value;
    if (!pin) { showToast('กรุณากรอกรหัสผ่าน', 'error'); return; }
    showLoading(true);
    try {
        const result = await ApiClient.verifyAdminPin(pin);
        showLoading(false);
        if (result.isOk) {
            isAdmin = true;
            localStorage.setItem('isAdmin', 'true');
            document.getElementById('adminLoginModal').classList.add('hidden');
            document.getElementById('adminPin').value = '';
            showToast('เข้าสู่ระบบ Admin สำเร็จ', 'success');
            updateAdminUI();
        } else {
            showToast(result.error || 'รหัสผ่านไม่ถูกต้อง', 'error');
        }
    } catch (error) {
        showLoading(false);
        showToast('Connection error: ' + error.message, 'error');
    }
}

function checkAdminState() {
    if (localStorage.getItem('isAdmin') === 'true') isAdmin = true;
    updateAdminUI();
}

function updateAdminUI() {
    const summaryTabBtn = document.getElementById('tab-summary');
    const settingsTabBtn = document.getElementById('tab-settings');
    if (isAdmin) {
        summaryTabBtn?.classList.remove('hidden');
        settingsTabBtn?.classList.remove('hidden');
    } else {
        summaryTabBtn?.classList.add('hidden');
        settingsTabBtn?.classList.add('hidden');
        if (!document.getElementById('content-summary').classList.contains('hidden') || 
            !document.getElementById('content-settings').classList.contains('hidden')) {
            switchTab('booking');
        }
    }

    if (!document.getElementById('content-payment').classList.contains('hidden')) {
        if (!document.getElementById('paymentDetailModal').classList.contains('hidden') && currentPaymentCoop) renderPaymentInfo();
    }
}

function switchTab(tab) {
    document.querySelectorAll('[id^="content-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById('content-' + tab).classList.remove('hidden');
    document.querySelectorAll('[id^="tab-"]').forEach(el => el.classList.remove('ring-4', 'ring-yellow-400'));
    document.getElementById('tab-' + tab).classList.add('ring-4', 'ring-yellow-400');
    
    if (tab === 'summary') updateSummaryTab();
    else if (tab === 'payment') { 
        updatePaymentTable(); 
        const searchInput = document.getElementById('paymentSearchInput');
        if (searchInput) {
            searchInput.value = ''; 
            filterPaymentTable(''); 
        }
    }
    else if (tab === 'status') updatePublicStatusTable();
    else if (tab === 'settings') renderSettings();
    
    window.scrollTo(0, 0);
}

/**
 * Render the booking form dynamically based on activities from Google Sheets
 */
function renderDynamicForm() {
    const container = document.getElementById('dynamicBookingForm');
    if (!container) return;

    if (!window.activeEvent) {
        container.innerHTML = `<div class="text-center py-12 text-gray-500">🚫 ไม่พบกิจกรรมที่เปิดอยู่ในขณะนี้</div>`;
        document.getElementById('formActions').classList.add('hidden');
        return;
    }

    let html = `
        <h2 class="text-3xl font-extrabold text-gray-900 mb-2 drop-shadow-sm flex items-center gap-3">
            <span class="text-indigo-600">📝</span> ลงทะเบียนจองกิจกรรม
        </h2>
        <p class="text-gray-500 mb-8 border-l-4 border-indigo-500 pl-4 py-1">กรุณากรอกข้อมูลให้ครบถ้วนเพื่อผลประโยชน์ของท่าน</p>

        <!-- Step 1: Coop Info -->
        <div class="card p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <label class="block text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span class="bg-indigo-100 text-indigo-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                ข้อมูลพื้นฐาน
            </label>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                    <label class="block text-sm font-semibold text-gray-600">ชื่อสหกรณ์ / สังกัด</label>
                    <input type="text" id="coopName" placeholder="กรอกชื่อสหกรณ์"
                        class="w-full px-5 py-3.5 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-all placeholder:text-gray-300">
                </div>
                <div class="space-y-2">
                    <label class="block text-sm font-semibold text-gray-600">เบอร์โทรศัพท์มือถือที่ติดต่อได้</label>
                    <input type="tel" id="bookingPin" placeholder="กรอกเบอร์โทรศัพท์ 10 หลัก (ไม่มีขีด -)"
                        maxlength="10"
                        class="w-full px-5 py-3.5 border-2 border-yellow-200 bg-yellow-50/30 rounded-xl focus:border-indigo-500 focus:outline-none transition-all font-mono"
                        oninput="this.value = this.value.replace(/[^0-9]/g, '');">
                    <p class="text-xs text-amber-600 italic">* ใช้ยืนยันตัวตนเมื่อต้องการเข้าสู่ระบบสมาชิก</p>
                </div>
            </div>
        </div>

        <!-- Step 2: Team Color -->
        <div class="card p-6 bg-white rounded-2xl shadow-sm border border-gray-100 mt-6">
            <label class="block text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span class="bg-indigo-100 text-indigo-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                เลือกสีทีมกีฬา
            </label>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">`;

    // Dynamic Colors
    window.availableColors.forEach(color => {
        html += `
                <button onclick="selectColor('${color.id}')"
                    class="color-btn p-4 rounded-2xl border-4 border-transparent hover:border-indigo-200 transition-all group relative overflow-hidden"
                    data-color="${color.id}">
                    <div class="w-full h-16 ${color.class || 'bg-gray-500'} rounded-xl mb-3 shadow-inner transform group-hover:scale-105 transition-transform"></div>
                    <p class="font-bold text-center text-gray-700">${color.emoji || ''} ${color.name}</p>
                </button>`;
    });

    html += `
            </div>
        </div>`;

    // Step 3+: Activities
    window.availableActivities.forEach((act, index) => {
        const stepNum = index + 3;
        html += `
        <div class="card p-6 bg-white rounded-2xl shadow-sm border border-gray-100 mt-6 activity-section" data-activity-id="${act.id}" data-type="${act.type}">
            <label class="block text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                <span class="bg-indigo-100 text-indigo-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">${stepNum}</span>
                ${act.name}
            </label>
            <p class="text-sm text-gray-500 mb-6 bg-indigo-50 inline-block px-3 py-1 rounded-full border border-indigo-100">
                🏷️ ราคาชิ้นละ <strong>${act.price.toLocaleString()}</strong> บาท
            </p>`;

        if (act.type === 'Sizeable') {
            html += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">`;
            act.options.forEach(option => {
                html += `
                    <div class="space-y-1.5 group">
                        <div class="flex justify-between items-center px-1">
                            <label class="block text-sm font-bold text-gray-700 group-hover:text-indigo-600 transition-colors uppercase">${option}</label>
                            <button type="button" onclick="showSizeGuide('${act.id}', '${option}')" class="text-[10px] text-gray-400 hover:text-indigo-500 transition-colors">📏 Guide</button>
                        </div>
                        <input type="number" data-option="${option}" min="0" placeholder="0"
                            class="activity-input w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-all text-center font-bold">
                    </div>`;
            });
            html += `</div>`;
        } else {
            html += `
                <div class="max-w-xs">
                    <input type="number" min="0" placeholder="ระบุจำนวนที่ต้องการ"
                        class="activity-input w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-all font-bold text-lg">
                    <p class="text-xs text-gray-400 mt-2 ml-1">* หากไม่ต้องการ ระบุเป็น 0 หรือปล่อยว่าง</p>
                </div>`;
        }
        html += `</div>`;
    });

    // Final Step: Sponsor
    const nextStep = (window.availableActivities.length || 0) + 3;
    html += `
        <div class="card p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-sm border border-green-100 mt-6">
            <label class="block text-xl font-bold text-green-800 mb-2 flex items-center gap-2">
                <span class="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">${nextStep}</span>
                เงินสนับสนุนกิจกรรม (กองกลาง)
            </label>
            <p class="text-sm text-green-700 mb-6 bg-white/50 inline-block px-3 py-1 rounded-full border border-green-200 italic">
                * ระบุจำนวนเงินสำหรับสนับสนุนการจัดงาน (ตามความสมัครใจ)
            </p>
            <div class="max-w-md relative group">
                <span class="absolute left-5 top-1/2 -translate-y-1/2 text-green-600 font-bold text-xl group-focus-within:scale-110 transition-transform">฿</span>
                <input type="number" id="sponsorAmount" min="0" placeholder="ระบุจำนวนเงิน (บาท)"
                    class="w-full pl-12 pr-6 py-4.5 border-2 border-green-200 rounded-2xl focus:border-green-600 focus:outline-none transition-all font-bold text-xl text-green-800">
            </div>
        </div>
    `;

    container.innerHTML = html;
    document.getElementById('formActions').classList.remove('hidden');
}

/**
 * Placeholder for size guide - can be updated to fetch from Activities table later
 */
function showSizeGuide(activityId, option) {
    if (activityId !== 'SHIRT') return;
    const guides = {
        'SS': 'อก 34" / ยาว 25"',
        'S': 'อก 36" / ยาว 26"',
        'M': 'อก 38" / ยาว 27"',
        'L': 'อก 40" / ยาว 28"',
        'XL': 'อก 42" / ยาว 29"',
        '2XL': 'อก 44" / ยาว 30"',
        '3XL': 'อก 46" / ยาว 31"',
        '4XL': 'อก 48" / ยาว 32"',
        '5XL': 'อก 50" / ยาว 33"',
        '6XL': 'อก 52" / ยาว 34"',
        '7XL': 'อก 54" / ยาว 35"',
        'Special': 'อก 63" / ยาว 25"'
    };
    const guide = guides[option] || 'ไม่พบข้อมูลไซส์';
    document.getElementById('sizeDetailContent').innerHTML = `<div class="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-center"><p class="text-gray-500 mb-1">สัดส่วนไซส์ ${option}</p><p class="text-2xl font-bold text-indigo-700">${guide}</p></div>`;
    document.getElementById('sizeDetailModal').classList.remove('hidden');
}

function selectColor(color) {
    selectedColor = color;
    document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('ring-4', 'ring-indigo-500', 'bg-indigo-50'));
    document.querySelector(`[data-color="${color}"]`).classList.add('ring-4', 'ring-indigo-500', 'bg-indigo-50');
}

// ===== Booking Form =====
let isPhoneVerified = false;  // Track if phone has been verified

async function previewBooking() {
    if (!appSettings.IS_BOOKING_OPEN && !isAdmin) {
        showBookingClosedModal();
        return;
    }
    const coopName = document.getElementById('coopName').value.trim();
    const bookingPin = document.getElementById('bookingPin').value.trim();
    if (!coopName) { showToast('กรุณากรอกชื่อสหกรณ์', 'error'); return; }
    if (!bookingPin || bookingPin.length !== 10) { showToast('กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก', 'error'); return; }
    if (!selectedColor) { showToast('กรุณาเลือกสีทีมกีฬา', 'error'); return; }

    // Check blocked phone...
    if (!editingBookingId && !isPhoneVerified) {
        showLoading(true);
        try {
            const result = await ApiClient.checkBlockedPhone(bookingPin);
            showLoading(false);
            if (result.isBlocked) { showBlockedPhoneModal(); return; }
            isPhoneVerified = true;
        } catch (error) { showLoading(false); }
    }

    // Collect Dynamic Items
    const items = [];
    let totalCost = 0;
    const activitySections = document.querySelectorAll('.activity-section');
    
    let itemsHTML = '';
    activitySections.forEach(section => {
        const actId = section.dataset.activityId;
        const actType = section.dataset.type;
        const activity = window.availableActivities.find(a => a.id === actId);
        if (!activity) return;

        let actSubtotal = 0;
        let actItemsHTML = '';

        const inputs = section.querySelectorAll('.activity-input');
        inputs.forEach(input => {
            const qty = parseInt(input.value) || 0;
            if (qty > 0) {
                const option = input.dataset.option || '';
                const price = activity.price;
                items.push({
                    activity_id: actId,
                    activity_name: activity.name,
                    option: option,
                    quantity: qty,
                    price: price
                });
                actSubtotal += (qty * price);
                actItemsHTML += `<p class="ml-4">• ${option ? option + ': ' : ''}${qty} หน่วย</p>`;
            }
        });

        if (actSubtotal > 0) {
            itemsHTML += `
                <div class="mt-3">
                    <p class="font-bold text-indigo-700">${activity.name}:</p>
                    ${actItemsHTML}
                    <p class="text-right text-sm text-gray-500">รวม: ${actSubtotal.toLocaleString()} บาท</p>
                </div>
                <hr class="my-2 border-dashed border-gray-200">
            `;
            totalCost += actSubtotal;
        }
    });

    const sponsorAmount = parseInt(document.getElementById('sponsorAmount').value) || 0;
    totalCost += sponsorAmount;

    const color = window.availableColors.find(c => c.id === selectedColor);
    const colorDisplayName = color ? `${color.emoji || ''} ${color.name}` : selectedColor;

    let previewHTML = `
        <div class="space-y-3 text-gray-700 bg-gray-50 p-6 rounded-2xl border border-gray-200">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-y-2">
                <p><strong>เบอร์โทรศัพท์:</strong> <span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-mono">${bookingPin}</span></p>
                <p><strong>สีทีม:</strong> <span class="font-bold">${colorDisplayName}</span></p>
                <p class="md:col-span-2"><strong>สหกรณ์:</strong> <span class="text-lg font-bold text-gray-900">${coopName}</span></p>
            </div>
            
            <div class="pt-4 border-t border-gray-200">
                <p class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">รายการที่เลือก:</p>
                ${itemsHTML || '<p class="text-center py-4 text-gray-400 italic">ไม่ได้เลือกรายการใดๆ</p>'}
            </div>

            ${sponsorAmount > 0 ? `
            <div class="pt-2">
                <p class="font-bold text-green-700">เงินสนับสนุนกิจกรรม:</p>
                <p class="text-right text-lg font-bold text-green-800">+ ${sponsorAmount.toLocaleString()} บาท</p>
            </div>` : ''}
        </div>
    `;

    // Store items for confirmBooking
    window.currentPreviewItems = items;
    window.currentPreviewTotal = totalCost;

    document.getElementById('previewContent').innerHTML = previewHTML;
    document.getElementById('previewTotal').textContent = totalCost.toLocaleString();
    document.getElementById('previewModal').classList.remove('hidden');
}

async function confirmBooking() {
    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn.disabled) return;
    
    confirmBtn.disabled = true;
    const originalContent = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<div class="spinner mx-auto border-white"></div>';

    const coopName = document.getElementById('coopName').value.trim();
    const bookingPin = document.getElementById('bookingPin').value.trim();
    const sponsorAmount = parseInt(document.getElementById('sponsorAmount').value) || 0;
    const totalAmount = window.currentPreviewTotal || 0;
    const items = window.currentPreviewItems || [];

    const color = window.availableColors.find(c => c.id === selectedColor);
    const colorNameText = color ? color.name : selectedColor;

    const bookingData = {
        id: editingBookingId || null, // Backend will generate if null
        event_id: window.activeEvent ? window.activeEvent.id : null,
        pin: bookingPin,
        coop_name: coopName,
        coop_color: selectedColor,
        coop_color_name: colorNameText,
        sponsor_amount: sponsorAmount,
        total_amount: totalAmount,
        payment_status: 'รอชำระ',
        items: items
    };

    try {
        let result = editingBookingId ? await ApiClient.updateBooking(bookingData) : await ApiClient.createBooking(bookingData);
        if (result.isOk) {
            showToast(editingBookingId ? 'แก้ไขข้อมูลสำเร็จ!' : 'บันทึกข้อมูลสำเร็จ!', 'success');
            closePreview(); resetForm(); updatePaymentTable(); init();
        } else { 
            showToast('เกิดข้อผิดพลาด: ' + result.error, 'error'); 
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalContent;
        }
    } catch (error) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalContent;
        showToast('Connection error: ' + error.message, 'error');
    }
}

function resetForm() {
    document.getElementById('coopName').value = '';
    const pinInput = document.getElementById('bookingPin');
    pinInput.value = ''; pinInput.disabled = false; pinInput.classList.remove('bg-gray-100');
    
    // Clear all dynamic activity inputs
    document.querySelectorAll('.activity-input').forEach(input => {
        input.value = '';
    });
    
    document.getElementById('sponsorAmount').value = '';
    editingBookingId = null; selectedColor = '';
    isPhoneVerified = false;  // Reset phone verification when form is cleared
    document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('ring-4', 'ring-indigo-500', 'bg-indigo-50'));
}

// ===== Booking Closed Modal =====
function showBookingClosedModal() {
    document.getElementById('bookingClosedModal').classList.remove('hidden');
}

function closeBookingClosedModal() {
    document.getElementById('bookingClosedModal').classList.add('hidden');
}

// ===== Blocked Phone Modal =====
function showBlockedPhoneModal() {
    document.getElementById('blockedPhoneModal').classList.remove('hidden');
}

function closeBlockedPhoneModal() {
    document.getElementById('blockedPhoneModal').classList.add('hidden');
    // Clear phone input for security
    document.getElementById('bookingPin').value = '';
}

function startEditBooking() {
    if (!currentPaymentCoop) return;
    document.getElementById('paymentDetailModal').classList.add('hidden');
    document.querySelectorAll('.payment-row-item').forEach(r => r.classList.remove('bg-indigo-100', 'ring-2', 'ring-inset', 'ring-indigo-500'));
    proceedToEdit(); currentPaymentCoop = null;
}

function proceedToEdit() {
    if (!currentPaymentCoop) return;
    editingBookingId = currentPaymentCoop.id;
    document.getElementById('coopName').value = currentPaymentCoop.coop_name;
    const pinInput = document.getElementById('bookingPin');
    pinInput.value = currentPaymentCoop.pin || ''; pinInput.disabled = true; pinInput.classList.add('bg-gray-100');
    selectColor(currentPaymentCoop.coop_color);

    // Populate dynamic items
    if (currentPaymentCoop.items && Array.isArray(currentPaymentCoop.items)) {
        // First reset all dynamic inputs to 0/empty
        document.querySelectorAll('.activity-input').forEach(input => input.value = '');
        
        currentPaymentCoop.items.forEach(item => {
            const section = document.querySelector(`.activity-section[data-activity-id="${item.activity_id}"]`);
            if (section) {
                if (item.option) {
                    const input = section.querySelector(`.activity-input[data-option="${item.option}"]`);
                    if (input) input.value = item.quantity;
                } else {
                    const input = section.querySelector(`.activity-input`);
                    if (input) input.value = item.quantity;
                }
            }
        });
    }

    document.getElementById('sponsorAmount').value = currentPaymentCoop.sponsor_amount || '';
    switchTab('booking'); showToast('เริ่มแก้ไขข้อมูลได้', 'success');
}

function startCancelBooking() { if (!currentPaymentCoop) return; pinAction = 'cancel'; document.getElementById('verifyBookingPin').value = ''; document.querySelector('#securityModal h3').textContent = 'ยืนยันเบอร์โทรศัพท์เพื่อยกเลิกการจอง'; document.getElementById('securityModal').classList.remove('hidden'); }

async function confirmCancelBooking() {
    if (!currentPaymentCoop) return;
    showLoading(true);
    try {
        const result = await ApiClient.deleteBooking(currentPaymentCoop.id, document.getElementById('verifyBookingPin').value);
        showLoading(false);
        if (result.isOk) { showToast(result.message || 'ยกเลิกการจองสำเร็จ', 'success'); closePaymentModal(); document.getElementById('securityModal').classList.add('hidden'); init(); }
        else { showToast('เกิดข้อผิดพลาด: ' + result.error, 'error'); }
    } catch (error) { showLoading(false); showToast('Connection Error: ' + error.message, 'error'); }
}

function closePaymentModal() { document.getElementById('paymentDetailModal').classList.add('hidden'); document.querySelectorAll('.payment-row-item').forEach(r => r.classList.remove('bg-indigo-100', 'ring-2', 'ring-inset', 'ring-indigo-500')); currentPaymentCoop = null; }
function closeSecurityModal() { document.getElementById('securityModal').classList.add('hidden'); }

function checkBookingPin() {
    const inputPin = document.getElementById('verifyBookingPin').value.trim();
    if (!inputPin) { showToast('กรุณากรอกเบอร์โทรศัพท์', 'error'); return; }
    if (inputPin === currentPaymentCoop.pin || isAdmin) {
        closeSecurityModal();
        if (pinAction === 'edit') proceedToEdit();
        else if (pinAction === 'cancel') confirmCancelBooking();
        else if (pinAction === 'view_payment') { renderPaymentInfo(); showToast('ยืนยันตัวตนสำเร็จ', 'success'); }
    } else { showToast('เบอร์โทรศัพท์ไม่ถูกต้อง', 'error'); }
}

// ===== Payment Table =====
function updatePaymentTable() {
    const tbody = document.getElementById('paymentCoopTableBody'); tbody.innerHTML = '';
    const noDataDiv = document.getElementById('paymentNoData');
    const paginationDiv = document.getElementById('paymentPagination');
    let filtered = allBookings.filter(b => ['รอชำระ', 'รอตรวจสอบ'].includes(b.payment_status));
    if (paymentSearchQuery) filtered = filtered.filter(b => matchSearchQuery(b, paymentSearchQuery));
    filtered.sort((a, b) => { const order = { 'รอชำระ': 1, 'รอตรวจสอบ': 2 }; const sA = order[a.payment_status] || 99; const sB = order[b.payment_status] || 99; if (sA !== sB) return sA - sB; return a.coop_name.localeCompare(b.coop_name); });
    const totalItems = filtered.length; const totalPages = Math.ceil(totalItems / CONFIG.ITEMS_PER_PAGE);
    if (paymentCurrentPage > totalPages) paymentCurrentPage = totalPages || 1; if (paymentCurrentPage < 1) paymentCurrentPage = 1;
    const paginatedItems = filtered.slice((paymentCurrentPage - 1) * CONFIG.ITEMS_PER_PAGE, paymentCurrentPage * CONFIG.ITEMS_PER_PAGE);
    paginatedItems.forEach(booking => {
        let statusBadge = '', rowClass = '';
        if (isAdmin) { statusBadge = booking.payment_status === 'รอตรวจสอบ' ? '<span class="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">📤 รอตรวจสอบ</span>' : '<span class="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⏳ รอชำระ</span>'; rowClass = booking.payment_status === 'รอตรวจสอบ' ? 'bg-blue-50/50' : ''; }
        const tr = document.createElement('tr'); tr.className = `cursor-pointer hover:bg-indigo-50 transition-colors ${rowClass} payment-row-item`; tr.dataset.id = booking.id; tr.onclick = () => selectPaymentRow(booking.id);
        if (currentPaymentCoop && currentPaymentCoop.id === booking.id) tr.classList.add('bg-indigo-100', 'ring-2', 'ring-inset', 'ring-indigo-500');
        tr.innerHTML = `<td class="p-3 border-b border-gray-100 font-mono text-sm text-gray-600">${booking.id}</td><td class="p-3 border-b border-gray-100 font-medium text-gray-800">${booking.coop_name} ${statusBadge}</td>`;
        tbody.appendChild(tr);
    });
    if (totalItems === 0) { noDataDiv.classList.remove('hidden'); noDataDiv.textContent = paymentSearchQuery ? "ไม่พบข้อมูลที่ค้นหา" : "ไม่พบข้อมูล"; paginationDiv.classList.add('hidden'); }
    else { noDataDiv.classList.add('hidden'); if (totalItems > CONFIG.ITEMS_PER_PAGE) { paginationDiv.classList.remove('hidden'); document.getElementById('paymentPageInfo').textContent = `หน้า ${paymentCurrentPage} จาก ${totalPages}`; document.getElementById('paymentPrevBtn').disabled = paymentCurrentPage === 1; document.getElementById('paymentNextBtn').disabled = paymentCurrentPage >= totalPages; } else { paginationDiv.classList.add('hidden'); } }
}

function filterPaymentTable(query) { paymentSearchQuery = query; paymentCurrentPage = 1; updatePaymentTable(); }
function changePaymentPage(direction) { paymentCurrentPage += direction; updatePaymentTable(); }
function selectPaymentRow(id) { document.querySelectorAll('.payment-row-item').forEach(r => r.classList.remove('bg-indigo-100', 'ring-2', 'ring-inset', 'ring-indigo-500')); const selectedRow = document.querySelector(`.payment-row-item[data-id="${id}"]`); if (selectedRow) selectedRow.classList.add('bg-indigo-100', 'ring-2', 'ring-inset', 'ring-indigo-500'); loadPaymentInfo(id); }

function loadPaymentInfo(coopId) { if (!coopId && currentPaymentCoop) coopId = currentPaymentCoop.id; if (!coopId) return; const booking = allBookings.find(b => b.id === coopId); if (!booking) return; currentPaymentCoop = booking; if (isAdmin) renderPaymentInfo(); else { pinAction = 'view_payment'; document.getElementById('verifyBookingPin').value = ''; document.querySelector('#securityModal h3').textContent = 'ยืนยันเบอร์โทรศัพท์เพื่อดูข้อมูล'; document.getElementById('securityModal').classList.remove('hidden'); } }

function renderPaymentInfo() {
    if (!currentPaymentCoop) return;
    
    const color = window.availableColors.find(c => c.id === currentPaymentCoop.coop_color);
    const colorDisplayName = color ? `${color.emoji || ''} ${color.name}` : currentPaymentCoop.coop_color;
    
    let itemsHTML = '';
    let itemsSubtotal = 0;

    if (currentPaymentCoop.items && Array.isArray(currentPaymentCoop.items)) {
        currentPaymentCoop.items.forEach(item => {
            const activity = window.availableActivities.find(a => a.id === item.activity_id);
            const actName = activity ? activity.name : item.activity_id;
            const lineTotal = item.quantity * item.price;
            itemsSubtotal += lineTotal;
            
            itemsHTML += `
                <div class="flex justify-between items-start py-1 border-b border-gray-50 last:border-0 text-sm">
                    <div>
                        <span class="font-bold text-gray-700">${actName}</span>
                        ${item.option ? `<span class="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-1 uppercase font-mono">${item.option}</span>` : ''}
                        <p class="text-xs text-gray-400">${item.quantity} x ${item.price.toLocaleString()} บาท</p>
                    </div>
                    <div class="font-bold text-gray-800">${lineTotal.toLocaleString()}</div>
                </div>
            `;
        });
    }

    const sponsorAmount = currentPaymentCoop.sponsor_amount || 0;
    
    let detailsHTML = `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <span class="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">ID: ${currentPaymentCoop.id}</span>
                <span class="text-xs font-bold ${currentPaymentCoop.payment_status === 'ชำระแล้ว' ? 'text-green-600' : 'text-amber-600'} flex items-center gap-1">
                    ${currentPaymentCoop.payment_status === 'ชำระแล้ว' ? '✅' : '⏳'} ${currentPaymentCoop.payment_status}
                </span>
            </div>

            <div class="grid grid-cols-1 gap-2">
                <p class="text-sm font-medium text-gray-400 uppercase tracking-widest">ชื่อสหกรณ์</p>
                <p class="text-xl font-extrabold text-gray-900 border-l-4 border-indigo-500 pl-3">${currentPaymentCoop.coop_name}</p>
                <p class="text-sm font-bold text-gray-700 flex items-center gap-2 mt-1">
                    <span class="text-gray-400 font-normal">ทีม:</span> ${colorDisplayName}
                </p>
            </div>

            <div class="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                <p class="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">สรุปรายการจอง</p>
                <div class="space-y-1">
                    ${itemsHTML || '<p class="text-center py-2 text-gray-400 italic">ไม่มีรายการ</p>'}
                </div>
                
                ${sponsorAmount > 0 ? `
                <div class="flex justify-between items-center mt-3 pt-3 border-t border-indigo-100">
                    <p class="text-sm font-bold text-green-700">เงินสนับสนุนกิจกรรม</p>
                    <p class="font-bold text-green-700">+ ${sponsorAmount.toLocaleString()}</p>
                </div>` : ''}
            </div>
        </div>
    `;

    document.getElementById('modalPaymentDetails').innerHTML = detailsHTML;
    document.getElementById('modalTotalPayment').textContent = currentPaymentCoop.total_amount.toLocaleString();
    document.getElementById('paymentDetailModal').classList.remove('hidden');
    
    // Admin features logic...
    if (isAdmin) { 
        document.getElementById('uploadSection').classList.add('hidden'); 
        document.getElementById('adminStatusSection').classList.remove('hidden'); 
        document.getElementById('adminSlipSection').classList.remove('hidden'); 
        if (currentPaymentCoop.proof_url) { 
            const proofs = currentPaymentCoop.proof_url.split(',').filter(url => url.trim() !== ''); 
            document.getElementById('slipDisplay').innerHTML = `<button onclick="openGallery('${currentPaymentCoop.proof_url}')" class="text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200 flex items-center gap-2 transition-all hover:scale-105">📸 ตรวจสอบหลักฐาน (${proofs.length})</button>`; 
        } else { 
            document.getElementById('slipDisplay').innerHTML = `<div class="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center text-gray-400 italic text-sm">ยังไม่มีการแนบหลักฐาน</div>`; 
        } 
        updateStatusButtons(currentPaymentCoop.payment_status); 
    } else { 
        document.getElementById('uploadSection').classList.remove('hidden'); 
        document.getElementById('adminStatusSection').classList.add('hidden'); 
        document.getElementById('adminSlipSection').classList.add('hidden'); 
        const editBtn = document.getElementById('editBookingBtn'); 
        const cancelBtn = document.getElementById('cancelBookingBtn'); 
        if ((currentPaymentCoop.payment_status === 'รอชำระ' || currentPaymentCoop.payment_status === 'รอตรวจสอบ') && !currentPaymentCoop.proof_url) { 
            editBtn.classList.remove('hidden'); 
            cancelBtn.classList.remove('hidden'); 
        } else { 
            editBtn.classList.add('hidden'); 
            cancelBtn.classList.add('hidden'); 
        } 
    }
}

// ===== Gallery =====
function openGallery(urlStr) { if (!urlStr) return; currentProofUrls = urlStr.split(',').filter(url => url.trim() !== ''); if (currentProofUrls.length === 0) return; currentUrlIndex = 0; updateGalleryImage(); document.getElementById('imageGalleryModal').classList.remove('hidden'); }
function closeGallery() { document.getElementById('imageGalleryModal').classList.add('hidden'); }
function updateGalleryImage() { document.getElementById('galleryImage').src = currentProofUrls[currentUrlIndex]; document.getElementById('currentImageIndex').textContent = currentUrlIndex + 1; document.getElementById('totalImages').textContent = currentProofUrls.length; const prevBtn = document.getElementById('prevBtn'); const nextBtn = document.getElementById('nextBtn'); if (currentProofUrls.length > 1) { prevBtn.classList.remove('hidden'); nextBtn.classList.remove('hidden'); } else { prevBtn.classList.add('hidden'); nextBtn.classList.add('hidden'); } }
function nextImage() { if (currentProofUrls.length <= 1) return; currentUrlIndex = (currentUrlIndex + 1) % currentProofUrls.length; updateGalleryImage(); }
function prevImage() { if (currentProofUrls.length <= 1) return; currentUrlIndex = (currentUrlIndex - 1 + currentProofUrls.length) % currentProofUrls.length; updateGalleryImage(); }

// ===== Payment Status =====
function updateStatusButtons(status) { document.querySelectorAll('.payment-status-btn').forEach(btn => { btn.classList.remove('bg-green-100', 'border-green-500', 'text-green-700', 'bg-yellow-100', 'border-yellow-500', 'text-yellow-700', 'bg-blue-100', 'border-blue-500', 'text-blue-700'); btn.classList.add('border-gray-300', 'text-gray-700'); }); const selectedBtn = document.querySelector(`[data-status="${status}"]`); if (selectedBtn) { if (status === 'ชำระแล้ว') selectedBtn.classList.add('bg-green-100', 'border-green-500', 'text-green-700'); else if (status === 'รอตรวจสอบ') selectedBtn.classList.add('bg-blue-100', 'border-blue-500', 'text-blue-700'); else selectedBtn.classList.add('bg-yellow-100', 'border-yellow-500', 'text-yellow-700'); } }
function updatePaymentStatus(status) { if (!currentPaymentCoop) return; currentPaymentCoop.payment_status = status; updateStatusButtons(status); }

async function uploadSlip(inputId = 'slipInput', btnId = 'uploadBtn') {
    const fileInput = document.getElementById(inputId); const file = fileInput.files[0];
    if (!file) { showToast('กรุณาเลือกไฟล์รูปภาพ', 'error'); return; }
    const uploadBtn = document.getElementById(btnId); const originalText = uploadBtn.innerHTML;
    uploadBtn.disabled = true; uploadBtn.innerHTML = '<div class="spinner mx-auto"></div>';
    const reader = new FileReader();
    reader.onload = async function (e) {
        const base64Data = e.target.result.split(',')[1];
        try { const result = await ApiClient.uploadSlip(currentPaymentCoop, base64Data, file.type); uploadBtn.disabled = false; uploadBtn.innerHTML = originalText; if (result.isOk) { showToast('อัพโหลดสำเร็จ! กรุณารอตรวจสอบ', 'success'); fileInput.value = ''; if (inputId === 'adminSlipInput') { const bookingId = currentPaymentCoop.id; const data = await ApiClient.getBookingData(); const updatedBooking = data.find(b => b.id === bookingId); if (updatedBooking) { currentPaymentCoop = updatedBooking; renderPaymentInfo(); } } else { currentPaymentCoop = null; updatePaymentTable(); closePaymentModal(); init(); } } else { showToast('เกิดข้อผิดพลาด: ' + result.error, 'error'); } }
        catch (error) { uploadBtn.disabled = false; uploadBtn.innerHTML = originalText; showToast('Upload failed: ' + error.message, 'error'); }
    };
    reader.readAsDataURL(file);
}

async function savePaymentStatus() {
    if (!currentPaymentCoop || !isAdmin) return;

    // Validation: Check if status is 'Paid' but no proof_url
    if (currentPaymentCoop.payment_status === 'ชำระแล้ว' && !currentPaymentCoop.proof_url) {
        showMessageModal(
            'ไม่สามารถบันทึกสถานะได้',
            'ไม่สามารถเปลี่ยนสถานะเป็น "ชำระแล้ว" ได้<br>เนื่องจากยังไม่ได้แนบหลักฐานการโอนเงิน (สลิป)',
            'error'
        );
        return;
    }

    const btn = document.getElementById('savePaymentBtn'); btn.disabled = true; btn.innerHTML = '<div class="spinner mx-auto"></div>';
    try { const result = await ApiClient.updateBooking(currentPaymentCoop); btn.disabled = false; btn.innerHTML = 'บันทึกสถานะ'; if (result.isOk) { showToast('บันทึกสถานะสำเร็จ!', 'success'); closePaymentModal(); init(); } else { showToast('เกิดข้อผิดพลาด: ' + result.error, 'error'); } }
    catch (error) { btn.disabled = false; btn.innerHTML = 'บันทึกสถานะ'; showToast('Connection error: ' + error.message, 'error'); }
}

function matchSearchQuery(booking, query) { if (!query) return true; const lowerQ = query.toLowerCase(); return (booking.id || '').toLowerCase().includes(lowerQ) || (booking.coop_name || '').toLowerCase().includes(lowerQ) || (booking.payment_status || '').toLowerCase().includes(lowerQ) || (searchColorMap[booking.coop_color] || '').toLowerCase().includes(lowerQ); }

// ===== Status Tab =====
function searchStatusTable(query) { statusSearchQuery = query.toLowerCase(); statusCurrentPage = 1; updatePublicStatusTable(); }
function changeStatusPage(direction) { statusCurrentPage += direction; updatePublicStatusTable(); }

function updatePublicStatusTable() {
    const tbody = document.getElementById('publicStatusTableBody'); tbody.innerHTML = '';
    const colorNameShort = { 'green': '🟢 เขียว', 'blue': '🔵 ฟ้า', 'purple': '🟣 ม่วง', 'pink': '💗 ชมพู' };
    const statusOrder = { 'รอชำระ': 1, 'รอตรวจสอบ': 2, 'ชำระแล้ว': 3 };
    let filteredBookings = allBookings; if (statusSearchQuery) filteredBookings = allBookings.filter(b => matchSearchQuery(b, statusSearchQuery));
    const sortedBookings = [...filteredBookings].sort((a, b) => { const statusA = statusOrder[a.payment_status] || 999; const statusB = statusOrder[b.payment_status] || 999; if (statusA !== statusB) return statusA - statusB; if (a.coop_color < b.coop_color) return -1; if (a.coop_color > b.coop_color) return 1; return String(a.coop_name || "").localeCompare(String(b.coop_name || "")); });
    const totalPages = Math.ceil(sortedBookings.length / CONFIG.ITEMS_PER_PAGE); if (statusCurrentPage > totalPages) statusCurrentPage = totalPages || 1; if (statusCurrentPage < 1) statusCurrentPage = 1;
    const paginatedBookings = sortedBookings.slice((statusCurrentPage - 1) * CONFIG.ITEMS_PER_PAGE, statusCurrentPage * CONFIG.ITEMS_PER_PAGE);
    document.getElementById('statusPageInfo').textContent = `หน้า ${statusCurrentPage} จาก ${totalPages || 1}`; document.getElementById('statusPrevBtn').disabled = statusCurrentPage === 1; document.getElementById('statusNextBtn').disabled = statusCurrentPage >= totalPages;
    const paginationDiv = document.getElementById('statusPagination'); if (sortedBookings.length <= CONFIG.ITEMS_PER_PAGE) paginationDiv.classList.add('hidden'); else paginationDiv.classList.remove('hidden');
    if (paginatedBookings.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">ไม่พบข้อมูล</td></tr>`; return; }
    paginatedBookings.forEach(booking => { let statusColor = 'bg-yellow-100 text-yellow-700'; let statusIcon = '⏳'; if (booking.payment_status === 'ชำระแล้ว') { statusColor = 'bg-green-100 text-green-700'; statusIcon = '✅'; } else if (booking.payment_status === 'รอตรวจสอบ') { statusColor = 'bg-blue-100 text-blue-700'; statusIcon = '📤'; } const row = document.createElement('tr'); row.className = 'hover:bg-gray-50 border-b last:border-b-0'; row.innerHTML = `<td class="px-4 py-3 text-center text-gray-500 font-mono text-sm">${booking.id}</td><td class="px-4 py-3 text-center font-medium">${colorNameShort[booking.coop_color] || booking.coop_color}</td><td class="px-4 py-3 text-gray-800">${booking.coop_name}</td><td class="px-4 py-3 text-center"><span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusColor}">${statusIcon} ${booking.payment_status}</span></td>`; tbody.appendChild(row); });
}

// ===== Summary Tab =====
function searchSummaryTable(query) { summarySearchQuery = query.toLowerCase(); summaryCurrentPage = 1; updateSummaryTab(); }
function changeSummaryPage(direction) { summaryCurrentPage += direction; updateSummaryTab(); }
function normalizeCoopName(name) { if (!name) return ''; return name.toLowerCase().replace(/\s+/g, '').replace(/[,.\-_()]/g, '').trim(); }

function parseBookingDate(id) {
    if (!id) return null;
    const idStr = String(id).trim();
    if (idStr.length < 8) return null; // Need at least DDMMYYYY

    // ID Format: DDMMYYYYHHmm (e.g., 230125691030)
    try {
        const day = parseInt(idStr.substring(0, 2), 10);
        const month = parseInt(idStr.substring(2, 4), 10) - 1; // 0-indexed
        const yearBE = parseInt(idStr.substring(4, 8), 10);
        const yearAD = yearBE - 543;

        // Optional time part
        let hour = 0, minute = 0;
        if (idStr.length >= 12) {
            hour = parseInt(idStr.substring(8, 10), 10);
            minute = parseInt(idStr.substring(10, 12), 10);
        }

        return new Date(yearAD, month, day, hour, minute);
    } catch (e) {
        console.error("Error parsing date from ID:", id, e);
        return null;
    }
}

function updateSummaryTab() {
    // === สรุปข้อมูลกิจกรรมทั้งหมด (Dynamic Summary Data) ===
    window.summaryData = {
        all: { coops: new Set(), activities: {}, revenue: 0, sponsor: 0 },
        paid: { coops: new Set(), activities: {}, revenue: 0, sponsor: 0 },
        pending: { coops: new Set(), activities: {}, revenue: 0, sponsor: 0 }
    };

    // Initialize activity counters for each filter group
    const initActivityStats = (obj) => {
        window.availableActivities.forEach(act => {
            obj.activities[act.id] = { total: 0, options: {} };
            act.options.forEach(opt => obj.activities[act.id].options[opt] = 0);
        });
    };
    initActivityStats(window.summaryData.all);
    initActivityStats(window.summaryData.paid);
    initActivityStats(window.summaryData.pending);

    // Date Range Filter Logic
    const startDateInput = document.getElementById('summaryStartDate');
    const endDateInput = document.getElementById('summaryEndDate');
    let startDate = null, endDate = null;
    if (startDateInput?.value) {
        const p = startDateInput.value.split('-');
        startDate = new Date(p[0], p[1]-1, p[2], 0,0,0);
    }
    if (endDateInput?.value) {
        const p = endDateInput.value.split('-');
        endDate = new Date(p[0], p[1]-1, p[2], 23,59,59);
    }

    allBookings.forEach(booking => {
        // Date Filtering
        if (startDate || endDate) {
            const bDate = parseBookingDate(booking.id);
            if (!bDate || (startDate && bDate < startDate) || (endDate && bDate > endDate)) return;
        }

        const normalizedName = normalizeCoopName(booking.coop_name);
        const group = booking.payment_status === 'ชำระแล้ว' ? window.summaryData.paid : window.summaryData.pending;
        
        // Add to both specific group and 'all'
        [window.summaryData.all, group].forEach(stats => {
            stats.coops.add(normalizedName);
            stats.revenue += booking.total_amount || 0;
            stats.sponsor += booking.sponsor_amount || 0;
            
            // Dynamic Item Accumulation
            if (booking.items && Array.isArray(booking.items)) {
                booking.items.forEach(item => {
                    const actStats = stats.activities[item.activity_id];
                    if (actStats) {
                        actStats.total += item.quantity;
                        if (item.option && actStats.options.hasOwnProperty(item.option)) {
                            actStats.options[item.option] += item.quantity;
                        }
                    }
                });
            }
        });
    });

    updateSummaryCards();
    updateShirtSummary();

    // Show/Hide Admin Columns
    const isAdminUI = (elId, show) => {
        const el = document.getElementById(elId);
        if (el) show ? el.classList.remove('hidden') : el.classList.add('hidden');
    };
    isAdminUI('bookingIdHeader', isAdmin);
    isAdminUI('distributionHeader', isAdmin);
    isAdminUI('pdfExportHeader', isAdmin);

    const tbody = document.getElementById('summaryTableBody'); 
    tbody.innerHTML = '';
    
    let filtered = allBookings; 
    if (summarySearchQuery) filtered = allBookings.filter(b => matchSearchQuery(b, summarySearchQuery));
    
    const statusOrder = { 'รอชำระ': 1, 'รอตรวจสอบ': 2, 'ชำระแล้ว': 3 };
    filtered.sort((a, b) => {
        const sA = statusOrder[a.payment_status] || 999;
        const sB = statusOrder[b.payment_status] || 999;
        if (sA !== sB) return sA - sB;
        return (a.coop_name || "").localeCompare(b.coop_name || "");
    });

    const totalPages = Math.ceil(filtered.length / CONFIG.ITEMS_PER_PAGE); 
    if (summaryCurrentPage > totalPages) summaryCurrentPage = totalPages || 1;
    const paginated = filtered.slice((summaryCurrentPage - 1) * CONFIG.ITEMS_PER_PAGE, summaryCurrentPage * CONFIG.ITEMS_PER_PAGE);
    
    document.getElementById('summaryPageInfo').textContent = `หน้า ${summaryCurrentPage} จาก ${totalPages || 1}`;
    document.getElementById('summaryPrevBtn').disabled = summaryCurrentPage === 1;
    document.getElementById('summaryNextBtn').disabled = summaryCurrentPage >= totalPages;
    
    const paginDiv = document.getElementById('summaryPagination');
    filtered.length <= CONFIG.ITEMS_PER_PAGE ? paginDiv.classList.add('hidden') : paginDiv.classList.remove('hidden');

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center py-8 text-gray-400 italic">ไม่พบข้อมูลที่ตรงตามเงื่อนไข</td></tr>`;
        return;
    }

    paginated.forEach(booking => {
        // Calculate dynamic totals for the table
        let shirtTotal = 0, flowerTotal = 0, tableTotal = 0;
        if (booking.items) {
            booking.items.forEach(it => {
                if (it.activity_id === 'SHIRT') shirtTotal += it.quantity;
                else if (it.activity_id === 'FLOWER') flowerTotal += it.quantity;
                else if (it.activity_id === 'TABLE') tableTotal += it.quantity;
            });
        }

        const colorObj = window.availableColors.find(c => c.id === booking.coop_color);
        const colorName = colorObj ? `${colorObj.emoji || ''} ${colorObj.name}` : booking.coop_color;
        
        let statusColor = 'bg-yellow-100 text-yellow-700'; 
        if (booking.payment_status === 'ชำระแล้ว') statusColor = 'bg-green-100 text-green-700'; 
        else if (booking.payment_status === 'รอตรวจสอบ') statusColor = 'bg-blue-100 text-blue-700';
        
        const isDist = booking.distribution_status === 'แจกแล้ว';
        const distBadge = isDist ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
        
        const row = document.createElement('tr'); 
        row.className = 'hover:bg-indigo-50/30 transition-colors';
        row.innerHTML = `
            <td class="border px-4 py-3 font-medium">${booking.coop_name}</td>
            <td class="border px-4 py-3 text-center text-sm">${colorName}</td>
            <td class="border px-4 py-3 text-center font-bold text-indigo-600">${shirtTotal}</td>
            <td class="border px-4 py-3 text-center">${flowerTotal}</td>
            <td class="border px-4 py-3 text-center">${tableTotal}</td>
            <td class="border px-4 py-3 text-center ${booking.sponsor_amount > 0 ? 'text-green-600 font-bold' : 'text-gray-300'}">${booking.sponsor_amount ? booking.sponsor_amount.toLocaleString() : '-'}</td>
            <td class="border px-4 py-3 text-center font-extrabold text-gray-900">${(booking.total_amount || 0).toLocaleString()}</td>
            <td class="border px-4 py-3 text-center">
                <button onclick="showSizeDetail('${booking.id}')" class="bg-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white p-2 rounded-xl transition-all shadow-sm" title="ดูรายละเอียดรายการ">👕</button>
            </td>
            <td class="border px-4 py-3 text-center">
                <span class="px-3 py-1 rounded-full text-xs font-bold border ${statusColor}">${booking.payment_status}</span>
            </td>
            <td class="border px-4 py-3 text-center font-mono text-[10px] text-gray-400 ${isAdmin ? '' : 'hidden'}">
                <div>${booking.id}</div>
                ${booking.proof_url ? `<button onclick="openGallery('${booking.proof_url}')" class="text-[10px] bg-white border border-gray-200 text-indigo-600 px-2 py-0.5 rounded mt-1 hover:bg-indigo-50 transition-colors">📄 ดูสลิป</button>` : ''}
            </td>
            <td class="border px-4 py-3 text-center ${isAdmin ? '' : 'hidden'}">
                <button onclick="generateCoopPDF('${booking.id}')" class="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-red-100">📄 PDF</button>
            </td>
            <td class="border px-4 py-3 text-center ${isAdmin ? '' : 'hidden'}">
                <label class="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" ${isDist ? 'checked' : ''} onchange="toggleDistributionStatus('${booking.id}', this.checked)" class="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500 border-gray-300">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold ${distBadge}">${isDist ? '✅ แจกแล้ว' : '⏳ รอรับ'}</span>
                </label>
            </td>`;
        tbody.appendChild(row);
    });
}

// ===== Summary Cards with Dropdown Filter =====
function updateSummaryCards() {
    const filterValue = document.getElementById('summaryFilter')?.value || 'all';
    const titleEl = document.getElementById('summaryCardsTitle');
    const titles = { all: '📊 สรุปข้อมูลทั้งหมด', paid: '✅ สรุปข้อมูลที่ชำระแล้ว', pending: '⏳ สรุปข้อมูลที่รอชำระ' };
    if (titleEl) titleEl.textContent = titles[filterValue] || titles.all;

    const data = window.summaryData?.[filterValue] || { coops: new Set(), activities: {}, revenue: 0, sponsor: 0 };
    
    // Primary Activity (SHIRT)
    const shirtStats = data.activities['SHIRT'] || { total: 0 };
    const flowerStats = data.activities['FLOWER'] || { total: 0 };
    const tableStats = data.activities['TABLE'] || { total: 0 };

    document.getElementById('cardCoops').textContent = data.coops.size;
    document.getElementById('cardShirts').textContent = shirtStats.total;
    document.getElementById('cardFlowers').textContent = flowerStats.total;
    document.getElementById('cardTables').textContent = tableStats.total;
    document.getElementById('cardSponsor').textContent = data.sponsor.toLocaleString();
    document.getElementById('cardRevenue').textContent = data.revenue.toLocaleString();
}

// ===== Shirt Summary with Dropdown Filter =====
function updateShirtSummary() {
    const filterValue = document.getElementById('shirtSummaryFilter')?.value || 'all';
    const data = window.summaryData?.[filterValue] || { activities: {} };
    
    // Find SHIRT activity
    const shirtAct = window.availableActivities.find(a => a.id === 'SHIRT');
    if (!shirtAct) return;

    // Accumulate by Color & Size
    const colorResults = {};
    window.availableColors.forEach(c => {
        colorResults[c.id] = { total: 0, options: {} };
        shirtAct.options.forEach(opt => colorResults[c.id].options[opt] = 0);
    });

    // Date/Filter filtering
    let filtered = allBookings;
    if (filterValue === 'paid') filtered = filtered.filter(b => b.payment_status === 'ชำระแล้ว');
    else if (filterValue === 'pending') filtered = filtered.filter(b => b.payment_status !== 'ชำระแล้ว');

    // Apply Date Filter... (Optional reuse logic from updateSummaryTab)
    
    filtered.forEach(booking => {
        if (booking.items) {
            booking.items.forEach(it => {
                if (it.activity_id === 'SHIRT' && colorResults[booking.coop_color]) {
                    colorResults[booking.coop_color].options[it.option] += it.quantity;
                    colorResults[booking.coop_color].total += it.quantity;
                }
            });
        }
    });

    // Update UI - Grid Totals
    shirtAct.options.forEach(opt => {
        const total = Object.values(colorResults).reduce((sum, c) => sum + (c.options[opt] || 0), 0);
        const el = document.getElementById('total' + opt);
        if (el) el.textContent = total;
    });

    // Update UI - Color Table
    window.availableColors.forEach(color => {
        shirtAct.options.forEach(opt => {
            const elId = color.id + opt;
            const el = document.getElementById(elId);
            if (el) el.textContent = colorResults[color.id].options[opt] || 0;
        });
        const totalEl = document.getElementById(color.id + 'Total');
        if (totalEl) totalEl.textContent = colorResults[color.id].total;
    });
}

function showSizeDetail(id) {
    const booking = allBookings.find(b => b.id == id); 
    if (!booking) return;

    let itemsHTML = '';
    let shirtTotal = 0;

    if (booking.items) {
        booking.items.forEach(it => {
            const activity = window.availableActivities.find(a => a.id === it.activity_id);
            const actName = activity ? activity.name : it.activity_id;
            if (it.activity_id === 'SHIRT') shirtTotal += it.quantity;

            itemsHTML += `
                <div class="flex justify-between items-center bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
                        <span class="font-bold text-gray-700">${actName}</span>
                        ${it.option ? `<span class="text-[10px] font-mono bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded uppercase">${it.option}</span>` : ''}
                    </div>
                    <div class="font-extrabold text-gray-900">${it.quantity}</div>
                </div>
            `;
        });
    }

    const html = `
        <div class="space-y-4">
            <div class="border-l-4 border-indigo-500 pl-3">
                <p class="text-xs text-gray-400 uppercase font-bold tracking-widest">สหกรณ์</p>
                <p class="text-xl font-extrabold text-gray-800">${booking.coop_name}</p>
            </div>
            
            <div class="grid grid-cols-1 gap-2">
                <p class="text-xs text-gray-400 uppercase font-bold tracking-widest mb-1">รายการที่สั่ง</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${itemsHTML || '<p class="text-center py-4 text-gray-400 italic">ไม่มีข้อมูลรายการ</p>'}
                </div>
            </div>
            
            <div class="mt-4 pt-4 border-t border-dashed flex justify-between items-center">
                <span class="text-sm font-bold text-gray-500 uppercase">รวมเสื้อทั้งหมด:</span>
                <span class="text-2xl font-black text-indigo-600">${shirtTotal} <span class="text-sm font-normal">ตัว</span></span>
            </div>
        </div>`;
    
    document.getElementById('sizeDetailContent').innerHTML = html; 
    document.getElementById('sizeDetailModal').classList.remove('hidden');
}

async function toggleDistributionStatus(id, isChecked) {
    if (!isAdmin) { showToast('คุณไม่มีสิทธิ์ในการเปลี่ยนแปลงสถานะการแจกจ่าย', 'error'); return; }
    const newStatus = isChecked ? 'แจกแล้ว' : 'ยังไม่แจก'; showLoading(true);
    try { const result = await ApiClient.updateDistributionStatus(id, newStatus); showLoading(false); if (result.isOk) { showToast(`อัพเดตสถานะเป็น "${newStatus}" สำเร็จ!`, 'success'); const booking = allBookings.find(b => b.id === id); if (booking) booking.distribution_status = newStatus; updateSummaryTab(); } else { showToast('เกิดข้อผิดพลาด: ' + result.error, 'error'); updateSummaryTab(); } }
    catch (error) { showLoading(false); showToast('Connection error: ' + error.message, 'error'); updateSummaryTab(); }
}

/**
 * Generate PDF for a Single Cooperative Booking (Individual Copy)
 * Refactored to support Dynamic Activities and Relational Items
 */
async function generateCoopPDF(coopId) {
    const booking = allBookings.find(b => b.id === coopId);
    if (!booking) return;

    // Use dynamic configuration from window.availableColors & window.availableActivities
    const colorObj = window.availableColors.find(c => c.id === booking.coop_color);
    const colorName = colorObj ? `${colorObj.emoji || ''} ${colorObj.name}` : booking.coop_color;
    const colorHex = colorObj ? (colorObj.id === 'green' ? '#22c55e' : colorObj.id === 'blue' ? '#3b82f6' : colorObj.id === 'purple' ? '#a855f7' : '#ec4899') : '#374151';

    // Current Date (B.E.)
    const now = new Date();
    const dateStr = `${now.getDate()}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear() + 543}`;

    // Dynamic Activity Rendering
    let sizeableItemsHTML = '';
    let standardItemsHTML = '';
    let grandTotal = 0;

    window.availableActivities.forEach(act => {
        const items = (booking.items || []).filter(it => it.activity_id === act.id);
        if (items.length === 0) return;

        let actSubtotal = 0;
        items.forEach(it => {
            actSubtotal += (it.quantity * it.price);
            grandTotal += (it.quantity * it.price);
        });

        if (act.type === 'Sizeable') {
            // Render as size-grid table (e.g. Shirts)
            const half = Math.ceil(act.options.length / 2);
            const leftCol = act.options.slice(0, half);
            const rightCol = act.options.slice(half);

            const renderCol = (opts) => opts.map(opt => {
                const item = items.find(it => it.option === opt);
                return generateItemRowPDF(opt, item ? item.quantity : 0, act.price);
            }).join('');

            sizeableItemsHTML += `
                <div style="margin-bottom: 25px; page-break-inside: avoid;">
                    <h3 style="font-size: 16px; font-weight: bold; color: #374151; margin-bottom: 12px; border-left: 4px solid #6366f1; padding-left: 10px;">
                        📦 ${act.name} (หน่วยละ ${act.price.toLocaleString()} บาท)
                    </h3>
                    <div style="display: flex; gap: 20px;">
                        <div style="flex: 1;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                    <th style="padding: 10px; text-align: left;">ตัวเลือก</th>
                                    <th style="padding: 10px; text-align: center;">จำนวน</th>
                                    <th style="padding: 10px; text-align: right;">บาท</th>
                                </tr>
                                ${renderCol(leftCol)}
                            </table>
                        </div>
                        <div style="flex: 1;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                    <th style="padding: 10px; text-align: left;">ตัวเลือก</th>
                                    <th style="padding: 10px; text-align: center;">จำนวน</th>
                                    <th style="padding: 10px; text-align: right;">บาท</th>
                                </tr>
                                ${renderCol(rightCol)}
                            </table>
                        </div>
                    </div>
                </div>`;
        } else {
            // Render as a standard item row (e.g. Flowers, Tables)
            const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);
            standardItemsHTML += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 0; font-weight: 500;">${act.name} (${act.price.toLocaleString()} บ.)</td>
                    <td style="padding: 12px 0; text-align: center;">${totalQty} หน่วย</td>
                    <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #1e293b;">${actSubtotal.toLocaleString()}</td>
                </tr>`;
        }
    });

    // Add Sponsor Amount separately
    grandTotal += (booking.sponsor_amount || 0);

    const pdfContent = `
        <div id="pdf-content" style="font-family: 'Kanit', sans-serif; color: #1e293b; padding: 40px; background: white; width: 730px; min-height: 1000px; box-sizing: border-box; position: relative;">
            
            <div style="text-align: center; margin-bottom: 25px;">
                <h1 style="font-size: 24px; font-weight: 900; color: #111827; margin: 0; line-height: 1.2;">ใบสรุปการสั่งจองและลงทะเบียน</h1>
                <h2 style="font-size: 14px; font-weight: 500; color: #64748b; margin: 5px 0 0 0;">งานวันสหกรณ์แห่งชาติ ${window.activeEvent?.name || ''}</h2>
            </div>

            <div style="border-bottom: 4px solid #22c55e; margin-bottom: 25px;"></div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="width: 120px; font-weight: 700; color: #64748b;">ชื่อสหกรณ์:</td>
                        <td style="font-size: 18px; font-weight: 950;">${booking.coop_name}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: 700; color: #64748b;">สีทีมกีฬา:</td>
                        <td><span style="background-color: ${colorHex}; color: white; padding: 3px 12px; border-radius: 99px; font-weight: 800;">${colorName}</span></td>
                    </tr>
                    <tr><td style="font-weight: 700; color: #64748b;">ID การจอง:</td><td style="font-family: monospace;">#${booking.id}</td></tr>
                </table>
            </div>

            ${sizeableItemsHTML}

            <div style="display: flex; gap: 20px; align-items: flex-start; margin-top: 15px;">
                <div style="flex: 1.2;">
                    <h3 style="font-size: 15px; font-weight: bold; color: #374151; margin-bottom: 10px; border-left: 4px solid #10b981; padding-left: 10px;">🎁 รายการอื่นๆ</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        ${standardItemsHTML}
                        ${booking.sponsor_amount > 0 ? `
                        <tr>
                            <td style="padding: 10px 0;">เงินสนับสนุนกิจกรรม</td>
                            <td style="padding: 10px 0; text-align: center;">-</td>
                            <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #10b981;">+${booking.sponsor_amount.toLocaleString()}</td>
                        </tr>` : ''}
                    </table>
                </div>

                <div style="flex: 0.8; background-color: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 20px; text-align: center;">
                    <div style="font-size: 12px; font-weight: 800; color: #15803d; margin-bottom: 5px;">ยอดชำระสุทธิ</div>
                    <div style="font-size: 32px; font-weight: 950; color: #166534;">${grandTotal.toLocaleString()} <span style="font-size: 14px; font-weight: 600;">บาท</span></div>
                </div>
            </div>

            <div style="margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 15px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;">
                <div>สำนักงานสหกรณ์จังหวัดระยอง | ID: #${booking.id}</div>
                <div style="text-align: right;">พิมพ์เมื่อ: ${dateStr}</div>
            </div>
        </div>`;

    const container = document.createElement('div');
    container.innerHTML = pdfContent;
    container.style.position = 'fixed'; container.style.left = '-9999px'; container.style.top = '0';
    document.body.appendChild(container);

    const loadingMsg = document.createElement('div');
    loadingMsg.innerHTML = '⏳ กำลังประมวลผล PDF...';
    loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px 40px;border-radius:10px;z-index:99999;';
    document.body.appendChild(loadingMsg);

    const opt = {
        margin: [10, 10, 10, 10],
        filename: `เอกสารจอง_${booking.coop_name.replace(/\s+/g, '_')}_${booking.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    setTimeout(() => {
        html2pdf().set(opt).from(container.firstElementChild).save()
            .then(() => { document.body.removeChild(container); document.body.removeChild(loadingMsg); showToast('ออกรายงานสำเร็จ!', 'success'); })
            .catch(err => { console.error(err); document.body.removeChild(container); document.body.removeChild(loadingMsg); showToast('ผิดพลาด', 'error'); });
    }, 500);

}

function generateItemRowPDF(option, count, unitPrice) {
    if (!count || count === 0) {
        return `
            <tr style="color: #cbd5e1;">
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">${option}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #f1f5f9;">-</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #f1f5f9;">-</td>
            </tr>`;
    }
    return `
        <tr style="color: #334155;">
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">${option}</td>
            <td style="padding: 10px; text-align: center; border-bottom: 1px solid #f1f5f9; font-weight: 800;">${count}</td>
            <td style="padding: 10px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 800;">${(count * unitPrice).toLocaleString()}</td>
        </tr>`;
}

/**
 * Generate PDF Summary for All Activities - Admin Master Copy
 */
function generateDetailedSummaryPDF(filterType = 'all') {
    let filtered = allBookings;
    let label = '📊 รายงานสรุปยอดทั้งหมด';
    let color = '#4f46e5';

    if (filterType === 'paid') {
        filtered = allBookings.filter(b => b.payment_status === 'ชำระแล้ว');
        label = '✅ รายงานสรุปที่ชำระแล้ว';
        color = '#16a34a';
    } else if (filterType === 'pending') {
        filtered = allBookings.filter(b => b.payment_status !== 'ชำระแล้ว');
        label = '⏳ รายงานสรุปที่รอชำระ';
        color = '#d97706';
    }

    const activitySummaries = {};
    window.availableActivities.forEach(act => {
        activitySummaries[act.id] = { 
            name: act.name, type: act.type, price: act.price, 
            totalQty: 0, totalRevenue: 0, options: {} 
        };
        act.options.forEach(opt => {
            activitySummaries[act.id].options[opt] = { total: 0 };
            window.availableColors.forEach(col => {
                activitySummaries[act.id].options[opt][col.id] = 0;
            });
        });
    });

    filtered.forEach(b => {
        if (!b.items) return;
        b.items.forEach(it => {
            const summ = activitySummaries[it.activity_id];
            if (!summ) return;
            summ.totalQty += it.quantity;
            summ.totalRevenue += (it.quantity * it.price);
            if (it.option && summ.options[it.option]) {
                summ.options[it.option][b.coop_color] = (summ.options[it.option][b.coop_color] || 0) + it.quantity;
                summ.options[it.option].total += it.quantity;
            }
        });
    });

    const now = new Date();
    const dateTimeStr = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()+543} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} น.`;
    let sectionsHTML = '';
    
    window.availableActivities.forEach(act => {
        const summ = activitySummaries[act.id];
        if (summ.totalQty === 0) return;

        if (act.type === 'Sizeable') {
            const colorHeaders = window.availableColors.map(c => `
                <th style="padding: 8px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 11px;">
                    ${c.name}
                </th>`).join('');
            
            const rowsHTML = act.options.map(opt => {
                const optData = summ.options[opt];
                if (optData.total === 0) return '';
                const colorCells = window.availableColors.map(c => `
                    <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 500;">
                        ${optData[c.id] || '-'}
                    </td>`).join('');
                return `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: 700; background: #f8fafc;">${opt}</td>
                        ${colorCells}
                        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 900; background: #f1f5f9;">${optData.total}</td>
                    </tr>`;
            }).join('');

            sectionsHTML += `
                <div style="margin-bottom: 30px; page-break-inside: avoid;">
                    <div style="font-size: 15px; font-weight: bold; color: #1e293b; margin-bottom: 12px; border-left: 5px solid #6366f1; padding-left: 12px;">
                        📦 สรุปยอด: ${act.name} (รวมทั้งหมด ${summ.totalQty} หน่วย)
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: center;">
                        <thead>
                            <tr style="background: #f1f5f9;">
                                <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: left; width: 100px;">ตัวเลือก/ไซส์</th>
                                ${colorHeaders}
                                <th style="padding: 10px; border: 1px solid #e2e8f0; background: #1e293b; color: white; width: 70px;">รวม</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHTML}</tbody>
                    </table>
                </div>`;
        } else {
            sectionsHTML += `
                <div style="margin-bottom: 20px; page-break-inside: avoid; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 16px; font-weight: 800; color: #334155;">🎁 ${act.name}</div>
                    <div style="text-align: right;">
                        <div style="font-size: 20px; font-weight: 950; color: #0f172a;">${summ.totalQty} <span style="font-size: 12px; font-weight: 500; color: #64748b;">หน่วย</span></div>
                        <div style="font-size: 12px; font-weight: 700; color: #10b981;">รวมเป็นเงิน ${summ.totalRevenue.toLocaleString()} บ.</div>
                    </div>
                </div>`;
        }
    });

    const pdfContent = `
        <div style="font-family: 'Kanit', sans-serif; width: 730px; padding: 45px; background: white; color: #1e293b;">
            <div style="text-align: center; border-bottom: 4px solid #22c55e; padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="font-size: 26px; font-weight: 900; color: #111827; margin: 0;">${label}</h1>
                <p style="font-size: 14px; color: #64748b; margin-top: 10px;">${window.activeEvent?.name || ''}</p>
                <div style="font-size: 11px; color: #94a3b8; font-family: monospace;">พิมพ์เมื่อ: ${dateTimeStr}</div>
            </div>
            ${sectionsHTML}
            <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #94a3b8; text-align: right;">
                สำนักงานสหกรณ์จังหวัดระยอง | จองออนไลน์ 24 ชม.
            </div>
        </div>`;

    const container = document.createElement('div');
    container.innerHTML = pdfContent;
    container.style.position = 'fixed'; container.style.left = '-9999px'; container.style.top = '0';
    document.body.appendChild(container);

    const loadingMsg = document.createElement('div');
    loadingMsg.innerHTML = '⏳ กำลังเตรียมรายงานสรุป...';
    loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:25px 50px;border-radius:15px;z-index:99999;';
    document.body.appendChild(loadingMsg);

    const opt = {
        margin: [10, 10, 10, 10],
        filename: `สรุปยอดรวม_กิจกรรม_${now.getFullYear()}${now.getMonth()+1}${now.getDate()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    setTimeout(() => {
        html2pdf().set(opt).from(container.firstElementChild).save()
            .then(() => {
                document.body.removeChild(container);
                document.body.removeChild(loadingMsg);
                showToast('พิมพ์รายงานสรุปสำเร็จ!', 'success');
            })
            .catch(err => {
                console.error(err);
                document.body.removeChild(container);
                document.body.removeChild(loadingMsg);
                showToast('เกิดข้อผิดพลาดในการสร้างรายงาน', 'error');
            });
    }, 500);

}

function renderSettings() {
    if (!isAdmin) return;
    document.getElementById('setEventName').value = appSettings.EVENT_NAME || '';
    document.getElementById('setIsBookingOpen').checked = (appSettings.IS_BOOKING_OPEN === 'true' || appSettings.IS_BOOKING_OPEN === true);
    
    // Render event manager
    renderEventManager();
    
    // Render existing activities
    renderActivitiesEditor();
}

/**
 * Render Event Manager UI (current event, switcher, etc.)
 */
function renderEventManager() {
    const displayEl = document.getElementById('currentEventDisplay');
    const switcherEl = document.getElementById('eventSwitcher');
    
    if (!displayEl || !switcherEl) return;
    
    const event = window.activeEvent;
    const allEvents = window.allEvents || [];
    
    // Current Event Display
    if (event) {
        displayEl.innerHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-xs font-bold text-indigo-400 uppercase tracking-widest">Event ที่ใช้งานอยู่</p>
                    <p class="text-xl font-extrabold text-indigo-800 mt-1">${event.name}</p>
                    <p class="text-sm text-indigo-600 font-mono mt-0.5">ID: ${event.id} | ปี: ${event.year} | สถานะ: ${event.status}</p>
                </div>
                <span class="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">✅ Active</span>
            </div>`;
    } else {
        displayEl.innerHTML = `<p class="text-center text-gray-400 py-2">ไม่พบ Event ที่ Active</p>`;
    }
    
    // Event Switcher Dropdown
    switcherEl.innerHTML = '';
    if (allEvents.length === 0 && event) {
        switcherEl.innerHTML = `<option value="${event.id}" selected>${event.name} (${event.id})</option>`;
    } else {
        allEvents.forEach(ev => {
            const isActive = event && ev.id === event.id;
            switcherEl.innerHTML += `<option value="${ev.id}" ${isActive ? 'selected' : ''}>${ev.name} (${ev.id}) ${isActive ? '✅' : ''}</option>`;
        });
    }
}

/**
 * Show the create new event form
 */
function showCreateEventForm() {
    document.getElementById('createEventForm').classList.remove('hidden');
    
    // Auto-fill with suggested values
    const currentYear = new Date().getFullYear() + 543; // Buddhist Era
    const nextYear = currentYear + 1;
    document.getElementById('newEventId').value = 'CPD' + nextYear;
    document.getElementById('newEventName').value = 'งานวันสหกรณ์แห่งชาติ ' + nextYear;
    document.getElementById('newEventYear').value = nextYear;
}

/**
 * Create a new event via backend
 */
async function createNewEvent() {
    const id = document.getElementById('newEventId').value.trim().toUpperCase();
    const name = document.getElementById('newEventName').value.trim();
    const year = document.getElementById('newEventYear').value.trim();
    const copyActs = document.getElementById('copyActivities').checked;
    
    if (!id || !name || !year) {
        showToast('กรุณากรอก ID, ชื่อ และปี ให้ครบ', 'error');
        return;
    }
    
    // Check for duplicate ID
    const allEvents = window.allEvents || [];
    if (allEvents.some(ev => ev.id === id)) {
        showToast(`Event ID "${id}" มีอยู่แล้ว กรุณาใช้ ID อื่น`, 'error');
        return;
    }
    
    showLoading(true);
    try {
        const result = await ApiClient.request('createEvent', {
            id: id,
            name: name,
            year: year,
            copyFromEventId: copyActs && window.activeEvent ? window.activeEvent.id : null
        });
        
        if (result.isOk) {
            showToast(`สร้าง Event "${name}" สำเร็จ! 🎉`, 'success');
            document.getElementById('createEventForm').classList.add('hidden');
            await reloadAfterEventChange();
        } else {
            showToast('เกิดข้อผิดพลาด: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('Connection error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Switch the active event
 */
async function switchActiveEvent(eventId) {
    if (!eventId) return;
    
    const currentId = window.activeEvent ? window.activeEvent.id : '';
    if (eventId === currentId) return;
    
    if (!confirm(`ต้องการเปลี่ยนไปใช้ Event "${eventId}" หรือไม่?\n\nข้อมูลจองจะแสดงตาม Event ที่เลือก`)) {
        // Revert dropdown
        document.getElementById('eventSwitcher').value = currentId;
        return;
    }
    
    showLoading(true);
    try {
        const result = await ApiClient.request('switchActiveEvent', { eventId: eventId });
        if (result.isOk) {
            showToast(`เปลี่ยนเป็น Event "${eventId}" สำเร็จ!`, 'success');
            await reloadAfterEventChange();
        } else {
            showToast('เกิดข้อผิดพลาด: ' + result.error, 'error');
            document.getElementById('eventSwitcher').value = currentId;
        }
    } catch (error) {
        showToast('Connection error: ' + error.message, 'error');
        document.getElementById('eventSwitcher').value = currentId;
    } finally {
        showLoading(false);
    }
}

/**
 * Reload all data after event changes
 */
async function reloadAfterEventChange() {
    try {
        const settingsResult = await ApiClient.getSettings();
        if (settingsResult.isOk) {
            appSettings = settingsResult.settings;
            window.activeEvent = settingsResult.activeEvent;
            window.availableActivities = settingsResult.activities || [];
            window.availableColors = settingsResult.colors || [];
            window.allEvents = settingsResult.allEvents || [];
            applyConfig();
            renderDynamicForm();
            renderSettings();
        }
        const data = await ApiClient.getBookingData();
        onDataLoaded(data);
    } catch (e) {
        console.error('reloadAfterEventChange error:', e);
    }
}

/**
 * Render the activities editor in the Settings tab
 */
function renderActivitiesEditor() {
    const container = document.getElementById('activitiesContainer');
    if (!container) return;
    
    const activities = window.availableActivities || [];
    
    if (activities.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <p class="text-lg">📦 ยังไม่มีกิจกรรม</p>
                <p class="text-sm mt-1">กดปุ่ม "เพิ่มกิจกรรมใหม่" เพื่อเริ่มต้น</p>
            </div>`;
        return;
    }
    
    let html = '';
    activities.forEach((act, index) => {
        const typeOptions = `
            <option value="Sizeable" ${act.type === 'Sizeable' ? 'selected' : ''}>Sizeable (มีไซส์/ตัวเลือก)</option>
            <option value="Quantity" ${act.type === 'Quantity' ? 'selected' : ''}>Quantity (ระบุจำนวน)</option>
        `;
        
        html += `
        <div class="bg-gray-50 rounded-xl border-2 border-gray-200 p-5 relative group hover:border-indigo-300 transition-colors" data-activity-index="${index}">
            <button type="button" onclick="removeActivity(${index})"
                class="absolute top-3 right-3 bg-red-100 text-red-600 hover:bg-red-600 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm font-bold opacity-60 group-hover:opacity-100"
                title="ลบกิจกรรมนี้">✕</button>
            
            <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div class="md:col-span-2">
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">ID</label>
                    <input type="text" value="${act.id}" 
                        class="act-id w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                        placeholder="SHIRT" ${act._isNew ? '' : 'readonly'} ${act._isNew ? '' : 'title="ID ของกิจกรรมที่มีอยู่แล้วไม่สามารถเปลี่ยนได้"'}>
                </div>
                <div class="md:col-span-4">
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">ชื่อกิจกรรม</label>
                    <input type="text" value="${act.name}" 
                        class="act-name w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                        placeholder="เช่น เสื้อกีฬา">
                </div>
                <div class="md:col-span-3">
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">ประเภท</label>
                    <select class="act-type w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500">
                        ${typeOptions}
                    </select>
                </div>
                <div class="md:col-span-3">
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">ราคา (บาท)</label>
                    <input type="number" value="${act.price}" min="0"
                        class="act-price w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-bold"
                        placeholder="300">
                </div>
            </div>
            <div class="mt-3">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">ตัวเลือก (Options) — คั่นด้วย comma</label>
                <input type="text" value="${(act.options || []).join(',')}" 
                    class="act-options w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                    placeholder="SS,S,M,L,XL,2XL,3XL (Sizeable) หรือปล่อยว่างสำหรับ Quantity">
            </div>
            ${act._isNew ? '<p class="text-xs text-green-600 font-bold mt-2">🆕 กิจกรรมใหม่ — จะถูกบันทึกเมื่อกดปุ่มบันทึก</p>' : ''}
        </div>`;
    });
    
    container.innerHTML = html;
}

/**
 * Add a new empty activity to the editor
 */
function addNewActivity() {
    if (!window.availableActivities) window.availableActivities = [];
    
    // Generate a unique default ID
    const existingIds = window.availableActivities.map(a => a.id);
    let newId = 'NEW_ACT';
    let suffix = 1;
    while (existingIds.includes(newId)) {
        newId = 'NEW_ACT' + suffix;
        suffix++;
    }
    
    window.availableActivities.push({
        id: newId,
        name: '',
        type: 'Quantity',
        price: 0,
        options: [],
        _isNew: true
    });
    
    renderActivitiesEditor();
    
    // Scroll to the new activity
    const container = document.getElementById('activitiesContainer');
    const lastCard = container.lastElementChild;
    if (lastCard) lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    showToast('เพิ่มกิจกรรมใหม่แล้ว กรอกข้อมูลแล้วกดบันทึก', 'success');
}

/**
 * Remove an activity from the editor
 */
function removeActivity(index) {
    const act = window.availableActivities[index];
    if (!act) return;
    
    const name = act.name || act.id;
    if (!confirm(`ต้องการลบกิจกรรม "${name}" หรือไม่?\n\n⚠️ การลบจะมีผลหลังจากกดปุ่ม "บันทึกการตั้งค่าทั้งหมด"`)) return;
    
    window.availableActivities.splice(index, 1);
    renderActivitiesEditor();
    showToast(`ลบกิจกรรม "${name}" แล้ว — อย่าลืมกดบันทึก!`, 'info');
}

/**
 * Collect current activity data from the editor form
 */
function collectActivitiesFromForm() {
    const cards = document.querySelectorAll('#activitiesContainer > div[data-activity-index]');
    const activities = [];
    
    cards.forEach(card => {
        const id = card.querySelector('.act-id')?.value.trim().toUpperCase() || '';
        const name = card.querySelector('.act-name')?.value.trim() || '';
        const type = card.querySelector('.act-type')?.value || 'Quantity';
        const price = parseInt(card.querySelector('.act-price')?.value) || 0;
        const optionsStr = card.querySelector('.act-options')?.value.trim() || '';
        const options = optionsStr ? optionsStr.split(',').map(o => o.trim()).filter(o => o) : [];
        
        if (id && name) {
            activities.push({ id, name, type, price, options });
        }
    });
    
    return activities;
}

/**
 * Save all settings and activities to the backend
 */
async function saveAllSettings(event) {
    event.preventDefault();
    if (!isAdmin) return;
    
    // Collect activities from form
    const activities = collectActivitiesFromForm();
    
    // Validate
    const ids = activities.map(a => a.id);
    const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (duplicateIds.length > 0) {
        showToast(`พบ ID ซ้ำ: ${duplicateIds.join(', ')} — กรุณาแก้ไขก่อนบันทึก`, 'error');
        return;
    }
    
    for (const act of activities) {
        if (!act.id || !act.name) {
            showToast('กรุณากรอก ID และชื่อกิจกรรมให้ครบทุกรายการ', 'error');
            return;
        }
        if (act.type === 'Sizeable' && act.options.length === 0) {
            showToast(`กิจกรรม "${act.name}" เป็นประเภท Sizeable แต่ไม่ได้ระบุ Options`, 'error');
            return;
        }
    }
    
    const settingsPayload = {
        EVENT_NAME: document.getElementById('setEventName').value,
        IS_BOOKING_OPEN: document.getElementById('setIsBookingOpen').checked ? "true" : "false"
    };
    
    const btn = document.getElementById('saveSettingsBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner mx-auto border-white"></div>';
    showLoading(true);
    
    try {
        // 1. Save basic settings
        await ApiClient.updateSettings(settingsPayload);
        
        // 2. Save activities
        const actResult = await ApiClient.request('updateActivities', {
            eventId: window.activeEvent ? window.activeEvent.id : 'CPD2026',
            activities: activities
        });
        
        if (actResult.isOk) {
            showToast('บันทึกการตั้งค่าและกิจกรรมสำเร็จ!', 'success');
            
            // Reload everything  
            const settingsResult = await ApiClient.getSettings();
            if (settingsResult.isOk) {
                appSettings = settingsResult.settings;
                window.activeEvent = settingsResult.activeEvent;
                window.availableActivities = settingsResult.activities || [];
                window.availableColors = settingsResult.colors || [];
                applyConfig();
                renderDynamicForm();
                renderActivitiesEditor();
            }
        } else {
            showToast('เกิดข้อผิดพลาด: ' + (actResult.error || 'Unknown'), 'error');
        }
    } catch (error) { 
        showToast('เกิดข้อผิดพลาด: ' + error.message, 'error'); 
    } finally { 
        showLoading(false);
        btn.disabled = false;
        btn.innerHTML = '💾 บันทึกการตั้งค่าทั้งหมด';
    }
}

document.addEventListener('DOMContentLoaded', init);
