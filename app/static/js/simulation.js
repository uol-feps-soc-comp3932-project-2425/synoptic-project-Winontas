let simulatedUsers = [];
let currentSimulatedDate = new Date("2025-03-24T00:00:00");
let simulationInterval = null;
let analyticsChart;

function initAnalyticsChart() {
    const ctx = document.getElementById('analyticsChart').getContext('2d');
    analyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Time/Day' } },
                y: { title: { display: true, text: 'Triggers' }, beginAtZero: true }
            }
        }
    });
}

async function initializeSimulatedUsers(dataset = 'patterns') {
    try {
        const response = await fetch(`/api/simulated_users?dataset=${dataset}`);
        if (!response.ok) throw new Error(`Failed to fetch users: ${response.status}`);
        const data = await response.json();
        
        simulatedUsers = data.users.map(user => ({
            id: user.id,
            name: user.name,
            lat: user.start_lat,
            lng: user.start_lng,
            marker: new google.maps.Marker({
                position: { lat: user.start_lat, lng: user.start_lng },
                map: map,
                title: user.name,
                icon: {
                    url: 'https://maps.google.com/mapfiles/kml/shapes/man.png',
                    scaledSize: new google.maps.Size(32, 32)
                }
            }),
            lastUpdate: null,
            insideGeofences: {},
            schedule: user.schedule || []
        }));
        console.log(`Loaded ${simulatedUsers.length} users from ${data.description}`);
    } catch (error) {
        console.error("Error initializing simulated users:", error);
        simulatedUsers = [];
    }
}

function simulateUserMovement() {
    const dayOfWeek = currentSimulatedDate.toLocaleString('en-US', { weekday: 'long' });
    const currentHour = currentSimulatedDate.getHours() + currentSimulatedDate.getMinutes() / 60;

    simulatedUsers.forEach(user => {
        let targetLat, targetLng;

        const scheduledVisit = user.schedule.find(s => 
            s.day === dayOfWeek && 
            currentHour >= s.start_hour && 
            currentHour < s.start_hour + s.duration
        );

        if (scheduledVisit) {
            if (scheduledVisit.coords) {
                targetLat = scheduledVisit.coords.lat;
                targetLng = scheduledVisit.coords.lng;
            } else {
                const targetGeofence = geofences.find(g => g.business_type === scheduledVisit.location && g.active);
                if (targetGeofence) {
                    const centroid = calculateCentroid(targetGeofence.coordinates);
                    targetLat = centroid.lat;
                    targetLng = centroid.lng;
                } else {
                    targetLat = randomInRange(53.75, 53.85);
                    targetLng = randomInRange(-1.65, -1.45);
                }
            }
        } else {
            targetLat = user.lat + (Math.random() - 0.5) * 0.005;
            targetLng = user.lng + (Math.random() - 0.5) * 0.005;
        }

        user.lat += (targetLat - user.lat) * 0.1;
        user.lng += (targetLng - user.lng) * 0.1;
        user.marker.setPosition({ lat: user.lat, lng: user.lng });
        user.lastUpdate = new Date(currentSimulatedDate);

        geofences.forEach(geofence => {
            if (!geofence.active) return;

            const isInside = google.maps.geometry.poly.containsLocation(
                new google.maps.LatLng(user.lat, user.lng),
                geofence.polygon
            );

            const geofenceKey = geofence.id;
            if (isInside && !user.insideGeofences[geofenceKey]) {
                user.insideGeofences[geofenceKey] = { entryTime: new Date(currentSimulatedDate) };
                console.log(`${user.name} entered ${geofence.name}`);
                saveTrackingData(user, geofence, "entry");
            } else if (!isInside && user.insideGeofences[geofenceKey]) {
                const entryTime = user.insideGeofences[geofenceKey].entryTime;
                const duration = (currentSimulatedDate - entryTime) / 1000 / 60;
                delete user.insideGeofences[geofenceKey];
                console.log(`${user.name} exited ${geofence.name}, Duration: ${duration.toFixed(1)} min`);
                saveTrackingData(user, geofence, "exit", duration);
            }
        });
    });
}

function calculateCentroid(coords) {
    let lat = 0, lng = 0;
    coords.forEach(c => { lat += c.lat; lng += c.lng; });
    return { lat: lat / coords.length, lng: lng / coords.length };
}

function randomInRange(min, max) {
    return min + Math.random() * (max - min);
}

function saveTrackingData(user, geofence, eventType, duration = null) {
    fetch('/api/save_tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: user.id,
            user_name: user.name,
            geofence_id: geofence.id,
            geofence_name: geofence.name,
            event_type: eventType,
            timestamp: currentSimulatedDate.toISOString(),
            duration: duration
        })
    }).catch(error => console.error("Error saving tracking:", error));
}

function toggleSimulation() {
    const button = document.getElementById("toggleSimulation");
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
        button.textContent = "Start Simulation";
        button.classList.remove("bg-red-600", "hover:bg-red-700");
        button.classList.add("bg-purple-600", "hover:bg-purple-700");
        simulatedUsers.forEach(user => user.marker.setMap(null));
    } else {
        initializeSimulatedUsers('patterns').then(() => {
            simulationInterval = setInterval(() => {
                currentSimulatedDate.setHours(currentSimulatedDate.getHours() + 1);
                simulateUserMovement();
                updateAnalyticsList();
            }, 5000);
            button.textContent = "Stop Simulation";
            button.classList.remove("bg-purple-600", "hover:bg-purple-700");
            button.classList.add("bg-red-600", "hover:bg-red-700");
        });
    }
}

function updateAnalyticsList() {
    fetch('/api/patterns')
        .then(response => response.json())
        .then(patterns => {
            const triggerData = {};
            patterns.forEach(p => {
                const timestamp = new Date(p.timestamp);
                const dayHour = `${timestamp.toLocaleDateString('en-US', { weekday: 'short' })} ${timestamp.getHours()}:00`;
                if (!triggerData[p.geofence_name]) triggerData[p.geofence_name] = {};
                triggerData[p.geofence_name][dayHour] = (triggerData[p.geofence_name][dayHour] || 0) + p.visit_count;
            });

            const labels = [];
            const datasets = [];
            const allTimes = new Set();

            Object.keys(triggerData).forEach(geofence => {
                Object.keys(triggerData[geofence]).forEach(time => allTimes.add(time));
            });
            labels.push(...Array.from(allTimes).sort());

            Object.keys(triggerData).forEach(geofence => {
                const data = labels.map(time => triggerData[geofence][time] || 0);
                datasets.push({
                    label: geofence,
                    data: data,
                    borderColor: `hsl(${Math.random() * 360}, 70%, 50%)`,
                    fill: false
                });
            });

            analyticsChart.data.labels = labels;
            analyticsChart.data.datasets = datasets;
            analyticsChart.update();
        })
        .catch(error => console.error("Error fetching analytics:", error));
}

// Initialize chart when simulation.js loads
initAnalyticsChart();