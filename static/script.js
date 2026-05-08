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
// Gunakan domain aplikasi Railway Anda, BUKAN HiveMQ
const broker = "easweb.up.railway.app"; 
// Gunakan port 443 karena Railway menggunakan HTTPS (SSL)
const port = 443; 
const clientID = "client_" + Math.random().toString(16).substr(2, 8);

// Tambahkan "/" sebagai path standar Mosquitto
const client = new Paho.MQTT.Client(broker, port, "/", clientID);

client.onConnectionLost = (onLost) => {
    document.getElementById('conn-status').innerText = "Disconnected";
    document.getElementById('conn-status').style.background = "#ffcccc";
    console.log("Koneksi terputus: ", onLost.errorMessage);
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
    ecgChart.update('none'); 
}

// Lakukan koneksi dengan mengaktifkan SSL
client.connect({ 
    onSuccess: () => {
        document.getElementById('conn-status').innerText = "Connected";
        document.getElementById('conn-status').style.background = "#d1f2eb";
        // Subscribe ke topik yang sama dengan yang dikirim ESP32
        client.subscribe("esp32/lead1");
        client.subscribe("esp32/lead2");
        client.subscribe("esp32/lead3");
        console.log("Berhasil terhubung ke Broker Railway!");
    },
    useSSL: true // WAJIB TRUE karena memakai domain HTTPS Railway
});