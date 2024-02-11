let data = new Array();
let xScaleDomainStart = null; // Initialize x-axis start to null
let xScaleDomainEnd = null;   // Initialize x-axis end to null

function readAndPrint(file) {
    const reader = new FileReader();
    reader.onload = function () {
        const lines = this.result.split('\n');
        // Reset data and xScaleDomain for new file
        data = []; // Clear existing data
        xScaleDomainStart = null; // Reset x-axis start
        xScaleDomainEnd = null;   // Reset x-axis end
        for (let i = 1; i < lines.length - 1; i++) { // Skip first and last line
            let valueArray = lines[i].split(",");
            let time = valueArray[0]; // Time
            let model = valueArray[2]; // Model
            
            // Append 'out' or 'in' based on content
            let modifier = valueArray[valueArray.length - 2].toLowerCase().includes('out') ? 'out' : 'in';
            model = model + ' ' + modifier; 

            const linesSplitted = lines[i].trim().split('\n');
            const results = [];
            linesSplitted.forEach(line => {
                const match = line.match(/(\b\d{1,3}\b)$/); 
                if (match) {
                    results.push(match[1]); // Frequency
                }
            });
            data.push({ x: parseFloat(time), y: results, model: model, intIndex: 0, colorBoolean: true });
        }
        makeGraph(); // Call makeGraph after data is loaded and processed
    };
    reader.readAsText(file);
}

document.getElementById("myBtn").addEventListener("click", function () {
    var reader = new FileReader();
    reader.readAsText(document.querySelector('input').files[0]);
    readAndPrint(document.querySelector('input').files[0]);
});

let checkboxesCreated = false;

function makeGraph() {
    const svg = d3.select("svg"),
        width = +svg.attr("width"),
        height = +svg.attr("height");
    const tooltip = d3.select("#tooltip");
    const xOffset = 50;

    const xScale = d3.scaleLinear()
        .domain([
            xScaleDomainStart !== null ? xScaleDomainStart : d3.min(data, d => d.x), 
            xScaleDomainEnd !== null ? xScaleDomainEnd : d3.max(data, d => d.x)
        ])
        .range([xOffset, width - xOffset]);

    const groupedData = d3.group(data, d => d.model);
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    const lineThickness = 3;
    let yOffset = 100;

    const numModels = groupedData.size;
    const fixedYOffsetStep = 100; 
    const minHeight = 400; 
    let totalGraphHeight = Math.max(numModels * fixedYOffsetStep, minHeight) * (d3.max(data, d => d3.max(d.y)) > 100 ? 4 : 1);
    svg.attr("height", totalGraphHeight);

    groupedData.forEach((group, modelName) => {
        const index = data.findIndex(d => d.model === modelName);
        const maxY = d3.max(group, d => d3.max(d.y));
    	let heightMultiplier = 1; // Default height multiplier
    
    	// Determine the height multiplier based on maxY
    	if (maxY > 100) {
        	heightMultiplier = 3;
    	} else if (maxY > 10) {
       		heightMultiplier = 2;
    	}
        const yScale = d3.scaleLinear()
            .domain([0, maxY])
            .range([yOffset + fixedYOffsetStep*heightMultiplier - (data[index].intIndex * 100) - 50, yOffset - (data[index].intIndex * 100)]);

        colorBlack = data[index].colorBoolean;
        const lineGroup = svg.append("g")
            .style("display", "initial")
            .attr("model", modelName);

        const line = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y))
            .curve(d3.curveStepAfter);

        lineGroup
      .append("path")
      .datum(group)
      .attr("class", "line")
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", colorBlack ? "black" : "white") //colorScale(modelName)
      .attr("stroke-width", lineThickness)
      .attr("model", modelName);

    const yAxis = d3.axisLeft(yScale).ticks(5);
    lineGroup
      .append("g")
      .attr("transform", `translate(50,${0})`)
      .call(yAxis)
      .call(g => g.append("text")
      .attr("x", 45)
      .attr("y", yOffset - (data[index].intIndex * 100) - 10)
      .attr("fill", colorBlack ? "black" : "white")
      .attr("text-anchor", "end")
      .text(modelName));

    const yAxisLabel = lineGroup.append("g")
      .attr("transform", "rotate(-90)")
      .append("text")
	  .attr("x", heightMultiplier === 1 ? 1- yOffset + (data[index].intIndex * 100) :
       		heightMultiplier === 2 ? 1- yOffset - 50  + (data[index].intIndex * 100) :
       		1- yOffset -100 + (data[index].intIndex  * 100))
      .attr("y", 12)      // Adjust the position as needed
      .attr("fill", colorBlack ? "black" : "white")
      .attr("text-anchor", "end")
      .attr("font-size", "12px")  // Set the font size as needed
      .text("Frequency");

    const xAxisLabel = lineGroup.append("g")
      .append("text")
      .attr("x", 500) // Adjust the position as needed
      .attr("y", heightMultiplier === 1 ? 80+ yOffset - (data[index].intIndex * 100) :
      		heightMultiplier === 2 ? 80+ yOffset + 100 - (data[index].intIndex * 100) :
      		80+ yOffset + 200 - (data[index].intIndex * 100) ) // Adjust the position as needed
      .attr("fill", colorBlack ? "black" : "white")
      .attr("text-anchor", "end")
      .attr("font-size", "12px")  // Set the font size as needed
      .text("Time (seconds)");




    const xAxis = d3.axisBottom(xScale);
    lineGroup
      .append("g")
      .attr("transform", `translate(0,${yOffset + (yOffset*heightMultiplier) - data[index].intIndex - 50})`)
      .attr("fill", colorBlack ? "black" : "white")
      .call(xAxis);

        yOffset += fixedYOffsetStep * heightMultiplier;
    });

    if (!checkboxesCreated) {
        createCheckboxes(groupedData);
        checkboxesCreated = true;
    }
}

function createCheckboxes(groupedData) {
    const checkboxesDiv = document.getElementById("checkboxes");
    checkboxesDiv.innerHTML = ''; // Clear existing checkboxes
    groupedData.forEach((_, modelName) => {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `checkbox-${modelName}`;
        checkbox.checked = true;
        checkbox.addEventListener("change", () => toggleLineVisibility(modelName));

        const label = document.createElement("label");
        label.htmlFor = `checkbox-${modelName}`;
        label.textContent = modelName;

        checkboxesDiv.appendChild(checkbox);
        checkboxesDiv.appendChild(label);
    });
}

function toggleLineVisibility(modelName) {
  const checkbox = document.getElementById(`checkbox-${modelName}`);
  const lineGroup = d3.select(`g[model="${modelName}"]`);
  const index = data.findIndex(d => d.model === modelName);

  if (checkbox.checked) {
    data[index].colorBoolean = true;
    lineGroup.style("display", "initial");
    for (let i = index+1; i < data.length-1; i++) {
      if (document.getElementById(`checkbox-${data[i].model}`).checked) {
        if (data[i].intIndex>0){
          data[i].intIndex -= 1;
        }
      }
      d3.select("svg").selectAll("*").remove();

      makeGraph();
    }

  } else {
    data[index].colorBoolean = false;

    d3.select("svg").selectAll("*").remove();
    // Increment intIndex for every preceding model that is checked invisible
    for (let i = index; i < data.length; i++) {
      if (document.getElementById(`checkbox-${data[i].model}`).checked) {
        data[i].intIndex += 1;
      }
    }
    lineGroup.selectAll(".line").remove(); // Remove only the line elements in the specific lineGroup
    makeGraph();
    lineGroup.style("display", "none");

  }
}

document.getElementById("updateRange").addEventListener("click", function() {
    const xStart = parseFloat(document.getElementById("xStart").value);
    const xEnd = parseFloat(document.getElementById("xEnd").value);
    
    if (!isNaN(xStart) && !isNaN(xEnd) && xStart < xEnd) {
        xScaleDomainStart = xStart;
        xScaleDomainEnd = xEnd;
        d3.select("svg").selectAll("*").remove(); // Clear SVG content
        makeGraph(); // Redraw graph with new x-axis range
    } else {
        alert("Invalid x-axis range.");
    }
});
