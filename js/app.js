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
    applyConfig();
    showLoading(true);
    try {
        const data = await ApiClient.getBookingData();
        onDataLoaded(data);
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
    document.getElementById('systemTitle').textContent = CONFIG.SYSTEM_TITLE;
    document.getElementById('eventName').textContent = CONFIG.EVENT_NAME;
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
    setTimeout(() => { toast.classList.add('toast-exit'); setTimeout(() => toast.remove(), 300); }, 3000);
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
    if (isAdmin) {
        summaryTabBtn.classList.remove('hidden');
    } else {
        summaryTabBtn.classList.add('hidden');
        if (!document.getElementById('content-summary').classList.contains('hidden')) switchTab('booking');
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
    else if (tab === 'payment') { updatePaymentTable(); document.getElementById('paymentSearchInput').value = ''; filterPaymentTable(''); }
    else if (tab === 'status') updatePublicStatusTable();
}

function selectColor(color) {
    selectedColor = color;
    document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('ring-4', 'ring-indigo-500', 'bg-indigo-50'));
    document.querySelector(`[data-color="${color}"]`).classList.add('ring-4', 'ring-indigo-500', 'bg-indigo-50');
}

// ===== Booking Form =====
function previewBooking() {
    const coopName = document.getElementById('coopName').value.trim();
    const bookingPin = document.getElementById('bookingPin').value.trim();
    if (!coopName) { showToast('กรุณากรอกชื่อสหกรณ์', 'error'); return; }
    if (!bookingPin || bookingPin.length !== 10) { showToast('กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก', 'error'); return; }
    if (!selectedColor) { showToast('กรุณาเลือกสีทีมกีฬา', 'error'); return; }

    const shirtSS = parseInt(document.getElementById('shirtSS').value) || 0;
    const shirtS = parseInt(document.getElementById('shirtS').value) || 0;
    const shirtM = parseInt(document.getElementById('shirtM').value) || 0;
    const shirtL = parseInt(document.getElementById('shirtL').value) || 0;
    const shirtXL = parseInt(document.getElementById('shirtXL').value) || 0;
    const shirt2XL = parseInt(document.getElementById('shirt2XL').value) || 0;
    const shirt3XL = parseInt(document.getElementById('shirt3XL').value) || 0;
    const shirt4XL = parseInt(document.getElementById('shirt4XL').value) || 0;
    const shirt5XL = parseInt(document.getElementById('shirt5XL').value) || 0;
    const shirt6XL = parseInt(document.getElementById('shirt6XL').value) || 0;
    const shirt7XL = parseInt(document.getElementById('shirt7XL').value) || 0;
    const flowerCount = parseInt(document.getElementById('flowerCount').value) || 0;
    const tableCount = parseInt(document.getElementById('tableCount').value) || 0;
    const sponsorAmount = parseInt(document.getElementById('sponsorAmount').value) || 0;

    const totalShirts = shirtSS + shirtS + shirtM + shirtL + shirtXL + shirt2XL + shirt3XL + shirt4XL + shirt5XL + shirt6XL + shirt7XL;
    const shirtCost = totalShirts * 300;
    const flowerCost = flowerCount * 600;
    const tableCost = tableCount * 3000;
    const totalCost = shirtCost + flowerCost + tableCost + sponsorAmount;

    let previewHTML = `
        <div class="space-y-2 text-gray-700">
            <p><strong>เบอร์โทรศัพท์:</strong> <span class="text-indigo-600 font-bold">${bookingPin}</span></p>
            <p><strong>สหกรณ์:</strong> ${coopName}</p>
            <p><strong>สีทีม:</strong> ${colorEmoji[selectedColor]} ${colorName[selectedColor]}</p>
            <hr class="my-3">
            <p class="font-semibold">เสื้อกีฬา (รวม ${totalShirts} ตัว):</p>
            ${shirtSS > 0 ? `<p>• SS: ${shirtSS} ตัว</p>` : ''}
            ${shirtS > 0 ? `<p>• S: ${shirtS} ตัว</p>` : ''}
            ${shirtM > 0 ? `<p>• M: ${shirtM} ตัว</p>` : ''}
            ${shirtL > 0 ? `<p>• L: ${shirtL} ตัว</p>` : ''}
            ${shirtXL > 0 ? `<p>• XL: ${shirtXL} ตัว</p>` : ''}
            ${shirt2XL > 0 ? `<p>• 2XL: ${shirt2XL} ตัว</p>` : ''}
            ${shirt3XL > 0 ? `<p>• 3XL: ${shirt3XL} ตัว</p>` : ''}
            ${shirt4XL > 0 ? `<p>• 4XL: ${shirt4XL} ตัว</p>` : ''}
            ${shirt5XL > 0 ? `<p>• 5XL: ${shirt5XL} ตัว</p>` : ''}
            ${shirt6XL > 0 ? `<p>• 6XL: ${shirt6XL} ตัว</p>` : ''}
            ${shirt7XL > 0 ? `<p>• 7XL: ${shirt7XL} ตัว</p>` : ''}
            <p class="text-right font-medium">ค่าเสื้อ: ${shirtCost.toLocaleString()} บาท</p>
            <hr class="my-3">
            <p><strong>พานพุ่ม:</strong> ${flowerCount} พาน</p>
            <p class="text-right font-medium">ค่าพานพุ่ม: ${flowerCost.toLocaleString()} บาท</p>
            <hr class="my-3">
            <p><strong>โต๊ะจีน:</strong> ${tableCount} โต๊ะ</p>
            <p class="text-right font-medium">ค่าโต๊ะจีน: ${tableCost.toLocaleString()} บาท</p>
            ${sponsorAmount > 0 ? `<hr class="my-3"><p><strong>เงินสนับสนุน:</strong> <span class="text-green-600">+${sponsorAmount.toLocaleString()} บาท</span></p>` : ''}
        </div>
    `;
    document.getElementById('previewContent').innerHTML = previewHTML;
    document.getElementById('previewTotal').textContent = totalCost.toLocaleString();
    document.getElementById('previewModal').classList.remove('hidden');
}

function closePreview() { document.getElementById('previewModal').classList.add('hidden'); }

async function confirmBooking() {
    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<div class="spinner mx-auto"></div>';

    const coopName = document.getElementById('coopName').value.trim();
    const bookingPin = document.getElementById('bookingPin').value.trim();
    const shirtSS = parseInt(document.getElementById('shirtSS').value) || 0;
    const shirtS = parseInt(document.getElementById('shirtS').value) || 0;
    const shirtM = parseInt(document.getElementById('shirtM').value) || 0;
    const shirtL = parseInt(document.getElementById('shirtL').value) || 0;
    const shirtXL = parseInt(document.getElementById('shirtXL').value) || 0;
    const shirt2XL = parseInt(document.getElementById('shirt2XL').value) || 0;
    const shirt3XL = parseInt(document.getElementById('shirt3XL').value) || 0;
    const shirt4XL = parseInt(document.getElementById('shirt4XL').value) || 0;
    const shirt5XL = parseInt(document.getElementById('shirt5XL').value) || 0;
    const shirt6XL = parseInt(document.getElementById('shirt6XL').value) || 0;
    const shirt7XL = parseInt(document.getElementById('shirt7XL').value) || 0;
    const flowerCount = parseInt(document.getElementById('flowerCount').value) || 0;
    const tableCount = parseInt(document.getElementById('tableCount').value) || 0;
    const sponsorAmount = parseInt(document.getElementById('sponsorAmount').value) || 0;

    const totalShirts = shirtSS + shirtS + shirtM + shirtL + shirtXL + shirt2XL + shirt3XL + shirt4XL + shirt5XL + shirt6XL + shirt7XL;
    const totalAmount = (totalShirts * 300) + (flowerCount * 600) + (tableCount * 3000) + sponsorAmount;

    let bookingId = editingBookingId;
    if (!editingBookingId) {
        const now = new Date();
        bookingId = String(now.getDate()).padStart(2, '0') + String(now.getMonth() + 1).padStart(2, '0') + (now.getFullYear() + 543) + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    }

    const bookingData = {
        id: bookingId, pin: bookingPin, coop_name: coopName, coop_color: selectedColor,
        shirt_ss: shirtSS, shirt_s: shirtS, shirt_m: shirtM, shirt_l: shirtL, shirt_xl: shirtXL,
        shirt_2xl: shirt2XL, shirt_3xl: shirt3XL, shirt_4xl: shirt4XL, shirt_5xl: shirt5XL, shirt_6xl: shirt6XL, shirt_7xl: shirt7XL,
        flower_count: flowerCount, table_count: tableCount, sponsor_amount: sponsorAmount, total_amount: totalAmount, payment_status: 'รอชำระ'
    };

    try {
        let result = editingBookingId ? await ApiClient.updateBooking(bookingData) : await ApiClient.createBooking(bookingData);
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '✅ ยืนยันการจอง';
        if (result.isOk) {
            showToast(editingBookingId ? 'แก้ไขข้อมูลสำเร็จ!' : 'บันทึกข้อมูลสำเร็จ!', 'success');
            closePreview(); resetForm(); currentPaymentCoop = null; closePaymentModal(); updatePaymentTable(); init();
        } else { showToast('เกิดข้อผิดพลาด: ' + result.error, 'error'); }
    } catch (error) {
        confirmBtn.disabled = false; confirmBtn.innerHTML = '✅ ยืนยันการจอง';
        showToast('Connection error: ' + error.message, 'error');
    }
}

function resetForm() {
    document.getElementById('coopName').value = '';
    const pinInput = document.getElementById('bookingPin');
    pinInput.value = ''; pinInput.disabled = false; pinInput.classList.remove('bg-gray-100');
    ['shirtSS', 'shirtS', 'shirtM', 'shirtL', 'shirtXL', 'shirt2XL', 'shirt3XL', 'shirt4XL', 'shirt5XL', 'shirt6XL', 'shirt7XL', 'flowerCount', 'tableCount', 'sponsorAmount'].forEach(id => document.getElementById(id).value = '');
    editingBookingId = null; selectedColor = '';
    document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('ring-4', 'ring-indigo-500', 'bg-indigo-50'));
}

function startEditBooking() {
    if (!currentPaymentCoop) return;
    document.getElementById('paymentDetailModal').classList.add('hidden');
    document.querySelectorAll('.payment-row-item').forEach(r => r.classList.remove('bg-indigo-100', 'ring-2', 'ring-inset', 'ring-indigo-500'));
    proceedToEdit(); currentPaymentCoop = null;
}

function proceedToEdit() {
    editingBookingId = currentPaymentCoop.id;
    document.getElementById('coopName').value = currentPaymentCoop.coop_name;
    const pinInput = document.getElementById('bookingPin');
    pinInput.value = currentPaymentCoop.pin || ''; pinInput.disabled = true; pinInput.classList.add('bg-gray-100');
    selectColor(currentPaymentCoop.coop_color);
    document.getElementById('shirtSS').value = currentPaymentCoop.shirt_ss || '';
    document.getElementById('shirtS').value = currentPaymentCoop.shirt_s || '';
    document.getElementById('shirtM').value = currentPaymentCoop.shirt_m || '';
    document.getElementById('shirtL').value = currentPaymentCoop.shirt_l || '';
    document.getElementById('shirtXL').value = currentPaymentCoop.shirt_xl || '';
    document.getElementById('shirt2XL').value = currentPaymentCoop.shirt_2xl || '';
    document.getElementById('shirt3XL').value = currentPaymentCoop.shirt_3xl || '';
    document.getElementById('shirt4XL').value = currentPaymentCoop.shirt_4xl || '';
    document.getElementById('shirt5XL').value = currentPaymentCoop.shirt_5xl || '';
    document.getElementById('shirt6XL').value = currentPaymentCoop.shirt_6xl || '';
    document.getElementById('shirt7XL').value = currentPaymentCoop.shirt_7xl || '';
    document.getElementById('flowerCount').value = currentPaymentCoop.flower_count || '';
    document.getElementById('tableCount').value = currentPaymentCoop.table_count || '';
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
    const totalShirts = (currentPaymentCoop.shirt_ss || 0) + (currentPaymentCoop.shirt_s || 0) + (currentPaymentCoop.shirt_m || 0) + (currentPaymentCoop.shirt_l || 0) + (currentPaymentCoop.shirt_xl || 0) + (currentPaymentCoop.shirt_2xl || 0) + (currentPaymentCoop.shirt_3xl || 0) + (currentPaymentCoop.shirt_4xl || 0) + (currentPaymentCoop.shirt_5xl || 0) + (currentPaymentCoop.shirt_6xl || 0) + (currentPaymentCoop.shirt_7xl || 0);
    const colorNameFull = { 'green': '🟢 สีเขียว', 'blue': '🔵 สีฟ้า', 'purple': '🟣 สีม่วง', 'pink': '💗 สีชมพู' };
    let shirtDetailsHTML = '';
    if (currentPaymentCoop.shirt_ss > 0) shirtDetailsHTML += `<p class="ml-4">• SS: ${currentPaymentCoop.shirt_ss} ตัว</p>`;
    if (currentPaymentCoop.shirt_s > 0) shirtDetailsHTML += `<p class="ml-4">• S: ${currentPaymentCoop.shirt_s} ตัว</p>`;
    if (currentPaymentCoop.shirt_m > 0) shirtDetailsHTML += `<p class="ml-4">• M: ${currentPaymentCoop.shirt_m} ตัว</p>`;
    if (currentPaymentCoop.shirt_l > 0) shirtDetailsHTML += `<p class="ml-4">• L: ${currentPaymentCoop.shirt_l} ตัว</p>`;
    if (currentPaymentCoop.shirt_xl > 0) shirtDetailsHTML += `<p class="ml-4">• XL: ${currentPaymentCoop.shirt_xl} ตัว</p>`;
    if (currentPaymentCoop.shirt_2xl > 0) shirtDetailsHTML += `<p class="ml-4">• 2XL: ${currentPaymentCoop.shirt_2xl} ตัว</p>`;
    if (currentPaymentCoop.shirt_3xl > 0) shirtDetailsHTML += `<p class="ml-4">• 3XL: ${currentPaymentCoop.shirt_3xl} ตัว</p>`;
    if (currentPaymentCoop.shirt_4xl > 0) shirtDetailsHTML += `<p class="ml-4">• 4XL: ${currentPaymentCoop.shirt_4xl} ตัว</p>`;
    if (currentPaymentCoop.shirt_5xl > 0) shirtDetailsHTML += `<p class="ml-4">• 5XL: ${currentPaymentCoop.shirt_5xl} ตัว</p>`;
    if (currentPaymentCoop.shirt_6xl > 0) shirtDetailsHTML += `<p class="ml-4">• 6XL: ${currentPaymentCoop.shirt_6xl} ตัว</p>`;
    if (currentPaymentCoop.shirt_7xl > 0) shirtDetailsHTML += `<p class="ml-4">• 7XL: ${currentPaymentCoop.shirt_7xl} ตัว</p>`;
    const sponsorAmount = currentPaymentCoop.sponsor_amount || 0;
    let detailsHTML = `<p class="text-xs text-gray-500 mb-2">Booking ID: ${currentPaymentCoop.id}</p><p><strong>สหกรณ์:</strong> ${currentPaymentCoop.coop_name}</p><p><strong>สีทีม:</strong> ${colorNameFull[currentPaymentCoop.coop_color]}</p><p><strong>เสื้อกีฬา:</strong> รวม ${totalShirts} ตัว × 300 บาท = ${(totalShirts * 300).toLocaleString()} บาท</p>${shirtDetailsHTML}<p><strong>พานพุ่ม:</strong> ${currentPaymentCoop.flower_count} พาน × 600 บาท = ${(currentPaymentCoop.flower_count * 600).toLocaleString()} บาท</p><p><strong>โต๊ะจีน:</strong> ${currentPaymentCoop.table_count} โต๊ะ × 3,000 บาท = ${(currentPaymentCoop.table_count * 3000).toLocaleString()} บาท</p>${sponsorAmount > 0 ? `<p><strong>เงินสนับสนุน:</strong> <span class="text-green-600">+${sponsorAmount.toLocaleString()} บาท</span></p>` : ''}`;
    document.getElementById('modalPaymentDetails').innerHTML = detailsHTML;
    document.getElementById('modalTotalPayment').textContent = currentPaymentCoop.total_amount.toLocaleString();
    document.getElementById('paymentDetailModal').classList.remove('hidden');
    if (isAdmin) { document.getElementById('uploadSection').classList.add('hidden'); document.getElementById('adminStatusSection').classList.remove('hidden'); document.getElementById('adminSlipSection').classList.remove('hidden'); if (currentPaymentCoop.proof_url) { const proofs = currentPaymentCoop.proof_url.split(',').filter(url => url.trim() !== ''); document.getElementById('slipDisplay').innerHTML = `<button onclick="openGallery('${currentPaymentCoop.proof_url}')" class="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2">📷 ดูหลักฐานการโอน (${proofs.length} รูป)</button>`; } else { document.getElementById('slipDisplay').textContent = "ยังไม่มีการแนบหลักฐาน"; } updateStatusButtons(currentPaymentCoop.payment_status); }
    else { document.getElementById('uploadSection').classList.remove('hidden'); document.getElementById('adminStatusSection').classList.add('hidden'); document.getElementById('adminSlipSection').classList.add('hidden'); const editBtn = document.getElementById('editBookingBtn'); const cancelBtn = document.getElementById('cancelBookingBtn'); if (currentPaymentCoop.payment_status === 'รอชำระ' && !currentPaymentCoop.proof_url) { editBtn.classList.remove('hidden'); cancelBtn.classList.remove('hidden'); } else { editBtn.classList.add('hidden'); cancelBtn.classList.add('hidden'); } }
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

async function uploadSlip() {
    const fileInput = document.getElementById('slipInput'); const file = fileInput.files[0];
    if (!file) { showToast('กรุณาเลือกไฟล์รูปภาพ', 'error'); return; }
    const uploadBtn = document.getElementById('uploadBtn'); uploadBtn.disabled = true; uploadBtn.innerHTML = '<div class="spinner mx-auto"></div>';
    const reader = new FileReader();
    reader.onload = async function (e) {
        const base64Data = e.target.result.split(',')[1];
        try { const result = await ApiClient.uploadSlip(currentPaymentCoop, base64Data, file.type); uploadBtn.disabled = false; uploadBtn.innerHTML = '📤 อัพโหลดหลักฐาน'; if (result.isOk) { showToast('อัพโหลดสำเร็จ! กรุณารอตรวจสอบ', 'success'); fileInput.value = ''; currentPaymentCoop = null; updatePaymentTable(); closePaymentModal(); init(); } else { showToast('เกิดข้อผิดพลาด: ' + result.error, 'error'); } }
        catch (error) { uploadBtn.disabled = false; uploadBtn.innerHTML = '📤 อัพโหลดหลักฐาน'; showToast('Upload failed: ' + error.message, 'error'); }
    };
    reader.readAsDataURL(file);
}

async function savePaymentStatus() {
    if (!currentPaymentCoop || !isAdmin) return;
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

function updateSummaryTab() {
    let totalShirts = 0, totalFlowers = 0, totalTables = 0, totalSponsor = 0, totalRevenue = 0;
    let countSS = 0, countS = 0, countM = 0, countL = 0, countXL = 0, count2XL = 0, count3XL = 0, count4XL = 0, count5XL = 0, count6XL = 0, count7XL = 0;
    const uniqueCoops = new Set();
    const uniqueCoopsByColor = { green: new Set(), blue: new Set(), purple: new Set(), pink: new Set() };

    // Size Counters by Color
    const sizesByColor = {
        green: { ss: 0, s: 0, m: 0, l: 0, xl: 0, '2xl': 0, '3xl': 0, '4xl': 0, '5xl': 0, '6xl': 0, '7xl': 0 },
        blue: { ss: 0, s: 0, m: 0, l: 0, xl: 0, '2xl': 0, '3xl': 0, '4xl': 0, '5xl': 0, '6xl': 0, '7xl': 0 },
        purple: { ss: 0, s: 0, m: 0, l: 0, xl: 0, '2xl': 0, '3xl': 0, '4xl': 0, '5xl': 0, '6xl': 0, '7xl': 0 },
        pink: { ss: 0, s: 0, m: 0, l: 0, xl: 0, '2xl': 0, '3xl': 0, '4xl': 0, '5xl': 0, '6xl': 0, '7xl': 0 }
    };

    allBookings.forEach(booking => {
        if (booking.payment_status === 'ชำระแล้ว') {
            const normalizedName = normalizeCoopName(booking.coop_name);
            uniqueCoops.add(normalizedName);
            totalShirts += (booking.shirt_ss || 0) + (booking.shirt_s || 0) + (booking.shirt_m || 0) + (booking.shirt_l || 0) + (booking.shirt_xl || 0) + (booking.shirt_2xl || 0) + (booking.shirt_3xl || 0) + (booking.shirt_4xl || 0) + (booking.shirt_5xl || 0) + (booking.shirt_6xl || 0) + (booking.shirt_7xl || 0);
            countSS += booking.shirt_ss || 0; countS += booking.shirt_s || 0; countM += booking.shirt_m || 0; countL += booking.shirt_l || 0; countXL += booking.shirt_xl || 0;
            count2XL += booking.shirt_2xl || 0; count3XL += booking.shirt_3xl || 0; count4XL += booking.shirt_4xl || 0; count5XL += booking.shirt_5xl || 0; count6XL += booking.shirt_6xl || 0; count7XL += booking.shirt_7xl || 0;

            // Accumulate Sizes by Color
            const color = booking.coop_color;
            if (sizesByColor[color]) {
                sizesByColor[color].ss += booking.shirt_ss || 0;
                sizesByColor[color].s += booking.shirt_s || 0;
                sizesByColor[color].m += booking.shirt_m || 0;
                sizesByColor[color].l += booking.shirt_l || 0;
                sizesByColor[color].xl += booking.shirt_xl || 0;
                sizesByColor[color]['2xl'] += booking.shirt_2xl || 0;
                sizesByColor[color]['3xl'] += booking.shirt_3xl || 0;
                sizesByColor[color]['4xl'] += booking.shirt_4xl || 0;
                sizesByColor[color]['5xl'] += booking.shirt_5xl || 0;
                sizesByColor[color]['6xl'] += booking.shirt_6xl || 0;
                sizesByColor[color]['7xl'] += booking.shirt_7xl || 0;
            }

            totalFlowers += booking.flower_count || 0; totalTables += booking.table_count || 0; totalSponsor += booking.sponsor_amount || 0; totalRevenue += booking.total_amount || 0;
            if (uniqueCoopsByColor[booking.coop_color] !== undefined) uniqueCoopsByColor[booking.coop_color].add(normalizedName);
        }
    });

    document.getElementById('totalCoops').textContent = uniqueCoops.size;
    document.getElementById('totalShirts').textContent = totalShirts;
    document.getElementById('totalFlowers').textContent = totalFlowers;
    document.getElementById('totalTables').textContent = totalTables;
    document.getElementById('totalSponsor').textContent = totalSponsor.toLocaleString();
    document.getElementById('totalRevenue').textContent = totalRevenue.toLocaleString();
    document.getElementById('totalSS').textContent = countSS; document.getElementById('totalS').textContent = countS; document.getElementById('totalM').textContent = countM; document.getElementById('totalL').textContent = countL; document.getElementById('totalXL').textContent = countXL;
    document.getElementById('total2XL').textContent = count2XL; document.getElementById('total3XL').textContent = count3XL; document.getElementById('total4XL').textContent = count4XL; document.getElementById('total5XL').textContent = count5XL; document.getElementById('total6XL').textContent = count6XL; document.getElementById('total7XL').textContent = count7XL;

    // Update Sizes by Color Table
    const colors = ['green', 'blue', 'purple', 'pink'];
    const sizes = ['SS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL'];
    const sizeKeys = ['ss', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl'];

    colors.forEach(color => {
        let colorTotal = 0;
        sizeKeys.forEach((key, index) => {
            const value = sizesByColor[color][key];
            colorTotal += value;
            const elementId = color + sizes[index];
            const element = document.getElementById(elementId);
            if (element) element.textContent = value;
        });
        // Update total for this color
        const totalElement = document.getElementById(color + 'Total');
        if (totalElement) totalElement.textContent = colorTotal;
    });

    const bookingIdHeader = document.getElementById('bookingIdHeader'); const distributionHeader = document.getElementById('distributionHeader');
    if (isAdmin) { bookingIdHeader.classList.remove('hidden'); distributionHeader.classList.remove('hidden'); } else { bookingIdHeader.classList.add('hidden'); distributionHeader.classList.add('hidden'); }

    const tbody = document.getElementById('summaryTableBody'); tbody.innerHTML = '';
    let filteredBookings = allBookings; if (summarySearchQuery) filteredBookings = allBookings.filter(b => matchSearchQuery(b, summarySearchQuery));
    const statusOrder = { 'รอชำระ': 1, 'รอตรวจสอบ': 2, 'ชำระแล้ว': 3 };
    const sortedBookings = [...filteredBookings].sort((a, b) => { const statusA = statusOrder[a.payment_status] || 999; const statusB = statusOrder[b.payment_status] || 999; if (statusA !== statusB) return statusA - statusB; if (a.coop_color < b.coop_color) return -1; if (a.coop_color > b.coop_color) return 1; return String(a.coop_name || "").localeCompare(String(b.coop_name || "")); });
    const totalPages = Math.ceil(sortedBookings.length / CONFIG.ITEMS_PER_PAGE); if (summaryCurrentPage > totalPages) summaryCurrentPage = totalPages || 1; if (summaryCurrentPage < 1) summaryCurrentPage = 1;
    const paginatedBookings = sortedBookings.slice((summaryCurrentPage - 1) * CONFIG.ITEMS_PER_PAGE, summaryCurrentPage * CONFIG.ITEMS_PER_PAGE);
    document.getElementById('summaryPageInfo').textContent = `หน้า ${summaryCurrentPage} จาก ${totalPages || 1}`; document.getElementById('summaryPrevBtn').disabled = summaryCurrentPage === 1; document.getElementById('summaryNextBtn').disabled = summaryCurrentPage >= totalPages;
    const paginationDiv = document.getElementById('summaryPagination'); if (sortedBookings.length <= CONFIG.ITEMS_PER_PAGE) paginationDiv.classList.add('hidden'); else paginationDiv.classList.remove('hidden');
    if (paginatedBookings.length === 0) { tbody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-gray-500">ไม่พบข้อมูล</td></tr>`; return; }
    const colorNameFull = { 'green': '🟢 สีเขียว', 'blue': '🔵 สีฟ้า', 'purple': '🟣 สีม่วง', 'pink': '💗 สีชมพู' };
    paginatedBookings.forEach(booking => {
        const totalShirts = (booking.shirt_ss || 0) + (booking.shirt_s || 0) + (booking.shirt_m || 0) + (booking.shirt_l || 0) + (booking.shirt_xl || 0) + (booking.shirt_2xl || 0) + (booking.shirt_3xl || 0) + (booking.shirt_4xl || 0) + (booking.shirt_5xl || 0) + (booking.shirt_6xl || 0) + (booking.shirt_7xl || 0);
        const sponsorAmount = booking.sponsor_amount || 0;
        let statusColor = 'bg-yellow-100 text-yellow-700'; if (booking.payment_status === 'ชำระแล้ว') statusColor = 'bg-green-100 text-green-700'; else if (booking.payment_status === 'รอตรวจสอบ') statusColor = 'bg-blue-100 text-blue-700';
        const distributionStatus = booking.distribution_status || 'ยังไม่แจก'; const isDistributed = distributionStatus === 'แจกแล้ว'; const distributionBadgeColor = isDistributed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'; const distributionIcon = isDistributed ? '✅' : '⏳';
        const row = document.createElement('tr'); row.className = 'hover:bg-gray-50';
        row.innerHTML = `<td class="border px-4 py-2">${booking.coop_name}</td><td class="border px-4 py-2 text-center">${colorNameFull[booking.coop_color]}</td><td class="border px-4 py-2 text-center">${totalShirts}</td><td class="border px-4 py-2 text-center">${booking.flower_count || 0}</td><td class="border px-4 py-2 text-center">${booking.table_count || 0}</td><td class="border px-4 py-2 text-center ${sponsorAmount > 0 ? 'text-green-600' : ''}">${sponsorAmount > 0 ? sponsorAmount.toLocaleString() : '-'}</td><td class="border px-4 py-2 text-center font-semibold">${(booking.total_amount || 0).toLocaleString()}</td><td class="border px-4 py-2 text-center"><button onclick="showSizeDetail('${booking.id}')" class="bg-indigo-100 text-indigo-600 hover:bg-indigo-200 p-2 rounded-full transition-colors" title="ดูรายละเอียดไซส์">👕</button></td><td class="border px-4 py-2 text-center"><span class="px-3 py-1 rounded-full text-sm font-medium ${statusColor}">${booking.payment_status}</span></td><td class="border px-4 py-2 text-center font-mono text-sm text-gray-600 ${isAdmin ? '' : 'hidden'}"><div>${booking.id}</div>${booking.proof_url ? `<button onclick="openGallery('${booking.proof_url}')" class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded mt-1 inline-flex items-center gap-1">📄 สลิปการโอน</button>` : ''}</td><td class="border px-4 py-2 text-center ${isAdmin ? '' : 'hidden'}"><label class="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" ${isDistributed ? 'checked' : ''} onchange="toggleDistributionStatus('${booking.id}', this.checked)" class="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"><span class="px-2 py-1 rounded-full text-xs font-medium ${distributionBadgeColor}">${distributionIcon} ${distributionStatus}</span></label></td>`;
        tbody.appendChild(row);
    });
}

function showSizeDetail(id) {
    const booking = allBookings.find(b => b.id == id); if (!booking) return;
    const totalShirts = (booking.shirt_ss || 0) + (booking.shirt_s || 0) + (booking.shirt_m || 0) + (booking.shirt_l || 0) + (booking.shirt_xl || 0) + (booking.shirt_2xl || 0) + (booking.shirt_3xl || 0) + (booking.shirt_4xl || 0) + (booking.shirt_5xl || 0) + (booking.shirt_6xl || 0) + (booking.shirt_7xl || 0);
    const html = `<div class="space-y-3"><div><p class="font-bold text-gray-700">${booking.coop_name}</p></div><div class="grid grid-cols-3 gap-2 text-sm"><div class="bg-gray-50 p-2 rounded flex justify-between"><span>SS:</span> <span class="font-bold">${booking.shirt_ss || 0}</span></div><div class="bg-gray-50 p-2 rounded flex justify-between"><span>S:</span> <span class="font-bold">${booking.shirt_s || 0}</span></div><div class="bg-gray-50 p-2 rounded flex justify-between"><span>M:</span> <span class="font-bold">${booking.shirt_m || 0}</span></div><div class="bg-gray-50 p-2 rounded flex justify-between"><span>L:</span> <span class="font-bold">${booking.shirt_l || 0}</span></div><div class="bg-gray-50 p-2 rounded flex justify-between"><span>XL:</span> <span class="font-bold">${booking.shirt_xl || 0}</span></div><div class="bg-gray-50 p-2 rounded flex justify-between"><span>2XL:</span> <span class="font-bold">${booking.shirt_2xl || 0}</span></div><div class="bg-gray-50 p-2 rounded flex justify-between"><span>3XL:</span> <span class="font-bold">${booking.shirt_3xl || 0}</span></div><div class="bg-gray-50 p-2 rounded flex justify-between"><span>4XL:</span> <span class="font-bold">${booking.shirt_4xl || 0}</span></div><div class="bg-gray-50 p-2 rounded flex justify-between"><span>5XL:</span> <span class="font-bold">${booking.shirt_5xl || 0}</span></div><div class="bg-gray-50 p-2 rounded flex justify-between"><span>6XL:</span> <span class="font-bold">${booking.shirt_6xl || 0}</span></div><div class="bg-gray-50 p-2 rounded flex justify-between"><span>7XL:</span> <span class="font-bold">${booking.shirt_7xl || 0}</span></div></div><div class="mt-3 pt-3 border-t flex justify-between font-bold text-indigo-600"><span>รวมทั้งหมด:</span><span>${totalShirts} ตัว</span></div></div>`;
    document.getElementById('sizeDetailContent').innerHTML = html; document.getElementById('sizeDetailModal').classList.remove('hidden');
}

async function toggleDistributionStatus(id, isChecked) {
    if (!isAdmin) { showToast('คุณไม่มีสิทธิ์ในการเปลี่ยนแปลงสถานะการแจกจ่าย', 'error'); return; }
    const newStatus = isChecked ? 'แจกแล้ว' : 'ยังไม่แจก'; showLoading(true);
    try { const result = await ApiClient.updateDistributionStatus(id, newStatus); showLoading(false); if (result.isOk) { showToast(`อัพเดตสถานะเป็น "${newStatus}" สำเร็จ!`, 'success'); const booking = allBookings.find(b => b.id === id); if (booking) booking.distribution_status = newStatus; updateSummaryTab(); } else { showToast('เกิดข้อผิดพลาด: ' + result.error, 'error'); updateSummaryTab(); } }
    catch (error) { showLoading(false); showToast('Connection error: ' + error.message, 'error'); updateSummaryTab(); }
}

document.addEventListener('DOMContentLoaded', init);
