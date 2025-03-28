let map;
let geofences = [];
let simulatedUsers = [];
let currentSimulatedDate = new Date("2025-03-24T00:00:00");
let simulationInterval = null;
let timelineChart;
let activeMapListener = null;

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 53.7996, lng: -1.5492 },
        zoom: 13,
        mapTypeControl: true,
        fullscreenControl: true,
    });

    loadGeofencesFromBackend();
    setupUserConfigs();
}

function loadGeofencesFromBackend() {
    fetch('/geofences')
        .then(response => response.json())
        .then(data => {
            geofences = data.map(g => ({
                id: g.id,
                polygon: new google.maps.Polygon({
                    paths: g.coordinates,
                    fillColor: g.active ? "#00FF00" : "#FF0000",
                    fillOpacity: 0.35,
                    strokeWeight: 2,
                    clickable: false,
                    editable: false,
                    map: map
                }),
                name: g.name,
                active: g.active
            }));
        })
        .catch(error => console.error("Error loading geofences:", error));
}

function setupUserConfigs() {
    const numUsersInput = document.getElementById("numUsers");
    const userConfigsDiv = document.getElementById("userConfigs");

    function updateConfigs() {
        const numUsers = parseInt(numUsersInput.value) || 1;
        userConfigsDiv.innerHTML = "";
        simulatedUsers = [];

        for (let i = 0; i < numUsers; i++) {
            const userDiv = document.createElement("div");
            userDiv.className = "p-4 bg-gray-50 rounded-lg shadow-sm";
            userDiv.innerHTML = `
                <h3 class="text-lg font-medium text-gray-800 mb-2">User ${i + 1}</h3>
                <div class="mb-2">
                    <label class="block text-sm text-gray-700">Home Location</label>
                    <button id="homeBtn${i}" class="px-2 py-1 bg-blue-500 text-white rounded-md">Set on Map</button>
                    <span id="homeCoords${i}" class="text-sm text-gray-600 ml-2">Not set</span>
                </div>
                <div class="mb-2">
                    <label class="block text-sm text-gray-700">Leave Home (Hour)</label>
                    <input id="leaveHour${i}" type="number" min="0" max="23" value="8" class="w-full p-2 border rounded-md">
                </div>
                <div class="mb-2">
                    <label class="block text-sm text-gray-700">Return Home (Hour)</label>
                    <input id="returnHour${i}" type="number" min="0" max="23" value="18" class="w-full p-2 border rounded-md">
                </div>
                <div class="mb-2">
                    <label class="block text-sm text-gray-700">Pattern Locations</label>
                    <div id="patternList${i}" class="space-y-2"></div>
                    <button id="addPattern${i}" class="px-2 py-1 bg-green-500 text-white rounded-md mt-2">Add Pattern</button>
                </div>
            `;
            userConfigsDiv.appendChild(userDiv);

            const user = { id: i + 1, name: `User_${i + 1}`, homeLat: null, homeLng: null, patterns: [] };
            simulatedUsers.push(user);

            document.getElementById(`homeBtn${i}`).onclick = () => {
                if (activeMapListener) google.maps.event.removeListener(activeMapListener);
                alert("Click on the map to set the home location for User " + (i + 1));
                activeMapListener = google.maps.event.addListener(map, 'click', (event) => {
                    user.homeLat = event.latLng.lat();
                    user.homeLng = event.latLng.lng();
                    document.getElementById(`homeCoords${i}`).textContent = `${user.homeLat.toFixed(4)}, ${user.homeLng.toFixed(4)}`;
                    google.maps.event.removeListener(activeMapListener);
                    activeMapListener = null;
                });
            };

            const patternList = document.getElementById(`patternList${i}`);
            document.getElementById(`addPattern${i}`).onclick = () => {
                const patternDiv = document.createElement("div");
                patternDiv.className = "p-2 bg-gray-100 rounded-md";
                patternDiv.innerHTML = `
                    <div class="mb-1">
                        <button id="patternBtn${i}_${user.patterns.length}" class="px-2 py-1 bg-blue-500 text-white rounded-md">Set on Map</button>
                        <span id="patternCoords${i}_${user.patterns.length}" class="text-sm text-gray-600 ml-2">Not set</span>
                    </div>
                    <div class="mb-1">
                        <select id="patternDay${i}_${user.patterns.length}" class="w-full p-1 border rounded-md">
                            <option value="Monday">Monday</option>
                            <option value="Tuesday">Tuesday</option>
                            <option value="Wednesday">Wednesday</option>
                            <option value="Thursday">Thursday</option>
                            <option value="Friday">Friday</option>
                            <option value="Saturday">Saturday</option>
                            <option value="Sunday">Sunday</option>
                        </select>
                    </div>
                    <div class="mb-1">
                        <input id="startHour${i}_${user.patterns.length}" type="number" min="0" max="23" value="9" class="w-full p-1 border rounded-md">
                    </div>
                    <div>
                        <input id="duration${i}_${user.patterns.length}" type="number" min="0.5" max="12" step="0.5" value="2" class="w-full p-1 border rounded-md">
                    </div>
                    <button onclick="this.parentElement.remove()" class="px-2 py-1 bg-red-500 text-white rounded-md mt-1">Remove</button>
                `;
                patternList.appendChild(patternDiv);

                const patternIndex = user.patterns.length;
                user.patterns.push({ lat: null, lng: null });

                document.getElementById(`patternBtn${i}_${patternIndex}`).onclick = () => {
                    if (activeMapListener) google.maps.event.removeListener(activeMapListener);
                    alert("Click on the map to set the pattern location for User " + (i + 1));
                    activeMapListener = google.maps.event.addListener(map, 'click', (event) => {
                        user.patterns[patternIndex].lat = event.latLng.lat();
                        user.patterns[patternIndex].lng = event.latLng.lng();
                        document.getElementById(`patternCoords${i}_${patternIndex}`).textContent = `${user.patterns[patternIndex].lat.toFixed(4)}, ${user.patterns[patternIndex].lng.toFixed(4)}`;
                        google.maps.event.removeListener(activeMapListener);
                        activeMapListener = null;
                    });
                };
            };
        }
    }

    numUsersInput.addEventListener("change", updateConfigs);
    updateConfigs();
}

function initTimelineChart() {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    timelineChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: 'Time (Days and Hours)' },
                    type: 'linear',
                    min: 0,
                    max: 168,
                    ticks: {
                        stepSize: 24,
                        callback: (value) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][Math.floor(value / 24)] || ''
                    }
                },
                y: {
                    title: { display: true, text: 'Users' },
                    type: 'category',
                    labels: []
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function startSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
        document.getElementById("startSimulation").textContent = "Start Simulation";
        simulatedUsers.forEach(user => user.marker?.setMap(null));
        return;
    }

    const allConfigured = simulatedUsers.every(u => 
        u.homeLat && u.homeLng && 
        u.patterns.every(p => p.lat && p.lng) && 
        parseInt(document.getElementById(`leaveHour${u.id - 1}`).value) < parseInt(document.getElementById(`returnHour${u.id - 1}`).value)
    );
    if (!allConfigured) {
        alert("Please set all home/pattern locations and ensure leave time is before return time.");
        return;
    }

    simulatedUsers = simulatedUsers.map((user, i) => {
        const leaveHour = parseInt(document.getElementById(`leaveHour${i}`).value);
        const returnHour = parseInt(document.getElementById(`returnHour${i}`).value);
        const schedule = user.patterns.map((p, j) => ({
            day: document.getElementById(`patternDay${i}_${j}`).value,
            start_hour: parseInt(document.getElementById(`startHour${i}_${j}`).value),
            duration: parseFloat(document.getElementById(`duration${i}_${j}`).value),
            coords: { lat: p.lat, lng: p.lng }
        }));

        // Add daily home schedule
        ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach(day => {
            schedule.push({ day, start_hour: 0, duration: leaveHour, coords: { lat: user.homeLat, lng: user.homeLng } });
            schedule.push({ day, start_hour: returnHour, duration: 24 - returnHour, coords: { lat: user.homeLat, lng: user.homeLng } });
        });

        return {
            ...user,
            lat: user.homeLat,
            lng: user.homeLng,
            marker: new google.maps.Marker({
                position: { lat: user.homeLat, lng: user.homeLng },
                map: map,
                title: user.name,
                icon: { url: 'https://maps.google.com/mapfiles/kml/shapes/man.png', scaledSize: new google.maps.Size(32, 32) }
            }),
            schedule,
            insideGeofences: {}
        };
    });

    timelineChart.options.scales.y.labels = simulatedUsers.map(u => u.name);
    timelineChart.update();

    currentSimulatedDate = new Date("2025-03-24T00:00:00");
    simulationInterval = setInterval(() => {
        currentSimulatedDate.setHours(currentSimulatedDate.getHours() + 1);
        simulateUserMovement();
        updateTimelineChart();
        if (currentSimulatedDate.getHours() >= 168) clearInterval(simulationInterval);
    }, 357);

    document.getElementById("startSimulation").textContent = "Stop Simulation";
}

function simulateUserMovement() {
    const dayOfWeek = currentSimulatedDate.toLocaleString('en-US', { weekday: 'long' });
    const currentHour = currentSimulatedDate.getHours();

    simulatedUsers.forEach(user => {
        const scheduledVisit = user.schedule.find(s => 
            s.day === dayOfWeek && 
            currentHour >= s.start_hour && 
            currentHour < s.start_hour + s.duration
        );

        const targetLat = scheduledVisit ? scheduledVisit.coords.lat : user.homeLat;
        const targetLng = scheduledVisit ? scheduledVisit.coords.lng : user.homeLng;

        user.lat += (targetLat - user.lat) * 0.1;
        user.lng += (targetLng - user.lng) * 0.1;
        user.marker.setPosition({ lat: user.lat, lng: user.lng });

        geofences.forEach(geofence => {
            if (!geofence.active) return;

            const isInside = google.maps.geometry.poly.containsLocation(
                new google.maps.LatLng(user.lat, user.lng),
                geofence.polygon
            );

            const geofenceKey = geofence.id;
            if (isInside && !user.insideGeofences[geofenceKey]) {
                user.insideGeofences[geofenceKey] = { entryTime: new Date(currentSimulatedDate) };
                saveTrackingData(user, geofence, "entry");
            } else if (!isInside && user.insideGeofences[geofenceKey]) {
                const entryTime = user.insideGeofences[geofenceKey].entryTime;
                const duration = (currentSimulatedDate - entryTime) / 1000 / 60;
                delete user.insideGeofences[geofenceKey];
                saveTrackingData(user, geofence, "exit", duration);
            }
        });
    });
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

function updateTimelineChart() {
    fetch('/api/patterns')
        .then(response => response.json())
        .then(patterns => {
            const datasets = [];
            simulatedUsers.forEach(user => {
                const userEvents = patterns.filter(p => p.user_id === user.id);
                const entryData = userEvents.filter(e => e.event_type === "entry").map(e => ({
                    x: new Date(e.timestamp).getHours() + (new Date(e.timestamp).getDay() * 24),
                    y: user.name,
                    color: 'green'
                }));
                const exitData = userEvents.filter(e => e.event_type === "exit").map(e => ({
                    x: new Date(e.timestamp).getHours() + (new Date(e.timestamp).getDay() * 24),
                    y: user.name,
                    color: 'red'
                }));

                datasets.push({
                    label: `${user.name} Entry`,
                    data: entryData,
                    backgroundColor: 'green',
                    pointRadius: 5
                }, {
                    label: `${user.name} Exit`,
                    data: exitData,
                    backgroundColor: 'red',
                    pointRadius: 5
                });
            });

            timelineChart.data.datasets = datasets;
            timelineChart.update('none');
        })
        .catch(error => console.error("Error updating timeline:", error));
}

window.onload = () => {
    initMap();
    initTimelineChart();
};