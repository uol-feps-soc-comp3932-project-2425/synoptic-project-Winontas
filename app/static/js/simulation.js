let simulationMap;
let userMarkers = [];
let simulationResults = [];
let currentView = 'map';
let chartInstance = null; // Store the chart instance globally

function initSimulationMap() {
    simulationMap = new google.maps.Map(document.getElementById("mapView"), {
        center: { lat: 53.7996, lng: -1.5492 },
        zoom: 13,
        mapTypeControl: true,
        fullscreenControl: true,
    });

    fetch('/geofences')
        .then(response => response.json())
        .then(data => {
            data.forEach(g => {
                new google.maps.Polygon({
                    paths: g.coordinates,
                    fillColor: g.active ? "#00FF00" : "#FF0000",
                    fillOpacity: g.active ? 0.5 : 0.35,
                    strokeWeight: 2,
                    clickable: true,
                    editable: false,
                    draggable: false,
                    map: simulationMap
                });
            });
        })
        .catch(error => console.error("Error loading geofences:", error));

    document.getElementById("runSimulation").addEventListener("click", runSimulation);
    document.getElementById("toggleView").addEventListener("click", toggleView);
    document.getElementById("filterType").addEventListener("change", updateFilterOptions);
    document.getElementById("filterValue").addEventListener("change", filterResults);
}

function toggleView() {
    const mapView = document.getElementById("mapView");
    const resultsView = document.getElementById("resultsView");
    const toggleButton = document.getElementById("toggleView");

    if (currentView === 'map') {
        mapView.classList.add("hidden");
        resultsView.classList.remove("hidden");
        toggleButton.textContent = "Show Map";
        currentView = 'results';
    } else {
        mapView.classList.remove("hidden");
        resultsView.classList.add("hidden");
        toggleButton.textContent = "Show Results";
        currentView = 'map';
    }
}

async function runSimulation() {
    const numUsers = parseInt(document.getElementById("numUsers").value);
    const numWeeks = parseInt(document.getElementById("numWeeks").value);

    userMarkers.forEach(marker => marker.setMap(null));
    userMarkers = [];
    simulationResults = [];
    document.getElementById("simulationResults").innerHTML = "";

    const response = await fetch('/api/run_simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ num_users: numUsers, num_weeks: numWeeks })
    });
    const result = await response.json();

    if (result.error) {
        alert(result.error);
        return;
    }

    simulationResults = result.triggers;

    result.users.forEach((user, index) => {
        const color = `hsl(${index * 360 / numUsers}, 70%, 50%)`;
        const homeMarker = new google.maps.Marker({
            position: user.home,
            map: simulationMap,
            icon: { url: 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png', scaledSize: new google.maps.Size(32, 32) },
            title: `${user.name}'s Home`
        });
        userMarkers.push(homeMarker);

        user.movements.forEach(movement => {
            const path = new google.maps.Polyline({
                path: [movement.from, movement.to],
                geodesic: true,
                strokeColor: color,
                strokeOpacity: 0.5,
                strokeWeight: 2,
                map: simulationMap
            });
        });
    });

    displayResults(simulationResults);
    updatePatternChart(simulationResults, numUsers);
}

function updateFilterOptions() {
    const filterType = document.getElementById("filterType").value;
    const filterValue = document.getElementById("filterValue");
    filterValue.innerHTML = '<option value="all">All</option>';
    filterValue.disabled = filterType === "all";

    if (filterType === "user") {
        const users = [...new Set(simulationResults.map(r => r.user_name))];
        users.forEach(user => {
            const option = document.createElement("option");
            option.value = user;
            option.text = user;
            filterValue.appendChild(option);
        });
    } else if (filterType === "geofence") {
        const geofences = [...new Set(simulationResults.map(r => r.geofence_name))];
        geofences.forEach(geofence => {
            const option = document.createElement("option");
            option.value = geofence;
            option.text = geofence;
            filterValue.appendChild(option);
        });
    }
    filterResults();
}

function filterResults() {
    const filterType = document.getElementById("filterType").value;
    const filterValue = document.getElementById("filterValue").value;
    let filteredResults = simulationResults;

    if (filterType === "user" && filterValue !== "all") {
        filteredResults = simulationResults.filter(r => r.user_name === filterValue);
    } else if (filterType === "geofence" && filterValue !== "all") {
        filteredResults = simulationResults.filter(r => r.geofence_name === filterValue);
    }

    displayResults(filteredResults);
    updatePatternChart(filteredResults, null); // Pass filtered results to update chart
}

function displayResults(results) {
    const resultsDiv = document.getElementById("simulationResults");
    resultsDiv.innerHTML = "";
    results.forEach(trigger => {
        const div = document.createElement("div");
        div.className = "p-2 bg-gray-50 rounded-md text-sm";
        div.innerHTML = `${trigger.user_name} ${trigger.event_type} ${trigger.geofence_name} at ${new Date(trigger.timestamp).toLocaleString()}`;
        resultsDiv.appendChild(div);
    });
}

async function updatePatternChart(results, numUsers) {
    // Destroy existing chart instance if it exists
    if (chartInstance) {
        chartInstance.destroy();
    }

    const response = await fetch('/api/patterns');
    let patterns = await response.json();

    // Filter patterns to match the current filtered results
    const filteredUserIds = [...new Set(results.map(r => r.user_id))];
    const filteredGeofenceIds = [...new Set(results.map(r => r.geofence_id))];
    patterns = patterns.filter(p => 
        filteredUserIds.includes(p.user_id) && filteredGeofenceIds.includes(p.geofence_id)
    );

    const ctx = document.getElementById("patternChart").getContext("2d");
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: patterns.map(p => `${p.user_name} - ${p.geofence_name} (${p.day_of_week} ${p.hour}:00)`),
            datasets: [{
                label: 'Visit Count',
                data: patterns.map(p => p.visit_count),
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Visits' } },
                x: { title: { display: true, text: 'Patterns' } }
            },
            plugins: { legend: { display: false } },
            barThickness: numUsers ? Math.max(10, 50 / Math.sqrt(numUsers)) : 20, // Default thickness when filtered
            maintainAspectRatio: false
        }
    });
}

window.onload = initSimulationMap;