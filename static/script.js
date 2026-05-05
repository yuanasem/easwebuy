// --- 1. INISIALISASI VARIABEL & CHART ---
const ctxMain = document.getElementById('ecgChartMain').getContext('2d');
let isRecording = false;
let recordedData = [];

const ecgChart = new Chart(ctxMain, {
    type: 'line',
    data: {
        labels: Array(100).fill(''), 
        datasets: [
            { label: 'Lead I', data: [], borderColor: '#3498db', borderWidth: 2, tension: 0.3, pointRadius: 0 },
            { label: 'Lead II', data: [], borderColor: '#2ecc71', borderWidth: 2, tension: 0.3, pointRadius: 0 },
            { label: 'Lead III', data: [], borderColor: '#f1c40f', borderWidth: 2, tension: 0.3, pointRadius: 0 }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { min: 0, max: 4095 } },
        animation: false
    }
});

// --- 2. LOGIKA MQTT ---
const broker = "broker.hivemq.com"; 
const port = 8000; 
const clientID = "client_" + Math.random().toString(16).substr(2, 8);
const client = new Paho.MQTT.Client(broker, port, clientID);

client.onConnectionLost = (onLost) => {
    document.getElementById('conn-status').innerText = "Disconnected";
    document.getElementById('conn-status').style.background = "#ffcccc";
};

client.onMessageArrived = (msg) => {
    const val = parseFloat(msg.payloadString);
    const topic = msg.destinationName;

    if(topic === "esp32/lead1") updateData(0, val);
    if(topic === "esp32/lead2") updateData(1, val);
    if(topic === "esp32/lead3") updateData(2, val);

    if(isRecording) {
        recordedData.push({ t: new Date().toISOString(), tp: topic, v: val });
    }
};

function updateData(index, value) {
    ecgChart.data.datasets[index].data.push(value);
    if(ecgChart.data.datasets[index].data.length > 100) {
        ecgChart.data.datasets[index].data.shift();
    }
    ecgChart.update('none'); // Update tanpa animasi agar ringan
}

client.connect({ 
    onSuccess: () => {
        document.getElementById('conn-status').innerText = "Connected";
        document.getElementById('conn-status').style.background = "#d1f2eb";
        client.subscribe("esp32/lead1");
        client.subscribe("esp32/lead2");
        client.subscribe("esp32/lead3");
    },
    useSSL: false
});

// --- 3. FUNGSI TOMBOL ---
document.getElementById('recordBtn').onclick = function() {
    isRecording = !isRecording;
    this.innerText = isRecording ? "⏹ Stop & Simpan" : "🔴 Mulai Rekam";
    this.style.background = isRecording ? "#2c3e50" : "#e74c3c";
    
    const log = document.getElementById('recordLog');
    if(isRecording) {
        recordedData = [];
        log.innerHTML += `<p>> Perekaman dimulai pada ${new Date().toLocaleTimeString()}</p>`;
    } else {
        log.innerHTML += `<p>> Perekaman selesai. Total data: ${recordedData.length}</p>`;
    }
};

document.getElementById('exportBtn').onclick = function() {
    if(recordedData.length === 0) return alert("Belum ada data terekam!");
    
    let csv = "Timestamp,Lead,Value\n";
    recordedData.forEach(row => {
        csv += `${row.t},${row.tp},${row.v}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `ECG_Data_${Date.now()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};