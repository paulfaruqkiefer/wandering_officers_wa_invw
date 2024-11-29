document.addEventListener("DOMContentLoaded", function () {
    d3.csv("filtered_agency_hired_post_termination.csv").then(data => {
        // Parse and process data
        data.forEach(d => {
            d.unique_officers = +d.unique_officers;
            d.officers_hired_after_termination = +d.officers_hired_after_termination;
            d.fired_twice_or_more_count = +d.fired_twice_or_more_count;

            // Assign group based on conditions
            if (d.officers_hired_after_termination > 0 && d.fired_twice_or_more_count === 0) {
                d.group = "Middle";
            } else if (d.officers_hired_after_termination > 0 && d.fired_twice_or_more_count > 0) {
                d.group = "Right";
            } else {
                d.group = "Left";
            }
        });

        // Scale for circle radii
        const radiusScale = d3.scaleLinear()
            .domain([d3.min(data, d => d.unique_officers), d3.max(data, d => d.unique_officers)])
            .range([5, 20]);

        // Function to wrap text into multiple lines
        function wrapText(text, width) {
            const words = text.split(" ");
            let lines = [];
            let currentLine = "";

            words.forEach(word => {
                const testLine = currentLine ? currentLine + " " + word : word;
                if (testLine.length > width) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            });

            lines.push(currentLine);
            return lines;
        }

        // Function to draw circles for a group
        function drawGroup(groupData, svgId, jurisdiction) {
            const svg = d3.select(`#${svgId}`);
            svg.selectAll("*").remove(); // Clear existing elements

            const width = 400;
            const height = 400;

            svg.attr("width", width).attr("height", height);

            const simulation = d3.forceSimulation(groupData)
                .force("center", d3.forceCenter(width / 2, height / 2))
                .force("collide", d3.forceCollide(d => radiusScale(d.unique_officers) + 2))
                .force("charge", d3.forceManyBody().strength(-10))
                .force("gravity", d3.forceRadial(100, width / 2, height / 2).strength(0.1));

            const group = svg.append("g");

            group.selectAll("circle")
                .data(groupData)
                .enter()
                .append("circle")
                .attr("r", d => radiusScale(d.unique_officers))
                .attr("fill", d => {
                    // Highlight based on selected jurisdiction
                    if (jurisdiction === "All Jurisdictions") {
                        return d.is_tribal_lea === "Y" ? "orange" : "steelblue";
                    } else {
                        return (
                            d.jurisdiction_1 === jurisdiction ||
                            d.jurisdiction_2 === jurisdiction ||
                            d.jurisdiction_3 === jurisdiction
                        ) ? "steelblue" : "lightgray";
                    }
                })
                .attr("stroke", "black")
                .attr("stroke-width", 0)
                .on("mouseover", (event, d) => {
                    d3.select("#tooltip")
                        .style("display", "block")
                        .style("left", (event.pageX + 15) + "px")
                        .style("top", (event.pageY - 28) + "px")
                        .html(`
                            <strong>Organization:</strong> ${d.employing_organization}<br/>
                            <strong>Unique Officers:</strong> ${d.unique_officers}<br/>
                            <strong>Hired After Termination:</strong> ${d.officers_hired_after_termination}<br/>
                            <strong>Fired Twice or More:</strong> ${d.fired_twice_or_more_count}
                        `);
                })
                .on("mouseout", () => {
                    d3.select("#tooltip").style("display", "none");
                });

            // Show comparison text only for "All Jurisdictions"
            if (jurisdiction === "All Jurisdictions") {
                const tribalCount = groupData.filter(d => d.is_tribal_lea === "Y").length;
                const percentage = (tribalCount / groupData.length * 100).toFixed(2);
                const textContent = `Tribal Police Departments as Percentage of Group: ${percentage}%`;

                const wrappedText = wrapText(textContent, 20);

                wrappedText.forEach((line, index) => {
                    svg.append("text")
                        .attr("x", width / 2)
                        .attr("y", height / 2 + (index * 15) - 20)
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .attr("font-size", "12px")
                        .attr("font-weight", "bold")
                        .attr("fill", "black")
                        .text(line);
                });
            }

            simulation.on("tick", function () {
                group.selectAll("circle")
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y);
            });
        }

        // Initial Render
        let currentJurisdiction = "All Jurisdictions";

        const drawAllGroups = () => {
            drawGroup(data.filter(d => d.group === "Left"), "chart-left", currentJurisdiction);
            drawGroup(data.filter(d => d.group === "Middle"), "chart-middle", currentJurisdiction);
            drawGroup(data.filter(d => d.group === "Right"), "chart-right", currentJurisdiction);
        };

        drawAllGroups();

        // Dropdown listener for jurisdiction filtering
        d3.select("#jurisdiction-select").on("change", function () {
            currentJurisdiction = d3.select(this).property("value");
            drawAllGroups();
        });
    }).catch(error => {
        console.error("Error loading the CSV file:", error);
    });
});
