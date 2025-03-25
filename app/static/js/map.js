let map;
let drawingManager;
let geofences = [];
let competitorMarkers = [];
let placesService;

const businessTypeToPlacesType = {
    supermarket: 'supermarket',
    fitness_supplement: 'gym',
    cafe: 'cafe'
};

function initMap() {
    console.log("Initializing Google Maps...");
    
    if (typeof google === "undefined" || !google.maps) {
        console.error("Google Maps API not loaded properly!");
        document.getElementById("map").innerHTML = "<div class='p-4 bg-red-100 text-red-700'>Error loading Google Maps API.</div>";
        return;
    }

    const mapDiv = document.getElementById("map");
    if (!mapDiv) {
        console.error("Map div not found in DOM!");
        return;
    }

    map = new google.maps.Map(mapDiv, {
        center: { lat: 53.7996, lng: -1.5492 },
        zoom: 15,
        mapTypeControl: true,
        fullscreenControl: true,
    });

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
            clickable: true,
            editable: true,
            draggable: true
        },
    });

    drawingManager.setMap(map);

    google.maps.event.addListener(drawingManager, "overlaycomplete", (event) => {
        if (event.type === google.maps.drawing.OverlayType.POLYGON) {
            const coordinates = event.overlay.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }));
            const newGeofence = {
                id: Date.now(),
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
                newGeofence.id = savedGeofence.id;
                updateGeofenceList();
            });
        }
    });

    document.getElementById("businessType").addEventListener("change", updateCompetitorMarkers);
    loadGeofencesFromBackend();
    updateCompetitorMarkers();
}

function loadGeofencesFromBackend() {
    fetch('/geofences')
        .then(response => response.json())
        .then(data => {
            geofences.forEach(g => g.polygon.setMap(null));
            geofences = [];

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

function updateGeofencePaths(geofence) {
    geofence.coordinates = geofence.polygon.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }));
    updateGeofenceInBackend(geofence);
    console.log(`Geofence ${geofence.name} paths updated`);
}

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

async function updateCompetitorMarkers() {
    competitorMarkers.forEach(marker => marker.setMap(null));
    competitorMarkers = [];

    const selectedType = document.getElementById("businessType").value;
    const placesType = businessTypeToPlacesType[selectedType];

    if (!placesType) {
        console.warn("No mapping found for business type:", selectedType);
        return;
    }

    const queries = [
        `${placesType} in Leeds, UK`,
        `${placesType} near Leeds city center`,
        `${placesType} in Leeds suburbs`,
        `${placesType} around Leeds, UK`
    ];

    const url = "https://places.googleapis.com/v1/places:searchText";
    const allPlaces = new Set();

    for (const query of queries) {
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": "AIzaSyAFplA5X2oW5-rRak8s4HT6JhBuZl53wp8",
                    "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location"
                },
                body: JSON.stringify({ textQuery: query })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.places && data.places.length) {
                data.places.forEach(place => {
                    const loc = place.location;
                    if (!loc || loc.latitude === undefined || loc.longitude === undefined) {
                        console.warn("Place missing geometry:", place);
                        return;
                    }
                    const key = `${loc.latitude},${loc.longitude}`;
                    allPlaces.add({ ...place, key });
                });
            }
        } catch (error) {
            console.error(`Error fetching ${query}:`, error);
        }
    }

    const uniquePlaces = Array.from(allPlaces).slice(0, 50);

    uniquePlaces.forEach(place => {
        const loc = place.location;
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

    console.log(`Added ${competitorMarkers.length} markers for ${selectedType}`);
}

function updateGeofenceList() {
    const list = document.getElementById("geofenceList");
    const selectedType = document.getElementById("businessType").value;
    list.innerHTML = geofences.length === 0 
        ? "<p class='text-gray-500 text-sm italic'>No geofences created yet.</p>"
        : "";

    const filteredGeofences = geofences.filter(g => g.business_type === selectedType || selectedType === "all");

    filteredGeofences.forEach(g => {
        const item = document.createElement("li");
        item.classList = "p-4 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200";

        const iconClass = {
            supermarket: '🛒',
            fitness_supplement: '💪',
            cafe: '☕'
        }[g.business_type] || '📍';

        item.innerHTML = `
            <div class="flex items-center space-x-3 mb-3">
                <span class="text-lg">${iconClass}</span>
                <input type="text" value="${g.name}" class="w-full p-1 border rounded-md text-sm text-gray-700 focus:ring-2 focus:ring-blue-500" onchange="editGeofenceName(${g.id}, this.value)">
            </div>
            <div class="flex space-x-2">
                <button onclick="toggleGeofence(${g.id})" class="px-3 py-1 rounded-md text-sm font-medium text-white ${g.active ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} transition-colors duration-200">
                    ${g.active ? "Deactivate" : "Activate"}
                </button>
                <button onclick="deleteGeofence(${g.id})" class="px-3 py-1 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors duration-200">
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