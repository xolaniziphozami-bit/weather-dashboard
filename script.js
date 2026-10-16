// =============================================
// ATMOS — WEATHER DASHBOARD
// Weather data: Open-Meteo
// =============================================

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

// Find the HTML elements we need to update.
const searchForm = document.querySelector("#search-form");
const cityInput = document.querySelector("#city-input");
const searchButton = document.querySelector("#search-button");
const statusMessage = document.querySelector("#status-message");

const cityName = document.querySelector("#city-name");
const currentDate = document.querySelector("#current-date");
const weatherCondition = document.querySelector("#weather-condition");
const temperature = document.querySelector("#temperature");
const feelsLike = document.querySelector("#feels-like");
const humidity = document.querySelector("#humidity");
const windSpeed = document.querySelector("#wind-speed");
const uvIndex = document.querySelector("#uv-index");
const weatherIcon = document.querySelector("#weather-icon");
const forecastGrid = document.querySelector("#forecast-grid");

// Translate Open-Meteo weather codes into readable conditions.
function getWeatherInfo(code, isDay = true) {
    if (code === 0) {
        return {
            description: isDay ? "Clear sky" : "Clear night",
            icon: isDay ? "☀" : "☾"
        };
    }

    if (code === 1) {
        return { description: "Mainly clear", icon: isDay ? "☀" : "☾" };
    }

    if (code === 2) {
        return { description: "Partly cloudy", icon: "◐" };
    }

    if (code === 3) {
        return { description: "Overcast", icon: "☁" };
    }

    if ([45, 48].includes(code)) {
        return { description: "Foggy", icon: "≋" };
    }

    if ([51, 53, 55, 56, 57].includes(code)) {
        return { description: "Drizzle", icon: "☂" };
    }

    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
        return { description: "Rain", icon: "☂" };
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
        return { description: "Snow", icon: "❄" };
    }

    if ([95, 96, 99].includes(code)) {
        return { description: "Thunderstorm", icon: "ϟ" };
    }

    return { description: "Conditions unavailable", icon: "◌" };
}

// Display a status message to the user.
function setStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "status-message";

    if (type) {
        statusMessage.classList.add(type);
    }
}

// Update the loading state of the search button.
function setLoading(isLoading) {
    searchButton.disabled = isLoading;
    cityInput.disabled = isLoading;

    searchButton.innerHTML = isLoading
        ? "Loading..."
        : 'Explore <span aria-hidden="true">↗</span>';

    searchButton.setAttribute("aria-busy", String(isLoading));
}

// Safely retrieve JSON from an API.
async function fetchJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
}

// Find a city and retrieve its geographical coordinates.
async function findCity(city) {
    const url = new URL(GEOCODING_URL);

    url.search = new URLSearchParams({
        name: city,
        count: "10",
        language: "en",
        format: "json"
    });

    const data = await fetchJSON(url);

    if (!data.results || data.results.length === 0) {
        throw new Error(
            `We couldn't find "${city}". Check the spelling and try again.`
        );
    }

    // Prefer an exact city-name match where possible.
    const exactMatch = data.results.find(
        place => place.name.toLowerCase() === city.toLowerCase()
    );

    return exactMatch || data.results[0];
}

// Retrieve current conditions and a five-day forecast.
async function getWeather(latitude, longitude) {
    const url = new URL(WEATHER_URL);

    url.search = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),

        current: [
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "is_day",
            "weather_code",
            "wind_speed_10m"
        ].join(","),

        hourly: "uv_index",

        daily: [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min"
        ].join(","),

        forecast_days: "5",
        timezone: "auto",
        temperature_unit: "celsius",
        wind_speed_unit: "kmh"
    });

    return fetchJSON(url);
}

// Format a date for the dashboard.
function formatDate(dateString, options = {}) {
    const date = new Date(`${dateString}T12:00:00`);

    return new Intl.DateTimeFormat("en-ZA", {
        timeZone: "UTC",
        ...options
    }).format(date);
}

// Update the current-weather card.
function displayCurrentWeather(place, data) {
    const current = data.current;
    const isDay = current.is_day === 1;
    const weather = getWeatherInfo(current.weather_code, isDay);

    cityName.textContent = [
        place.name,
        place.admin1,
        place.country
    ].filter(Boolean).filter((value, index, array) =>
        array.indexOf(value) === index
    ).join(", ");

    currentDate.textContent = formatDate(
        current.time.slice(0, 10),
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

    weatherCondition.textContent = weather.description;

    temperature.textContent = Math.round(current.temperature_2m);

    feelsLike.textContent =
        `Feels like ${Math.round(current.apparent_temperature)}°C`;

    humidity.textContent = `${current.relative_humidity_2m}%`;

    windSpeed.textContent =
        `${Math.round(current.wind_speed_10m)} km/h`;

    weatherIcon.textContent = weather.icon;

    // Find the UV index for the hour nearest to the current observation.
    const hourly = data.hourly;
    const currentHour = current.time.slice(0, 13);

    const uvHourIndex = hourly.time.findIndex(
        time => time.slice(0, 13) === currentHour
    );

    const uvValue = uvHourIndex >= 0
        ? hourly.uv_index[uvHourIndex]
        : null;

    uvIndex.textContent =
        uvValue == null ? "Unavailable" : uvValue.toFixed(1);

    // Give the weather visual a subtle condition-specific treatment.
    document.querySelector("#weather-visual").setAttribute(
        "aria-label",
        weather.description
    );
}

// Build the five-day forecast.
function displayForecast(data) {
    const daily = data.daily;

    forecastGrid.replaceChildren();

    daily.time.forEach((date, index) => {
        const weather = getWeatherInfo(daily.weather_code[index]);

        const dayName = index === 0
            ? "Today"
            : formatDate(date, { weekday: "short" });

        const card = document.createElement("article");
        card.className = "forecast-card card";

        const day = document.createElement("p");
        day.className = "forecast-day";
        day.textContent = dayName;

        const icon = document.createElement("div");
        icon.className = "forecast-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = weather.icon;

        const condition = document.createElement("p");
        condition.className = "forecast-condition";
        condition.textContent = weather.description;

        const temperatures = document.createElement("div");
        temperatures.className = "forecast-temperatures";

        const high = document.createElement("span");
        high.textContent = `${Math.round(daily.temperature_2m_max[index])}°`;

        const low = document.createElement("span");
        low.className = "low";
        low.textContent = `${Math.round(daily.temperature_2m_min[index])}°`;

        temperatures.append(high, low);
        card.append(day, icon, condition, temperatures);
        forecastGrid.append(card);
    });
}

// Search for a city and update the entire dashboard.
async function searchWeather(city) {
    const query = city.trim();

    if (!query) {
        setStatus("Enter a city name to get started.", "error");
        cityInput.focus();
        return;
    }

    setLoading(true);
    setStatus("Finding your location and retrieving weather...");

    try {
        const place = await findCity(query);

        const weatherData = await getWeather(
            place.latitude,
            place.longitude
        );

        if (!weatherData.current || !weatherData.daily) {
            throw new Error("The weather service returned incomplete data.");
        }

        displayCurrentWeather(place, weatherData);
        displayForecast(weatherData);

        setStatus(`Weather updated for ${place.name}.`, "success");
    } catch (error) {
        console.error("Atmos weather error:", error);

        setStatus(
            error.message.includes("couldn't find")
                ? error.message
                : "We couldn't retrieve the weather. Check your connection and try again.",
            "error"
        );
    } finally {
        setLoading(false);
    }
}

// Handle form submissions.
searchForm.addEventListener("submit", event => {
    event.preventDefault();
    searchWeather(cityInput.value);
});

// Initialise the dashboard.
setStatus("Search for a city to discover its weather.");
console.log("Atmos Weather Dashboard initialised successfully.");