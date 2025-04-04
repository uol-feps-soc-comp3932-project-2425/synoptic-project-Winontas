let simulationResults = [];
let chartInstance = null;
let chartUpdatePending = false; // Flag to debounce updates

function initPatterns() {
    console.log("Initializing patterns page...");
    fetch('/api/run_simulation_results')
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch simulation results: ${response.status}`);
            return response.json();
        })
        .then(data => {
            simulationResults = data.triggers || [];
            console.log("Simulation results loaded:", simulationResults.length);
            updateFilterOptions();
            displayResults(simulationResults);
            updatePatternChart(simulationResults);
        })
        .catch(error => console.error("Error loading simulation results:", error));

    document.getElementById("filterType").addEventListener("change", updateFilterOptions);
    document.getElementById("filterValue").addEventListener("change", filterResults);
}

function updateFilterOptions() {
    const filterType = document.getElementById("filterType").value;
    const filterValue = document.getElementById("filterValue");
    filterValue.innerHTML = '<option value="all">All</option>';
    filterValue.disabled = filterType === "all";

    if (filterType === "user") {
        const users = [...new Set(simulationResults.map(r => r.user_name))];
        users.forEach(user => {
            const option = document.createElement("option");
            option.value = user;
            option.text = user;
            filterValue.appendChild(option);
        });
    } else if (filterType === "geofence") {
        const geofences = [...new Set(simulationResults.map(r => r.geofence_name))];
        geofences.forEach(geofence => {
            const option = document.createElement("option");
            option.value = geofence;
            option.text = geofence;
            filterValue.appendChild(option);
        });
    }
    filterResults();
}

function filterResults() {
    const filterType = document.getElementById("filterType").value;
    const filterValue = document.getElementById("filterValue").value;
    let filteredResults = simulationResults;

    if (filterType === "user" && filterValue !== "all") {
        filteredResults = simulationResults.filter(r => r.user_name === filterValue);
    } else if (filterType === "geofence" && filterValue !== "all") {
        filteredResults = simulationResults.filter(r => r.geofence_name === filterValue);
    }

    displayResults(filteredResults);
    updatePatternChart(filteredResults);
}

function displayResults(results) {
    const resultsDiv = document.getElementById("simulationResults");
    if (!resultsDiv) {
        console.error("Simulation results div not found!");
        return;
    }
    resultsDiv.innerHTML = "";
    results.forEach(trigger => {
        const div = document.createElement("div");
        div.className = "p-2 bg-gray-50 rounded-md text-sm";
        div.innerHTML = `${trigger.user_name} ${trigger.event_type} ${trigger.geofence_name} at ${new Date(trigger.timestamp).toLocaleString()}`;
        resultsDiv.appendChild(div);
    });
    console.log("Displayed results:", results.length);
}

async function updatePatternChart(results) {
    if (chartUpdatePending) {
        console.log("Chart update already in progress, skipping...");
        return;
    }
    chartUpdatePending = true;

    const canvas = document.getElementById("patternChart");
    if (!canvas) {
        console.error("Canvas element not found!");
        chartUpdatePending = false;
        return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("Failed to get 2D context from canvas!");
        chartUpdatePending = false;
        return;
    }

    // Destroy existing chart instance if it exists
    if (chartInstance && typeof chartInstance.destroy === 'function') {
        console.log("Destroying existing chart instance...");
        chartInstance.destroy();
        chartInstance = null;
    }

    try {
        const response = await fetch('/api/patterns');
        if (!response.ok) throw new Error(`Failed to fetch patterns: ${response.status}`);
        let patterns = await response.json();
        console.log("Patterns loaded:", patterns);

        const filteredUserIds = [...new Set(results.map(r => r.user_id))];
        const filteredGeofenceIds = [...new Set(results.map(r => r.geofence_id))];
        patterns = patterns.filter(p => 
            filteredUserIds.includes(p.user_id) && filteredGeofenceIds.includes(p.geofence_id)
        );
        console.log("Filtered patterns:", patterns.length);

        const filterType = document.getElementById("filterType").value;
        const filterValue = document.getElementById("filterValue").value;

        if (filterType === "all") {
            // Aggregated bar chart by day of week
            const dayCounts = {};
            const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
            days.forEach(day => dayCounts[day] = 0);
            patterns.forEach(p => {
                dayCounts[p.day_of_week] += p.visit_count;
            });

            chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: days,
                    datasets: [{
                        label: 'Total Visits',
                        data: days.map(day => dayCounts[day]),
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Total Visits' } },
                        x: { title: { display: true, text: 'Day of Week' } }
                    },
                    plugins: { legend: { display: false } },
                    barThickness: 40,
                    maintainAspectRatio: false
                }
            });
        } else if (filterType === "user" && filterValue !== "all" && patterns.length === 0) {
            chartInstance = new Chart(ctx, {
                type: 'bar',
                data: { labels: [], datasets: [] },
                options: {
                    plugins: {
                        title: {
                            display: true,
                            text: `No patterns found for ${filterValue}`,
                            font: { size: 18 },
                            color: '#666'
                        },
                        legend: { display: false }
                    },
                    scales: { x: { display: false }, y: { display: false } }
                }
            });
        } else if (patterns.length === 0) {
            chartInstance = new Chart(ctx, {
                type: 'bar',
                data: { labels: [], datasets: [] },
                options: {
                    plugins: {
                        title: {
                            display: true,
                            text: 'No patterns detected',
                            font: { size: 18 },
                            color: '#666'
                        },
                        legend: { display: false }
                    },
                    scales: { x: { display: false }, y: { display: false } }
                }
            });
        } else {
            // Detailed bar chart for filtered view
            chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: patterns.map(p => `${p.user_name} - ${p.geofence_name} (${p.day_of_week} ${p.hour}:${String(p.minute).padStart(2, '0')} - ${p.confidence}%)`),
                    datasets: [{
                        label: 'Visit Count',
                        data: patterns.map(p => p.visit_count),
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Visits' } },
                        x: { title: { display: true, text: 'Patterns (Confidence %)' } }
                    },
                    plugins: { legend: { display: false } },
                    barThickness: 20,
                    maintainAspectRatio: false
                }
            });
        }
        console.log("Chart initialized successfully with type:", chartInstance.config.type);
    } catch (error) {
        console.error("Error updating chart:", error);
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ["Error"],
                datasets: [{
                    label: 'Error',
                    data: [1],
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    title: { display: true, text: 'Chart rendering failed' },
                    legend: { display: false }
                }
            }
        });
    } finally {
        chartUpdatePending = false; // Reset flag after completion
    }
}

window.onload = initPatterns;