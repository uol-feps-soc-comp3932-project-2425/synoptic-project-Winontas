let map;
let drawingManager;
let geofences = []; // Stores geofences locally
let competitorMarkers = []; // Store current markers
let placesService; // Google Places service
let simulatedUsers = []; // Simulated user data
let currentSimulatedDate = new Date("2025-03-24T00:00:00");


// Map of business type values to Google Places type
const businessTypeToPlacesType = {
    supermarket: 'supermarket',
    fitness_supplement: 'gym',
    cafe: 'cafe'
};

// Load simulated users from backend
async function initializeSimulatedUsers(dataset = 'patterns') {
    try {
        const response = await fetch(`/api/simulated_users?dataset=${dataset}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch simulated users: ${response.status}`);
        }
        const data = await response.json();
        
        simulatedUsers = data.users.map(user => ({
            id: user.id,
            name: user.name,
            lat: user.start_lat,
            lng: user.start_lng,
            lastUpdate: null,
            insideGeofences: {},
            schedule: user.schedule || []
        }));
        console.log(`Loaded ${simulatedUsers.length} users from dataset: ${data.description}`);
    } catch (error) {
        console.error("Error initializing simulated users:", error);
        simulatedUsers = []; // Fallback to empty array
    }
}


// Simulate user movement based on schedule
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
            const targetGeofence = geofences.find(g => g.business_type === scheduledVisit.location && g.active);
            if (targetGeofence) {
                const centroid = calculateCentroid(targetGeofence.coordinates);
                targetLat = centroid.lat;
                targetLng = centroid.lng;
            }
        }

        if (!targetLat || !targetLng) {
            targetLat = user.lat + (Math.random() - 0.5) * 0.001;
            targetLng = user.lng + (Math.random() - 0.5) * 0.001;
        }

        user.lat = targetLat;
        user.lng = targetLng;
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
                console.log(`${user.name} entered ${geofence.name} at ${currentSimulatedDate}`);
                saveTrackingData(user, geofence, "entry");
            } else if (!isInside && user.insideGeofences[geofenceKey]) {
                const entryTime = user.insideGeofences[geofenceKey].entryTime;
                const exitTime = new Date(currentSimulatedDate);
                const duration = (exitTime - entryTime) / 1000 / 60;
                console.log(`${user.name} exited ${geofence.name}. Duration: ${duration.toFixed(1)} min`);
                delete user.insideGeofences[geofenceKey];
                saveTrackingData(user, geofence, "exit", duration);
            }
        });
    });
}

// Initialise Google Map
function initMap() {
    console.log("Initializing Google Maps...");
    
    if (typeof google === "undefined" || !google.maps) {
        console.error("Google Maps API not loaded properly!");
        document.getElementById("map").innerHTML = 
            "<div class='p-4 bg-red-100 text-red-700'>Error loading Google Maps API.</div>";
        return;
    }

    const mapDiv = document.getElementById("map");
    if (!mapDiv) {
        console.error("Map div not found in DOM!");
        return;
    }

    map = new google.maps.Map(mapDiv, {
        center: { lat: 53.7996, lng: -1.5492 }, // Leeds city center
        zoom: 15, // More zoomed in
        mapTypeControl: true,
        fullscreenControl: true,
    });

    placesService = new google.maps.places.PlacesService(map);

    // Initialize drawing manager
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
            clickable: true,
            editable: true,
            draggable: true
        },
    });

    drawingManager.setMap(map);

    // When a new geofence is created
    google.maps.event.addListener(drawingManager, "overlaycomplete", (event) => {
        if (event.type === google.maps.drawing.OverlayType.POLYGON) {
            const coordinates = event.overlay.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }));
            const newGeofence = {
                id: Date.now(), // Temporary ID
                polygon: event.overlay,
                active: false,
                name: `Geofence ${geofences.length + 1}`,
                business_type: document.getElementById("businessType").value,
                coordinates: coordinates
            };

            google.maps.event.addListener(event.overlay.getPath(), 'set_at', () => updateGeofencePaths(newGeofence));
            google.maps.event.addListener(event.overlay.getPath(), 'insert_at', () => updateGeofencePaths(newGeofence));

            geofences.push(newGeofence);
            saveGeofenceToBackend(newGeofence).then(savedGeofence => {
                newGeofence.id = savedGeofence.id; // Update with server ID
                updateGeofenceList();
            });
            console.log("New geofence created:", newGeofence.name);
        }
    });

    document.getElementById("businessType").addEventListener("change", updateCompetitorMarkers);
    initializeSimulatedUsers('patterns'); // Default to patterns dataset
    loadGeofencesFromBackend(); // Load existing geofences
    updateCompetitorMarkers();
    startUserSimulation();
}

// Load existing geofences from backend
function loadGeofencesFromBackend() {
    fetch('/geofences')
        .then(response => response.json())
        .then(data => {
            geofences.forEach(g => g.polygon.setMap(null)); // Remove polygons from map
            geofences = []; // Reset the array

            data.forEach(g => {
                const polygon = new google.maps.Polygon({
                    paths: g.coordinates,
                    fillColor: g.active ? "#00FF00" : "#FF0000",
                    fillOpacity: g.active ? 0.5 : 0.35,
                    strokeWeight: 2,
                    clickable: true,
                    editable: true,
                    draggable: true,
                    map: map
                });

                const geofence = {
                    id: g.id,
                    polygon: polygon,
                    active: g.active,
                    name: g.name,
                    business_type: g.business_type,
                    coordinates: g.coordinates
                };

                google.maps.event.addListener(polygon.getPath(), 'set_at', () => updateGeofencePaths(geofence));
                google.maps.event.addListener(polygon.getPath(), 'insert_at', () => updateGeofencePaths(geofence));

                geofences.push(geofence);
            });
            updateGeofenceList();
        })
        .catch(error => console.error("Error loading geofences:", error));
}

// Update geofence paths when edited
function updateGeofencePaths(geofence) {
    geofence.coordinates = geofence.polygon.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }));
    updateGeofenceInBackend(geofence); // Use PUT instead of POST
    console.log(`Geofence ${geofence.name} paths updated`);
}

// Save new geofence to Flask backend (POST)
async function saveGeofenceToBackend(geofence) {
    const response = await fetch('/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            business_type: geofence.business_type,
            name: geofence.name,
            coordinates: geofence.coordinates,
            active: geofence.active
        })
    });
    const data = await response.json();
    return { id: data.id };
}

// Update existing geofence in Flask backend (PUT)
async function updateGeofenceInBackend(geofence) {
    await fetch(`/geofences/${geofence.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            business_type: geofence.business_type,
            name: geofence.name,
            coordinates: geofence.coordinates,
            active: geofence.active
        })
    });
}

// Simulate user movement and track geofence activity
function startUserSimulation() {
    setInterval(() => {
        simulatedUsers.forEach(user => {
            user.lat += (Math.random() - 0.5) * 0.001;
            user.lng += (Math.random() - 0.5) * 0.001;
            user.lastUpdate = new Date();

            geofences.forEach(geofence => {
                if (!geofence.active) return;

                const isInside = google.maps.geometry.poly.containsLocation(
                    new google.maps.LatLng(user.lat, user.lng),
                    geofence.polygon
                );

                const geofenceKey = geofence.id;
                if (isInside && !user.insideGeofences[geofenceKey]) {
                    user.insideGeofences[geofenceKey] = { entryTime: new Date() };
                    console.log(`${user.name} entered ${geofence.name}`);
                    saveTrackingData(user, geofence, "entry");
                } else if (!isInside && user.insideGeofences[geofenceKey]) {
                    const entryTime = user.insideGeofences[geofenceKey].entryTime;
                    const exitTime = new Date();
                    const duration = (exitTime - entryTime) / 1000;
                    console.log(`${user.name} exited ${geofence.name}. Duration: ${duration}s`);
                    delete user.insideGeofences[geofenceKey];
                    saveTrackingData(user, geofence, "exit", duration);
                }
            });
        });
        updateTrackingList();
    }, 5000);
}

// Save tracking data to Flask backend
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
            timestamp: new Date().toISOString(),
            duration: duration
        })
    })
    .then(response => response.json())
    .catch(error => console.error("Error saving tracking data:", error));
}

// Update tracking list in UI
function updateTrackingList() {
    const trackingList = document.getElementById("trackingList") || document.createElement("ul");
    trackingList.id = "trackingList";
    trackingList.className = "space-y-2 p-4";
    if (!trackingList.parentElement) document.querySelector("aside").appendChild(trackingList);

    trackingList.innerHTML = "";
    simulatedUsers.forEach(user => {
        Object.keys(user.insideGeofences).forEach(geofenceId => {
            const geofence = geofences.find(g => g.id == geofenceId);
            if (!geofence) return;

            const entryTime = user.insideGeofences[geofenceId].entryTime;
            const duration = (new Date() - entryTime) / 1000;

            const item = document.createElement("li");
            item.innerHTML = `${user.name} in ${geofence.name} since ${entryTime.toLocaleTimeString()} (${duration.toFixed(1)}s)`;
            trackingList.appendChild(item);
        });
    });
}

// Updates competitor markers
function updateCompetitorMarkers() {
    competitorMarkers.forEach(marker => marker.setMap(null));
    competitorMarkers = [];

    const selectedType = document.getElementById("businessType").value;
    const placesType = businessTypeToPlacesType[selectedType];

    if (!placesType) {
        console.warn("No mapping found for business type:", selectedType);
        return;
    }

    const requestBody = {
        textQuery: `${placesType} in Leeds, UK` // Narrow search to Leeds
    };

    const url = "https://places.googleapis.com/v1/places:searchText";

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": "AIzaSyAFplA5X2oW5-rRak8s4HT6JhBuZl53wp8",
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location"
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("HTTP error! status: " + response.status);
        }
        return response.json();
    })
    .then(data => {
        if (data.places && data.places.length) {
            data.places.forEach(place => {
                const loc = place.location;
                if (!loc || loc.latitude === undefined || loc.longitude === undefined) {
                    console.warn("Place missing geometry:", place);
                    return;
                }

                const markerIcon = {
                    supermarket: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                    fitness_supplement: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                    cafe: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
                }[selectedType] || 'https://maps.google.com/mapfiles/ms/icons/green-dot.png';

                const marker = new google.maps.Marker({
                    position: { lat: loc.latitude, lng: loc.longitude },
                    map: map,
                    icon: {
                        url: markerIcon,
                        scaledSize: new google.maps.Size(32, 32)
                    },
                    title: place.displayName ? place.displayName.text : "Unknown"
                });

                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div>
                            <h3>${place.displayName ? place.displayName.text : "Unknown"}</h3>
                            <p>Type: ${selectedType}</p>
                            <p>${place.formattedAddress || "Address not available"}</p>
                        </div>
                    `
                });

                marker.addListener('click', () => {
                    infoWindow.open(map, marker);
                });

                competitorMarkers.push(marker);
            });
        } else {
            console.error("No places found or error in response:", data);
        }
    })
    .catch(error => console.error("Error fetching competitor locations:", error));
}

// Update geofence list
function updateGeofenceList() {
    const list = document.getElementById("geofenceList");
    const selectedType = document.getElementById("businessType").value;
    list.innerHTML = geofences.length === 0 
        ? "<p class='text-gray-500 p-2'>No geofences created yet.</p>"
        : "";

    const filteredGeofences = geofences.filter(g => g.business_type === selectedType || selectedType === "all");
    filteredGeofences.forEach(g => {
        const item = document.createElement("li");
        item.classList = "flex justify-between items-center p-2 bg-gray-200 rounded shadow mb-2";
        item.innerHTML = `
            <input type="text" value="${g.name}" class="font-medium border rounded p-1 w-1/2" onchange="editGeofenceName(${g.id}, this.value)">
            <div>
                <button onclick="toggleGeofence(${g.id})" class="px-3 py-1 rounded shadow ${g.active ? 'bg-green-500' : 'bg-blue-500'} text-white mr-2">
                    ${g.active ? "Deactivate" : "Activate"}
                </button>
                <button onclick="deleteGeofence(${g.id})" class="bg-red-500 text-white px-3 py-1 rounded shadow">
                    Delete
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

function editGeofenceName(id, newName) {
    const geofence = geofences.find(g => g.id === id);
    if (geofence) {
        geofence.name = newName;
        updateGeofenceInBackend(geofence);
        console.log(`Geofence ${id} renamed to ${newName}`);
    }
}

// Toggle geofence
function toggleGeofence(id) {
    const geofence = geofences.find(g => g.id === id);
    if (geofence) {
        fetch(`/geofences/${id}/toggle`, { method: 'PUT' })
            .then(response => response.json())
            .then(() => {
                geofence.active = !geofence.active;
                geofence.polygon.setOptions({
                    fillColor: geofence.active ? "#00FF00" : "#FF0000",
                    fillOpacity: geofence.active ? 0.5 : 0.35
                });
                updateGeofenceList();
            })
            .catch(error => console.error("Error toggling geofence:", error));
    }
}

// Delete geofence
function deleteGeofence(id) {
    fetch(`/geofences/${id}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(() => {
            const geofence = geofences.find(g => g.id === id);
            if (geofence && geofence.polygon) geofence.polygon.setMap(null);
            geofences = geofences.filter(g => g.id !== id);
            updateGeofenceList();
        })
        .catch(error => console.error("Error deleting geofence:", error));
}

window.onload = initMap;