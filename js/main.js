import { debounce } from "./utils.js";

d3.csv("data/data.csv", d3.autoType).then((data) => {
  ///////////////////////////////////////////////////////////
  //// Process data /////////////////////////////////////////
  ///////////////////////////////////////////////////////////

  const accessors = {
    key: (d) => d["Code"],
    name: (d) => d["State"],
    x: (d) => d["Protein Share vs Average %"],
    y: (d) => d["Fiber Share vs Average %"],
  };

  const valueFormat = (d) => (d === 0 ? "0" : d3.format("+d")(d)) + "%";

  const roundedValueMultiple = 5;
  const computeRoundedAbsMax = (data, accessor, multiple) =>
    Math.ceil(d3.max(data, (d) => Math.abs(accessor(d))) / multiple) * multiple;
  const xMax = computeRoundedAbsMax(data, accessors.x, roundedValueMultiple);
  const yMax =
    computeRoundedAbsMax(data, accessors.y, roundedValueMultiple) +
    roundedValueMultiple;

  // Combine data points with both the same x and y values
  const grouped = d3.groups(data, (d) => `${accessors.x(d)}|${accessors.y(d)}`);

  ///////////////////////////////////////////////////////////
  //// Setup ////////////////////////////////////////////////
  ///////////////////////////////////////////////////////////
  let width, delaunay, dotG;

  const marginTop = 8;
  const marginRight = 16;
  const marginBottom = 40;
  const marginLeft = 60;
  const height = 600;

  const tickStep = 5;
  const tickSize = 6;
  const tickPadding = 4;
  const axisAnnotationGap = 24;

  const quadrantLabelHeight = 20;
  const quadrantLabelGap = 4;
  const quadrantLabelGroupHeight = quadrantLabelHeight * 2 + quadrantLabelGap;
  const quadrantLabelPadding = 12;

  const dotRadius = 9;
  const dotLabelPadding = 4;

  const x = d3.scaleLinear().domain([-xMax, xMax]);
  const y = d3
    .scaleLinear()
    .domain([-yMax, yMax])
    .range([height - marginBottom, marginTop]);
  const gradient = (d) => {
    const xBelow = accessors.x(d) < 0;
    const yBelow = accessors.y(d) < 0;
    if (xBelow && yBelow) return "url(#xBelowYBelow)";
    if (xBelow) return "url(#xBelowYAbove)";
    if (yBelow) return "url(#xAboveYBelow)";
    return "url(#xAboveYAbove)";
  };

  const orient = {
    top: (text) =>
      text
        .attr("text-anchor", "middle")
        .attr("dy", null)
        .attr("x", null)
        .attr("y", -dotRadius - dotLabelPadding),
    right: (text) =>
      text
        .attr("text-anchor", "start")
        .attr("dy", "0.35em")
        .attr("x", dotRadius + dotLabelPadding)
        .attr("y", null),
    bottom: (text) =>
      text
        .attr("text-anchor", "middle")
        .attr("dy", "0.71em")
        .attr("x", null)
        .attr("y", dotRadius + dotLabelPadding),
    left: (text) =>
      text
        .attr("text-anchor", "end")
        .attr("dy", "0.35em")
        .attr("x", -dotRadius - dotLabelPadding)
        .attr("y", null),
  };

  ///////////////////////////////////////////////////////////
  //// Render ///////////////////////////////////////////////
  ///////////////////////////////////////////////////////////
  const container = d3.select("#chart").classed("chart", true);
  const svg = container.append("svg");
  renderGradients();
  const xAxisG = svg.append("g").attr("class", "axis");
  const yAxisG = svg.append("g").attr("class", "axis");
  const quadrantsG = svg.append("g").attr("class", "quadrants");
  const dotsG = svg.append("g").attr("class", "dots");

  new ResizeObserver(debounce(resized)).observe(container.node());

  function resized() {
    const newWidth = container.node().clientWidth;
    if (!newWidth || width === newWidth) return;
    width = newWidth;

    x.range([marginLeft, width - marginRight]);

    svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    render();
  }

  function render() {
    renderXAxis();
    renderYAxis();
    renderQuadrants();
    renderDots();
  }

  function renderGradients() {
    svg
      .append("defs")
      .selectChildren("linearGradient")
      .data([
        {
          id: "xAboveYAbove",
          colors: ["var(--color-protein-above)", "var(--color-fiber-above)"],
        },
        {
          id: "xBelowYAbove",
          colors: ["var(--color-protein-below)", "var(--color-fiber-above)"],
        },
        {
          id: "xBelowYBelow",
          colors: ["var(--color-protein-below)", "var(--color-fiber-below)"],
        },
        {
          id: "xAboveYBelow",
          colors: ["var(--color-protein-above)", "var(--color-fiber-below)"],
        },
      ])
      .join("linearGradient")
      .attr("id", (d) => d.id)
      .attr("gradientTransform", "rotate(90)")
      .selectChildren("stop")
      .data((d) => d.colors)
      .join("stop")
      .attr("offset", "50%")
      .attr("stop-color", (d) => d);
  }

  const xAxisAnnotations = [
    {
      text: "More protein →",
      textAnchor: "start",
      dx: axisAnnotationGap / 2,
    },
    {
      text: "← Less protein",
      textAnchor: "end",
      dx: -axisAnnotationGap / 2,
    },
  ];

  function renderXAxis() {
    const xTicks = d3.range(-xMax, xMax + tickStep, tickStep);

    xAxisG.attr("transform", `translate(0,${height - marginBottom})`);

    xAxisG
      .call(
        d3
          .axisBottom(x)
          .tickValues(xTicks)
          .tickSize(tickSize)
          .tickPadding(tickPadding)
          .tickFormat(valueFormat),
      )
      .attr("font-size", null)
      .attr("font-family", null)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectChildren(".tick")
          .filter((d) => d === 0)
          .classed("is-zero", true)
          .select("line")
          .attr("y1", -(height - marginTop - marginBottom)),
      );

    xAxisG
      .selectChildren(".axis__annotation")
      .data(xAxisAnnotations)
      .join((enter) =>
        enter
          .append("text")
          .attr("class", "axis__annotation")
          .attr("fill", "currentColor")
          .attr("text-anchor", (d) => d.textAnchor)
          .attr("dy", "-0.29em")
          .attr("dx", (d) => d.dx)
          .text((d) => d.text),
      )
      .attr("transform", `translate(${x(0)},${marginBottom})`);
  }

  const yAxisAnnotations = [
    {
      text: "More fiber →",
      textAnchor: "start",
      dx: axisAnnotationGap / 2,
    },
    {
      text: "← Less fiber",
      textAnchor: "end",
      dx: -axisAnnotationGap / 2,
    },
  ];

  function renderYAxis() {
    const yTicks = d3.range(-yMax, yMax + tickStep, tickStep);

    yAxisG.attr("transform", `translate(${marginLeft},0)`);

    yAxisG
      .call(
        d3
          .axisLeft(y)
          .tickValues(yTicks)
          .tickSize(tickSize)
          .tickPadding(tickPadding)
          .tickFormat(valueFormat),
      )
      .attr("font-size", null)
      .attr("font-family", null)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectChildren(".tick")
          .filter((d) => d === 0)
          .classed("is-zero", true)
          .select("line")
          .attr("x1", width - marginLeft - marginRight),
      );

    yAxisG
      .selectChildren(".axis__annotation")
      .data(yAxisAnnotations)
      .join((enter) =>
        enter
          .append("text")
          .attr("class", "axis__annotation")
          .attr("fill", "currentColor")
          .attr("text-anchor", (d) => d.textAnchor)
          .attr("dy", "1em")
          .attr("dx", (d) => d.dx)
          .text((d) => d.text),
      )
      .attr("transform", `translate(${-marginLeft},${y(0)})rotate(-90)`);
  }

  const quadrantLabels = [
    [
      {
        text: "More protein",
        fill: "var(--color-protein-above)",
        labelWidth: 0,
        translate: function () {
          return `translate(${width - this.labelWidth},${marginTop})`;
        },
      },
      {
        text: "More fiber",
        fill: "var(--color-fiber-above)",
        labelWidth: 0,
        translate: function () {
          return `translate(${width - this.labelWidth},${marginTop + quadrantLabelHeight + quadrantLabelGap})`;
        },
      },
    ],
    [
      {
        text: "Less protein",
        fill: "var(--color-protein-below)",
        labelWidth: 0,
        translate: function () {
          return `translate(${marginLeft},${marginTop})`;
        },
      },
      {
        text: "More fiber",
        fill: "var(--color-fiber-above)",
        labelWidth: 0,
        translate: function () {
          return `translate(${marginLeft},${marginTop + quadrantLabelHeight + quadrantLabelGap})`;
        },
      },
    ],
    [
      {
        text: "Less protein",
        fill: "var(--color-protein-below)",
        labelWidth: 0,
        translate: function () {
          return `translate(${marginLeft},${height - marginBottom - quadrantLabelGroupHeight})`;
        },
      },
      {
        text: "Less fiber",
        fill: "var(--color-fiber-below)",
        labelWidth: 0,
        translate: function () {
          return `translate(${marginLeft},${height - marginBottom - quadrantLabelGroupHeight + quadrantLabelHeight + quadrantLabelGap})`;
        },
      },
    ],
    [
      {
        text: "More protein",
        fill: "var(--color-protein-above)",
        labelWidth: 0,
        translate: function () {
          return `translate(${width - marginRight - this.labelWidth},${height - marginBottom - quadrantLabelGroupHeight})`;
        },
      },
      {
        text: "Less fiber",
        fill: "var(--color-fiber-below)",
        labelWidth: 0,
        translate: function () {
          return `translate(${width - marginRight - this.labelWidth},${height - marginBottom - quadrantLabelGroupHeight + quadrantLabelHeight + quadrantLabelGap})`;
        },
      },
    ],
  ];
  function renderQuadrants() {
    quadrantsG
      .selectChildren(".quadrant")
      .data(quadrantLabels)
      .join((enter) => enter.append("g").attr("class", "quadrant"))
      .selectChildren(".quadrant__label")
      .data((d) => d)
      .join((enter) =>
        enter
          .append("g")
          .attr("class", "quadrant__label")
          .call((g) =>
            g
              .append("rect")
              .attr("class", "quadrant__label__rect")
              .attr("fill", (d) => d.fill)
              .attr("height", quadrantLabelHeight)
              .attr("rx", quadrantLabelHeight / 2),
          )
          .call((g) =>
            g
              .append("text")
              .attr("class", "quadrant__label__text")
              .attr("fill", "currentColor")
              .attr("y", quadrantLabelHeight / 2)
              .attr("dy", "0.35em")
              .attr("dx", quadrantLabelPadding)
              .text((d) => d.text)
              .each(function (d) {
                d.labelWidth = this.getBBox().width + quadrantLabelPadding * 2;
              }),
          )
          .call((g) =>
            g
              .select(".quadrant__label__rect")
              .attr("width", (d) => d.labelWidth),
          ),
      )
      .attr("transform", (d) => d.translate());
  }

  function renderDots() {
    // https://old.observablehq.com/@d3/voronoi-labels
    // Label placement calculation is done only once
    delaunay = d3.Delaunay.from(
      grouped,
      ([_, g]) => x(accessors.x(g[0])),
      ([_, g]) => y(accessors.y(g[0])),
    );
    const voronoi = delaunay.voronoi([-1, -1, width + 1, height + 1]);
    const cells = Array.from({ length: grouped.length }).map((_, i) =>
      voronoi.cellPolygon(i),
    );

    dotG = dotsG
      .selectChildren(".dot")
      .data(grouped)
      .join((enter) =>
        enter
          .append("g")
          .attr("class", "dot")
          .call((g) =>
            g
              .append("circle")
              .attr("class", "dot__circle")
              .attr("r", dotRadius)
              .attr("fill", ([_, g]) => gradient(g[0])),
          )
          .call((g) =>
            g
              .append("text")
              .attr("class", "dot__text")
              .attr("fill", "currentColor")
              .text(([_, g]) => g.map(accessors.key).join("/")),
          ),
      )
      .attr(
        "transform",
        ([_, g]) =>
          `translate(${x(accessors.x(g[0]))},${y(accessors.y(g[0]))})`,
      )
      .call((g) =>
        g.select(".dot__text").each(function ([_, g], i) {
          const [cx, cy] = d3.polygonCentroid(cells[i]);
          const px = x(accessors.x(g[0]));
          const py = y(accessors.y(g[0]));
          const angle =
            (Math.round((Math.atan2(cy - py, cx - px) / Math.PI) * 2) + 4) % 4;
          d3.select(this).call(
            angle === 0
              ? orient.right
              : angle === 3
                ? orient.top
                : angle === 1
                  ? orient.bottom
                  : orient.left,
          );
        }),
      );
  }

  ///////////////////////////////////////////////////////////
  //// Interactivity ////////////////////////////////////////
  ///////////////////////////////////////////////////////////
  let iActive = null;
  const searchRadius = 24;

  const tooltip = initTooltip(container);
  svg.on("mouseenter", moved).on("mousemove", moved).on("mouseleave", left);

  function moved(event) {
    const [mx, my] = d3.pointer(event, svg.node());
    const i = delaunay.find(mx, my);

    const [_, g] = grouped[i];
    const dx = x(accessors.x(g[0]));
    const dy = y(accessors.y(g[0]));
    const r = Math.hypot(mx - dx, my - dy);
    if (r > searchRadius) return left();

    if (iActive === i) return;
    iActive = i;

    dotG.classed("is-active", (_, i) => i === iActive);

    tooltip.show(tooltipContent(g));
    tooltip.move(dx, dy, dotRadius + 8);
  }

  function left() {
    iActive = null;

    dotG.classed("is-active", false);

    tooltip.hide();
  }

  function tooltipContent(g) {
    const xValue = accessors.x(g[0]);
    const xColor =
      xValue < 0 ? "var(--color-protein-below)" : "var(--color-protein-above)";
    const yValue = accessors.y(g[0]);
    const yColor =
      yValue < 0 ? "var(--color-fiber-below)" : "var(--color-fiber-above)";
    return /*html*/ `
    <div class="tooltip__title">${g.map((d) => accessors.name(d)).join("<br/>")}</div>
    <div class="tooltip__entries">
      <span class="tooltip__key">Protein</span>
      <span class="tooltip__value" style="--color-threshold: ${xColor}">${valueFormat(xValue)}</span>
      <span class="tooltip__key">Fiber</span>
      <span class="tooltip__value" style="--color-threshold: ${yColor}">${valueFormat(yValue)}</span>
    </div>
    `;
  }

  ///////////////////////////////////////////////////////////
  //// Tooltip //////////////////////////////////////////////
  ///////////////////////////////////////////////////////////

  function initTooltip(container) {
    let tRect, bRect;
    const tooltip = container.append("div").attr("class", "tooltip");

    function show(content) {
      tooltip.html(content).classed("is-visible", true);
      tRect = tooltip.node().getBoundingClientRect();
      bRect = container.node().getBoundingClientRect();
    }

    function move(cx, cy, r) {
      let x = cx - tRect.width / 2;
      if (x < 0) {
        x = 0;
      } else if (x + tRect.width > bRect.width) {
        x = bRect.width - tRect.width;
      }

      let y = cy - r - tRect.height;
      if (y < 0) {
        y = cy + r;
        if (y + tRect.height > bRect.height) {
          y = bRect.height - tRect.height;
        }
      }

      tooltip.style("transform", `translate(${x}px,${y}px)`);
    }

    function hide() {
      tooltip.classed("is-visible", false);
    }

    return {
      show,
      move,
      hide,
    };
  }
});
