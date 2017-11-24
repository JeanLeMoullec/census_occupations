var sgcI18nRoot = "lib/statcan_sgc/i18n/sgc/",
  nocI18nRoot = "lib/canada-national-occupational-classification/i18n/",
  rootI18nRoot = "src/i18n/",
  sgcDataUrl = "lib/statcan_sgc/sgc.json",
  nocDataUrl = "lib/canada-national-occupational-classification/noc.json",
  canadaOccupationsDataUrl = "data/census_occupations.json",
  rootNs = "census_occupations",
  nocNs = "noc",
  container = d3.select(".occupations .data"),
  chart = container.append("svg")
    .attr("id", "census_occupations"),
  canadaSgc = "01",
  allNoc = "X",
  rootNocClassPrefix = "rootnoc_",
  nocIdPrefix = "noc",
  nocLvlPrefix = "lvl",
  workersProp = "count_elf_fyft",
  medIncProp = "med_earnings",
  state = {
    sgc: canadaSgc,
    hcdd: 1,
    property: workersProp,
    noc: "X"
  },
  workersFormatter = i18n.getNumberFormatter(0),
  salaryFormatter = {
    _formatter: i18n.getNumberFormatter({
      style: "currency",
      currency: "CAD",
      currencyDisplay: "symbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }),
    format: function() {
      var output = this._formatter.format.apply(this, arguments);
      return output.replace("CA", "");
    }
  },
  percentFormatter = {
    _formatter: i18n.getNumberFormatter({
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    cutOff: 1 / 10000,
    format: function(value) {
      if (value > 0 && value < this.cutOff)
        return "< " + this._formatter.format(this.cutOff);

      return this._formatter.format(value);
    }
  },
  settings = {
    aspectRatio: 16 / 12,
    getId: function(d) {
      return nocIdPrefix + (d.data.nocId ? d.data.nocId : allNoc);
    },
    getValue: function(d) {
      if (d.children === undefined)
        return d[state.property];
      return 0;
    },
    getText: function(d) {
      if (d.value > 0) {
        return i18next.t(d.data.nocId, {ns: nocNs});
      }
      return "";
    },
    getClass: function(d) {
      var up = d,
        level = 1,
        rootId;

      while (up.parent !== undefined && up.parent !== null && up.parent.data.nocId !== undefined) {
        up = up.parent;
        level++;
      }

      rootId = up.data.nocId;

      if (rootId !== undefined)
        return rootNocClassPrefix + rootId + " " + nocLvlPrefix + level;

      return "root";
    },
    zoomCallback(id) {
      state.noc = id.replace(nocIdPrefix, "");
      showValues();
    }
  },
  getNocId = function(nocElmId) {
    return nocElmId.replace(nocIdPrefix, "");
  },
  showData = function() {
    var bindData = function(data) {
        var clone = [],
          recurse = function(arr, parent) {
            var n, noc, binding;
            for (n = 0; n < arr.length; n++) {
              noc = arr[n];
              binding = {
                nocId: noc.id
              };

              if (noc.children !== undefined) {
                binding.children = [];
                recurse(noc.children, binding);
              }

              if (Array.isArray(parent)) {
                parent.push(binding);
              }
              else if (typeof parent === "object") {
                parent.children.push(binding);
              }

              binding[state.property] = canadaOccupationsData.getDataPoint($.extend({}, state, {noc: noc.id}));
            }
          };

        recurse(data.roots, clone);
        return clone;
      },
      data = {
        children: bindData(nocData)
      };

    settings.zoom = nocIdPrefix + state.noc;
    chartObj = sunburstChart(chart, settings, data);
    showValues();
  },
  showValues = function(sett) {
    var info = chart.select(".info"),
      workers, medianIncome, percent;

    sett = sett || state;
    workers = canadaOccupationsData.getDataPoint(sett);
    medianIncome = canadaOccupationsData.getDataPoint($.extend({}, sett, {property: medIncProp}));
    percent = workers / canadaOccupationsData.getDataPoint($.extend({}, sett, {noc: allNoc}));

    info.select(".income").text(salaryFormatter.format(medianIncome));
    info.select(".num").text(workersFormatter.format(workers));
    info.select(".pt").text(percentFormatter.format(percent));
  },
  onSelect = function(e) {
    switch(e.target.id){
    case "noc":
      state.noc = e.target.value;
      chartObj.zoom(nocIdPrefix + state.noc);
      return;
    case "sgc":
      state.sgc = e.target.value;
      break;
    case "hcdd":
      state.hcdd = parseInt(e.target.value, 10);
      break;
    }
    showData();
  },
  onHover = function(e) {
    var hoverTopClass = "hover",
      hoverClass = "hovering",
      getNocSelector = function(nocId) {
        return "#" + nocIdPrefix + nocId;
      },
      hoverIn  = function() {
        var nocId = getNocId(e.target.parentNode.id),
          noc = nocData.getNoc(nocId),
          selector = getNocSelector(nocId),
          up = noc;

        if (up === undefined) {
          hoverOut();
          return;
        }

        // Hover Arcs effect
        chart.classed(hoverTopClass, true);

        while (up.parent !== undefined) {
          up = up.parent;
          selector += "," + getNocSelector(up.id);
        }

        chart.selectAll("." + hoverClass).classed(hoverClass, false);
        chart.selectAll(selector).classed(hoverClass, true);

        // Update info text
        showValues({
          sgc: state.sgc,
          hcdd: state.hcdd,
          noc: nocId,
          property: workersProp
        });
      },
      hoverOut = function() {
        chart.classed(hoverTopClass, false);
        showValues();
      };

    clearTimeout(hoverTimeout);
    switch (e.type) {
    case "mouseover":
      hoverIn();
      break;
    case "mouseout":
      hoverTimeout = setTimeout(hoverOut, 100);
    }
  },
  nocData, canadaOccupationsData, sgcData, hoverTimeout, chartObj;

i18n.load([sgcI18nRoot, nocI18nRoot, rootI18nRoot], function() {
  d3.queue()
    .defer(d3.json, sgcDataUrl)
    .defer(d3.json, nocDataUrl)
    .defer(d3.json, canadaOccupationsDataUrl)
    .await(function(error, sgcs, noc, occupations) {
      sgcData = sgcs;
      nocData = canada_noc(noc);
      canadaOccupationsData = require("canada_census_data")(occupations);

      var info = chart.append("text")
        .attr("x", 300)
        .attr("y", 180)
        .attr("class", "info");

      info.append("tspan")
        .attr("class", "h6")
        .text(i18next.t("average_inc", {ns: rootNs}));

      info.append("tspan")
        .attr("x", 300)
        .attr("y", 180)
        .attr("dy", "1.4em")
        .attr("class", "income value");

      info.append("tspan")
        .attr("x", 300)
        .attr("y", 230)
        .attr("class", "h6")
        .text(i18next.t("num_ppl", {ns: rootNs}));

      info.append("tspan")
        .attr("x", 300)
        .attr("y", 230)
        .attr("dy", "1.4em")
        .attr("class", "num value");

      info.append("tspan")
        .attr("x", 300)
        .attr("y", 280)
        .attr("class", "h6")
        .text(i18next.t("num_ppl", {ns: rootNs}));

      info.append("tspan")
        .attr("x", 300)
        .attr("y", 280)
        .attr("dy", "1.4em")
        .attr("class", "pt value");

      showData();

      $(document).on("change", ".occupations", onSelect);
      $(document).on("mouseover mouseout click", ".data .arc", onHover);
    });
});
