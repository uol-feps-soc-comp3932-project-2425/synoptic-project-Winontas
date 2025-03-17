let map;
let drawingManager;
let geofences = []; // Stores geofences locally
let competitorMarkers = []; // Store current markers
let placesService; // Google Places service

// Map of business type values to Google Places type
const businessTypeToPlacesType = {
    supermarket: 'supermarket',
    fitness_supplement: 'gym', // Places API doesn't have supplement stores specifically
    cafe: 'cafe'
};

// Initialise Google Map
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 53.8008, lng: -1.5491 }, // Leeds, UK
        zoom: 12,
    });
    
    // Initialize Places service
    placesService = new google.maps.places.PlacesService(map);

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
    
    // Event listener for business type selection
    document.getElementById("businessType").addEventListener("change", updateCompetitorMarkers);
    
    // Load competitors for the default business type
    updateCompetitorMarkers();
}

// Updates competitor markers based on selected business type
function updateCompetitorMarkers() {
    // Remove existing markers
    competitorMarkers.forEach(marker => marker.setMap(null));
    competitorMarkers = [];
    
    const selectedType = document.getElementById("businessType").value;
    const placesType = businessTypeToPlacesType[selectedType];
    
    if (!placesType) return;
    
    // Define the search request
    const request = {
        location: map.getCenter(),
        radius: 5000, // Search within 5km
        type: placesType
    };
    
    // Perform a nearby search
    placesService.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            results.forEach(place => {
                const marker = new google.maps.Marker({
                    position: place.geometry.location,
                    map: map,
                    title: place.name,
                    icon: {
                        url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                    },
                });
                
                // Add info window when clicking on marker
                const infoWindow = new google.maps.InfoWindow({
                    content: `<strong>${place.name}</strong><br>${place.vicinity || ''}`
                });
                
                marker.addListener('click', () => {
                    infoWindow.open(map, marker);
                });
                
                competitorMarkers.push(marker);
            });
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
    const geofence = geofences.find(g => g.id === id);
    if (geofence && geofence.polygon) {
        geofence.polygon.setMap(null);
    }
    geofences = geofences.filter((g) => g.id !== id);
    updateGeofenceList();
}

// Load the map when the window loads
window.onload = initMap;