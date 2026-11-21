# 🌎 Hotspots Comerciales

**Geospatial Analysis & Machine Learning | El Salvador**

A geospatial analysis project developed to identify commercial clusters, analyze the distribution of automotive dealerships, and evaluate potential business locations using Machine Learning and geographic data.

**[Live Demo](https://waltdev16.github.io/Hotspots/)**

---

## About the Project

Hotspots Comerciales is an academic project focused on analyzing the geographic distribution of automotive dealerships in San Salvador, El Salvador.

The project combines Machine Learning algorithms, open geographic data, and interactive visualizations to identify commercial concentrations and evaluate potential locations for a new automotive dealership.

By integrating geographic information, population data, and road accessibility, the project provides a data-driven approach to commercial location analysis.

## Project Goals

- Identify geographic concentrations of existing automotive dealerships.
- Apply clustering algorithms to analyze commercial distribution.
- Classify proposed business locations using Machine Learning.
- Evaluate proximity to competitors and road accessibility.
- Integrate geographic and demographic information.
- Present the results through an interactive dashboard.

## Technologies Used

| Technology | Purpose |
|---|---|
| Python | Data processing and analysis |
| Pandas | Data cleaning and manipulation |
| Scikit-learn | K-Means clustering and KNN classification |
| GeoPandas | Geospatial data processing |
| OpenStreetMap | Geographic data collection |
| Overpass Turbo | Extraction of dealership locations |
| OSMnx | Road network and accessibility analysis |
| Folium | Interactive geographic maps |
| Jupyter Notebook | Analysis and documentation |
| HTML, CSS & JavaScript | Web dashboard and visualization |

## Features

- **Geographic Clustering:** Identification of commercial concentration zones using K-Means.
- **Location Classification:** Classification of proposed locations through K-Nearest Neighbors.
- **Interactive Maps:** Geographic visualization of dealerships, clusters, and proposed locations.
- **Competitor Analysis:** Evaluation of nearby dealerships and geographic distances.
- **Road Accessibility:** Analysis of road network connections and travel distances.
- **Demographic Integration:** Incorporation of population and district information.
- **Location Comparison:** Evaluation of three proposed locations: A, B, and C.
- **Interactive Dashboard:** Visualization of results through a web interface.

## How It Works

The project follows a geospatial analysis workflow:

**1. Data Collection**

Automotive dealership locations are obtained from OpenStreetMap using Overpass Turbo.

**2. Data Preparation**

The dataset is reviewed and cleaned by checking missing values, geographic coordinates, and duplicate records.

**3. K-Means Clustering**

K-Means groups dealerships according to their geographic proximity, identifying areas with similar spatial characteristics.

**4. KNN Classification**

K-Nearest Neighbors classifies proposed business locations based on the geographic patterns identified in the training data.

**5. Geographic Analysis**

Population information, district boundaries, competitor proximity, and road accessibility are integrated into the analysis.

**6. Visualization**

The results are presented through interactive maps and a web dashboard.

## Development Process

The project was developed through several stages:

**Research and Data Collection**

Identification of public geographic datasets and collection of automotive dealership locations in San Salvador.

**Exploratory Data Analysis**

Dataset inspection, coordinate validation, and evaluation of available records.

**Machine Learning Implementation**

Implementation and evaluation of K-Means and KNN using Scikit-learn.

**Geospatial Integration**

Processing of geographic boundaries, demographic information, and road network data.

**Location Evaluation**

Comparison of three hypothetical locations using geographic and accessibility indicators.

**Dashboard Development**

Development of a web interface to explore the geographic analysis and visualize the results.

## Running the Project

### Requirements

- Python 3.11 or newer
- Git
- A Python-compatible development environment

### Installation

Clone the repository:

```bash
git clone https://github.com/waltdev16/Hotspots.git
cd Hotspots
```

Create a virtual environment:

```bash
python -m venv .venv
```

Activate the environment on Windows:

```bash
.venv\Scripts\activate
```

Install the required dependencies:

```bash
pip install -r requirements.txt
```

### Execution

Run the main analysis:

```bash
python main.py
```

Alternatively, open `hotspots.ipynb` in Jupyter Notebook or Visual Studio Code to explore the analysis step by step.

The interactive dashboard is also available online:

**[Hotspots Comerciales — Live Demo](https://waltdev16.github.io/Hotspots/)**

## Project Structure

The main components of the project are organized as follows:

```text
Hotspots/
│
├── main.py
├── hotspots.ipynb
├── mercado_integrado.py
├── requirements.txt
│
├── datos_censo/
│   └── poblacion_san_salvador_2024.csv
│
├── datos_geograficos/
│   └── distritos_opamss.geojson
│
├── resultados/
│   ├── centroides.csv
│   ├── vecinos_knn.csv
│   ├── auditoria_osm.csv
│   ├── comparacion_mercado_integrada.csv
│   ├── accesibilidad_competencia.csv
│   └── mapa_mercado_integrado.html
│
└── README.md
```

*The structure represents the main analysis components; additional files may be included in the repository.*

## Preview

Explore the interactive dashboard to visualize commercial clusters, geographic data, and the comparison of proposed locations.

**[Open Interactive Dashboard](https://waltdev16.github.io/Hotspots/)**

The analysis identified two geographic clusters and evaluated three proposed business locations.

Based on the criteria considered, **Location C** was selected as the preferred alternative within the academic analysis.

The results are intended for educational and exploratory purposes and do not guarantee commercial profitability.

## Authors

**Walter Santos** — Author

Project development, data analysis, Machine Learning implementation, and geospatial visualization.

**Patricia Alvarado** — Co-author

Project collaboration, research, and analysis.

---

**Hotspots Comerciales** · Geospatial Analysis · Machine Learning · Python

*¡Supérate! Fundación Frech.*
