# D3.js Visualizer for Obsidian

Create interactive D3.js visualizations directly in your Obsidian notes using code blocks.

## Features

- **Code Block Integration**: Use `d3` code blocks to create visualizations
- **Safe Execution**: Sandboxed JavaScript environment for secure visualization rendering
- **Data Loading**: Load CSV, JSON, and text files from your vault
- **Responsive Design**: Automatically responsive SVG visualizations
- **Error Handling**: Clear error messages when code fails
- **Utility Functions**: Built-in helpers for common D3 patterns
- **Customizable Settings**: Configure default dimensions and behavior

## Installation

1. Copy `main.js`, `styles.css`, and `manifest.json` to your vault's `.obsidian/plugins/visualizer-d3/` folder
2. Enable the plugin in Obsidian's settings
3. Start creating visualizations!

## Basic Usage

Create a D3 visualization by using a `d3` code block in your notes:

```d3
// Create an SVG element
const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

// Add a circle
svg.append("circle")
  .attr("cx", width / 2)
  .attr("cy", height / 2)
  .attr("r", 50)
  .style("fill", "steelblue");
```

## Available Variables and Functions

Inside D3 code blocks, you have access to:

- `d3` - The complete D3.js library
- `container` - The HTML element where your visualization will be rendered
- `width` - Default width from settings
- `height` - Default height from settings  
- `console` - For debugging (console.log, console.error, console.warn)
- `loadData` - Functions for loading data from your vault
- `utils` - Utility functions for common D3 patterns

## Loading Data

Load data from files in your vault:

```d3
// Load CSV data
const data = await loadData.csv('data/my-data.csv');

// Load JSON data
const jsonData = await loadData.json('data/config.json');

// Load text data
const textData = await loadData.text('notes/data.txt');

// Use the data in your visualization
const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

svg.selectAll("circle")
  .data(data)
  .enter()
  .append("circle")
  .attr("cx", (d, i) => i * 50 + 25)
  .attr("cy", height / 2)
  .attr("r", d => +d.value)
  .style("fill", utils.colors[0]);
```

## Utility Functions

The `utils` object provides helpful functions:

```d3
// Create responsive SVG
const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);
utils.responsive(svg);

// Standard margins
const margin = utils.margin(20, 30, 40, 50); // top, right, bottom, left
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

// Built-in formatters and color schemes
const formatNum = utils.formatNumber; // d3.format(',')
const formatPct = utils.formatPercent; // d3.format('.1%')
const colors = utils.colors; // d3.schemeCategory10
const parseDate = utils.parseDate; // d3.timeParse('%Y-%m-%d')
const formatDate = utils.formatDate; // d3.timeFormat('%B %d, %Y')
```

## Example Visualizations

### Bar Chart

```d3
const data = [
  {name: 'A', value: 30},
  {name: 'B', value: 80},
  {name: 'C', value: 45},
  {name: 'D', value: 60}
];

const margin = utils.margin();
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleBand()
  .domain(data.map(d => d.name))
  .range([0, innerWidth])
  .padding(0.1);

const y = d3.scaleLinear()
  .domain([0, d3.max(data, d => d.value)])
  .range([innerHeight, 0]);

g.selectAll(".bar")
  .data(data)
  .enter().append("rect")
  .attr("class", "bar")
  .attr("x", d => x(d.name))
  .attr("y", d => y(d.value))
  .attr("width", x.bandwidth())
  .attr("height", d => innerHeight - y(d.value))
  .style("fill", utils.colors[0]);
```

### Scatter Plot

```d3
const data = d3.range(50).map(() => ({
  x: Math.random() * 100,
  y: Math.random() * 100
}));

const margin = utils.margin();
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleLinear()
  .domain([0, 100])
  .range([0, innerWidth]);

const y = d3.scaleLinear()
  .domain([0, 100])
  .range([innerHeight, 0]);

g.selectAll(".dot")
  .data(data)
  .enter().append("circle")
  .attr("class", "dot")
  .attr("cx", d => x(d.x))
  .attr("cy", d => y(d.y))
  .attr("r", 3)
  .style("fill", utils.colors[1]);
```

## Settings

Configure the plugin in Obsidian's settings:

- **Default Width**: Default width for visualizations (pixels)
- **Default Height**: Default height for visualizations (pixels)  
- **Enable Error Display**: Show error messages when code fails
- **Allow Data Loading**: Allow loading data from vault files

## Development

- Clone this repository
- Run `npm install` to install dependencies
- Run `npm run dev` for development mode
- Run `node esbuild.config.mjs production` for production build
