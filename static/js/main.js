(async function () {
  "use strict";

  /* ================================================================
   *  Constants
   * ================================================================ */
  const FAMILY_COLORS = {
    Technology: "#2e5fa1", Financials: "#0c2340", Healthcare: "#6b4c9a",
    Energy: "#c9a961", Industrials: "#5a6a7a", Materials: "#7a6e5d",
    Consumer: "#a0405a", "Real Estate": "#3a7d6e", Telecom: "#b07d2a",
    Other: "#8a8a96"
  };

  const PALETTE = {
    bg: "#f7f5f0", card: "#ffffff", border: "#d8d3cb", text: "#1a1a2e",
    textSecondary: "#4a4a5a", textMuted: "#8a8a96", accent: "#0c2340",
    positive: "#1a7f4b", negative: "#b91c1c"
  };

  const DURATION = 800;
  const EASE = d3.easeCubicInOut;

  /* ================================================================
   *  Data loading
   * ================================================================ */
  const [data, world] = await Promise.all([
    fetch("/data.json?v=2").then(r => r.json()),
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(r => r.json())
  ]);

  var { geography, industries, performance, saaspocalypse, meta } = data;

  /* Populate hero stat */
  var heroStat = document.getElementById("hero-stat");
  if (heroStat) {
    heroStat.textContent = meta.total_instruments + " decacorns \u00B7 $" +
      meta.total_cap_trillions + "T total \u00B7 " + meta.avg_ytd + "% avg YTD";
  }

  /* ================================================================
   *  SVG setup
   * ================================================================ */
  var svgEl = document.getElementById("chart");
  var containerRect = svgEl.parentElement.getBoundingClientRect();
  var svgWidth = Math.round(containerRect.width) || 800;
  var svgHeight = Math.round(containerRect.height) || 700;

  var svg = d3.select(svgEl)
    .attr("viewBox", "0 0 " + svgWidth + " " + svgHeight)
    .attr("preserveAspectRatio", "xMidYMid meet");

  function getIsMobile() { return window.innerWidth < 768; }
  var isMobile = getIsMobile();

  var margin = isMobile
    ? { top: 20, right: 16, bottom: 40, left: 40 }
    : { top: 40, right: 40, bottom: 60, left: 60 };
  var width = svgWidth - margin.left - margin.right;
  var height = svgHeight - margin.top - margin.bottom;

  var g = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  /* Layer groups for ordering */
  var gMap = g.append("g").attr("class", "layer-map");
  var gBubbles = g.append("g").attr("class", "layer-bubbles");
  var gTreemap = g.append("g").attr("class", "layer-treemap");
  var gBeeswarm = g.append("g").attr("class", "layer-beeswarm");
  var gButterfly = g.append("g").attr("class", "layer-butterfly");
  var gAnnotations = g.append("g").attr("class", "layer-annotations");
  var gAxes = g.append("g").attr("class", "layer-axes");
  var gLegend = g.append("g").attr("class", "layer-legend");

  /* ================================================================
   *  Helper formatters
   * ================================================================ */
  function fmtCap(v) {
    if (v >= 1e12) return "$" + (v / 1e12).toFixed(1) + "T";
    if (v >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B";
    return "$" + (v / 1e6).toFixed(0) + "M";
  }

  function truncate(s, maxLen) {
    return s.length > maxLen ? s.slice(0, maxLen - 1) + "\u2026" : s;
  }

  /* ================================================================
   *  Tooltip infrastructure
   * ================================================================ */
  var tooltipEl = document.createElement("div");
  tooltipEl.id = "tooltip";
  tooltipEl.style.cssText = "position:fixed;display:none;padding:8px 12px;background:#fff;border:1px solid #d8d3cb;border-radius:4px;font-size:12px;pointer-events:none;z-index:100;max-width:200px;box-shadow:0 2px 8px rgba(0,0,0,0.15);font-family:Inter,sans-serif;";
  document.body.appendChild(tooltipEl);

  var tooltipTimer;
  function showTooltip(html, event) {
    clearTimeout(tooltipTimer);
    var touch = event.touches ? event.touches[0] : event;
    tooltipEl.innerHTML = html;
    tooltipEl.style.display = "block";
    tooltipEl.style.left = Math.min(touch.clientX + 10, window.innerWidth - 220) + "px";
    tooltipEl.style.top = (touch.clientY - 60) + "px";
    tooltipTimer = setTimeout(hideTooltip, 3000);
  }
  function hideTooltip() {
    tooltipEl.style.display = "none";
  }
  document.addEventListener("touchstart", function (e) {
    if (e.target.id !== "tooltip" && !e.target.closest("#tooltip")) hideTooltip();
  });

  /* ================================================================
   *  Shared state
   * ================================================================ */
  var currentStep = 0;
  var simulation = null;

  function getDotRadius() { return isMobile ? 2 : 3; }
  function getCollideRadius() { return isMobile ? 2.5 : 3.5; }

  /* Precompute some things */
  var maxCap = d3.max(geography, function (d) { return d.total_cap; });
  var rScale = d3.scaleSqrt().domain([0, maxCap]).range([4, isMobile ? 35 : 60]);

  /* World map projection */
  var projection = d3.geoNaturalEarth1().fitSize([width, height], topojson.feature(world, world.objects.land));
  var pathGen = d3.geoPath(projection);

  /* Treemap layout (precomputed) */
  var treemapRoot = d3.hierarchy({ children: industries }).sum(function (d) { return d.total_cap || 0; });
  d3.treemap().size([width, height]).padding(2)(treemapRoot);
  var treemapLeaves = treemapRoot.leaves();

  /* Map industry -> treemap leaf center */
  var industryCell = {};
  treemapLeaves.forEach(function (leaf) {
    industryCell[leaf.data.industry] = {
      x: (leaf.x0 + leaf.x1) / 2,
      y: (leaf.y0 + leaf.y1) / 2,
      x0: leaf.x0, y0: leaf.y0, x1: leaf.x1, y1: leaf.y1
    };
  });

  /* Performance data: filter nulls, limit on mobile */
  var perfData = performance.filter(function (d) { return d.ytd != null; });
  if (isMobile) {
    perfData.sort(function (a, b) { return b.cap - a.cap; });
    perfData = perfData.slice(0, 500);
  }

  /* Give each perf datum an id for force sim */
  perfData.forEach(function (d, i) { d._id = i; });

  /* ================================================================
   *  STEP 1: Map + bubbles
   * ================================================================ */
  function step1(direction) {
    /* Clean up later layers */
    cleanTreemap();
    cleanBeeswarm();
    cleanButterfly();
    gLegend.selectAll("*").remove();
    gAnnotations.selectAll("*").remove();

    /* Draw land */
    var land = topojson.feature(world, world.objects.land);
    var paths = gMap.selectAll("path.land").data([land]);
    paths.enter().append("path")
      .attr("class", "land")
      .attr("d", pathGen)
      .attr("fill", "none")
      .attr("stroke", PALETTE.border)
      .attr("stroke-width", 1)
      .attr("opacity", 1);
    paths.transition().duration(DURATION).ease(EASE).attr("opacity", 1);

    /* Bubbles */
    var bubbles = gBubbles.selectAll("circle.bubble").data(geography, function (d) { return d.country; });

    bubbles.exit().transition().duration(DURATION / 2).attr("r", 0).remove();

    var enter = bubbles.enter().append("circle")
      .attr("class", "bubble")
      .attr("cx", function (d) { var p = projection([d.lon, d.lat]); return p ? p[0] : 0; })
      .attr("cy", function (d) { var p = projection([d.lon, d.lat]); return p ? p[1] : 0; })
      .attr("r", 0)
      .attr("fill", PALETTE.accent)
      .attr("opacity", 0.7)
      .attr("stroke", "none")
      .attr("stroke-width", 0);

    enter.transition().duration(DURATION).ease(EASE)
      .delay(function (d, i) { return i * 30; })
      .attr("r", function (d) { return rScale(d.total_cap); });

    /* If going backward, restore bubbles to accent color */
    gBubbles.selectAll("circle.bubble")
      .transition().duration(DURATION).ease(EASE)
      .attr("fill", PALETTE.accent)
      .attr("opacity", 0.7)
      .attr("stroke", "none")
      .attr("stroke-width", 0)
      .attr("cx", function (d) { var p = projection([d.lon, d.lat]); return p ? p[0] : 0; })
      .attr("cy", function (d) { var p = projection([d.lon, d.lat]); return p ? p[1] : 0; })
      .attr("r", function (d) { return rScale(d.total_cap); });
  }

  /* ================================================================
   *  STEP 2: Highlight US/China
   * ================================================================ */
  function step2(direction) {
    gAnnotations.selectAll("*").remove();
    gLegend.selectAll("*").remove();

    /* Reset all bubbles first */
    gBubbles.selectAll("circle.bubble")
      .transition().duration(DURATION / 2).ease(EASE)
      .attr("stroke", "none").attr("stroke-width", 0)
      .attr("fill", PALETTE.accent).attr("opacity", 0.7);

    var us = geography.find(function (d) { return d.code === "US"; });
    var cn = geography.find(function (d) { return d.code === "CN"; });
    var highlights = [us, cn].filter(Boolean);

    /* Pulse highlights */
    gBubbles.selectAll("circle.bubble")
      .filter(function (d) { return d.code === "US" || d.code === "CN"; })
      .transition().duration(DURATION).ease(EASE)
      .attr("stroke", PALETTE.text)
      .attr("stroke-width", 3);

    /* Annotation labels */
    highlights.forEach(function (d) {
      var p = projection([d.lon, d.lat]);
      if (!p) return;
      var label = d.country + "  " + fmtCap(d.total_cap);
      gAnnotations.append("text")
        .attr("x", p[0])
        .attr("y", p[1] - rScale(d.total_cap) - 8)
        .attr("text-anchor", "middle")
        .attr("font-size", isMobile ? "10px" : "13px")
        .attr("font-weight", 600)
        .attr("fill", PALETTE.text)
        .attr("opacity", 0)
        .transition().duration(DURATION).ease(EASE)
        .attr("opacity", 1)
        .text(label);
    });

    /* Populate #us-cap span */
    if (us) {
      var usCap = document.getElementById("us-cap");
      if (usCap) usCap.textContent = fmtCap(us.total_cap);
    }
  }

  /* ================================================================
   *  STEP 3: Recolor by sector family + legend
   * ================================================================ */
  function step3(direction) {
    gAnnotations.selectAll("*").remove();
    cleanTreemap();

    /* Ensure map + bubbles visible */
    gMap.selectAll("path.land").transition().duration(DURATION / 2).attr("opacity", 1);

    gBubbles.selectAll("circle.bubble")
      .transition().duration(DURATION).ease(EASE)
      .attr("fill", function (d) { return FAMILY_COLORS[d.sector_family] || FAMILY_COLORS.Other; })
      .attr("opacity", 0.8)
      .attr("stroke", "none").attr("stroke-width", 0)
      .attr("r", function (d) { return rScale(d.total_cap); });

    /* Legend */
    gLegend.selectAll("*").remove();
    var families = Object.keys(FAMILY_COLORS);
    if (isMobile) families = families.slice(0, 5);

    var legendX = isMobile ? 0 : width - 120;
    var legendY = isMobile ? height - families.length * 20 : 0;

    var legendG = gLegend.selectAll("g.legend-item").data(families).enter().append("g")
      .attr("class", "legend-item")
      .attr("transform", function (d, i) { return "translate(" + legendX + "," + (legendY + i * 20) + ")"; });

    legendG.append("rect").attr("width", 12).attr("height", 12).attr("rx", 2)
      .attr("fill", function (d) { return FAMILY_COLORS[d]; });
    legendG.append("text").attr("x", 18).attr("y", 10)
      .attr("font-size", isMobile ? "9px" : "11px").attr("fill", PALETTE.textSecondary)
      .text(function (d) { return d; });
  }

  /* ================================================================
   *  STEP 4: Transition to treemap
   * ================================================================ */
  function step4(direction) {
    gAnnotations.selectAll("*").remove();
    gLegend.selectAll("*").remove();
    cleanBeeswarm();

    /* Fade map land */
    gMap.selectAll("path.land").transition().duration(DURATION / 2).ease(EASE).attr("opacity", 0);

    /* Move bubbles toward treemap cell centers */
    gBubbles.selectAll("circle.bubble")
      .transition().duration(DURATION).ease(EASE)
      .attr("cx", function (d) {
        var cell = industryCell[d.top_industry];
        return cell ? cell.x : width / 2;
      })
      .attr("cy", function (d) {
        var cell = industryCell[d.top_industry];
        return cell ? cell.y : height / 2;
      })
      .attr("r", function (d) { return Math.min(rScale(d.total_cap), 20); })
      .attr("fill", function (d) { return FAMILY_COLORS[d.sector_family] || FAMILY_COLORS.Other; })
      .attr("opacity", 0.7)
      .transition().duration(DURATION / 2)
      .attr("opacity", 0)
      .remove();

    /* Draw treemap rects after bubble travel */
    var rects = gTreemap.selectAll("rect.tm-cell").data(treemapLeaves, function (d) { return d.data.industry; });

    rects.exit().transition().duration(DURATION / 2).attr("opacity", 0).remove();

    rects.enter().append("rect")
      .attr("class", "tm-cell")
      .attr("x", function (d) { return d.x0; })
      .attr("y", function (d) { return d.y0; })
      .attr("width", function (d) { return Math.max(0, d.x1 - d.x0); })
      .attr("height", function (d) { return Math.max(0, d.y1 - d.y0); })
      .attr("rx", 4)
      .attr("fill", function (d) { return FAMILY_COLORS[d.data.sector_family] || FAMILY_COLORS.Other; })
      .attr("opacity", 0)
      .transition().delay(DURATION).duration(DURATION).ease(EASE)
      .attr("opacity", 0.85);

    /* Also update existing */
    rects.transition().duration(DURATION).ease(EASE).attr("opacity", 0.85);
  }

  /* ================================================================
   *  STEP 5: Highlight top 10
   * ================================================================ */
  function step5(direction) {
    gAnnotations.selectAll("*").remove();

    var top10 = industries.slice(0, 10);
    var top10Names = new Set(top10.map(function (d) { return d.industry; }));

    /* Dim non-top-10 */
    gTreemap.selectAll("rect.tm-cell")
      .transition().duration(DURATION).ease(EASE)
      .attr("opacity", function (d) { return top10Names.has(d.data.industry) ? 0.9 : 0.15; });

    /* Add labels on top-10 cells */
    var labels = gAnnotations.selectAll("text.tm-label").data(
      treemapLeaves.filter(function (d) { return top10Names.has(d.data.industry); }),
      function (d) { return d.data.industry; }
    );

    labels.enter().append("text")
      .attr("class", "tm-label")
      .attr("x", function (d) { return d.x0 + 6; })
      .attr("y", function (d) { return d.y0 + 16; })
      .attr("font-size", "12px")
      .attr("font-weight", 600)
      .attr("fill", "#fff")
      .attr("opacity", 0)
      .text(function (d) {
        var cellW = d.x1 - d.x0;
        var cellH = d.y1 - d.y0;
        if (isMobile && (cellW < 40 || cellH < 30)) return "";
        var maxW = Math.max(0, cellW - 12);
        var charW = isMobile ? 5.5 : 6.5;
        var maxChars = Math.floor(maxW / charW);
        return truncate(d.data.industry, Math.max(4, maxChars));
      })
      .transition().duration(DURATION).ease(EASE)
      .attr("opacity", 1);
  }

  /* ================================================================
   *  STEP 6: Add cap labels
   * ================================================================ */
  function step6(direction) {
    var top10 = industries.slice(0, 10);
    var top10Names = new Set(top10.map(function (d) { return d.industry; }));

    /* Ensure top-10 label text is present (from step5 content) */
    /* Add cap value text below industry name */
    var capLabels = gAnnotations.selectAll("text.tm-cap").data(
      treemapLeaves.filter(function (d) { return top10Names.has(d.data.industry); }),
      function (d) { return d.data.industry; }
    );

    capLabels.enter().append("text")
      .attr("class", "tm-cap")
      .attr("x", function (d) { return d.x0 + 6; })
      .attr("y", function (d) { return d.y0 + 30; })
      .attr("font-size", "11px")
      .attr("fill", "rgba(255,255,255,0.8)")
      .attr("opacity", 0)
      .text(function (d) {
        var cellW = d.x1 - d.x0;
        var cellH = d.y1 - d.y0;
        if (isMobile && (cellW < 40 || cellH < 40)) return "";
        return fmtCap(d.data.total_cap);
      })
      .transition().duration(DURATION).ease(EASE)
      .attr("opacity", 1);
  }

  /* ================================================================
   *  STEP 7: Dissolve to beeswarm
   * ================================================================ */
  function step7(direction) {
    cleanButterfly();
    gAnnotations.selectAll("*").remove();
    gAxes.selectAll("*").remove();
    gLegend.selectAll("*").remove();

    /* Fade treemap */
    gTreemap.selectAll("rect.tm-cell")
      .transition().duration(DURATION / 2).ease(EASE).attr("opacity", 0).remove();
    gTreemap.selectAll("*").transition().duration(DURATION / 2).attr("opacity", 0).on("end", function () { d3.select(this).remove(); });

    /* x scale for YTD */
    var ytdExtent = d3.extent(perfData, function (d) { return d.ytd; });
    /* Add some padding */
    ytdExtent[0] = Math.min(ytdExtent[0], -50);
    ytdExtent[1] = Math.max(ytdExtent[1], 50);
    var xScale = d3.scaleLinear().domain(ytdExtent).range([0, width]).nice();

    /* Store scales for later steps */
    step7.xScale = xScale;

    var dotRadius = getDotRadius();
    var collideRadius = getCollideRadius();

    /* Create dots */
    /* Initialize positions at industry treemap cell center or chart center */
    perfData.forEach(function (d) {
      var cell = industryCell[d.industry];
      d.x = cell ? cell.x : width / 2;
      d.y = cell ? cell.y : height / 2;
    });

    var dots = gBeeswarm.selectAll("circle.dot").data(perfData, function (d) { return d._id; });
    dots.exit().transition().duration(DURATION / 2).attr("r", 0).remove();

    var entering = dots.enter().append("circle")
      .attr("class", "dot")
      .attr("cx", function (d) { return d.x; })
      .attr("cy", function (d) { return d.y; })
      .attr("r", 0)
      .attr("fill", function (d) { return FAMILY_COLORS[d.sector_family] || FAMILY_COLORS.Other; })
      .attr("opacity", 0.7);

    /* Touch handler on dots */
    entering.on("touchstart", function (event, d) {
      event.preventDefault();
      showTooltip("<b>" + d.issuer + "</b><br>" + d.ytd.toFixed(1) + "% YTD<br>$" + (d.cap / 1e9).toFixed(1) + "B", event);
    });

    entering.transition().delay(DURATION / 2).duration(DURATION / 2).attr("r", dotRadius);

    /* Force simulation */
    if (simulation) simulation.stop();

    simulation = d3.forceSimulation(perfData)
      .force("x", d3.forceX(function (d) { return xScale(d.ytd); }).strength(0.8))
      .force("y", d3.forceY(height / 2).strength(0.15))
      .force("collide", d3.forceCollide(collideRadius))
      .alpha(1)
      .alphaDecay(0.01);

    if (isMobile) {
      simulation.stop();
      for (var i = 0; i < 300; i++) simulation.tick();
      gBeeswarm.selectAll("circle.dot")
        .attr("cx", function (d) { return d.x; })
        .attr("cy", function (d) { return d.y; });
    } else {
      var tickCount = 0;
      simulation.on("tick", function () {
        gBeeswarm.selectAll("circle.dot")
          .attr("cx", function (d) { return d.x; })
          .attr("cy", function (d) { return d.y; });
        tickCount++;
        if (tickCount > 300) simulation.stop();
      });
    }

    /* X axis */
    var xAxis = d3.axisBottom(xScale).tickFormat(function (d) { return d + "%"; });
    gAxes.append("g")
      .attr("class", "x-axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis)
      .selectAll("text").attr("fill", PALETTE.textSecondary).attr("font-size", "11px");

    gAxes.selectAll(".x-axis path, .x-axis line").attr("stroke", PALETTE.border);
  }

  /* ================================================================
   *  STEP 8: Industry swim lanes
   * ================================================================ */
  function step8(direction) {
    gAnnotations.selectAll("*").remove();

    if (!step7.xScale) step7(direction);
    var xScale = step7.xScale;

    var dotRadius = getDotRadius();
    var collideRadius = getCollideRadius();

    /* Top industries by count */
    var sortedByCount = industries.slice().sort(function (a, b) { return b.count - a.count; });
    var topN = isMobile ? 5 : 8;
    var topIndustries = sortedByCount.slice(0, topN).map(function (d) { return d.industry; });
    var bandDomain = topIndustries.concat(["Other"]);

    var yBand = d3.scaleBand().domain(bandDomain).range([0, height]).padding(0.08);
    step8.yBand = yBand;
    step8.topIndustries = new Set(topIndustries);

    /* Map each perf datum to a band */
    perfData.forEach(function (d) {
      d._band = step8.topIndustries.has(d.industry) ? d.industry : "Other";
    });

    /* Update force Y targets */
    if (simulation) simulation.stop();

    simulation = d3.forceSimulation(perfData)
      .force("x", d3.forceX(function (d) { return xScale(d.ytd); }).strength(0.8))
      .force("y", d3.forceY(function (d) { return yBand(d._band) + yBand.bandwidth() / 2; }).strength(0.6))
      .force("collide", d3.forceCollide(collideRadius))
      .alpha(0.3)
      .alphaDecay(0.015);

    if (isMobile) {
      simulation.stop();
      for (var i = 0; i < 200; i++) simulation.tick();
      gBeeswarm.selectAll("circle.dot")
        .attr("cx", function (d) { return d.x; })
        .attr("cy", function (d) { return d.y; });
    } else {
      var tickCount = 0;
      simulation.on("tick", function () {
        gBeeswarm.selectAll("circle.dot")
          .attr("cx", function (d) { return d.x; })
          .attr("cy", function (d) { return d.y; });
        tickCount++;
        if (tickCount > 200) simulation.stop();
      });
    }

    /* Reset dot visuals */
    gBeeswarm.selectAll("circle.dot")
      .transition().duration(DURATION / 2).ease(EASE)
      .attr("opacity", 0.7).attr("r", dotRadius);

    /* Y axis labels */
    gAxes.selectAll(".y-axis-label").remove();
    var yLabels = gAxes.selectAll("text.y-axis-label").data(bandDomain);
    yLabels.enter().append("text")
      .attr("class", "y-axis-label")
      .attr("x", -8)
      .attr("y", function (d) { return yBand(d) + yBand.bandwidth() / 2; })
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("font-size", isMobile ? "8px" : "10px")
      .attr("fill", PALETTE.textSecondary)
      .text(function (d) { return truncate(d, 22); });
  }

  /* ================================================================
   *  STEP 9: Highlight extremes
   * ================================================================ */
  function step9(direction) {
    gAnnotations.selectAll("*").remove();

    var extremeCount = isMobile ? 3 : 5;
    var sorted = perfData.slice().sort(function (a, b) { return a.ytd - b.ytd; });
    var bottomN = sorted.slice(0, extremeCount);
    var topN = sorted.slice(-extremeCount).reverse();
    var extremes = new Set(topN.concat(bottomN).map(function (d) { return d._id; }));

    var dotRadius = getDotRadius();

    /* Dim all, then highlight */
    gBeeswarm.selectAll("circle.dot")
      .transition().duration(DURATION).ease(EASE)
      .attr("opacity", function (d) { return extremes.has(d._id) ? 1 : 0.15; })
      .attr("r", function (d) { return extremes.has(d._id) ? 6 : dotRadius; });

    /* Labels */
    var labelData = topN.concat(bottomN);
    labelData.forEach(function (d) {
      gAnnotations.append("text")
        .attr("x", d.x + 10)
        .attr("y", d.y + 4)
        .attr("font-size", isMobile ? "9px" : "11px")
        .attr("font-weight", 500)
        .attr("fill", PALETTE.text)
        .attr("opacity", 0)
        .text(truncate(d.issuer, 25) + " (" + (d.ytd > 0 ? "+" : "") + d.ytd.toFixed(1) + "%)")
        .transition().duration(DURATION).ease(EASE)
        .attr("opacity", 1);
    });
  }

  /* ================================================================
   *  STEP 10: Butterfly chart
   * ================================================================ */
  function step10(direction) {
    cleanBeeswarm();
    gAnnotations.selectAll("*").remove();
    gAxes.selectAll("*").remove();
    gLegend.selectAll("*").remove();
    if (simulation) { simulation.stop(); simulation = null; }

    var losers = saaspocalypse.losers;
    var winners = saaspocalypse.winners;

    /* On mobile, reduce data set */
    if (isMobile) {
      losers = losers.slice(0, 8);
      winners = winners.slice(0, 5);
    }

    var allCompanies = losers.concat([{ issuer: "---separator---", ytd: 0, _sep: true }]).concat(winners);
    var allNames = allCompanies.map(function (d) { return d.issuer; });

    var yBand = d3.scaleBand().domain(allNames).range([0, height]).padding(0.15);

    /* Enforce minimum bar height — reduce data further if needed */
    if (isMobile && yBand.bandwidth() < 12) {
      while (yBand.bandwidth() < 12 && (losers.length + winners.length) > 4) {
        if (losers.length > winners.length) {
          losers = losers.slice(0, losers.length - 1);
        } else {
          winners = winners.slice(0, winners.length - 1);
        }
        allCompanies = losers.concat([{ issuer: "---separator---", ytd: 0, _sep: true }]).concat(winners);
        allNames = allCompanies.map(function (d) { return d.issuer; });
        yBand = d3.scaleBand().domain(allNames).range([0, height]).padding(0.15);
      }
    }

    var minYtd = d3.min(losers, function (d) { return d.ytd || 0; });
    var maxYtd = d3.max(winners, function (d) { return d.ytd || 0; });
    var absMax = Math.max(Math.abs(minYtd), Math.abs(maxYtd)) * 1.2;
    var xScale = d3.scaleLinear().domain([-absMax, absMax]).range([0, width]).nice();

    step10.yBand = yBand;
    step10.xScale = xScale;
    step10.losers = losers;
    step10.winners = winners;

    var center = xScale(0);

    /* Center line */
    gButterfly.append("line")
      .attr("class", "center-line")
      .attr("x1", center).attr("x2", center)
      .attr("y1", 0).attr("y2", height)
      .attr("stroke", PALETTE.border)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,4");

    /* Bars */
    var barsData = allCompanies.filter(function (d) { return !d._sep; });
    var bars = gButterfly.selectAll("rect.bf-bar").data(barsData, function (d) { return d.issuer; });

    bars.enter().append("rect")
      .attr("class", "bf-bar")
      .attr("y", function (d) { return yBand(d.issuer); })
      .attr("height", yBand.bandwidth())
      .attr("x", center)
      .attr("width", 0)
      .attr("rx", 3)
      .attr("fill", function (d) { return (d.ytd || 0) < 0 ? PALETTE.negative : PALETTE.positive; })
      .attr("opacity", 0.85)
      .on("touchstart", function (event, d) {
        event.preventDefault();
        var html = "<b>" + d.issuer + "</b><br>" + (d.ytd > 0 ? "+" : "") + (d.ytd || 0).toFixed(1) + "% YTD";
        if (d.news) html += "<br><em>" + d.news + "</em>";
        showTooltip(html, event);
      })
      .transition().duration(DURATION).ease(EASE)
      .attr("x", function (d) {
        var v = d.ytd || 0;
        return v < 0 ? xScale(v) : center;
      })
      .attr("width", function (d) {
        var v = d.ytd || 0;
        return Math.abs(xScale(v) - center);
      });

    /* Y axis labels (company names) */
    barsData.forEach(function (d) {
      gButterfly.append("text")
        .attr("class", "bf-name")
        .attr("x", function () { return (d.ytd || 0) < 0 ? center + 8 : center - 8; })
        .attr("y", yBand(d.issuer) + yBand.bandwidth() / 2 + 4)
        .attr("text-anchor", function () { return (d.ytd || 0) < 0 ? "start" : "end"; })
        .attr("font-size", isMobile ? "9px" : "11px")
        .attr("font-weight", 500)
        .attr("fill", PALETTE.text)
        .text(truncate(d.issuer.replace(/ (Inc|Corp|Ltd|Co|Technology|Holdings|Group|Plc).*$/i, ""), isMobile ? 15 : 20));
    });

    /* X axis */
    var xAxis = d3.axisBottom(xScale).tickFormat(function (d) { return d + "%"; }).ticks(7);
    gAxes.append("g")
      .attr("class", "x-axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis)
      .selectAll("text").attr("fill", PALETTE.textSecondary).attr("font-size", "11px");
    gAxes.selectAll(".x-axis path, .x-axis line").attr("stroke", PALETTE.border);

    gAxes.append("text")
      .attr("x", width / 2).attr("y", height + 45)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px").attr("fill", PALETTE.textSecondary)
      .text("% YTD");
  }

  /* ================================================================
   *  STEP 11: Annotate losers
   * ================================================================ */
  function step11(direction) {
    gAnnotations.selectAll(".winner-ann").remove();
    gAnnotations.selectAll(".callout-box").remove();
    gAnnotations.selectAll(".callout-text").remove();

    var losers = step10.losers || saaspocalypse.losers;
    var xScale = step10.xScale;
    var yBand = step10.yBand;

    if (!xScale || !yBand) return;

    /* Remove old loser annotations to avoid doubles */
    gAnnotations.selectAll(".loser-ann").remove();

    losers.forEach(function (d, i) {
      if (!d.news) return;
      var barX = xScale(d.ytd || 0);
      gAnnotations.append("text")
        .attr("class", "loser-ann")
        .attr("x", barX - 6)
        .attr("y", yBand(d.issuer) + yBand.bandwidth() / 2 + 4)
        .attr("text-anchor", "end")
        .attr("font-size", "10px")
        .attr("fill", PALETTE.textSecondary)
        .attr("opacity", 0)
        .text(truncate(d.news, isMobile ? 25 : 55))
        .transition().duration(DURATION / 2).ease(EASE)
        .delay(i * 50)
        .attr("opacity", 1);
    });
  }

  /* ================================================================
   *  STEP 12: Annotate winners + final callout
   * ================================================================ */
  function step12(direction) {
    var winners = step10.winners || saaspocalypse.winners;
    var xScale = step10.xScale;
    var yBand = step10.yBand;

    if (!xScale || !yBand) return;

    gAnnotations.selectAll(".winner-ann").remove();
    gAnnotations.selectAll(".callout-box").remove();
    gAnnotations.selectAll(".callout-text").remove();

    winners.forEach(function (d, i) {
      if (!d.news) return;
      var barX = xScale(d.ytd || 0);
      gAnnotations.append("text")
        .attr("class", "winner-ann")
        .attr("x", barX + 6)
        .attr("y", yBand(d.issuer) + yBand.bandwidth() / 2 + 4)
        .attr("text-anchor", "start")
        .attr("font-size", "10px")
        .attr("fill", PALETTE.textSecondary)
        .attr("opacity", 0)
        .text(truncate(d.news, isMobile ? 25 : 55))
        .transition().duration(DURATION / 2).ease(EASE)
        .delay(i * 50)
        .attr("opacity", 1);
    });

    /* Final callout box */
    var boxW = isMobile ? Math.min(280, width - 20) : Math.min(400, width - 40);
    var boxH = 40;
    var boxX = (width - boxW) / 2;
    var boxY = height - 60;

    gAnnotations.append("rect")
      .attr("class", "callout-box")
      .attr("x", boxX).attr("y", boxY)
      .attr("width", boxW).attr("height", boxH)
      .attr("rx", 6)
      .attr("fill", PALETTE.card)
      .attr("stroke", PALETTE.accent)
      .attr("stroke-width", 2)
      .attr("opacity", 0)
      .transition().delay(400).duration(DURATION).ease(EASE)
      .attr("opacity", 1);

    gAnnotations.append("text")
      .attr("class", "callout-text")
      .attr("x", boxX + boxW / 2).attr("y", boxY + boxH / 2 + 5)
      .attr("text-anchor", "middle")
      .attr("font-size", isMobile ? "11px" : "13px")
      .attr("font-weight", 700)
      .attr("fill", PALETTE.text)
      .text("NVIDIA \u22123.4% \u00B7 The real winners are the supply chain")
      .attr("opacity", 0)
      .transition().delay(400).duration(DURATION).ease(EASE)
      .attr("opacity", 1);
  }

  /* ================================================================
   *  Cleanup helpers
   * ================================================================ */
  function cleanTreemap() {
    gTreemap.selectAll("*").interrupt().remove();
  }

  function cleanBeeswarm() {
    if (simulation) { simulation.stop(); simulation = null; }
    gBeeswarm.selectAll("*").interrupt().remove();
    gAxes.selectAll("*").remove();
  }

  function cleanButterfly() {
    gButterfly.selectAll("*").interrupt().remove();
  }

  /* ================================================================
   *  Step dispatcher
   * ================================================================ */
  function handleStep(stepNum, direction) {
    /* For backward scrolling we rebuild the needed state */
    switch (stepNum) {
      case 1: step1(direction); break;
      case 2:
        if (currentStep > 3) step1(direction);
        step2(direction);
        break;
      case 3:
        if (currentStep > 3) step1(direction);
        step3(direction);
        break;
      case 4:
        if (currentStep > 6) { step1("down"); } /* need bubbles to exist */
        step4(direction);
        break;
      case 5:
        if (currentStep > 6 || currentStep < 4) step4(direction);
        step5(direction);
        break;
      case 6:
        if (currentStep > 6 || currentStep < 4) step4(direction);
        if (currentStep !== 5) step5(direction);
        step6(direction);
        break;
      case 7:
        if (currentStep > 9 || currentStep < 4) {
          step4(direction);
        }
        step7(direction);
        break;
      case 8:
        if (!step7.xScale) step7(direction);
        step8(direction);
        break;
      case 9:
        if (!step7.xScale) step7(direction);
        if (!step8.yBand) step8(direction);
        step9(direction);
        break;
      case 10:
        step10(direction);
        break;
      case 11:
        if (!step10.xScale) step10(direction);
        step11(direction);
        break;
      case 12:
        if (!step10.xScale) step10(direction);
        if (direction === "down" && currentStep !== 11) step11(direction);
        step12(direction);
        break;
    }
    currentStep = stepNum;
  }

  /* ================================================================
   *  Scrollama init
   * ================================================================ */
  var scroller = scrollama();
  scroller.setup({
    step: ".step",
    offset: isMobile ? 0.7 : 0.5,
    progress: false
  }).onStepEnter(function (response) {
    var element = response.element;
    var index = response.index;
    var direction = response.direction;

    /* Toggle active class */
    document.querySelectorAll(".step").forEach(function (s) { s.classList.remove("is-active"); });
    element.classList.add("is-active");

    /* Dispatch */
    handleStep(index + 1, direction);
  });

  /* Handle resize — debounced */
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      isMobile = getIsMobile();
      var containerRect = svgEl.parentElement.getBoundingClientRect();
      svgWidth = Math.round(containerRect.width) || 800;
      svgHeight = Math.round(containerRect.height) || 700;
      margin = isMobile
        ? { top: 20, right: 16, bottom: 40, left: 40 }
        : { top: 40, right: 40, bottom: 60, left: 60 };
      width = svgWidth - margin.left - margin.right;
      height = svgHeight - margin.top - margin.bottom;
      svg.attr("viewBox", "0 0 " + svgWidth + " " + svgHeight);
      rScale.range([4, isMobile ? 35 : 60]);
      scroller.resize();
      handleStep(currentStep, "down");
    }, 250);
  });

  /* Trigger first step if already in view */
  handleStep(1, "down");
})();
