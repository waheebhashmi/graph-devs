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

  const correlationMatrix = [];

  models.forEach(model1 => {
    const row = [];
    models.forEach(model2 => {
      const correlation = calculateCorrelation(model1, model2, timeSeries);
      row.push(correlation);
    });
    correlationMatrix.push(row);
  });

  console.log(correlationMatrix);

  // Get the minimum and maximum correlation values in the matrix
  const minCorrelation = d3.min(correlationMatrix.flat());
  const maxCorrelation = d3.max(correlationMatrix.flat());

  console.log("min correlation = " + minCorrelation);
  console.log("max correlation = " + maxCorrelation);

  // Build color scale
  var myColor = d3.scaleLinear()
    .range(["white", "#69b3a2"])
    .domain([minCorrelation, maxCorrelation]);

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
  svg.selectAll(".heatmap-rect")
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
    .style("fill", function (d) {
      if (typeof d.value !== 'undefined') {
        return myColor(d.value);
      } else {
        return "gray";
      }
    });

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