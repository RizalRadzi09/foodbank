// URL Pangkalan Data Google Sheets
const logCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQPWO1WcTeYxX7QQMmZjugETaEmGJOSG_TMWCrJohiG91PfrWJSpY5JKro59-USxq-StUOQw5EgyopO/pub?gid=1495634022&single=true&output=csv';
const stockCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQPWO1WcTeYxX7QQMmZjugETaEmGJOSG_TMWCrJohiG91PfrWJSpY5JKro59-USxq-StUOQw5EgyopO/pub?gid=397122984&single=true&output=csv';

const itemList = ["Air Kotak", "Biskut Lexus", "Biskut Oat Krunch", "Kismis", "Kurma", "Makanan Infaq", "Roti"];

// Pembolehubah Global
window.rawLogRows = [];
window.rawStockRows = [];
let autoCloseTimerId = null;

// Tarikh Tempatan
const nowLocal = new Date();
const currentYear = nowLocal.getFullYear();
const currentMonth = String(nowLocal.getMonth() + 1).padStart(2, '0');
const currentDay = String(nowLocal.getDate()).padStart(2, '0');

document.getElementById('target-date').value = `${currentYear}-${currentMonth}-${currentDay}`;

function openModalAuto() {
    document.getElementById('posterModal').style.display = 'flex';
    document.getElementById('auto-close-timer').style.display = 'block'; 
    autoCloseTimerId = setTimeout(() => { closeModal(); }, 15000);
}

function openModalManual() {
    document.getElementById('posterModal').style.display = 'flex';
    document.getElementById('auto-close-timer').style.display = 'none'; 
    if(autoCloseTimerId) clearTimeout(autoCloseTimerId);
}

function closeModal() {
    document.getElementById('posterModal').style.display = 'none';
    if(autoCloseTimerId) clearTimeout(autoCloseTimerId);
}

window.onclick = function(event) {
    const modal = document.getElementById('posterModal');
    if (event.target === modal) closeModal();
}

window.addEventListener('DOMContentLoaded', () => { openModalAuto(); });

function parseCSVRow(text) {
    let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
    for (l of text) {
        if ('"' === l) {
            if (s && l === p) row[i] += l;
            s = !s;
        } else if (',' === l && s) l = row[++i] = '';
        else if ('\n' === l && s) {
            if ('\r' === p) row[i] = row[i].slice(0, -1);
            row = ret[++r] = [l = '']; i = 0;
        } else row[i] += l;
        p = l;
    }
    return ret;
}

function matchDate(csvDateStr, targetYYYYMMDD) {
    if (!csvDateStr) return false;
    let parts = targetYYYYMMDD.split('-');
    let y = parts[0], m = parseInt(parts[1]), d = parseInt(parts[2]);
    let padM = String(m).padStart(2, '0'), padD = String(d).padStart(2, '0');
    let csvDatePart = csvDateStr.split(' ')[0].trim(); 

    let f1 = `${d}/${m}/${y}`, f2 = `${padD}/${padM}/${y}`, f3 = `${y}-${padM}-${padD}`, f4 = `${m}/${d}/${y}`, f5 = `${parseInt(d)}/${parseInt(m)}/${y}`;
    return csvDatePart === f1 || csvDatePart === f2 || csvDatePart === f3 || csvDatePart === f4 || csvDatePart === f5 || csvDateStr.includes(f2) || csvDateStr.includes(f3);
}

async function fetchDatabase() {
    const btn = document.getElementById('refreshBtn');
    const icon = document.getElementById('sync-icon');
    
    btn.disabled = true;
    icon.classList.add('fa-spin');

    try {
        const cacheBust = '&cachebust=' + new Date().getTime();
        const [resLog, resStock] = await Promise.all([
            fetch(logCsvUrl + cacheBust),
            fetch(stockCsvUrl + cacheBust)
        ]);

        const textLog = await resLog.text();
        const textStock = await resStock.text();

        window.rawLogRows = parseCSVRow(textLog).slice(1).filter(r => r.length > 1 && r[1]); 
        window.rawStockRows = parseCSVRow(textStock).slice(1).filter(r => r.length > 1 && r[0]); 

        processCurrentData();
        
        const now = new Date();
        document.getElementById('last-updated').innerText = now.toLocaleTimeString() + ' (' + now.toLocaleDateString('ms-MY') + ')';
    } catch (err) {
        alert("Gagal memuatkan data. Sila semak sambungan internet anda.");
        console.error(err);
    } finally {
        btn.disabled = false;
        icon.classList.remove('fa-spin');
    }
}

function processCurrentData() {
    calculateAndRenderDashboard(window.rawLogRows, window.rawStockRows);
}

function calculateAndRenderDashboard(logRows, stockRows) {
    let targetDate = document.getElementById('target-date').value;
    let overrides = JSON.parse(localStorage.getItem('fb_date_overrides')) || {};
    let dateOverrides = overrides[targetDate] || {};

    let initialStocks = {};
    let distributedCounts = {};
    itemList.forEach(item => {
        initialStocks[item] = 0;
        distributedCounts[item] = 0;
    });
    
    stockRows.forEach(row => {
        if (matchDate(row[0], targetDate)) { 
            initialStocks["Air Kotak"] += parseInt(row[1]) || 0;
            initialStocks["Biskut Lexus"] += parseInt(row[2]) || 0;
            initialStocks["Biskut Oat Krunch"] += parseInt(row[3]) || 0;
            initialStocks["Kismis"] += parseInt(row[4]) || 0;
            initialStocks["Kurma"] += parseInt(row[5]) || 0;
            initialStocks["Makanan Infaq"] += parseInt(row[6]) || 0;
            initialStocks["Roti"] += parseInt(row[7]) || 0;
        }
    });

    itemList.forEach(item => {
        if (dateOverrides[item] !== undefined) {
            initialStocks[item] = dateOverrides[item];
        }
    });

    let totalItemsDistributedToday = 0;
    let totalLogsToday = 0;
    let totalLogsAllTime = 0;
    let totalItemsAllTime = 0;

    logRows.forEach(row => {
        totalLogsAllTime++;
        let isToday = matchDate(row[0], targetDate);

        if (isToday) totalLogsToday++;

        // 1. Semak Kolum G (Index 6) untuk item makanan biasa
        let itemText = row[6]; 
        if (itemText) {
            itemList.forEach(item => {
                let regex = new RegExp(item + '\\s*\\((\\d+)\\)');
                let match = itemText.match(regex);
                if (match) {
                    let qty = parseInt(match[1]) || 0;
                    totalItemsAllTime += qty;

                    if (isToday) {
                        distributedCounts[item] += qty;
                        totalItemsDistributedToday += qty;
                    }
                }
            });
        }
        
        // 2. Semak Kolum H (Index 7) untuk "Makanan Infaq"
        let infaqText = row[7];
        if (infaqText && infaqText.toLowerCase().includes("ambil makanan infaq")) {
            let qty = 1; 
            totalItemsAllTime += qty;
            
            if (isToday) {
                distributedCounts["Makanan Infaq"] += qty;
                totalItemsDistributedToday += qty;
            }
        }
    });

    document.getElementById('total-logs').innerText = totalLogsToday;
    document.getElementById('total-items-distributed').innerText = totalItemsDistributedToday;
    document.getElementById('total-logs-alltime').innerText = totalLogsAllTime;
    document.getElementById('total-items-alltime').innerText = totalItemsAllTime;

    const cardsContainer = document.getElementById('stock-cards-container');
    cardsContainer.innerHTML = ''; 

    itemList.forEach(item => {
        let stokAwal = initialStocks[item] || 0;
        let diagih = distributedCounts[item] || 0;
        let baki = stokAwal - diagih;
        
        // Jika tiada stok harian dimasukkan, baki ditetapkan sebagai 'N/A' (Tidak Berkenaan) 
        // atau jika baki kurang dari 0 disebabkan tiada rekod stok harian awal.
        let paparanBaki = baki;
        if (stokAwal === 0 && diagih > 0) {
            paparanBaki = "-"; // Menunjukkan agihan dibuat tanpa pengurusan jumlah baki harian tetap
        } else if (baki < 0) {
            paparanBaki = 0;
        }

        // PENAMBAHBAIKAN LOGIK: Kad akan dipaparkan jika stok awal > 0 ATAU jika jumlah diagih > 0
        if (stokAwal > 0 || diagih > 0) {
            const card = document.createElement('div');
            card.className = 'stock-card';
            card.innerHTML = `
                <div class="card-header">
                    <h3 class="item-name">${item}</h3>
                </div>
                <div class="stock-details">
                    <div class="stat-box">
                        <span class="stat-label">Stok Harian</span>
                        <span class="stat-val" style="color: var(--primary-color);">${stokAwal}</span>
                    </div>
                    <div class="stat-box" style="border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                        <span class="stat-label">Diagih</span>
                        <span class="stat-val" style="color: var(--warning-color);">${diagih}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Baki Semasa</span>
                        <span class="stat-val" style="color: ${paparanBaki === 0 || paparanBaki === '-' ? 'var(--danger-color)' : 'var(--primary-color)'}; font-size: 22px;">${paparanBaki}</span>
                    </div>
                </div>
            `;
            cardsContainer.appendChild(card);
        }
    });
    
    if(cardsContainer.innerHTML === '') {
         cardsContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #7f8c8d; font-style: italic;">Tiada rekod stok untuk tarikh ini.</p>';
    }
}

// Mulakan sistem
fetchDatabase();
