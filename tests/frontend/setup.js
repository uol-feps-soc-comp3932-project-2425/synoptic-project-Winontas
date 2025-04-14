// Mock window
global.window = {
    onload: jest.fn(),
    geofences: [],
    fetch: jest.fn()
};

// Mock document
global.document = {
    getElementById: jest.fn(),
    body: {
        innerHTML: ''
    },
    querySelector: jest.fn(selector => ({
        getContext: jest.fn(() => ({})) // Mock canvas context if needed
    }))
};

// Mock Google Maps API
global.google = {
    maps: {
        Map: jest.fn(),
        Polygon: jest.fn().mockImplementation(() => ({
            getPath: jest.fn(),
            setMap: jest.fn()
        })),
        Marker: jest.fn().mockImplementation(({ position }) => ({
            position,
            setMap: jest.fn()
        })),
        Size: jest.fn(),
        places: {
            PlacesService: jest.fn().mockImplementation(() => ({
                nearbySearch: jest.fn()
            }))
        },
        drawing: {
            DrawingManager: jest.fn(),
            OverlayType: { POLYGON: 'polygon' }
        },
        event: {
            addListener: jest.fn(),
            listeners: { overlaycomplete: [] }
        }
    }
};

// Mock fetch (ensure global scope)
global.fetch = global.window.fetch;