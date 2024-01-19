let data = new Array();

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
    makeViolinPlot();
  }, 1000);
});

function makeViolinPlot() {
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

  console.log(modelValues);

  var y = d3.scaleLinear()
    .domain([0, 1000])          //setting manually for now
    .range([height, 0])
  svg.append("g").call( d3.axisLeft(y) );

  // Build and Show the X scale. It is a band scale like for a boxplot: each group has an dedicated RANGE on the axis. This range has a length of x.bandwidth
  var x = d3.scaleBand()
    .range([ 0, width ])
    .domain([models])
    .padding(0.05)     // This is important: it is the space between 2 groups. 0 means no padding. 1 is the maximum.
  svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x));

  // Features of the histogram
  var histogram = d3.histogram()
        .domain(y.domain())
        .thresholds(y.ticks(20))    // Important: how many bins approx are going to be made? It is the 'resolution' of the violin plot
        .value(d => d);
  
  // Compute the binning for each model
  var sumstat = new Map();
  models.forEach(model => {
    const input = modelValues[model];    // Get the values for the current model
    const bins = histogram(input);   // Compute the binning on it
    sumstat.set(model, bins);
  });

  console.log(sumstat);

  var maxBinLength = 0;

  sumstat.forEach(bins => {
    bins.forEach(bin => {
      if (bin.length > maxBinLength) {
        maxBinLength = bin.length;
      }
    });
  });

  // The maximum width of a violin must be x.bandwidth = the width dedicated to a group
  var xNum = d3.scaleLinear()
    .range([0, x.bandwidth()])
    .domain([-maxBinLength,maxBinLength])

  sumstat.forEach((bins, model) => {
    svg.append("g")
      .attr("transform", `translate(${x(model)},0)`) // Position each violin plot
      .selectAll(".myViolin")
      .data([bins]) // Bind the bins for the current model
      .enter()
      .append("path")
        .attr("d", d3.area()
          .x0(d => xNum(-d.length))
          .x1(d => xNum(d.length))
          .y(d => y(d.x0))
          .curve(d3.curveCatmullRom))
        .style("stroke", "none")
        .style("fill", "#69b3a2");
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