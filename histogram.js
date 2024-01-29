let data = new Array();

// Global variable to keep track of SVG elements for histograms
var histogramSVGs = new Map();

function readAndPrint(file) {
  const reader = new FileReader();
  reader.onload = function () {
    const lines = this.result.split('\n');
    for (let i = 1; i < lines.length - 1; i++) {
      let valueArray = lines[i].split(",");
      let time = valueArray[0]; // time
      let model = valueArray[2]; // model

      // appends out or in depending on if the word before last comma had 'out' or not
      let modifier = valueArray[valueArray.length - 2].toLowerCase().includes('out') ? 'out' : 'in';
      model = model + ' ' + modifier;

      const linesSplitted = lines[i].trim().split('\n');
      const results = [];
      linesSplitted.forEach(line => {
        const match = line.match(/(\b\d{1,3}\b)$/);
        if (match) {
          results.push(match[1]); // frequency
        }
      });
      data.push({ x: parseFloat(time), y: results, model: model });
    }
  };

  reader.readAsText(file);
}

document.getElementById("myBtn").addEventListener("click", function () {
  var reader = new FileReader();
  reader.readAsText(document.getElementById('fileInput').files[0]);
  readAndPrint(document.getElementById('fileInput').files[0]);
  setTimeout(function () {
    makeHistograms();
  }, 1000);
});

function makeHistograms() {
  var margin = {top: 10, right: 30, bottom: 30, left: 40},
      width = 460 - margin.left - margin.right,
      height = 400 - margin.top - margin.bottom;

  var svg = d3.select("#violin-plot").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

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

  // Group timeSeries by model
  const timeSeriesByModel = d3.group(timeSeries, d => d.model);

  console.log(timeSeriesByModel);

  const modelValues = {}
  models.forEach((model, index) => {
    modelValues[model] = timeSeriesByModel.get(model).map(d => d.value);
  });

  console.log("modelValues: ", modelValues);

  var y = d3.scaleLinear()
    .domain([0, 1000])          //setting manually for now
    .range([height, 0])
  
  // Compute the binning for each model
  var sumstat = new Map();
  models.forEach(model => {
    /* Freedman-Diaconis Rule: Choose the bin width (h) as 2 * IQR * n^(-1/3) where IQR is the interquartile range of the data and
     n is the number of data points. Then, divide the range of the data by the bin width to get the number of bins.*/
    
    var values = modelValues[model];
    values.sort(d3.ascending); // Sort values for accurate quantile calculation
    var uniqueValues = Array.from(new Set(values));
  
    var bins;
    if (uniqueValues.length <= 7) { // Threshold for small range data
      // Create bins for each unique value plus one extra for any values outside the range
      bins = uniqueValues.map((value, i, arr) => {
        var bin = { x0: value, x1: i < arr.length - 1 ? arr[i + 1] : value + 1, length: values.filter(v => v === value).length };
        return bin;
      });
    } else {
      var iqr = d3.quantile(values, 0.75) - d3.quantile(values, 0.25);
      var binWidth = 2 * iqr * Math.pow(values.length, -1/3);
      var numberOfBins = iqr === 0 ? 7 : Math.round((d3.max(values) - d3.min(values)) / binWidth);
      var minBins = 7; // Enforce a minimum number of bins
      
      numberOfBins = Math.max(numberOfBins, minBins);
      var thresholds = d3.range(d3.min(values), d3.max(values) + binWidth, binWidth);
  
      // Features of the histogram
      var histogram = d3.histogram()
        .domain(y.domain())
        .thresholds(thresholds)
        .value(d => d);
  
      bins = histogram(values);
    }
    sumstat.set(model, bins);
  });

  console.log("sumstat: ", sumstat);

  // Set the dimensions for each histogram
  var margin = {top: 10, right: 30, bottom: 30, left: 40},
    width = 460 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

  // Calculate the spacing between histograms
  var spaceBetweenHistograms = 40; // Adjust as needed
  var totalSvgWidth = models.length * (width + spaceBetweenHistograms) + margin.left + margin.right;

  // Clear the main SVG to avoid duplicate histograms
  d3.select("#histogram").selectAll("*").remove();

  var mainSvg = d3.select("#histogram")
      .attr("width", totalSvgWidth)
      .attr("height", height + margin.top + margin.bottom + 30);

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
    .style("fill", "#69b3a2");

    // Add model name below each histogram
    svgGroup.append("text")
      .attr("x", width / 2)  // Position text in the center of the histogram
      .attr("y", height + margin.bottom + 5) // Position text below the histogram
      .attr("text-anchor", "middle") // Center the text
      .text(modelName); // Set the text to the model name
  });

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

function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
}

function findGCDOfTimeDifferences(data, decimalPlaces = 4) {
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

      return currentGCD;
  } else if (timeDifferences.length === 1) {
      return timeDifferences[0];
  } else {
      // If there are no non-zero differences, return 0 or handle accordingly
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