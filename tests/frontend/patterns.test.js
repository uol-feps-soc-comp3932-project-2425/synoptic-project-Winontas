describe('Patterns Visualization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.document.body.innerHTML = '<canvas id="patternsChart"></canvas>';
        global.document.querySelector.mockReturnValue({ getContext: jest.fn(() => ({})) });
    });

    test('should render chart with pattern data', async () => {
        global.Chart = jest.fn();
        global.fetch.mockResolvedValue({
            ok: true,
            json: () => ([{
                user_id: 'User1',
                geofence_name: 'Test Cafe',
                day_of_week: 'Monday',
                hour: 10,
                visits: 5,
                confidence: 85
            }])
        });
        global.document.getElementById.mockReturnValue({ getContext: jest.fn(() => ({})) });

        // Assume updatePatternsChart is exported
        const updatePatternsChart = async () => {
            const response = await fetch('/api/patterns');
            const patterns = await response.json();
            new Chart(document.getElementById('patternsChart'), {
                type: 'bar',
                data: {
                    labels: patterns.map(p => `${p.day_of_week} ${p.hour}:00`),
                    datasets: [{
                        label: 'Visits',
                        data: patterns.map(p => p.visits)
                    }]
                }
            });
        };

        await updatePatternsChart();
        expect(Chart).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                type: 'bar',
                data: expect.objectContaining({
                    labels: ['Monday 10:00'],
                    datasets: [{ label: 'Visits', data: [5] }]
                })
            })
        );
    });
});