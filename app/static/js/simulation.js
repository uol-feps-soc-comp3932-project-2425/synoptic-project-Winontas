/**
 * simulation.js: Visualises simulated user movements on a Google Map.
 * Integrates with the backend to run simulations and display user home locations and movement paths.
 * Supports testing of pattern recognition and notification logic without real user data.
 */

let simulationMap;
let userMarkers = [];

// -----------------------------
// Section 1: Map Initialisation
// -----------------------------
// Sets up the simulation map and geofence display, preparing the interface for simulation results.

function initSimulationMap() {
    /** Initialises the Google Map for simulation visualisation and loads geofences. */
    simulationMap = new google.maps.Map(document.getElementById("mapView"), {
        center: { lat: 53.7996, lng: -1.5492 },
        zoom: 13,
        mapTypeControl: true,
        fullscreenControl: true,
    });

    // Load geofences for context
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

    // Bind simulation button
    document.getElementById("runSimulation").addEventListener("click", runSimulation);
}

// -----------------------------
// Section 2: Simulation Visualisation
// -----------------------------
// Runs simulations via the backend and visualises user movements with markers and paths.

async function runSimulation() {
    /** Runs a simulation with specified users and weeks, displaying results on the map. */
    const numUsers = parseInt(document.getElementById("numUsers").value);
    const numWeeks = parseInt(document.getElementById("numWeeks").value);

    // Clear existing markers
    userMarkers.forEach(marker => marker.setMap(null));
    userMarkers = [];

    // Trigger simulation
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

    // Visualise users and movements
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
}

window.onload = initSimulationMap;