/**
 * patterns.js: Displays and visualises user behaviour patterns from simulation results.
 * Uses Chart.js to render bar charts of pattern confidence scores and supports filtering by user or geofence.
 * Integrates with the backend to fetch pattern data for analysis.
 */

let simulationResults = [];
let chartInstance = null;
let chartUpdatePending = false; // Prevents concurrent chart updates

// -----------------------------
// Section 1: Initialisation
// -----------------------------
// Sets up the patterns page with event listeners and initial data loading.

function initPatterns() {
    /** Initialises the patterns page, loading simulation results and setting up filters. */
    console.log("Initialising patterns page...");
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

    // Bind filter controls
    document.getElementById("filterType").addEventListener("change", updateFilterOptions);
    document.getElementById("filterValue").addEventListener("change", filterResults);
}

// -----------------------------
// Section 2: Filtering
// -----------------------------
// Manages filter options and applies filters to display relevant patterns.

function updateFilterOptions() {
    /** Populates filter dropdowns based on selected filter type (user or geofence). */
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
    /** Filters simulation results based on selected type and value, updating UI and chart. */
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

// -----------------------------
// Section 3: Visualisation
// -----------------------------
// Displays simulation results as text and visualises patterns using Chart.js bar charts.

function displayResults(results) {
    /** Displays filtered simulation results as a text list in the UI. */
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
    /** Renders a bar chart of pattern confidence scores, showing all user-geofence patterns. */
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

    // Destroy existing chart
    if (chartInstance && typeof chartInstance.destroy === 'function') {
        console.log("Destroying existing chart instance...");
        chartInstance.destroy();
        chartInstance = null;
    }

    try {
        // Fetch patterns from backend
        const response = await fetch('/api/patterns');
        if (!response.ok) throw new Error(`Failed to fetch patterns: ${response.status}`);
        let patterns = await response.json();
        console.log("Patterns loaded:", patterns);

        // Filter patterns based on results
        const filterType = document.getElementById("filterType").value;
        const filterValue = document.getElementById("filterValue").value;

        if (filterType === "user" && filterValue !== "all") {
            patterns = patterns.filter(p => p.user_name === filterValue);
        } else if (filterType === "geofence" && filterValue !== "all") {
            patterns = patterns.filter(p => p.geofence_name === filterValue);
        } else {
            const filteredUserIds = [...new Set(results.map(r => r.user_id))];
            patterns = patterns.filter(p => filteredUserIds.includes(p.user_id));
        }

        // Skip patterns with invalid confidence
        patterns = patterns.filter(p => {
            if (p.confidence <= 0) {
                console.log(`Skipping invalid pattern: ${p.user_name} at ${p.geofence_name}, confidence=${p.confidence}`);
                return false;
            }
            return true;
        });

        console.log("Filtered patterns:", patterns);

        if (patterns.length === 0) {
            chartInstance = new Chart(ctx, {
                type: 'bar',
                data: { labels: [], datasets: [] },
                options: {
                    plugins: {
                        title: {
                            display: true,
                            text: `No valid patterns found${filterValue !== 'all' ? ` for ${filterValue}` : ''}`,
                            font: { size: 18 },
                            color: '#666'
                        },
                        legend: { display: false }
                    },
                    scales: { x: { display: false }, y: { display: false } }
                }
            });
        } else {
            const labels = patterns.map(p => 
                `${p.user_name} - ${p.geofence_name} (${p.day_of_week} ${p.hour}:${String(p.minute).padStart(2, '0')})`
            );
            const confidences = patterns.map(p => p.confidence);

            // Assign colours based on user_id
            const userIds = [...new Set(patterns.map(p => p.user_id))];
            const colourPalette = [
                'rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)',
                'rgba(255, 206, 86, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)',
                'rgba(0, 128, 0, 0.6)', 'rgba(128, 0, 128, 0.6)', 'rgba(199, 21, 133, 0.6)',
                'rgba(100, 149, 237, 0.6)'
            ];
            const userColours = {};
            userIds.forEach((userId, index) => {
                userColours[userId] = colourPalette[index % colourPalette.length];
            });
            const backgroundColours = patterns.map(p => userColours[p.user_id]);
            const borderColours = backgroundColours.map(colour => colour.replace('0.6', '1'));

            chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Confidence (%)',
                        data: confidences,
                        backgroundColor: backgroundColours,
                        borderColor: borderColours,
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: { 
                            beginAtZero: true, 
                            max: 100,
                            title: { display: true, text: 'Confidence (%)', font: { size: 20 } },
                            ticks: { font: { size: 16 } }
                        },
                        x: { 
                            title: { display: true, text: 'Pattern', font: { size: 20 } },
                            ticks: { font: { size: 12 }, maxRotation: 45, minRotation: 45, autoSkip: false }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        title: { 
                            display: true, 
                            text: `Pattern Confidence for ${filterValue !== 'all' ? filterValue : 'All Patterns'}`, 
                            font: { size: 24 } 
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const pattern = patterns[context.dataIndex];
                                    return `${pattern.user_name} at ${pattern.geofence_name} (${pattern.day_of_week} ${pattern.hour}:${String(pattern.minute).padStart(2, '0')}): ${pattern.confidence.toFixed(2)}%`;
                                }
                            }
                        }
                    },
                    barThickness: 15,
                    maintainAspectRatio: false
                }
            });
        }
        console.log("Chart initialised successfully with type:", chartInstance.config.type);
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
                    title: { display: true, text: 'Chart rendering failed', font: { size: 18 } },
                    legend: { display: false }
                }
            }
        });
    } finally {
        chartUpdatePending = false;
    }
}

window.onload = initPatterns;