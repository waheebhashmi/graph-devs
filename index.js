



let veryTopModel;
let indentedChildren;
let realIndentedChildren;
let indentedChildrensTopNode;


let data = new Array();
var globalModel = JSON.parse(localStorage.getItem('globalModel')) || [];
let xScaleDomainStart = null; // Initialize x-axis start to null
let xScaleDomainEnd = null;   // Initialize x-axis end to null




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
    xScaleDomainStart = null; // Reset x-axis start
    xScaleDomainEnd = null;   // Reset x-axis end

    for (let i = 1; i < lines.length - 1; i++) {
      if (lines[i].trim() === '') continue;

      let delimiter = lines[0].includes(';') ? ';' : ',';
      let valueArray = lines[i].split(delimiter);
      let time = valueArray[0]; //time
      let model = valueArray.length > 2 ? valueArray[2].trim() : ""; // Use "DefaultModel" or any other default value
      if(model != ""){
      let modifierMatch = valueArray[valueArray.length - 2].toLowerCase().match(/(out|in)\d*/);
    let modifier = modifierMatch ? modifierMatch[0] : 'in'; // Default to '' if no match
    model = model + ' ' + modifier;
      let lastValue = valueArray[valueArray.length - 1].trim(); // Get the last value and trim spaces
      if (lastValue === '') {
        lastValue = 0; // Assign a default value if lastValue is empty
        continue;
    }
      // Structured data handling
      if (lastValue.includes('{')) {
        let prefixMatch = lastValue.match(/^(.*?): \{/);
        let prefix = prefixMatch ? prefixMatch[1] : ""; // Extract prefix before curly braces

        let structContent = lastValue.slice(lastValue.indexOf('{') + 1, -1); // Extract content inside curly braces
        let entries = structContent.split(',').map(entry => entry.trim());
        entries.forEach(entry => {
          let [key, valStr] = entry.split(':').map(s => s.trim());
          let entryModel = `${model} (${prefix} -> ${key})`;
          console.log([key, valStr]);
          // Check if valStr has content
          if (valStr) {
            // Process each value in the struct
            let vals = valStr.split(',').map(val => {
              val = val.replace(/[{}]/g, ''); // Ensure no curly braces

              if (val.includes('0x')) {
                return val; // Keep hex value as is
              } else if (!isNaN(parseInt(val))) {
                return parseInt(val, 10); // Parse integer
              } else {
                return val.trim(); // Keep string as is
              }
            });

            vals.forEach(val => {
              data.push({
                x: parseFloat(time),
                y: val,
                model: entryModel,
                intIndex: 0,
                colorBoolean: true,
                showAsBlackBox: false
                // showAsBlackBox: /^\{.*\}$/.test(lastValue) || lastValue.includes("{")
              });
            });
          }
        });
      } else {
        //Data handling with support for hex, integer, and strings
        let parsedValue;
        if (lastValue.includes('0x')) {
          parsedValue = lastValue;
        } else if (/^\d+$/.test(lastValue)) {
          parsedValue = parseInt(lastValue, 10); // Parse as integer
        } else {
          //Check if the string contains a number anywhere
          let includesNumber = /\d/.test(lastValue);
          if (includesNumber) {
            // Then, check if it strictly ends with a number
            let endsWithNumber = lastValue.match(/(\d+)$/);
            if (endsWithNumber && lastValue === endsWithNumber[0]) {
              // If it strictly ends with a number, parse that number
              parsedValue = parseInt(endsWithNumber[1], 10);
            } else {
              parsedValue = lastValue;
            }
          } else {
            //If no digits are present in the string at all, keep it as is
            parsedValue = lastValue.trim();
            console.log(parsedValue.toString().length);
          }
        }

        data.push({
          x: parseFloat(time),
          y: parsedValue,
          model: model,
          intIndex: 0,
          colorBoolean: true,
          showAsBlackBox: parsedValue.toString().trim().length > 25
        });
      }
    }
    console.log(data); // Log the data for verification
  };
}

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
  console.log("SDSDS: " + Array(globalModel)[0].top_model[selectedModel]);
  let keys;
  if (Array(globalModel)[0].top_model[selectedModel] != null) {
    keys = Object.keys(Array(globalModel)[0].top_model[selectedModel]);
    console.log("keys: " + keys);
  } else {
    console.log("NTOHING");
    keys = [];
  }



  allCheckboxes.forEach(checkbox => {
    const checkboxModelName = checkbox.id.split('-')[1];
    let checkboxModelNameBeforeSpace = checkboxModelName.split(" ")[0];
    console.log(checkboxModelName);
    console.log(selectedModel);


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
  const xOffset = 150;

  const xScale = d3.scaleLinear()
    .domain([
      xScaleDomainStart !== null ? xScaleDomainStart : d3.min(data, d => d.x),
      xScaleDomainEnd !== null ? xScaleDomainEnd : d3.max(data, d => d.x)
    ])
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
  const fixedYOffsetStep = 100;
  const minHeight = 400;
  let totalGraphHeight = Math.max(numModels * fixedYOffsetStep, minHeight) * (d3.max(data, d => d.y) > 100 ? 4 : 1);
  svg.attr("height", 1000000);




  // Create checkboxes for each model
  const checkboxesDiv = document.getElementById("checkboxes");
  sortedGroupedData.forEach((group, modelName) => {
    // Check if the checkbox already exists
    if (document.getElementById(`checkbox-${modelName}`)) {
      return; // Skip the creation process if the checkbox already exists
    }
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




  function isNumeric(data) {
    return data.every(d => !isNaN(parseFloat(d.y)) && isFinite(d.y));
  }
  // Use to keep track of x, y coords for each model (each group)
  const modelToCoordMap = {};


  const lineGroups = {};




  function isHex(group) {
    return group.some(d => typeof d.y === 'string' && d.y.startsWith('0x'));
  }

  sortedGroupedData.forEach((group, modelName) => {
    const index = data.findIndex(d => d.model === modelName);
    let yScale;
    const maxY = d3.max(group, d => d.y);
    let heightMultiplier = 1; // Default height multiplier
    if (maxY > 100) {
      heightMultiplier = 3;
    } else if (maxY > 10) {
      heightMultiplier = 2;
    }
    const yRange = maxY > 100 ? fixedYOffsetStep * 3 : fixedYOffsetStep;

    if (isHex(group)) {
      const uniqueHexValues = [...new Set(group.map(d => d.y))].sort();
      yScale = d3.scalePoint()
        .domain(uniqueHexValues)
        .range([yOffset + yRange - (data[index].intIndex * 100) - 50, yOffset - (data[index].intIndex * 100)])
    }
    else   if (isNumeric(group)) {
      yScale = d3.scaleLinear()
      .domain([0, d3.max(group, d => d.y)])
      .range([yOffset + yRange - (data[index].intIndex * 100) - 50, yOffset - (data[index].intIndex * 100)]);
    } else {
      const categories = Array.from(new Set(group.map(d => d.y))).sort();
      yScale = d3.scalePoint()
        .domain(categories)
        .range([yOffset + yRange - (data[index].intIndex * 100) - 50, yOffset - (data[index].intIndex * 100)])
        .padding(0.5);
    }

  

    // Create a new lineGroup for each model
    colorBlack = data[index].colorBoolean;
    const lineGroup = svg.append("g")
      .style("display", "initial")
      .attr("model", modelName);


if (group.length === 1 || group.every((element) => element.x === group[0].x)) {
      lineGroup
        .append("circle")
        .attr("cx", xScale(group[0].x))
        .attr("cy", yScale(group[0].y))
        .attr("r", 5)
        .attr("fill", colorScale(modelName));
    }
    else {
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
    }

    var tooltip1 = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("text-align", "center")
      .style("min-width", "120px") // Set a minimum width
      .style("min-height", "28px") // Set a minimum height
      .style("padding", "2px")
      .style("font", "12px sans-serif")
      .style("background", "lightsteelblue")
      .style("border", "0px")
      .style("border-radius", "8px")
      .style("pointer-events", "none");
    const showAsBlackBox = group.some(d => d.showAsBlackBox);

    // Create yAxis (with black box condition)
    const yAxis = d3.axisLeft(yScale).ticks(5);
    lineGroup
      .append("g")
      .attr("transform", `translate(150,${0})`)
      .call(yAxis)
      .call(g => g.append("text")
        .attr("x", 100)
        .attr("y", yOffset - 10)
        .attr("fill", "currentColor")
        .attr("text-anchor", "end")
        .text(modelName))
      .selectAll(".tick text")
      .style("fill", function (d) {
        return showAsBlackBox ? "black" : "currentColor";
      })
      .text(function (d) {
        // Replace text with a black box if showAsBlackBox is true
        return showAsBlackBox ? "□" : d;
      })
      .on("mouseover", function (event, d) {
        if (showAsBlackBox) {
          tooltip1.html(d)
            .style("opacity", .9)
            .style("left", (event.pageX) + "px")
            .style("top", (event.pageY - 28) + "px");

          var textLength = tooltip1.node().getBoundingClientRect().width;
          var padding = 16;
          tooltip1.style("width", (textLength + padding) + "px")
            .style("height", "auto");
        }
      })
      .on("mouseout", function (d) {
        if (showAsBlackBox) {
          tooltip1.transition()
            .style("opacity", 0);
        }
      });


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
      .attr("y", maxY < 100 ? 80 + yOffset - (data[index].intIndex * 100) : 80 + yOffset + 200 - (data[index].intIndex * 100))  // Adjust the position as needed
      .attr("fill", colorBlack ? "black" : "white")
      .attr("text-anchor", "end")
      .attr("font-size", "12px")  // Set the font size as needed
      .text("Time (seconds)");

    const xAxis = d3.axisBottom(xScale);
    lineGroup
      .append("g")
      .attr("transform", `translate(0,${yOffset + yRange - data[index].intIndex - 50})`)
      .attr("fill", colorBlack ? "black" : "white")
      .call(xAxis);
    // Store the lineGroup in the lineGroups object
    lineGroups[modelName] = lineGroup;

    // Increment the yOffset
    yOffset += yRange;


    modelToCoordMap[modelName] = createCoordMapping(group);
  });

  // //Create X axis
  // svg.append("g")
  //   .attr("transform", `translate(0,${height - 50})`)
  //   .call(d3.axisBottom(xScale));




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
document.getElementById("updateRange").addEventListener("click", function () {
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





