let simulationMap;
let userMarkers = [];

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
}

async function runSimulation() {
    const numUsers = parseInt(document.getElementById("numUsers").value);
    const numWeeks = parseInt(document.getElementById("numWeeks").value);

    userMarkers.forEach(marker => marker.setMap(null));
    userMarkers = [];

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