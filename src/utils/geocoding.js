const https = require("https");

const DEFAULT_PROVIDER = process.env.GEOCODER_PROVIDER || "nominatim";

function requestJson(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, options, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on("error", reject);
        req.end();
    });
}

async function geocodeWithGoogle(address) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_MAPS_API_KEY is not configured");
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await requestJson(url);

    if (response.status !== "OK" || !response.results || !response.results.length) {
        throw new Error(`Geocoding failed: ${response.status || "unknown status"}`);
    }

    const bestMatch = response.results[0];
    return {
        latitude: bestMatch.geometry.location.lat,
        longitude: bestMatch.geometry.location.lng,
        formattedAddress: bestMatch.formatted_address,
    };
}

async function geocodeWithNominatim(address) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1`;
    const userAgent = process.env.GEOCODER_USER_AGENT || "toyscoin-be/1.0 (https://toyscoin.org/contact)";

    const response = await requestJson(url, {
        headers: {
            "User-Agent": userAgent,
            Accept: "application/json"
        }
    });

    if (!Array.isArray(response) || response.length === 0) {
        throw new Error("Geocoding failed: no results found");
    }

    const bestMatch = response[0];
    return {
        latitude: parseFloat(bestMatch.lat),
        longitude: parseFloat(bestMatch.lon),
        formattedAddress: bestMatch.display_name,
    };
}

async function geocodeAddress(address, { provider = DEFAULT_PROVIDER } = {}) {
    if (!address) {
        throw new Error("Address is required for geocoding");
    }

    switch (provider.toLowerCase()) {
        case "google":
            return geocodeWithGoogle(address);
        case "nominatim":
            return geocodeWithNominatim(address);
        default:
            throw new Error(`Unsupported geocoding provider: ${provider}`);
    }
}

module.exports = {
    geocodeAddress,
};

