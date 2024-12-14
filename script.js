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

        /////////////////////////////////////////
        // Create data for stacked bar chart
        /////////////////////////////////////////

        const allOrgs = data.map(d => d.employing_organization);
        const allUniqueOrgs = new Set(allOrgs);

        const leftOrgs = new Set(data.filter(d => d.group === "Left").map(d => d.employing_organization));
        const middleOrgs = new Set(data.filter(d => d.group === "Middle").map(d => d.employing_organization));
        const rightOrgs = new Set(data.filter(d => d.group === "Right").map(d => d.employing_organization));

        function countOrgs(orgSet) {
            let tribalCount = 0;
            let nonTribalCount = 0;
            for (let org of orgSet) {
                const row = data.find(d => d.employing_organization === org);
                if (row && row.jurisdiction_1.includes("Tribal")) {
                    tribalCount++;
                } else {
                    nonTribalCount++;
                }
            }
            return { tribalCount, nonTribalCount };
        }

        const allCount = countOrgs(allUniqueOrgs);
        const leftCount = countOrgs(leftOrgs);
        const middleCount = countOrgs(middleOrgs);
        const rightCount = countOrgs(rightOrgs);

        const barData = [
            { label: "All", tribal: allCount.tribalCount, nonTribal: allCount.nonTribalCount },
            { label: "No Post-Termination Hires", tribal: leftCount.tribalCount, nonTribal: leftCount.nonTribalCount },
            { label: "Hired Officers with Single Termination on Record", tribal: middleCount.tribalCount, nonTribal: middleCount.nonTribalCount },
            { label: "Hired Officers with Multiple Terminations on Record", tribal: rightCount.tribalCount, nonTribal: rightCount.nonTribalCount }
        ];

        const maxTotal = d3.max(barData, d => d.tribal + d.nonTribal);

        /////////////////////////////////////////
        // Draw stacked bar chart
        /////////////////////////////////////////

        const barChartWidth = 800;
        const barChartHeight = 200;
        // Set margins: 10px top/bottom, 5px left/right
        const barMargin = { top: 10, right: 5, bottom: 10, left: 5 };

        const innerWidth = barChartWidth - barMargin.left - barMargin.right;
        const innerHeight = barChartHeight - barMargin.top - barMargin.bottom;

        const barSvg = d3.select("#stacked-bar-chart")
            .attr("viewBox", `0 0 ${barChartWidth} ${barChartHeight}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .style("width", "100%")
            .style("height", "auto");

        const barChartG = barSvg.append("g")
            .attr("transform", `translate(${barMargin.left}, ${barMargin.top})`);

        const domainMax = maxTotal * 1.2;

        const xScale = d3.scaleLinear()
            .domain([0, domainMax])
            .range([0, innerWidth]);

        const yScale = d3.scaleBand()
            .domain(barData.map(d => d.label))
            .range([0, innerHeight])
            .padding(0.3);

        // Axes
        barChartG.append("g")
            .attr("class", "bar-x-axis")
            .attr("transform", `translate(0, ${innerHeight})`)
            .call(d3.axisBottom(xScale).ticks(5));

        barChartG.append("g")
            .attr("class", "bar-y-axis")
            .call(d3.axisLeft(yScale));

        // Draw bars
        barChartG.selectAll(".bar-group")
            .data(barData)
            .enter()
            .append("g")
            .attr("class", "bar-group")
            .attr("transform", d => `translate(0, ${yScale(d.label)})`)
            .each(function(d) {
                const g = d3.select(this);
                const total = d.tribal + d.nonTribal;

                // Tribal segment
                g.append("rect")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("height", yScale.bandwidth())
                    .attr("width", xScale(d.tribal))
                    .attr("fill", "orange")
                    .attr("stroke", "black");

                // NonTribal segment
                g.append("rect")
                    .attr("x", xScale(d.tribal))
                    .attr("y", 0)
                    .attr("height", yScale.bandwidth())
                    .attr("width", xScale(d.nonTribal))
                    .attr("fill", "steelblue")
                    .attr("stroke", "black");

                // Percentage label
                const tribalPercentage = (d.tribal / total) * 100;
                const labelX = xScale(total) + 5;
                g.append("text")
                    .attr("x", labelX)
                    .attr("y", yScale.bandwidth() / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "start")
                    .style("font-size", "12px")
                    .style("fill", "black")
                    .text(tribalPercentage.toFixed(1) + "%");
            });

        // Existing code for circles
        const radiusScale = d3.scaleLinear()
            .domain([d3.min(data, d => d.unique_officers), d3.max(data, d => d.unique_officers)])
            .range([3, 50]);

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

        let currentTooltip = null;
        let currentCircle = null;

        function drawGroup(groupData, svgId, jurisdiction) {
            const svgContainer = d3.select(`#${svgId}`);
            const containerWidth = parseFloat(svgContainer.style("width"));
            const containerHeight = parseFloat(svgContainer.style("height"));

            svgContainer.selectAll("*").remove();

            const svg = svgContainer
                .append("svg")
                .attr("width", containerWidth)
                .attr("height", containerHeight);

            const centerX = containerWidth / 2;
            const centerY = containerHeight / 2;
            const maxRadius = Math.min(containerWidth, containerHeight) / 2 - 40;

            const textBufferRadius = 120;

            if (jurisdiction === "All Jurisdictions") {
                const tribalCount = groupData.filter(d => d.is_tribal_lea === "Y").length;
                const percentage = (tribalCount / groupData.length * 100).toFixed(0);

                const textPart1 = "Tribal Police Departments as Percentage of Group: ";
                const wrappedText = wrapText(textPart1, 25);

                wrappedText.forEach((line, index) => {
                    svg.append("text")
                        .attr("x", centerX)
                        .attr("y", centerY + (index * 20) - 30)
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .attr("font-size", "14px")
                        .attr("fill", "black")
                        .text(line);
                });

                svg.append("text")
                    .attr("x", centerX)
                    .attr("y", centerY + (wrappedText.length * 20) - 30)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("font-size", "14px")
                    .attr("font-weight", "bold")
                    .attr("fill", "black")
                    .text(`${percentage}%`);
            }

            const simulation = d3.forceSimulation(groupData)
                .force("center", d3.forceCenter(centerX, centerY).strength(0.5))
                .force("collide", d3.forceCollide(d => radiusScale(d.unique_officers) + 6))
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
                    const buffer = 20;
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
                        if (jurisdiction === "All Jurisdictions") {
                            return d.jurisdiction_1 === "Tribal" || d.jurisdiction_2 === "Tribal" || d.jurisdiction_3 === "Tribal" ? "orange" : "lightgray";
                        } else if (jurisdiction === "Tribal") {
                            return d.jurisdiction_1 === "Tribal" || d.jurisdiction_2 === "Tribal" || d.jurisdiction_3 === "Tribal" ? "orange" : "lightgray";
                        } else {
                            if (d.jurisdiction_1 === "Tribal" && (d.jurisdiction_2 === jurisdiction || d.jurisdiction_3 === jurisdiction)) {
                                return "orange";
                            } else if (d.jurisdiction_1 === jurisdiction || d.jurisdiction_2 === jurisdiction || d.jurisdiction_3 === jurisdiction) {
                                return "steelblue";
                            } else {
                                return "lightgray";
                            }
                        }
                    }
                })
                .attr("stroke", "black")
                .attr("stroke-width", 0)
                .attr("pointer-events", "visible")
                .on("mouseover", (event, d) => {
                    if (currentTooltip === null) {
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
                    }
                })
                .on("mouseout", () => {
                    if (currentTooltip === null) {
                        d3.select("#tooltip").style("display", "none");
                    }
                })
                .on("click", (event, d) => {
                    if (currentCircle === d) {
                        currentTooltip.style("display", "none");
                        currentTooltip = null;
                        currentCircle = null;
                    } else {
                        if (currentTooltip !== null) {
                            currentTooltip.style("display", "none");
                        }

                        currentTooltip = d3.select("#tooltip")
                            .style("display", "block")
                            .style("left", (event.pageX + 15) + "px")
                            .style("top", (event.pageY - 28) + "px")
                            .html(`
                                <strong>Organization:</strong> ${d.employing_organization}<br/>
                                <strong>Unique Officers:</strong> ${d.unique_officers}<br/>
                                <strong>Hired After Termination:</strong> ${d.officers_hired_after_termination}<br/>
                                <strong>Fired Twice or More:</strong> ${d.fired_twice_or_more_count}
                            `);
                        currentCircle = d;
                    }
                });

            svg.on("click", (event) => {
                if (event.target.tagName !== "circle" && currentTooltip !== null) {
                    currentTooltip.style("display", "none");
                    currentTooltip = null;
                    currentCircle = null;
                }
            });

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
