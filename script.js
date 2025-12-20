// =========================================
// Ha Huynh Scheduler - Complete Firebase Version
// =========================================

let db;
let services = [];
let timeSlots = [];
let bookingData = {
    service: null,
    date: null,
    time: null,
    customer: {}
};
let currentStep = 1;
let currentAdminDate = new Date();
let selectedAdminDateStr = null;

// Default data
const DEFAULT_SERVICES = [
    { id: '1', name: 'Classic Manicure', duration: 30, price: 35 },
    { id: '2', name: 'Gel Manicure', duration: 45, price: 50 },
    { id: '3', name: 'Luxury Spa Manicure', duration: 60, price: 65 },
    { id: '4', name: 'Classic Pedicure', duration: 45, price: 45 },
    { id: '5', name: 'Deluxe Pedicure', duration: 60, price: 70 },
    { id: '6', name: 'Simple Nail Art', duration: 15, price: 15 },
    { id: '7', name: 'Intricate Nail Art', duration: 30, price: 30 }
];

const DEFAULT_TIMESLOTS = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM',
    '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM'
];

// =========================================
// INITIALIZATION
// =========================================

document.addEventListener('DOMContentLoaded', async function () {
    console.log("DOM Loaded - Initializing...");

    // Initialize Firebase
    try {
        const firebaseConfig = {
            apiKey: "AIzaSyD0a4zOpLJALSaUpvTBPrNDpCKQ3sKbsjM",
            authDomain: "ha-booker.firebaseapp.com",
            projectId: "ha-booker",
            storageBucket: "ha-booker.firebasestorage.app",
            messagingSenderId: "143596114462",
            appId: "1:143596114462:web:cb6ac81843c8e4dbdd140f"
        };

        if (typeof firebase === 'undefined') {
            console.error("Firebase SDK not loaded!");
            alert("Error: Firebase not loaded. Check internet connection.");
            return;
        }

        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log("Firebase initialized");
    } catch (e) {
        console.error("Firebase init error:", e);
    }

    // Load data
    await loadServices();
    await loadTimeSlots();

    // Detect page and initialize
    if (document.getElementById('step-1')) {
        console.log("Booking page");
        initBookingPage();
    } else if (document.getElementById('admin-calendar-grid')) {
        console.log("Admin page");
        checkAuth();
        initDashboard();
    } else if (document.getElementById('admin-pin')) {
        console.log("Login page");
    } else if (document.getElementById('check-result')) {
        console.log("Check page");
    }
});

// =========================================
// DATA LOADING
// =========================================

async function loadServices() {
    try {
        if (!db) {
            services = DEFAULT_SERVICES;
            return;
        }

        const snapshot = await db.collection("services").get();
        services = [];
        snapshot.forEach(doc => {
            services.push({ id: doc.id, ...doc.data() });
        });

        if (services.length === 0) {
            services = DEFAULT_SERVICES;
        }
        console.log("Services loaded:", services.length);
    } catch (e) {
        console.error("Error loading services:", e);
        services = DEFAULT_SERVICES;
    }
}

async function loadTimeSlots() {
    try {
        if (!db) {
            timeSlots = DEFAULT_TIMESLOTS;
            return;
        }

        const doc = await db.collection("settings").doc("timeslots").get();
        if (doc.exists && doc.data().slots) {
            timeSlots = doc.data().slots;
        } else {
            timeSlots = DEFAULT_TIMESLOTS;
        }
        console.log("TimeSlots loaded:", timeSlots.length);
    } catch (e) {
        console.error("Error loading timeslots:", e);
        timeSlots = DEFAULT_TIMESLOTS;
    }
}

// =========================================
// HELPER: Get Minutes from Time String
// =========================================

function getMinutes(timeStr) {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours);
    minutes = parseInt(minutes);
    if (hours === 12) hours = 0;
    if (modifier === 'PM') hours += 12;
    return hours * 60 + minutes;
}

// =========================================
// BOOKING PAGE
// =========================================

function initBookingPage() {
    // Check for reschedule
    const rescheduleId = sessionStorage.getItem('ha_reschedule_id');
    if (rescheduleId) {
        const savedService = sessionStorage.getItem('ha_reschedule_service');
        if (savedService) {
            try {
                bookingData.service = JSON.parse(savedService);
            } catch (e) { }
        }
    }

    // Check for service param in URL (from services.html links)
    const urlParams = new URLSearchParams(window.location.search);
    const serviceParam = urlParams.get('service');
    if (serviceParam && !bookingData.service) {
        const foundService = services.find(s => s.name.toLowerCase() === serviceParam.toLowerCase());
        if (foundService) {
            bookingData.service = foundService;
            currentStep = 2; // Skip to step 2 since service is pre-selected
        }
    }

    initServicesGrid();
    initDates();
    updateUI();

    // Phone number auto-formatting
    const phoneInput = document.getElementById('customer-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 10) value = value.slice(0, 10);

            if (value.length >= 6) {
                e.target.value = `(${value.slice(0, 3)})-${value.slice(3, 6)}-${value.slice(6)}`;
            } else if (value.length >= 3) {
                e.target.value = `(${value.slice(0, 3)})-${value.slice(3)}`;
            } else if (value.length > 0) {
                e.target.value = `(${value}`;
            }
        });
    }
}

function initServicesGrid() {
    const container = document.querySelector('#step-1 .grid');
    if (!container) return;

    if (services.length === 0) {
        container.innerHTML = '<p style="text-align:center; grid-column: span 2;">Loading services...</p>';
        return;
    }

    container.innerHTML = services.map(s => `
        <div class="service-card" onclick="selectService('${s.id}')">
            <div>
                <h4 style="font-weight: bold; margin-bottom: 0.25rem;">${s.name}</h4>
                <p style="font-size: 0.875rem; color: #666;">${s.duration} min • $${s.price}</p>
            </div>
            <i data-lucide="check" class="check-icon" style="color: var(--color-primary); opacity: ${bookingData.service && bookingData.service.id == s.id ? '1' : '0'};"></i>
        </div>
    `).join('');

    // Mark selected
    if (bookingData.service) {
        document.querySelectorAll('.service-card').forEach(el => {
            if (el.innerText.includes(bookingData.service.name)) {
                el.classList.add('selected');
            }
        });
    }
}

function selectService(id) {
    const service = services.find(s => s.id == id);
    if (service) {
        bookingData.service = service;
        sessionStorage.setItem('ha_booking_data', JSON.stringify(bookingData));

        document.querySelectorAll('.service-card').forEach(el => {
            el.classList.remove('selected');
            const icon = el.querySelector('.check-icon');
            if (icon) icon.style.opacity = '0';
        });

        if (event && event.currentTarget) {
            event.currentTarget.classList.add('selected');
            const icon = event.currentTarget.querySelector('.check-icon');
            if (icon) icon.style.opacity = '1';
        }

        nextStep();
    }
}

function initDates() {
    const container = document.getElementById('dates-container');
    if (!container) return;

    const today = new Date();
    let html = '';

    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = d.getDate();
        const dateStr = d.toDateString();

        html += `
            <div class="date-card" onclick="selectDate(this, '${dateStr}')">
                <div style="font-size: 0.75rem;">${dayName}</div>
                <div style="font-weight: bold; font-size: 1.25rem;">${dayNum}</div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function selectDate(el, dateStr) {
    bookingData.date = new Date(dateStr);
    bookingData.time = null;
    sessionStorage.setItem('ha_booking_data', JSON.stringify(bookingData));

    document.querySelectorAll('.date-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');

    initTimes();
    checkStep2Validity();
}

// DURATION-AWARE TIME BLOCKING
async function initTimes() {
    const container = document.getElementById('times-container');
    if (!container) return;

    container.innerHTML = '<p style="text-align:center; grid-column: span 2;">Loading availability...</p>';

    const dateStr = bookingData.date.toDateString();
    let occupiedIntervals = [];

    // Get existing appointments - DURATION AWARE
    try {
        if (db) {
            const snapshot = await db.collection("appointments")
                .where("date", "==", dateStr)
                .get();

            snapshot.forEach(doc => {
                const apt = doc.data();
                if (apt.status === 'cancelled') return;

                const startMin = getMinutes(apt.time);
                const duration = (apt.service && apt.service.duration) ? parseInt(apt.service.duration) : 30;
                occupiedIntervals.push({ start: startMin, end: startMin + duration });
            });
        }
    } catch (e) {
        console.error(e);
    }

    // Get blocked slots
    try {
        if (db) {
            const availDoc = await db.collection("availability").doc(dateStr).get();
            if (availDoc.exists) {
                const blocked = availDoc.data().blocked || [];
                blocked.forEach(t => {
                    const s = getMinutes(t);
                    occupiedIntervals.push({ start: s, end: s + 30 });
                });
            }
        }
    } catch (e) {
        console.error(e);
    }

    // MY service duration for conflict check
    const myDuration = bookingData.service ? parseInt(bookingData.service.duration) : 30;

    container.innerHTML = timeSlots.map(t => {
        const myStart = getMinutes(t);
        const myEnd = myStart + myDuration;

        // Check for overlap with any occupied interval
        let isBlocked = false;
        for (let interval of occupiedIntervals) {
            if (myStart < interval.end && myEnd > interval.start) {
                isBlocked = true;
                break;
            }
        }

        const isSelected = bookingData.time === t;

        return `
            <button class="time-slot ${isBlocked ? 'disabled' : ''} ${isSelected ? 'selected' : ''}" 
                    onclick="selectTime(this, '${t}')" 
                    ${isBlocked ? 'disabled' : ''}
                    style="${isBlocked ? 'opacity: 0.4; cursor: not-allowed;' : ''}">
                ${t}
            </button>
        `;
    }).join('');
}

function selectTime(el, time) {
    bookingData.time = time;
    sessionStorage.setItem('ha_booking_data', JSON.stringify(bookingData));

    document.querySelectorAll('.time-slot').forEach(t => t.classList.remove('selected'));
    el.classList.add('selected');
    checkStep2Validity();
}

function checkStep2Validity() {
    const btn = document.getElementById('step-2-next');
    if (!btn) return;
    btn.disabled = !(bookingData.date && bookingData.time);
    btn.style.opacity = btn.disabled ? '0.5' : '1';
}

function nextStep() {
    if (currentStep === 2 && (!bookingData.date || !bookingData.time)) {
        alert('Please select date and time');
        return;
    }
    if (currentStep < 3) {
        currentStep++;
        updateUI();
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateUI();
    }
}

function updateUI() {
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    const currentStepEl = document.getElementById(`step-${currentStep}`);
    if (currentStepEl) currentStepEl.classList.remove('hidden');

    const titles = { 1: 'Select Service', 2: 'Select Time', 3: 'Contact Info' };
    const titleEl = document.getElementById('step-title');
    if (titleEl) titleEl.innerText = titles[currentStep];

    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.classList.toggle('hidden', currentStep === 1);
    }

    if (currentStep === 2) {
        checkStep2Validity();
        if (bookingData.date) initTimes();
    }
    if (currentStep === 3) renderReview();

    document.querySelectorAll('.dot').forEach((d, i) => {
        d.classList.toggle('active', i < currentStep);
    });
}

function renderReview() {
    if (bookingData.service) {
        const sEl = document.getElementById('review-service');
        const pEl = document.getElementById('review-price');
        if (sEl) sEl.innerText = bookingData.service.name;
        if (pEl) pEl.innerText = '$' + bookingData.service.price;
    }
    if (bookingData.date && bookingData.time) {
        const dtEl = document.getElementById('review-datetime');
        if (dtEl) dtEl.innerText = bookingData.date.toLocaleDateString() + ' at ' + bookingData.time;
    }
}

async function confirmBooking() {
    const name = document.getElementById('customer-name').value;
    const phone = document.getElementById('customer-phone').value;
    const notes = document.getElementById('customer-notes')?.value || '';

    if (!name || !phone) {
        alert('Please enter name and phone');
        return;
    }

    const appointment = {
        service: bookingData.service,
        date: bookingData.date.toDateString(),
        time: bookingData.time,
        customerName: name,
        customerPhone: phone,
        notes: notes,
        status: 'confirmed',
        created_at: new Date().toISOString()
    };

    try {
        // Check if this is a reschedule
        const rescheduleId = sessionStorage.getItem('ha_reschedule_id');

        if (db) {
            if (rescheduleId) {
                // Update existing appointment
                await db.collection("appointments").doc(rescheduleId).update({
                    service: bookingData.service,
                    date: bookingData.date.toDateString(),
                    time: bookingData.time,
                    notes: notes
                });
                sessionStorage.removeItem('ha_reschedule_id');
                sessionStorage.removeItem('ha_reschedule_service');
            } else {
                // Create new appointment
                await db.collection("appointments").add(appointment);
            }
        }

        sessionStorage.removeItem('ha_booking_data');
        window.location.href = 'thankyou.html';
    } catch (e) {
        console.error(e);
        alert('Booking failed. Please try again.');
    }
}

// =========================================
// ADMIN LOGIN
// =========================================

function handleLogin() {
    const pin = document.getElementById('admin-pin').value;
    if (pin === '2453') {
        localStorage.setItem('ha_admin_auth', 'true');
        window.location.href = 'admin.html';
    } else {
        alert('Incorrect PIN');
    }
}

function logout() {
    localStorage.removeItem('ha_admin_auth');
    window.location.href = 'index.html';
}

function checkAuth() {
    if (!localStorage.getItem('ha_admin_auth')) {
        window.location.href = 'login.html';
    }
}

// =========================================
// ADMIN DASHBOARD
// =========================================

function initDashboard() {
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.innerText = new Date().toDateString();

    currentAdminDate = new Date();
    selectedAdminDateStr = currentAdminDate.toDateString();

    renderAdminCalendar();

    const dp = document.getElementById('avail-date-picker');
    if (dp) {
        dp.valueAsDate = new Date();
        loadAvailability();
    }
}

function switchTab(tab) {
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    const view = document.getElementById(`view-${tab}`);
    if (view) view.classList.remove('hidden');

    document.querySelectorAll('.dash-link').forEach(el => el.classList.remove('active'));
    const tabBtn = document.getElementById(`tab-btn-${tab}`);
    if (tabBtn) tabBtn.classList.add('active');

    if (tab === 'services') renderServicesList();
    if (tab === 'statistics') renderStatistics();
}

async function renderAdminCalendar() {
    const container = document.getElementById('admin-calendar-grid');
    if (!container) return;

    const year = currentAdminDate.getFullYear();
    const month = currentAdminDate.getMonth();

    const monthEl = document.getElementById('admin-cal-month');
    if (monthEl) {
        monthEl.innerText = currentAdminDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    // Fetch all appointments for dots
    let allApts = [];
    try {
        if (db) {
            const snapshot = await db.collection("appointments")
                .where("status", "==", "confirmed")
                .get();
            snapshot.forEach(doc => {
                allApts.push({ id: doc.id, ...doc.data() });
            });
        }
    } catch (e) {
        console.error(e);
    }

    let html = '';
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
        html += `<div style="font-weight:bold; font-size:0.7rem;">${d}</div>`;
    });

    for (let i = 0; i < startDayOfWeek; i++) html += '<div></div>';

    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        const dStr = dateObj.toDateString();
        const isSelected = selectedAdminDateStr === dStr;
        const count = allApts.filter(a => a.date === dStr).length;

        html += `
            <div onclick="selectAdminDate('${dStr}')"
                 style="cursor:pointer; padding:4px; border-radius:4px; 
                        background:${isSelected ? '#333' : 'white'}; 
                        color:${isSelected ? 'white' : '#333'}; 
                        border:1px solid #eee; position: relative;">
                ${d}
                ${count > 0 && !isSelected ? '<div style="width:4px;height:4px;background:#B76E79;border-radius:50%;margin:2px auto;"></div>' : ''}
            </div>
        `;
    }
    container.innerHTML = html;

    renderAppointmentsList(selectedAdminDateStr);
}

function changeAdminMonth(offset) {
    currentAdminDate.setMonth(currentAdminDate.getMonth() + offset);
    renderAdminCalendar();
}

function jumpToToday() {
    currentAdminDate = new Date();
    selectedAdminDateStr = currentAdminDate.toDateString();
    renderAdminCalendar();
}

function selectAdminDate(dStr) {
    selectedAdminDateStr = dStr;
    renderAdminCalendar();
}

async function renderAppointmentsList(dateStr) {
    const list = document.getElementById('appointments-list');
    const title = document.getElementById('list-title');
    if (!list) return;

    if (title) title.innerText = dateStr || 'Select a date';
    if (!dateStr) {
        list.innerHTML = '<p style="text-align:center; padding:2rem;">Select a date</p>';
        return;
    }

    list.innerHTML = 'Loading...';

    try {
        let apts = [];
        if (db) {
            const snapshot = await db.collection("appointments")
                .where("date", "==", dateStr)
                .get();

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.status !== 'cancelled') {
                    apts.push({ id: doc.id, ...data });
                }
            });
        }

        // Sort by time
        apts.sort((a, b) => getMinutes(a.time) - getMinutes(b.time));

        if (apts.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding:2rem; color:#999;">No appointments</p>';
            return;
        }

        list.innerHTML = `
            <table class="minimal-table">
                <thead><tr><th>Time</th><th>Service</th><th>Customer</th><th>Action</th></tr></thead>
                <tbody>
                    ${apts.map(a => `
                        <tr>
                            <td>${a.time}</td>
                            <td>${a.service?.name || 'N/A'}<br><small>${a.service?.duration || 30} min</small></td>
                            <td>
                                ${a.customerName}<br>
                                <small>${a.customerPhone}</small>
                                ${a.notes ? `<br><span class="action-link" onclick="viewNotes('${a.id}')">Notes</span>` : ''}
                            </td>
                            <td>
                                <span class="action-link" onclick="openEditModal('${a.id}')">Sửa</span>
                                <span class="action-link" style="color:#B76E79;" onclick="cancelAppointment('${a.id}')">Hủy</span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p style="color:red;">Error loading appointments</p>';
    }
}

async function cancelAppointment(id) {
    if (!confirm('Cancel this appointment?')) return;
    try {
        if (db) {
            await db.collection("appointments").doc(id).update({ status: 'cancelled' });
        }
        renderAdminCalendar();
    } catch (e) {
        console.error(e);
        alert('Error cancelling');
    }
}

// =========================================
// NOTES MODAL
// =========================================

async function viewNotes(appointmentId) {
    try {
        if (!db) return;
        const docSnap = await db.collection("appointments").doc(appointmentId).get();
        if (docSnap.exists && docSnap.data().notes) {
            document.getElementById('notes-content').innerText = docSnap.data().notes;
            document.getElementById('notes-modal').classList.remove('hidden');
        }
    } catch (e) {
        console.error(e);
    }
}

function closeNotesModal() {
    document.getElementById('notes-modal')?.classList.add('hidden');
}

// =========================================
// CREATE APPOINTMENT MODAL
// =========================================

function openCreateModal() {
    const sel = document.getElementById('create-service');
    if (sel) {
        sel.innerHTML = services.map(s => `<option value="${s.id}">${s.name} (${s.duration} min)</option>`).join('');
        sel.onchange = function () { updateCreateTimeOptions(); };
    }

    const dateInput = document.getElementById('create-date');
    if (dateInput) {
        const today = new Date();
        dateInput.value = today.toISOString().split('T')[0];
        dateInput.onchange = function () { updateCreateTimeOptions(); };
    }

    updateCreateTimeOptions();

    document.getElementById('create-name').value = '';
    document.getElementById('create-phone').value = '';
    document.getElementById('create-notes').value = '';

    document.getElementById('create-modal')?.classList.remove('hidden');
}

function closeCreateModal() {
    document.getElementById('create-modal')?.classList.add('hidden');
}

// DURATION-AWARE for create modal
async function updateCreateTimeOptions() {
    const sel = document.getElementById('create-time');
    const dateInput = document.getElementById('create-date');
    if (!sel || !dateInput || !dateInput.value) return;

    sel.innerHTML = '<option>Loading...</option>';

    const [y, m, d] = dateInput.value.split('-');
    const dateStr = new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toDateString();

    let occupiedIntervals = [];

    try {
        if (db) {
            const snapshot = await db.collection("appointments")
                .where("date", "==", dateStr)
                .get();

            snapshot.forEach(doc => {
                const apt = doc.data();
                if (apt.status !== 'cancelled') {
                    const start = getMinutes(apt.time);
                    const dur = apt.service?.duration || 30;
                    occupiedIntervals.push({ start, end: start + parseInt(dur) });
                }
            });

            // Blocked slots
            const availDoc = await db.collection("availability").doc(dateStr).get();
            if (availDoc.exists) {
                const blocked = availDoc.data().blocked || [];
                blocked.forEach(t => {
                    const s = getMinutes(t);
                    occupiedIntervals.push({ start: s, end: s + 30 });
                });
            }
        }
    } catch (e) {
        console.error(e);
    }

    const sId = document.getElementById('create-service')?.value;
    const serv = services.find(x => x.id == sId);
    const myDur = serv?.duration || 30;

    sel.innerHTML = timeSlots.map(t => {
        const start = getMinutes(t);
        const end = start + myDur;
        let blocked = false;
        for (let i = 0; i < occupiedIntervals.length; i++) {
            if (start < occupiedIntervals[i].end && end > occupiedIntervals[i].start) {
                blocked = true;
                break;
            }
        }
        return `<option value="${t}" ${blocked ? 'disabled style="color:#ccc;"' : ''}>${t}${blocked ? ' (Taken)' : ''}</option>`;
    }).join('');
}

async function saveNewAppointment() {
    const sId = document.getElementById('create-service')?.value;
    const dateVal = document.getElementById('create-date')?.value;
    const timeVal = document.getElementById('create-time')?.value;
    const name = document.getElementById('create-name')?.value;
    const phone = document.getElementById('create-phone')?.value;
    const notes = document.getElementById('create-notes')?.value || '';

    if (!name || !phone || !timeVal) {
        alert('Please fill required fields');
        return;
    }

    const [y, m, d] = dateVal.split('-');
    const dateStr = new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toDateString();
    const service = services.find(x => x.id == sId);

    try {
        if (db) {
            await db.collection("appointments").add({
                service,
                date: dateStr,
                time: timeVal,
                customerName: name,
                customerPhone: phone,
                notes,
                status: 'confirmed',
                created_at: new Date().toISOString()
            });
        }
        alert('Created!');
        closeCreateModal();
        renderAdminCalendar();
    } catch (e) {
        console.error(e);
        alert('Error creating appointment');
    }
}

// =========================================
// EDIT MODAL WITH SERVICE CHANGE
// =========================================

async function openEditModal(id) {
    try {
        if (!db) return;
        const docSnap = await db.collection("appointments").doc(id).get();
        if (!docSnap.exists) return;

        const apt = docSnap.data();

        document.getElementById('edit-id').value = id;

        // Populate service dropdown
        const sel = document.getElementById('edit-service');
        if (sel) {
            sel.innerHTML = services.map(s =>
                `<option value="${s.id}" ${s.id == apt.service?.id ? 'selected' : ''}>${s.name} (${s.duration} min)</option>`
            ).join('');
            sel.onchange = function () { updateEditTimeOptions(); };
        }

        // Set date
        const dateObj = new Date(apt.date);
        const dateInput = document.getElementById('edit-date');
        if (dateInput) {
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            dateInput.value = `${y}-${m}-${d}`;
            dateInput.onchange = function () { updateEditTimeOptions(); };
        }

        // Load time options then set current time
        await updateEditTimeOptions();
        document.getElementById('edit-time').value = apt.time;

        document.getElementById('edit-modal')?.classList.remove('hidden');
    } catch (e) {
        console.error(e);
    }
}

function closeEditModal() {
    document.getElementById('edit-modal')?.classList.add('hidden');
}

// DURATION-AWARE for edit modal
async function updateEditTimeOptions() {
    const sel = document.getElementById('edit-time');
    const dateInput = document.getElementById('edit-date');
    const editId = document.getElementById('edit-id')?.value;
    if (!sel || !dateInput || !dateInput.value) return;

    sel.innerHTML = '<option>Loading...</option>';

    const [y, m, d] = dateInput.value.split('-');
    const dateStr = new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toDateString();

    let occupiedIntervals = [];

    try {
        if (db) {
            const snapshot = await db.collection("appointments")
                .where("date", "==", dateStr)
                .get();

            snapshot.forEach(doc => {
                // Exclude SELF from conflict check
                if (doc.id === editId) return;

                const apt = doc.data();
                if (apt.status !== 'cancelled') {
                    const start = getMinutes(apt.time);
                    const dur = apt.service?.duration || 30;
                    occupiedIntervals.push({ start, end: start + parseInt(dur) });
                }
            });

            const availDoc = await db.collection("availability").doc(dateStr).get();
            if (availDoc.exists) {
                const blocked = availDoc.data().blocked || [];
                blocked.forEach(t => {
                    const s = getMinutes(t);
                    occupiedIntervals.push({ start: s, end: s + 30 });
                });
            }
        }
    } catch (e) {
        console.error(e);
    }

    const sId = document.getElementById('edit-service')?.value;
    const serv = services.find(x => x.id == sId);
    const myDur = serv?.duration || 30;

    sel.innerHTML = timeSlots.map(t => {
        const start = getMinutes(t);
        const end = start + myDur;
        let blocked = false;
        for (let i = 0; i < occupiedIntervals.length; i++) {
            if (start < occupiedIntervals[i].end && end > occupiedIntervals[i].start) {
                blocked = true;
                break;
            }
        }
        return `<option value="${t}" ${blocked ? 'disabled style="color:#ccc;"' : ''}>${t}${blocked ? ' (Taken)' : ''}</option>`;
    }).join('');
}

async function saveEdit() {
    const id = document.getElementById('edit-id')?.value;
    const sId = document.getElementById('edit-service')?.value;
    const dateVal = document.getElementById('edit-date')?.value;
    const timeVal = document.getElementById('edit-time')?.value;

    if (!id || !dateVal || !timeVal || !sId) {
        alert('Please fill all fields');
        return;
    }

    const [y, m, d] = dateVal.split('-');
    const dateStr = new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toDateString();
    const service = services.find(x => x.id == sId);

    try {
        if (db) {
            await db.collection("appointments").doc(id).update({
                service,
                date: dateStr,
                time: timeVal
            });
        }
        alert('Updated!');
        closeEditModal();
        renderAdminCalendar();
    } catch (e) {
        console.error(e);
        alert('Error updating');
    }
}

// =========================================
// AVAILABILITY MANAGEMENT
// =========================================

async function loadAvailability() {
    const dp = document.getElementById('avail-date-picker');
    const container = document.getElementById('avail-slots-container');
    if (!dp || !container || !dp.value) return;

    const [y, m, d] = dp.value.split('-');
    const dateStr = new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toDateString();

    let blocked = [];
    try {
        if (db) {
            const docSnap = await db.collection("availability").doc(dateStr).get();
            if (docSnap.exists) {
                blocked = docSnap.data().blocked || [];
            }
        }
    } catch (e) {
        console.error(e);
    }

    container.innerHTML = timeSlots.map(t => {
        const isOff = blocked.includes(t);
        return `
            <label style="display:inline-block; border:1px solid #ddd; padding:0.5rem 1rem; margin:0.25rem; cursor:pointer; background:${isOff ? '#f5f5f5' : 'white'}; ${isOff ? 'text-decoration: line-through; color: #999;' : ''}">
                <input type="checkbox" value="${t}" ${!isOff ? 'checked' : ''} style="margin-right: 0.5rem;"> ${t}
            </label>
        `;
    }).join('');
}

async function saveAvailability() {
    const dp = document.getElementById('avail-date-picker');
    if (!dp || !dp.value) return;

    const [y, m, d] = dp.value.split('-');
    const dateStr = new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toDateString();

    const all = document.querySelectorAll('#avail-slots-container input');
    const blocked = [];
    all.forEach(cb => {
        if (!cb.checked) blocked.push(cb.value);
    });

    try {
        if (db) {
            await db.collection("availability").doc(dateStr).set({ blocked });
        }
        alert('Saved!');
        loadAvailability();
    } catch (e) {
        console.error(e);
        alert('Error saving');
    }
}

function blockEntireDay() {
    document.querySelectorAll('#avail-slots-container input').forEach(cb => cb.checked = false);
}

function clearAllSlots() {
    document.querySelectorAll('#avail-slots-container input').forEach(cb => cb.checked = true);
}

// =========================================
// SERVICE MANAGEMENT
// =========================================

function renderServicesList() {
    const container = document.getElementById('services-list-container');
    if (!container) return;

    container.innerHTML = `
        <table class="minimal-table">
            <thead>
                <tr><th>Service</th><th>Price</th><th>Duration</th><th>Action</th></tr>
            </thead>
            <tbody>
                ${services.map(s => `
                    <tr>
                        <td>${s.name}</td>
                        <td>$${s.price}</td>
                        <td>${s.duration} min</td>
                        <td>
                            <span class="action-link" onclick="openServiceModal('${s.id}')">Edit</span>
                            <span class="action-link" style="color:#B76E79;" onclick="deleteService('${s.id}')">Delete</span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function openServiceModal(id) {
    const modal = document.getElementById('service-modal');
    const title = document.getElementById('service-modal-title');
    if (!modal) return;

    document.getElementById('service-id').value = id || '';

    if (id) {
        if (title) title.innerText = 'Edit Service';
        const s = services.find(x => x.id == id);
        if (s) {
            document.getElementById('service-name').value = s.name;
            document.getElementById('service-price').value = s.price;
            document.getElementById('service-duration').value = s.duration;
        }
    } else {
        if (title) title.innerText = 'Add Service';
        document.getElementById('service-name').value = '';
        document.getElementById('service-price').value = '';
        document.getElementById('service-duration').value = '';
    }

    modal.classList.remove('hidden');
}

function closeServiceModal() {
    document.getElementById('service-modal')?.classList.add('hidden');
}

async function saveService() {
    const id = document.getElementById('service-id')?.value;
    const name = document.getElementById('service-name')?.value;
    const price = document.getElementById('service-price')?.value;
    const duration = document.getElementById('service-duration')?.value;

    if (!name || !price || !duration) {
        alert('Please fill all fields');
        return;
    }

    const data = {
        name,
        price: parseInt(price),
        duration: parseInt(duration)
    };

    try {
        if (db) {
            if (id) {
                await db.collection("services").doc(id).update(data);
            } else {
                await db.collection("services").add(data);
            }
        }
        alert('Saved!');
        closeServiceModal();
        await loadServices();
        renderServicesList();
    } catch (e) {
        console.error(e);
        alert('Error saving');
    }
}

async function deleteService(id) {
    if (!confirm('Delete this service?')) return;
    try {
        if (db) {
            await db.collection("services").doc(id).delete();
        }
        await loadServices();
        renderServicesList();
    } catch (e) {
        console.error(e);
        alert('Error deleting');
    }
}

// =========================================
// STATISTICS
// =========================================

async function renderStatistics() {
    const totalEl = document.getElementById('stat-total');
    const revenueEl = document.getElementById('stat-revenue');
    const upcomingEl = document.getElementById('stat-upcoming');
    const popularList = document.getElementById('popular-services-list');

    if (!db) return;

    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toDateString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toDateString();

        const snapshot = await db.collection("appointments")
            .where("status", "==", "confirmed")
            .get();

        let monthlyApts = [];
        let upcomingCount = 0;
        let serviceCounts = {};

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        snapshot.forEach(doc => {
            const apt = doc.data();
            const aptDate = new Date(apt.date);

            // Monthly
            if (aptDate.getMonth() === now.getMonth() && aptDate.getFullYear() === now.getFullYear()) {
                monthlyApts.push(apt);
            }

            // Upcoming (next 7 days)
            if (aptDate >= today && aptDate <= nextWeek) {
                upcomingCount++;
            }

            // Service counts
            const sName = apt.service?.name || 'Unknown';
            serviceCounts[sName] = (serviceCounts[sName] || 0) + 1;
        });

        // Calculate revenue
        let revenue = 0;
        monthlyApts.forEach(apt => {
            revenue += apt.service?.price || 0;
        });

        if (totalEl) totalEl.innerText = monthlyApts.length;
        if (revenueEl) revenueEl.innerText = '$' + revenue;
        if (upcomingEl) upcomingEl.innerText = upcomingCount;

        // Popular services
        if (popularList) {
            const sorted = Object.entries(serviceCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            popularList.innerHTML = sorted.map(([name, count]) => `
                <div style="display:flex; justify-content:space-between; padding:0.75rem 0; border-bottom:1px solid #eee;">
                    <span>${name}</span>
                    <span style="color:#B76E79; font-weight:bold;">${count} bookings</span>
                </div>
            `).join('') || '<p style="color:#999;">No data yet</p>';
        }
    } catch (e) {
        console.error(e);
    }
}

// =========================================
// TIME SLOT CONFIGURATION
// =========================================

async function generateTimeSlots() {
    const startStr = document.getElementById('config-start-time')?.value;
    const endStr = document.getElementById('config-end-time')?.value;
    const interval = parseInt(document.getElementById('config-interval')?.value || '30');

    if (!startStr || !endStr) {
        alert('Please set start and end times');
        return;
    }

    const slots = [];
    let current = new Date(`2000-01-01T${startStr}:00`);
    const end = new Date(`2000-01-01T${endStr}:00`);

    while (current <= end) {
        let hours = current.getHours();
        const minutes = current.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;

        slots.push(timeString);
        current.setMinutes(current.getMinutes() + interval);
    }

    try {
        if (db) {
            await db.collection("settings").doc("timeslots").set({ slots });
        }
        timeSlots = slots;
        alert('Time slots updated! New slots: ' + slots.length);
    } catch (e) {
        console.error(e);
        alert('Error saving time slots');
    }
}

// =========================================
// CHECK APPOINTMENT (Customer)
// =========================================

async function findAppointment() {
    const nameInput = document.getElementById('check-name')?.value.trim();
    const resultDiv = document.getElementById('check-result');
    if (!nameInput || !resultDiv) return;

    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = 'Searching...';

    try {
        let matches = [];
        if (db) {
            const snapshot = await db.collection("appointments")
                .where("status", "==", "confirmed")
                .get();

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.customerName?.toLowerCase().includes(nameInput.toLowerCase())) {
                    const d = new Date(data.date);
                    if (d >= today) {
                        matches.push({ id: doc.id, ...data });
                    }
                }
            });
        }

        if (matches.length === 0) {
            resultDiv.innerHTML = `
                <div style="padding:1rem; background:#FFF5F5; color:#C53030; border-radius:4px;">
                    No upcoming appointments found for "<strong>${nameInput}</strong>".
                </div>
            `;
        } else {
            resultDiv.innerHTML = matches.map(apt => `
                <div style="padding:1.5rem; background:#F0FFF4; border:1px solid #C6F6D5; border-radius:8px; margin-bottom:1rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                        <h3 style="font-size:1.25rem; font-weight:bold; color:#2F855A;">Appointment Found!</h3>
                        <span style="background:white; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem; border:1px solid #C6F6D5;">CONFIRMED</span>
                    </div>
                    <p style="margin-bottom:0.25rem;"><strong>Guest:</strong> ${apt.customerName}</p>
                    <p style="margin-bottom:0.25rem;"><strong>Service:</strong> ${apt.service?.name || 'N/A'}</p>
                    <p style="margin-bottom:0.25rem;"><strong>Date:</strong> ${new Date(apt.date).toLocaleDateString()}</p>
                    <p style="margin-bottom:1rem;"><strong>Time:</strong> ${apt.time}</p>
                    
                    <div style="display:flex; gap:1rem; margin-top:1.5rem;">
                        <button onclick="rescheduleAppointment('${apt.id}')" 
                            style="flex:1; padding:0.75rem; background:#333; color:white; border:none; cursor:pointer; text-transform:uppercase; font-size:0.75rem; letter-spacing:1px;">
                            Reschedule
                        </button>
                        <button onclick="customerCancelAppointment('${apt.id}')" 
                            style="flex:1; padding:0.75rem; background:white; color:#C53030; border:1px solid #C53030; cursor:pointer; text-transform:uppercase; font-size:0.75rem; letter-spacing:1px;">
                            Cancel
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error(e);
        resultDiv.innerHTML = '<div style="color:red;">Error searching</div>';
    }
}

async function customerCancelAppointment(id) {
    if (!confirm('Cancel this appointment?')) return;
    try {
        if (db) {
            await db.collection("appointments").doc(id).update({ status: 'cancelled' });
        }
        alert('Appointment cancelled successfully.');
        findAppointment();
    } catch (e) {
        console.error(e);
        alert('Error cancelling');
    }
}

function rescheduleAppointment(id) {
    // Store ID and redirect to booking
    sessionStorage.setItem('ha_reschedule_id', id);

    // Get appointment service to pre-select
    if (db) {
        db.collection("appointments").doc(id).get().then(docSnap => {
            if (docSnap.exists) {
                sessionStorage.setItem('ha_reschedule_service', JSON.stringify(docSnap.data().service));
            }
            window.location.href = 'booking.html?reschedule=true';
        });
    } else {
        window.location.href = 'booking.html?reschedule=true';
    }
}
