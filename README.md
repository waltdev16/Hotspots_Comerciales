#  📈 Linear Regression

**Machine Learning & Predictive Analysis | Python**

A Machine Learning project developed to analyze the relationship between study hours and academic performance using Linear Regression, data visualization, and predictive modeling.

---

## About the Project

Linear Regression is an academic Machine Learning project focused on predicting student scores based on the number of hours studied.

The project uses Python and Scikit-learn to train a regression model, analyze the relationship between variables, and generate predictions based on user input.

By incorporating data validation, model evaluation, and graphical visualization, the project demonstrates the fundamental principles of supervised Machine Learning.

## Project Goals

- Analyze the relationship between study hours and academic scores.
- Implement a Linear Regression model using Scikit-learn.
- Train the model using a dataset of 30 observations.
- Predict academic scores based on user input.
- Validate input values according to the dataset range.
- Evaluate model performance using R² and Mean Squared Error (MSE).
- Visualize the relationship between observed data and predicted values.

## Technologies Used

| Technology | Purpose |
|---|---|
| Python | Data processing and predictive modeling |
| Pandas | Dataset creation and manipulation |
| Scikit-learn | Linear Regression and model evaluation |
| Matplotlib | Data visualization and regression graphs |
| Google Colab | Interactive development and execution |

## Features

- **Linear Regression:** Predicts academic scores based on study hours.
- **Dataset Analysis:** Processes 30 observations containing study hours and scores.
- **Interactive Prediction:** Allows users to enter study hours and receive a predicted score.
- **Input Validation:** Identifies values outside the available dataset range.
- **Model Evaluation:** Calculates R² and MSE to assess model performance.
- **Data Visualization:** Displays observed data points and the fitted regression line.

## How It Works

The project follows a supervised Machine Learning workflow:

**1. Data Preparation**

A dataset containing 30 observations is organized into two variables: `HORAS_ESTUDIO` and `SCORE`.

**2. Variable Selection**

Study hours are defined as the independent variable (X), while academic scores represent the dependent variable (y).

**3. Model Training**

A Linear Regression model is trained using Scikit-learn to identify the relationship between the variables.

**4. Model Evaluation**

The model's performance is evaluated using the coefficient of determination (R²) and Mean Squared Error (MSE).

**5. Input Validation**

The program verifies whether the entered study hours fall within the dataset's supported range.

**6. Prediction and Visualization**

For valid inputs, the model generates a predicted score and displays a graph illustrating the relationship between study hours and academic performance.

## Development Process

**Dataset Creation**

Creation of a dataset containing 30 paired observations representing study hours and academic scores.

**Exploratory Data Analysis**

Inspection of the dataset and identification of the independent and dependent variables.

**Machine Learning Implementation**

Implementation of Linear Regression using Scikit-learn.

**Model Evaluation**

Calculation of the slope, intercept, R², and MSE to analyze the regression model.

**Input Validation**

Implementation of restrictions to prevent predictions outside the supported study-hours range.

**Results Visualization**

Generation of a scatter plot and regression line using Matplotlib.

## Running the Project

### Requirements

- Python 3.11 or newer, with compatible dependencies
- Git
- A Python-compatible development environment

### Installation

Clone the repository:

```bash
git clone https://github.com/USERNAME/Linear-Regression.git
cd Linear-Regression
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
python -m pip install -r requirements.txt
```

### Execution

Run the main program:

```bash
python main.py
```

Enter the number of study hours when prompted.

If the entered value falls within the dataset range, the program displays the predicted score and regression graph.

If the value exceeds the available range, an informative validation message is displayed.

## Project Structure

```text
Linear-Regression/
│
├── main.py
├── regresion_lineal_colab.ipynb
├── requirements.txt
├── regression.png
├── .gitignore
└── README.md
```

## Preview

The following visualization illustrates the relationship between study hours and academic scores.

![Linear Regression Visualization](regression.png)

The scatter plot represents the observed dataset, while the regression line illustrates the model's estimated relationship between the variables.

The project demonstrates how supervised Machine Learning can be used to analyze numerical data and generate predictions.

**Note:** The dataset is illustrative, and the predictions are intended for educational purposes rather than validated academic performance forecasting.

## Authors

- **Author:** Walter Santos
- **Co-Author:** Patricia Alvarado

---

**Linear Regression** · Machine Learning · Predictive Analysis · Python

*¡Supérate! Fundación Frech.*
