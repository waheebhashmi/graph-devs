
let data = new Array();
function readAndPrint(file) {
  const reader = new FileReader();
  reader.onload = function () {
    const lines = this.result.split('\n');
    for (let i = 1; i < lines.length - 1; i++) { //skip first line and last line
      let valueArray = lines[i].split(",");
      let time = valueArray[0]; //time
      let model = valueArray[2]; //model
      const linesSplitted = lines[i].trim().split('\n');
      const results = [];
      linesSplitted.forEach(line => {
        const match = line.match(/(\b\d{1,2}\b)$/); 
        if (match) {
          results.push(match[1]); //frequency
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
    makeGraph();
  }, 1000);
});


function makeGraph() {
  const svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");
  const tooltip = d3.select("#tooltip");
  const modelToCoordMap = {};

  const xScale = d3.scaleLinear()
    .domain([d3.min(data, d => d.x), d3.max(data, d => d.x)])
    .range([50, width - 50]);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d3.max(d.y))])
    .range([height - 50, 50]);

  // Group the data by model name
  const groupedData = d3.group(data, d => d.model);

  // Give each model a unique colour
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // Line generator for step line chart
  const line = d3.line()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y))
    .curve(d3.curveStepAfter);

  const lineThickness = 4;

  groupedData.forEach((group, modelName) => {
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


  modelToCoordMap[modelName] = createCoordMapping(group);


  function updateTooltip(event, modelName, xScale, modelToCoordMap) {
    const xValue = xScale.invert(event.offsetX);
    tooltip.style("visibility", "visible")
      .html("Model: " + modelName + "<br>X: " + xValue.toFixed(2) + "<br>Y: " + getYCoordFromX(xValue, modelToCoordMap[modelName]))
      .style("top", (event.pageY - 10) + "px")
      .style("left", (event.pageX + 10) + "px");
  }
  });

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
  
let yLegendSection = 65;  

//legend
const legend = svg.append('g')
    .attr('class', 'legend');

groupedData.forEach((group, modelName) => {
    const legendSection = legend.append('g')
        .attr('transform', `translate(0, ${yLegendSection})`);

    legendSection.append('rect')
        .attr('x', 780
      )
        .attr('y', 0)
        .attr('width', 20)
        .attr('height', 20)
        .attr('fill', colorScale(modelName));

    //model name
    legendSection.append('text')
        .attr('x', 800
       + 15)
        .attr('y', 15)
        .text(modelName);

    yLegendSection += 25;
});


  svg.append("g")
    .attr("transform", "translate(0," + (height - 40) + ")")
    .call(d3.axisBottom(xScale));

  svg.append("g")
    .attr("transform", "translate(40, 0)")
    .call(d3.axisLeft(yScale));


svg.append("text")             
  .attr("transform",
        "translate(" + (width/2) + " ," + 
                       (height - 10) + ")")
  .style("text-anchor", "middle")
  .text("Time (seconds)");


svg.append("text")
.attr("transform", "rotate(-90)")
.attr("y", 8)     
.attr("x",0 - (height / 2))
.attr("dy", "1em") 
.style("text-anchor", "middle")
.text("Output");




}

