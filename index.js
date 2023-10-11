
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
    .domain([d3.min(data, d => d.y), d3.max(data, d => d.y)])
    .range([height - 50, 50]);

  svg.selectAll(".dot")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "dot")
    .attr("cx", d => xScale(d.x))
    .attr("cy", d => yScale(d.y))
    .attr("r", 1.25)
    .on("mouseover", function (event, d) { 
      tooltip.style("visibility", "visible")
        .text("Model: " + d.model)
        .style("top", (event.pageY - 10) + "px")
        .style("left", (event.pageX + 10) + "px");
    })
    .on("mouseout", function () {
      tooltip.style("visibility", "hidden");
    });

  svg.append("g")
    .attr("transform", "translate(0," + (height - 40) + ")")
    .call(d3.axisBottom(xScale));


  svg.append("g")
    .attr("transform", "translate(40, 0)")
    .call(d3.axisLeft(yScale));

}