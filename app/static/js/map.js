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
    console.log("Initializing Google Maps...");
    
    // Check if Google Maps API is loaded
    if (typeof google === "undefined" || !google.maps) {
        console.error("Google Maps API not loaded properly!");
        document.getElementById("map").innerHTML = 
            "<div class='p-4 bg-red-100 text-red-700'>Error loading Google Maps API. Please check your API key.</div>";
        return;
    }
    
    // Check if Places API is available
    if (!google.maps.places) {
        console.error("Places library not loaded. Ensure &libraries=places in the script URL.");
        document.getElementById("map").innerHTML = 
            "<div class='p-4 bg-red-100 text-red-700'>Error: Places library not loaded. Check your script tag to include &libraries=places.</div>";
        return;
    }

    // Check if Drawing library is available
    if (!google.maps.drawing) {
        console.error("Drawing library not loaded. Ensure &libraries=drawing in the script URL.");
        document.getElementById("map").innerHTML = 
            "<div class='p-4 bg-red-100 text-red-700'>Error: Drawing library not loaded. Check your script tag to include &libraries=drawing.</div>";
        return;
    }

    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 53.8008, lng: -1.5491 }, // Leeds, UK
        zoom: 12,
        mapTypeControl: true,
        fullscreenControl: true,
    });

    console.log("Map initialized successfully");
    
    // Initialize Places service with proper error handling
    try {
        placesService = new google.maps.places.PlacesService(map);
        console.log("PlacesService initialized successfully");
    } catch (error) {
        console.error("Failed to initialize Places service:", error);
        document.getElementById("map").innerHTML += 
            "<div class='p-4 bg-red-100 text-red-700'>Error initializing Places service. Please check your API key permissions.</div>";
        return;
    }

    // Initialize drawing manager
    try {
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
        console.log("Drawing manager initialized successfully");
    } catch (error) {
        console.error("Failed to initialize Drawing Manager:", error);
        return;
    }

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
            console.log("New geofence created:", newGeofence.name);
        }
    });
    
    // Event listener for business type selection
    document.getElementById("businessType").addEventListener("change", function() {
        const selectedType = this.value;
        console.log("Business type changed to:", selectedType);
        updateCompetitorMarkers();
    });
    
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
    
    if (!placesType) {
      console.warn("No mapping found for business type:", selectedType);
      return;
    }
    
    const requestBody = {
      textQuery: placesType
    };
    
    const url = "https://places.googleapis.com/v1/places:searchText";
    
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": "AIzaSyAFplA5X2oW5-rRak8s4HT6JhBuZl53wp8", // Replace with your actual key.
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.priceLevel,places.location"
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
            // Check for location field.
            const loc = place.location;
            if (!loc || loc.latitude === undefined || loc.longitude === undefined) {
              console.warn("Place missing geometry:", place);
              return;
            }
            
            const marker = new google.maps.Marker({
              position: { 
                lat: loc.latitude, 
                lng: loc.longitude 
              },
              map: map,
              title: place.displayName ? place.displayName.text : "Unknown"
            });
            competitorMarkers.push(marker);
          });
        } else {
          console.error("No places found or error in response:", data);
        }
      })
      .catch(error => {
        console.error("Error fetching competitor locations:", error);
      });
  }
  
  
  
  

// Handle Places API errors
function handlePlacesError(status) {
    console.error("Places API error:", status);
    
    let errorMessage = "Error loading competitor data";
    
    switch(status) {
        case google.maps.places.PlacesServiceStatus.ZERO_RESULTS:
            errorMessage = "No results found in this area";
            break;
        case google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT:
            errorMessage = "Query limit exceeded. Please try again later";
            break;
        case google.maps.places.PlacesServiceStatus.REQUEST_DENIED:
            errorMessage = "Places API request denied. Check your API key permissions";
            break;
        case google.maps.places.PlacesServiceStatus.INVALID_REQUEST:
            errorMessage = "Invalid request to Places API";
            break;
        default:
            errorMessage = `Places API error: ${status}`;
    }
    
    // Display user-friendly error
    const errorDiv = document.createElement("div");
    errorDiv.className = "p-2 m-2 bg-red-100 text-red-700 rounded";
    errorDiv.textContent = errorMessage;
    
    // Add to page
    const geofenceList = document.getElementById("geofenceList");
    if (geofenceList) {
        geofenceList.prepend(errorDiv);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 10000);
    }
}

// Updates sidebar with geofences
function updateGeofenceList() {
    const list = document.getElementById("geofenceList");
    if (!list) {
        console.error("Geofence list element not found");
        return;
    }
    
    list.innerHTML = "";
    
    if (geofences.length === 0) {
        list.innerHTML = "<p class='text-gray-500 p-2'>No geofences created yet. Draw a polygon on the map.</p>";
        return;
    }

    geofences.forEach((g) => {
        const item = document.createElement("li");
        item.classList = "flex justify-between items-center p-2 bg-gray-200 rounded shadow mb-2";

        item.innerHTML = `
            <span class="font-medium">${g.name} (${g.business_type})</span>
            <div>
                <button onclick="toggleGeofence(${g.id})"
                    class="px-3 py-1 rounded shadow ${g.active ? 'bg-green-500' : 'bg-blue-500'} text-white mr-2">
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
        
        // Change polygon appearance based on state
        if (geofence.polygon) {
            geofence.polygon.setOptions({
                fillColor: geofence.active ? "#00FF00" : "#FF0000",
                fillOpacity: geofence.active ? 0.5 : 0.35
            });
        }
        
        updateGeofenceList();
        console.log(`Geofence ${geofence.name} ${geofence.active ? 'activated' : 'deactivated'}`);
    }
}

// Delete geofence
function deleteGeofence(id) {
    const geofence = geofences.find(g => g.id === id);
    if (geofence && geofence.polygon) {
        geofence.polygon.setMap(null);
        console.log(`Geofence ${geofence.name} deleted`);
    }
    geofences = geofences.filter((g) => g.id !== id);
    updateGeofenceList();
}

// Test Places API functionality
function testPlacesAPI() {
    if (!placesService) {
        console.error("Places service not initialized for testing");
        return;
    }
    
    console.log("Testing Places API...");
    
    // Simple request to test Places API
    placesService.findPlaceFromQuery({
        query: "supermarket",
        fields: ["name", "formatted_address", "geometry"]
    }, (results, status) => {
        console.log("Test Places API status:", status);
        console.log("Test results:", results);
        
        if (status !== google.maps.places.PlacesServiceStatus.OK) {
            alert(`Places API test failed with status: ${status}. Check console for details.`);
        }
    });
}

// Load the map when the window loads
window.onload = function() {
    console.log("Window loaded, initializing map...");
    initMap();
    
    // Add error handler for script loading issues
    window.gm_authFailure = function() {
        document.getElementById("map").innerHTML = 
            "<div class='p-4 bg-red-100 text-red-700'>Google Maps authentication failed. " +
            "Please check your API key and ensure the Places API is enabled in your Google Cloud Console.</div>";
        console.error("Google Maps authentication failed");
    };
};