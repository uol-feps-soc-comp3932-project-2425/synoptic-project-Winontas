let map;
let drawingManager;
let geofences = []; // Stores geofences locally

// Initialise Google Map
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 53.8008, lng: -1.5491 }, // Leeds, UK
        zoom: 12,
    });

    drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.POLYGON,
        drawingControl: true,
        drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: ["polygon"],
        },
        polygonOptions: {
            fillColor: "#FF0000",
            fillOpacity: 0.35,
            strokeWeight: 2,
            editable: true,
        },
    });

    drawingManager.setMap(map);

    // When a new geofence is created
    google.maps.event.addListener(drawingManager, "overlaycomplete", (event) => {
        if (event.type === google.maps.drawing.OverlayType.POLYGON) {
            const newGeofence = {
                id: Date.now(), 
                polygon: event.overlay,
                active: false,
                name: `Geofence ${geofences.length + 1}`,
                business_type: document.getElementById("businessType").value,
            };

            geofences.push(newGeofence);
            updateGeofenceList();
        }
    });
}

// Updates sidebar with geofences
function updateGeofenceList() {
    const list = document.getElementById("geofenceList");
    list.innerHTML = "";

    geofences.forEach((g) => {
        const item = document.createElement("li");
        item.classList = "flex justify-between items-center p-2 bg-gray-200 rounded shadow";

        item.innerHTML = `
            <span class="font-medium">${g.name} (${g.business_type})</span>
            <div>
                <button onclick="toggleGeofence(${g.id})"
                    class="px-3 py-1 rounded shadow ${g.active ? 'bg-green-500' : 'bg-blue-500'} text-white">
                    ${g.active ? "Deactivate" : "Activate"}
                </button>
                <button onclick="deleteGeofence(${g.id})"
                    class="bg-red-500 text-white px-3 py-1 rounded shadow">
                    Delete
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

// Activate/deactivate geofences
function toggleGeofence(id) {
    const geofence = geofences.find((g) => g.id === id);
    if (geofence) {
        geofence.active = !geofence.active;
        updateGeofenceList();
    }
}

// Delete geofence
function deleteGeofence(id) {
    geofences = geofences.filter((g) => g.id !== id);
    updateGeofenceList();
}

// Load the map when the window loads
window.onload = initMap;
