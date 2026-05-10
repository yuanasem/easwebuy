// --- 1. INISIALISASI VARIABEL & CHART ---
const ctxMain = document.getElementById('ecgChartMain').getContext('2d');
const ctxAug = document.getElementById('ecgChartAug').getContext('2d');
const statusBadge = document.getElementById('conn-status');
const recordLog = document.getElementById('recordLog');

let isRecording = false;
let recordedData = [];
const MAX_DATA_POINTS = 100; // Jumlah titik pada layar

// Inisialisasi Chart Live Leads (I, II, III)
const ecgChart = new Chart(ctxMain, {
    type: 'line',
    data: {
        labels: Array(MAX_DATA_POINTS).fill(''), 
        datasets: [
            { label: 'Lead I', data: [], borderColor: '#3498db', borderWidth: 2, pointRadius: 0, tension: 0.2 },
            { label: 'Lead II', data: [], borderColor: '#2ecc71', borderWidth: 2, pointRadius: 0, tension: 0.2 },
            { label: 'Lead III', data: [], borderColor: '#f1c40f', borderWidth: 2, pointRadius: 0, tension: 0.2 }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { suggestedMin: -1000, suggestedMax: 3000 } }, // Sesuai range dummy data ESP32
        animation: false
    }
});

// Inisialisasi Chart Augmented Leads
const augChart = new Chart(ctxAug, {
    type: 'line',
    data: {
        labels: Array(MAX_DATA_POINTS).fill(''), 
        datasets: [
            { label: 'aVR', data: [], borderColor: '#e74c3c', borderWidth: 1.5, pointRadius: 0 },
            { label: 'aVL', data: [], borderColor: '#9b59b6', borderWidth: 1.5, pointRadius: 0 },
            { label: 'aVF', data: [], borderColor: '#1abc9c', borderWidth: 1.5, pointRadius: 0 }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { suggestedMin: -1000, suggestedMax: 3000 } },
        animation: false
    }
});

// --- 2. KONFIGURASI MQTT OVER WEBSOCKETS ---
// Gunakan domain utama Railway (HTTPS otomatis di-proxy ke 8080 oleh Railway)
const broker = "easweb.up.railway.app"; 
const port = 443; 
const clientID = "web_monitor_" + Math.random().toString(16).substr(2, 5);

const client = new Paho.MQTT.Client(broker, Number(port), "/mqtt", clientID);

// Variabel penampung nilai terakhir untuk kalkulasi augmented leads
let lastLeads = { L1: 0, L2: 0, L3: 0 };

client.onConnectionLost = (onLost) => {
    statusBadge.innerText = "Disconnected - Retrying...";
    statusBadge.style.background = "#e74c3c";
    console.log("Koneksi MQTT Terputus: ", onLost.errorMessage);
    setTimeout(connectMQTT, 5000); // Auto reconnect
};

client.onMessageArrived = (msg) => {
    const val = parseFloat(msg.payloadString);
    const topic = msg.destinationName;

    if (topic === "esp32/lead1") {
        lastLeads.L1 = val;
        updateLiveChart(0, val);
    } else if (topic === "esp32/lead2") {
        lastLeads.L2 = val;
        updateLiveChart(1, val);
    } else if (topic === "esp32/lead3") {
        lastLeads.L3 = val;
        updateLiveChart(2, val);
    }

    // Kalkulasi Augmented Leads berdasarkan Hukum Einthoven & Goldberger
    // aVR = -0.5 * (I + II)
    // aVL = I - 0.5 * II
    // aVF = II - 0.5 * I
    const avr = -0.5 * (lastLeads.L1 + lastLeads.L2);
    const avl = lastLeads.L1 - (0.5 * lastLeads.L2);
    const avf = lastLeads.L2 - (0.5 * lastLeads.L1);

    updateAugChart(avr, avl, avf);

    if (isRecording) {
        recordedData.push([new Date().toLocaleTimeString(), val, topic]);
    }
};

function updateLiveChart(index, value) {
    ecgChart.data.datasets[index].data.push(value);
    if (ecgChart.data.datasets[index].data.length > MAX_DATA_POINTS) {
        ecgChart.data.datasets[index].data.shift();
    }
    ecgChart.update('none'); 
}

function updateAugChart(avr, avl, avf) {
    const vals = [avr, avl, avf];
    vals.forEach((v, i) => {
        augChart.data.datasets[i].data.push(v);
        if (augChart.data.datasets[i].data.length > MAX_DATA_POINTS) {
            augChart.data.datasets[i].data.shift();
        }
    });
    augChart.update('none');
}

// --- 3. FUNGSI KONEKSI ---
function connectMQTT() {
    console.log("Menghubungkan ke Railway MQTT Broker...");
    client.connect({ 
        onSuccess: () => {
            statusBadge.innerText = "Connected";
            statusBadge.style.background = "#2ecc71";
            statusBadge.style.color = "white";
            client.subscribe("esp32/lead1");
            client.subscribe("esp32/lead2");
            client.subscribe("esp32/lead3");
            addLog("Koneksi Berhasil.");
        },
        onFailure: (err) => {
            console.log("Gagal Terhubung: ", err.errorMessage);
            addLog("Koneksi Gagal: " + err.errorMessage);
            setTimeout(connectMQTT, 5000);
        },
        useSSL: true, // WAJIB TRUE karena Railway menggunakan HTTPS/SSL
        timeout: 10,
        keepAliveInterval: 30
    });
}

// --- 4. KONTROL LOG & REKAMAN ---
function addLog(msg) {
    const p = document.createElement('p');
    p.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    recordLog.prepend(p);
}

document.getElementById('recordBtn').addEventListener('click', function() {
    isRecording = !isRecording;
    if (isRecording) {
        this.innerText = "Berhenti & Simpan";
        this.style.background = "#c0392b";
        recordedData = [["Timestamp", "Value", "Lead"]]; // Reset data & Header
        addLog("Mulai merekam data...");
    } else {
        this.innerText = "Mulai Rekam";
        this.style.background = "#e74c3c";
        addLog("Rekaman selesai. Total data: " + (recordedData.length - 1));
    }
});

document.getElementById('exportBtn').addEventListener('click', function() {
    if (recordedData.length <= 1) {
        alert("Belum ada data yang direkam!");
        return;
    }
    let csvContent = "data:text/csv;charset=utf-8," + recordedData.map(e => e.join(",")).join("\n");
    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ECG_Data_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
});

// Jalankan Koneksi
connectMQTT();