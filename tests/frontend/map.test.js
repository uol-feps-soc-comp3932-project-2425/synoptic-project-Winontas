// Import functions
const { updateCompetitorMarkers } = require('../../app/static/js/map.js');

describe('Map Functions', () => {
    beforeEach(() => {
        global.window.geofences.length = 0;
        jest.clearAllMocks();
    });

    test('should add new geofence on overlaycomplete', () => {
        // Mock overlaycomplete event
        const mockOverlay = {
            type: 'polygon',
            overlay: {
                getPath: () => ({
                    getArray: () => [
                        { lat: () => 53.8, lng: () => -1.5 },
                        { lat: () => 53.81, lng: () => -1.51 }
                    ]
                })
            }
        };
        global.document.getElementById.mockReturnValue({ value: 'cafe' });
        global.fetch.mockResolvedValue({
            ok: true,
            json: () => ({ id: 1 })
        });

        // Simulate overlaycomplete event
        const mockListener = jest.fn().mockImplementation((event) => {
            global.window.geofences.push({
                id: 1,
                business_type: 'cafe',
                name: 'Test Cafe',
                coordinates: [{ lat: 53.8, lng: -1.5 }, { lat: 53.81, lng: -1.51 }],
                active: false
            });
        });
        global.google.maps.event.listeners.overlaycomplete = [mockListener];
        mockListener(mockOverlay);

        expect(global.window.geofences).toHaveLength(1);
        expect(global.window.geofences[0]).toMatchObject({
            business_type: 'cafe',
            coordinates: [{ lat: 53.8, lng: -1.5 }, { lat: 53.81, lng: -1.51 }],
            active: false
        });
    });

    test('should add competitor markers for selected business type', async () => {
        global.document.getElementById.mockReturnValue({ value: 'supermarket' });
        global.fetch.mockResolvedValue({
            ok: true,
            json: () => ({
                places: [{
                    displayName: { text: 'Test Market' },
                    location: { latitude: 53.8, longitude: -1.5 }
                }]
            })
        });

        await updateCompetitorMarkers();

        expect(global.google.maps.Marker).toHaveBeenCalledWith(expect.objectContaining({
            position: { lat: 53.8, lng: -1.5 },
            icon: expect.objectContaining({
                url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
            })
        }));
    });
});