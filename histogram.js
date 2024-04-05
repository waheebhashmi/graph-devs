let data = new Array();

// Global variable to keep track of SVG elements for histograms
var mainSvg;
var histogramSVGs = new Map();
var sortedValues = new Map(); // Only sort the output data once per model
var color = d3.scaleOrdinal(d3.schemeTableau10); // Ordinal color scale for categorical data

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
  reader.readAsText(document.getElementById('fileInput').files[0]);
  readAndPrint(document.getElementById('fileInput').files[0]);
  setTimeout(function () {
    processDataAndCreateVisualizations();
  }, 1000);
});

function processDataAndCreateVisualizations() {
  prepareData();
  makeHistograms();
  makeBoxPlots();
}

var models = Array();
var modelToCoordMap = {};
var modelValues = {};
var sumstat = new Map();
var totalSvgWidth = 0;

function prepareData() {
  models = Array.from(new Set(data.map(d => d.model))); // Get unique model names

  // Group the data by model name
  const groupedData = d3.group(data, d => d.model);
  groupedData.forEach((group, modelName) => {
    modelToCoordMap[modelName] = createCoordMapping(group);
  });

  // Find GCD of differences between times to use for correlation calculation
  const gcdOfTimeDifferences = findGCDOfTimeDifferences(data);
  console.log("GCD of time differences:", gcdOfTimeDifferences);

  // prepare the data for sampling - we want to get pairs at given times
  const timeSeries = createTimeSeries(data, modelToCoordMap, gcdOfTimeDifferences, models);

  // Group timeSeries by model
  const timeSeriesByModel = d3.group(timeSeries, d => d.model);

  console.log(timeSeriesByModel);

  models.forEach((model, index) => {
    modelValues[model] = timeSeriesByModel.get(model).map(d => d.value);
  });

  console.log("modelValues: ", modelValues);
}

function makeHistograms() {
  var histogramParams = getHistogramParameters();
  var { margin, width, height } = histogramParams;

  var y = d3.scaleLinear()
    .domain([0, 1000])          //setting manually for now
    .range([height, 0])
  
  models.forEach(model => {
    createBinsForModel(model);
  });

  console.log("sumstat: ", sumstat);

  setupSVGCanvas(histogramParams);
  drawHistograms(histogramParams);
}

function getHistogramParameters() {
  var margin = {top: 10, right: 30, bottom: 30, left: 40},
      width = 460 - margin.left - margin.right,
      height = 400 - margin.top - margin.bottom;

  return { margin, width, height };
}

function createBinsForModel(model) {
  /* Freedman-Diaconis Rule: Choose the bin width (h) as 2 * IQR * n^(-1/3) where IQR is the interquartile range of the data and
     n is the number of data points. Then, divide the range of the data by the bin width to get the number of bins.*/
  sortedValues[model] = modelValues[model].sort(d3.ascending);
  var values = sortedValues[model];
  var uniqueValues = Array.from(new Set(values));

  var bins = uniqueValues.length <= 5
    ? createDiscreteBins(uniqueValues, values)
    : createContinuousBins(values);

  sumstat.set(model, bins);
}

function createDiscreteBins(uniqueValues, values) {
  // Create a bin for each unique value
  return uniqueValues.map(value => {
    return {
      x0: value, // Set the bin start exactly at the value
      x1: value + 1, // Set the bin end exactly 1 unit ahead
      length: values.filter(v => v === value).length // Count occurrences of this value
    };
  });
}

function createContinuousBins(values) {
  var iqr = d3.quantile(values, 0.75) - d3.quantile(values, 0.25);
  var binWidth = 2 * iqr * Math.pow(values.length, -1/3);
  var numberOfBins = iqr === 0 ? 7 : Math.round((d3.max(values) - d3.min(values)) / binWidth);
  var minBins = 7; // Enforce a minimum number of bins
  
  numberOfBins = Math.max(numberOfBins, minBins);
  var thresholds = d3.range(d3.min(values), d3.max(values) + binWidth, binWidth);

  console.log("Thresholds for ", model, " are ", thresholds);

  // Features of the histogram
  var histogram = d3.histogram()
    .domain(y.domain())
    .thresholds(thresholds)
    .value(d => d);

  return histogram(values);
}

function setupSVGCanvas({ margin, width, height }, spaceBetweenHistograms = 40) {
  // Calculate the spacing between histograms
  totalSvgWidth = models.length * (width + spaceBetweenHistograms) + margin.left + margin.right;

  // Clear the main SVG to avoid duplicate histograms
  d3.select("#histogram").selectAll("*").remove();

  mainSvg = d3.select("#histogram")
      .attr("width", totalSvgWidth)
      .attr("height", height * 2 + margin.top * 2 + margin.bottom * 2 - 250);
}

function drawHistograms({ margin, width, height }) {
  sumstat.forEach((bins, modelName) => {
    drawHistogramForModel(bins, modelName, { margin, width, height });
  });
}

function drawHistogramForModel(bins, modelName, { margin, width, height }, spaceBetweenHistograms = 40) {
  sumstat.forEach((bins, modelName) => {

    console.log("bins: ", bins);
    console.log("those were the bins for ", modelName);

    // Get the index of the current model in the array
    const index = models.indexOf(modelName);
    const xOffset = (width + spaceBetweenHistograms) * index + margin.left;

    // Calculate the total number of samples for the current model
    const totalSamples = d3.sum(bins, d => d.length);

    // Compute the percentage for each bin
    bins.forEach(bin => {
      bin.percentage = (bin.length / totalSamples) * 100;
    });

    // Append a group element for each histogram
    var svgGroup = mainSvg.append("g")
      .attr("transform", `translate(${xOffset},${margin.top})`);

    // Store the reference to each SVG group
    histogramSVGs.set(modelName, svgGroup);

    // Create the X axis scale based on the bin ranges
    var x = d3.scaleLinear()
      .domain([0, d3.max(bins, d => d.x1)]) // Assuming x1 is the upper limit of each bin
      .range([0, width]);

    // Add X axis to the SVG
    svgGroup.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

    // Create the Y axis scale based on the percentage
    var y = d3.scaleLinear()
    .range([height, 0])
    .domain([0, 100]); // Y-axis now goes from 0% to 100%

    // Add Y axis to the SVG
    svgGroup.append("g")
      .call(d3.axisLeft(y));

    // Rest of your code to create the bars...
    svgGroup.selectAll("rect")
    .data(bins)
    .enter()
    .append("rect")
    .attr("x", d => x(d.x0))
    // Position the bars based on the percentage
    .attr("y", d => y(d.percentage))
    .attr("width", d => x(d.x1) - x(d.x0) - 1)
    // Height of the bars should now represent the percentage
    .attr("height", d => height - y(d.percentage))
    .style("fill", () => color(modelName));

    // Add model name below each histogram
    svgGroup.append("text")
      .attr("x", width / 2)  // Position text in the center of the histogram
      .attr("y", height + margin.bottom + 5) // Position text below the histogram
      .attr("text-anchor", "middle") // Center the text
      .text(modelName); // Set the text to the model name
  });
}

function makeBoxPlots() {
  console.log(models);

  // This is the margin around each box plot
  var boxPlotMargin = {top: 10, right: 30, bottom: 30, left: 40},
      // Width and height determine the size of the box plot area
      boxPlotHeight = 400 - boxPlotMargin.top - boxPlotMargin.bottom;

  // Number of models determines how many box plots we will have
  var numberOfModels = models.length;

  // Space between box plots
  var spaceBetweenBoxPlots = 40;

  // Calculate the available width for all box plots, considering the space between them
  var availableWidth = totalSvgWidth - (spaceBetweenBoxPlots * (numberOfModels + 1));

  // Padding on each side of the box plot
  var padding = 10;

  // Calculate the effective width for each individual box plot
  var individualBoxPlotWidth = (availableWidth / numberOfModels) - (padding * 2);

  models.forEach((model, index) => {
    let svgGroup = histogramSVGs.get(model);
    let boxPlotData = calculateBoxPlotData(sortedValues[model]);

    // Create the box plot group with the correct transform
    let boxPlotGroup = svgGroup.append("g")
      .attr("transform", `translate(0,${boxPlotHeight + 50 + boxPlotMargin.top})`);

    // Calculate the minimum and maximum values for xScale domain considering outliers
    let minValue = Math.min(boxPlotData.min, d3.min(sortedValues[model]));
    let maxValue = Math.max(boxPlotData.max, d3.max(sortedValues[model]));

    // Set the scale for the box plot
    let xScale = d3.scaleLinear()
      .domain([minValue, maxValue])
      .range([0, individualBoxPlotWidth]);
    
    // Create the box
    boxPlotGroup.append("rect")
      .attr("x", xScale(Math.max(boxPlotData.q1, minValue))) // Use max to ensure it stays within scale
      .attr("y", 0)
      .attr("width", xScale(Math.min(boxPlotData.q3, maxValue)) - xScale(Math.max(boxPlotData.q1, minValue))) // Use min and max to ensure it stays within scale
      .attr("height", 20) // fixed height for the box
      .attr("stroke", "black")
      .style("fill", () => color(model));

    // Create the median line
    boxPlotGroup.append("line")
      .attr("x1", xScale(boxPlotData.median))
      .attr("x2", xScale(boxPlotData.median))
      .attr("y1", 0)
      .attr("y2", 20)
      .attr("stroke", "black");

    // Lower whisker line
    boxPlotGroup.append("line")
      .attr("x1", xScale(Math.max(boxPlotData.min, minValue))) // Use max to ensure it stays within scale
      .attr("x2", xScale(boxPlotData.q1))
      .attr("y1", 10)
      .attr("y2", 10)
      .attr("stroke", "black");

    // Upper whisker line
    boxPlotGroup.append("line")
      .attr("x1", xScale(boxPlotData.q3))
      .attr("x2", xScale(Math.min(boxPlotData.max, maxValue))) // Use min to ensure it stays within scale
      .attr("y1", 10)
      .attr("y2", 10)
      .attr("stroke", "black");

    // Lower whisker end
    boxPlotGroup.append("line")
      .attr("x1", xScale(Math.max(boxPlotData.min, minValue)))
      .attr("x2", xScale(Math.max(boxPlotData.min, minValue)))
      .attr("y1", 8)
      .attr("y2", 12)
      .attr("stroke", "black");

    // Upper whisker end
    boxPlotGroup.append("line")
      .attr("x1", xScale(Math.min(boxPlotData.max, maxValue)))
      .attr("x2", xScale(Math.min(boxPlotData.max, maxValue)))
      .attr("y1", 8)
      .attr("y2", 12)
      .attr("stroke", "black");

    // Add an x-axis to the box plot
    boxPlotGroup.append("g")
      .attr("transform", `translate(0,${50})`)
      .call(d3.axisBottom(xScale).ticks(5));
  });
}

function calculateBoxPlotData(modelValuesSorted) {
  var q1 = d3.quantile(modelValuesSorted, .25)
  var median = d3.quantile(modelValuesSorted, .5)
  var q3 = d3.quantile(modelValuesSorted, .75)
  var interQuantileRange = q3 - q1
  var min = q1 - 1.5 * interQuantileRange
  var max = q3 + 1.5 * interQuantileRange

  return { q1: q1, median: median, q3: q3, min: min, max: max };
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

    console.log("MODEL: ", model);
    console.log("COORD MAP: ", coordMap);
    console.log("");

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