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
  const models = Array.from(new Set(data.map(d => d.model))); // Get unique model names

  // Set up the SVG dimensions and margins
  var margin = { top: 30, right: 50, bottom: 100, left: 50 };

  // Get the dimensions of the container element
  var container = d3.select("#violin-plot");
  var containerWidth = container.node().getBoundingClientRect().width;
  var containerHeight = container.node().getBoundingClientRect().height;

  // Calculate the width and height of the SVG based on container dimensions and margins
  var width = containerWidth - margin.left - margin.right;
  var height = containerHeight - margin.top - margin.bottom;

  // Append the SVG to the body of the page
  var svg = container
    .selectAll("svg")
    .data([null]) // Use a single-element array for data join
    .enter()
    .append("svg")
    .attr("width", containerWidth)
    .attr("height", containerHeight)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Build and Show the Y scale
  var y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d3.max(d.y.map(Number)))]) // Adjust the domain based on your data
    .range([height, 0]);
  svg.append("g").call(d3.axisLeft(y));

  // Build and Show the X scale
  var x = d3.scaleBand()
    .range([0, width])
    .domain(models)
    .padding(0.05);
  svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x));

  // Features of the histogram
  var histogram = d3.histogram()
    .domain(y.domain())
    .thresholds(y.ticks(20))
    .value(d => d);

  // Compute the binning for each group of the dataset
  var sumstat = d3.group(data, d => d.model);

  // The maximum width of a violin must be x.bandwidth = the width dedicated to a group
  var xNum = d3.scaleLinear()
    .range([0, x.bandwidth()])
    .domain([-d3.max(Array.from(sumstat.values()), d => d3.max(d, v => v.y.length)), d3.max(Array.from(sumstat.values()), d => d3.max(d, v => v.y.length))]);

  // Add the shape to this svg!
  svg
    .selectAll("myViolin")
    .data(sumstat)
    .enter()
    .append("g")
    .attr("transform", function (d) {
      const translation = x(d.key);
      return translation ? "translate(" + translation + ",0)" : null;
    })
    .append("path")
    .datum(function (d) { return (histogram(d[1].map(v => v.y.map(Number)))) })
    .style("stroke", "none")
    .style("fill", "#69b3a2")
    .attr("d", d3.area()
      .x0(function (d) { return (xNum(-d.length)) })
      .x1(function (d) { return (xNum(d.length)) })
      .y(function (d) { return (y(d.x0)) })
      .curve(d3.curveCatmullRom)
    );
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