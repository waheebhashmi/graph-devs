
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
    svg.append("path")
      .datum(group)
      .attr("class", "line")
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", colorScale(modelName))
      .attr("stroke-width", lineThickness)
      .on("mouseover", function (event, d) {
        tooltip.style("visibility", "visible")
          .text("Model: " + modelName)
          .style("top", (event.pageY - 10) + "px")
          .style("left", (event.pageX + 10) + "px");
      })
      .on("mouseout", function () {
        tooltip.style("visibility", "hidden");
      });
  });


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
}