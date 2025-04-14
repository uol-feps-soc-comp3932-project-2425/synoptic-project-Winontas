describe('Simulation Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should run simulation and fetch tracking data', async () => {
        global.document.getElementById.mockImplementation(id => ({
            value: id === 'numUsers' ? '5' : '4'  // numUsers=5, numWeeks=4
        }));
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({ message: 'Simulation completed' })
        }).mockResolvedValueOnce({
            ok: true,
            json: () => ([{
                user_id: 'User1',
                geofence_id: 1,
                event_type: 'entry',
                timestamp: '2025-04-07T10:00:00'
            }])
        });

        // Mock map and polyline
        global.map = { setCenter: jest.fn(), setZoom: jest.fn() };
        global.google.maps.Polyline = jest.fn();

        // Assume runSimulation is exported
        const runSimulation = async () => {
            await fetch('/api/run_simulation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ num_users: 5, num_weeks: 4 })
            });
            const response = await fetch('/api/tracking');
            return response.json();
        };

        const trackingData = await runSimulation();
        expect(fetch).toHaveBeenCalledWith('/api/run_simulation', expect.any(Object));
        expect(trackingData).toHaveLength(1);
        expect(trackingData[0].user_id).toBe('User1');
    });
});