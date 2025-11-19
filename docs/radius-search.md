# Radius Search Feature

This document explains how the Toys Coin backend geocodes agency addresses and exposes a radius-based search API, plus the steps required to use it from the frontend.

---

## 1. Overview

Agencies store their address information. On submission, the backend geocodes the address (using OpenStreetMap Nominatim by default) and saves the GeoJSON coordinates on the `Agency` document. The `/api/agency/agencies/nearby` endpoint accepts either coordinates or an address/ZIP code, geocodes if needed, and returns all agencies within the requested radius, sorted by distance.

---

## 2. Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `GEOCODER_PROVIDER` | No (default `nominatim`) | `nominatim` (free) or `google`. |
| `GEOCODER_USER_AGENT` | Recommended | Required by Nominatim. Example: `toyscoin-be/1.0 (admin@toyscoin.org)` |
| `GOOGLE_MAPS_API_KEY` | Only if using Google | API key with Geocoding API enabled. |

Add these to `.env` or deployment secrets.

---

## 3. MongoDB Setup

The `Agency` schema defines a `2dsphere` index on the `location` field. Ensure your collection builds the index:

```js
db.agencies.createIndex({ location: "2dsphere" })
```

If new agencies submit their address through the API, the index is created automatically when the first document with `location` is saved.

---

## 4. Backend API

### 4.1 Submit & Geocode Agency

- **Endpoint**: `POST /api/agency/submit-details`
- **Purpose**: Saves agency details and geocodes the shipping address / ZIP code.
- **Relevant fields saved**:
  - `location.coordinates: [longitude, latitude]`
  - `geocoded_address`

If you need to update existing agencies, re-submit the address via this endpoint or run a one-off script that calls the `geocodeAddress` utility for each document.

### 4.2 Radius Filter Endpoint

- **Endpoint**: `GET /api/agency/agencies/nearby`
- **Query Parameters** (provide either coordinates or an address/ZIP):
  - `latitude`, `longitude` (numbers)
  - `zip_code` (string)
  - `address` (string)
  - `radiusMiles` (optional, default `30`)
- **Response**: JSON payload with an `agencies` array. Each entry includes:
  - Agency fields (name, contact info, address, etc.)
  - `distanceInMeters`
  - `distanceInMiles`

Example:

```
GET /api/agency/agencies/nearby?zip_code=208002&radiusMiles=40
```

Backend flow:
1. Parse input params.
2. If no coordinates were provided, geocode the `zip_code` or `address`.
3. Use `$geoNear` aggregation to fetch and sort agencies within `radiusMiles`.
4. Return the list to the client.

Error cases:
- Missing location input → HTTP 400 with message.
- Geocoder failure → HTTP 500 with message.

---

## 5. Frontend Integration

### 5.1 Collect user input

Two primary approaches:
1. Prompt for ZIP code (and optionally radius). Default to `30` miles.
2. Offer a “Use my location” button using the browser Geolocation API:
   ```js
   navigator.geolocation.getCurrentPosition(
     ({ coords }) => {
       // coords.latitude, coords.longitude
     },
     (error) => {
       // handle permission denied or errors
     }
   );
   ```

### 5.2 Call the API

```js
async function fetchAgencies({ zip, radius, coords }) {
  const params = new URLSearchParams();
  params.set("radiusMiles", radius ?? 30);

  if (coords) {
    params.set("latitude", coords.latitude);
    params.set("longitude", coords.longitude);
  } else if (zip) {
    params.set("zip_code", zip);
  }

  const response = await fetch(`/api/agency/agencies/nearby?${params}`, {
    credentials: "include",
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || "Unable to load agencies");
  }

  return body.agencies;
}
```

### 5.3 Display Results

- Sort results by `distanceInMiles` (already sorted by the backend).
- Show agency name, distance, address, and link to details.
- Handle empty results with a friendly message.
- For map integration, use `agency.location.coordinates` as `[lng, lat]`.

### 5.4 Error & Edge Cases

- Show validation errors when response status is `400`.
- Display a toast/message if the geocoder fails (`500`).
- If the user denies geolocation, fall back to ZIP entry.

---

## 6. Maintenance & Limits

- Nominatim has rate limits and fair-use guidelines; cache responses when possible and include a descriptive user agent.
- Google Geocoding is paid but offers higher quotas; switch by setting `GEOCODER_PROVIDER=google` and `GOOGLE_MAPS_API_KEY`.
- Monitor logs for geocoding failures to adjust address validation or provider choice.

---

## 7. Testing Checklist

- [ ] Submit a new agency with a valid address and verify `location` is saved.
- [ ] Call the nearby endpoint with a ZIP code and confirm results are returned and sorted by distance.
- [ ] Try coordinates directly to see the same behaviour.
- [ ] Deny geolocation access in the browser and ensure the UI gracefully prompts for ZIP.
- [ ] Simulate invalid address/ZIP to confirm error handling works.

---

## 8. Additional Utilities

- `src/utils/geocoding.js`: wrapper for Nominatim/Google geocoding.
- `GEOCODER_PROVIDER` switch if you need to change providers later.
- Consider a batch migration script for legacy agencies without coordinates.

---

With these steps in place, users can enter a ZIP code and radius (or use their device location) and retrieve all agencies within that distance—no additional geofencing service is necessary.



