let veryTopModel;
let indentedChildren;
let realIndentedChildren;
let indentedChildrensTopNode;
let data = new Array();
var globalModel = JSON.parse(localStorage.getItem('globalModel')) || [];
for (let i = 0; i < globalModel.length; i++) {
  console.log(globalModel.top_model[i]);
}

let currentYOffset = 100;
const fixedYOffsetStep = 100; // Keep this as a constant

window.addEventListener('message', function (event) {
  console.log('Received data:', event.data);
  updateCheckboxesBasedOnSelection(event.data);

});


function readAndPrint(file) {
  const reader = new FileReader();
  reader.onload = function () {
    const lines = this.result.split('\n');
    for (let i = 1; i < lines.length - 1; i++) { //skip first line and last line
      let valueArray = lines[i].split(",");
      let time = valueArray[0]; //time
      let model = valueArray[2]; //model

      //appends out or in depending on if the word before last comma had 'out' or not
      let modifier = valueArray[valueArray.length - 2].toLowerCase().includes('out') ? 'out' : 'in';
      model = model + ' ' + modifier;

      const linesSplitted = lines[i].trim().split('\n');
      const results = [];
      linesSplitted.forEach(line => {
        const match = line.match(/(\b\d{1,3}\b)$/);
        if (match) {
          results.push(match[1]); //frequency
        }
      });
      data.push({ x: parseFloat(time), y: results, model: model, intIndex: 0, colorBoolean: true });
    }

  };

  reader.readAsText(file);
}
document.getElementById("myBtn").addEventListener("click", function () {

  var reader = new FileReader();

  reader.readAsText(document.querySelector('input').files[0]);
  readAndPrint(document.querySelector('input').files[0]);

  setTimeout(function () {
    makeGraph();
  }, 1000);
});


let hierarchyMap = {};

function updateCheckboxesBasedOnSelection(selectedModel) {
  const allCheckboxes = document.querySelectorAll('#checkboxes input[type="checkbox"]');

  let keys;
  if (Array(globalModel)[0].top_model[selectedModel] != null) {
    keys = Object.keys(Array(globalModel)[0].top_model[selectedModel]);
  } else {
    keys = [];
  }

  allCheckboxes.forEach(checkbox => {
    const checkboxModelName = checkbox.id.split('-')[1];
    let checkboxModelNameBeforeSpace = checkboxModelName.split(" ")[0];
    if (checkboxModelName.startsWith(selectedModel)) {

      checkbox.checked = true;
    }
    else if (selectedModel === "top_model") {
      allCheckboxes.forEach(checkbox => checkbox.checked = true);
    }

    else if (keys.includes(checkboxModelNameBeforeSpace)) {
      checkbox.checked = true;
    }
    else {
      checkbox.checked = false;
    }

    toggleLineVisibility(checkboxModelName);
  });
}



function makeGraph() {
  const svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");
  const tooltip = d3.select("#tooltip");
  const xOffset = 50;

  const xScale = d3.scaleLinear()
    .domain([d3.min(data, d => d.x), d3.max(data, d => d.x)])
    .range([xOffset, width - xOffset]);

  // Group the data by model name
  const groupedData = d3.group(data, d => d.model);

  const sortedGroupedData = new Map([...groupedData.entries()].sort((a, b) => a[0].localeCompare(b[0])));

  // Give each model a unique colour
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
  const lineThickness = 3;
  let yOffset = 100;

  //set height of graph based on number of models
  const numModels = sortedGroupedData.size;
  const fixedYOffsetStep = 100; //space between graphs
  const totalGraphHeight = (numModels * fixedYOffsetStep) + 200;
  svg.attr("height", totalGraphHeight);

  // Create checkboxes for each model
  const checkboxesDiv = document.getElementById("checkboxes");
  sortedGroupedData.forEach((group, modelName) => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `checkbox-${modelName}`;
    checkbox.checked = true; // Initially, all lines are visible
    checkbox.addEventListener("change", () => toggleLineVisibility(modelName));

    const label = document.createElement("label");
    label.htmlFor = `checkbox-${modelName}`;
    label.appendChild(document.createTextNode(modelName));

    checkboxesDiv.appendChild(checkbox);
    checkboxesDiv.appendChild(label);
  });


  // Use to keep track of x, y coords for each model (each group)
  const modelToCoordMap = {};

  const lineGroups = {};

  sortedGroupedData.forEach((group, modelName) => {
    const index = data.findIndex(d => d.model === modelName);
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(group, d => d.y)])
      .range([yOffset + fixedYOffsetStep - (data[index].intIndex * 100) - 50, yOffset - (data[index].intIndex * 100)]);

    // Create a new lineGroup for each model
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
      .attr("stroke", colorScale(modelName))
      .attr("stroke-width", lineThickness)
      .attr("model", modelName)
      .on("mouseover", function (event) {
        updateTooltip(event, modelName, xScale, modelToCoordMap);
      })
      .on("mousemove", function (event) {
        updateTooltip(event, modelName, xScale, modelToCoordMap);
      })
      .on("mouseout", function () {
        tooltip.style("visibility", "hidden");
      });

    const yAxis = d3.axisLeft(yScale).ticks(5);
    lineGroup
      .append("g")
      .attr("transform", `translate(50,${0})`)
      .call(yAxis)
      .call(g => g.append("text")
        .attr("x", 45)
        .attr("y", yOffset - 10)
        .attr("fill", "currentColor")
        .attr("text-anchor", "end")
        .text(modelName));

    const yAxisLabel = lineGroup.append("g")
      .attr("transform", "rotate(-90)")
      .append("text")
      .attr("x", 1 - yOffset + (data[index].intIndex * 100)) // Adjust the position as needed
      .attr("y", 12)      // Adjust the position as needed
      .attr("fill", colorBlack ? "black" : "white")
      .attr("text-anchor", "end")
      .attr("font-size", "12px")  // Set the font size as needed
      .text("Frequency");

    const xAxisLabel = lineGroup.append("g")
      .append("text")
      .attr("x", 500) // Adjust the position as needed
      .attr("y", 80 + yOffset - (data[index].intIndex * 100))  // Adjust the position as needed
      .attr("fill", colorBlack ? "black" : "white")
      .attr("text-anchor", "end")
      .attr("font-size", "12px")  // Set the font size as needed
      .text("Time (seconds)");




    const xAxis = d3.axisBottom(xScale);
    lineGroup
      .append("g")
      .attr("transform", `translate(0,${yOffset + fixedYOffsetStep - data[index].intIndex - 50})`)
      .attr("fill", colorBlack ? "black" : "white")
      .call(xAxis);
    // Store the lineGroup in the lineGroups object
    lineGroups[modelName] = lineGroup;

    // Increment the yOffset
    yOffset += fixedYOffsetStep;

    modelToCoordMap[modelName] = createCoordMapping(group);
  });

  //Create X axis
  svg.append("g")
    .attr("transform", `translate(0,${height - 50})`)
    .call(d3.axisBottom(xScale));

  function updateTooltip(event, modelName, xScale, modelToCoordMap) {
    const xValue = xScale.invert(event.offsetX);
    tooltip.style("visibility", "visible")
      .html("Model: " + modelName + "<br>X: " + xValue.toFixed(2) + "<br>Y: " + getYCoordFromX(xValue, modelToCoordMap[modelName]))
      .style("top", (event.pageY - 10) + "px")
      .style("left", (event.pageX + 10) + "px");
  }
}

// Makes a map which we can reference to find the Y value of a model given its X coordinate
// Since we're piece-wise we use this later by using the largest x value in the map less
// than or equal to the x coord we want the y for
function createCoordMapping(groupData) {
  const map = {};
  map[0] = 0;

  for (let i = 0; i < groupData.length; i++) {
    const xValue = groupData[i].x;
    const yValue = groupData[i].y[0];

    if (yValue !== undefined) {
      map[xValue] = yValue;
    }
  }

  return map;
}

function getYCoordFromX(x, mapping) {
  let closestX = 0;

  for (const coordX in mapping) {
    const coordXNum = parseFloat(coordX); // Convert the key to a number
    if (coordXNum <= x && coordXNum >= closestX) {
      closestX = coordXNum;
    }
  }

  return mapping[closestX];
}

function toggleLineVisibility(modelName) {
  const checkbox = document.getElementById(`checkbox-${modelName}`);
  const lineGroup = d3.select(`g[model="${modelName}"]`);

  if (checkbox.checked) {
    lineGroup.style("display", "initial");
  } else {
    lineGroup.style("display", "none");
  }

  //TODO: this isn't working, also do it dynamically instead of with a hardcoded yoffset
  // Shift the visible lines up
  const visibleLines = document.querySelectorAll(".line[style='display: initial;']");
  let yOffset = 100;

  visibleLines.forEach(line => {
    const parentGroup = line.parentNode;
    parentGroup.attr("transform", `translate(0,${yOffset})`);
    yOffset += fixedYOffsetStep;
  });
}