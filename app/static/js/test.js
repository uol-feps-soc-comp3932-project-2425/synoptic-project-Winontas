let users = [];
let insideStatus = {};
let simulationInterval = null;
let currentSimulatedHour = 0;
let timelineChart;

function initTest() {
    initMap(false);

    const addUserBtn = document.getElementById("addUser");
    const startSimulationBtn = document.getElementById("startSimulation");
    const userListDiv = document.getElementById("userList");
    const logDiv = document.getElementById("log");

    addUserBtn.onclick = () => {
        alert("Click on the map to place a new user.");
        const clickListener = google.maps.event.addListener(map, 'click', (event) => {
            addUser(event.latLng, userListDiv);
            google.maps.event.removeListener(clickListener);
        });
    };

    startSimulationBtn.onclick = toggleSimulation;

    initTimelineChart();
    setInterval(checkAllUsers, 100);
}

function initTimelineChart() {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    if (!ctx) {
        console.error("Timeline chart canvas not found!");
        return;
    }

    timelineChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [], // Will be populated with hours (0-168)
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: 'Time (Hours)' },
                    stacked: false,
                    ticks: {
                        stepSize: 24,
                        callback: (value) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][Math.floor(value / 24)] || ''
                    }
                },
                y: {
                    title: { display: true, text: 'Time Spent (Hours)' },
                    stacked: false,
                    beginAtZero: true
                }
            },
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const data = context.dataset.data[context.dataIndex];
                            return `${context.dataset.label}: ${data.y}h from ${data.startHour.toFixed(1)}h to ${(data.startHour + data.y).toFixed(1)}h`;
                        }
                    }
                }
            }
        }
    });
    console.log("Bar chart initialized");

    // Initialize X-axis labels (0-168 hours)
    timelineChart.data.labels = Array.from({ length: 169 }, (_, i) => i);
    timelineChart.update();
}

function addUser(position, userListDiv) {
    const userId = `User${users.length + 1}`;
    const marker = new google.maps.Marker({
        position,
        map,
        draggable: true,
        title: userId,
        icon: { url: 'https://maps.google.com/mapfiles/kml/shapes/man.png', scaledSize: new google.maps.Size(32, 32) }
    });

    const path = [];
    let pathLine = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: map
    });

    const user = { id: userId, marker, path, pathLine, positionIndex: 0, geofenceEntries: {} };
    users.push(user);
    insideStatus[userId] = new Set();

    const userDiv = document.createElement("div");
    userDiv.className = "p-4 bg-gray-50 rounded-lg shadow-sm";
    userDiv.innerHTML = `
        <h4 class="text-md font-medium text-gray-800 mb-2">${userId}</h4>
        <button id="setPath${userId}" class="w-full px-2 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 mb-2">Set Path</button>
        <div id="pathCoords${userId}" class="text-sm text-gray-600">Path: None</div>
    `;
    userListDiv.appendChild(userDiv);

    const setPathBtn = document.getElementById(`setPath${userId}`);
    let pathListener = null;

    setPathBtn.onclick = () => {
        if (pathListener) {
            google.maps.event.removeListener(pathListener);
            pathListener = null;
            setPathBtn.textContent = "Set Path";
            pathLine.setPath(path);
            return;
        }

        alert(`Click on the map to add points to ${userId}'s path. Click "Set Path" again to finish.`);
        setPathBtn.textContent = "Finish Path";
        user.path.length = 0;
        pathLine.setPath(user.path);

        pathListener = google.maps.event.addListener(map, 'click', (event) => {
            user.path.push({ lat: event.latLng.lat(), lng: event.latLng.lng() });
            pathLine.setPath(user.path);
            document.getElementById(`pathCoords${userId}`).textContent = `Path: ${user.path.length} points`;
        });
    };

    checkGeofences(userId, position);
    updateTimelineChart();
}

function checkAllUsers() {
    users.forEach(user => {
        checkGeofences(user.id, user.marker.getPosition());
    });
}

function checkGeofences(userId, position) {
    const user = users.find(u => u.id === userId);
    geofences.forEach(geofence => {
        if (!geofence.active) return;

        const isInside = google.maps.geometry.poly.containsLocation(position, geofence.polygon);
        const wasInside = insideStatus[userId].has(geofence.id);

        if (isInside && !wasInside) {
            insideStatus[userId].add(geofence.id);
            user.geofenceEntries[geofence.id] = { entryTime: currentSimulatedHour };
            logEvent(userId, geofence.name, "Entry");
            updateGeofenceVisual(geofence);
            saveTrackingData(userId, geofence, "entry");
        } else if (!isInside && wasInside) {
            insideStatus[userId].delete(geofence.id);
            const entry = user.geofenceEntries[geofence.id];
            if (entry) {
                entry.duration = currentSimulatedHour - entry.entryTime;
                logEvent(userId, geofence.name, `Exit (Duration: ${entry.duration.toFixed(1)}h)`);
                updateGeofenceVisual(geofence);
                saveTrackingData(userId, geofence, "exit", entry.duration);
                updateTimelineChart();
            }
        }
    });
}

function updateGeofenceVisual(geofence) {
    const userCount = users.filter(u => insideStatus[u.id].has(geofence.id)).length;
    geofence.polygon.setOptions({
        fillColor: userCount > 0 ? "#FFFF00" : (geofence.active ? "#00FF00" : "#FF0000"),
        fillOpacity: userCount > 0 ? 0.6 : (geofence.active ? 0.5 : 0.35)
    });
}

function logEvent(userId, geofenceName, eventType) {
    const timestamp = new Date().toLocaleString();
    const logMessage = `${timestamp}: ${userId} ${eventType}`;
    const logEntry = document.createElement("div");
    logEntry.textContent = logMessage;
    document.getElementById("log").appendChild(logEntry);
    document.getElementById("log").scrollTop = document.getElementById("log").scrollHeight;
}

function saveTrackingData(userId, geofence, eventType, duration = null) {
    const data = {
        user_id: userId,
        user_name: userId,
        geofence_id: geofence.id,
        geofence_name: geofence.name,
        event_type: eventType,
        timestamp: new Date().toISOString(),
        duration: duration,
        simulated_hour: currentSimulatedHour
    };
    fetch('/api/save_tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => console.log(`Saved ${eventType} for ${userId} at ${currentSimulatedHour}h:`, result))
    .catch(error => console.error("Error saving tracking:", error));
}

function toggleSimulation() {
    const startSimulationBtn = document.getElementById("startSimulation");
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
        startSimulationBtn.textContent = "Start Simulation";
        startSimulationBtn.classList.remove("bg-red-600", "hover:bg-red-700");
        startSimulationBtn.classList.add("bg-purple-600", "hover:bg-purple-700");
        users.forEach(user => user.marker.setDraggable(true));
        return;
    }

    const allPathsSet = users.every(user => user.path.length > 1);
    if (!allPathsSet) {
        alert("Please set a path with at least 2 points for each user.");
        return;
    }

    // Clear previous tracking data for a fresh simulation
    fetch('/api/tracking', { method: 'DELETE' })  // Add this endpoint in backend if needed
        .catch(() => console.warn("No DELETE endpoint for /api/tracking, proceeding anyway"));

    users.forEach(user => {
        user.marker.setDraggable(false);
        user.positionIndex = 0;
        user.marker.setPosition(user.path[0]);
        user.geofenceEntries = {};
    });

    currentSimulatedHour = 0;
    simulationInterval = setInterval(() => {
        simulateUserMovement();
        currentSimulatedHour++;
        updateTimelineChart();
        if (currentSimulatedHour >= 168) {
            clearInterval(simulationInterval);
            simulationInterval = null;
            startSimulationBtn.textContent = "Start Simulation";
            startSimulationBtn.classList.remove("bg-red-600", "hover:bg-red-700");
            startSimulationBtn.classList.add("bg-purple-600", "hover:bg-purple-700");
            users.forEach(user => user.marker.setDraggable(true));
        }
    }, 357);

    startSimulationBtn.textContent = "Stop Simulation";
    startSimulationBtn.classList.remove("bg-purple-600", "hover:bg-purple-700");
    startSimulationBtn.classList.add("bg-red-600", "hover:bg-red-700");
}

function simulateUserMovement() {
    users.forEach(user => {
        if (user.path.length < 2) return;

        let totalDistance = 0;
        const segmentDistances = [];
        for (let i = 0; i < user.path.length - 1; i++) {
            const dist = google.maps.geometry.spherical.computeDistanceBetween(
                new google.maps.LatLng(user.path[i]),
                new google.maps.LatLng(user.path[i + 1])
            );
            segmentDistances.push(dist);
            totalDistance += dist;
        }

        const progress = currentSimulatedHour / 168;
        const targetDistance = progress * totalDistance;

        let accumulatedDistance = 0;
        let currentSegment = 0;
        for (let i = 0; i < segmentDistances.length; i++) {
            if (accumulatedDistance + segmentDistances[i] >= targetDistance) {
                currentSegment = i;
                break;
            }
            accumulatedDistance += segmentDistances[i];
        }

        const segmentProgress = (targetDistance - accumulatedDistance) / segmentDistances[currentSegment];
        const startPoint = user.path[currentSegment];
        const endPoint = user.path[currentSegment + 1];

        const newLat = startPoint.lat + (endPoint.lat - startPoint.lat) * segmentProgress;
        const newLng = startPoint.lng + (endPoint.lng - startPoint.lng) * segmentProgress;

        user.marker.setPosition({ lat: newLat, lng: newLng });
    });
}

function updateTimelineChart() {
    if (!timelineChart) {
        console.error("Timeline chart not initialized!");
        return;
    }

    fetch('/api/tracking')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(tracking => {
            console.log("Tracking data received:", tracking);
            const datasets = [];

            users.forEach(user => {
                const userEvents = tracking.filter(t => t.user_id === user.id && t.simulated_hour !== null);
                const exitEvents = userEvents.filter(e => e.event_type === "exit" && e.duration);

                exitEvents.forEach(event => {
                    const startHour = event.simulated_hour - event.duration;
                    const datasetLabel = `${user.id} - ${event.geofence_name}`;
                    const color = `hsl(${Math.random() * 360}, 70%, 50%)`; // Random color per geofence

                    datasets.push({
                        label: datasetLabel,
                        data: [{
                            x: startHour,
                            y: event.duration,
                            startHour: startHour
                        }],
                        backgroundColor: color,
                        barThickness: 10
                    });
                });
            });

            if (datasets.length === 0) {
                console.warn("No data to plot in bar chart!");
            } else {
                console.log("Bar chart datasets:", datasets);
            }

            timelineChart.data.datasets = datasets;
            timelineChart.update('none');
        })
        .catch(error => console.error("Error fetching tracking data:", error));
}

window.onload = initTest;