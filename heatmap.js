let data = new Array();

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
    makeHeatmap();
  }, 1000);
});

function makeHeatmap() {
  const models = Array.from(new Set(data.map(d => d.model))); // Get unique model names

  // Group the data by model name
  const groupedData = d3.group(data, d => d.model);
  const modelToCoordMap = {};
  groupedData.forEach((group, modelName) => {
    modelToCoordMap[modelName] = createCoordMapping(group);
  });

  // Find GCD of differences between times to use for correlation calculation
  const gcdOfTimeDifferences = findGCDOfTimeDifferences(data);
  console.log("GCD of time differences:", gcdOfTimeDifferences);

  // prepare the data for sampling - we want to get pairs at given times
  const timeSeries = createTimeSeries(data, modelToCoordMap, gcdOfTimeDifferences, models);

  // Calculate the actual pair-wise correlation values
  const correlationMatrix = createCorrelationMatrix(models, timeSeries);
  console.log(correlationMatrix);

  // Get the minimum and maximum correlation values in the matrix
  const minCorrelation = d3.min(correlationMatrix.flat());
  const maxCorrelation = d3.max(correlationMatrix.flat());

  console.log("min correlation = " + minCorrelation);
  console.log("max correlation = " + maxCorrelation);

  // Build color scale
  var myColor = d3.scaleSequential()
    .domain([minCorrelation, maxCorrelation])
    .interpolator(d3.interpolateBlues);

  // Set the dimensions and margins of the graph
  var margin = { top: 50, right: 250, bottom: 500, left: 100 },
    contentWidth = document.getElementById("content").offsetWidth,
    contentHeight = document.getElementById("content").offsetHeight,
    width = contentWidth - margin.left - margin.right,
    height = contentHeight - margin.top - margin.bottom;

  // Append the svg object to the body of the page
  var svg = d3.select("#heatmap")
    .append("svg")
    .attr("width", contentWidth)
    .attr("height", contentHeight)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Build X scales and axis:
  var x = d3.scaleBand()
    .range([0, width])
    .domain(models)
    .padding(0.01);

  // Rotate x-axis labels
  svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-45)") // Adjust the rotation angle as needed
    .style("text-anchor", "end");

  // Build Y scales and axis:
  var y = d3.scaleBand()
    .range([height, 0])
    .domain(models.slice().reverse())
    .padding(0.01);
  svg.append("g")
    .call(d3.axisLeft(y));

  // Draw the heatmap
  svg.selectAll(".heatmap-row")
  .data(correlationMatrix)
  .enter()
  .append("g")
  .attr("class", "heatmap-row")
  .selectAll(".heatmap-rect")
  .data(function (d, i) { return d.map((value, j) => ({ row: i, col: j, value: value })); })
  .enter()
  .append("rect")
  .attr("x", function (d) { return x(models[d.col]); })
  .attr("y", function (d) { return y(models[d.row]); })
  .attr("width", x.bandwidth())
  .attr("height", y.bandwidth())
  .attr("class", "heatmap-rect")
  .style("fill", function (d) {
    if (typeof d.value !== 'undefined') {
      return myColor(d.value);
    } else {
      return "gray";
    }
  })
  .on("mouseover", function (event, d) {
    d3.select(this)
      .style("stroke", "black")
      .style("stroke-width", 2);

    const tooltip = d3.select("#tooltip");
    tooltip.transition()
      .duration(200)
      .style("visibility", "visible");

    tooltip.html(`Correlation: ${d.value.toFixed(4)}`)
      .style("left", (event.pageX) + "px")
      .style("top", (event.pageY - 28) + "px");
  })
  .on("mouseout", function () {
    d3.select(this)
      .style("stroke", "none");

    const tooltip = d3.select("#tooltip");
    tooltip.transition()
      .duration(500)
      .style("visibility", "hidden");
  });


}

function createCorrelationMatrix(models, timeSeries) {
    let correlationMatrix = [];
    models.forEach(model1 => {
        const row = [];
        models.forEach(model2 => {
            const correlation = calculateCorrelation(model1, model2, timeSeries);
            row.push(correlation);
        });
        correlationMatrix.push(row);
    });
    return correlationMatrix;
}

function calculateCorrelation(model1, model2, data) {
  // Filter data for the specified models
  const model1Data = data.filter(d => d.model === model1);
  const model2Data = data.filter(d => d.model === model2);

  console.log(model1Data);
  console.log(model2Data);

  // Find common time points between the two models
  const commonTimePoints = model1Data.filter(d1 =>
    model2Data.some(d2 => d2.time === d1.time)
  );

  // Calculate the means for each model
  const meanModel1 = d3.mean(model1Data, d => d.value);
  const meanModel2 = d3.mean(model2Data, d => d.value);

  // Calculate the numerator and denominators for Pearson correlation
  let numerator = 0;
  let denominatorModel1 = 0;
  let denominatorModel2 = 0;

  for (const timePoint of commonTimePoints) {
    const diff1 = timePoint.value - meanModel1;
    const diff2 = timePoint.value - meanModel2;

    numerator += diff1 * diff2;
    denominatorModel1 += diff1 ** 2;
    denominatorModel2 += diff2 ** 2;
  }

  // Avoid division by zero
  if (denominatorModel1 === 0 || denominatorModel2 === 0) {
    return 0; // we can change this
  }

  // Calculate Pearson correlation coefficient
  const correlation =
    commonTimePoints.length > 0
      ? numerator / Math.sqrt(denominatorModel1 * denominatorModel2)
      : 0;

  console.log("correlation between " + model1 + " and " + model2 + " is " + correlation);
  return correlation;
}


// Makes a map which we can reference to find the Y value of a model given its X coordinate
// Since we're piece-wise we use this later by using the largest x value in the map less
// than or equal to the x coord we want the y for
function createCoordMapping(groupData) {
  const map = {};
  map[0] = 0;

  for (let i = 0; i < groupData.length; i++) {
    const xValue = groupData[i].x;
    let yValue = groupData[i].y;

    // Check if yValue is a string and try to extract a number from it
    if (typeof yValue === 'string') {
      const match = yValue.match(/:.*?(\d+(\.\d+)?)$/); // Matches a colon followed by any characters and then a number at the end of the string
      if (match && match[1]) {
        yValue = match[1].includes('.') ? parseFloat(match[1]) : parseInt(match[1], 10); // Parse the number as float if it contains a dot, otherwise as int
      } else {
        // Handle the case where no number is found or yValue is not in expected format
        yValue = 0; // Default value or any other fallback logic
      }
    }

    // Update the map with the processed yValue
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

function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
}

function findGCDOfTimeDifferences(data, decimalPlaces = 4) {
  const MIN_GCD_THRESHOLD = 0.01; // Define a minimum GCD threshold to avoid too small GCDs

  const timeDifferences = [];

  // Calculate differences between consecutive time values
  for (let i = 1; i < data.length; i++) {
      const time1 = data[i - 1].x;
      const time2 = data[i].x;
      const difference = Math.abs(time2 - time1).toFixed(decimalPlaces);

      // Consider only non-zero differences
      if (difference !== '0') {
        timeDifferences.push(parseFloat(difference));
      }
  }

  // Find GCD of time differences
  if (timeDifferences.length > 1) {
      let currentGCD = gcd(timeDifferences[0], timeDifferences[1]);

      for (let i = 2; i < timeDifferences.length; i++) {
          currentGCD = gcd(currentGCD, timeDifferences[i]);
      }

      if (currentGCD < MIN_GCD_THRESHOLD) {
        return MIN_GCD_THRESHOLD;
      }
      else {
        return currentGCD;
      }
  } else if (timeDifferences.length === 1) {
      return timeDifferences[0];
  } else {
      // If there are no non-zero differences, return 0
      return 0;
  }
}

function createTimeSeries(data, modelToCoordMap, gcdOfTimeDifferences, models, decimalPlaces = 4) {
  const newData = [];

  models.forEach(model => {
    const coordMap = modelToCoordMap[model];

    // Iterate through time intervals based on GCD
    for (let currentTime = 0; currentTime <= d3.max(data, d => d.x); currentTime += gcdOfTimeDifferences) {
        currentTime = parseFloat(currentTime.toFixed(decimalPlaces));
        const value = parseFloat(getYCoordFromX(currentTime, coordMap));

        if (value !== undefined) {
            newData.push({ time: currentTime, model: model, value: value });
        }
    }
  });

  console.log("New Time Series Data:", newData);
  return newData;
}