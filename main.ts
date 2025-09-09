import { App, Plugin, PluginSettingTab, Setting, MarkdownPostProcessorContext, Editor, MarkdownView, Notice, Modal } from 'obsidian';
import * as d3 from 'd3';

interface D3VisualizerSettings {
	defaultWidth: number;
	defaultHeight: number;
	enableErrorDisplay: boolean;
	allowDataLoading: boolean;
}

const DEFAULT_SETTINGS: D3VisualizerSettings = {
	defaultWidth: 600,
	defaultHeight: 400,
	enableErrorDisplay: true,
	allowDataLoading: true
}

export default class D3VisualizerPlugin extends Plugin {
	settings: D3VisualizerSettings;

	async onload() {
		await this.loadSettings();

		this.registerMarkdownCodeBlockProcessor('d3', (source, el, ctx) => {
			this.processD3CodeBlock(source, el, ctx);
		});

		this.addRibbonIcon('bar-chart-3', 'D3.js Visualizer', () => {
			this.showTemplateMenu();
		});

		this.addCommand({
			id: 'insert-d3-template',
			name: 'Insert D3 template',
			editorCallback: (editor: Editor) => {
				this.showTemplateMenu(editor);
			}
		});

		this.addCommand({
			id: 'insert-d3-basic',
			name: 'Insert basic D3 visualization',
			editorCallback: (editor: Editor) => {
				this.insertTemplate(editor, 'basic');
			}
		});

		this.addCommand({
			id: 'insert-d3-bar-chart',
			name: 'Insert D3 bar chart',
			editorCallback: (editor: Editor) => {
				this.insertTemplate(editor, 'bar-chart');
			}
		});

		this.addCommand({
			id: 'insert-d3-scatter-plot',
			name: 'Insert D3 scatter plot',
			editorCallback: (editor: Editor) => {
				this.insertTemplate(editor, 'scatter-plot');
			}
		});

		this.addCommand({
			id: 'insert-d3-line-chart',
			name: 'Insert D3 line chart',
			editorCallback: (editor: Editor) => {
				this.insertTemplate(editor, 'line-chart');
			}
		});

		this.addSettingTab(new D3VisualizerSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private processD3CodeBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		const container = el.createDiv('d3-visualization-container');
		container.style.width = '100%';
		container.style.minHeight = `${this.settings.defaultHeight}px`;
		container.style.border = '1px solid var(--background-modifier-border)';
		container.style.borderRadius = '4px';
		container.style.padding = '10px';
		container.style.marginBottom = '10px';

		try {
			this.executeD3Code(source, container);
		} catch (error) {
			this.displayError(container, error);
		}
	}

	private executeD3Code(code: string, container: HTMLElement) {
		const d3Context = {
			d3: d3,
			container: container,
			width: this.settings.defaultWidth,
			height: this.settings.defaultHeight,
			console: {
				log: (...args: any[]) => console.log('[D3 Viz]', ...args),
				error: (...args: any[]) => console.error('[D3 Viz]', ...args),
				warn: (...args: any[]) => console.warn('[D3 Viz]', ...args)
			},
			loadData: this.createDataLoader(),
			utils: this.createUtilities()
		};

		const wrappedCode = `
			(function(d3, container, width, height, console, loadData, utils) {
				${code}
			})(d3, container, width, height, console, loadData, utils);
		`;

		const func = new Function('d3', 'container', 'width', 'height', 'console', 'loadData', 'utils', wrappedCode);
		func(d3Context.d3, d3Context.container, d3Context.width, d3Context.height, d3Context.console, d3Context.loadData, d3Context.utils);
	}

	private createDataLoader() {
		return {
			csv: async (path: string) => {
				if (!this.settings.allowDataLoading) {
					throw new Error('Data loading is disabled in settings');
				}
				const file = this.app.vault.getAbstractFileByPath(path);
				if (!file) {
					throw new Error(`File not found: ${path}`);
				}
				const content = await this.app.vault.read(file as any);
				return d3.csvParse(content);
			},
			json: async (path: string) => {
				if (!this.settings.allowDataLoading) {
					throw new Error('Data loading is disabled in settings');
				}
				const file = this.app.vault.getAbstractFileByPath(path);
				if (!file) {
					throw new Error(`File not found: ${path}`);
				}
				const content = await this.app.vault.read(file as any);
				return JSON.parse(content);
			},
			text: async (path: string) => {
				if (!this.settings.allowDataLoading) {
					throw new Error('Data loading is disabled in settings');
				}
				const file = this.app.vault.getAbstractFileByPath(path);
				if (!file) {
					throw new Error(`File not found: ${path}`);
				}
				return await this.app.vault.read(file as any);
			}
		};
	}

	private createUtilities() {
		return {
			responsive: (svg: any, aspect: number = 16/9) => {
				svg.attr('viewBox', `0 0 ${this.settings.defaultWidth} ${this.settings.defaultHeight}`)
					.attr('preserveAspectRatio', 'xMinYMin meet')
					.style('width', '100%')
					.style('height', 'auto');
				return svg;
			},
			margin: (top: number = 20, right: number = 20, bottom: number = 30, left: number = 40) => {
				return { top, right, bottom, left };
			},
			innerWidth: (width: number, margin: any) => width - margin.left - margin.right,
			innerHeight: (height: number, margin: any) => height - margin.top - margin.bottom,
			colors: d3.schemeCategory10,
			formatNumber: d3.format(','),
			formatPercent: d3.format('.1%'),
			parseDate: d3.timeParse('%Y-%m-%d'),
			formatDate: d3.timeFormat('%B %d, %Y')
		};
	}

	private displayError(container: HTMLElement, error: any) {
		if (!this.settings.enableErrorDisplay) {
			return;
		}

		container.empty();
		const errorDiv = container.createDiv('d3-error-display');
		errorDiv.style.color = 'var(--text-error)';
		errorDiv.style.backgroundColor = 'var(--background-modifier-error)';
		errorDiv.style.padding = '10px';
		errorDiv.style.borderRadius = '4px';
		errorDiv.style.fontFamily = 'var(--font-monospace)';
		errorDiv.style.fontSize = '0.9em';
		errorDiv.style.whiteSpace = 'pre-wrap';

		const errorTitle = errorDiv.createDiv();
		errorTitle.style.fontWeight = 'bold';
		errorTitle.style.marginBottom = '5px';
		errorTitle.textContent = 'D3 Visualization Error:';

		const errorMessage = errorDiv.createDiv();
		errorMessage.textContent = error.toString();
	}

	private showTemplateMenu(editor?: Editor) {
		if (!editor) {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView) {
				new Notice('Please open a note to insert D3 templates');
				return;
			}
			editor = activeView.editor;
		}

		new D3TemplateBrowserModal(this.app, editor, this).open();
	}

	private getTemplateMetadata() {
		return [
			{ 
				name: 'Basic Circle', 
				key: 'basic', 
				category: 'Basic',
				description: 'Simple circle for getting started with D3',
				icon: '⭕',
				tags: ['simple', 'basic', 'circle', 'starter']
			},
			{ 
				name: 'Bar Chart', 
				key: 'bar-chart', 
				category: 'Charts',
				description: 'Vertical bar chart with axes and labels',
				icon: '📊',
				tags: ['bar', 'chart', 'categorical', 'vertical']
			},
			{ 
				name: 'Horizontal Bar', 
				key: 'horizontal-bar', 
				category: 'Charts',
				description: 'Horizontal bar chart for long category names',
				icon: '📈',
				tags: ['bar', 'horizontal', 'categorical']
			},
			{ 
				name: 'Line Chart', 
				key: 'line-chart', 
				category: 'Charts',
				description: 'Line chart for continuous data over time',
				icon: '📉',
				tags: ['line', 'time', 'continuous', 'trend']
			},
			{ 
				name: 'Area Chart', 
				key: 'area-chart', 
				category: 'Charts',
				description: 'Filled area chart showing data volume',
				icon: '🏔️',
				tags: ['area', 'filled', 'volume', 'trend']
			},
			{ 
				name: 'Scatter Plot', 
				key: 'scatter-plot', 
				category: 'Charts',
				description: 'Scatter plot for correlation analysis',
				icon: '🔵',
				tags: ['scatter', 'correlation', 'dots', 'relationship']
			},
			{ 
				name: 'Bubble Chart', 
				key: 'bubble-chart', 
				category: 'Charts',
				description: 'Multi-dimensional scatter plot with size encoding',
				icon: '🫧',
				tags: ['bubble', 'multi-dimensional', 'size', 'scatter']
			},
			{ 
				name: 'Pie Chart', 
				key: 'pie-chart', 
				category: 'Circular',
				description: 'Classic pie chart for part-to-whole relationships',
				icon: '🥧',
				tags: ['pie', 'circular', 'proportions', 'parts']
			},
			{ 
				name: 'Donut Chart', 
				key: 'donut-chart', 
				category: 'Circular',
				description: 'Donut chart with center text area',
				icon: '🍩',
				tags: ['donut', 'circular', 'proportions', 'center']
			},
			{ 
				name: 'Histogram', 
				key: 'histogram', 
				category: 'Statistical',
				description: 'Distribution histogram for numerical data',
				icon: '📊',
				tags: ['histogram', 'distribution', 'frequency', 'bins']
			},
			{ 
				name: 'Box Plot', 
				key: 'box-plot', 
				category: 'Statistical',
				description: 'Box and whisker plot for statistical summary',
				icon: '📦',
				tags: ['box', 'whisker', 'quartiles', 'outliers']
			},
			{ 
				name: 'Violin Plot', 
				key: 'violin-plot', 
				category: 'Statistical',
				description: 'Violin plot combining box plot and density',
				icon: '🎻',
				tags: ['violin', 'density', 'distribution', 'statistical']
			},
			{ 
				name: 'Heatmap', 
				key: 'heatmap', 
				category: 'Matrix',
				description: 'Color-coded matrix for 2D data patterns',
				icon: '🔥',
				tags: ['heatmap', 'matrix', 'color', 'pattern']
			},
			{ 
				name: 'Chord Diagram', 
				key: 'chord', 
				category: 'Network',
				description: 'Circular chord diagram for relationships',
				icon: '🎵',
				tags: ['chord', 'circular', 'relationships', 'flow']
			},
			{ 
				name: 'Tree Diagram', 
				key: 'tree', 
				category: 'Hierarchical',
				description: 'Hierarchical tree structure visualization',
				icon: '🌳',
				tags: ['tree', 'hierarchy', 'structure', 'branches']
			},
			{ 
				name: 'Treemap', 
				key: 'treemap', 
				category: 'Hierarchical',
				description: 'Space-filling treemap for nested data',
				icon: '🟫',
				tags: ['treemap', 'nested', 'space-filling', 'rectangles']
			},
			{ 
				name: 'Sunburst', 
				key: 'sunburst', 
				category: 'Hierarchical',
				description: 'Radial sunburst chart for multi-level hierarchy',
				icon: '☀️',
				tags: ['sunburst', 'radial', 'hierarchy', 'levels']
			},
			{ 
				name: 'Force Network', 
				key: 'force-network', 
				category: 'Network',
				description: 'Interactive force-directed network graph',
				icon: '🕸️',
				tags: ['network', 'force', 'nodes', 'links', 'interactive']
			},
			{ 
				name: 'Sankey Diagram', 
				key: 'sankey', 
				category: 'Flow',
				description: 'Flow diagram showing quantity transfers',
				icon: '🌊',
				tags: ['sankey', 'flow', 'transfers', 'quantities']
			},
			{ 
				name: 'Timeline', 
				key: 'timeline', 
				category: 'Temporal',
				description: 'Linear timeline for chronological events',
				icon: '📅',
				tags: ['timeline', 'chronological', 'events', 'time']
			},
			{ 
				name: 'Gantt Chart', 
				key: 'gantt', 
				category: 'Temporal',
				description: 'Project timeline with task dependencies',
				icon: '📋',
				tags: ['gantt', 'project', 'schedule', 'tasks']
			},
			{ 
				name: 'Radar Chart', 
				key: 'radar', 
				category: 'Multidimensional',
				description: 'Multi-axis radar chart for comparisons',
				icon: '🎯',
				tags: ['radar', 'spider', 'multi-axis', 'comparison']
			},
			{ 
				name: 'Parallel Coordinates', 
				key: 'parallel', 
				category: 'Multidimensional',
				description: 'Parallel coordinate plot for high-dimensional data',
				icon: '📏',
				tags: ['parallel', 'coordinates', 'high-dimensional', 'multi-variate']
			},
			{ 
				name: 'Streamgraph', 
				key: 'streamgraph', 
				category: 'Flow',
				description: 'Flowing streamgraph for temporal data',
				icon: '🌊',
				tags: ['stream', 'flow', 'temporal', 'stacked']
			},
			{ 
				name: 'Candlestick', 
				key: 'candlestick', 
				category: 'Financial',
				description: 'Financial candlestick chart for OHLC data',
				icon: '💹',
				tags: ['candlestick', 'financial', 'ohlc', 'trading']
			},
			
			// Additional templates inspired by biovisualize/d3visualization gallery
			{ 
				name: 'Circle Packing', 
				key: 'circle-packing', 
				category: 'Hierarchical',
				description: 'Nested circles showing hierarchical data with size encoding',
				icon: '⚪',
				tags: ['circles', 'packing', 'hierarchy', 'nested', 'size']
			},
			{ 
				name: 'Force-Directed Graph', 
				key: 'force-directed-graph', 
				category: 'Network',
				description: 'Interactive network with physics-based node positioning',
				icon: '🕸️',
				tags: ['force', 'network', 'physics', 'interactive', 'drag']
			},
			{ 
				name: 'Zoomable Circle Packing', 
				key: 'zoomable-circle-packing', 
				category: 'Hierarchical',
				description: 'Interactive circle packing with zoom navigation',
				icon: '🔍',
				tags: ['zoom', 'circles', 'interactive', 'navigation', 'hierarchy']
			},
			{ 
				name: 'Chord Diagram', 
				key: 'chord-diagram', 
				category: 'Network',
				description: 'Circular chord diagram showing relationships between entities',
				icon: '🎵',
				tags: ['chord', 'circular', 'relationships', 'matrix', 'flow']
			},
			{ 
				name: 'Collapsible Tree', 
				key: 'collapsible-tree', 
				category: 'Hierarchical',
				description: 'Interactive tree with collapsible branches',
				icon: '🌲',
				tags: ['tree', 'collapsible', 'interactive', 'hierarchy', 'branches']
			},
			{ 
				name: 'Brush & Zoom Chart', 
				key: 'brush-zoom-chart', 
				category: 'Interactive',
				description: 'Line chart with brushing and zooming capabilities',
				icon: '🔍',
				tags: ['brush', 'zoom', 'interactive', 'line', 'selection']
			},
			
			// Additional biovisualize/d3visualization gallery templates
			{ 
				name: 'Choropleth Map', 
				key: 'choropleth-map', 
				category: 'Maps',
				description: 'Color-coded geographic map for regional data',
				icon: '🗺️',
				tags: ['map', 'choropleth', 'geographic', 'regional', 'geojson']
			},
			{ 
				name: 'Voronoi Diagram', 
				key: 'voronoi-diagram', 
				category: 'Geometric',
				description: 'Voronoi cell diagram showing spatial partitioning',
				icon: '🔺',
				tags: ['voronoi', 'cells', 'spatial', 'geometry', 'delaunay']
			},
			{ 
				name: 'Stacked Bar Chart', 
				key: 'stacked-bar-chart', 
				category: 'Charts',
				description: 'Multi-series stacked bar chart for comparative data',
				icon: '📊',
				tags: ['stacked', 'bar', 'multi-series', 'comparative']
			},
			{ 
				name: 'Cartogram', 
				key: 'cartogram', 
				category: 'Maps',
				description: 'Distorted map where areas represent data values',
				icon: '🗺️',
				tags: ['cartogram', 'distorted', 'map', 'data-driven', 'area']
			},
			{ 
				name: 'Reusable Line Chart', 
				key: 'reusable-line-chart', 
				category: 'Advanced',
				description: 'Configurable reusable line chart component',
				icon: '🔧',
				tags: ['reusable', 'component', 'configurable', 'line', 'modular']
			},
			{ 
				name: 'Math Visualization', 
				key: 'math-visualization', 
				category: 'Mathematical',
				description: 'Mathematical concepts visualization (Prime Number Spiral)',
				icon: '🔢',
				tags: ['math', 'prime', 'spiral', 'numbers', 'mathematical']
			},
			{ 
				name: 'Experimental Vis', 
				key: 'experiment-vis', 
				category: 'Experimental',
				description: 'Experimental particle system with physics simulation',
				icon: '🧪',
				tags: ['experimental', 'particles', 'physics', 'animation', 'simulation']
			},
			{ 
				name: 'Axis Demo', 
				key: 'axis-demo', 
				category: 'Educational',
				description: 'Interactive demonstration of different axis types and scales',
				icon: '📐',
				tags: ['axis', 'scales', 'educational', 'demo', 'grid']
			}
		];
	}

	private insertTemplate(editor: Editor, templateKey: string) {
		const templates = this.getTemplates();
		const template = templates[templateKey];
		
		if (!template) {
			new Notice('Template not found');
			return;
		}

		const cursor = editor.getCursor();
		editor.replaceRange(`\`\`\`d3\n${template}\n\`\`\`\n`, cursor);
		new Notice(`Inserted ${templateKey} template`);
	}

	private getTemplates(): { [key: string]: string } {
		return {
			'basic': `// Create an SVG element
const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

// Add a circle
svg.append("circle")
  .attr("cx", width / 2)
  .attr("cy", height / 2)
  .attr("r", 50)
  .style("fill", utils.colors[0]);`,

			'bar-chart': `const data = [
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
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

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

// Add axes
g.append("g")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(x));

g.append("g")
  .call(d3.axisLeft(y));`,

			'horizontal-bar': `const data = [
  {name: 'Product A', value: 30},
  {name: 'Product B', value: 80},
  {name: 'Product C', value: 45},
  {name: 'Product D', value: 60}
];

const margin = utils.margin(20, 50, 30, 100);
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleLinear()
  .domain([0, d3.max(data, d => d.value)])
  .range([0, innerWidth]);

const y = d3.scaleBand()
  .domain(data.map(d => d.name))
  .range([0, innerHeight])
  .padding(0.1);

g.selectAll(".bar")
  .data(data)
  .enter().append("rect")
  .attr("class", "bar")
  .attr("x", 0)
  .attr("y", d => y(d.name))
  .attr("width", d => x(d.value))
  .attr("height", y.bandwidth())
  .style("fill", utils.colors[1]);

// Add axes
g.append("g")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(x));

g.append("g")
  .call(d3.axisLeft(y));`,

			'scatter-plot': `const data = d3.range(50).map(() => ({
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
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

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
  .attr("r", 4)
  .style("fill", utils.colors[1])
  .style("opacity", 0.7);

// Add axes
g.append("g")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(x));

g.append("g")
  .call(d3.axisLeft(y));`,

			'line-chart': `const data = d3.range(20).map(i => ({
  x: i,
  y: Math.sin(i * 0.5) * 50 + 50 + Math.random() * 20
}));

const margin = utils.margin();
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleLinear()
  .domain(d3.extent(data, d => d.x))
  .range([0, innerWidth]);

const y = d3.scaleLinear()
  .domain(d3.extent(data, d => d.y))
  .range([innerHeight, 0]);

const line = d3.line()
  .x(d => x(d.x))
  .y(d => y(d.y))
  .curve(d3.curveMonotoneX);

g.append("path")
  .datum(data)
  .attr("fill", "none")
  .attr("stroke", utils.colors[2])
  .attr("stroke-width", 2)
  .attr("d", line);

// Add dots
g.selectAll(".dot")
  .data(data)
  .enter().append("circle")
  .attr("class", "dot")
  .attr("cx", d => x(d.x))
  .attr("cy", d => y(d.y))
  .attr("r", 3)
  .style("fill", utils.colors[2]);

// Add axes
g.append("g")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(x));

g.append("g")
  .call(d3.axisLeft(y));`,

			'area-chart': `const data = d3.range(30).map(i => ({
  x: i,
  y: Math.sin(i * 0.3) * 30 + 50 + Math.random() * 15
}));

const margin = utils.margin();
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleLinear()
  .domain(d3.extent(data, d => d.x))
  .range([0, innerWidth]);

const y = d3.scaleLinear()
  .domain(d3.extent(data, d => d.y))
  .range([innerHeight, 0]);

const area = d3.area()
  .x(d => x(d.x))
  .y0(innerHeight)
  .y1(d => y(d.y))
  .curve(d3.curveMonotoneX);

g.append("path")
  .datum(data)
  .attr("fill", utils.colors[3])
  .attr("fill-opacity", 0.7)
  .attr("d", area);

const line = d3.line()
  .x(d => x(d.x))
  .y(d => y(d.y))
  .curve(d3.curveMonotoneX);

g.append("path")
  .datum(data)
  .attr("fill", "none")
  .attr("stroke", utils.colors[3])
  .attr("stroke-width", 2)
  .attr("d", line);

// Add axes
g.append("g")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(x));

g.append("g")
  .call(d3.axisLeft(y));`,

			'bubble-chart': `const data = d3.range(30).map(() => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 50 + 10,
  category: Math.floor(Math.random() * 4)
}));

const margin = utils.margin();
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleLinear()
  .domain([0, 100])
  .range([0, innerWidth]);

const y = d3.scaleLinear()
  .domain([0, 100])
  .range([innerHeight, 0]);

const sizeScale = d3.scaleSqrt()
  .domain([0, d3.max(data, d => d.size)])
  .range([3, 20]);

g.selectAll(".bubble")
  .data(data)
  .enter().append("circle")
  .attr("class", "bubble")
  .attr("cx", d => x(d.x))
  .attr("cy", d => y(d.y))
  .attr("r", d => sizeScale(d.size))
  .style("fill", d => utils.colors[d.category])
  .style("opacity", 0.7)
  .style("stroke", "white")
  .style("stroke-width", 1);

// Add axes
g.append("g")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(x));

g.append("g")
  .call(d3.axisLeft(y));`,

			'pie-chart': `const data = [
  {label: 'Category A', value: 30},
  {label: 'Category B', value: 25},
  {label: 'Category C', value: 20},
  {label: 'Category D', value: 15},
  {label: 'Category E', value: 10}
];

const radius = Math.min(width, height) / 2 - 20;

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${width/2},\${height/2})\`);

const pie = d3.pie()
  .value(d => d.value)
  .sort(null);

const arc = d3.arc()
  .innerRadius(0)
  .outerRadius(radius);

const arcs = g.selectAll(".arc")
  .data(pie(data))
  .enter().append("g")
  .attr("class", "arc");

arcs.append("path")
  .attr("d", arc)
  .style("fill", (d, i) => utils.colors[i]);

arcs.append("text")
  .attr("transform", d => \`translate(\${arc.centroid(d)})\`)
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .text(d => d.data.label);`,

			'donut-chart': `const data = [
  {label: 'Desktop', value: 45},
  {label: 'Mobile', value: 35},
  {label: 'Tablet', value: 20}
];

const radius = Math.min(width, height) / 2 - 20;
const innerRadius = radius * 0.6;

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${width/2},\${height/2})\`);

const pie = d3.pie()
  .value(d => d.value)
  .sort(null);

const arc = d3.arc()
  .innerRadius(innerRadius)
  .outerRadius(radius);

const arcs = g.selectAll(".arc")
  .data(pie(data))
  .enter().append("g")
  .attr("class", "arc");

arcs.append("path")
  .attr("d", arc)
  .style("fill", (d, i) => utils.colors[i]);

arcs.append("text")
  .attr("transform", d => \`translate(\${arc.centroid(d)})\`)
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .style("fill", "white")
  .text(d => d.data.label);

// Center text
g.append("text")
  .attr("text-anchor", "middle")
  .attr("dy", "0.35em")
  .style("font-size", "16px")
  .style("font-weight", "bold")
  .text("Total: 100%");`,

			'histogram': `const data = d3.range(1000).map(d3.randomNormal(50, 15));

const margin = utils.margin();
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleLinear()
  .domain(d3.extent(data))
  .range([0, innerWidth]);

const histogram = d3.histogram()
  .value(d => d)
  .domain(x.domain())
  .thresholds(x.ticks(20));

const bins = histogram(data);

const y = d3.scaleLinear()
  .domain([0, d3.max(bins, d => d.length)])
  .range([innerHeight, 0]);

g.selectAll(".bar")
  .data(bins)
  .enter().append("rect")
  .attr("class", "bar")
  .attr("x", d => x(d.x0))
  .attr("y", d => y(d.length))
  .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
  .attr("height", d => innerHeight - y(d.length))
  .style("fill", utils.colors[4])
  .style("opacity", 0.8);

// Add axes
g.append("g")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(x));

g.append("g")
  .call(d3.axisLeft(y));`,

			'heatmap': `const data = [];
for (let i = 0; i < 10; i++) {
  for (let j = 0; j < 8; j++) {
    data.push({
      row: i,
      col: j,
      value: Math.random()
    });
  }
}

const margin = utils.margin(50, 20, 50, 50);
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const cellWidth = innerWidth / 8;
const cellHeight = innerHeight / 10;

const colorScale = d3.scaleSequential(d3.interpolateBlues)
  .domain([0, 1]);

g.selectAll(".cell")
  .data(data)
  .enter().append("rect")
  .attr("class", "cell")
  .attr("x", d => d.col * cellWidth)
  .attr("y", d => d.row * cellHeight)
  .attr("width", cellWidth - 1)
  .attr("height", cellHeight - 1)
  .style("fill", d => colorScale(d.value))
  .style("stroke", "white")
  .style("stroke-width", 1);

// Add labels
const xLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const yLabels = d3.range(10).map(i => \`Row \${i+1}\`);

g.selectAll(".col-label")
  .data(xLabels)
  .enter().append("text")
  .attr("class", "col-label")
  .attr("x", (d, i) => i * cellWidth + cellWidth / 2)
  .attr("y", -10)
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .text(d => d);

g.selectAll(".row-label")
  .data(yLabels)
  .enter().append("text")
  .attr("class", "row-label")
  .attr("x", -10)
  .attr("y", (d, i) => i * cellHeight + cellHeight / 2)
  .attr("text-anchor", "end")
  .attr("dy", "0.35em")
  .style("font-size", "12px")
  .text(d => d);`,

			'force-network': `const nodes = d3.range(20).map(i => ({
  id: i,
  group: Math.floor(i / 5)
}));

const links = d3.range(30).map(() => ({
  source: Math.floor(Math.random() * 20),
  target: Math.floor(Math.random() * 20)
}));

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(links).id(d => d.id))
  .force("charge", d3.forceManyBody().strength(-200))
  .force("center", d3.forceCenter(width / 2, height / 2));

const link = svg.append("g")
  .selectAll("line")
  .data(links)
  .enter().append("line")
  .style("stroke", "#999")
  .style("stroke-width", 2)
  .style("opacity", 0.6);

const node = svg.append("g")
  .selectAll("circle")
  .data(nodes)
  .enter().append("circle")
  .attr("r", 8)
  .style("fill", d => utils.colors[d.group])
  .call(d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended));

simulation.on("tick", () => {
  link
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);

  node
    .attr("cx", d => d.x)
    .attr("cy", d => d.y);
});

function dragstarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragended(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}`,

			'tree': `const treeData = {
  name: "Root",
  children: [
    {
      name: "Branch A",
      children: [
        {name: "Leaf A1"},
        {name: "Leaf A2"},
        {name: "Leaf A3"}
      ]
    },
    {
      name: "Branch B",
      children: [
        {name: "Leaf B1"},
        {name: "Leaf B2"}
      ]
    },
    {
      name: "Branch C",
      children: [
        {name: "Leaf C1"}
      ]
    }
  ]
};

const margin = utils.margin(20, 120, 20, 120);
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const tree = d3.tree()
  .size([innerHeight, innerWidth]);

const root = d3.hierarchy(treeData);
tree(root);

const link = g.selectAll(".link")
  .data(root.links())
  .enter().append("path")
  .attr("class", "link")
  .style("fill", "none")
  .style("stroke", "#999")
  .style("stroke-width", 2)
  .attr("d", d3.linkHorizontal()
    .x(d => d.y)
    .y(d => d.x));

const node = g.selectAll(".node")
  .data(root.descendants())
  .enter().append("g")
  .attr("class", "node")
  .attr("transform", d => \`translate(\${d.y},\${d.x})\`);

node.append("circle")
  .attr("r", 6)
  .style("fill", utils.colors[0])
  .style("stroke", "white")
  .style("stroke-width", 2);

node.append("text")
  .attr("dy", "0.35em")
  .attr("x", d => d.children ? -13 : 13)
  .style("text-anchor", d => d.children ? "end" : "start")
  .style("font-size", "12px")
  .text(d => d.data.name);`,

			'treemap': `const data = {
  name: "root",
  children: [
    {name: "A", value: 30},
    {name: "B", value: 25},
    {name: "C", value: 20},
    {name: "D", value: 15},
    {name: "E", value: 10}
  ]
};

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const root = d3.hierarchy(data)
  .sum(d => d.value)
  .sort((a, b) => b.value - a.value);

d3.treemap()
  .size([width, height])
  .padding(2)(root);

const leaf = svg.selectAll("g")
  .data(root.leaves())
  .enter().append("g")
  .attr("transform", d => \`translate(\${d.x0},\${d.y0})\`);

leaf.append("rect")
  .attr("width", d => d.x1 - d.x0)
  .attr("height", d => d.y1 - d.y0)
  .style("fill", (d, i) => utils.colors[i])
  .style("stroke", "white")
  .style("stroke-width", 2);

leaf.append("text")
  .attr("x", 4)
  .attr("y", 16)
  .style("font-size", "14px")
  .style("font-weight", "bold")
  .style("fill", "white")
  .text(d => d.data.name);

leaf.append("text")
  .attr("x", 4)
  .attr("y", 32)
  .style("font-size", "12px")
  .style("fill", "white")
  .text(d => d.data.value);`,

			'timeline': `const events = [
  {date: "2023-01", event: "Project Started", type: "milestone"},
  {date: "2023-03", event: "Phase 1 Complete", type: "milestone"},
  {date: "2023-05", event: "Beta Release", type: "release"},
  {date: "2023-07", event: "User Testing", type: "testing"},
  {date: "2023-09", event: "Final Release", type: "release"},
  {date: "2023-11", event: "Project End", type: "milestone"}
];

const parseTime = d3.timeParse("%Y-%m");
events.forEach(d => d.parsedDate = parseTime(d.date));

const margin = utils.margin(50, 50, 50, 50);
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleTime()
  .domain(d3.extent(events, d => d.parsedDate))
  .range([0, innerWidth]);

const colorScale = d3.scaleOrdinal()
  .domain(["milestone", "release", "testing"])
  .range([utils.colors[0], utils.colors[1], utils.colors[2]]);

// Timeline line
g.append("line")
  .attr("x1", 0)
  .attr("x2", innerWidth)
  .attr("y1", innerHeight / 2)
  .attr("y2", innerHeight / 2)
  .style("stroke", "#999")
  .style("stroke-width", 3);

// Event points
g.selectAll(".event")
  .data(events)
  .enter().append("circle")
  .attr("class", "event")
  .attr("cx", d => x(d.parsedDate))
  .attr("cy", innerHeight / 2)
  .attr("r", 8)
  .style("fill", d => colorScale(d.type))
  .style("stroke", "white")
  .style("stroke-width", 3);

// Event labels
g.selectAll(".label")
  .data(events)
  .enter().append("text")
  .attr("class", "label")
  .attr("x", d => x(d.parsedDate))
  .attr("y", (d, i) => i % 2 === 0 ? innerHeight / 2 - 20 : innerHeight / 2 + 35)
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .text(d => d.event);

// Date labels
g.selectAll(".date")
  .data(events)
  .enter().append("text")
  .attr("class", "date")
  .attr("x", d => x(d.parsedDate))
  .attr("y", (d, i) => i % 2 === 0 ? innerHeight / 2 - 35 : innerHeight / 2 + 50)
  .attr("text-anchor", "middle")
  .style("font-size", "10px")
  .style("fill", "#666")
  .text(d => d.date);`,

			'radar': `const data = [
  {axis: "Speed", value: 0.8},
  {axis: "Reliability", value: 0.6},
  {axis: "Comfort", value: 0.9},
  {axis: "Safety", value: 0.7},
  {axis: "Efficiency", value: 0.5},
  {axis: "Price", value: 0.3}
];

const cfg = {
  radius: Math.min(width, height) / 2 - 50,
  levels: 5,
  maxValue: 1
};

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${width/2},\${height/2})\`);

const angleSlice = Math.PI * 2 / data.length;

// Create the background circles
for (let j = 0; j < cfg.levels; j++) {
  const levelFactor = cfg.radius * ((j + 1) / cfg.levels);
  
  g.append("circle")
    .attr("r", levelFactor)
    .style("fill", "none")
    .style("stroke", "#CDCDCD")
    .style("stroke-width", "1px")
    .style("stroke-dasharray", "3,3");
}

// Create the axes
const axes = g.selectAll(".axis")
  .data(data)
  .enter().append("g")
  .attr("class", "axis");

axes.append("line")
  .attr("x1", 0)
  .attr("y1", 0)
  .attr("x2", (d, i) => cfg.radius * Math.cos(angleSlice * i - Math.PI / 2))
  .attr("y2", (d, i) => cfg.radius * Math.sin(angleSlice * i - Math.PI / 2))
  .style("stroke", "#999")
  .style("stroke-width", "2px");

// Add axis labels
axes.append("text")
  .attr("x", (d, i) => (cfg.radius + 20) * Math.cos(angleSlice * i - Math.PI / 2))
  .attr("y", (d, i) => (cfg.radius + 20) * Math.sin(angleSlice * i - Math.PI / 2))
  .attr("dy", "0.35em")
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .text(d => d.axis);

// Create the radar line
const radarLine = d3.lineRadial()
  .angle((d, i) => i * angleSlice)
  .radius(d => cfg.radius * (d.value / cfg.maxValue))
  .curve(d3.curveLinearClosed);

const radarPath = g.append("path")
  .datum(data)
  .attr("d", radarLine)
  .style("fill", utils.colors[0])
  .style("fill-opacity", 0.3)
  .style("stroke", utils.colors[0])
  .style("stroke-width", "2px");

// Add the data points
g.selectAll(".radar-point")
  .data(data)
  .enter().append("circle")
  .attr("class", "radar-point")
  .attr("cx", (d, i) => cfg.radius * (d.value / cfg.maxValue) * Math.cos(angleSlice * i - Math.PI / 2))
  .attr("cy", (d, i) => cfg.radius * (d.value / cfg.maxValue) * Math.sin(angleSlice * i - Math.PI / 2))
  .attr("r", 4)
  .style("fill", utils.colors[0])
  .style("stroke", "white")
  .style("stroke-width", "2px");`,

			'sankey': `// Sankey diagrams require d3-sankey plugin, 
// this is a simplified flow diagram
const nodes = [
  {name: "Source A", layer: 0},
  {name: "Source B", layer: 0},
  {name: "Middle", layer: 1},
  {name: "Target X", layer: 2},
  {name: "Target Y", layer: 2}
];

const links = [
  {source: 0, target: 2, value: 30},
  {source: 1, target: 2, value: 20},
  {source: 2, target: 3, value: 25},
  {source: 2, target: 4, value: 25}
];

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const nodeWidth = 20;
const nodePadding = 40;

// Position nodes
const layers = d3.group(nodes, d => d.layer);
layers.forEach((layerNodes, layer) => {
  const x = (layer * width) / (layers.size - 1);
  const yStep = height / (layerNodes.length + 1);
  layerNodes.forEach((node, i) => {
    node.x = x;
    node.y = (i + 1) * yStep;
  });
});

// Draw links
const link = svg.selectAll(".link")
  .data(links)
  .enter().append("path")
  .attr("class", "link")
  .attr("d", d => {
    const source = nodes[d.source];
    const target = nodes[d.target];
    return \`M\${source.x + nodeWidth},\${source.y} 
            C\${(source.x + target.x) / 2},\${source.y} 
            \${(source.x + target.x) / 2},\${target.y} 
            \${target.x},\${target.y}\`;
  })
  .style("fill", "none")
  .style("stroke", utils.colors[5])
  .style("stroke-width", d => Math.max(1, d.value / 2))
  .style("opacity", 0.7);

// Draw nodes
const node = svg.selectAll(".node")
  .data(nodes)
  .enter().append("rect")
  .attr("class", "node")
  .attr("x", d => d.x)
  .attr("y", d => d.y - 15)
  .attr("width", nodeWidth)
  .attr("height", 30)
  .style("fill", utils.colors[3])
  .style("stroke", "white")
  .style("stroke-width", 2);

// Add labels
svg.selectAll(".label")
  .data(nodes)
  .enter().append("text")
  .attr("class", "label")
  .attr("x", d => d.x + nodeWidth / 2)
  .attr("y", d => d.y - 20)
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .text(d => d.name);`,

			'candlestick': `const data = d3.range(30).map(i => {
  const open = 100 + Math.random() * 50;
  const close = open + (Math.random() - 0.5) * 20;
  const high = Math.max(open, close) + Math.random() * 10;
  const low = Math.min(open, close) - Math.random() * 10;
  return {
    date: i,
    open: open,
    high: high,
    low: low,
    close: close
  };
});

const margin = utils.margin();
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleBand()
  .domain(data.map(d => d.date))
  .range([0, innerWidth])
  .padding(0.3);

const y = d3.scaleLinear()
  .domain(d3.extent(data.flatMap(d => [d.low, d.high])))
  .range([innerHeight, 0]);

const candleWidth = x.bandwidth();

// High-low lines
g.selectAll(".high-low")
  .data(data)
  .enter().append("line")
  .attr("class", "high-low")
  .attr("x1", d => x(d.date) + candleWidth / 2)
  .attr("x2", d => x(d.date) + candleWidth / 2)
  .attr("y1", d => y(d.high))
  .attr("y2", d => y(d.low))
  .style("stroke", "#666")
  .style("stroke-width", 1);

// Candle bodies
g.selectAll(".candle")
  .data(data)
  .enter().append("rect")
  .attr("class", "candle")
  .attr("x", d => x(d.date))
  .attr("y", d => y(Math.max(d.open, d.close)))
  .attr("width", candleWidth)
  .attr("height", d => Math.abs(y(d.open) - y(d.close)))
  .style("fill", d => d.close > d.open ? "#4CAF50" : "#F44336")
  .style("stroke", d => d.close > d.open ? "#388E3C" : "#D32F2F")
  .style("stroke-width", 1);

// Add axes
g.append("g")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(x));

g.append("g")
  .call(d3.axisLeft(y));`,

			'box-plot': `const data = [
  {category: 'A', values: d3.range(100).map(() => d3.randomNormal(50, 15)())},
  {category: 'B', values: d3.range(100).map(() => d3.randomNormal(60, 20)())},
  {category: 'C', values: d3.range(100).map(() => d3.randomNormal(40, 10)())},
  {category: 'D', values: d3.range(100).map(() => d3.randomNormal(70, 25)())}
];

const margin = utils.margin();
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleBand()
  .domain(data.map(d => d.category))
  .range([0, innerWidth])
  .padding(0.3);

const allValues = data.flatMap(d => d.values);
const y = d3.scaleLinear()
  .domain(d3.extent(allValues))
  .range([innerHeight, 0]);

// Calculate quartiles for each category
const processedData = data.map(d => {
  const sorted = d.values.sort(d3.ascending);
  const q1 = d3.quantile(sorted, 0.25);
  const median = d3.quantile(sorted, 0.5);
  const q3 = d3.quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const min = Math.max(d3.min(sorted), q1 - 1.5 * iqr);
  const max = Math.min(d3.max(sorted), q3 + 1.5 * iqr);
  
  return {
    category: d.category,
    q1: q1,
    median: median,
    q3: q3,
    min: min,
    max: max
  };
});

const boxWidth = x.bandwidth() * 0.7;

processedData.forEach(d => {
  const centerX = x(d.category) + x.bandwidth() / 2;
  
  // Whiskers
  g.append("line")
    .attr("x1", centerX)
    .attr("x2", centerX)
    .attr("y1", y(d.min))
    .attr("y2", y(d.max))
    .style("stroke", "#666")
    .style("stroke-width", 1);
  
  // Min/Max lines
  [d.min, d.max].forEach(value => {
    g.append("line")
      .attr("x1", centerX - boxWidth / 4)
      .attr("x2", centerX + boxWidth / 4)
      .attr("y1", y(value))
      .attr("y2", y(value))
      .style("stroke", "#666")
      .style("stroke-width", 1);
  });
  
  // Box
  g.append("rect")
    .attr("x", centerX - boxWidth / 2)
    .attr("y", y(d.q3))
    .attr("width", boxWidth)
    .attr("height", y(d.q1) - y(d.q3))
    .style("fill", utils.colors[0])
    .style("fill-opacity", 0.7)
    .style("stroke", utils.colors[0])
    .style("stroke-width", 2);
  
  // Median line
  g.append("line")
    .attr("x1", centerX - boxWidth / 2)
    .attr("x2", centerX + boxWidth / 2)
    .attr("y1", y(d.median))
    .attr("y2", y(d.median))
    .style("stroke", "#000")
    .style("stroke-width", 2);
});

// Add axes
g.append("g")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(x));

g.append("g")
  .call(d3.axisLeft(y));`,

			'violin-plot': `const data = [
  {category: 'Group A', values: d3.range(200).map(() => d3.randomNormal(50, 15)())},
  {category: 'Group B', values: d3.range(200).map(() => d3.randomNormal(60, 10)())},
  {category: 'Group C', values: d3.range(200).map(() => d3.randomNormal(40, 20)())}
];

const margin = utils.margin();
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleBand()
  .domain(data.map(d => d.category))
  .range([0, innerWidth])
  .padding(0.2);

const allValues = data.flatMap(d => d.values);
const y = d3.scaleLinear()
  .domain(d3.extent(allValues))
  .range([innerHeight, 0]);

data.forEach(categoryData => {
  const centerX = x(categoryData.category) + x.bandwidth() / 2;
  const violinWidth = x.bandwidth() * 0.8;
  
  // Create density estimation
  const bins = d3.histogram()
    .domain(y.domain())
    .thresholds(20)(categoryData.values);
  
  const maxDensity = d3.max(bins, d => d.length);
  const densityScale = d3.scaleLinear()
    .domain([0, maxDensity])
    .range([0, violinWidth / 2]);
  
  // Create violin shape
  const violinPath = bins.map(bin => {
    const binY = y((bin.x0 + bin.x1) / 2);
    const binWidth = densityScale(bin.length);
    return [centerX - binWidth, binY, centerX + binWidth, binY];
  });
  
  // Draw left side of violin
  const leftSide = violinPath.map(d => [d[0], d[1]]);
  leftSide.unshift([centerX, y.range()[0]]);
  leftSide.push([centerX, y.range()[1]]);
  
  // Draw right side of violin
  const rightSide = violinPath.map(d => [d[2], d[3]]).reverse();
  rightSide.unshift([centerX, y.range()[1]]);
  rightSide.push([centerX, y.range()[0]]);
  
  const fullPath = leftSide.concat(rightSide);
  
  const line = d3.line()
    .x(d => d[0])
    .y(d => d[1])
    .curve(d3.curveCardinal);
  
  g.append("path")
    .datum(fullPath)
    .attr("d", line)
    .style("fill", utils.colors[data.indexOf(categoryData)])
    .style("fill-opacity", 0.7)
    .style("stroke", utils.colors[data.indexOf(categoryData)])
    .style("stroke-width", 1);
  
  // Add median line
  const median = d3.median(categoryData.values);
  g.append("line")
    .attr("x1", centerX - violinWidth / 4)
    .attr("x2", centerX + violinWidth / 4)
    .attr("y1", y(median))
    .attr("y2", y(median))
    .style("stroke", "#000")
    .style("stroke-width", 2);
});

// Add axes
g.append("g")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(x));

g.append("g")
  .call(d3.axisLeft(y));`,

			'chord': `const matrix = [
  [11975,  5871, 8916, 2868],
  [ 1951, 10048, 2060, 6171],
  [ 8010, 16145, 8090, 8045],
  [ 1013,   990,  940, 6907]
];

const names = ["Group A", "Group B", "Group C", "Group D"];

const radius = Math.min(width, height) / 2 - 40;

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${width/2},\${height/2})\`);

const chord = d3.chord()
  .padAngle(0.05)
  .sortSubgroups(d3.descending);

const arc = d3.arc()
  .innerRadius(radius - 20)
  .outerRadius(radius);

const ribbon = d3.ribbon()
  .radius(radius - 20);

const chords = chord(matrix);

// Add groups
const group = g.append("g")
  .selectAll("g")
  .data(chords.groups)
  .enter().append("g");

group.append("path")
  .style("fill", (d, i) => utils.colors[i])
  .style("stroke", "#fff")
  .attr("d", arc);

group.append("text")
  .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
  .attr("dy", ".35em")
  .attr("transform", d => \`
    rotate(\${(d.angle * 180 / Math.PI - 90)})
    translate(\${radius + 10})
    \${d.angle > Math.PI ? "rotate(180)" : ""}
  \`)
  .style("text-anchor", d => d.angle > Math.PI ? "end" : null)
  .style("font-size", "12px")
  .text((d, i) => names[i]);

// Add ribbons
g.append("g")
  .selectAll("path")
  .data(chords)
  .enter().append("path")
  .attr("d", ribbon)
  .style("fill", d => utils.colors[d.source.index])
  .style("fill-opacity", 0.7)
  .style("stroke", "#fff")
  .style("stroke-width", 1);`,

			'sunburst': `const data = {
  name: "root",
  children: [
    {
      name: "Technology",
      children: [
        {name: "Frontend", value: 30},
        {name: "Backend", value: 25},
        {name: "Mobile", value: 20},
        {name: "DevOps", value: 15}
      ]
    },
    {
      name: "Business",
      children: [
        {name: "Sales", value: 35},
        {name: "Marketing", value: 30},
        {name: "Support", value: 20}
      ]
    },
    {
      name: "Operations",
      children: [
        {name: "HR", value: 25},
        {name: "Finance", value: 30},
        {name: "Legal", value: 15}
      ]
    }
  ]
};

const radius = Math.min(width, height) / 2;

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${width/2},\${height/2})\`);

const partition = d3.partition()
  .size([2 * Math.PI, radius]);

const root = d3.hierarchy(data)
  .sum(d => d.value)
  .sort((a, b) => b.value - a.value);

partition(root);

const arc = d3.arc()
  .startAngle(d => d.x0)
  .endAngle(d => d.x1)
  .innerRadius(d => d.y0)
  .outerRadius(d => d.y1);

const paths = g.selectAll("path")
  .data(root.descendants())
  .enter().append("path")
  .attr("d", arc)
  .style("fill", (d, i) => utils.colors[i % utils.colors.length])
  .style("fill-opacity", d => d.depth === 0 ? 0 : 0.8)
  .style("stroke", "#fff")
  .style("stroke-width", 2);

// Add labels
g.selectAll("text")
  .data(root.descendants().filter(d => d.depth > 0))
  .enter().append("text")
  .attr("transform", d => {
    const angle = (d.x0 + d.x1) / 2;
    const radius = (d.y0 + d.y1) / 2;
    return \`rotate(\${(angle * 180 / Math.PI - 90)}) translate(\${radius},0) rotate(\${angle > Math.PI ? 180 : 0})\`;
  })
  .attr("dy", "0.35em")
  .attr("text-anchor", d => (d.x0 + d.x1) / 2 > Math.PI ? "end" : "start")
  .style("font-size", "10px")
  .style("fill", "#000")
  .text(d => d.data.name);`,

			'gantt': `const tasks = [
  {name: "Planning", start: new Date(2023, 0, 1), end: new Date(2023, 0, 15), type: "planning"},
  {name: "Design", start: new Date(2023, 0, 10), end: new Date(2023, 1, 5), type: "design"},
  {name: "Development", start: new Date(2023, 1, 1), end: new Date(2023, 3, 15), type: "development"},
  {name: "Testing", start: new Date(2023, 3, 10), end: new Date(2023, 4, 5), type: "testing"},
  {name: "Deployment", start: new Date(2023, 4, 1), end: new Date(2023, 4, 15), type: "deployment"}
];

const margin = utils.margin(20, 50, 30, 150);
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleTime()
  .domain(d3.extent(tasks.flatMap(d => [d.start, d.end])))
  .range([0, innerWidth]);

const y = d3.scaleBand()
  .domain(tasks.map(d => d.name))
  .range([0, innerHeight])
  .padding(0.2);

const colorScale = d3.scaleOrdinal()
  .domain(["planning", "design", "development", "testing", "deployment"])
  .range(utils.colors);

// Task bars
g.selectAll(".task")
  .data(tasks)
  .enter().append("rect")
  .attr("class", "task")
  .attr("x", d => x(d.start))
  .attr("y", d => y(d.name))
  .attr("width", d => x(d.end) - x(d.start))
  .attr("height", y.bandwidth())
  .style("fill", d => colorScale(d.type))
  .style("stroke", "white")
  .style("stroke-width", 1)
  .style("rx", 3);

// Task labels
g.selectAll(".task-label")
  .data(tasks)
  .enter().append("text")
  .attr("class", "task-label")
  .attr("x", d => x(d.start) + (x(d.end) - x(d.start)) / 2)
  .attr("y", d => y(d.name) + y.bandwidth() / 2)
  .attr("dy", "0.35em")
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .style("fill", "white")
  .style("font-weight", "bold")
  .text(d => d.name);

// Add axes
g.append("g")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%b %Y")));

g.append("g")
  .call(d3.axisLeft(y));

// Add today line
const today = new Date();
g.append("line")
  .attr("x1", x(today))
  .attr("x2", x(today))
  .attr("y1", 0)
  .attr("y2", innerHeight)
  .style("stroke", "red")
  .style("stroke-width", 2)
  .style("stroke-dasharray", "5,5");`,

			'parallel': `const data = d3.range(50).map(() => ({
  feature1: Math.random() * 100,
  feature2: Math.random() * 50 + 25,
  feature3: Math.random() * 80 + 10,
  feature4: Math.random() * 60 + 20,
  feature5: Math.random() * 90 + 5,
  category: Math.floor(Math.random() * 3)
}));

const features = ["feature1", "feature2", "feature3", "feature4", "feature5"];

const margin = utils.margin(30, 30, 30, 30);
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

// Scales for each dimension
const yScales = {};
features.forEach(feature => {
  yScales[feature] = d3.scaleLinear()
    .domain(d3.extent(data, d => d[feature]))
    .range([innerHeight, 0]);
});

const x = d3.scalePoint()
  .domain(features)
  .range([0, innerWidth]);

// Line generator
const line = d3.line()
  .x((d, i) => x(features[i]))
  .y((d, i) => yScales[features[i]](d));

// Draw lines
g.selectAll(".data-line")
  .data(data)
  .enter().append("path")
  .attr("class", "data-line")
  .attr("d", d => line(features.map(feature => d[feature])))
  .style("fill", "none")
  .style("stroke", d => utils.colors[d.category])
  .style("stroke-width", 2)
  .style("opacity", 0.7);

// Draw axes
features.forEach(feature => {
  const axis = g.append("g")
    .attr("transform", \`translate(\${x(feature)},0)\`)
    .call(d3.axisLeft(yScales[feature]));
  
  axis.append("text")
    .attr("y", -20)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("fill", "#000")
    .text(feature);
});`,

			'streamgraph': `const data = [];
const categories = ['Cat A', 'Cat B', 'Cat C', 'Cat D'];
const timePoints = d3.range(20);

timePoints.forEach(time => {
  const point = {time: time};
  categories.forEach((cat, i) => {
    point[cat] = Math.max(0, Math.sin(time * 0.5 + i) * 20 + 30 + Math.random() * 10);
  });
  data.push(point);
});

const margin = utils.margin();
const innerWidth = utils.innerWidth(width, margin);
const innerHeight = utils.innerHeight(height, margin);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleLinear()
  .domain(d3.extent(data, d => d.time))
  .range([0, innerWidth]);

const stack = d3.stack()
  .keys(categories)
  .offset(d3.stackOffsetWiggle)
  .order(d3.stackOrderNone);

const stackedData = stack(data);

const y = d3.scaleLinear()
  .domain(d3.extent(stackedData.flat(2)))
  .range([innerHeight, 0]);

const area = d3.area()
  .x(d => x(d.data.time))
  .y0(d => y(d[0]))
  .y1(d => y(d[1]))
  .curve(d3.curveBasis);

g.selectAll(".layer")
  .data(stackedData)
  .enter().append("path")
  .attr("class", "layer")
  .attr("d", area)
  .style("fill", (d, i) => utils.colors[i])
  .style("opacity", 0.8);

// Add axes
g.append("g")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(x));

g.append("g")
  .call(d3.axisLeft(y));`,

			// Additional templates inspired by biovisualize/d3visualization gallery
			// Credit: https://github.com/biovisualize/d3visualization
			'circle-packing': `const data = {
  name: "root",
  children: [
    {name: "Group A", value: 120},
    {name: "Group B", value: 90},
    {name: "Group C", value: 80},
    {name: "Group D", value: 60},
    {name: "Group E", value: 40}
  ]
};

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const pack = d3.pack()
  .size([width, height])
  .padding(3);

const root = d3.hierarchy(data)
  .sum(d => d.value);

pack(root);

const nodes = svg.selectAll('circle')
  .data(root.descendants())
  .enter()
  .append('circle')
  .attr('cx', d => d.x)
  .attr('cy', d => d.y)
  .attr('r', d => d.r)
  .style('fill', (d, i) => d.children ? utils.colors[0] : utils.colors[i % utils.colors.length])
  .style('fill-opacity', d => d.children ? 0.3 : 0.8)
  .style('stroke', 'white')
  .style('stroke-width', 2);

svg.selectAll('text')
  .data(root.descendants().filter(d => !d.children))
  .enter()
  .append('text')
  .attr('x', d => d.x)
  .attr('y', d => d.y)
  .attr('text-anchor', 'middle')
  .attr('dy', '0.35em')
  .style('font-size', '12px')
  .text(d => d.data.name);`,

			'force-directed-graph': `const nodes = [
  {id: "A", group: 1},
  {id: "B", group: 1},
  {id: "C", group: 2},
  {id: "D", group: 2},
  {id: "E", group: 3},
  {id: "F", group: 3}
];

const links = [
  {source: "A", target: "B"},
  {source: "A", target: "C"},
  {source: "B", target: "D"},
  {source: "C", target: "E"},
  {source: "D", target: "F"},
  {source: "E", target: "F"}
];

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(links).id(d => d.id).distance(80))
  .force("charge", d3.forceManyBody().strength(-300))
  .force("center", d3.forceCenter(width / 2, height / 2));

const link = svg.append("g")
  .selectAll("line")
  .data(links)
  .enter().append("line")
  .style("stroke", "#999")
  .style("stroke-opacity", 0.6)
  .style("stroke-width", 2);

const node = svg.append("g")
  .selectAll("circle")
  .data(nodes)
  .enter().append("circle")
  .attr("r", 10)
  .style("fill", d => utils.colors[d.group - 1])
  .call(d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended));

const label = svg.append("g")
  .selectAll("text")
  .data(nodes)
  .enter().append("text")
  .text(d => d.id)
  .style("text-anchor", "middle")
  .style("dominant-baseline", "central")
  .style("font-size", "12px");

simulation.on("tick", () => {
  link
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);

  node
    .attr("cx", d => d.x)
    .attr("cy", d => d.y);

  label
    .attr("x", d => d.x)
    .attr("y", d => d.y);
});

function dragstarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragended(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}`,

			'zoomable-circle-packing': `const data = {
  name: "Company",
  children: [
    {
      name: "Engineering",
      children: [
        {name: "Frontend", value: 120},
        {name: "Backend", value: 100},
        {name: "Mobile", value: 80}
      ]
    },
    {
      name: "Design",
      children: [
        {name: "UI/UX", value: 60},
        {name: "Graphics", value: 40}
      ]
    },
    {
      name: "Marketing",
      children: [
        {name: "Digital", value: 70},
        {name: "Content", value: 50}
      ]
    }
  ]
};

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height)
  .style("font", "10px sans-serif")
  .style("text-anchor", "middle");

const pack = d3.pack()
  .size([width, height])
  .padding(3);

const root = d3.hierarchy(data)
  .sum(d => d.value)
  .sort((a, b) => b.value - a.value);

let focus = root;
let view;

pack(root);

const node = svg.append("g")
  .selectAll("circle")
  .data(root.descendants())
  .join("circle")
  .attr("fill", d => d.children ? utils.colors[d.depth] : utils.colors[d.depth + 1])
  .attr("fill-opacity", d => d.children ? 0.3 : 0.8)
  .attr("pointer-events", d => !d.children ? "none" : null)
  .on("mouseover", function() { d3.select(this).attr("stroke", "#000"); })
  .on("mouseout", function() { d3.select(this).attr("stroke", null); })
  .on("click", (event, d) => focus !== d && (zoom(event, d), event.stopPropagation()));

const label = svg.append("g")
  .style("font", "12px sans-serif")
  .attr("pointer-events", "none")
  .attr("text-anchor", "middle")
  .selectAll("text")
  .data(root.descendants())
  .join("text")
  .style("fill-opacity", d => d.parent === root ? 1 : 0)
  .style("display", d => d.parent === root ? "inline" : "none")
  .text(d => d.data.name);

zoomTo([root.x, root.y, root.r * 2]);

function zoomTo(v) {
  const k = width / v[2];
  view = v;
  label.attr("transform", d => \`translate(\${(d.x - v[0]) * k},\${(d.y - v[1]) * k})\`);
  node.attr("transform", d => \`translate(\${(d.x - v[0]) * k},\${(d.y - v[1]) * k})\`);
  node.attr("r", d => d.r * k);
}

function zoom(event, d) {
  focus = d;
  const transition = svg.transition()
    .duration(750)
    .tween("zoom", d => {
      const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
      return t => zoomTo(i(t));
    });
}`,

			'chord-diagram': `const matrix = [
  [11975,  5871, 8916, 2868],
  [ 1951, 10048, 2060, 6171],
  [ 8010, 16145, 8090, 8045],
  [ 1013,   990,  940, 6907]
];

const names = ["Group A", "Group B", "Group C", "Group D"];

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const outerRadius = Math.min(width, height) * 0.5 - 40;
const innerRadius = outerRadius - 30;

const chord = d3.chord()
  .padAngle(0.05)
  .sortSubgroups(d3.descending);

const arc = d3.arc()
  .innerRadius(innerRadius)
  .outerRadius(outerRadius);

const ribbon = d3.ribbon()
  .radius(innerRadius);

const chords = chord(matrix);

const g = svg.append("g")
  .attr("transform", \`translate(\${width / 2}, \${height / 2})\`);

const group = g.append("g")
  .selectAll("g")
  .data(chords.groups)
  .join("g");

group.append("path")
  .style("fill", (d, i) => utils.colors[i])
  .style("stroke", (d, i) => utils.colors[i])
  .attr("d", arc);

group.append("text")
  .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
  .attr("dy", "0.35em")
  .attr("transform", d => \`
    rotate(\${(d.angle * 180 / Math.PI - 90)})
    translate(\${outerRadius + 10})
    \${d.angle > Math.PI ? "rotate(180)" : ""}
  \`)
  .style("text-anchor", d => d.angle > Math.PI ? "end" : null)
  .text((d, i) => names[i])
  .style("font-size", "11px");

g.append("g")
  .selectAll("path")
  .data(chords)
  .join("path")
  .attr("d", ribbon)
  .style("fill", d => utils.colors[d.source.index])
  .style("fill-opacity", 0.75)
  .style("stroke", (d, i) => utils.colors[d.source.index])
  .style("stroke-width", 1);`,

			'collapsible-tree': `const data = {
  name: "Root",
  children: [
    {
      name: "Branch A",
      children: [
        {name: "Leaf A1"},
        {name: "Leaf A2"},
        {
          name: "Sub-branch A3",
          children: [
            {name: "Leaf A3.1"},
            {name: "Leaf A3.2"}
          ]
        }
      ]
    },
    {
      name: "Branch B",
      children: [
        {name: "Leaf B1"},
        {name: "Leaf B2"}
      ]
    },
    {
      name: "Branch C",
      children: [
        {name: "Leaf C1"}
      ]
    }
  ]
};

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", "translate(60,20)");

const tree = d3.tree()
  .size([height - 40, width - 120]);

const root = d3.hierarchy(data);
root.x0 = height / 2;
root.y0 = 0;

root.children.forEach(collapse);

function collapse(d) {
  if (d.children) {
    d._children = d.children;
    d._children.forEach(collapse);
    d.children = null;
  }
}

update(root);

function update(source) {
  const treeData = tree(root);
  const nodes = treeData.descendants();
  const links = treeData.descendants().slice(1);

  nodes.forEach(d => { d.y = d.depth * 180; });

  const node = g.selectAll('g.node')
    .data(nodes, d => d.id || (d.id = Math.random()));

  const nodeEnter = node.enter().append('g')
    .attr('class', 'node')
    .attr("transform", d => \`translate(\${source.y0},\${source.x0})\`)
    .on('click', click);

  nodeEnter.append('circle')
    .attr('class', 'node')
    .attr('r', 1e-6)
    .style("fill", d => d._children ? utils.colors[1] : "#fff")
    .style("stroke", utils.colors[0])
    .style("stroke-width", "2px");

  nodeEnter.append('text')
    .attr("dy", ".35em")
    .attr("x", d => d.children || d._children ? -13 : 13)
    .attr("text-anchor", d => d.children || d._children ? "end" : "start")
    .text(d => d.data.name);

  const nodeUpdate = nodeEnter.merge(node);

  nodeUpdate.transition()
    .duration(500)
    .attr("transform", d => \`translate(\${d.y},\${d.x})\`);

  nodeUpdate.select('circle.node')
    .attr('r', 10)
    .style("fill", d => d._children ? utils.colors[1] : "#fff");

  const nodeExit = node.exit().transition()
    .duration(500)
    .attr("transform", d => \`translate(\${source.y},\${source.x})\`)
    .remove();

  nodeExit.select('circle')
    .attr('r', 1e-6);

  const link = g.selectAll('path.link')
    .data(links, d => d.id);

  const linkEnter = link.enter().insert('path', "g")
    .attr("class", "link")
    .attr('d', d => {
      const o = {x: source.x0, y: source.y0};
      return diagonal(o, o);
    })
    .style("fill", "none")
    .style("stroke", "#ccc")
    .style("stroke-width", "2px");

  const linkUpdate = linkEnter.merge(link);

  linkUpdate.transition()
    .duration(500)
    .attr('d', d => diagonal(d, d.parent));

  link.exit().transition()
    .duration(500)
    .attr('d', d => {
      const o = {x: source.x, y: source.y};
      return diagonal(o, o);
    })
    .remove();

  nodes.forEach(d => {
    d.x0 = d.x;
    d.y0 = d.y;
  });

  function diagonal(s, d) {
    const path = \`M \${s.y} \${s.x}
              C \${(s.y + d.y) / 2} \${s.x},
                \${(s.y + d.y) / 2} \${d.x},
                \${d.y} \${d.x}\`;
    return path;
  }

  function click(event, d) {
    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else {
      d.children = d._children;
      d._children = null;
    }
    update(d);
  }
}`,

			'brush-zoom-chart': `const data = Array.from({length: 100}, (_, i) => ({
  x: i,
  y: Math.sin(i * 0.1) * 50 + Math.random() * 20 + 100
}));

const margin = utils.margin();
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const clip = svg.append("defs").append("clipPath")
  .attr("id", "clip")
  .append("rect")
  .attr("width", innerWidth)
  .attr("height", innerHeight);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const x = d3.scaleLinear()
  .domain(d3.extent(data, d => d.x))
  .range([0, innerWidth]);

const y = d3.scaleLinear()
  .domain(d3.extent(data, d => d.y))
  .range([innerHeight, 0]);

const xAxis = d3.axisBottom(x);
const yAxis = d3.axisLeft(y);

g.append("g")
  .attr("class", "axis axis--x")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(xAxis);

g.append("g")
  .attr("class", "axis axis--y")
  .call(yAxis);

const line = d3.line()
  .x(d => x(d.x))
  .y(d => y(d.y));

g.append("path")
  .datum(data)
  .attr("class", "line")
  .attr("clip-path", "url(#clip)")
  .attr("d", line)
  .style("fill", "none")
  .style("stroke", utils.colors[0])
  .style("stroke-width", "2px");

const brush = d3.brushX()
  .extent([[0, 0], [innerWidth, innerHeight]])
  .on("brush end", brushed);

const zoom = d3.zoom()
  .scaleExtent([1, Infinity])
  .translateExtent([[0, 0], [innerWidth, innerHeight]])
  .extent([[0, 0], [innerWidth, innerHeight]])
  .on("zoom", zoomed);

g.append("g")
  .attr("class", "brush")
  .call(brush);

svg.call(zoom);

function brushed(event) {
  if (event.defaultPrevented) return;
  const s = event.selection || x.range();
  x.domain(s.map(x.invert, x));
  g.select(".line").attr("d", line);
  g.select(".axis--x").call(xAxis);
  svg.select(".zoom").call(zoom.transform, d3.zoomIdentity
    .scale(innerWidth / (s[1] - s[0]))
    .translate(-s[0], 0));
}

function zoomed(event) {
  if (event.defaultPrevented) return;
  const t = event.transform;
  x.domain(t.rescaleX(x).domain());
  g.select(".line").attr("d", line);
  g.select(".axis--x").call(xAxis);
  g.select(".brush").call(brush.move, x.range().map(t.invertX, t));
}`,

			// Maps from biovisualize/d3visualization gallery
			'choropleth-map': `// Sample geographic data - replace with your own GeoJSON
const data = [
  {id: "US-AL", value: 4779736},
  {id: "US-AK", value: 710231},
  {id: "US-AZ", value: 6392017},
  {id: "US-AR", value: 2915918},
  {id: "US-CA", value: 37253956}
];

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const projection = d3.geoAlbersUsa()
  .scale(width * 0.8)
  .translate([width / 2, height / 2]);

const path = d3.geoPath()
  .projection(projection);

const colorScale = d3.scaleSequential()
  .interpolator(d3.interpolateBlues)
  .domain(d3.extent(data, d => d.value));

// Note: This is a template - you need to load actual GeoJSON data
svg.append("text")
  .attr("x", width / 2)
  .attr("y", height / 2)
  .attr("text-anchor", "middle")
  .style("font-size", "18px")
  .text("Choropleth Map Template");

svg.append("text")
  .attr("x", width / 2)
  .attr("y", height / 2 + 30)
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .text("Load GeoJSON data to see map visualization");`,

			'voronoi-diagram': `const data = Array.from({length: 50}, () => [
  Math.random() * width,
  Math.random() * height
]);

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const voronoi = d3.Delaunay
  .from(data)
  .voronoi([0, 0, width, height]);

svg.append("g")
  .selectAll("path")
  .data(data)
  .join("path")
  .attr("d", (d, i) => voronoi.renderCell(i))
  .attr("fill", (d, i) => utils.colors[i % utils.colors.length])
  .attr("fill-opacity", 0.3)
  .attr("stroke", "white")
  .attr("stroke-width", 1);

svg.append("g")
  .selectAll("circle")
  .data(data)
  .join("circle")
  .attr("cx", d => d[0])
  .attr("cy", d => d[1])
  .attr("r", 3)
  .attr("fill", "black");`,

			'stacked-bar-chart': `const data = [
  {category: "A", series1: 20, series2: 15, series3: 10},
  {category: "B", series1: 25, series2: 20, series3: 15},
  {category: "C", series1: 15, series2: 25, series3: 20},
  {category: "D", series1: 30, series2: 10, series3: 25}
];

const margin = utils.margin();
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

const keys = ["series1", "series2", "series3"];

const stack = d3.stack()
  .keys(keys);

const stackedData = stack(data);

const x = d3.scaleBand()
  .domain(data.map(d => d.category))
  .range([0, innerWidth])
  .padding(0.1);

const y = d3.scaleLinear()
  .domain([0, d3.max(stackedData, d => d3.max(d, d => d[1]))])
  .range([innerHeight, 0]);

g.selectAll(".serie")
  .data(stackedData)
  .enter()
  .append("g")
  .attr("class", "serie")
  .attr("fill", (d, i) => utils.colors[i])
  .selectAll("rect")
  .data(d => d)
  .enter()
  .append("rect")
  .attr("x", d => x(d.data.category))
  .attr("y", d => y(d[1]))
  .attr("height", d => y(d[0]) - y(d[1]))
  .attr("width", x.bandwidth());

g.append("g")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(x));

g.append("g")
  .call(d3.axisLeft(y));`,

			'cartogram': `// Cartogram template - distorted map based on data
const data = [
  {name: "Region A", population: 5000000, area: 100},
  {name: "Region B", population: 3000000, area: 80},
  {name: "Region C", population: 8000000, area: 120},
  {name: "Region D", population: 2000000, area: 60}
];

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

// Simple rectangle-based cartogram
const maxPop = d3.max(data, d => d.population);
const totalArea = d3.sum(data, d => d.area);

let currentX = 20;
let currentY = 20;

data.forEach((d, i) => {
  const rectWidth = (d.population / maxPop) * (width / 3);
  const rectHeight = (d.area / totalArea) * (height / 2);
  
  svg.append("rect")
    .attr("x", currentX)
    .attr("y", currentY)
    .attr("width", rectWidth)
    .attr("height", rectHeight)
    .attr("fill", utils.colors[i])
    .attr("stroke", "white")
    .attr("stroke-width", 2);
  
  svg.append("text")
    .attr("x", currentX + rectWidth / 2)
    .attr("y", currentY + rectHeight / 2)
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .style("font-size", "12px")
    .style("fill", "white")
    .text(d.name);
  
  currentX += rectWidth + 10;
  if (currentX > width - rectWidth) {
    currentX = 20;
    currentY += rectHeight + 20;
  }
});

svg.append("text")
  .attr("x", 20)
  .attr("y", height - 40)
  .style("font-size", "14px")
  .style("font-weight", "bold")
  .text("Population-based Cartogram");`,

			'reusable-line-chart': `// Reusable line chart with configurable options
function createLineChart() {
  let margin = {top: 20, right: 20, bottom: 30, left: 40};
  let width = 600;
  let height = 400;
  let xValue = d => d.x;
  let yValue = d => d.y;
  
  function chart(selection) {
    selection.each(function(data) {
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;
      
      const svg = d3.select(this)
        .selectAll("svg")
        .data([data]);
      
      const svgEnter = svg.enter().append("svg");
      
      svg.merge(svgEnter)
        .attr("width", width)
        .attr("height", height);
      
      const g = svgEnter.append("g")
        .attr("transform", \`translate(\${margin.left},\${margin.top})\`);
      
      const x = d3.scaleLinear()
        .domain(d3.extent(data, xValue))
        .range([0, innerWidth]);
      
      const y = d3.scaleLinear()
        .domain(d3.extent(data, yValue))
        .range([innerHeight, 0]);
      
      const line = d3.line()
        .x(d => x(xValue(d)))
        .y(d => y(yValue(d)));
      
      g.append("g")
        .attr("transform", \`translate(0,\${innerHeight})\`)
        .call(d3.axisBottom(x));
      
      g.append("g")
        .call(d3.axisLeft(y));
      
      g.append("path")
        .datum(data)
        .attr("d", line)
        .style("fill", "none")
        .style("stroke", "steelblue")
        .style("stroke-width", 2);
    });
  }
  
  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return chart;
  };
  
  chart.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };
  
  chart.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };
  
  return chart;
}

// Usage
const data = Array.from({length: 20}, (_, i) => ({
  x: i,
  y: Math.sin(i * 0.3) * 50 + 100 + Math.random() * 20
}));

const lineChart = createLineChart()
  .width(width)
  .height(height);

d3.select(container).datum(data).call(lineChart);`,

			'math-visualization': `// Mathematical visualization - Prime Number Spiral
const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const centerX = width / 2;
const centerY = height / 2;
const maxRadius = Math.min(width, height) / 3;

function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return false;
  }
  return true;
}

// Create spiral of numbers, highlighting primes
const numbers = Array.from({length: 200}, (_, i) => i + 1);

numbers.forEach((num, i) => {
  const angle = i * 0.3;
  const radius = (i / numbers.length) * maxRadius;
  const x = centerX + Math.cos(angle) * radius;
  const y = centerY + Math.sin(angle) * radius;
  
  svg.append("circle")
    .attr("cx", x)
    .attr("cy", y)
    .attr("r", isPrime(num) ? 4 : 2)
    .attr("fill", isPrime(num) ? utils.colors[1] : utils.colors[0])
    .attr("opacity", isPrime(num) ? 1 : 0.3);
  
  if (isPrime(num) && num < 50) {
    svg.append("text")
      .attr("x", x)
      .attr("y", y - 8)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "black")
      .text(num);
  }
});

svg.append("text")
  .attr("x", centerX)
  .attr("y", 30)
  .attr("text-anchor", "middle")
  .style("font-size", "16px")
  .style("font-weight", "bold")
  .text("Prime Number Spiral");`,

			'experiment-vis': `// Experimental visualization - Particle System
const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const particles = Array.from({length: 100}, (_, i) => ({
  id: i,
  x: Math.random() * width,
  y: Math.random() * height,
  vx: (Math.random() - 0.5) * 2,
  vy: (Math.random() - 0.5) * 2,
  radius: Math.random() * 5 + 2,
  color: utils.colors[Math.floor(Math.random() * utils.colors.length)]
}));

const nodes = svg.selectAll("circle")
  .data(particles)
  .enter()
  .append("circle")
  .attr("r", d => d.radius)
  .attr("fill", d => d.color)
  .attr("opacity", 0.7);

function updateParticles() {
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    
    // Bounce off walls
    if (p.x < p.radius || p.x > width - p.radius) p.vx *= -0.8;
    if (p.y < p.radius || p.y > height - p.radius) p.vy *= -0.8;
    
    // Keep in bounds
    p.x = Math.max(p.radius, Math.min(width - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(height - p.radius, p.y));
  });
  
  nodes
    .attr("cx", d => d.x)
    .attr("cy", d => d.y);
}

// Animate particles
const timer = d3.timer(updateParticles);

// Stop animation after 10 seconds
setTimeout(() => timer.stop(), 10000);`,

			'axis-demo': `// Interactive axis demonstration
const margin = utils.margin(40, 40, 60, 60);
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const svg = d3.select(container)
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

// Create different types of scales and axes
const xScales = {
  linear: d3.scaleLinear().domain([0, 100]).range([0, innerWidth]),
  time: d3.scaleTime()
    .domain([new Date(2020, 0, 1), new Date(2024, 0, 1)])
    .range([0, innerWidth]),
  ordinal: d3.scaleBand()
    .domain(['A', 'B', 'C', 'D', 'E'])
    .range([0, innerWidth])
    .padding(0.1)
};

const yScales = {
  linear: d3.scaleLinear().domain([0, 50]).range([innerHeight, 0]),
  log: d3.scaleLog().domain([1, 1000]).range([innerHeight, 0])
};

// Linear X and Y axes
g.append("g")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(xScales.linear))
  .append("text")
  .attr("x", innerWidth / 2)
  .attr("y", 40)
  .style("text-anchor", "middle")
  .style("fill", "black")
  .text("Linear Scale");

g.append("g")
  .call(d3.axisLeft(yScales.linear))
  .append("text")
  .attr("transform", "rotate(-90)")
  .attr("y", -40)
  .attr("x", -innerHeight / 2)
  .style("text-anchor", "middle")
  .style("fill", "black")
  .text("Linear Y Scale");

// Grid lines
g.append("g")
  .attr("class", "grid")
  .attr("transform", \`translate(0,\${innerHeight})\`)
  .call(d3.axisBottom(xScales.linear)
    .tickSize(-innerHeight)
    .tickFormat("")
  )
  .style("stroke-dasharray", "3,3")
  .style("opacity", 0.3);

g.append("g")
  .attr("class", "grid")
  .call(d3.axisLeft(yScales.linear)
    .tickSize(-innerWidth)
    .tickFormat("")
  )
  .style("stroke-dasharray", "3,3")
  .style("opacity", 0.3);`
		};
	}
}

class D3TemplateBrowserModal extends Modal {
	private editor: Editor;
	private plugin: D3VisualizerPlugin;
	private searchInput: HTMLInputElement;
	private categoryFilter: HTMLSelectElement;
	private templatesContainer: HTMLElement;
	private previewContainer: HTMLElement;
	private templatesSection: HTMLElement;
	private previewSection: HTMLElement;
	private modalActions: HTMLElement;
	private insertBtn: HTMLButtonElement;
	private cancelBtn: HTMLButtonElement;
	private selectedTemplate: any = null;
	private templates: any[];
	private currentView: 'templates' | 'preview' = 'templates';

	constructor(app: App, editor: Editor, plugin: D3VisualizerPlugin) {
		super(app);
		this.editor = editor;
		this.plugin = plugin;
		this.templates = plugin.getTemplateMetadata();
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('d3-template-browser');

		// Modal title
		const header = contentEl.createDiv('modal-header');
		header.createEl('h2', { text: 'D3.js Template Browser' });
		header.createEl('p', { text: 'Choose a visualization template to get started', cls: 'modal-subtitle' });
		const credit = header.createEl('p', { cls: 'modal-credit' });
		credit.innerHTML = 'Additional templates inspired by <a href="https://github.com/biovisualize/d3visualization" target="_blank">biovisualize/d3visualization</a>';

		// Search and filter controls
		const controls = contentEl.createDiv('template-controls');
		
		// Search input
		const searchContainer = controls.createDiv('search-container');
		searchContainer.createEl('span', { text: '🔍', cls: 'search-icon' });
		this.searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search templates...',
			cls: 'template-search'
		});

		// Category filter
		const filterContainer = controls.createDiv('filter-container');
		filterContainer.createEl('span', { text: '📁', cls: 'filter-icon' });
		this.categoryFilter = filterContainer.createEl('select', { cls: 'category-filter' });
		
		const allOption = this.categoryFilter.createEl('option', { value: 'all' });
		allOption.textContent = 'All Categories';
		
		const categories = [...new Set(this.templates.map(t => t.category))];
		categories.forEach(category => {
			const option = this.categoryFilter.createEl('option', { value: category });
			option.textContent = category;
		});

		// Main content area
		const mainContent = contentEl.createDiv('template-main');
		
		// Templates grid
		this.templatesSection = mainContent.createDiv('templates-section');
		this.templatesSection.createEl('h3', { text: 'Templates' });
		this.templatesContainer = this.templatesSection.createDiv('templates-grid');

		// Preview section
		this.previewSection = mainContent.createDiv('preview-section');
		this.previewContainer = this.previewSection.createDiv('template-preview');

		// Action buttons
		this.modalActions = contentEl.createDiv('modal-actions');
		this.insertBtn = this.modalActions.createEl('button', { text: 'Select a Template', cls: 'mod-cta insert-btn' });
		this.cancelBtn = this.modalActions.createEl('button', { text: 'Cancel', cls: 'cancel-btn' });
		
		// Initially disable insert button
		this.insertBtn.disabled = true;

		// Event listeners
		this.searchInput.addEventListener('input', () => this.filterTemplates());
		this.categoryFilter.addEventListener('change', () => this.filterTemplates());
		this.insertBtn.addEventListener('click', () => this.insertSelectedTemplate());
		this.cancelBtn.addEventListener('click', () => this.close());

		// Initial render
		this.renderTemplates();
		
		// Focus search input
		setTimeout(() => this.searchInput.focus(), 100);
	}

	private filterTemplates() {
		const searchTerm = this.searchInput.value.toLowerCase();
		const selectedCategory = this.categoryFilter.value;

		const filtered = this.templates.filter(template => {
			const matchesSearch = !searchTerm || 
				template.name.toLowerCase().includes(searchTerm) ||
				template.description.toLowerCase().includes(searchTerm) ||
				template.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm));
			
			const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
			
			return matchesSearch && matchesCategory;
		});

		this.renderTemplates(filtered);
	}

	private renderTemplates(templates = this.templates) {
		this.templatesContainer.empty();

		if (templates.length === 0) {
			const noResults = this.templatesContainer.createDiv('no-results');
			noResults.innerHTML = `
				<div class="no-results-content">
					<span class="no-results-icon">🔍</span>
					<p>No templates found</p>
					<small>Try a different search term or category</small>
				</div>
			`;
			return;
		}

		templates.forEach(template => {
			const templateCard = this.templatesContainer.createDiv('template-card');
			
			if (this.selectedTemplate?.key === template.key) {
				templateCard.addClass('selected');
			}

			templateCard.innerHTML = `
				<div class="template-icon">${template.icon}</div>
				<div class="template-info">
					<div class="template-name">${template.name}</div>
					<div class="template-description">${template.description}</div>
					<div class="template-category">${template.category}</div>
				</div>
			`;

			templateCard.addEventListener('click', () => {
				// Remove selection from other cards
				this.templatesContainer.querySelectorAll('.template-card').forEach(card => {
					card.removeClass('selected');
				});
				
				// Select this card
				templateCard.addClass('selected');
				this.selectedTemplate = template;
				this.showPreviewPage(template);
			});

			// Double click to insert
			templateCard.addEventListener('dblclick', () => {
				this.selectedTemplate = template;
				this.insertSelectedTemplate();
			});
		});
	}

	private showPreviewPage(template: any) {
		// Hide templates section and show preview section
		this.templatesSection.style.display = 'none';
		this.previewSection.addClass('active');
		this.currentView = 'preview';
		
		// Update buttons for preview mode
		this.modalActions.addClass('preview-actions');
		this.insertBtn.textContent = `Insert ${template.name}`;
		this.insertBtn.disabled = false;
		this.cancelBtn.textContent = 'Close';
		
		this.previewContainer.empty();
		
		// Back button
		const backBtn = this.previewContainer.createDiv('back-button');
		backBtn.innerHTML = `
			<span>←</span>
			<span>Back to Templates</span>
		`;
		backBtn.addEventListener('click', () => this.showTemplatesPage());
		
		const previewHeader = this.previewContainer.createDiv('preview-header');
		previewHeader.innerHTML = `
			<div class="preview-title">
				<span class="preview-template-icon">${template.icon}</span>
				<span class="preview-template-name">${template.name}</span>
			</div>
			<div class="preview-category">${template.category}</div>
		`;

		const previewDescription = this.previewContainer.createDiv('preview-description');
		previewDescription.textContent = template.description;

		const previewTags = this.previewContainer.createDiv('preview-tags');
		template.tags.forEach((tag: string) => {
			const tagEl = previewTags.createSpan('preview-tag');
			tagEl.textContent = tag;
		});

		// Mini code preview
		const codePreview = this.previewContainer.createDiv('code-preview');
		const templates = this.plugin.getTemplates();
		const templateCode = templates[template.key];
		
		if (templateCode) {
			const codeLines = templateCode.split('\n').slice(0, 10); // First 10 lines
			const truncatedCode = codeLines.join('\n') + (templateCode.split('\n').length > 10 ? '\n...' : '');
			
			codePreview.innerHTML = `
				<div class="code-preview-header">Code Preview:</div>
				<pre class="code-preview-content"><code>${truncatedCode}</code></pre>
			`;
		}

		// Usage tips
		const usageTips = this.previewContainer.createDiv('usage-tips');
		usageTips.innerHTML = `
			<div class="tips-header">💡 Usage Tips:</div>
			<ul class="tips-list">
				<li>Click "Insert Template" to add to your note</li>
				<li>Customize the sample data for your needs</li>
				<li>Use the available utils for responsive design</li>
				<li>Load external data with loadData functions</li>
			</ul>
		`;
	}
	
	private showTemplatesPage() {
		// Hide preview section and show templates section
		this.previewSection.removeClass('active');
		this.templatesSection.style.display = 'flex';
		this.currentView = 'templates';
		
		// Update buttons for templates mode
		this.modalActions.removeClass('preview-actions');
		this.insertBtn.textContent = 'Select a Template';
		this.insertBtn.disabled = !this.selectedTemplate;
		this.cancelBtn.textContent = 'Cancel';
	}

	private insertSelectedTemplate() {
		if (!this.selectedTemplate) {
			new Notice('Please select a template first');
			return;
		}

		const templates = this.plugin.getTemplates();
		const templateCode = templates[this.selectedTemplate.key];
		
		if (!templateCode) {
			new Notice('Template not found');
			return;
		}

		const cursor = this.editor.getCursor();
		this.editor.replaceRange(`\`\`\`d3\n${templateCode}\n\`\`\`\n`, cursor);

		// Switch to reading mode to show the visualization
		setTimeout(() => {
			const activeLeaf = this.app.workspace.activeLeaf;
			if (activeLeaf && activeLeaf.view.getViewType() === 'markdown') {
				const markdownView = activeLeaf.view as any;
				if (markdownView.getMode() === 'source') {
					markdownView.setState({ mode: 'preview' }, { history: false });
				}
			}
		}, 100);

		new Notice(`Inserted ${this.selectedTemplate.name} template`);
		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class D3VisualizerSettingTab extends PluginSettingTab {
	plugin: D3VisualizerPlugin;

	constructor(app: App, plugin: D3VisualizerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Default Width')
			.setDesc('Default width for D3 visualizations (pixels)')
			.addText(text => text
				.setPlaceholder('600')
				.setValue(this.plugin.settings.defaultWidth.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.defaultWidth = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Default Height')
			.setDesc('Default height for D3 visualizations (pixels)')
			.addText(text => text
				.setPlaceholder('400')
				.setValue(this.plugin.settings.defaultHeight.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.defaultHeight = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Enable Error Display')
			.setDesc('Show error messages when D3 code fails to execute')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableErrorDisplay)
				.onChange(async (value) => {
					this.plugin.settings.enableErrorDisplay = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Allow Data Loading')
			.setDesc('Allow D3 visualizations to load data from external sources')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.allowDataLoading)
				.onChange(async (value) => {
					this.plugin.settings.allowDataLoading = value;
					await this.plugin.saveSettings();
				}));
	}
}
