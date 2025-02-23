document.addEventListener("DOMContentLoaded", function() {
  console.log("script.js chargé");

  // =========================
  // 0) Dimensions / Sélection
  // =========================
  const width = 1200,
        height = 600;

  // Sélection du SVG + création d'un groupe principal pour le zoom/pan
  const svg = d3.select("#map")
    .attr("width", width)
    .attr("height", height);
  const g = svg.append("g");

  // =========================
  // (Optionnel) Filtre d’ombre portée


  // =========================
  // 1) Configuration du zoom/pan
  // =========================
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", event => g.attr("transform", event.transform));
  svg.call(zoom);

  // =========================
  // 2) Projection et géopath
  // =========================
  const projection = d3.geoNaturalEarth1()
    .scale(250)
    .translate([width/2.05, height/1.7 ]);
  const path = d3.geoPath().projection(projection);

  // =========================
  // Variables globales
  // =========================
  let waterData, geoData;

  // =========================
  // 3) Chargement des données
  // =========================
  Promise.all([
    // GeoJSON du monde
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
    // Données custom
    d3.json("data/water_data.json")
  ])
  .then(([countries, data]) => {
    // Assignation aux variables globales
    geoData = countries;
    waterData = data;

    // =========================
    // 4) Remplir liste indicateurs
    // =========================
    const indicators = [...new Set(waterData.map(d => d.Indicator))];
    d3.select("#indicator-select")
      .selectAll("option")
      .data(indicators)
      .enter()
      .append("option")
        .attr("value", d => d)
        .text(d => d);

    // =========================
    // 5) Dessiner la carte
    // =========================
    g.selectAll("path")
      .data(geoData.features)
      .enter()
      .append("path")
        .attr("d", path)
        .attr("fill", "#e0e0e0")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.5)
        .attr("filter", "url(#drop-shadow)")
        // Lorsqu'on clique sur un pays
        .on("click", handleCountryClick);

    // =========================
    // 6) Remplir listes de pays
    // =========================
    const allCountries = [...new Set(waterData.map(d => d.Country))].sort();

    // Pays 1
    d3.select("#country-select-1")
      .selectAll("option")
      .data(allCountries)
      .enter()
      .append("option")
        .attr("value", d => d)
        .text(d => d);

    // Pays 2
    d3.select("#country-select-2")
      .selectAll("option")
      .data(allCountries)
      .enter()
      .append("option")
        .attr("value", d => d)
        .text(d => d);

    // =========================
    // 7) Écouteurs d’événements
    // =========================
    d3.selectAll("#year-slider, #country-select-1, #country-select-2, #indicator-select")
      .on("input change", handleAllChanges);

    // =========================
    // 8) Premier appel (initialisation)
    // =========================
    handleAllChanges();

  })
  .catch(err => console.error("Erreur lors du chargement:", err));

  // =========================
  // handleAllChanges
  // =========================
  // Cette fonction met à jour la carte, le bar chart, et le line chart “live”
  function handleAllChanges() {
    // 1) Mise à jour de la carte
    updateMap();

    // 2) Bar chart comparatif
    updateComparisonBarChart();

    // 3) Line chart (live)
    const c1 = d3.select("#country-select-1").property("value");
    const c2 = d3.select("#country-select-2").property("value");
    const indicator = d3.select("#indicator-select").property("value");
    createLiveLineChart2(c1, c2, indicator);
  }

  // =========================
  // updateMap : Mise à jour de la carte (colorisation)
  // =========================
  function updateMap() {
    const year = d3.select("#year-slider").property("value");
    d3.select("#selected-year").text(year);

    const indicator = d3.select("#indicator-select").property("value");
    const filtered = waterData.filter(d => d.Year == year && d.Indicator === indicator);

    // Calculer la valeur max pour l'échelle
    const maxValue = d3.max(filtered, d => d.Value) || 0;

    // Créer une échelle de couleur allant du gris (#222222) au vert (#7fff00)
    const colorScale = d3.scaleSequential(d3.interpolateRgb("#222222", "#7fff00"))
      .domain([0, maxValue]);

    // Colorer chaque pays
    g.selectAll("path")
      .transition()
      .duration(500)
      .attr("fill", function(d) {
        const code = d.properties.iso_a3 || d.id;
        const rec = filtered.find(item => item.Country_Code === code);
        return rec ? colorScale(rec.Value) : "#222222"; // Couleur par défaut si aucune donnée
      });

    // =========================
    // Ajouter ou mettre à jour la légende continue
    // =========================

    // Supprimer l'ancienne légende (si elle existe)
    svg.select(".legend").remove();

    // Créer un groupe pour la légende
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - width + 20}, ${height - 140})`); // Position de la légende

    // Définir les dimensions de la légende
    const legendWidth = 20;
    const legendHeight = 120;

    // Créer un dégradé linéaire
    const gradientId = "legend-gradient";
    svg.append("defs")
        .append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%") // Début du dégradé (en bas)
            .attr("x2", "0%") // Fin du dégradé (en haut)
            .attr("y1", "100%")
            .attr("y2", "0%")
        .selectAll("stop")
            .data([
                { offset: "0%", color: "#222222" }, // Couleur de départ
                { offset: "100%", color: "#7fff00" } // Couleur d'arrivée
            ])
            .enter()
            .append("stop")
                .attr("offset", d => d.offset)
                .attr("stop-color", d => d.color);

    // Dessiner un rectangle avec le dégradé
    legend.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", `url(#${gradientId})`);

    // Ajouter des étiquettes de texte (min et max)
    legend.append("text")
        .attr("x", legendWidth + 5) // Position horizontale par rapport au rectangle
        .attr("y", 0)
        .text(maxValue.toFixed(2)) // Valeur maximale
        .style("font-size", "12px")
        .style("fill", "#ffffff")
        .style("alignment-baseline", "hanging"); // Alignement en haut

    legend.append("text")
        .attr("x", legendWidth + 5)
        .attr("y", legendHeight)
        .text("0.00") // Valeur minimale
        .style("font-size", "12px")
        .style("fill", "#ffffff")
        .style("alignment-baseline", "baseline"); // Alignement en bas

    // Ajouter un titre à la légende
    legend.append("text")
        .attr("x", 0)
        .attr("y", -20) // Position au-dessus du rectangle
        .text("en %")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "#ffffff");
}

  // =========================
  // handleCountryClick : au clic sur la carte
  // =========================
  function handleCountryClick(event, feature) {
    // [Optionnel] Marqueur sur la carte
    g.selectAll(".info-marker").remove();

    const centroid = path.centroid(feature);
    const marker = g.append("g")
      .attr("class", "info-marker")
      .attr("transform", `translate(${centroid[0]}, ${centroid[1]})`);

    marker.append("circle")
      .attr("r", 10)
      .attr("fill", "#7fff00")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    const countryName = feature.properties.name || "Inconnu";
    marker.append("text")
      .attr("x", 15)
      .attr("y", 5)
      .attr("fill", "#ffffff")  
      .text(countryName);

    // Logique pour remplir #country-select-1 ou #country-select-2
    const c1 = d3.select("#country-select-1").property("value");
    const c2 = d3.select("#country-select-2").property("value");

    // Si c1 est vide ou identique à c2 => on remplit c1, sinon c2
    if (!c1 || c1 === c2) {
      d3.select("#country-select-1").property("value", countryName);
    } else {
      d3.select("#country-select-2").property("value", countryName);
    }

    // Mettre à jour les visuels
    handleAllChanges();

    // [FACULTATIF] Si vous voulez afficher un line chart mono-pays, appelez ici :
    // createLineChartSingleCountry(feature);
  }

  // =========================
  // Bar chart comparatif (2 pays, pour tous les indicateurs d'une année)
  // =========================
  function updateComparisonBarChart() {
    const year = d3.select("#year-slider").property("value");
    const c1 = d3.select("#country-select-1").property("value");
    const c2 = d3.select("#country-select-2").property("value");

    createGroupedBarChart(c1, c2, year);
  }

  function createGroupedBarChart(country1, country2, year) {
    // Filtrage par année
    const dataYear = waterData.filter(d => d.Year == year);

    // Sous-ensembles
    const dataC1 = dataYear.filter(d => d.Country === country1);
    const dataC2 = dataYear.filter(d => d.Country === country2);

    // Identifiants d’indicateurs
    const indicatorsC1 = dataC1.map(d => d.Indicator);
    const indicatorsC2 = dataC2.map(d => d.Indicator);
    const allIndicators = Array.from(new Set([...indicatorsC1, ...indicatorsC2]));

    // Construire un tableau final
    const finalData = allIndicators.map(ind => {
      const recC1 = dataC1.find(d => d.Indicator === ind);
      const recC2 = dataC2.find(d => d.Indicator === ind);
      return {
        indicator: ind,
        [country1]: recC1 ? recC1.Value : 0,
        [country2]: recC2 ? recC2.Value : 0
      };
    });

    // Nettoyer l'ancien bar chart
    d3.select("#compare-bar-chart").html("");

    // Dimensions
    const margin = { top: 30, right: 20, bottom: 300, left: 200 },
          width = 1200 - margin.left - margin.right,
          height = 800 - margin.top - margin.bottom;

    // Création du SVG
    const svg = d3.select("#compare-bar-chart")
      .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Échelles X
    const x0 = d3.scaleBand()
      .domain(finalData.map(d => d.indicator))
      .range([0, width])
      .paddingInner(0.2);

    const x1 = d3.scaleBand()
      .domain([country1, country2])
      .range([0, x0.bandwidth()])
      .padding(0.1);

    // Échelle Y
    const maxValue = d3.max(finalData, d => Math.max(d[country1], d[country2])) || 0;
    const y = d3.scaleLinear()
      .domain([0, maxValue])
      .range([height, 0])
      .nice();

    // Couleurs
    const color = d3.scaleOrdinal()
      .domain([country1, country2])
      .range(["#7fff00", "#ffffff"]);

    // Groupes par indicateur
    const group = svg.selectAll(".group")
      .data(finalData)
      .enter()
      .append("g")
        .attr("class", "group")
        .attr("transform", d => `translate(${x0(d.indicator)}, 0)`);

    // Barres pour pays1 et pays2
    group.selectAll("rect")
      .data(d => [
        { key: country1, val: d[country1] },
        { key: country2, val: d[country2] }
      ])
      .enter()
      .append("rect")
        .attr("x", d => x1(d.key))
        .attr("y", d => y(d.val))
        .attr("width", x1.bandwidth())
        .attr("height", d => height - y(d.val))
        .attr("fill", d => color(d.key))
      .append("title")
        .text(d => `${d.key} : ${d.val.toFixed(2)}`);

    // Axe X
    svg.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x0))
      .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-0.8em")
        .attr("dy", "0.15em")
        .attr("transform", "rotate(-45)");

    // Axe Y
    svg.append("g")
      .call(d3.axisLeft(y));

    // Titre du bar chart
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .attr("fill", "#ffffff") // Nouvelle couleur du texte (noir)
      .text(`Comparaison de ${country1} et ${country2} - Année ${year}`);
  }

  // =========================
  // 4) Line chart “live” pour 2 pays / 1 indicateur
  // =========================
  function createLiveLineChart2(country1, country2, indicator) {
    // Filtrer data pour chaque pays
    const dataC1 = waterData.filter(d => d.Country === country1 && d.Indicator === indicator);
    const dataC2 = waterData.filter(d => d.Country === country2 && d.Indicator === indicator);

    // S’il n’y a pas de data
    if (dataC1.length === 0 && dataC2.length === 0) {
      d3.select("#chart-container").html("<p>Aucune donnée pour ces pays/indicateur.</p>");
      return;
    }

    // Trier par année
    dataC1.sort((a, b) => a.Year - b.Year);
    dataC2.sort((a, b) => a.Year - b.Year);

    // Étendue des années
    const allYears = d3.extent([
      ...dataC1.map(d => d.Year),
      ...dataC2.map(d => d.Year)
    ]);

    // Valeur max
    const maxVal = d3.max([
      d3.max(dataC1, d => d.Value),
      d3.max(dataC2, d => d.Value)
    ]);

    // Nettoyer l'ancien line chart
    d3.select("#chart-container").html("");

    // Dimensions
    const margin = { top: 30, right: 30, bottom: 30, left: 30 },
          chartWidth = 1000 - margin.left - margin.right,
          chartHeight = 500 - margin.top - margin.bottom;

    // Création du SVG
    const svgChart = d3.select("#chart-container")
      .append("svg")
        .attr("width", chartWidth + margin.left + margin.right)
        .attr("height", chartHeight + margin.top + margin.bottom);

    const g = svgChart.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Échelles
    const x = d3.scaleLinear()
      .domain(allYears)
      .range([0, chartWidth]);

    const y = d3.scaleLinear()
      .domain([0, maxVal])
      .range([chartHeight, 0])
      .nice();

    // Axes
    g.append("g")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    g.append("g")
      .call(d3.axisLeft(y));

    // Générateur de ligne
    const line = d3.line()
      .x(d => x(d.Year))
      .y(d => y(d.Value));

    // Préparer un tableau pour tracer 2 lignes
    const countriesData = [
      { name: country1, color: "#7fff00", data: dataC1 },
      { name: country2, color: "#ffffff", data: dataC2 }
    ];

    // Dessiner les 2 lignes avec animation
    countriesData.forEach((cObj, i) => {
      if (cObj.data.length > 0) {
        // Chemin
        const path = g.append("path")
          .datum(cObj.data)
          .attr("fill", "none")
          .attr("stroke", cObj.color)
          .attr("stroke-width", 4)
          .attr("d", line);

        // Animation stroke-dasharray
        const totalLength = path.node().getTotalLength();
        path
          .attr("stroke-dasharray", totalLength + " " + totalLength)
          .attr("stroke-dashoffset", totalLength)
          .transition()
            .delay(i * 300)   // petit décalage pour le 2e pays
            .duration(2000)
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0);
      }
    });

    // [MODIF] Titre selon pays identiques ou non
    let chartTitle;
    if (country1 === country2) {
      // Si c'est le même pays
      chartTitle = `${country1} : ${indicator}`;
    } else {
      // Deux pays différents
      chartTitle = `${country1} and ${country2} : ${indicator}`;
    }

    // Ajouter le titre
    g.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", -5)
      .attr("fill", "#ffffff")
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .text(chartTitle);
  }

  // =========================
  // 5) (Optionnel) Line chart mono-pays
  // =========================
  // Si vous souhaitez un chart isolé pour un seul pays au clic,
  // vous pouvez utiliser ou adapter cette fonction
  function createLineChartSingleCountry(feature) {
    // Nom de pays, code, etc.
    const countryCode = feature.properties.iso_a3;
    const countryName = feature.properties.name || "Inconnu";
    const indicator = d3.select("#indicator-select").property("value");

    // Filtrer data
    const countryData = waterData.filter(d => d.Country_Code === countryCode && d.Indicator === indicator);
    if (countryData.length === 0) {
      d3.select("#chart-container").html("<p>Aucune donnée pour ce pays et cet indicateur.</p>");
      return;
    }
    countryData.sort((a, b) => a.Year - b.Year);

    // Nettoyer
    d3.select("#chart-container").html("");

    // Dimensions
    const margin = { top: 20, right: 30, bottom: 40, left: 50 },
          chartWidth = 1000 - margin.left - margin.right,
          chartHeight = 500 - margin.top - margin.bottom;

    const svgChart = d3.select("#chart-container")
      .append("svg")
        .attr("width", chartWidth + margin.left + margin.right)
        .attr("height", chartHeight + margin.top + margin.bottom)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Axes
    const x = d3.scaleLinear()
      .domain(d3.extent(countryData, d => d.Year))
      .range([0, chartWidth]);
    svgChart.append("g")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    const y = d3.scaleLinear()
      .domain([0, d3.max(countryData, d => d.Value)])
      .range([chartHeight, 0])
      .nice();
    svgChart.append("g")
      .call(d3.axisLeft(y));

    // Ligne
    const line = d3.line()
      .x(d => x(d.Year))
      .y(d => y(d.Value));

    svgChart.append("path")
      .datum(countryData)
      .attr("fill", "none")
      .attr("stroke", "#0077b6")
      .attr("stroke-width", 2)
      .attr("d", line);

    // Points
    svgChart.selectAll("circle")
      .data(countryData)
      .enter()
      .append("circle")
        .attr("cx", d => x(d.Year))
        .attr("cy", d => y(d.Value))
        .attr("r", 4)
        .attr("fill", "#ff6b6b")
      .append("title")
        .text(d => `Année : ${d.Year}\nValeur : ${d.Value} ${d.Unit}`);

    // Titre
    svgChart.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .text(`${countryName} - ${indicator} (Évolution)`);
  }

});
