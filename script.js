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
            .range([2, 40]);

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
            const svgContainer = d3.select(`#${svgId}`);
            const containerWidth = parseFloat(svgContainer.style("width"));
            const containerHeight = parseFloat(svgContainer.style("height"));
        
            svgContainer.selectAll("*").remove(); // Clear existing elements
        
            const svg = svgContainer
                .append("svg")
                .attr("width", containerWidth)
                .attr("height", containerHeight);
        
            const centerX = containerWidth / 2;
            const centerY = containerHeight / 2;
            const maxRadius = Math.min(containerWidth, containerHeight) / 2 - 20; // Adjust for padding
        
            const textBufferRadius = 80; // Adjust based on text size and spacing
        
            const simulation = d3.forceSimulation(groupData)
                .force("center", d3.forceCenter(centerX, centerY).strength(0.5))
                .force("collide", d3.forceCollide(d => radiusScale(d.unique_officers) + 4)) // Adjust spacing
                .force("radial", d3.forceRadial(maxRadius * 0.6, centerX, centerY).strength(0.3))
                .force("textBuffer", () => {
                    groupData.forEach(d => {
                        const dx = d.x - centerX;
                        const dy = d.y - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const minDistance = textBufferRadius + radiusScale(d.unique_officers);
        
                        if (distance < minDistance) {
                            const angle = Math.atan2(dy, dx);
                            d.x = centerX + Math.cos(angle) * minDistance;
                            d.y = centerY + Math.sin(angle) * minDistance;
                        }
                    });
                })
                .force("bounding", () => {
                    const buffer = 20; // Invisible buffer around the edge (adjust as needed)
                    groupData.forEach(d => {
                        const r = radiusScale(d.unique_officers);
                        d.x = Math.max(r + buffer, Math.min(containerWidth - r - buffer, d.x));
                        d.y = Math.max(r + buffer, Math.min(containerHeight - r - buffer, d.y));
                    });
                });
        
            const group = svg.append("g");
        
            group.selectAll("circle")
                .data(groupData)
                .enter()
                .append("circle")
                .attr("r", d => radiusScale(d.unique_officers))
                .attr("fill", d => {
                    if (jurisdiction === "Tribal") {
                        return d.is_tribal_lea === "Y" ? "orange" : "lightgray";
                    } else if (jurisdiction === "All Jurisdictions") {
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
        
                if (jurisdiction === "All Jurisdictions") {
                    const tribalCount = groupData.filter(d => d.is_tribal_lea === "Y").length;
                    const percentage = (tribalCount / groupData.length * 100).toFixed(0);
                
                    // Define the non-bold and bold parts
                    const textPart1 = "Tribal Police Departments as Percentage of Group: ";
                    const textPart2 = `${percentage}%`;
                
                    // Combine the non-bold text (textPart1) and wrap it
                    const wrappedText = wrapText(textPart1, 20); // Wrap only textPart1
                
                    wrappedText.forEach((line, index) => {
                        // Append the non-bold portion
                        svg.append("text")
                            .attr("x", centerX)
                            .attr("y", centerY + (index * 15) - 20)
                            .attr("text-anchor", "middle")
                            .attr("dominant-baseline", "middle")
                            .attr("font-size", "14px")
                            .attr("fill", "black")
                            .text(line);
                    });
                
                    // Center the bold percentage (textPart2) relative to the container
                    svg.append("text")
                        .attr("x", centerX) // Center it horizontally in the container
                        .attr("y", centerY + (wrappedText.length * 15) - 20) // Position it below the wrapped text
                        .attr("text-anchor", "middle") // Align to the middle horizontally
                        .attr("dominant-baseline", "middle")
                        .attr("font-size", "14px")
                        .attr("font-weight", "bold")  // Make the percentage bold
                        .attr("fill", "black")
                        .text(textPart2);
                }
                
        
            simulation.on("tick", function () {
                group.selectAll("circle")
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y);
            });
        }

        let currentJurisdiction = "All Jurisdictions";

        const drawAllGroups = () => {
            drawGroup(data.filter(d => d.group === "Left"), "chart-left", currentJurisdiction);
            drawGroup(data.filter(d => d.group === "Middle"), "chart-middle", currentJurisdiction);
            drawGroup(data.filter(d => d.group === "Right"), "chart-right", currentJurisdiction);
        };

        drawAllGroups();

        d3.select("#jurisdiction-select").on("change", function () {
            currentJurisdiction = d3.select(this).property("value");
            drawAllGroups();
        });
    }).catch(error => {
        console.error("Error loading the CSV file:", error);
    });
});
