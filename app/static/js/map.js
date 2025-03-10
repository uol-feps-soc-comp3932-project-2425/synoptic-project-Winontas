let map;
let drawingManager;
let geofences = [];
let competitorMarkers = [];
const leedsCenter = { lat: 53.8008, lng: -1.5491 }; // Leeds, UK

// Predefined competitor locations based on business type
const competitorLocations = {
    supermarket: [
        { name: "Tesco", lat: 53.8010, lng: -1.5485 },
        { name: "Sainsbury’s", lat: 53.7985, lng: -1.5478 },
    ],
    fitness_supplement: [
        { name: "Holland & Barrett", lat: 53.7992, lng: -1.5480 },
        { name: "GNC", lat: 53.8020, lng: -1.5502 },
    ],
    cafe: [
        { name: "Starbucks", lat: 53.8015, lng: -1.5490 },
        { name: "Costa Coffee", lat: 53.7988, lng: -1.5469 },
    ],
};

// Initialise Google Map
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: leedsCenter,
        zoom: 12,
    });

    // Set up drawing manager for geofences
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

    // Add event listener when a geofence is drawn
    google.maps.event.addListener(drawingManager, "overlaycomplete", (event) => {
        if (event.type === google.maps.drawing.OverlayType.POLYGON) {
            addGeofence(event.overlay);
        }
    });

    // Event listener for business type selection
    document.getElementById("businessType").addEventListener("change", updateCompetitorMarkers);
}

// Adds a new geofence to the map and sidebar
function addGeofence(polygon) {
    const newGeofence = {
        id: Date.now(),
        polygon: polygon,
        active: false,
        name: `Geofence ${geofences.length + 1}`,
        business_type: document.getElementById("businessType").value,
    };

    geofences.push(newGeofence);
    updateGeofenceList();
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
    const geofenceIndex = geofences.findIndex((g) => g.id === id);
    if (geofenceIndex !== -1) {
        geofences[geofenceIndex].polygon.setMap(null);
        geofences.splice(geofenceIndex, 1);
        updateGeofenceList();
    }
}

// Updates competitor markers based on selected business type
function updateCompetitorMarkers() {
    const selectedType = document.getElementById("businessType").value;

    // Remove existing markers
    competitorMarkers.forEach(marker => marker.setMap(null));
    competitorMarkers = [];

    if (competitorLocations[selectedType]) {
        competitorLocations[selectedType].forEach(location => {
            const marker = new google.maps.Marker({
                position: { lat: location.lat, lng: location.lng },
                map: map,
                title: location.name,
                icon: {
                    url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                },
            });
            competitorMarkers.push(marker);
        });
    }
}

// Load the map when the window loads
window.onload = initMap;
